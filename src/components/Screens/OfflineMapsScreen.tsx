import React, { useState, useEffect } from 'react';
import { OfflineRegion, LiveLocation } from '../../types';
import { db } from '../../services/db';
import { offlineMapManager, TileDownloadProgress } from '../../services/tileDownloader';
import { Download, Trash2, Check, Compass, HardDrive } from 'lucide-react';

interface OfflineMapsScreenProps {
  currentLocation: LiveLocation | null;
  onRefreshRegions: () => void;
}

interface PresetRegion {
  name: string;
  category: string;
  bounds: { north: number; south: number; east: number; west: number };
  minZoom: number;
  maxZoom: number;
  approxSizeMb: string;
}

const PRESET_REGIONS: PresetRegion[] = [
  {
    name: 'Yosemite Valley Wilderness Loop',
    category: 'National Park',
    bounds: { north: 37.7600, south: 37.7300, east: -119.5700, west: -119.6100 },
    minZoom: 13,
    maxZoom: 15,
    approxSizeMb: '3.4 MB',
  },
  {
    name: 'Grand Canyon South Rim Trail',
    category: 'Canyon Trail',
    bounds: { north: 36.0700, south: 36.0400, east: -112.1200, west: -112.1600 },
    minZoom: 13,
    maxZoom: 15,
    approxSizeMb: '2.9 MB',
  },
  {
    name: 'Chamonix Alpine Crest',
    category: 'Alpine Pass',
    bounds: { north: 45.9400, south: 45.9100, east: 6.8900, west: 6.8400 },
    minZoom: 13,
    maxZoom: 15,
    approxSizeMb: '3.8 MB',
  },
  {
    name: 'Historic City Core',
    category: 'Urban Explorer',
    bounds: { north: 48.8600, south: 48.8450, east: 2.3600, west: 2.3350 },
    minZoom: 14,
    maxZoom: 16,
    approxSizeMb: '4.2 MB',
  },
];

