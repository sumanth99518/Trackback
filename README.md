# Build TrackBack — An Offline-First Path Tracking and Return Navigation App

## 1. Product vision

Build a mobile-first application called **TrackBack** that helps people find their way back to where they started when exploring an unfamiliar place.

The core idea is simple:

1. The user opens TrackBack and taps **Start Tracking**.
2. The app records the user's geographical path using GPS.
3. As the user moves, the app creates a trail on a map, showing the starting point, current location, and path already travelled.
4. The route is saved locally on the device.
5. Whenever the user wants to return, they tap **Track Back**.
6. The app guides the user along the recorded path in reverse, from their current position to the starting point.

The app must be designed with an **offline-first architecture**. Core route recording, route storage, and retracing must work without mobile data or Wi-Fi. Internet access should only be needed for optional features such as downloading maps, searching places, and synchronizing backups.

Do not build this as merely a visual prototype. Implement functional GPS tracking, persistent local storage, offline map support, and reverse-route navigation.

## 2. Target users and use cases

Design TrackBack for:

* Travelers exploring unfamiliar cities and streets.
* Hikers walking through forests and mountains.
* People exploring villages, rural areas, or remote locations.
* Campers and outdoor adventurers.
* Cyclists and walkers exploring unfamiliar routes.
* People who want to retrace their exact route instead of finding a new route home.

## 3. Core features

### A. Start tracking

Create a prominent Start Tracking button on the home screen.

When the user starts tracking:

* Request location permission with a clear explanation.
* Capture GPS coordinates, timestamps, and location accuracy.
* Record latitude, longitude, altitude when available, speed when available, and timestamps.
* Display the travelled route as a polyline on the map.
* Show a start marker, current-location marker, elapsed time, distance travelled, and GPS accuracy.
* Save location points incrementally to local storage.
* Continue recording when the screen is locked or the app moves into the background, where the operating system permits it.
* Show clear recording status so users know whether tracking is active.

Include Pause, Resume, Finish, and Save Route controls.

Do not add excessive location points when the user is stationary or when GPS readings fluctuate. Filter inaccurate readings and reduce redundant points without losing meaningful turns.

### B. Live route map

Build a clean interactive map displaying:

* Green marker: starting point.
* Blue marker: current location.
* Blue or orange line: recorded path.
* Direction arrows along the path where appropriate.
* A clear indication of the direction travelled.
* A distance and elapsed-time summary.
* A control to recenter the map on the current location.

Use a map provider and map-rendering library that supports offline tiles or downloadable map regions. Do not assume that GPS itself requires internet access; GPS positioning can work offline on supported devices, although accuracy and availability vary.

### C. Track Back mode — the main feature

Create a large, easy-to-find **Track Back** button.

When activated:

1. Retrieve the saved route.
2. Reverse the recorded route points to construct the return path.
3. Determine the user's current position.
4. Match the current position to the nearest appropriate point on the recorded route.
5. Display the return route from the user's position to the original starting point.
6. Show the next direction, approximate remaining distance, and progress.
7. Update the user's position as they walk.
8. Detect when the user has moved away from the recorded path.
9. Display a clear warning and help them reconnect to the recorded route.
10. Mark the journey complete when the user reaches the starting point within a configurable GPS tolerance.

Provide two navigation modes:

**Follow My Footsteps:** Follow the original path in reverse, which is the default.

**Return Overview:** Show the complete return route on the map so the user can visually understand where they need to go.

Never silently replace the recorded route with a different route. If the user wants an alternative route, present it as a separate optional mode.

### D. Reliable route recording

Implement a location-recording service that:

* Records points based on movement, elapsed time, and GPS accuracy.
* Uses configurable sampling thresholds rather than recording every raw GPS update.
* Handles temporary GPS loss.
* Identifies potentially inaccurate GPS jumps.
* Stores route points in chronological order.
* Uses timestamps to preserve the original journey.
* Tracks gaps in GPS data instead of inventing a path through missing sections.
* Avoids connecting widely separated points with misleading straight lines.
* Supports long journeys and recovery after an application restart.

Store each point with a timestamp and accuracy value. Use altitude and speed only when reliable.

### E. Offline maps

Offline support is a major product requirement.

Before a journey, let users download a map region for the area they plan to explore.

Offline map functionality must include:

