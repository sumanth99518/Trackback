import React from 'react';
import { Flag, CheckCircle2, RotateCcw, Home } from 'lucide-react';
import { Journey, AppSettings } from '../../types';
import { formatDistance, formatDuration } from '../../services/geoUtils';

interface ArrivalCelebrationModalProps {
  journey: Journey | null;
  retraceDurationSeconds: number;
  settings: AppSettings;
  onDismiss: () => void;
}

export const ArrivalCelebrationModal: React.FC<ArrivalCelebrationModalProps> = ({
  journey,
  retraceDurationSeconds,
  settings,
  onDismiss,
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="w-full max-w-sm rounded-3xl bg-slate-900 border border-emerald-500/40 p-6 shadow-2xl text-center space-y-5">
        {/* Celebration Badge */}
        <div className="w-16 h-16 rounded-3xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/10">
          <Flag className="w-8 h-8" />
        </div>

        <div className="space-y-1.5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">
            Journey Retraced Successfully
          </span>
          <h2 className="text-xl font-bold text-white tracking-tight">
            You're Back at the Start!
          </h2>
          <p className="text-xs text-slate-300 max-w-xs mx-auto leading-relaxed">
            You have safely reached your original starting point by following your exact recorded path in reverse.
          </p>
        </div>

        {/* Retrace Stats */}
        <div className="grid grid-cols-2 gap-3 p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 text-left">
          <div>
            <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Trail Retraced</span>
            <span className="text-sm font-bold text-white tabular-nums">
              {journey ? formatDistance(journey.totalDistanceMeters, settings.unit) : '—'}
            </span>
          </div>

          <div>
            <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Return Time</span>
            <span className="text-sm font-bold text-sky-400 tabular-nums">
              {formatDuration(retraceDurationSeconds)}
            </span>
          </div>
        </div>

        {/* Dismiss Button */}
        <button
          onClick={onDismiss}
          className="w-full py-3 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-bold text-xs transition shadow-lg shadow-emerald-500/20 active:scale-95"
        >
          Return to Dashboard
        </button>
      </div>
    </div>
  );
};
