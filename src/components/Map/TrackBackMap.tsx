import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { RoutePoint, LiveLocation, NavigationState } from '../../types';
import { OfflineTileLayer } from '../../services/tileDownloader';
import { LocateFixed, ZoomIn, ZoomOut, Maximize2, ShieldAlert } from 'lucide-react';

interface TrackBackMapProps {
  currentLocation: LiveLocation | null;
  recordedPoints: RoutePoint[];
  reversedPoints?: RoutePoint[];
  navigationState?: NavigationState | null;
  isReturnMode?: boolean;
  className?: string;
  onRecenter?: () => void;
}

export const TrackBackMap: React.FC<TrackBackMapProps> = ({
  currentLocation,
  recordedPoints,
  reversedPoints,
  navigationState,
  isReturnMode = false,
  className = '',
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  // Layer references
  const tileLayerRef = useRef<OfflineTileLayer | null>(null);
  const recordedPathPolylineRef = useRef<L.Polyline | null>(null);
  const returnPathPolylineRef = useRef<L.Polyline | null>(null);
  const reconnectionLineRef = useRef<L.Polyline | null>(null);
  const startMarkerRef = useRef<L.Marker | null>(null);
  const currentMarkerRef = useRef<L.Marker | null>(null);
  const reconnectionMarkerRef = useRef<L.Marker | null>(null);

  const [isFollowingUser, setIsFollowingUser] = useState<boolean>(true);
  const [offlineNotice, setOfflineNotice] = useState<boolean>(false);

  // --- INITIALIZE MAP ---
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    // Default center (falls back to Yosemite Trailhead if no location yet)
    const initialLat = currentLocation?.latitude || (recordedPoints[0]?.latitude ?? 37.7456);
    const initialLon = currentLocation?.longitude || (recordedPoints[0]?.longitude ?? -119.5936);

    const map = L.map(mapContainerRef.current, {
      center: [initialLat, initialLon],
      zoom: 16,
      zoomControl: false,
      attributionControl: true,
    });

    // Offline & cached tile layer
    const tileLayer = new OfflineTileLayer(
      'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors',
        className: 'dark-map-tiles',
      }
    );

    tileLayer.addTo(map);
    tileLayerRef.current = tileLayer;

    // Check if network is offline to show non-intrusive indicator
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setOfflineNotice(true);
    }

    const handleOffline = () => setOfflineNotice(true);
    const handleOnline = () => setOfflineNotice(false);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);

    // Disable auto-follow when user manually drags or pans the map
    map.on('dragstart', () => {
      setIsFollowingUser(false);
    });

    mapInstanceRef.current = map;

    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // --- UPDATE START POINT MARKER ---
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const startPt = recordedPoints[0] || (reversedPoints && reversedPoints[reversedPoints.length - 1]);

    if (startPt) {
      const latlng: L.LatLngTuple = [startPt.latitude, startPt.longitude];

      const startIcon = L.divIcon({
        className: 'custom-start-marker',
        html: `
          <div class="relative flex items-center justify-center">
            <div class="w-8 h-8 rounded-full bg-emerald-500 border-2 border-white shadow-lg flex items-center justify-center text-white">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9"/>
              </svg>
            </div>
            <div class="absolute -bottom-5 whitespace-nowrap bg-emerald-950/90 text-emerald-300 font-semibold text-[10px] px-1.5 py-0.5 rounded border border-emerald-500/30">
              START
            </div>
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      if (!startMarkerRef.current) {
        startMarkerRef.current = L.marker(latlng, { icon: startIcon, zIndexOffset: 800 }).addTo(map);
      } else {
        startMarkerRef.current.setLatLng(latlng);
      }
    } else if (startMarkerRef.current) {
      startMarkerRef.current.remove();
      startMarkerRef.current = null;
    }
  }, [recordedPoints, reversedPoints]);

  // --- UPDATE RECORDED PATH POLYLINE ---
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (recordedPoints.length > 1) {
      const latlngs: L.LatLngTuple[] = recordedPoints.map((p) => [p.latitude, p.longitude]);

      if (!recordedPathPolylineRef.current) {
        // High-contrast glowing trail
        recordedPathPolylineRef.current = L.polyline(latlngs, {
          color: isReturnMode ? '#334155' : '#0284c7', // Slate if in return mode, bright Sky Blue during tracking
          weight: isReturnMode ? 4 : 5,
          opacity: isReturnMode ? 0.6 : 0.95,
          lineCap: 'round',
          lineJoin: 'round',
        }).addTo(map);
      } else {
        recordedPathPolylineRef.current.setLatLngs(latlngs);
        recordedPathPolylineRef.current.setStyle({
          color: isReturnMode ? '#334155' : '#0284c7',
          weight: isReturnMode ? 4 : 5,
          opacity: isReturnMode ? 0.6 : 0.95,
        });
      }
    } else if (recordedPathPolylineRef.current) {
      recordedPathPolylineRef.current.remove();
      recordedPathPolylineRef.current = null;
    }
  }, [recordedPoints, isReturnMode]);

  // --- UPDATE RETURN PATH HIGHLIGHT (TRACK BACK MODE) ---
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (isReturnMode && reversedPoints && reversedPoints.length > 1) {
      const latlngs: L.LatLngTuple[] = reversedPoints.map((p) => [p.latitude, p.longitude]);

      if (!returnPathPolylineRef.current) {
        returnPathPolylineRef.current = L.polyline(latlngs, {
          color: '#f59e0b', // Glowing Amber return path
          weight: 6,
          opacity: 0.95,
          dashArray: undefined,
          lineCap: 'round',
          lineJoin: 'round',
        }).addTo(map);
      } else {
        returnPathPolylineRef.current.setLatLngs(latlngs);
      }
    } else if (returnPathPolylineRef.current) {
      returnPathPolylineRef.current.remove();
      returnPathPolylineRef.current = null;
    }
  }, [isReturnMode, reversedPoints]);

  // --- UPDATE OFF-ROUTE RECONNECTION VECTOR ---
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (
      isReturnMode &&
      navigationState?.isOffRoute &&
      navigationState.reconnectionTargetPoint &&
      currentLocation
    ) {
      const lineCoords: L.LatLngTuple[] = [
        [currentLocation.latitude, currentLocation.longitude],
        [navigationState.reconnectionTargetPoint.latitude, navigationState.reconnectionTargetPoint.longitude],
      ];

      // Dashed alert reconnection vector
      if (!reconnectionLineRef.current) {
        reconnectionLineRef.current = L.polyline(lineCoords, {
          color: '#ef4444',
          weight: 3,
          dashArray: '6, 6',
          opacity: 0.9,
        }).addTo(map);
      } else {
        reconnectionLineRef.current.setLatLngs(lineCoords);
      }

      // Reconnection target dot
      const targetLatLng: L.LatLngTuple = [
        navigationState.reconnectionTargetPoint.latitude,
        navigationState.reconnectionTargetPoint.longitude,
      ];

      const targetIcon = L.divIcon({
        className: 'reconnection-target-icon',
        html: `
          <div class="w-4 h-4 rounded-full bg-amber-400 border-2 border-white shadow-md animate-pulse"></div>
        `,
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      });

      if (!reconnectionMarkerRef.current) {
        reconnectionMarkerRef.current = L.marker(targetLatLng, { icon: targetIcon }).addTo(map);
      } else {
        reconnectionMarkerRef.current.setLatLng(targetLatLng);
      }
    } else {
      if (reconnectionLineRef.current) {
        reconnectionLineRef.current.remove();
        reconnectionLineRef.current = null;
      }
      if (reconnectionMarkerRef.current) {
        reconnectionMarkerRef.current.remove();
        reconnectionMarkerRef.current = null;
      }
    }
  }, [isReturnMode, navigationState, currentLocation]);

  // --- UPDATE CURRENT LOCATION MARKER & CAMERA ---
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !currentLocation) return;

    const latlng: L.LatLngTuple = [currentLocation.latitude, currentLocation.longitude];
    const heading = currentLocation.heading !== null ? currentLocation.heading : 0;

    const currentIcon = L.divIcon({
      className: 'custom-current-marker',
      html: `
        <div class="relative flex items-center justify-center">
          <!-- Pulse radar ring -->
          <div class="absolute w-10 h-10 rounded-full bg-sky-400/30 gps-radar-ring pointer-events-none"></div>
          <!-- Heading direction cone -->
          <div class="absolute w-8 h-8 pointer-events-none" style="transform: rotate(${heading}deg);">
            <div class="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-b-[14px] border-b-sky-400 mx-auto -mt-3 drop-shadow"></div>
          </div>
          <!-- Core dot -->
          <div class="relative z-10 w-4 h-4 rounded-full bg-sky-500 border-2 border-white shadow-md"></div>
        </div>
      `,
      iconSize: [40, 40],
      iconAnchor: [20, 20],
    });

    if (!currentMarkerRef.current) {
      currentMarkerRef.current = L.marker(latlng, { icon: currentIcon, zIndexOffset: 1000 }).addTo(map);
    } else {
      currentMarkerRef.current.setLatLng(latlng);
      currentMarkerRef.current.setIcon(currentIcon);
    }

    if (isFollowingUser) {
      map.panTo(latlng, { animate: true, duration: 0.6 });
    }
  }, [currentLocation, isFollowingUser]);

  // --- RECENTER HANDLER ---
  const handleRecenter = () => {
    setIsFollowingUser(true);
    const map = mapInstanceRef.current;
    if (!map) return;

    if (currentLocation) {
      map.setView([currentLocation.latitude, currentLocation.longitude], 17, { animate: true });
    } else if (recordedPoints.length > 0) {
      const last = recordedPoints[recordedPoints.length - 1];
      map.setView([last.latitude, last.longitude], 17, { animate: true });
    }
  };

  // --- FIT WHOLE ROUTE BOUNDS ---
  const handleFitRoute = () => {
    setIsFollowingUser(false);
    const map = mapInstanceRef.current;
    if (!map) return;

    const points = recordedPoints.length > 0 ? recordedPoints : (reversedPoints || []);
    if (points.length > 0) {
      const bounds = L.latLngBounds(points.map((p) => [p.latitude, p.longitude]));
      if (currentLocation) {
        bounds.extend([currentLocation.latitude, currentLocation.longitude]);
      }
      map.fitBounds(bounds, { padding: [40, 40], animate: true });
    }
  };

  return (
    <div className={`relative w-full h-full overflow-hidden bg-[#060b18] ${className}`}>
      {/* Leaflet map DOM element */}
      <div ref={mapContainerRef} className="w-full h-full z-0 offline-grid-canvas" />

      {/* Floating Map Controls Toolbar */}
      <div className="absolute right-3.5 top-20 z-20 flex flex-col gap-2 pointer-events-auto">
        <button
          onClick={handleRecenter}
          aria-label="Recenter on current GPS location"
          className={`w-11 h-11 rounded-xl flex items-center justify-center border shadow-lg transition-all active:scale-95 ${
            isFollowingUser
              ? 'bg-sky-500 text-white border-sky-400 shadow-sky-500/20'
              : 'bg-slate-900/90 text-slate-200 border-slate-700/80 hover:bg-slate-800'
          }`}
        >
          <LocateFixed className="w-5 h-5" />
        </button>

        <button
          onClick={handleFitRoute}
          aria-label="Fit entire route bounds"
          className="w-11 h-11 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-slate-200 border border-slate-700/80 shadow-lg flex items-center justify-center active:scale-95 transition-all"
        >
          <Maximize2 className="w-4 h-4" />
        </button>

        <div className="flex flex-col bg-slate-900/90 border border-slate-700/80 rounded-xl overflow-hidden shadow-lg">
          <button
            onClick={() => mapInstanceRef.current?.zoomIn()}
            aria-label="Zoom In"
            className="w-11 h-10 flex items-center justify-center text-slate-200 hover:bg-slate-800 border-b border-slate-800 active:bg-slate-700 transition"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={() => mapInstanceRef.current?.zoomOut()}
            aria-label="Zoom Out"
            className="w-11 h-10 flex items-center justify-center text-slate-200 hover:bg-slate-800 active:bg-slate-700 transition"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Offline Grid Notice (non-intrusive) */}
      {offlineNotice && (
        <div className="absolute top-3 left-3.5 z-20 flex items-center gap-2 bg-slate-950/85 backdrop-blur-md border border-slate-700 text-slate-300 text-xs px-2.5 py-1.5 rounded-lg shadow-md pointer-events-none">
          <ShieldAlert className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span>Offline mode active · GPS tracking live</span>
        </div>
      )}
    </div>
  );
};
