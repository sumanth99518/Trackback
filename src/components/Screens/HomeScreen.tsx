import React from 'react';
import { Journey, LiveLocation, AppSettings } from '../../types';
import { formatDistance, formatDuration } from '../../services/geoUtils';
import { Play, RotateCcw, ChevronRight, Activity, Compass } from 'lucide-react';

interface HomeScreenProps {
  activeJourney: Journey | null;
  currentLocation: LiveLocation | null;
  gpsStatus: 'acquiring' | 'locked' | 'poor_signal' | 'denied' | 'simulated';
  recentJourneys: Journey[];
  savedRegionsCount: number;
  settings: AppSettings;
  onStartTracking: () => void;
  onResumeTracking: () => void;
  onTrackBackJourney: (journey: Journey) => void;
  onNavigateTab: (tab: string) => void;
  onToggleSimulate: () => void;
  isSimulating: boolean;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  activeJourney,
  currentLocation,
  gpsStatus,
  recentJourneys,
  savedRegionsCount,
  settings,
  onStartTracking,
  onResumeTracking,
  onTrackBackJourney,
  onNavigateTab,
  onToggleSimulate,
  isSimulating,
}) => {
  return (
    <div className="max-w-2xl mx-auto space-y-8 pb-20 md:pb-8 pt-2">
      {/* Active Recording State or Main Action Trigger */}
      {activeJourney ? (
        <section className="rounded-2xl bg-slate-900 border border-sky-500/30 p-6 space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-medium text-sky-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>{activeJourney.status === 'paused' ? 'Tracking Paused' : 'Tracking in Progress'}</span>
            </div>
            <span className="text-xs text-slate-500 font-mono tabular-nums">
              {formatDuration(activeJourney.durationSeconds)}
            </span>
          </div>

          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">{activeJourney.name}</h1>
            <div className="flex items-center gap-3 text-sm text-slate-400 mt-1 tabular-nums">
              <span>{formatDistance(activeJourney.totalDistanceMeters, settings.unit)}</span>
              <span>·</span>
              <span>Started {new Date(activeJourney.startedAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-1">
            <button
              onClick={onResumeTracking}
              className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-750 text-white font-semibold text-sm border border-slate-700 transition active:scale-[0.98]"
            >
              <Activity className="w-4 h-4 text-sky-400" />
              <span>View Map</span>
            </button>
            <button
              onClick={() => onNavigateTab('return')}
              className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-sm transition active:scale-[0.98]"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Track Back</span>
            </button>
          </div>
        </section>
      ) : (
        /* Minimalist Primary Hero */
        <section className="text-center space-y-6 pt-4 sm:pt-8">
          <div className="space-y-2">
            <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              Find your way back.
            </h1>
            <p className="text-sm text-slate-400 max-w-md mx-auto leading-relaxed">
              Record your geographical path offline. Retrace your steps in reverse anytime.
            </p>
          </div>

          {/* Large tactile Start Tracking CTA */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={onStartTracking}
              className="flex items-center justify-center gap-3 w-full sm:w-64 py-4 rounded-2xl bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-bold text-base transition shadow-lg shadow-emerald-500/10 active:scale-[0.98]"
            >
              <Play className="w-5 h-5 fill-current" />
              <span>Start Tracking</span>
            </button>

            {/* Field test simulator toggle button */}
            <button
              onClick={onToggleSimulate}
              className={`flex items-center justify-center gap-2 w-full sm:w-auto px-4 py-4 rounded-2xl border text-xs font-medium transition active:scale-[0.98] ${
                isSimulating
                  ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              <Compass className="w-4 h-4" />
              <span>{isSimulating ? 'Simulating Walk' : 'Field Test Mode'}</span>
            </button>
          </div>
        </section>
      )}

      {/* Minimal GPS Status Instrument Bar */}
      <section className="rounded-2xl bg-slate-900/60 border border-slate-800/80 px-4 py-3 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <span
            className={`w-2 h-2 rounded-full ${
              gpsStatus === 'locked' || gpsStatus === 'simulated'
                ? 'bg-emerald-400'
                : gpsStatus === 'poor_signal'
                ? 'bg-amber-400'
                : 'bg-rose-500'
            }`}
          ></span>
          <span className="font-medium text-slate-300">
            {gpsStatus === 'locked' ? 'GPS Active' : gpsStatus === 'simulated' ? 'GPS Simulated' : 'Acquiring Fix'}
          </span>
          {currentLocation && (
            <span className="text-slate-500 font-mono tabular-nums">
              ±{Math.round(currentLocation.accuracyMeters)}m
            </span>
          )}
        </div>

        <div className="text-slate-500 font-mono tabular-nums text-[11px] truncate max-w-[180px]">
          {currentLocation
            ? `${currentLocation.latitude.toFixed(4)}°, ${currentLocation.longitude.toFixed(4)}°`
            : 'No Coordinates'}
        </div>
      </section>

      {/* Recent Journeys Section (Clean List) */}
      <section className="space-y-3 pt-2">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Recent Trails
          </span>
          {recentJourneys.length > 0 && (
            <button
              onClick={() => onNavigateTab('journeys')}
              className="text-xs text-sky-400 hover:text-sky-300 transition"
            >
              All Journeys →
            </button>
          )}
        </div>

        {recentJourneys.length === 0 ? (
          <div className="p-8 rounded-2xl bg-slate-900/30 border border-slate-800/60 text-center text-xs text-slate-500">
            No saved trails yet. Tap Start Tracking to begin recording your path.
          </div>
        ) : (
          <div className="divide-y divide-slate-800/80 rounded-2xl bg-slate-900/60 border border-slate-800/80 overflow-hidden">
            {recentJourneys.slice(0, 3).map((j) => (
              <div
                key={j.id}
                className="p-4 flex items-center justify-between gap-4 hover:bg-slate-850/50 transition"
              >
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-white truncate">{j.name}</h3>
                  <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5 tabular-nums">
                    <span>{new Date(j.startedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                    <span>·</span>
                    <span>{formatDistance(j.totalDistanceMeters, settings.unit)}</span>
                    <span>·</span>
                    <span>{formatDuration(j.durationSeconds)}</span>
                  </div>
                </div>

                <button
                  onClick={() => onTrackBackJourney(j)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-400/10 hover:bg-amber-400/20 text-amber-300 border border-amber-400/20 text-xs font-medium transition active:scale-95 shrink-0"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Retrace</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Minimal Offline Map Status */}
      <section className="flex items-center justify-between px-4 py-3 rounded-2xl bg-slate-900/30 border border-slate-800/60 text-xs text-slate-400">
        <span>Offline Maps: {savedRegionsCount} region{savedRegionsCount === 1 ? '' : 's'} stored</span>
        <button
          onClick={() => onNavigateTab('maps')}
          className="text-sky-400 hover:text-sky-300 font-medium transition"
        >
          Manage Maps →
        </button>
      </section>
    </div>
  );
};
