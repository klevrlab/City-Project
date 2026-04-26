/**
 * Resolves the same Video element the 8th Wall engine uses, so TensorFlow can sample frames
 * without a second getUserMedia call.
 */
(function (global) {
  'use strict';

  var pollTimer = null;
  var tryCount = 0;
  var MAX_TRIES = 60;

  function isUsableVideo(el) {
    return el && el.tagName === 'VIDEO' && el.videoWidth > 0 && el.videoHeight > 0;
  }

  function findVideoInDocument() {
    var list = document.querySelectorAll('video');
    for (var i = 0; i < list.length; i++) {
      if (isUsableVideo(list[i])) return list[i];
    }
    return null;
  }

  function startPolling(onVideo) {
    if (pollTimer) return;
    // Reset between polling sessions so repeated calls to `whenVideoReady()` don't
    // inherit the previous attempt count and immediately hit MAX_TRIES.
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
        if (global.console) console.warn('xr8-shark-video-bridge: no video after polling');
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
    var onVideo = opts.onVideo;
    var delay = opts.delayMs != null ? opts.delayMs : 0;

    function tryOnce() {
      var v = findVideoInDocument();
      if (v) {
        onVideo(v);
        return true;
      }
      return false;
    }

    function run() {
      // Reset attempt counter for each invocation.
      tryCount = 0;
      if (tryOnce()) return;
      installCameraPipelineModule(onVideo);
      if (tryOnce()) return;
      startPolling(function (v) { onVideo(v); });
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
