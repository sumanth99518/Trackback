import { Journey, RoutePoint, LiveLocation, AppSettings } from '../types';
import { db } from './db';
import { calculateHaversineDistance } from './geoUtils';
import { wakeLock } from './wakeLock';

export type TrackingListener = (state: {
  journey: Journey | null;
  currentLocation: LiveLocation | null;
  points: RoutePoint[];
  gpsStatus: 'acquiring' | 'locked' | 'poor_signal' | 'denied' | 'simulated';
}) => void;

class TrackingService {
  private activeJourney: Journey | null = null;
  private recordedPoints: RoutePoint[] = [];
  private currentLiveLocation: LiveLocation | null = null;
  private watchId: number | null = null;
  private listeners: Set<TrackingListener> = new Set();
  private gpsStatus: 'acquiring' | 'locked' | 'poor_signal' | 'denied' | 'simulated' = 'acquiring';
  private timerInterval: number | null = null;
  private simulationInterval: number | null = null;
  private isSimulating: boolean = false;
  private lastSavedPoint: RoutePoint | null = null;

  // Default starting coordinate if user denies or indoors: Yosemite Valley Trailhead
  private simBaseLat: number = 37.7456;
  private simBaseLon: number = -119.5936;
  private simHeading: number = 45; // heading in degrees
  private simStep: number = 0;

  constructor() {
    this.initCrashRecovery();
  }

  async initCrashRecovery(): Promise<void> {
    const active = await db.getActiveJourney();
    if (active) {
      this.activeJourney = active;
      this.recordedPoints = await db.getRoutePointsForJourney(active.id);
      if (this.recordedPoints.length > 0) {
        this.lastSavedPoint = this.recordedPoints[this.recordedPoints.length - 1];
        this.currentLiveLocation = {
          latitude: this.lastSavedPoint.latitude,
          longitude: this.lastSavedPoint.longitude,
          accuracyMeters: this.lastSavedPoint.accuracyMeters,
          altitudeMeters: this.lastSavedPoint.altitudeMeters,
          speedMetersPerSecond: this.lastSavedPoint.speedMetersPerSecond,
          heading: this.lastSavedPoint.heading,
          timestamp: this.lastSavedPoint.timestamp,
        };
      }
      this.notifyListeners();
    }
  }

  subscribe(listener: TrackingListener): () => void {
    this.listeners.add(listener);
    listener({
      journey: this.activeJourney,
      currentLocation: this.currentLiveLocation,
      points: this.recordedPoints,
      gpsStatus: this.gpsStatus,
    });
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    const state = {
      journey: this.activeJourney,
      currentLocation: this.currentLiveLocation,
      points: this.recordedPoints,
      gpsStatus: this.gpsStatus,
    };
    this.listeners.forEach((fn) => fn(state));
  }

  // --- START TRACKING ---

  async startTracking(journeyName?: string, simulate: boolean = false): Promise<Journey> {
    if (this.activeJourney && this.activeJourney.status === 'paused') {
      return this.resumeTracking();
    }

    const now = Date.now();
    const id = `journey_${now}_${Math.random().toString(36).substring(2, 6)}`;
    const name = journeyName || `Trail ${new Date(now).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`;

    let startLat = this.currentLiveLocation?.latitude || this.simBaseLat;
    let startLon = this.currentLiveLocation?.longitude || this.simBaseLon;

    const newJourney: Journey = {
      id,
      name,
      startedAt: now,
      endedAt: null,
      totalDistanceMeters: 0,
      durationSeconds: 0,
      status: 'recording',
      startLatitude: startLat,
      startLongitude: startLon,
      lastRecordedAt: now,
    };

    this.activeJourney = newJourney;
    this.recordedPoints = [];
    this.lastSavedPoint = null;

    await db.saveJourney(newJourney);
    wakeLock.requestWakeLock();

    this.startDurationTimer();

    if (simulate) {
      this.startSimulation();
    } else {
      this.startRealGPS();
    }

    this.notifyListeners();
    return newJourney;
  }

  // --- REAL GPS WATCHER ---

  private startRealGPS(): void {
    this.stopSimulation();
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      this.gpsStatus = 'denied';
      this.notifyListeners();
      return;
    }

