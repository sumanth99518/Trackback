/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Journey, RoutePoint, LiveLocation, NavigationState, AppSettings } from './types';
import { db, DEFAULT_SETTINGS } from './services/db';
import { trackingService } from './services/trackingService';
import { navigationEngine } from './services/navigationEngine';
import { wakeLock } from './services/wakeLock';

// Layout & Navigation
import { TopBar } from './components/Navigation/TopBar';
import { BottomTabBar } from './components/Navigation/BottomTabBar';

// Screens
import { HomeScreen } from './components/Screens/HomeScreen';
import { TrackingScreen } from './components/Screens/TrackingScreen';
import { ReturnNavigationScreen } from './components/Screens/ReturnNavigationScreen';
import { MyJourneysScreen } from './components/Screens/MyJourneysScreen';
import { OfflineMapsScreen } from './components/Screens/OfflineMapsScreen';
import { SettingsScreen } from './components/Screens/SettingsScreen';

// Modals
import { ArrivalCelebrationModal } from './components/Modals/ArrivalCelebrationModal';

export default function App() {
  const [currentTab, setCurrentTab] = useState<string>('home');
  const [activeJourney, setActiveJourney] = useState<Journey | null>(null);
  const [recordedPoints, setRecordedPoints] = useState<RoutePoint[]>([]);
  const [currentLocation, setCurrentLocation] = useState<LiveLocation | null>(null);
  const [gpsStatus, setGpsStatus] = useState<'acquiring' | 'locked' | 'poor_signal' | 'denied' | 'simulated'>('acquiring');
  const [allJourneys, setAllJourneys] = useState<Journey[]>([]);
  const [savedRegionsCount, setSavedRegionsCount] = useState<number>(0);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [batteryLevel, setBatteryLevel] = useState<number | null>(null);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);

  // Navigation (Track Back) state
  const [navigationState, setNavigationState] = useState<NavigationState>(navigationEngine.getState());
  const [reversedPoints, setReversedPoints] = useState<RoutePoint[]>([]);
  const [showArrivalModal, setShowArrivalModal] = useState<boolean>(false);
  const [retraceDurationSeconds, setRetraceDurationSeconds] = useState<number>(0);

  // --- INITIAL DATA & SETTINGS LOAD ---
  const loadInitialData = useCallback(async () => {
    const loadedSettings = await db.getSettings();
    setSettings(loadedSettings);
    navigationEngine.updateSettings(loadedSettings);

    const journeys = await db.getAllJourneys();
    setAllJourneys(journeys);

    const regions = await db.getOfflineRegions();
    setSavedRegionsCount(regions.length);

    // Check if there is already an active session
    const active = await db.getActiveJourney();
    if (active) {
      setActiveJourney(active);
      const points = await db.getRoutePointsForJourney(active.id);
      setRecordedPoints(points);
    }
  }, []);

  useEffect(() => {
    loadInitialData();
    wakeLock.initAutoReacquire();

    // Online / Offline monitor
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Battery API
    if (typeof navigator !== 'undefined' && 'getBattery' in navigator) {
      (navigator as unknown as { getBattery: () => Promise<{ level: number; addEventListener: (type: string, fn: () => void) => void }> })
        .getBattery()
        .then((battery) => {
          setBatteryLevel(Math.round(battery.level * 100));
          battery.addEventListener('levelchange', () => {
            setBatteryLevel(Math.round(battery.level * 100));
          });
        })
        .catch(() => {});
    }

    // Subscribe to Tracking Service
    const unsubTracking = trackingService.subscribe((state) => {
      setActiveJourney(state.journey);
      setCurrentLocation(state.currentLocation);
      setRecordedPoints(state.points);
      setGpsStatus(state.gpsStatus);
      if (state.gpsStatus === 'simulated') {
        setIsSimulating(true);
      }
    });

    // Subscribe to Navigation Engine
    const unsubNav = navigationEngine.subscribe((state) => {
      setNavigationState(state);
      setReversedPoints(navigationEngine.getReversedRoutePoints());
      if (state.hasArrived) {
        setShowArrivalModal(true);
        const elapsed = Math.floor((Date.now() - state.retraceStartTime) / 1000);
        setRetraceDurationSeconds(Math.max(1, elapsed));
      }
    });

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      unsubTracking();
      unsubNav();
    };
  }, [loadInitialData]);

  // --- ACTIONS ---

  const handleStartTracking = async () => {
    try {
      const journey = await trackingService.startTracking(undefined, isSimulating);
      setActiveJourney(journey);
      setCurrentTab('tracking');
    } catch (err) {
      console.error('Failed to start tracking:', err);
    }
  };

  const handlePauseTracking = () => {
    trackingService.pauseTracking();
  };

  const handleResumeTracking = () => {
    trackingService.resumeTracking();
  };

  const handleFinishTracking = async () => {
    try {
      await trackingService.finishTracking();
      await loadInitialData();
      setCurrentTab('journeys');
    } catch (err) {
      console.error('Failed to finish tracking:', err);
    }
  };

  const handleTrackBack = async (targetJourney?: Journey) => {
    const journeyToRetrace = targetJourney || activeJourney;
    if (!journeyToRetrace) return;

    let points = recordedPoints;
    if (targetJourney && targetJourney.id !== activeJourney?.id) {
      points = await db.getRoutePointsForJourney(targetJourney.id);
    }

    if (points.length < 2) {
      alert('You need at least 2 recorded GPS points to track back. Move further along your trail first.');
      return;
    }

    await navigationEngine.startNavigation(journeyToRetrace, points, 'footsteps');
    setCurrentTab('return');
  };

  const handleEndNavigation = () => {
    navigationEngine.stopNavigation();
    if (activeJourney && (activeJourney.status === 'recording' || activeJourney.status === 'paused')) {
      setCurrentTab('tracking');
    } else {
      setCurrentTab('home');
    }
  };

  const handleToggleSimulate = () => {
    const simActive = trackingService.toggleSimulationMode();
    setIsSimulating(simActive);
  };

  const handleDataReset = async () => {
    await db.clearAllTiles();
    const journeys = await db.getAllJourneys();
    for (const j of journeys) {
      await db.deleteJourney(j.id);
    }
    setActiveJourney(null);
    setRecordedPoints([]);
    await loadInitialData();
    setCurrentTab('home');
  };

  return (
    <div className="min-h-screen bg-[#0b132b] text-slate-100 flex flex-col font-sans">
      {/* Top Bar Contract (Wordmark - Links - Primary Action) */}
      <TopBar
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        isOnline={isOnline}
        gpsStatus={gpsStatus}
        hasActiveJourney={!!activeJourney}
        batteryLevel={batteryLevel}
        onStartTrackingPrompt={handleStartTracking}
      />

      {/* Main Viewport Container */}
      <main className={`flex-1 w-full ${currentTab === 'tracking' || currentTab === 'return' ? 'p-0 max-w-none' : 'max-w-4xl mx-auto px-4 pt-4 md:pt-6'}`}>
        {currentTab === 'home' && (
          <HomeScreen
            activeJourney={activeJourney}
            currentLocation={currentLocation}
            gpsStatus={gpsStatus}
            recentJourneys={allJourneys}
            savedRegionsCount={savedRegionsCount}
            settings={settings}
            onStartTracking={handleStartTracking}
            onResumeTracking={() => setCurrentTab('tracking')}
            onTrackBackJourney={handleTrackBack}
            onNavigateTab={setCurrentTab}
            onToggleSimulate={handleToggleSimulate}
            isSimulating={isSimulating}
          />
        )}

        {currentTab === 'tracking' && (
          <TrackingScreen
            journey={activeJourney}
            recordedPoints={recordedPoints}
            currentLocation={currentLocation}
            gpsStatus={gpsStatus}
            settings={settings}
            onPause={handlePauseTracking}
            onResume={handleResumeTracking}
            onFinish={handleFinishTracking}
            onTrackBack={() => handleTrackBack()}
            onStartTracking={handleStartTracking}
          />
        )}

        {currentTab === 'return' && (
          <ReturnNavigationScreen
            journey={navigationEngine.getActiveJourney() || activeJourney}
            recordedPoints={recordedPoints}
            reversedPoints={reversedPoints}
            currentLocation={currentLocation}
            navigationState={navigationState}
            settings={settings}
            onEndNavigation={handleEndNavigation}
            onSelectTab={setCurrentTab}
          />
        )}

        {currentTab === 'journeys' && (
          <MyJourneysScreen
            journeys={allJourneys}
            settings={settings}
            onRefresh={loadInitialData}
            onTrackBackJourney={handleTrackBack}
            onStartTracking={handleStartTracking}
          />
        )}

        {currentTab === 'maps' && (
          <OfflineMapsScreen
            currentLocation={currentLocation}
            onRefreshRegions={loadInitialData}
          />
        )}

        {currentTab === 'settings' && (
          <SettingsScreen
            settings={settings}
            onUpdateSettings={setSettings}
            onDataReset={handleDataReset}
          />
        )}
      </main>

      {/* Mobile Bottom Tab Bar (Thumb-Zone Navigation) */}
      <BottomTabBar
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        isTrackingActive={activeJourney?.status === 'recording'}
        isRetracingActive={navigationState.active}
      />

      {/* Arrival Celebration Modal */}
      {showArrivalModal && (
        <ArrivalCelebrationModal
          journey={navigationEngine.getActiveJourney() || activeJourney}
          retraceDurationSeconds={retraceDurationSeconds}
          settings={settings}
          onDismiss={() => {
            setShowArrivalModal(false);
            handleEndNavigation();
          }}
        />
      )}
    </div>
  );
}
