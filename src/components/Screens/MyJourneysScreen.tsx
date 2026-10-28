import React, { useState, useEffect } from 'react';
import { Journey, RoutePoint, AppSettings } from '../../types';
import { db } from '../../services/db';
import { formatDistance, formatDuration } from '../../services/geoUtils';
import { 
  RotateCcw, 
  Trash2, 
  Edit3, 
  Download, 
  Upload, 
  Check, 
  X,
  Share2,
  Route
} from 'lucide-react';

interface MyJourneysScreenProps {
  journeys: Journey[];
  settings: AppSettings;
  onRefresh: () => void;
  onTrackBackJourney: (journey: Journey) => void;
  onStartTracking: () => void;
}

export const MyJourneysScreen: React.FC<MyJourneysScreenProps> = ({
  journeys,
  settings,
  onRefresh,
  onTrackBackJourney,
  onStartTracking,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState<string>('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [importNotice, setImportNotice] = useState<string | null>(null);

  const [journeyThumbnails, setJourneyThumbnails] = useState<Record<string, string>>({});

  useEffect(() => {
    const loadThumbnails = async () => {
      const thumbs: Record<string, string> = {};
      for (const j of journeys) {
        const points = await db.getRoutePointsForJourney(j.id);
        if (points.length > 1) {
          thumbs[j.id] = generateSvgPath(points);
        }
      }
      setJourneyThumbnails(thumbs);
    };
    loadThumbnails();
  }, [journeys]);

  const generateSvgPath = (points: RoutePoint[]): string => {
    let minLat = Infinity, maxLat = -Infinity;
    let minLon = Infinity, maxLon = -Infinity;

    points.forEach((p) => {
      if (p.latitude < minLat) minLat = p.latitude;
      if (p.latitude > maxLat) maxLat = p.latitude;
      if (p.longitude < minLon) minLon = p.longitude;
      if (p.longitude > maxLon) maxLon = p.longitude;
    });

    const latSpan = Math.max(0.0001, maxLat - minLat);
    const lonSpan = Math.max(0.0001, maxLon - minLon);

    const width = 100;
    const height = 50;
    const padding = 8;

    const coords = points.map((p) => {
      const x = padding + ((p.longitude - minLon) / lonSpan) * (width - 2 * padding);
      const y = height - (padding + ((p.latitude - minLat) / latSpan) * (height - 2 * padding));
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });

    return `M ${coords.join(' L ')}`;
  };

  const handleStartRename = (j: Journey) => {
    setEditingId(j.id);
    setEditName(j.name);
  };

  const handleSaveRename = async (j: Journey) => {
    if (editName.trim()) {
      j.name = editName.trim();
      await db.saveJourney(j);
      setEditingId(null);
      onRefresh();
    }
  };

  const handleDelete = async (id: string) => {
    await db.deleteJourney(id);
    setDeletingId(null);
    onRefresh();
  };

  const handleExportGPX = async (j: Journey) => {
    try {
      const gpxData = await db.exportToGPX(j.id);
      const blob = new Blob([gpxData], { type: 'application/gpx+xml' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${j.name.replace(/\s+/g, '_')}.gpx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
    }
  };

  const handleExportGeoJSON = async (j: Journey) => {
    try {
      const geoJsonData = await db.exportToGeoJSON(j.id);
      const blob = new Blob([geoJsonData], { type: 'application/geo+json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${j.name.replace(/\s+/g, '_')}.geojson`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
    }
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const imported = await db.importGPX(text, file.name.replace(/\.[^/.]+$/, ''));
        setImportNotice(`Imported "${imported.name}"`);
        setTimeout(() => setImportNotice(null), 3000);
        onRefresh();
      } catch {
        setImportNotice('Failed to import GPX file');
        setTimeout(() => setImportNotice(null), 3000);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-20 md:pb-8 pt-2">
      {/* Minimal Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">Saved Journeys</h1>
          <span className="text-xs text-slate-500 tabular-nums">
            {journeys.length} trail{journeys.length === 1 ? '' : 's'} on device
          </span>
        </div>

        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 text-xs font-medium cursor-pointer transition active:scale-95">
            <Upload className="w-3.5 h-3.5" />
            <span>Import GPX</span>
            <input type="file" accept=".gpx" onChange={handleImportFile} className="hidden" />
          </label>

          <button
            onClick={onStartTracking}
            className="px-3.5 py-1.5 rounded-lg bg-emerald-400 hover:bg-emerald-300 text-slate-950 text-xs font-bold transition active:scale-95"
          >
            Record
          </button>
        </div>
      </div>

      {importNotice && (
        <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-200">
          {importNotice}
        </div>
      )}

      {/* Journeys List */}
      {journeys.length === 0 ? (
        <div className="py-16 text-center space-y-3">
          <Route className="w-8 h-8 text-slate-700 mx-auto" />
          <p className="text-sm text-slate-400">No recorded trails yet</p>
          <button
            onClick={onStartTracking}
            className="px-4 py-2 rounded-xl bg-emerald-400 text-slate-950 text-xs font-bold transition"
          >
            Start Your First Trail
          </button>
        </div>
      ) : (
        <div className="divide-y divide-slate-800/80 rounded-2xl bg-slate-900/60 border border-slate-800 overflow-hidden">
          {journeys.map((j) => (
            <div
              key={j.id}
              className="p-4 flex items-center justify-between gap-4 hover:bg-slate-850/40 transition"
            >
              {/* Left Column: Title & Metadata */}
              <div className="min-w-0 flex-1">
                {editingId === j.id ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="bg-slate-950 border border-sky-400/50 rounded-lg px-2 py-1 text-sm text-white focus:outline-none"
                      autoFocus
                    />
                    <button onClick={() => handleSaveRename(j)} className="text-emerald-400">
                      <Check className="w-4 h-4" />
                    </button>
                    <button onClick={() => setEditingId(null)} className="text-slate-400">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-white truncate">{j.name}</h3>
                    <button
                      onClick={() => handleStartRename(j)}
                      className="text-slate-600 hover:text-slate-400"
                      title="Rename"
                    >
                      <Edit3 className="w-3 h-3" />
                    </button>
                  </div>
                )}

                <div className="flex items-center gap-2 text-xs text-slate-400 mt-1 tabular-nums">
                  <span>{new Date(j.startedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                  <span>·</span>
                  <span>{formatDistance(j.totalDistanceMeters, settings.unit)}</span>
                  <span>·</span>
                  <span>{formatDuration(j.durationSeconds)}</span>
                </div>
              </div>

              {/* Middle: Minimal SVG Route Shape */}
              <div className="w-16 h-10 rounded-lg bg-slate-950 border border-slate-800/80 flex items-center justify-center p-1 shrink-0 overflow-hidden hidden sm:flex">
                {journeyThumbnails[j.id] ? (
                  <svg viewBox="0 0 100 50" className="w-full h-full">
                    <path
                      d={journeyThumbnails[j.id]}
                      fill="none"
                      stroke="#0284c7"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ) : null}
              </div>

              {/* Right: Actions */}
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => handleExportGPX(j)}
                  className="p-2 text-slate-400 hover:text-white transition"
                  title="Download GPX"
                >
                  <Download className="w-4 h-4" />
                </button>

                <button
                  onClick={() => setDeletingId(j.id)}
                  className="p-2 text-slate-600 hover:text-rose-400 transition"
                  title="Delete"
                >
                  <Trash2 className="w-4 h-4" />
                </button>

                <button
                  onClick={() => onTrackBackJourney(j)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-400/10 hover:bg-amber-400/20 text-amber-300 border border-amber-400/20 text-xs font-semibold transition active:scale-95"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Retrace</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-2xl text-slate-100 space-y-4">
            <h3 className="text-base font-bold text-white">Delete Trail?</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              This will remove the trail from local storage.
            </p>
            <div className="flex items-center gap-3 pt-1">
              <button
                onClick={() => setDeletingId(null)}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deletingId)}
                className="flex-1 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-400 text-white text-xs font-bold transition"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
