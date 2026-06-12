/**
 * Materio Tauri bridge — bundled UI, remote Vercel APIs.
 * Loaded on Jekyll `JEKYLL_ENV=tauri` builds (see _config.tauri.yml).
 */
(function (global) {
  'use strict';

  var config = global.MATERIO_CONFIG || {};
  var apiOrigin = (config.API_ORIGIN || '').replace(/\/$/, '');

  if (!apiOrigin) {
    return;
  }

  global.MATERIO_CONFIG = Object.assign(config, {
    IS_TAURI_APP: true,
    API_ORIGIN: apiOrigin
  });

  if (global.document && global.document.documentElement) {
    global.document.documentElement.setAttribute('data-materio-tauri', 'true');
  }

  function resolveApiUrl(url) {
    if (typeof url !== 'string') {
      return url;
    }
    if (url.indexOf('/api/') === 0) {
      return apiOrigin + url;
    }
    return url;
  }

  function patchFetch() {
    if (!global.fetch || global.fetch.__materioTauriPatched) {
      return;
    }
    var nativeFetch = global.fetch.bind(global);
    global.fetch = function (input, init) {
      if (typeof input === 'string') {
        return nativeFetch(resolveApiUrl(input), init);
      }
      if (input && typeof input.url === 'string' && input.url.indexOf('/api/') === 0) {
        return nativeFetch(resolveApiUrl(input.url), init);
      }
      return nativeFetch(input, init);
    };
    global.fetch.__materioTauriPatched = true;
  }

  function patchXHR() {
    if (!global.XMLHttpRequest) {
      return;
    }
    var open = global.XMLHttpRequest.prototype.open;
    global.XMLHttpRequest.prototype.open = function (method, url) {
      var args = Array.prototype.slice.call(arguments);
      args[1] = resolveApiUrl(String(url));
      return open.apply(this, args);
    };
  }

  global.materioApiUrl = resolveApiUrl;
  patchFetch();
  patchXHR();
})(typeof window !== 'undefined' ? window : globalThis);
