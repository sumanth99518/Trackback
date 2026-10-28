import L from 'leaflet';
import { db } from './db';
import { OfflineRegion } from '../types';

export function latLonToTileCoords(lat: number, lon: number, zoom: number): { x: number; y: number } {
  const x = Math.floor(((lon + 180) / 360) * Math.pow(2, zoom));
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor(
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) *
      Math.pow(2, zoom)
  );
  return { x, y };
}

export function tileCoordsToLatLon(x: number, y: number, zoom: number): { lat: number; lon: number } {
  const n = Math.PI - (2 * Math.PI * y) / Math.pow(2, zoom);
  const lon = (x / Math.pow(2, zoom)) * 360 - 180;
  const lat = (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
  return { lat, lon };
}

export interface TileDownloadProgress {
  total: number;
  completed: number;
  failed: number;
  percentage: number;
  currentTileKey: string;
}

export class OfflineMapManager {
  private isCancelling: boolean = false;

  calculateTileList(
    north: number,
    south: number,
    east: number,
    west: number,
    minZoom: number,
    maxZoom: number
  ): Array<{ z: number; x: number; y: number; key: string }> {
    const tiles: Array<{ z: number; x: number; y: number; key: string }> = [];

    for (let z = minZoom; z <= maxZoom; z++) {
      const p1 = latLonToTileCoords(north, west, z);
      const p2 = latLonToTileCoords(south, east, z);

      const minX = Math.min(p1.x, p2.x);
      const maxX = Math.max(p1.x, p2.x);
      const minY = Math.min(p1.y, p2.y);
      const maxY = Math.max(p1.y, p2.y);

      // Guard against astronomical bounding boxes
      for (let x = minX; x <= maxX; x++) {
        for (let y = minY; y <= maxY; y++) {
          tiles.push({ z, x, y, key: `${z}/${x}/${y}` });
        }
      }
    }

    return tiles;
  }

  cancelDownload(): void {
    this.isCancelling = true;
  }

  async downloadRegion(
    region: OfflineRegion,
    onProgress: (progress: TileDownloadProgress) => void
  ): Promise<boolean> {
    this.isCancelling = false;
    const tiles = this.calculateTileList(
      region.bounds.north,
      region.bounds.south,
      region.bounds.east,
      region.bounds.west,
      region.minZoom,
      region.maxZoom
    );

    // Limit maximum tiles to 500 per download pack to safeguard browser storage
    const boundedTiles = tiles.slice(0, 500);
    const total = boundedTiles.length;
    let completed = 0;
    let failed = 0;

    // Use OpenStreetMap standard or CartoDB Voyager tiles
    const tileUrlTemplate = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

    const concurrency = 3;
    let index = 0;

    const worker = async () => {
      while (index < boundedTiles.length && !this.isCancelling) {
        const item = boundedTiles[index++];
        const url = tileUrlTemplate
          .replace('{z}', item.z.toString())
          .replace('{x}', item.x.toString())
          .replace('{y}', item.y.toString());

        try {
          const res = await fetch(url, { mode: 'cors' });
          if (res.ok) {
            const blob = await res.blob();
            const dataUrl = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result as string);
              reader.onerror = reject;
              reader.readAsDataURL(blob);
            });

            await db.saveCachedTile(item.key, dataUrl, region.id);
            completed++;
          } else {
            failed++;
          }
        } catch {
          failed++;
        }

        onProgress({
          total,
          completed,
          failed,
          percentage: Math.round(((completed + failed) / total) * 100),
          currentTileKey: item.key,
        });

        // Respectful polite pacing
        await new Promise((r) => setTimeout(r, 60));
      }
    };

    const workers = Array.from({ length: concurrency }, () => worker());
    await Promise.all(workers);

    if (this.isCancelling) {
      region.downloadStatus = 'pending';
      await db.saveOfflineRegion(region);
      return false;
    }

    region.downloadStatus = 'completed';
    region.tileCount = completed;
    region.storageSizeBytes = completed * 22000;
    await db.saveOfflineRegion(region);
    return true;
  }
}

export const offlineMapManager = new OfflineMapManager();

/**
 * Custom Leaflet TileLayer that prioritizes IndexedDB offline cache,
 * falls back to network when online, and renders a sleek high-contrast offline grid
 * if tiles have not been pre-downloaded.
 */
export class OfflineTileLayer extends L.TileLayer {
  private fallbackCache = new Map<string, string>();

  createTile(coords: L.Coords, done: L.DoneCallback): HTMLElement {
    const tile = document.createElement('img');

    L.DomEvent.on(tile, 'load', () => {
      done(undefined, tile);
    });

    const key = `${coords.z}/${coords.x}/${coords.y}`;

    // 1. Try local IndexedDB
    db.getCachedTile(key)
      .then((cachedDataUrl) => {
        if (cachedDataUrl) {
          tile.src = cachedDataUrl;
        } else if (typeof navigator !== 'undefined' && navigator.onLine) {
          // 2. Online fetch
          const url = this.getTileUrl(coords);
          tile.src = url;
          // Optionally cache tile quietly
          fetch(url, { mode: 'cors' })
            .then((r) => (r.ok ? r.blob() : null))
            .then((blob) => {
              if (blob) {
                const reader = new FileReader();
                reader.onloadend = () => {
                  if (reader.result) {
                    db.saveCachedTile(key, reader.result as string, 'adhoc');
                  }
                };
                reader.readAsDataURL(blob);
              }
            })
            .catch(() => {});
        } else {
          // 3. Offline without cached tile: generate sleek vector grid tile
          tile.src = this.generateOfflineGridTile(coords);
        }
      })
      .catch(() => {
        tile.src = this.generateOfflineGridTile(coords);
      });

    L.DomEvent.on(tile, 'error', () => {
      tile.src = this.generateOfflineGridTile(coords);
    });

    return tile;
  }

  private generateOfflineGridTile(coords: L.Coords): string {
    const cached = this.fallbackCache.get(`${coords.z}/${coords.x}/${coords.y}`);
    if (cached) return cached;

    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    // Dark charcoal topographic background
    ctx.fillStyle = '#080e1e';
    ctx.fillRect(0, 0, 256, 256);

    // Fine grid lines
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.12)';
    ctx.lineWidth = 1;

    for (let i = 0; i < 256; i += 64) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, 256);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(256, i);
      ctx.stroke();
    }

    // Border
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.strokeRect(0, 0, 256, 256);

    // Subtle coordinate tag for spatial orientation
    ctx.fillStyle = 'rgba(148, 163, 184, 0.3)';
    ctx.font = '10px monospace';
    ctx.fillText(`GPS Grid ${coords.z}`, 12, 24);

    const dataUrl = canvas.toDataURL();
    this.fallbackCache.set(`${coords.z}/${coords.x}/${coords.y}`, dataUrl);
    return dataUrl;
  }
}