export const OfflineMapsScreen: React.FC<OfflineMapsScreenProps> = ({
  currentLocation,
  onRefreshRegions,
}) => {
  const [downloadedRegions, setDownloadedRegions] = useState<OfflineRegion[]>([]);
  const [cacheStats, setCacheStats] = useState<{ count: number; estimatedSizeBytes: number }>({ count: 0, estimatedSizeBytes: 0 });
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<TileDownloadProgress | null>(null);
  const [activeRegionName, setActiveRegionName] = useState<string>('');

  useEffect(() => {
    loadRegions();
  }, []);

  const loadRegions = async () => {
    const regions = await db.getOfflineRegions();
    setDownloadedRegions(regions);
    const stats = await db.getTileCacheStats();
    setCacheStats(stats);
    onRefreshRegions();
  };

  const handleDownloadPreset = async (preset: PresetRegion) => {
    if (isDownloading) return;

    const id = `region_${Date.now()}`;
    const newRegion: OfflineRegion = {
      id,
      name: preset.name,
      bounds: preset.bounds,
      minZoom: preset.minZoom,
      maxZoom: preset.maxZoom,
      tileCount: 0,
      storageSizeBytes: 0,
      downloadStatus: 'downloading',
      createdAt: Date.now(),
    };

    setIsDownloading(true);
    setActiveRegionName(preset.name);

    try {
      await offlineMapManager.downloadRegion(newRegion, (progress) => {
        setDownloadProgress(progress);
      });
      await loadRegions();
    } catch (err) {
      console.error(err);
    } finally {
      setIsDownloading(false);
      setDownloadProgress(null);
    }
  };

  const handleDownloadCurrentLocation = async () => {
    if (!currentLocation || isDownloading) return;

    const lat = currentLocation.latitude;
    const lon = currentLocation.longitude;
    const delta = 0.02;

    const id = `region_curr_${Date.now()}`;
    const name = `Local Area (${lat.toFixed(2)}°, ${lon.toFixed(2)}°)`;

    const newRegion: OfflineRegion = {
      id,
      name,
      bounds: {
        north: lat + delta,
        south: lat - delta,
        east: lon + delta,
        west: lon - delta,
      },
      minZoom: 13,
      maxZoom: 15,
      tileCount: 0,
      storageSizeBytes: 0,
      downloadStatus: 'downloading',
      createdAt: Date.now(),
    };

    setIsDownloading(true);
    setActiveRegionName(name);

    try {
      await offlineMapManager.downloadRegion(newRegion, (progress) => {
        setDownloadProgress(progress);
      });
      await loadRegions();
    } catch (err) {
      console.error(err);
    } finally {
      setIsDownloading(false);
      setDownloadProgress(null);
    }
  };

  const handleDeleteRegion = async (id: string) => {
    await db.deleteOfflineRegion(id);
    await loadRegions();
  };

  const handleClearAll = async () => {
    if (confirm('Erase all cached offline map tiles?')) {
      await db.clearAllTiles();
      await loadRegions();
    }
  };

  const formatMb = (bytes: number) => (bytes / (1024 * 1024)).toFixed(1);

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-20 md:pb-8 pt-2">
      {/* Minimal Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">Offline Maps</h1>
          <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5 tabular-nums">
            <span>{downloadedRegions.length} regions</span>
            <span>·</span>
            <span>{formatMb(cacheStats.estimatedSizeBytes)} MB cached</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {cacheStats.count > 0 && (
            <button
              onClick={handleClearAll}
              className="text-xs text-slate-500 hover:text-rose-400 transition"
            >
              Clear Cache
            </button>
          )}

          <button
            onClick={handleDownloadCurrentLocation}
            disabled={!currentLocation || isDownloading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 disabled:opacity-50 text-white text-xs font-semibold transition active:scale-95"
          >
            <Compass className="w-3.5 h-3.5" />
            <span>Cache GPS Area</span>
          </button>
        </div>
      </div>

      {/* Download Progress Bar */}
      {isDownloading && downloadProgress && (
        <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
          <div className="flex justify-between text-xs text-slate-300">
            <span className="font-semibold text-white truncate max-w-xs">{activeRegionName}</span>
            <span className="font-mono text-sky-400">{downloadProgress.percentage}%</span>
          </div>
          <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
            <div
              className="h-full bg-sky-400 rounded-full transition-all duration-200"
              style={{ width: `${downloadProgress.percentage}%` }}
            ></div>
          </div>
        </div>
      )}

      {/* Downloaded Regions List */}
      <section className="space-y-3">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
          Downloaded On Device
        </span>

        {downloadedRegions.length === 0 ? (
          <div className="p-6 rounded-xl bg-slate-900/30 border border-slate-800/60 text-center text-xs text-slate-500">
            No offline maps saved yet. Download presets below for wilderness use.
          </div>
        ) : (
          <div className="divide-y divide-slate-800/80 rounded-2xl bg-slate-900/60 border border-slate-800 overflow-hidden">
            {downloadedRegions.map((r) => (
              <div key={r.id} className="p-3.5 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-white truncate">{r.name}</h3>
                  <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5 tabular-nums">
                    <span>{r.tileCount} tiles</span>
                    <span>·</span>
                    <span>{formatMb(r.storageSizeBytes)} MB</span>
                  </div>
                </div>

                <button
                  onClick={() => handleDeleteRegion(r.id)}
                  className="p-1.5 text-slate-600 hover:text-rose-400 transition"
                  title="Delete"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Preset Explorer Regions */}
      <section className="space-y-3 pt-2">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
          Trail & Wilderness Packs
        </span>

        <div className="divide-y divide-slate-800/80 rounded-2xl bg-slate-900/60 border border-slate-800 overflow-hidden">
          {PRESET_REGIONS.map((preset) => {
            const isSaved = downloadedRegions.some((r) => r.name === preset.name);

            return (
              <div key={preset.name} className="p-3.5 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-white truncate">{preset.name}</h3>
                  <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5 tabular-nums">
                    <span>{preset.category}</span>
                    <span>·</span>
                    <span>~{preset.approxSizeMb}</span>
                  </div>
                </div>

                <button
                  onClick={() => handleDownloadPreset(preset)}
                  disabled={isDownloading || isSaved}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition active:scale-95 shrink-0 ${
                    isSaved
                      ? 'text-emerald-400 bg-emerald-500/10 cursor-default'
                      : 'bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700'
                  }`}
                >
                  {isSaved ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Ready</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-3.5 h-3.5" />
                      <span>Download</span>
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};
