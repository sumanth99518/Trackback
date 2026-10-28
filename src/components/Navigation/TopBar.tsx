import React from 'react';
import { Compass, WifiOff } from 'lucide-react';
import { PWAInstallButton } from '../Common/PWAInstallButton';

interface TopBarProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  isOnline: boolean;
  gpsStatus: 'acquiring' | 'locked' | 'poor_signal' | 'denied' | 'simulated';
  hasActiveJourney: boolean;
  batteryLevel: number | null;
  onStartTrackingPrompt: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  currentTab,
  onSelectTab,
  isOnline,
  gpsStatus,
  hasActiveJourney,
  onStartTrackingPrompt,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-[#080d1a]/95 backdrop-blur-md border-b border-slate-800/80 px-4 lg:px-8 py-2.5">
      <div className="max-w-6xl mx-auto flex items-center justify-between gap-6">
        {/* Brand */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => onSelectTab('home')}
            className="flex items-center gap-2 text-left focus:outline-none"
          >
            <div className="w-7 h-7 rounded-lg bg-sky-500/10 border border-sky-400/20 flex items-center justify-center text-sky-400">
              <Compass className="w-4 h-4" />
            </div>
            <span className="text-base font-bold text-white tracking-tight">
              TrackBack
            </span>
          </button>

          {!isOnline && (
            <span className="flex items-center gap-1 text-[11px] text-amber-400 font-medium pl-2 border-l border-slate-800">
              <WifiOff className="w-3 h-3" />
              <span>Offline</span>
            </span>
          )}

          <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-slate-400 pl-2 border-l border-slate-800">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                gpsStatus === 'locked' || gpsStatus === 'simulated'
                  ? 'bg-emerald-400'
                  : gpsStatus === 'poor_signal'
                  ? 'bg-amber-400'
                  : 'bg-rose-400'
              }`}
            ></span>
            <span>{gpsStatus === 'locked' ? 'GPS' : gpsStatus === 'simulated' ? 'Sim' : 'No GPS'}</span>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="hidden md:flex items-center gap-5 text-xs font-medium text-slate-400">
          <button
            onClick={() => onSelectTab('home')}
            className={`transition hover:text-white ${currentTab === 'home' ? 'text-sky-400 font-semibold' : ''}`}
          >
            Dashboard
          </button>
          <button
            onClick={() => onSelectTab('tracking')}
            className={`transition hover:text-white ${currentTab === 'tracking' ? 'text-sky-400 font-semibold' : ''}`}
          >
            Live Map
          </button>
          <button
            onClick={() => onSelectTab('return')}
            className={`transition hover:text-white ${currentTab === 'return' ? 'text-amber-400 font-semibold' : ''}`}
          >
            Track Back
          </button>
          <button
            onClick={() => onSelectTab('journeys')}
            className={`transition hover:text-white ${currentTab === 'journeys' ? 'text-sky-400 font-semibold' : ''}`}
          >
            Journeys
          </button>
          <button
            onClick={() => onSelectTab('maps')}
            className={`transition hover:text-white ${currentTab === 'maps' ? 'text-sky-400 font-semibold' : ''}`}
          >
            Offline Maps
          </button>
          <button
            onClick={() => onSelectTab('settings')}
            className={`transition hover:text-white ${currentTab === 'settings' ? 'text-sky-400 font-semibold' : ''}`}
          >
            Settings
          </button>
        </nav>

        {/* Action */}
        <div className="flex items-center gap-2 shrink-0">
          <PWAInstallButton />

          {!hasActiveJourney ? (
            <button
              onClick={onStartTrackingPrompt}
              className="px-3 py-1.5 text-xs font-bold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-lg transition active:scale-95"
            >
              Start
            </button>
          ) : (
            <button
              onClick={() => onSelectTab('return')}
              className="px-3 py-1.5 text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-lg transition active:scale-95"
            >
              Retrace
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
