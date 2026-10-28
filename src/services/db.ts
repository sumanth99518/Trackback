import { Journey, RoutePoint, OfflineRegion, AppSettings } from '../types';

const DB_NAME = 'trackback_offline_db';
const DB_VERSION = 2;

export const DEFAULT_SETTINGS: AppSettings = {
  unit: 'metric',
  recordingFrequency: 'high',
  offRouteThresholdMeters: 25,
  arrivalRadiusMeters: 15,
  soundAlerts: true,
  hapticAlerts: true,
  keepScreenAwake: true,
  mapLayer: 'outdoors',
};

class TrackBackDB {
  private dbPromise: Promise<IDBDatabase> | null = null;

  private getDB(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') {
        reject(new Error('IndexedDB is not supported in this environment'));
        return;
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Journeys store
        if (!db.objectStoreNames.contains('journeys')) {
          const journeyStore = db.createObjectStore('journeys', { keyPath: 'id' });
          journeyStore.createIndex('startedAt', 'startedAt', { unique: false });
          journeyStore.createIndex('status', 'status', { unique: false });
        }

        // Route points store
        if (!db.objectStoreNames.contains('route_points')) {
          const pointStore = db.createObjectStore('route_points', { keyPath: 'id' });
          pointStore.createIndex('journeyId', 'journeyId', { unique: false });
          pointStore.createIndex('journey_seq', ['journeyId', 'sequenceNumber'], { unique: true });
        }

        // Offline map regions
        if (!db.objectStoreNames.contains('offline_regions')) {
          db.createObjectStore('offline_regions', { keyPath: 'id' });
        }

        // Cached map tiles: key is `${z}/${x}/${y}`
        if (!db.objectStoreNames.contains('cached_tiles')) {
          const tileStore = db.createObjectStore('cached_tiles', { keyPath: 'key' });
          tileStore.createIndex('regionId', 'regionId', { unique: false });
          tileStore.createIndex('timestamp', 'timestamp', { unique: false });
        }

        // Settings store
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'id' });
        }
      };

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });

    return this.dbPromise;
  }

  // --- JOURNEYS ---

  async saveJourney(journey: Journey): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('journeys', 'readwrite');
      const store = tx.objectStore('journeys');
      const req = store.put(journey);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async getJourney(id: string): Promise<Journey | null> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('journeys', 'readonly');
      const store = tx.objectStore('journeys');
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  async getAllJourneys(): Promise<Journey[]> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('journeys', 'readonly');
      const store = tx.objectStore('journeys');
      const req = store.getAll();
      req.onsuccess = () => {
        const journeys: Journey[] = req.result || [];
        // Sort descending by startedAt
        journeys.sort((a, b) => b.startedAt - a.startedAt);
        resolve(journeys);
      };
      req.onerror = () => reject(req.error);
    });
  }

  async deleteJourney(id: string): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(['journeys', 'route_points'], 'readwrite');
      tx.objectStore('journeys').delete(id);

      // Delete all associated route points
      const pointStore = tx.objectStore('route_points');
      const index = pointStore.index('journeyId');
      const req = index.openKeyCursor(IDBKeyRange.only(id));

      req.onsuccess = () => {
        const cursor = req.result;
        if (cursor) {
          pointStore.delete(cursor.primaryKey);
          cursor.continue();
        }
      };

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async getActiveJourney(): Promise<Journey | null> {
    const all = await this.getAllJourneys();
    return all.find((j) => j.status === 'recording' || j.status === 'paused') || null;
  }

  // --- ROUTE POINTS ---

  async addRoutePoint(point: RoutePoint): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('route_points', 'readwrite');
      const store = tx.objectStore('route_points');
      const req = store.put(point);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async addRoutePointsBatch(points: RoutePoint[]): Promise<void> {
    if (points.length === 0) return;
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('route_points', 'readwrite');
      const store = tx.objectStore('route_points');
      for (const pt of points) {
        store.put(pt);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async getRoutePointsForJourney(journeyId: string): Promise<RoutePoint[]> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('route_points', 'readonly');
      const store = tx.objectStore('route_points');
      const index = store.index('journeyId');
      const req = index.getAll(IDBKeyRange.only(journeyId));

      req.onsuccess = () => {
        const points: RoutePoint[] = req.result || [];
        // Ensure chronological order by sequenceNumber
        points.sort((a, b) => a.sequenceNumber - b.sequenceNumber);
        resolve(points);
      };
      req.onerror = () => reject(req.error);
    });
  }

  // --- SETTINGS ---

  async getSettings(): Promise<AppSettings> {
    try {
      const db = await this.getDB();
      return new Promise((resolve) => {
        const tx = db.transaction('settings', 'readonly');
        const store = tx.objectStore('settings');
        const req = store.get('app_settings');
        req.onsuccess = () => {
          if (req.result && req.result.value) {
            resolve({ ...DEFAULT_SETTINGS, ...req.result.value });
          } else {
            resolve(DEFAULT_SETTINGS);
          }
        };
        req.onerror = () => resolve(DEFAULT_SETTINGS);
      });
    } catch {
      return DEFAULT_SETTINGS;
    }
  }

  async saveSettings(settings: AppSettings): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('settings', 'readwrite');
      const store = tx.objectStore('settings');
      const req = store.put({ id: 'app_settings', value: settings });
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  // --- OFFLINE REGIONS & TILE CACHE ---

  async saveOfflineRegion(region: OfflineRegion): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('offline_regions', 'readwrite');
      const store = tx.objectStore('offline_regions');
      const req = store.put(region);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async getOfflineRegions(): Promise<OfflineRegion[]> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('offline_regions', 'readonly');
      const store = tx.objectStore('offline_regions');
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  async deleteOfflineRegion(regionId: string): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(['offline_regions', 'cached_tiles'], 'readwrite');
      tx.objectStore('offline_regions').delete(regionId);

      const tileStore = tx.objectStore('cached_tiles');
      const index = tileStore.index('regionId');
      const req = index.openKeyCursor(IDBKeyRange.only(regionId));

      req.onsuccess = () => {
        const cursor = req.result;
        if (cursor) {
          tileStore.delete(cursor.primaryKey);
          cursor.continue();
        }
      };

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async saveCachedTile(key: string, dataUrl: string, regionId?: string): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('cached_tiles', 'readwrite');
      const store = tx.objectStore('cached_tiles');
      const req = store.put({
        key,
        dataUrl,
        regionId: regionId || 'adhoc',
        timestamp: Date.now(),
      });
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async getCachedTile(key: string): Promise<string | null> {
    try {
      const db = await this.getDB();
      return new Promise((resolve) => {
        const tx = db.transaction('cached_tiles', 'readonly');
        const store = tx.objectStore('cached_tiles');
        const req = store.get(key);
        req.onsuccess = () => {
          if (req.result && req.result.dataUrl) {
            resolve(req.result.dataUrl);
          } else {
            resolve(null);
          }
        };
        req.onerror = () => resolve(null);
      });
    } catch {
      return null;
    }
  }

  async getTileCacheStats(): Promise<{ count: number; estimatedSizeBytes: number }> {
    try {
      const db = await this.getDB();
      return new Promise((resolve) => {
        const tx = db.transaction('cached_tiles', 'readonly');
        const store = tx.objectStore('cached_tiles');
        const countReq = store.count();
        countReq.onsuccess = () => {
          const count = countReq.result || 0;
          // Approximate average tile size is ~22KB
          const estimatedSizeBytes = count * 22500;
          resolve({ count, estimatedSizeBytes });
        };
        countReq.onerror = () => resolve({ count: 0, estimatedSizeBytes: 0 });
      });
    } catch {
      return { count: 0, estimatedSizeBytes: 0 };
    }
  }

  async clearAllTiles(): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(['cached_tiles', 'offline_regions'], 'readwrite');
      tx.objectStore('cached_tiles').clear();
      tx.objectStore('offline_regions').clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  // --- EXPORT & IMPORT UTILITIES ---

  async exportToGPX(journeyId: string): Promise<string> {
    const journey = await this.getJourney(journeyId);
    if (!journey) throw new Error('Journey not found');
    const points = await this.getRoutePointsForJourney(journeyId);

    const escapeXml = (unsafe: string) =>
      unsafe.replace(/[<>&'"]/g, (c) => {
        switch (c) {
          case '<': return '&lt;';
          case '>': return '&gt;';
          case '&': return '&amp;';
          case '\'': return '&apos;';
          case '"': return '&quot;';
          default: return c;
        }
      });

    const trkpts = points.map((pt) => {
      const timeIso = new Date(pt.timestamp).toISOString();
      const ele = pt.altitudeMeters !== null ? `<ele>${pt.altitudeMeters.toFixed(1)}</ele>` : '';
      const speed = pt.speedMetersPerSecond !== null ? `<speed>${pt.speedMetersPerSecond.toFixed(2)}</speed>` : '';
      return `      <trkpt lat="${pt.latitude.toFixed(7)}" lon="${pt.longitude.toFixed(7)}">
        ${ele}
        <time>${timeIso}</time>
        ${speed}
        <extensions>
          <accuracy>${pt.accuracyMeters.toFixed(1)}</accuracy>
        </extensions>
      </trkpt>`;
    }).join('\n');

    return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="TrackBack Offline App" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>${escapeXml(journey.name)}</name>
    <time>${new Date(journey.startedAt).toISOString()}</time>
  </metadata>
  <trk>
    <name>${escapeXml(journey.name)}</name>
    <desc>Recorded with TrackBack Offline GPS Navigator</desc>
    <trkseg>
${trkpts}
    </trkseg>
  </trk>
</gpx>`;
  }

  async exportToGeoJSON(journeyId: string): Promise<string> {
    const journey = await this.getJourney(journeyId);
    if (!journey) throw new Error('Journey not found');
    const points = await this.getRoutePointsForJourney(journeyId);

    const coordinates = points.map((p) => [
      p.longitude,
      p.latitude,
      p.altitudeMeters || 0,
    ]);

    const geoJson = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: {
            id: journey.id,
            name: journey.name,
            startedAt: journey.startedAt,
            endedAt: journey.endedAt,
            totalDistanceMeters: journey.totalDistanceMeters,
            durationSeconds: journey.durationSeconds,
            status: journey.status,
          },
          geometry: {
            type: 'LineString',
            coordinates,
          },
        },
      ],
    };

    return JSON.stringify(geoJson, null, 2);
  }

  async importGPX(gpxContent: string, customName?: string): Promise<Journey> {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(gpxContent, 'text/xml');

    const parserError = xmlDoc.querySelector('parsererror');
    if (parserError) {
      throw new Error('Invalid GPX XML format');
    }

    const trkName = customName || xmlDoc.querySelector('trk > name')?.textContent || xmlDoc.querySelector('metadata > name')?.textContent || 'Imported Trail';
    const trkpts = xmlDoc.querySelectorAll('trkpt');

    if (trkpts.length === 0) {
      throw new Error('No GPS track points found in GPX file');
    }

    const journeyId = `journey_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = Date.now();
    const routePoints: RoutePoint[] = [];

    let totalDist = 0;
    let prevLat = 0;
    let prevLon = 0;

    trkpts.forEach((ptNode, idx) => {
      const lat = parseFloat(ptNode.getAttribute('lat') || '0');
      const lon = parseFloat(ptNode.getAttribute('lon') || '0');
      const eleNode = ptNode.querySelector('ele');
      const timeNode = ptNode.querySelector('time');
      const speedNode = ptNode.querySelector('speed');

      const alt = eleNode ? parseFloat(eleNode.textContent || '0') : null;
      const ptTime = timeNode && timeNode.textContent ? new Date(timeNode.textContent).getTime() : now + idx * 2000;
      const speed = speedNode ? parseFloat(speedNode.textContent || '0') : null;

      if (idx > 0) {
        // Simple approximate distance accumulation
        const dLat = (lat - prevLat) * Math.PI / 180;
        const dLon = (lon - prevLon) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos(prevLat * Math.PI / 180) * Math.cos(lat * Math.PI / 180) *
          Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        totalDist += 6371000 * c;
      }

      prevLat = lat;
      prevLon = lon;

      routePoints.push({
        id: `pt_${journeyId}_${idx}`,
        journeyId,
        sequenceNumber: idx,
        latitude: lat,
        longitude: lon,
        timestamp: ptTime,
        accuracyMeters: 5,
        altitudeMeters: alt,
        speedMetersPerSecond: speed,
        heading: null,
      });
    });

    const firstPoint = routePoints[0];
    const duration = routePoints.length > 1
      ? Math.max(1, Math.floor((routePoints[routePoints.length - 1].timestamp - firstPoint.timestamp) / 1000))
      : 0;

    const journey: Journey = {
      id: journeyId,
      name: trkName,
      startedAt: firstPoint.timestamp,
      endedAt: routePoints[routePoints.length - 1].timestamp,
      totalDistanceMeters: Math.round(totalDist),
      durationSeconds: duration,
      status: 'completed',
      startLatitude: firstPoint.latitude,
      startLongitude: firstPoint.longitude,
      lastRecordedAt: routePoints[routePoints.length - 1].timestamp,
    };

    await this.saveJourney(journey);
    await this.addRoutePointsBatch(routePoints);

    return journey;
  }
}

export const db = new TrackBackDB();
