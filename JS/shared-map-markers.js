// Shared Map Markers - Adds user position and checkpoint markers to Leaflet maps
// This file provides consistent map visualization across all pages

(function() {
    'use strict';

    let checkpointMarkers = [];
    let checkpointsData = [];

    // Load checkpoint data from JSON
    async function loadCheckpointData() {
        try {
            const response = await fetch('./data/shark-locations.json');
            const data = await response.json();
            if (data.sharks && data.sharks.length > 0) {
                checkpointsData = data.sharks;
                console.log('[Map] Loaded', checkpointsData.length, 'checkpoints');
            }
        } catch (error) {
            console.error('[Map] Error loading checkpoint data:', error);
        }
    }

    // Calculate distance between two coordinates (Haversine formula)
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

    // Update map with user position and checkpoint markers
    window.updateMapMarkers = function(map, userLat, userLng, userMarker, isExpanded = false) {
        if (!map || !userLat || !userLng) return userMarker;

        // Update or create user marker
        const userSize = isExpanded ? 32 : 20;
        const fontSize = isExpanded ? 15 : 11;
        
        const userIcon = L.divIcon({
            className: 'custom-marker',
            html: `<div style="background: #00A9E0; width: ${userSize}px; height: ${userSize}px; border-radius: 50%; border: 2px solid white; box-shadow: 0 3px 10px rgba(0,169,224,0.5); display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: ${fontSize}px;">U</div>`,
            iconSize: [userSize, userSize],
            iconAnchor: [userSize / 2, userSize / 2]
        });

        if (userMarker) {
            userMarker.setLatLng([userLat, userLng]);
            userMarker.setIcon(userIcon);
        } else {
            userMarker = L.marker([userLat, userLng], { icon: userIcon })
                .addTo(map)
                .bindPopup('Your Location');
        }

        // Remove old checkpoint markers
        checkpointMarkers.forEach(marker => map.removeLayer(marker));
        checkpointMarkers = [];

        // Add checkpoint markers if data is loaded
        if (checkpointsData.length > 0) {
            // Find closest checkpoint
            let closestIndex = -1;
            let minDistance = Infinity;
            
            checkpointsData.forEach((checkpoint, index) => {
                const dist = calculateDistance(userLat, userLng, checkpoint.latitude, checkpoint.longitude);
                if (dist < minDistance) {
                    minDistance = dist;
                    closestIndex = index;
                }
            });

            const checkpointSize = isExpanded ? 38 : 24;
            const checkpointFontSize = isExpanded ? 15 : 11;

            checkpointsData.forEach((checkpoint, index) => {
                // Get checkpoint element to check visited state
                const checkpointEl = document.getElementById('checkpoint-' + String.fromCharCode(97 + index));
                const isVisited = checkpointEl ? checkpointEl.classList.contains('visited') : false;
                const isActive = checkpointEl ? checkpointEl.classList.contains('active') : false;
                const isClosest = index === closestIndex;

                // Color scheme: Visited = Green, Active/Closest = Orange, Others = Gray
                let color, opacity, borderColor;
                if (isVisited) {
                    color = '#00D084'; // Green
                    opacity = 0.9;
                    borderColor = 'white';
                } else if (isActive || isClosest) {
                    color = '#F4901E'; // Orange
                    opacity = 1;
                    borderColor = 'white';
                } else {
                    color = '#9E9E9E'; // Gray
                    opacity = 0.6;
                    borderColor = 'rgba(255,255,255,0.5)';
                }

                const checkpointIcon = L.divIcon({
                    className: 'custom-marker',
                    html: `<div style="background: ${color}; width: ${checkpointSize}px; height: ${checkpointSize}px; border-radius: 50%; border: 2px solid ${borderColor}; box-shadow: 0 3px 10px rgba(0,0,0,${opacity * 0.4}); display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: ${checkpointFontSize}px; opacity: ${opacity};">${index + 1}</div>`,
                    iconSize: [checkpointSize, checkpointSize],
                    iconAnchor: [checkpointSize / 2, checkpointSize / 2]
                });

                const marker = L.marker([checkpoint.latitude, checkpoint.longitude], { icon: checkpointIcon })
                    .addTo(map)
                    .bindPopup(`<strong>${checkpoint.title}</strong><br>${checkpoint.description}${isClosest ? '<br><em>Closest to you!</em>' : ''}`);

                checkpointMarkers.push(marker);
            });
        }

        return userMarker;
    };

    // Initialize - load checkpoint data when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', loadCheckpointData);
    } else {
        loadCheckpointData();
    }
})();