    this.gpsStatus = 'acquiring';
    this.notifyListeners();

    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
    }

    this.watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const accuracy = pos.coords.accuracy;
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        const alt = pos.coords.altitude;
        const speed = pos.coords.speed;
        const heading = pos.coords.heading;

        this.gpsStatus = accuracy > 35 ? 'poor_signal' : 'locked';

        const liveLoc: LiveLocation = {
          latitude: lat,
          longitude: lon,
          accuracyMeters: accuracy,
          altitudeMeters: alt,
          speedMetersPerSecond: speed,
          heading: heading,
          timestamp: pos.timestamp || Date.now(),
        };

        this.currentLiveLocation = liveLoc;
        this.processNewCoordinate(liveLoc);
      },
      (err) => {
        console.warn('Geolocation error:', err.message);
        if (err.code === err.PERMISSION_DENIED) {
          this.gpsStatus = 'denied';
        } else {
          this.gpsStatus = 'poor_signal';
        }
        this.notifyListeners();
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 1000,
      }
    );
  }

  // --- PROCESS NEW COORDINATE WITH SMART FILTERING ---

  private async processNewCoordinate(loc: LiveLocation): Promise<void> {
    if (!this.activeJourney || this.activeJourney.status !== 'recording') {
      this.notifyListeners();
      return;
    }

    // Filter out completely unusable accuracy fixes (> 40 meters)
    if (loc.accuracyMeters > 40) {
      this.notifyListeners();
      return;
    }

    const prev = this.lastSavedPoint;

    if (prev) {
      const distFromLast = calculateHaversineDistance(
        prev.latitude,
        prev.longitude,
        loc.latitude,
        loc.longitude
      );
      const timeDiffSeconds = Math.max(1, (loc.timestamp - prev.timestamp) / 1000);
      const impliedSpeed = distFromLast / timeDiffSeconds;

      // Filter implausible teleports/jumps (> 120 km/h = 33.3 m/s)
      if (impliedSpeed > 34) {
        console.warn('GPS jump rejected:', impliedSpeed, 'm/s');
        this.notifyListeners();
        return;
      }

      // Deadband filtering: discard stationary jitters (< 3 meters and < 20 seconds)
      if (distFromLast < 3.0 && timeDiffSeconds < 20) {
        this.notifyListeners();
        return;
      }

      // Check for GPS data gap (e.g. user was in a tunnel/canyon or app was suspended for > 60s)
      let isGap = false;
      if (timeDiffSeconds > 60 && distFromLast > 50) {
        isGap = true;
        prev.isGapAfter = true;
        await db.addRoutePoint(prev);
      }

      // Accumulate distance
      this.activeJourney.totalDistanceMeters += Math.round(distFromLast);
    } else {
      // First point of journey
      this.activeJourney.startLatitude = loc.latitude;
      this.activeJourney.startLongitude = loc.longitude;
    }

    const sequenceNumber = this.recordedPoints.length;
    const newPoint: RoutePoint = {
      id: `pt_${this.activeJourney.id}_${sequenceNumber}`,
      journeyId: this.activeJourney.id,
      sequenceNumber,
      latitude: loc.latitude,
      longitude: loc.longitude,
      timestamp: loc.timestamp,
      accuracyMeters: loc.accuracyMeters,
      altitudeMeters: loc.altitudeMeters,
      speedMetersPerSecond: loc.speedMetersPerSecond,
      heading: loc.heading,
    };

    this.recordedPoints.push(newPoint);
    this.lastSavedPoint = newPoint;
    this.activeJourney.lastRecordedAt = loc.timestamp;

    // Incrementally save to IndexedDB
    await db.addRoutePoint(newPoint);
    await db.saveJourney(this.activeJourney);

    this.notifyListeners();
  }

  // --- CONTROLS ---

  pauseTracking(): void {
    if (!this.activeJourney || this.activeJourney.status !== 'recording') return;
    this.activeJourney.status = 'paused';
    if (this.lastSavedPoint) {
      this.lastSavedPoint.isGapAfter = true;
      db.addRoutePoint(this.lastSavedPoint);
    }
    db.saveJourney(this.activeJourney);
    this.stopDurationTimer();
    this.notifyListeners();
  }

  resumeTracking(): Journey {
    if (!this.activeJourney) throw new Error('No active journey to resume');
    this.activeJourney.status = 'recording';
    db.saveJourney(this.activeJourney);
    this.startDurationTimer();
    wakeLock.requestWakeLock();
    this.notifyListeners();
    return this.activeJourney;
  }

  async finishTracking(): Promise<Journey> {
    if (!this.activeJourney) throw new Error('No active journey to finish');
    this.activeJourney.status = 'completed';
    this.activeJourney.endedAt = Date.now();
    await db.saveJourney(this.activeJourney);

    this.stopDurationTimer();
    this.stopSimulation();
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
    wakeLock.releaseWakeLock();

    const finished = this.activeJourney;
    this.notifyListeners();
    return finished;
  }

  async discardActiveJourney(): Promise<void> {
    if (this.activeJourney) {
      await db.deleteJourney(this.activeJourney.id);
      this.activeJourney = null;
      this.recordedPoints = [];
      this.lastSavedPoint = null;
      this.stopDurationTimer();
      this.stopSimulation();
      if (this.watchId !== null && typeof navigator !== 'undefined') {
        navigator.geolocation.clearWatch(this.watchId);
        this.watchId = null;
      }
      wakeLock.releaseWakeLock();
      this.notifyListeners();
    }
  }

  // --- TIMER ---

  private startDurationTimer(): void {
    this.stopDurationTimer();
    this.timerInterval = window.setInterval(() => {
      if (this.activeJourney && this.activeJourney.status === 'recording') {
        this.activeJourney.durationSeconds += 1;
        // Periodically update journey header in DB every 5 seconds
        if (this.activeJourney.durationSeconds % 5 === 0) {
          db.saveJourney(this.activeJourney);
        }
        this.notifyListeners();
      }
    }, 1000);
  }

  private stopDurationTimer(): void {
    if (this.timerInterval !== null) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  // --- SIMULATION & TESTING HELPERS ---

  toggleSimulationMode(): boolean {
    if (this.isSimulating) {
      this.stopSimulation();
      this.startRealGPS();
      return false;
    } else {
      this.startSimulation();
      return true;
    }
  }

  startSimulation(): void {
    this.isSimulating = true;
    this.gpsStatus = 'simulated';

    if (this.watchId !== null && typeof navigator !== 'undefined') {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }

    // Set starting position
    let currLat = this.currentLiveLocation?.latitude || this.simBaseLat;
    let currLon = this.currentLiveLocation?.longitude || this.simBaseLon;

    this.currentLiveLocation = {
      latitude: currLat,
      longitude: currLon,
      accuracyMeters: 4,
      altitudeMeters: 1210,
      speedMetersPerSecond: 1.3, // ~4.7 km/h walking speed
      heading: this.simHeading,
      timestamp: Date.now(),
    };

    if (this.simulationInterval !== null) {
      clearInterval(this.simulationInterval);
    }

    // Advance 6-8 meters every 2.5 seconds along a natural winding trail
    this.simulationInterval = window.setInterval(() => {
      if (!this.currentLiveLocation) return;
      this.simStep++;

      // Gradually curve trail with natural turns every 8-15 steps
      if (this.simStep % 10 === 0) {
        this.simHeading = (this.simHeading + (Math.random() > 0.5 ? 45 : -45) + 360) % 360;
      }

      // Add gentle jitter
      const stepDistMeters = 6.5 + (Math.random() - 0.5) * 1.5;
      const headingRad = (this.simHeading * Math.PI) / 180;

      // Displacement in meters to lat/lon
      const dLat = (stepDistMeters * Math.cos(headingRad)) / 111111;
      const dLon = (stepDistMeters * Math.sin(headingRad)) / (111111 * Math.cos((this.currentLiveLocation.latitude * Math.PI) / 180));

      const nextLat = this.currentLiveLocation.latitude + dLat;
      const nextLon = this.currentLiveLocation.longitude + dLon;

      const updatedLoc: LiveLocation = {
        latitude: nextLat,
        longitude: nextLon,
        accuracyMeters: 3 + Math.random() * 2,
        altitudeMeters: (this.currentLiveLocation.altitudeMeters || 1200) + (Math.random() - 0.48) * 0.5,
        speedMetersPerSecond: 1.25 + (Math.random() - 0.5) * 0.2,
        heading: this.simHeading,
        timestamp: Date.now(),
      };

      this.currentLiveLocation = updatedLoc;
      this.processNewCoordinate(updatedLoc);
    }, 2000);

    this.notifyListeners();
  }

  stopSimulation(): void {
    this.isSimulating = false;
    if (this.simulationInterval !== null) {
      clearInterval(this.simulationInterval);
      this.simulationInterval = null;
    }
  }

  /**
   * Manually displace live location for testing off-route detection
   */
  simulateOffRouteExcursion(distanceMeters: number = 40): void {
    if (!this.currentLiveLocation) return;
    const offsetLat = distanceMeters / 111111;
    this.currentLiveLocation = {
      ...this.currentLiveLocation,
      latitude: this.currentLiveLocation.latitude + offsetLat,
      timestamp: Date.now(),
    };
    this.notifyListeners();
  }

  /**
   * Set live location directly (used during retracing simulation)
   */
  setLiveLocationManually(loc: LiveLocation): void {
    this.currentLiveLocation = loc;
    this.notifyListeners();
  }

  getCurrentLocation(): LiveLocation | null {
    return this.currentLiveLocation;
  }

  getActiveJourneySync(): Journey | null {
    return this.activeJourney;
  }

  getRecordedPointsSync(): RoutePoint[] {
    return this.recordedPoints;
  }
}

export const trackingService = new TrackingService();
