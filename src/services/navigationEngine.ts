import { Journey, RoutePoint, LiveLocation, NavigationState, NavigationMode, TurnInstruction, AppSettings } from '../types';
import { reverseRoute, matchLocationToReversedRoute, generateTurnInstructions, calculateHaversineDistance, calculateBearing } from './geoUtils';
import { soundHaptics } from './soundHaptics';
import { trackingService } from './trackingService';
import { db, DEFAULT_SETTINGS } from './db';

export type NavigationListener = (state: NavigationState) => void;

class NavigationEngine {
  private activeJourney: Journey | null = null;
  private reversedRoutePoints: RoutePoint[] = [];
  private turnInstructions: TurnInstruction[] = [];
  private listeners: Set<NavigationListener> = new Set();
  private isOffRoutePrev: boolean = false;
  private settings: AppSettings = DEFAULT_SETTINGS;

  private state: NavigationState = {
    active: false,
    mode: 'footsteps',
    currentProgressIndex: 0,
    totalWaypoints: 0,
    remainingDistanceMeters: 0,
    distanceToNextTurn: 0,
    bearingToNextWaypoint: 0,
    relativeTurnAngle: 0,
    currentInstruction: {
      type: 'straight',
      text: 'Starting return journey',
      distanceToTurnMeters: 0,
      targetPointIndex: 0,
    },
    isOffRoute: false,
    offRouteDistanceMeters: 0,
    reconnectionBearing: 0,
    reconnectionTargetPoint: null,
    hasArrived: false,
    retraceStartTime: 0,
  };

  private trackingUnsub: (() => void) | null = null;
  private simWalkInterval: number | null = null;

  constructor() {
    this.loadSettings();
  }

  async loadSettings(): Promise<void> {
    this.settings = await db.getSettings();
  }

  updateSettings(newSettings: AppSettings): void {
    this.settings = newSettings;
  }