* Map tiles stored on the device.
* Map rendering without internet access.
* GPS-based current-position display.
* Route recording without internet access.
* Saving and loading journeys locally.
* Reverse-route navigation using locally saved coordinates.
* A visible offline indicator.
* A storage manager for downloaded maps and saved journeys.
* Warnings when the user enters an area outside the downloaded map coverage.

Let users choose an area and zoom level before downloading. Estimate the required storage and ask for confirmation.

Use a legally suitable offline map provider. Respect map data licensing, attribution, caching limits, and tile usage policies. Do not bulk-download public tile servers in violation of their terms. Use an approved offline mapping solution or a provider that explicitly supports offline map downloads.

If a map region is unavailable offline, keep recording GPS coordinates and the travelled path data where possible. Clearly explain that detailed background map imagery is unavailable.

### F. Saved journeys

Create a My Journeys screen containing:

* Journey name.
* Start date and time.
* Total distance.
* Total duration.
* Start and finish locations, when available.
* Route preview.
* Tracking status.

Allow users to rename, reopen, delete, and retrace saved journeys. Persist all data across application restarts.

Let users export and import their own routes using GPX where practical.

### G. Safety and reliability

Implement:

* A clear indication when GPS accuracy is poor.
* A warning when location access is disabled.
* A warning when the device battery is low.
* A warning when route recording has stopped or been interrupted.
* A visible recording indicator in the background where supported.
* A confirmation before ending or deleting an active journey.
* A recovery mechanism after a crash or unexpected shutdown.
* An explicit warning when route gaps make exact retracing uncertain.

Do not claim that TrackBack guarantees safe navigation. GPS can drift, batteries can fail, and recorded routes can contain errors. Encourage users in remote or hazardous areas to carry suitable backup navigation tools.

## 4. UI and screen design

Create a modern, minimal, mobile-first interface.

Use a dark navy or charcoal base, high-contrast text, green for the starting point, blue for the current position, and orange for warnings.

Prioritize readability outdoors, large touch targets, and one-handed use.

### Screen 1: Home

Display:

* TrackBack logo and app name.
* Current GPS status.
* A large Start Tracking button.
* A Continue Journey button if an active session exists.
* My Journeys.
* Offline Maps.
* A small offline-ready status indicator.

### Screen 2: Active Tracking

Display:

* Full-screen map.
* Recorded path.
* Start and current-position markers.
* Distance travelled.
* Elapsed time.
* GPS accuracy.
* Pause and Finish controls.

Make the route visible without covering the map with too many cards or menus.

### Screen 3: Return Navigation

Display:

* Reverse route highlighted on the map.
* Current location and original starting point.
* Large next-direction guidance where reliable.
* Remaining distance.
* Progress towards the starting point.
* Off-route alert if necessary.
* End Navigation button.

When the user is away from the original route, prioritize a clear instruction to reconnect to the recorded path rather than presenting misleading directions.

### Screen 4: My Journeys

Display saved journeys as compact cards with a small route preview, distance, duration, and date.

### Screen 5: Offline Maps

Allow users to select an area, choose map detail, estimate storage, download supported map data, view download progress, and delete downloaded regions.

### Screen 6: Settings

Include:

* Distance units: kilometres or miles.
* GPS recording frequency.
* Battery-saving preferences.
* Background tracking information.
* Map storage management.
* Location permissions.
* Data export and deletion.
* Privacy controls.

## 5. Recommended technical architecture

Prefer a cross-platform mobile application using React Native with Expo development builds and TypeScript, or another mobile framework capable of reliable background GPS tracking and genuine offline maps.

Do not use a browser-only application or a simple PWA as the primary implementation if it cannot reliably provide the required background tracking and offline map functionality.

Suggested components:

* **Frontend:** React Native, TypeScript.
* **Map rendering:** MapLibre Native or another map SDK with verified offline-region support.
* **Location:** A native GPS/location module with background location support.
* **Local database:** SQLite.
* **Local preferences:** Secure or standard device storage as appropriate.
* **Route format:** GeoJSON internally, with GPX import/export.
* **Backend:** Optional, not required for core tracking.
* **Cloud synchronization:** Optional future enhancement.

Choose compatible libraries based on their current maintenance status, platform requirements, and licensing. Verify actual offline map support on both Android and iOS before committing to a provider.

### Suggested data model

Journey:

* id
* name
* startedAt
* endedAt
* totalDistanceMeters
* durationSeconds
* status
* startLatitude
* startLongitude
* lastRecordedAt

RoutePoint:

