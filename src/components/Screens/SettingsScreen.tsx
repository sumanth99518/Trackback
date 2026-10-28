import React, { useState } from 'react';
import { AppSettings } from '../../types';
import { db } from '../../services/db';
import { Download, Trash2, Check, Shield } from 'lucide-react';

interface SettingsScreenProps {
  settings: AppSettings;
  onUpdateSettings: (newSettings: AppSettings) => void;
  onDataReset: () => void;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({
  settings,
  onUpdateSettings,
  onDataReset,
}) => {
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);

  const handleSettingChange = async <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    const updated = { ...settings, [key]: value };
    await db.saveSettings(updated);
    onUpdateSettings(updated);
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 1500);
  };

  const handleExportAllData = async () => {
    const journeys = await db.getAllJourneys();
    const allData = [];
    for (const j of journeys) {
      const points = await db.getRoutePointsForJourney(j.id);
      allData.push({ journey: j, points });
    }
    const blob = new Blob([JSON.stringify(allData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `trackback_backup_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-20 md:pb-8 pt-2">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">Settings</h1>
          <p className="text-xs text-slate-500 mt-0.5">Offline preferences and device storage</p>
        </div>

        {savedNotice && (
          <span className="flex items-center gap-1 text-xs text-emerald-400 font-medium">
            <Check className="w-3.5 h-3.5" />
            <span>Saved</span>
          </span>
        )}
      </div>

      {/* Group: Navigation & Units */}
      <div className="space-y-1">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-1">
          Preferences
        </span>
        <div className="divide-y divide-slate-800/80 rounded-2xl bg-slate-900/60 border border-slate-800 overflow-hidden text-xs">
          {/* Units */}
          <div className="p-3.5 flex items-center justify-between">
            <div>
              <span className="font-semibold text-white block">Distance Units</span>
              <span className="text-slate-500">Metric (km/m) or Imperial (mi/ft)</span>
            </div>
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
              <button
                onClick={() => handleSettingChange('unit', 'metric')}
                className={`px-2.5 py-1 rounded text-xs font-medium transition ${
                  settings.unit === 'metric' ? 'bg-slate-800 text-white font-bold' : 'text-slate-400'
                }`}
              >
                Metric
              </button>
              <button
                onClick={() => handleSettingChange('unit', 'imperial')}
                className={`px-2.5 py-1 rounded text-xs font-medium transition ${
                  settings.unit === 'imperial' ? 'bg-slate-800 text-white font-bold' : 'text-slate-400'
                }`}
              >
                Imperial
              </button>
            </div>
          </div>

          {/* GPS Recording Mode */}
          <div className="p-3.5 flex items-center justify-between gap-4">
            <div>
              <span className="font-semibold text-white block">GPS Recording Rate</span>
              <span className="text-slate-500">Sampling frequency and battery balance</span>
            </div>
            <select
              value={settings.recordingFrequency}
              onChange={(e) => handleSettingChange('recordingFrequency', e.target.value as AppSettings['recordingFrequency'])}
              className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none"
            >
              <option value="high">High Accuracy (3m / 3s)</option>
              <option value="balanced">Balanced (10m / 5s)</option>
              <option value="battery_saver">Battery Saver (25m / 15s)</option>
            </select>
          </div>

          {/* Off-Route Alert */}
          <div className="p-3.5 flex items-center justify-between gap-4">
            <div>
              <span className="font-semibold text-white block">Off-Route Tolerance</span>
              <span className="text-slate-500">Trigger warning when straying from trail</span>
            </div>
            <select
              value={settings.offRouteThresholdMeters}
              onChange={(e) => handleSettingChange('offRouteThresholdMeters', parseInt(e.target.value, 10))}
              className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none"
            >
              <option value={15}>15 metres</option>
              <option value={25}>25 metres (Default)</option>
              <option value={40}>40 metres</option>
            </select>
          </div>

          {/* Arrival Tolerance */}
          <div className="p-3.5 flex items-center justify-between gap-4">
            <div>
              <span className="font-semibold text-white block">Arrival Radius</span>
              <span className="text-slate-500">Distance to starting point for completion</span>
            </div>
            <select
              value={settings.arrivalRadiusMeters}
              onChange={(e) => handleSettingChange('arrivalRadiusMeters', parseInt(e.target.value, 10))}
              className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none"
            >
              <option value={10}>10 metres</option>
              <option value={15}>15 metres (Default)</option>
              <option value={25}>25 metres</option>
            </select>
          </div>
        </div>
      </div>

      {/* Group: Cues & Screen */}
      <div className="space-y-1">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-1">
          Feedback & Screen
        </span>
        <div className="divide-y divide-slate-800/80 rounded-2xl bg-slate-900/60 border border-slate-800 overflow-hidden text-xs">
          <div className="p-3.5 flex items-center justify-between">
            <div>
              <span className="font-semibold text-white block">Audio Alerts</span>
              <span className="text-slate-500">Synthesized tone on off-route drift</span>
            </div>
            <button
              onClick={() => handleSettingChange('soundAlerts', !settings.soundAlerts)}
              className={`w-10 h-6 rounded-full transition-colors p-0.5 ${settings.soundAlerts ? 'bg-sky-500' : 'bg-slate-800'}`}
            >
              <div className={`w-5 h-5 rounded-full bg-white transition-transform ${settings.soundAlerts ? 'translate-x-4' : ''}`}></div>
            </button>
          </div>

          <div className="p-3.5 flex items-center justify-between">
            <div>
              <span className="font-semibold text-white block">Haptic Vibrations</span>
              <span className="text-slate-500">Vibration feedback on turns and arrival</span>
            </div>
            <button
              onClick={() => handleSettingChange('hapticAlerts', !settings.hapticAlerts)}
              className={`w-10 h-6 rounded-full transition-colors p-0.5 ${settings.hapticAlerts ? 'bg-sky-500' : 'bg-slate-800'}`}
            >
              <div className={`w-5 h-5 rounded-full bg-white transition-transform ${settings.hapticAlerts ? 'translate-x-4' : ''}`}></div>
            </button>
          </div>

          <div className="p-3.5 flex items-center justify-between">
            <div>
              <span className="font-semibold text-white block">Keep Screen Awake</span>
              <span className="text-slate-500">Maintain display on during active tracking</span>
            </div>
            <button
              onClick={() => handleSettingChange('keepScreenAwake', !settings.keepScreenAwake)}
              className={`w-10 h-6 rounded-full transition-colors p-0.5 ${settings.keepScreenAwake ? 'bg-sky-500' : 'bg-slate-800'}`}
            >
              <div className={`w-5 h-5 rounded-full bg-white transition-transform ${settings.keepScreenAwake ? 'translate-x-4' : ''}`}></div>
            </button>
          </div>
        </div>
      </div>

      {/* Group: Data & Privacy */}
      <div className="space-y-1">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-1">
          Data & Privacy
        </span>
        <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 text-xs space-y-3">
          <p className="text-slate-400 leading-relaxed">
            All coordinates, timestamps, and route history are stored exclusively in your browser's IndexedDB. No accounts, telemetry, or third-party servers.
          </p>

          <div className="flex items-center gap-3 pt-1">
            <button
              onClick={handleExportAllData}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 text-xs font-medium transition"
            >
              <Download className="w-3.5 h-3.5 text-sky-400" />
              <span>Export All Trails (JSON)</span>
            </button>

            <button
              onClick={() => setShowResetConfirm(true)}
              className="flex items-center gap-1 text-slate-500 hover:text-rose-400 text-xs font-medium transition"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Reset Data</span>
            </button>
          </div>
        </div>
      </div>

      {/* Reset Confirmation Dialog */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-2xl text-slate-100 space-y-4">
            <h3 className="text-base font-bold text-white">Reset All Application Data?</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              This will erase all recorded journeys, cached map tiles, and settings.
            </p>
            <div className="flex items-center gap-3 pt-1">
              <button
                onClick={() => setShowResetConfirm(false)}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowResetConfirm(false);
                  onDataReset();
                }}
                className="flex-1 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-400 text-white text-xs font-bold transition"
              >
                Reset
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