  subscribe(listener: NavigationListener): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    this.listeners.forEach((fn) => fn({ ...this.state }));
  }

  // --- START REVERSE NAVIGATION ---

  async startNavigation(journey: Journey, points: RoutePoint[], mode: NavigationMode = 'footsteps'): Promise<void> {
    this.stopNavigation();
    await this.loadSettings();

    if (points.length < 2) {
      throw new Error('Not enough recorded points to create a return route (need at least 2 points).');
    }

    this.activeJourney = journey;
    // Reverse the points: P_n -> P_0
    this.reversedRoutePoints = reverseRoute(points);
    this.turnInstructions = generateTurnInstructions(this.reversedRoutePoints);

    const now = Date.now();
    const currentLoc = trackingService.getCurrentLocation();
    const liveLat = currentLoc?.latitude ?? this.reversedRoutePoints[0].latitude;
    const liveLon = currentLoc?.longitude ?? this.reversedRoutePoints[0].longitude;

    this.state = {
      active: true,
      mode,
      currentProgressIndex: 0,
      totalWaypoints: this.reversedRoutePoints.length,
      remainingDistanceMeters: 0,
      distanceToNextTurn: 0,
      bearingToNextWaypoint: 0,
      relativeTurnAngle: 0,
      currentInstruction: this.turnInstructions[0] || {
        type: 'straight',
        text: 'Follow path in reverse',
        distanceToTurnMeters: 0,
        targetPointIndex: 0,
      },
      isOffRoute: false,
      offRouteDistanceMeters: 0,
      reconnectionBearing: 0,
      reconnectionTargetPoint: null,
      hasArrived: false,
      retraceStartTime: now,
    };

    this.isOffRoutePrev = false;

    // Listen to real/simulated GPS updates
    this.trackingUnsub = trackingService.subscribe(({ currentLocation }) => {
      if (currentLocation && this.state.active) {
        this.updateUserPosition(currentLocation);
      }
    });

    if (currentLoc) {
      this.updateUserPosition(currentLoc);
    }

    this.notifyListeners();
  }

  setMode(mode: NavigationMode): void {
    this.state.mode = mode;
    this.notifyListeners();
  }

  // --- POSITION UPDATE & OFF-ROUTE ENGINE ---

  updateUserPosition(location: LiveLocation): void {
    if (!this.state.active || this.reversedRoutePoints.length === 0) return;

    // Check arrival at original start point P_0 (which is the last element of reversedRoutePoints)
    const destination = this.reversedRoutePoints[this.reversedRoutePoints.length - 1];
    const distanceToStart = calculateHaversineDistance(
      location.latitude,
      location.longitude,
      destination.latitude,
      destination.longitude
    );

    const arrivalThreshold = this.settings.arrivalRadiusMeters || 15;

    if (distanceToStart <= arrivalThreshold && !this.state.hasArrived) {
      this.state.hasArrived = true;
      this.state.remainingDistanceMeters = 0;
      this.state.currentInstruction = {
        type: 'arrive',
        text: 'You have arrived at your starting point!',
        distanceToTurnMeters: 0,
        targetPointIndex: this.reversedRoutePoints.length - 1,
      };
      if (this.settings.soundAlerts) soundHaptics.playArrivalFanfare();
      this.notifyListeners();
      return;
    }

    // Match location along reversed route with hysteresis
    const match = matchLocationToReversedRoute(
      location.latitude,
      location.longitude,
      this.reversedRoutePoints,
      this.state.currentProgressIndex,
      this.settings.offRouteThresholdMeters || 25
    );

    // Update progress index (monotonically advancing towards destination)
    if (match.matchedIndex >= this.state.currentProgressIndex) {
      this.state.currentProgressIndex = match.matchedIndex;
    }

    this.state.remainingDistanceMeters = match.remainingDistanceMeters;
    this.state.bearingToNextWaypoint = match.bearingToNext;
    this.state.offRouteDistanceMeters = match.perpendicularDistance;
    this.state.isOffRoute = match.isOffRoute;
    this.state.reconnectionBearing = match.reconnectionBearing;
    this.state.reconnectionTargetPoint = match.closestPoint;

    // Find next upcoming turn instruction along the reversed path
    const upcomingTurn = this.turnInstructions.find(
      (inst) => inst.targetPointIndex > this.state.currentProgressIndex
    ) || this.turnInstructions[this.turnInstructions.length - 1];

    if (upcomingTurn) {
      const turnTargetPoint = this.reversedRoutePoints[upcomingTurn.targetPointIndex];
      const distToTurn = calculateHaversineDistance(
        location.latitude,
        location.longitude,
        turnTargetPoint.latitude,
        turnTargetPoint.longitude
      );
      this.state.distanceToNextTurn = Math.round(distToTurn);
      this.state.currentInstruction = upcomingTurn;
    }

    // Audio & Haptics alert on off-route status transitions
    if (this.state.isOffRoute && !this.isOffRoutePrev) {
      if (this.settings.soundAlerts) soundHaptics.playOffRouteAlert();
    } else if (!this.state.isOffRoute && this.isOffRoutePrev) {
      if (this.settings.soundAlerts) soundHaptics.playReconnectedChime();
    }
    this.isOffRoutePrev = this.state.isOffRoute;

    this.notifyListeners();
  }

  // --- SIMULATED WALK IN REVERSE (FOR TESTING / DEMO) ---

  startSimulatedReturn(): void {
    this.stopSimulatedReturn();
    if (!this.state.active || this.reversedRoutePoints.length === 0) return;

    let targetIdx = this.state.currentProgressIndex;

    this.simWalkInterval = window.setInterval(() => {
      if (targetIdx >= this.reversedRoutePoints.length - 1) {
        this.stopSimulatedReturn();
        return;
      }

      targetIdx++;
      const pt = this.reversedRoutePoints[targetIdx];
      const nextPt = this.reversedRoutePoints[Math.min(this.reversedRoutePoints.length - 1, targetIdx + 1)];
      const bearing = calculateBearing(pt.latitude, pt.longitude, nextPt.latitude, nextPt.longitude);

      const simLoc: LiveLocation = {
        latitude: pt.latitude,
        longitude: pt.longitude,
        accuracyMeters: 4,
        altitudeMeters: pt.altitudeMeters || 1200,
        speedMetersPerSecond: 1.3,
        heading: bearing,
        timestamp: Date.now(),
      };

      trackingService.setLiveLocationManually(simLoc);
      this.updateUserPosition(simLoc);
    }, 1500);
  }

  stopSimulatedReturn(): void {
    if (this.simWalkInterval !== null) {
      clearInterval(this.simWalkInterval);
      this.simWalkInterval = null;
    }
  }

  stopNavigation(): void {
    this.stopSimulatedReturn();
    if (this.trackingUnsub) {
      this.trackingUnsub();
      this.trackingUnsub = null;
    }
    this.state.active = false;
    this.state.hasArrived = false;
    this.reversedRoutePoints = [];
    this.turnInstructions = [];
    this.notifyListeners();
  }

  getState(): NavigationState {
    return this.state;
  }

  getReversedRoutePoints(): RoutePoint[] {
    return this.reversedRoutePoints;
  }

  getActiveJourney(): Journey | null {
    return this.activeJourney;
  }
}

export const navigationEngine = new NavigationEngine();
