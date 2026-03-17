// Shared GPS Tracking Component
// This file provides GPS-based checkpoint tracking across all pages

(function() {
    'use strict';

    // Dynamic checkpoint data loaded from JSON
    let CHECKPOINTS = [];
    let checkpointStates = [];

    const GPS_CONFIG = {
        proximityThreshold: 50, // meters
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 5000
    };

    // State
    const STATE = {
        gpsWatchId: null,
        currentPosition: null
    };

    // Load checkpoint data from JSON
    async function loadCheckpointData() {
        try {
            const response = await fetch('./data/shark-locations.json');
            const data = await response.json();
            
            if (data.sharks && data.sharks.length > 0) {
                CHECKPOINTS = data.sharks.map((shark, index) => ({
                    id: String.fromCharCode(97 + index), // a, b, c, etc.
                    lat: shark.latitude,
                    lng: shark.longitude,
                    name: shark.title
                }));
                
                // Initialize state for each checkpoint
                checkpointStates = CHECKPOINTS.map(() => ({
                    visited: false,
                    active: false
                }));
                
                console.log('[GPS] Loaded', CHECKPOINTS.length, 'checkpoints from JSON');
                return true;
            }
        } catch (error) {
            console.error('[GPS] Error loading checkpoint data:', error);
        }
        return false;
    }

    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initGPSTracking);
    } else {
        initGPSTracking();
    }

    async function initGPSTracking() {
        // Load checkpoint data first
        const loaded = await loadCheckpointData();
        
        if (!loaded || CHECKPOINTS.length === 0) {
            console.warn('[GPS] No checkpoints loaded');
            return;
        }

        // Verify checkpoint elements exist
        let allFound = true;
        CHECKPOINTS.forEach((checkpoint) => {
            const el = document.getElementById('checkpoint-' + checkpoint.id);
            if (!el) {
                console.warn('[GPS] Checkpoint element not found:', 'checkpoint-' + checkpoint.id);
                allFound = false;
            }
        });

        if (!allFound) {
            console.warn('[GPS] Some checkpoint elements not found');
        }

        startGPSTracking();

        // Cleanup on page unload
        window.addEventListener('beforeunload', stopGPSTracking);
    }

    // Haversine formula to calculate distance between two coordinates
    function calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371e3; // Earth's radius in meters
        const φ1 = lat1 * Math.PI / 180;
        const φ2 = lat2 * Math.PI / 180;
        const Δφ = (lat2 - lat1) * Math.PI / 180;
        const Δλ = (lon2 - lon1) * Math.PI / 180;

        const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
                  Math.cos(φ1) * Math.cos(φ2) *
                  Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        return R * c; // Distance in meters
    }

    // GPS logging
    function addGPSLog(message, type = 'info') {
        const timestamp = new Date().toLocaleTimeString();
        const logMessage = `[GPS ${timestamp}] ${message}`;
        
        switch(type) {
            case 'checkpoint':
                console.log('%c' + logMessage, 'color: #00FF88; font-weight: bold');
                break;
            case 'error':
                console.error(logMessage);
                break;
            default:
                console.log(logMessage);
                break;
        }
    }

    // Update checkpoint UI
    function updateCheckpointUI() {
        CHECKPOINTS.forEach((checkpoint, index) => {
            const el = document.getElementById('checkpoint-' + checkpoint.id);
            if (!el) return;
            
            const state = checkpointStates[index];
            
            el.classList.remove('visited', 'active');
            if (state.visited) {
                el.classList.add('visited');
            }
            if (state.active) {
                el.classList.add('active');
            }
        });
        
        console.log('[GPS] UI updated for', CHECKPOINTS.length, 'checkpoints');
    }

    // Evaluate checkpoint status based on GPS position
    function evaluateCheckpoints(position) {
        const { latitude, longitude, accuracy } = position.coords;
        
        addGPSLog(`Position: ${latitude.toFixed(6)}, ${longitude.toFixed(6)} (±${accuracy.toFixed(1)}m)`);
        
        // Calculate distances to all checkpoints
        const distances = CHECKPOINTS.map((checkpoint, index) => ({
            index,
            checkpoint,
            distance: calculateDistance(latitude, longitude, checkpoint.lat, checkpoint.lng)
        }));
        
        // Find closest checkpoint
        const closest = distances.reduce((min, curr) => 
            curr.distance < min.distance ? curr : min
        );
        
        addGPSLog(`Closest: ${closest.checkpoint.name} at ${closest.distance.toFixed(1)}m`);
        
        // Check if at any checkpoint
        const atCheckpoint = distances.find(d => d.distance <= GPS_CONFIG.proximityThreshold);
        
        if (atCheckpoint) {
            // At a checkpoint
            const idx = atCheckpoint.index;
            checkpointStates[idx].visited = true;
            checkpointStates[idx].active = true;
            
            // Mark all previous checkpoints as visited
            for (let i = 0; i < idx; i++) {
                if (!checkpointStates[i].visited) {
                    checkpointStates[i].visited = true;
                    addGPSLog(`✓ ${CHECKPOINTS[i].name} marked as passed`, 'checkpoint');
                }
                checkpointStates[i].active = false;
            }
            
            // Mark all future checkpoints as not active
            for (let i = idx + 1; i < CHECKPOINTS.length; i++) {
                checkpointStates[i].active = false;
            }
            
            addGPSLog(`✓ At ${atCheckpoint.checkpoint.name}`, 'checkpoint');
        } else {
            // Not at any checkpoint - determine position in sequence
            const closestIdx = closest.index;
            
            // If we're closer to a later checkpoint than the first unvisited one,
            // mark earlier ones as visited
            let firstUnvisited = checkpointStates.findIndex(s => !s.visited);
            if (firstUnvisited === -1) firstUnvisited = CHECKPOINTS.length - 1;
            
            if (closestIdx > firstUnvisited) {
                // We've passed some checkpoints
                for (let i = 0; i < closestIdx; i++) {
                    if (!checkpointStates[i].visited) {
                        checkpointStates[i].visited = true;
                        addGPSLog(`✓ ${CHECKPOINTS[i].name} marked as passed`, 'checkpoint');
                    }
                    checkpointStates[i].active = false;
                }
                checkpointStates[closestIdx].active = true;
                checkpointStates[closestIdx].visited = false;
            } else {
                // Set the closest unvisited checkpoint as active
                checkpointStates.forEach((state, idx) => {
                    state.active = (idx === firstUnvisited);
                });
            }
            
            addGPSLog(`→ Approaching ${CHECKPOINTS[firstUnvisited].name}`);
        }
        
        // Update UI
        updateCheckpointUI();
        
        // Update GPS status if element exists
        const gpsStatus = document.getElementById('gps-status');
        if (gpsStatus) {
            gpsStatus.textContent = `GPS: ${closest.distance.toFixed(0)}m to ${closest.checkpoint.name}`;
        }
    }

    // Handle GPS errors
    function handleGPSError(error) {
        let errorMsg = 'GPS Error: ';
        switch(error.code) {
            case error.PERMISSION_DENIED:
                errorMsg += 'Permission denied';
                break;
            case error.POSITION_UNAVAILABLE:
                errorMsg += 'Position unavailable';
                break;
            case error.TIMEOUT:
                errorMsg += 'Request timeout';
                break;
            default:
                errorMsg += 'Unknown error';
        }
        addGPSLog(errorMsg, 'error');
        
        const gpsStatus = document.getElementById('gps-status');
        if (gpsStatus) {
            gpsStatus.textContent = 'GPS: Error';
        }
    }

    // Start GPS tracking
    function startGPSTracking() {
        if (!navigator.geolocation) {
            addGPSLog('Geolocation not supported', 'error');
            return;
        }
        
        // Initialize UI
        updateCheckpointUI();
        
        addGPSLog('Starting GPS tracking...');
        CHECKPOINTS.forEach((checkpoint, index) => {
            addGPSLog(`Checkpoint ${index + 1} (${checkpoint.name}): ${checkpoint.lat.toFixed(6)}, ${checkpoint.lng.toFixed(6)}`);
        });
        
        STATE.gpsWatchId = navigator.geolocation.watchPosition(
            (position) => {
                STATE.currentPosition = position;
                evaluateCheckpoints(position);
            },
            handleGPSError,
            {
                enableHighAccuracy: GPS_CONFIG.enableHighAccuracy,
                timeout: GPS_CONFIG.timeout,
                maximumAge: GPS_CONFIG.maximumAge
            }
        );
    }

    // Stop GPS tracking
    function stopGPSTracking() {
        if (STATE.gpsWatchId !== null) {
            navigator.geolocation.clearWatch(STATE.gpsWatchId);
            STATE.gpsWatchId = null;
            addGPSLog('GPS tracking stopped');
        }
    }

    // Export for external use if needed
    window.GPSTracking = {
        start: startGPSTracking,
        stop: stopGPSTracking,
        getState: () => STATE
    };
})();
