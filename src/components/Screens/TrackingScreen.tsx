import React, { useState } from 'react';
import { Journey, RoutePoint, LiveLocation, AppSettings } from '../../types';
import { TrackBackMap } from '../Map/TrackBackMap';
import { formatDistance, formatDuration, formatSpeed } from '../../services/geoUtils';
import { trackingService } from '../../services/trackingService';
import { Pause, Play, Check, RotateCcw, AlertTriangle, Compass } from 'lucide-react';

interface TrackingScreenProps {
  journey: Journey | null;
  recordedPoints: RoutePoint[];
  currentLocation: LiveLocation | null;
  gpsStatus: 'acquiring' | 'locked' | 'poor_signal' | 'denied' | 'simulated';
  settings: AppSettings;
  onPause: () => void;
  onResume: () => void;
  onFinish: () => void;
  onTrackBack: () => void;
  onStartTracking: () => void;
}

export const TrackingScreen: React.FC<TrackingScreenProps> = ({
  journey,
  recordedPoints,
  currentLocation,
  gpsStatus,
  settings,
  onPause,
  onResume,
  onFinish,
  onTrackBack,
  onStartTracking,
}) => {
  const [showFinishConfirm, setShowFinishConfirm] = useState(false);
  const [showSimControls, setShowSimControls] = useState(false);

  const isRecording = journey?.status === 'recording';

  return (
    <div className="relative w-full h-[calc(100vh-4rem-4rem)] md:h-[calc(100vh-4.5rem)] overflow-hidden bg-[#060b18]">
      {/* Full-screen Leaflet Map */}
      <TrackBackMap
        currentLocation={currentLocation}
        recordedPoints={recordedPoints}
        isReturnMode={false}
        className="w-full h-full"
      />

      {/* Floating Top Telemetry HUD (Minimalist Strip) */}
      <div className="absolute top-3 left-3 right-3 md:left-6 md:right-auto z-20 pointer-events-auto">
        <div className="flex items-center gap-4 px-4 py-2.5 rounded-2xl bg-[#090e1d]/90 backdrop-blur-md border border-slate-800 text-white shadow-xl">
          <div className="flex items-baseline gap-1.5 tabular-nums">
            <span className="text-xs text-slate-400">DIST</span>
            <span className="text-base font-bold text-white">
              {journey ? formatDistance(journey.totalDistanceMeters, settings.unit) : '0 m'}
            </span>
          </div>

          <div className="h-4 w-px bg-slate-800"></div>

          <div className="flex items-baseline gap-1.5 tabular-nums">
            <span className="text-xs text-slate-400">TIME</span>
            <span className="text-base font-bold text-sky-400">
              {journey ? formatDuration(journey.durationSeconds) : '00:00'}
            </span>
          </div>

          <div className="hidden sm:flex h-4 w-px bg-slate-800"></div>

          <div className="hidden sm:flex items-baseline gap-1.5 tabular-nums">
            <span className="text-xs text-slate-400">SPEED</span>
            <span className="text-sm font-semibold text-slate-200">
              {formatSpeed(currentLocation?.speedMetersPerSecond ?? null, settings.unit)} {settings.unit === 'imperial' ? 'mph' : 'km/h'}
            </span>
          </div>

          <div className="h-4 w-px bg-slate-800"></div>

          {/* Minimalist GPS Status */}
          <div className="flex items-center gap-1.5 text-xs">
            <span
              className={`w-2 h-2 rounded-full ${
                gpsStatus === 'locked' || gpsStatus === 'simulated'
                  ? 'bg-emerald-400'
                  : gpsStatus === 'poor_signal'
                  ? 'bg-amber-400'
                  : 'bg-rose-500'
              }`}
            ></span>
            <span className="text-[11px] font-mono text-slate-400 tabular-nums">
              {currentLocation ? `±${Math.round(currentLocation.accuracyMeters)}m` : 'Wait'}
            </span>
          </div>

          {/* Quiet simulator helper trigger */}
          <button
            onClick={() => setShowSimControls(!showSimControls)}
            className="p-1 rounded text-slate-400 hover:text-white transition"
            title="Field Simulation Controls"
          >
            <Compass className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Simulator helper drawer if activated */}
      {showSimControls && (
        <div className="absolute top-16 left-3 z-30 p-3 rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl text-xs space-y-2 max-w-xs">
          <div className="flex items-center justify-between text-slate-300 font-semibold">
            <span>Field Test Helper</span>
            <button onClick={() => setShowSimControls(false)} className="text-slate-400 hover:text-white">✕</button>
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            <button
              onClick={() => trackingService.simulateOffRouteExcursion(40)}
              className="px-2.5 py-1.5 rounded-lg bg-amber-500/20 text-amber-300 text-[11px] font-medium"
            >
              Walk 40m Off-Route
            </button>
            <button
              onClick={() => trackingService.toggleSimulationMode()}
              className="px-2.5 py-1.5 rounded-lg bg-sky-500/20 text-sky-300 text-[11px] font-medium"
            >
              Toggle Step Loop
            </button>
          </div>
        </div>
      )}

      {/* Poor GPS Alert Warning */}
      {gpsStatus === 'poor_signal' && (
        <div className="absolute top-16 left-3 right-3 md:left-6 md:right-auto z-20 max-w-md flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-500/90 text-slate-950 text-xs font-semibold shadow-md">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-slate-950" />
          <span>Low accuracy GPS fix (±{currentLocation?.accuracyMeters ? Math.round(currentLocation.accuracyMeters) : 40}m)</span>
        </div>
      )}

      {/* Inactive Journey State */}
      {!journey && (
        <div className="absolute inset-0 z-30 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
          <div className="w-full max-w-xs rounded-2xl bg-slate-900 border border-slate-800 p-6 text-center space-y-4">
            <h3 className="text-base font-bold text-white">No Active Recording</h3>
            <p className="text-xs text-slate-400">
              Start tracking to log your exact path on device.
            </p>
            <button
              onClick={onStartTracking}
              className="w-full py-3 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-bold text-xs transition active:scale-95"
            >
              Start Recording
            </button>
          </div>
        </div>
      )}

      {/* Floating Bottom Control Bar */}
      {journey && (
        <div className="absolute bottom-4 left-3 right-3 md:left-auto md:right-6 md:max-w-sm z-20 pointer-events-auto">
          <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-[#090e1d]/90 backdrop-blur-md border border-slate-800 shadow-xl">
            {/* Pause / Resume Button */}
            {isRecording ? (
              <button
                onClick={onPause}
                className="flex items-center justify-center gap-1.5 flex-1 min-h-[44px] py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 text-xs font-medium transition active:scale-95"
              >
                <Pause className="w-4 h-4" />
                <span>Pause</span>
              </button>
            ) : (
              <button
                onClick={onResume}
                className="flex items-center justify-center gap-1.5 flex-1 min-h-[44px] py-2 px-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition active:scale-95"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>Resume</span>
              </button>
            )}

            {/* Track Back Primary Action */}
            <button
              onClick={onTrackBack}
              disabled={recordedPoints.length < 2}
              className="flex items-center justify-center gap-1.5 flex-1 min-h-[44px] py-2 px-3 rounded-xl bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-slate-950 text-xs font-bold transition active:scale-95 whitespace-nowrap"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Track Back</span>
            </button>

            {/* Finish & Save Button */}
            <button
              onClick={() => setShowFinishConfirm(true)}
              className="flex items-center justify-center gap-1 min-h-[44px] py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 text-xs font-medium transition active:scale-95"
              title="Finish journey"
            >
              <Check className="w-4 h-4" />
              <span>Finish</span>
            </button>
          </div>
        </div>
      )}

      {/* Finish Confirmation Dialog */}
      {showFinishConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-2xl text-slate-100 space-y-4">
            <h3 className="text-base font-bold text-white">Save and Finish Journey?</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              This will complete tracking and store your trail locally in My Journeys.
            </p>
            <div className="flex items-center gap-3 pt-1">
              <button
                onClick={() => setShowFinishConfirm(false)}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowFinishConfirm(false);
                  onFinish();
                }}
                className="flex-1 py-2.5 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-slate-950 text-xs font-bold transition"
              >
                Save Trail
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
