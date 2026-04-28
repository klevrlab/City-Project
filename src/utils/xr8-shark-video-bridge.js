/**
 * Resolves the same Video element the 8th Wall engine uses, so TensorFlow can sample frames
 * without a second getUserMedia call.
 */
(function (global) {
  'use strict';

  var pollTimer = null;
  var tryCount = 0;
  var MAX_TRIES = 80; // Increased patience for slower devices

  function isUsableVideo(el) {
    // A usable video must have dimensions and be actively receiving a stream
    return el && 
           el.tagName === 'VIDEO' && 
           el.videoWidth > 0 && 
           el.videoHeight > 0 && 
           (el.srcObject || el.src);
  }

  function findVideoInDocument() {
    // 1. Prefer the standard 8th Wall video ID
    var xrVideo = document.getElementById('xr-video');
    if (isUsableVideo(xrVideo)) return xrVideo;

    // 2. Look for any video with a srcObject (likely a camera stream)
    var list = document.querySelectorAll('video');
    for (var i = 0; i < list.length; i++) {
      if (list[i].srcObject && isUsableVideo(list[i])) return list[i];
    }

    // 3. Fallback to any usable video
    for (var i = 0; i < list.length; i++) {
      if (isUsableVideo(list[i])) return list[i];
    }
    return null;
  }

  function startPolling(onVideo) {
    if (pollTimer) return;
    tryCount = 0;
    pollTimer = setInterval(function () {
      var v = findVideoInDocument();
      if (v) {
        clearInterval(pollTimer);
        pollTimer = null;
        onVideo(v);
        return;
      }
      tryCount++;
      if (tryCount >= MAX_TRIES) {
        clearInterval(pollTimer);
        pollTimer = null;
        if (global.console) {
          console.warn('xr8-shark-video-bridge: no video after polling (' + MAX_TRIES + ' tries)');
          console.info('Check if 8th Wall session started and camera permissions were granted.');
        }
      }
    }, 250);
  }

  function pickVideoFromEvent(e) {
    if (!e) return null;
    if (e.tagName === 'VIDEO') return e;
    if (e.video && e.video.tagName === 'VIDEO') return e.video;
    if (e.el && e.el.tagName === 'VIDEO') return e.el;
    if (e.stream && e.video) return e.video;
    return null;
  }

  function installCameraPipelineModule(onVideo) {
    if (!global.XR8 || typeof global.XR8.addCameraPipelineModule !== 'function') return;
    try {
      global.XR8.addCameraPipelineModule({
        name: 'sharks-way-tf-sampler',
        onAttach: function (e) {
          var v = pickVideoFromEvent(e);
          if (isUsableVideo(v)) onVideo(v);
        },
        onStart: function (e) {
          var v = pickVideoFromEvent(e);
          if (isUsableVideo(v)) onVideo(v);
        }
      });
    } catch (err) {
      if (global.console) global.console.warn('xr8-shark-video-bridge: addCameraPipelineModule', err);
    }
  }

  /**
   * @param {{ onVideo: function(HTMLVideoElement): void, delayMs?: number }} opts
   */
  function whenVideoReady(opts) {
    var originalOnVideo = opts.onVideo;
    var delay = opts.delayMs != null ? opts.delayMs : 0;
    var called = false;

    // Ensure we only call the callback once, even if multiple detection methods succeed
    function onVideo(v) {
      if (called) return;
      called = true;
      if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
      originalOnVideo(v);
    }

    function tryOnce() {
      var v = findVideoInDocument();
      if (v) {
        onVideo(v);
        return true;
      }
      return false;
    }

    function run() {
      tryCount = 0;
      if (tryOnce()) return;
      installCameraPipelineModule(onVideo);
      if (tryOnce()) return;
      startPolling(onVideo);
    }

    if (global.XR8) {
      if (delay > 0) {
        setTimeout(run, delay);
      } else {
        run();
      }
      return;
    }

    global.addEventListener('xrloaded', function () {
      setTimeout(run, delay || 0);
    }, { once: true });
  }

  global.SharkXR8VideoBridge = {
    whenVideoReady: whenVideoReady
  };
})(typeof window !== 'undefined' ? window : globalThis);
