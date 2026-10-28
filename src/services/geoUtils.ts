import { RoutePoint, TurnInstruction } from '../types';

export const EARTH_RADIUS_METERS = 6371000;

/**
 * Calculates the great-circle distance between two coordinates using the Haversine formula.
 */
export function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const rLat1 = (lat1 * Math.PI) / 180;
  const rLat2 = (lat2 * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(rLat1) * Math.cos(rLat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_METERS * c;
}

/**
 * Calculates initial forward azimuth/bearing in degrees [0, 360) from point 1 to point 2.
 */
export function calculateBearing(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const rLat1 = (lat1 * Math.PI) / 180;
  const rLat2 = (lat2 * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;

  const y = Math.sin(dLon) * Math.cos(rLat2);
  const x =
    Math.cos(rLat1) * Math.sin(rLat2) -
    Math.sin(rLat1) * Math.cos(rLat2) * Math.cos(dLon);

  const brng = (Math.atan2(y, x) * 180) / Math.PI;
  return (brng + 360) % 360;
}

/**
 * Normalizes an angle difference to [-180, 180] degrees.
 * Positive = turn right, Negative = turn left.
 */
export function getRelativeAngle(fromBearing: number, toBearing: number): number {
  let diff = (toBearing - fromBearing) % 360;
  if (diff > 180) diff -= 360;
  if (diff < -180) diff += 360;
  return diff;
}

/**
 * Converts a degree bearing to an 8-point compass cardinal string.
 */
export function getCardinalDirection(bearing: number): string {
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const index = Math.round(bearing / 45) % 8;
  return directions[index];
}

/**
 * Projects a point (pLat, pLon) onto a line segment between (aLat, aLon) and (bLat, bLon).
 * Returns the projected coordinates on the segment and the distance from the point to the segment.
 */
export function projectPointOntoSegment(
  pLat: number,
  pLon: number,
  aLat: number,
  aLon: number,
  bLat: number,
  bLon: number
): { closestLat: number; closestLon: number; distanceMeters: number; t: number } {
  // Approximate projection in local planar coordinate system
  const cosLat = Math.cos(((aLat + bLat) / 2 * Math.PI) / 180);
  const dx = (bLon - aLon) * cosLat;
  const dy = bLat - aLat;

  const segLengthSq = dx * dx + dy * dy;

  if (segLengthSq === 0) {
    const dist = calculateHaversineDistance(pLat, pLon, aLat, aLon);
    return { closestLat: aLat, closestLon: aLon, distanceMeters: dist, t: 0 };
  }

  const px = (pLon - aLon) * cosLat;
  const py = pLat - aLat;

  // t is the scalar projection factor along vector AB
  let t = (px * dx + py * dy) / segLengthSq;
  t = Math.max(0, Math.min(1, t));

  const closestLat = aLat + t * (bLat - aLat);
  const closestLon = aLon + t * (bLon - aLon);
  const distanceMeters = calculateHaversineDistance(pLat, pLon, closestLat, closestLon);

  return { closestLat, closestLon, distanceMeters, t };
}

/**
 * Reverses recorded forward route points to construct the return path (P_n -> P_0).
 */
export function reverseRoute(points: RoutePoint[]): RoutePoint[] {
  if (points.length === 0) return [];
  const reversed = [...points].reverse();
  return reversed.map((p, idx) => ({
    ...p,
    sequenceNumber: idx,
  }));
}

/**
 * Computes total cumulative length of a polyline of points.
 */
export function calculatePolylineDistance(points: Array<{ latitude: number; longitude: number }>): number {
  let total = 0;
  for (let i = 0; i < points.length - 1; i++) {
    total += calculateHaversineDistance(
      points[i].latitude,
      points[i].longitude,
      points[i + 1].latitude,
      points[i + 1].longitude
    );
  }
  return total;
}

/**
 * Analyzes reversed route points to determine turn instructions along the return journey.
 */
export function generateTurnInstructions(reversedPoints: RoutePoint[]): TurnInstruction[] {
  if (reversedPoints.length < 2) {
    return [
      {
        type: 'arrive',
        text: 'At starting point',
        distanceToTurnMeters: 0,
        targetPointIndex: 0,
      },
    ];
  }

  const instructions: TurnInstruction[] = [];
  let accumulatedDist = 0;

  for (let i = 0; i < reversedPoints.length - 1; i++) {
    const p1 = reversedPoints[i];
    const p2 = reversedPoints[i + 1];
    const segDist = calculateHaversineDistance(p1.latitude, p1.longitude, p2.latitude, p2.longitude);
    accumulatedDist += segDist;

    if (i < reversedPoints.length - 2) {
      const p3 = reversedPoints[i + 2];
      const bearing1 = calculateBearing(p1.latitude, p1.longitude, p2.latitude, p2.longitude);
      const bearing2 = calculateBearing(p2.latitude, p2.longitude, p3.latitude, p3.longitude);
      const turnAngle = getRelativeAngle(bearing1, bearing2);

      // Only treat significant directional changes as distinct turns (threshold: 30 degrees)
      if (Math.abs(turnAngle) >= 30) {
        let type: TurnInstruction['type'] = 'straight';
        let directionLabel = '';

        if (turnAngle > 60) {
          type = 'sharp_right';
          directionLabel = 'Sharp right turn';
        } else if (turnAngle > 28) {
          type = 'slight_right';
          directionLabel = 'Bear right';
        } else if (turnAngle < -60) {
          type = 'sharp_left';
          directionLabel = 'Sharp left turn';
        } else if (turnAngle < -28) {
          type = 'slight_left';
          directionLabel = 'Bear left';
        }

        instructions.push({
          type,
          text: directionLabel,
          distanceToTurnMeters: Math.round(accumulatedDist),
          targetPointIndex: i + 1,
        });
      }
    }
  }

  // Final destination
  instructions.push({
    type: 'arrive',
    text: 'Original Starting Point',
    distanceToTurnMeters: Math.round(accumulatedDist),
    targetPointIndex: reversedPoints.length - 1,
  });

  return instructions;
}

/**
 * Matches the user's current live location to the nearest appropriate segment on the reversed route.
 * Employs a search window around current progress index (hysteresis) to prevent jumping
 * when paths self-intersect or loop.
 */
export function matchLocationToReversedRoute(
  liveLat: number,
  liveLon: number,
  reversedPoints: RoutePoint[],
  lastKnownIndex: number = 0,
  offRouteThresholdMeters: number = 25
): {
  matchedIndex: number;
  closestPoint: { latitude: number; longitude: number };
  perpendicularDistance: number;
  remainingDistanceMeters: number;
  bearingToNext: number;
  relativeTurnAngle: number;
  isOffRoute: boolean;
  reconnectionBearing: number;
} {
  if (reversedPoints.length === 0) {
    return {
      matchedIndex: 0,
      closestPoint: { latitude: liveLat, longitude: liveLon },
      perpendicularDistance: 0,
      remainingDistanceMeters: 0,
      bearingToNext: 0,
      relativeTurnAngle: 0,
      isOffRoute: false,
      reconnectionBearing: 0,
    };
  }

  if (reversedPoints.length === 1) {
    const target = reversedPoints[0];
    const dist = calculateHaversineDistance(liveLat, liveLon, target.latitude, target.longitude);
    const bearing = calculateBearing(liveLat, liveLon, target.latitude, target.longitude);
    return {
      matchedIndex: 0,
      closestPoint: { latitude: target.latitude, longitude: target.longitude },
      perpendicularDistance: dist,
      remainingDistanceMeters: dist,
      bearingToNext: bearing,
      relativeTurnAngle: 0,
      isOffRoute: dist > offRouteThresholdMeters,
      reconnectionBearing: bearing,
    };
  }

  // Search window around lastKnownIndex to avoid erroneous jumps on looped trails
  const startIndex = Math.max(0, lastKnownIndex - 1);
  const endIndex = Math.min(reversedPoints.length - 2, lastKnownIndex + 5);

  let bestIndex = startIndex;
  let minDistance = Infinity;
  let bestClosestPoint = {
    latitude: reversedPoints[startIndex].latitude,
    longitude: reversedPoints[startIndex].longitude,
  };

  // First check within the forward window
  for (let i = startIndex; i <= endIndex; i++) {
    const a = reversedPoints[i];
    const b = reversedPoints[i + 1];
    const projection = projectPointOntoSegment(
      liveLat,
      liveLon,
      a.latitude,
      a.longitude,
      b.latitude,
      b.longitude
    );

    if (projection.distanceMeters < minDistance) {
      minDistance = projection.distanceMeters;
      bestIndex = i;
      bestClosestPoint = {
        latitude: projection.closestLat,
        longitude: projection.closestLon,
      };
    }
  }

  // If outside threshold, perform global search across all segments
  if (minDistance > offRouteThresholdMeters * 2) {
    for (let i = 0; i < reversedPoints.length - 1; i++) {
      const a = reversedPoints[i];
      const b = reversedPoints[i + 1];
      const projection = projectPointOntoSegment(
        liveLat,
        liveLon,
        a.latitude,
        a.longitude,
        b.latitude,
        b.longitude
      );

      if (projection.distanceMeters < minDistance) {
        minDistance = projection.distanceMeters;
        bestIndex = i;
        bestClosestPoint = {
          latitude: projection.closestLat,
          longitude: projection.closestLon,
        };
      }
    }
  }

  // Next target waypoint along reversed route
  const nextTarget = reversedPoints[Math.min(reversedPoints.length - 1, bestIndex + 1)];
  const bearingToNext = calculateBearing(
    liveLat,
    liveLon,
    nextTarget.latitude,
    nextTarget.longitude
  );

  // Bearing from live location directly to the reconnection target on the path
  const reconnectionBearing = calculateBearing(
    liveLat,
    liveLon,
    bestClosestPoint.latitude,
    bestClosestPoint.longitude
  );

  // Calculate remaining distance along the remaining polyline segments from closest point to P_0
  let remainingDistance = calculateHaversineDistance(
    bestClosestPoint.latitude,
    bestClosestPoint.longitude,
    nextTarget.latitude,
    nextTarget.longitude
  );

  for (let j = bestIndex + 1; j < reversedPoints.length - 1; j++) {
    remainingDistance += calculateHaversineDistance(
      reversedPoints[j].latitude,
      reversedPoints[j].longitude,
      reversedPoints[j + 1].latitude,
      reversedPoints[j + 1].longitude
    );
  }

  return {
    matchedIndex: bestIndex,
    closestPoint: bestClosestPoint,
    perpendicularDistance: Math.round(minDistance),
    remainingDistanceMeters: Math.round(remainingDistance),
    bearingToNext: Math.round(bearingToNext),
    relativeTurnAngle: 0,
    isOffRoute: minDistance > offRouteThresholdMeters,
    reconnectionBearing: Math.round(reconnectionBearing),
  };
}

/**
 * Formats distance with unit consideration.
 */
export function formatDistance(meters: number, unit: 'metric' | 'imperial' = 'metric'): string {
  if (unit === 'imperial') {
    const feet = meters * 3.28084;
    if (feet < 1000) {
      return `${Math.round(feet)} ft`;
    }
    const miles = feet / 5280;
    return `${miles.toFixed(2)} mi`;
  }

  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }
  return `${(meters / 1000).toFixed(2)} km`;
}

/**
 * Formats duration in seconds into HH:MM:SS or MM:SS.
 */
export function formatDuration(totalSeconds: number): string {
  const hrs = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = Math.floor(totalSeconds % 60);

  const pad = (n: number) => n.toString().padStart(2, '0');

  if (hrs > 0) {
    return `${hrs}:${pad(mins)}:${pad(secs)}`;
  }
  return `${pad(mins)}:${pad(secs)}`;
}

/**
 * Formats speed in km/h or mph.
 */
export function formatSpeed(mps: number | null, unit: 'metric' | 'imperial' = 'metric'): string {
  if (mps === null || mps <= 0.2) return '0.0';
  if (unit === 'imperial') {
    const mph = mps * 2.23694;
    return mph.toFixed(1);
  }
  const kmh = mps * 3.6;
  return kmh.toFixed(1);
}
