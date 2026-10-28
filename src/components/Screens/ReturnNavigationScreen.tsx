import React, { useState } from 'react';
import { Journey, RoutePoint, LiveLocation, NavigationState, AppSettings } from '../../types';
import { TrackBackMap } from '../Map/TrackBackMap';
import { formatDistance } from '../../services/geoUtils';
import { navigationEngine } from '../../services/navigationEngine';
import { trackingService } from '../../services/trackingService';
import { 
  ArrowUp, 
  ArrowUpRight, 
  ArrowUpLeft, 
  ArrowRight, 
  ArrowLeft, 
  RotateCcw, 
  Flag, 
  Footprints, 
  Eye, 
  X,
  Play,
  Square,
  AlertTriangle
} from 'lucide-react';

interface ReturnNavigationScreenProps {
  journey: Journey | null;
  recordedPoints: RoutePoint[];
  reversedPoints: RoutePoint[];
  currentLocation: LiveLocation | null;
  navigationState: NavigationState;
  settings: AppSettings;
  onEndNavigation: () => void;
  onSelectTab: (tab: string) => void;
}

export const ReturnNavigationScreen: React.FC<ReturnNavigationScreenProps> = ({
  journey,
  recordedPoints,
  reversedPoints,
  currentLocation,
  navigationState,
  settings,
  onEndNavigation,
}) => {
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [isSimulatingReturn, setIsSimulatingReturn] = useState(false);

  const renderTurnIcon = (type: string) => {
    switch (type) {
      case 'sharp_right':
        return <ArrowRight className="w-6 h-6 text-amber-400" />;
      case 'slight_right':
        return <ArrowUpRight className="w-6 h-6 text-amber-400" />;
      case 'sharp_left':
        return <ArrowLeft className="w-6 h-6 text-amber-400" />;
      case 'slight_left':
        return <ArrowUpLeft className="w-6 h-6 text-amber-400" />;
      case 'u_turn':
        return <RotateCcw className="w-6 h-6 text-amber-400" />;
      case 'arrive':
        return <Flag className="w-6 h-6 text-emerald-400" />;
      default:
        return <ArrowUp className="w-6 h-6 text-amber-400" />;
    }
  };

  const handleToggleSimReturn = () => {
    if (isSimulatingReturn) {
      navigationEngine.stopSimulatedReturn();
      setIsSimulatingReturn(false);
    } else {
      navigationEngine.startSimulatedReturn();
      setIsSimulatingReturn(true);
    }
  };

  return (
    <div className="relative w-full h-[calc(100vh-4rem-4rem)] md:h-[calc(100vh-4.5rem)] overflow-hidden bg-[#060b18]">
      {/* Full-screen Leaflet Map with Return Highlights & Reconnection Vector */}
      <TrackBackMap
        currentLocation={currentLocation}
        recordedPoints={recordedPoints}
        reversedPoints={reversedPoints}
        navigationState={navigationState}
        isReturnMode={true}
        className="w-full h-full"
      />

      {/* Minimalist Top HUD Instruction Card */}
      <div className="absolute top-3 left-3 right-3 md:left-6 md:right-auto md:max-w-md z-20 pointer-events-auto">
        <div className="rounded-2xl bg-[#090e1d]/92 backdrop-blur-md border border-slate-800 p-4 shadow-xl text-white space-y-3">
          {navigationState.isOffRoute ? (
            /* Off-Route Alert */
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between">
                  <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                    Off Trail
                  </span>
                  <span className="text-xs font-mono text-white tabular-nums">
                    {formatDistance(navigationState.offRouteDistanceMeters, settings.unit)} away
                  </span>
                </div>
                <p className="text-xs text-slate-300 mt-0.5">
                  Walk toward bearing <strong className="text-white">{navigationState.reconnectionBearing}°</strong> to rejoin path.
                </p>
              </div>
            </div>
          ) : (
            /* Standard Turn Guidance */
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center shrink-0">
                  {renderTurnIcon(navigationState.currentInstruction.type)}
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider block">
                    {navigationState.currentInstruction.type === 'arrive'
                      ? 'Destination'
                      : `In ${formatDistance(navigationState.distanceToNextTurn, settings.unit)}`}
                  </span>
                  <h2 className="text-sm sm:text-base font-bold text-white truncate">
                    {navigationState.currentInstruction.text}
                  </h2>
                </div>
              </div>

              {/* Bearing Arrow */}
              <div
                className="w-8 h-8 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-amber-400 shrink-0 shadow transition-transform duration-300"
                style={{ transform: `rotate(${navigationState.bearingToNextWaypoint}deg)` }}
                title={`Bearing: ${navigationState.bearingToNextWaypoint}°`}
              >
                <ArrowUp className="w-4 h-4" />
              </div>
            </div>
          )}

          {/* Minimalist Progress & Mode */}
          <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
            <span className="tabular-nums">
              To Start: <strong className="text-white">{formatDistance(navigationState.remainingDistanceMeters, settings.unit)}</strong>
            </span>

            <div className="flex items-center gap-1">
              <button
                onClick={() => navigationEngine.setMode('footsteps')}
                className={`px-2 py-0.5 rounded text-[11px] font-medium transition ${
                  navigationState.mode === 'footsteps'
                    ? 'bg-amber-400 text-slate-950 font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Steps
              </button>
              <button
                onClick={() => navigationEngine.setMode('overview')}
                className={`px-2 py-0.5 rounded text-[11px] font-medium transition ${
                  navigationState.mode === 'overview'
                    ? 'bg-amber-400 text-slate-950 font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Overview
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Floating Bottom Control Bar */}
      <div className="absolute bottom-4 left-3 right-3 md:left-auto md:right-6 md:max-w-xs z-20 pointer-events-auto">
        <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-[#090e1d]/90 backdrop-blur-md border border-slate-800 shadow-xl">
          <button
            onClick={handleToggleSimReturn}
            className={`flex items-center justify-center gap-1.5 flex-1 min-h-[44px] py-2 px-3 rounded-xl border text-xs font-medium transition active:scale-95 ${
              isSimulatingReturn
                ? 'bg-rose-500/20 border-rose-500/30 text-rose-300'
                : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-750'
            }`}
          >
            {isSimulatingReturn ? <Square className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            <span>{isSimulatingReturn ? 'Stop Walk' : 'Simulate'}</span>
          </button>

          <button
            onClick={() => setShowExitConfirm(true)}
            className="flex items-center justify-center gap-1 min-h-[44px] px-4 py-2 rounded-xl bg-slate-800 hover:bg-rose-500/20 text-slate-300 hover:text-rose-400 border border-slate-700 text-xs font-semibold transition active:scale-95"
          >
            <X className="w-4 h-4" />
            <span>Exit</span>
          </button>
        </div>
      </div>

      {/* Exit Confirmation Dialog */}
      {showExitConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-2xl text-slate-100 space-y-4">
            <h3 className="text-base font-bold text-white">End Return Navigation?</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Exit Track Back navigation? Your recorded journey remains safely stored on your device.
            </p>
            <div className="flex items-center gap-3 pt-1">
              <button
                onClick={() => setShowExitConfirm(false)}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition"
              >
                Keep Returning
              </button>
              <button
                onClick={() => {
                  setShowExitConfirm(false);
                  onEndNavigation();
                }}
                className="flex-1 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-400 text-white text-xs font-bold transition"
              >
                Exit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
