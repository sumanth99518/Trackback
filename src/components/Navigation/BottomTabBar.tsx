import React from 'react';
import { Home, Navigation, Undo2, Compass, MapPin } from 'lucide-react';

interface BottomTabBarProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  isTrackingActive: boolean;
  isRetracingActive: boolean;
}

export const BottomTabBar: React.FC<BottomTabBarProps> = ({
  currentTab,
  onSelectTab,
  isTrackingActive,
  isRetracingActive,
}) => {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#080e1e]/95 backdrop-blur-md border-t border-slate-800 pb-[env(safe-area-inset-bottom,0px)]">
      <div className="grid grid-cols-5 items-center h-16 max-w-md mx-auto px-1">
        {/* Tab 1: Home */}
        <button
          onClick={() => onSelectTab('home')}
          className={`flex flex-col items-center justify-center h-full min-h-[44px] transition-colors ${
            currentTab === 'home' ? 'text-sky-400 font-semibold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Home className="w-5 h-5" />
          <span className="text-[10px] tracking-tight mt-1">Home</span>
        </button>

        {/* Tab 2: Live Tracking */}
        <button
          onClick={() => onSelectTab('tracking')}
          className={`relative flex flex-col items-center justify-center h-full min-h-[44px] transition-colors ${
            currentTab === 'tracking' ? 'text-sky-400 font-semibold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <div className="relative">
            <Navigation className="w-5 h-5" />
            {isTrackingActive && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-400 border border-slate-900 animate-ping"></span>
            )}
          </div>
          <span className="text-[10px] tracking-tight mt-1">Track</span>
        </button>

        {/* Tab 3: Track Back (Center Highlighted Return Action) */}
        <button
          onClick={() => onSelectTab('return')}
          className={`flex flex-col items-center justify-center h-full min-h-[44px] transition-colors ${
            currentTab === 'return' ? 'text-amber-400 font-semibold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <div className="relative">
            <div className={`p-1.5 rounded-xl ${isRetracingActive ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20' : ''}`}>
              <Undo2 className="w-5 h-5" />
            </div>
          </div>
          <span className="text-[10px] tracking-tight mt-0.5">Return</span>
        </button>

        {/* Tab 4: My Journeys */}
        <button
          onClick={() => onSelectTab('journeys')}
          className={`flex flex-col items-center justify-center h-full min-h-[44px] transition-colors ${
            currentTab === 'journeys' ? 'text-sky-400 font-semibold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Compass className="w-5 h-5" />
          <span className="text-[10px] tracking-tight mt-1">Journeys</span>
        </button>

        {/* Tab 5: Offline Maps */}
        <button
          onClick={() => onSelectTab('maps')}
          className={`flex flex-col items-center justify-center h-full min-h-[44px] transition-colors ${
            currentTab === 'maps' ? 'text-sky-400 font-semibold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <MapPin className="w-5 h-5" />
          <span className="text-[10px] tracking-tight mt-1">Offline Maps</span>
        </button>
      </div>
    </nav>
  );
};