* id
* journeyId
* sequenceNumber
* latitude
* longitude
* timestamp
* accuracyMeters
* altitudeMeters, nullable
* speedMetersPerSecond, nullable

OfflineRegion:

* id
* name
* bounds
* zoomRange
* storageSizeBytes
* downloadStatus

Keep route points indexed by journeyId and sequenceNumber. Store coordinates as numeric values and use appropriate database transactions for reliable persistence.

## 6. Route and navigation logic

Implement the route engine independently of the UI.

### Forward recording

Maintain an ordered sequence of accepted GPS points:

P0 → P1 → P2 → P3 → ... → Pn

Apply configurable filtering for poor accuracy, duplicate coordinates, implausible jumps, and insignificant movement.

Calculate travelled distance from accepted route segments using a suitable geographic distance formula. Do not calculate distance from the start to the current location alone.

### Reverse navigation

For a complete, reliable recorded route, construct:

Pn → P(n-1) → P(n-2) → ... → P0

However, the user's live position might not coincide exactly with the last recorded point.

Therefore:

* Project the current location onto a nearby route segment when appropriate.
* Select the correct route position using location proximity, movement direction, and recent navigation state.
* Avoid snapping to a distant section of the route when the path crosses itself.
* Navigate along the remaining route towards P0.
* Use a configurable arrival radius, accounting for GPS accuracy.
* Display uncertainty when the current position cannot be matched reliably.

Use hysteresis or similar techniques to prevent rapid jumps between route segments.

If the user walks away from the route, calculate a safe reconnection target on the recorded trail. Do not assume that a straight line to the nearest GPS point is walkable, especially around rivers, cliffs, walls, or buildings.

## 7. Privacy and permissions

TrackBack should work without an account.

* Keep route history on the device by default.
* Ask for foreground location access before tracking.
* Request background location permission only when needed, with a clear explanation.
* Never record location secretly.
* Do not upload location history without explicit user consent.
* Provide an option to permanently delete stored journeys.
* Explain how location data is stored and used.
* Handle Android and iOS permission restrictions correctly.

## 8. Battery optimization

Location recording should balance accuracy and battery usage.

* Use more frequent updates when the user is moving.
* Reduce unnecessary updates while stationary.
* Adjust sampling based on GPS accuracy, movement, and journey type.
* Allow users to select a higher-accuracy or battery-saving mode.
* Use operating-system-supported background location mechanisms.
* Inform users that background tracking behaviour varies by device, OS version, and battery restrictions.

Do not promise unlimited background tracking if the operating system can suspend the application.

## 9. Testing requirements

Implement and test these scenarios:

1. Start tracking with internet access and return to the starting point.
2. Start tracking, disable mobile data and Wi-Fi, and continue recording.
3. Download a map region, enable airplane mode, and verify map rendering and route recording.
4. Close and reopen the app during a journey and verify route recovery.
5. Pause and resume tracking.
6. Simulate poor GPS accuracy and location jumps.
7. Walk off the recorded path and test reconnection guidance.
8. Test a route that crosses itself.
9. Test a long journey with thousands of points.
10. Test low-storage and low-battery conditions.
11. Verify that deleting a journey removes its local route data.
12. Test foreground and background tracking on real Android and iOS devices.

Separate automated route-engine tests from device-dependent GPS and background-location tests.

## 10. Development workflow

Build the application in stages:

Phase 1: Working GPS tracking, local route storage, and a basic map.

Phase 2: Reverse-route navigation and off-route detection.

Phase 3: Downloadable offline maps and offline route rendering.

Phase 4: Background tracking, crash recovery, battery optimization, and route export/import.

Phase 5: UI refinement, accessibility, testing, and release preparation.

First inspect the framework and library compatibility, then create a working project structure, install dependencies, and implement the actual functionality. Avoid fake map screens, hardcoded location data, mock tracking buttons, and placeholder navigation logic.

Provide complete source code, setup instructions, Android build instructions, required permissions, and a clear list of any features that still need real-device testing.

## Final acceptance criteria

The MVP is complete only when a user can:

1. Open TrackBack and start recording their real GPS path.
2. See the path appear on a map.
3. Save the path locally.
4. Disable the internet and continue recording.
5. Reopen the app and recover a saved journey.
6. Activate Track Back and follow the recorded route in reverse.
7. Reach the original starting point with a clear completion indication.
8. Use a previously downloaded map without internet access.

The primary product promise is: **Record your path once. Find your way back later—even without internet.**
no done at
