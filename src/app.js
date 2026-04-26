/**
 * 8th Wall Application Entry Point
 * 
 * This file registers all A-Frame components, systems, and initializes
 * the shared logic for the immersive experience.
 */

// 1. Utilities and Core ML Logic
// (In a bundled environment, these would be imports)
// src/utils/audio-utils.js
// src/utils/math-utils.js
// src/utils/shark-embedding-detector.js
// src/utils/xr8-shark-video-bridge.js
// src/utils/xr8-scene-bootstrap.js

// 2. A-Frame Systems
// src/systems/event-system.js

// 3. A-Frame Components
// src/components/shark-detector.js
// src/components/tour-ui.js

(function(global) {
  'use strict';

  console.log('🦈 Sharks Way AR initialized');

  /**
   * Global configuration and state management could live here
   * following the 8th Wall App pattern.
   */
  global.App = {
    version: '2.0.0',
    init: function() {
      // Any additional bootstrap logic if needed beyond A-Frame registration
    }
  };

})(typeof window !== 'undefined' ? window : globalThis);
