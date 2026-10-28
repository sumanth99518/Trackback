export type JourneyStatus = 'recording' | 'paused' | 'completed' | 'retracing';

export interface RoutePoint {
  id: string;
  journeyId: string;
  sequenceNumber: number;
  latitude: number;
  longitude: number;
  timestamp: number;
  accuracyMeters: number;
  altitudeMeters: number | null;
  speedMetersPerSecond: number | null;
  heading: number | null;
  isGapAfter?: boolean; // When GPS was lost or recording was interrupted
}

export interface Journey {
  id: string;
  name: string;
  startedAt: number;
  endedAt: number | null;
  totalDistanceMeters: number;
  durationSeconds: number;
  status: JourneyStatus;
  startLatitude: number;
  startLongitude: number;
  lastRecordedAt: number;
  notes?: string;
}

export interface OfflineRegion {
  id: string;
  name: string;
  bounds: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
  minZoom: number;
  maxZoom: number;
  tileCount: number;
  storageSizeBytes: number;
  downloadStatus: 'pending' | 'downloading' | 'completed' | 'error';
  createdAt: number;
}

export interface AppSettings {
  unit: 'metric' | 'imperial';
  recordingFrequency: 'high' | 'balanced' | 'battery_saver';
  offRouteThresholdMeters: number;
  arrivalRadiusMeters: number;
  soundAlerts: boolean;
  hapticAlerts: boolean;
  keepScreenAwake: boolean;
  mapLayer: 'outdoors' | 'osm' | 'topo';
}

export type NavigationMode = 'footsteps' | 'overview';

export interface TurnInstruction {
  type: 'straight' | 'slight_right' | 'sharp_right' | 'slight_left' | 'sharp_left' | 'u_turn' | 'arrive';
  text: string;
  distanceToTurnMeters: number;
  targetPointIndex: number;
}

export interface NavigationState {
  active: boolean;
  mode: NavigationMode;
  currentProgressIndex: number; // Index in the reversed route array
  totalWaypoints: number;
  remainingDistanceMeters: number;
  distanceToNextTurn: number;
  bearingToNextWaypoint: number; // 0-360 degrees
  relativeTurnAngle: number; // -180 to 180 degrees
  currentInstruction: TurnInstruction;
  isOffRoute: boolean;
  offRouteDistanceMeters: number;
  reconnectionBearing: number;
  reconnectionTargetPoint: { latitude: number; longitude: number } | null;
  hasArrived: boolean;
  retraceStartTime: number;
}

export interface LiveLocation {
  latitude: number;
  longitude: number;
  accuracyMeters: number;
  altitudeMeters: number | null;
  speedMetersPerSecond: number | null;
  heading: number | null;
  timestamp: number;
}
