class WakeLockService {
  private sentinel: WakeLockSentinel | null = null;
  private isEnabled: boolean = true;

  async requestWakeLock(): Promise<boolean> {
    if (!this.isEnabled) return false;
    if (typeof navigator === 'undefined' || !('wakeLock' in navigator)) {
      return false;
    }

    try {
      this.sentinel = await navigator.wakeLock.request('screen');
      this.sentinel.addEventListener('release', () => {
        this.sentinel = null;
      });
      return true;
    } catch {
      return false;
    }
  }

  async releaseWakeLock(): Promise<void> {
    if (this.sentinel) {
      try {
        await this.sentinel.release();
      } catch {
        // Ignored
      }
      this.sentinel = null;
    }
  }

  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
    if (!enabled) {
      this.releaseWakeLock();
    }
  }

  initAutoReacquire(): void {
    if (typeof document === 'undefined') return;
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && this.isEnabled) {
        this.requestWakeLock();
      }
    });
  }
}

export const wakeLock = new WakeLockService();
