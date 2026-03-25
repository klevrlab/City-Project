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

    // Calculate distance based solely on longitude difference
    function calculateDistance(lat1, lon1, lat2, lon2) {
        // Simplified to use only longitude difference for consistency
        // At San Jose latitude (~37.33°N), 1 degree of longitude is approx 88,000 meters.
        return Math.abs(lon2 - lon1) * 88000;
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

    // Evaluate checkpoint status based on simple longitude check
    // "left of both check both, left of one check one, left of none check none"
    function evaluateCheckpoints(position) {
        const { latitude, longitude, accuracy } = position.coords;
        
        addGPSLog(`Position: ${latitude.toFixed(6)}, ${longitude.toFixed(6)} (±${accuracy.toFixed(1)}m)`);
        
        let checkedCount = 0;
        
        // Check if user's longitude is "left of" (less than or equal to) the checkpoint's longitude
        CHECKPOINTS.forEach((checkpoint, index) => {
            if (longitude <= checkpoint.lng) {
                if (!checkpointStates[index].visited) {
                    addGPSLog(`✓ Passed ${checkpoint.name}`, 'checkpoint');
                }
                checkpointStates[index].visited = true;
                checkedCount++;
            } else {
                checkpointStates[index].visited = false;
            }
        });
        
        // Set active state for UI (next target is active, or last target if all visited)
        checkpointStates.forEach((state, index) => {
            if (state.visited) {
                state.active = (index === CHECKPOINTS.length - 1 || !checkpointStates[index + 1].visited);
            } else {
                state.active = (index === 0 || checkpointStates[index - 1].visited);
            }
        });
        
        // Update UI
        updateCheckpointUI();
        
        // Update GPS status if element exists
        const gpsStatus = document.getElementById('gps-status');
        if (gpsStatus) {
            gpsStatus.textContent = `GPS: Longitude ${longitude.toFixed(5)} (${checkedCount}/${CHECKPOINTS.length} checked)`;
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
