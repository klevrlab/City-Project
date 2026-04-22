/**
 * Shared 8th Wall / A-Frame scene bootstrap.
 *
 * Centralises the "attach XR components after `xrloaded`" flow so every page
 * uses the same (correct) ordering and surfaces the underlying error when
 * `xr.js` throws "No valid session manager to handle this session."
 *
 * Ordering matters on iOS Safari:
 *   1. Install a diagnostic camera pipeline module so we capture the *real*
 *      underlying exception (otherwise XR8 swallows per-manager failures and
 *      only throws a generic "No valid session manager" at the end).
 *   2. Attach `xrextras-loading` / `xrextras-runtime-error` *before* `xrweb`.
 *      `xrextras-loading` draws the "Tap to Start" screen, which is where iOS
 *      pumps the DeviceMotion/camera permission prompts via a user gesture.
 *      If `xrweb` wins the race, the session starts with no permissions and
 *      every session manager rejects silently.
 *   3. Attach `xrweb` + `xrconfig` last.
 */
(function (global) {
  'use strict';

  function showBanner(banner, html) {
    if (!banner) return;
    banner.style.display = 'block';
    banner.innerHTML = html;
  }

  function installDiagnosticsModule(onUnderlyingError) {
    if (!global.XR8 || typeof global.XR8.addCameraPipelineModule !== 'function') return;
    try {
      global.XR8.addCameraPipelineModule({
        name: 'scene-bootstrap-diagnostics',
        // XR8 calls this with the underlying error when a session manager / module fails.
        onException: function (err) {
          if (global.console) global.console.error('[XR8 onException]', err);
          if (typeof onUnderlyingError === 'function') {
            onUnderlyingError(err);
          }
        }
      });
    } catch (e) {
      if (global.console) global.console.warn('scene-bootstrap: addCameraPipelineModule failed', e);
    }
  }

  /**
   * @param {object} opts
   * @param {HTMLElement} opts.scene            - the <a-scene> element
   * @param {HTMLElement} [opts.banner]         - optional error banner element
   * @param {function} [opts.onReady]           - called once (after scene `loaded`) or as fallback
   * @param {function} [opts.onFatalError]      - called with the last error surfaced to the banner
   * @param {number}   [opts.engineTimeoutMs]   - how long to wait for `xrloaded` before showing banner
   */
  function startXrScene(opts) {
    opts = opts || {};
    var scene = opts.scene;
    var banner = opts.banner;
    var onReady = typeof opts.onReady === 'function' ? opts.onReady : function () { };
    var onFatalError = typeof opts.onFatalError === 'function' ? opts.onFatalError : function () { };
    var engineTimeoutMs = opts.engineTimeoutMs != null ? opts.engineTimeoutMs : 8000;

    var readyFired = false;
    function fireReadyOnce() {
      if (readyFired) return;
      readyFired = true;
      try { onReady(); } catch (e) { if (global.console) global.console.error(e); }
    }

    var lastUnderlyingError = null;
    function recordUnderlyingError(err) { lastUnderlyingError = err; }

    function formatError(err) {
      if (!err) return 'The engine could not start a session.';
      if (err.message) return String(err.message);
      try { return JSON.stringify(err); } catch (e) { return String(err); }
    }

    function showXrError(err) {
      if (global.console) global.console.error(err);
      // Prefer the underlying cause we captured via onException, since the top-level
      // error from xr.js is the generic "No valid session manager ..." wrapper.
      var shown = lastUnderlyingError || err;
      showBanner(banner, [
        '<div><strong>XR initialization failed.</strong></div>',
        '<div style="margin-top:6px;opacity:0.9;">' + formatError(shown) + '</div>',
        '<div style="margin-top:6px;opacity:0.8;">',
        'Check <code>/debug-8thwall.html</code> for a file-level sanity check,',
        ' and confirm camera / motion permissions are allowed for this site.',
        '</div>'
      ].join(''));
      onFatalError(shown);
      fireReadyOnce();
    }

    function attachComponents() {
      if (!scene) { fireReadyOnce(); return; }

      // Hide any previous banner; it'll be re-shown only on failure.
      if (banner) banner.style.display = 'none';

      // Diagnostics first so we capture the underlying per-manager error.
      installDiagnosticsModule(recordUnderlyingError);

      try {
        // xrextras *before* xrweb: loading UI must exist so iOS shows the
        // "Tap to Start" gesture that grants motion + camera permission.
        scene.setAttribute('xrextras-loading', '');
        scene.setAttribute('xrextras-runtime-error', '');
        scene.setAttribute('xrextras-tap-recenter', '');

        // World tracking last. `xrconfig` is optional metadata, but xrweb needs <a-camera>.
        scene.setAttribute('xrconfig', '');
        scene.setAttribute('xrweb', '');
      } catch (e) {
        showXrError(e);
        return;
      }

      // If xrweb itself throws during init, we hear about it via the scene's
      // runtime-error event OR the diagnostics module. Surface either path.
      scene.addEventListener('loaded', fireReadyOnce, { once: true });

      // Safety net: if `loaded` doesn't fire within a while, still hand off.
      setTimeout(fireReadyOnce, 15000);
    }

    if (global.XR8) {
      attachComponents();
      return;
    }

    var timeoutId = setTimeout(function () {
      if (!global.XR8) {
        showBanner(banner, [
          '<div><strong>8th Wall engine not found.</strong></div>',
          '<div style="margin-top:6px;">',
          'Add <code>external/xr/xr.js</code> from ',
          '<a href="https://8th.io/xrjs" target="_blank" rel="noreferrer">xr-standalone.zip</a>, then refresh.',
          '</div>'
        ].join(''));
        fireReadyOnce();
      }
    }, engineTimeoutMs);

    global.addEventListener('xrloaded', function () {
      clearTimeout(timeoutId);
      attachComponents();
    }, { once: true });

    // If xrweb/xrextras throws at runtime we'll also hear about it here.
    global.addEventListener('xrextrasruntimeerror', function (e) {
      showXrError(e && e.detail ? e.detail : new Error('Runtime error from xrextras'));
    });
  }

  global.XR8SceneBootstrap = {
    start: startXrScene
  };
})(typeof window !== 'undefined' ? window : globalThis);
