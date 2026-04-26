/**
 * Shared math utilities for the 8th Wall project.
 */
(function (global) {
  'use strict';

  /**
   * Calculates the distance between two points in meters using the Haversine formula.
   */
  function haversineMeters(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // Earth's radius in meters
    const p1 = lat1 * Math.PI / 180;
    const p2 = lat2 * Math.PI / 180;
    const dq = (lat2 - lat1) * Math.PI / 180;
    const dl = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dq / 2) * Math.sin(dq / 2) +
      Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) * Math.sin(dl / 2);
    return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  global.MathUtils = {
    haversineMeters: haversineMeters
  };
})(typeof window !== 'undefined' ? window : globalThis);
