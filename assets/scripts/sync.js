/**
 * Materio Analytics/Metrics Client v2
 * Handles data collection: Page Views, PDF Reads, Engagement Time
 * Integrates with /collect and /identify endpoints
 * 
 * v2 Fixes:
 *  - Batch timer now actually runs (was a no-op)
 *  - user_id read from materio_user.id (not JWT decode)
 *  - Active reading time (subtracts hidden/background time)
 *  - PDF engagement tracking (scroll, page nav, clicks inside iframe)
 *  - PDF URL validation — no junk data
 *  - Persistent device fingerprint (survives storage clear)
 *  - sendBeacon doesn't clear buffer before confirmation
 */

(function () {
  'use strict';

  // Environment detection
  const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  const API_BASE = isLocal ? 'http://localhost:3000' : 'https://materiosync.vercel.app';

  const CONFIG = {
    DATA_PUSH: `${API_BASE}/sync`,
    DATA_VERIFY: `${API_BASE}/client`,
    BATCH_INTERVAL: 30000,       // Flush every 30 seconds
    MIN_ENGAGEMENT_TIME: 2000,   // 2 seconds minimum to count engagement
    STORAGE_KEY_V1: 'm_v1_store',
    STORAGE_KEY_ID: 'm_u_id',
    STORAGE_KEY_DEVICE: 'm_device_fp',
    STORAGE_KEY_TOKEN: 'materio_auth_token',
    STORAGE_KEY_USER: 'materio_user',
    MAX_BUFFER_SIZE: 50,
    PDF_URL_RETRY_DELAY: 1200,   // ms to wait before retrying PDF URL extraction
    PDF_ENGAGEMENT_THROTTLE: 5000 // Throttle PDF engagement events to one per 5s
  };

  // ─── Device fingerprint (persistent across storage clears) ───
  function generateDeviceFingerprint() {
    try {
      const components = [];

      // Screen dimensions
      components.push(`${screen.width}x${screen.height}x${screen.colorDepth}`);

      // Timezone offset
      components.push(Intl.DateTimeFormat().resolvedOptions().timeZone || String(new Date().getTimezoneOffset()));

      // Language
      components.push(navigator.language || navigator.userLanguage || 'unknown');

      // Platform
      components.push(navigator.platform || 'unknown');

      // Hardware concurrency
      components.push(String(navigator.hardwareConcurrency || 0));

      // Device memory (Chrome only)
      components.push(String(navigator.deviceMemory || 0));

      // Canvas fingerprint
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 200;
        canvas.height = 50;
        const ctx = canvas.getContext('2d');
        ctx.textBaseline = 'top';
        ctx.font = '14px Arial';
        ctx.fillStyle = '#f60';
        ctx.fillRect(0, 0, 200, 50);
        ctx.fillStyle = '#069';
        ctx.fillText('Materio fp 🖥️', 2, 15);
        ctx.fillStyle = 'rgba(102,204,0,0.7)';
        ctx.fillText('Materio fp 🖥️', 4, 17);
        components.push(canvas.toDataURL().slice(-50));
      } catch (e) {
        components.push('no-canvas');
      }

      // WebGL renderer
      try {
        const glCanvas = document.createElement('canvas');
        const gl = glCanvas.getContext('webgl') || glCanvas.getContext('experimental-webgl');
        if (gl) {
          const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
          if (debugInfo) {
            components.push(gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || 'unknown-gl');
          }
        }
      } catch (e) {
        components.push('no-webgl');
      }

      // Touch support
      components.push(String('ontouchstart' in window));

      // Hash all components into a stable fingerprint
      const raw = components.join('|');
      let hash = 0;
      for (let i = 0; i < raw.length; i++) {
        const char = raw.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash |= 0; // to 32bit integer
      }
      // Convert to hex and pad
      return 'dfp_' + (hash >>> 0).toString(16).padStart(8, '0');
    } catch (e) {
      return 'dfp_fallback_' + Date.now().toString(36);
    }
  }

  // ─── Utility: check if a URL looks like a real PDF source ───
  function isValidPdfUrl(url) {
    if (!url || typeof url !== 'string') return false;
    const invalid = ['unknown', 'about:blank', 'null', 'undefined', ''];
    if (invalid.includes(url.toLowerCase())) return false;
    if (url.startsWith('blob:')) return false;
    // Reject bare viewer URLs without a resolved file
    if (url.includes('viewer.html') && !url.includes('.pdf')) return false;
    return true;
  }

  class MetricsClient {
    constructor() {
      this.buffer = [];
      this.sessionId = sessionStorage.getItem('materio_session_id') || this._uuid();
      sessionStorage.setItem('materio_session_id', this.sessionId);
      this.anonymousId = this._getAnonymousId();
      this.deviceFingerprint = this._getDeviceFingerprint();
      this.isTrackingEngagement = false;
      this.engagementStartTime = Date.now();
      this.pdfStartTime = null;
      this.pdfActiveTime = 0;        // Tracks only active (visible) time during PDF read
      this.pdfWasHiddenAt = null;     // Timestamp when tab became hidden during PDF read
      this.currentPdf = null;
      this.currentPdfTitle = null;
      this.hasIdentified = false;
      this.pendingPdfTitle = null;
      this._batchTimerRef = null;
      this._lastPdfEngagementAt = 0;  // Throttle PDF engagement events

      // Initial setup
      this._loadBuffer();
      this._setupEventListeners();
      this._startBatchTimer();

      // Track initial page view
      this.push('page_view', {
        title: document.title,
        path: window.location.pathname,
        deviceFingerprint: this.deviceFingerprint
      });

      // Attempt user verification
      this._verify();
    }

    // ─── Identity ───

    _uuid() {
      if (crypto && crypto.randomUUID) return crypto.randomUUID();
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0;
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
      });
    }

    _getAnonymousId() {
      let id = localStorage.getItem(CONFIG.STORAGE_KEY_ID);
      if (!id) {
        id = this._uuid();
        localStorage.setItem(CONFIG.STORAGE_KEY_ID, id);
      }
      return id;
    }

    _getDeviceFingerprint() {
      let fp = localStorage.getItem(CONFIG.STORAGE_KEY_DEVICE);
      if (!fp) {
        fp = generateDeviceFingerprint();
        localStorage.setItem(CONFIG.STORAGE_KEY_DEVICE, fp);
      }
      return fp;
    }

    /**
     * Get user_id from materio_user in localStorage (primary)
     * Falls back to JWT decode only as a last resort
     */
    getUserId() {
      // 1. Primary: materio_user localStorage object → .id
      try {
        const userStr = localStorage.getItem(CONFIG.STORAGE_KEY_USER);
        if (userStr) {
          const user = JSON.parse(userStr);
          if (user && user.id) return user.id;
          // fallback field names
          if (user && (user.userId || user.user_id)) return user.userId || user.user_id;
        }
      } catch (e) { /* ignore parse errors */ }

      // 2. Fallback: decode JWT token
      try {
        const token = localStorage.getItem(CONFIG.STORAGE_KEY_TOKEN);
        if (!token) return null;
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(
          window.atob(base64).split('').map(c =>
            '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
          ).join('')
        );
        const payload = JSON.parse(jsonPayload);
        return payload.sub || payload.id || payload.user_id || payload.uid;
      } catch (e) {
        return null;
      }
    }

    // ─── Server Communication ───

    async _verify() {
      const userId = this.getUserId();
      if (userId && !this.hasIdentified) {
        try {
          const response = await fetch(CONFIG.DATA_VERIFY, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: userId,
              anonymousId: this.anonymousId,
              deviceFingerprint: this.deviceFingerprint
            })
          });
          if (response.ok) {
            this.hasIdentified = true;
            this._syncStats(userId);
          }
        } catch (e) { /* silent */ }
      }
    }

    async _syncStats(userId) {
      try {
        const response = await fetch(`${API_BASE}/stats/${userId}?period=all_time`);
        if (response.ok) {
          const data = await response.json();
          const stats = {
            pdfsRead: data.metrics.unique_pdfs_count || 0,
            timeSpent: (data.metrics.reading_time_seconds || 0) + (data.metrics.engagement_time_seconds || 0),
            streak: data.streak || 0,
            trends: data.trends || {},
            history: data.history || [],
            lastReadDate: null
          };
          if (stats.history.length > 0) {
            stats.lastReadDate = stats.history[0].date.split('T')[0];
          }
          localStorage.setItem('materio_user_stats', JSON.stringify(stats));
          window.dispatchEvent(new CustomEvent('materio-stats-updated', { detail: stats }));
        }
      } catch (e) { /* silent */ }
    }

    // ─── Event Buffer ───

    push(eventName, properties = {}) {
      const event = {
        type: eventName,
        data: properties,
        timestamp: new Date().toISOString(),
        sessionId: this.sessionId,
        url: window.location.href,
        referrer: document.referrer,
        deviceFingerprint: this.deviceFingerprint
      };

      this.buffer.push(event);
      this._saveBuffer();

      if (this.buffer.length >= CONFIG.MAX_BUFFER_SIZE) {
        this.flush();
      }
    }

    _loadBuffer() {
      try {
        const stored = localStorage.getItem(CONFIG.STORAGE_KEY_V1);
        if (stored) {
          this.buffer = JSON.parse(stored);
        }
      } catch (e) {
        this.buffer = [];
      }
    }

    _saveBuffer() {
      try {
        localStorage.setItem(CONFIG.STORAGE_KEY_V1, JSON.stringify(this.buffer));
      } catch (e) { /* storage full — will flush on next cycle */ }
    }

    async flush() {
      if (this.buffer.length === 0) return;

      const eventsToSend = [...this.buffer];

      // Build payload
      const payload = {
        anonymousId: this.anonymousId,
        userId: this.getUserId(),
        deviceFingerprint: this.deviceFingerprint,
        events: eventsToSend
      };

      // For background/hidden state, use sendBeacon (fire-and-forget)
      if (navigator.sendBeacon && document.visibilityState === 'hidden') {
        const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
        const sent = navigator.sendBeacon(CONFIG.DATA_PUSH, blob);
        if (sent) {
          // Only clear buffer after successful sendBeacon enqueue
          this.buffer = [];
          this._saveBuffer();
        }
        // If sendBeacon returns false, keep events in buffer for next attempt
        return;
      }

      // For foreground, use fetch with error recovery
      try {
        const response = await fetch(CONFIG.DATA_PUSH, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (response.ok || response.status === 207) {
          // Clear only the events we successfully sent
          this.buffer = this.buffer.slice(eventsToSend.length);
          this._saveBuffer();
        } else {
          throw new Error(`HTTP ${response.status}`);
        }
      } catch (e) {
        // Keep events in buffer — they'll be retried on next flush
        // No need to re-add since we never cleared them
      }
    }

    // ─── Batch Timer (FIXED — was a no-op) ───

    _startBatchTimer() {
      if (this._batchTimerRef) clearInterval(this._batchTimerRef);
      this._batchTimerRef = setInterval(() => {
        this.flush();
      }, CONFIG.BATCH_INTERVAL);
    }

    // ─── Event Listeners ───

    _setupEventListeners() {
      // Visibility change — track engagement + flush + manage PDF active time
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
          this._stopEngagement();
          this._handlePdfHidden();
          this.flush();
        } else {
          this._startEngagement();
          this._handlePdfVisible();
        }
      });

      // Before unload — final flush
      window.addEventListener('beforeunload', () => {
        this._stopEngagement();
        if (this.currentPdf) {
          this._closePdfSession();
        }
        this.flush();
      });

      // PDF tracking
      this._setupPdfTracking();

      // Dropdown selection capture
      const submitBtn = document.getElementById('submitButton');
      if (submitBtn) {
        submitBtn.addEventListener('click', () => {
          this._captureDropdownSelection();
        });
      }

      // Listen for login events to re-identify
      window.addEventListener('storage', (e) => {
        if (e.key === CONFIG.STORAGE_KEY_USER && e.newValue) {
          this.hasIdentified = false;
          this._verify();
        }
      });

      // Listen for PDF engagement messages from iframe
      window.addEventListener('message', (event) => {
        if (event.origin !== window.location.origin) return;
        this._handlePdfIframeMessage(event.data);
      });
    }

    // ─── Page Engagement ───

    _startEngagement() {
      this.engagementStartTime = Date.now();
    }

    _stopEngagement() {
      const timeSpent = Date.now() - this.engagementStartTime;
      if (timeSpent >= CONFIG.MIN_ENGAGEMENT_TIME) {
        this.push('user_engagement', {
          duration_ms: timeSpent,
          duration_sec: Math.round(timeSpent / 1000)
        });
      }
    }

    // ─── PDF Active Time Tracking ───

    _handlePdfHidden() {
      if (this.currentPdf && !this.pdfWasHiddenAt) {
        // Tab went hidden during PDF read — pause active time
        this.pdfWasHiddenAt = Date.now();
      }
    }

    _handlePdfVisible() {
      if (this.currentPdf && this.pdfWasHiddenAt) {
        // Tab came back — accumulate the visible time from BEFORE hiding
        // into pdfActiveTime, then start a new visible segment
        this.pdfActiveTime += (this.pdfWasHiddenAt - this.pdfStartTime);
        this.pdfWasHiddenAt = null;
        // Reset the start for the NEW visible segment
        this.pdfStartTime = Date.now();
      }
    }

    _getCurrentPdfActiveTime() {
      if (!this.pdfStartTime) return this.pdfActiveTime;
      const now = Date.now();
      if (this.pdfWasHiddenAt) {
        // Currently hidden — only count up to when we went hidden
        return this.pdfActiveTime + (this.pdfWasHiddenAt - this.pdfStartTime);
      }
      // Currently visible — count up to now
      return this.pdfActiveTime + (now - this.pdfStartTime);
    }

    // ─── PDF Tracking ───

    _captureDropdownSelection() {
      try {
        const subject = document.getElementById('subjectSelect');
        const topic = document.getElementById('topicSelect');
        const category = document.getElementById('categorySelect');

        let name = '';

        if (topic && topic.selectedIndex >= 0) {
          name = topic.options[topic.selectedIndex].text;
          if (name === 'Select Topic') name = '';
        }

        if (!name && category && category.selectedIndex >= 0) {
          name = category.options[category.selectedIndex].text;
          if (name === 'Select Category') name = '';
        }

        if (subject && subject.selectedIndex >= 0) {
          const subName = subject.options[subject.selectedIndex].text;
          if (subName !== 'Select Subject') {
            this.pendingPdfTitle = name ? `${subName} - ${name}` : subName;
          } else {
            this.pendingPdfTitle = name || 'Unknown Document';
          }
        } else {
          this.pendingPdfTitle = name || 'Unknown Document';
        }
      } catch (e) {
        console.warn('Error capturing dropdown selection:', e);
      }
    }

    _setupPdfTracking() {
      const popup = document.getElementById('popup');
      const popupContent = document.getElementById('popupContent');

      if (!popup) return;

      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
            const isVisible = popup.style.display !== 'none' && popup.style.display !== '';

            if (isVisible && !this.currentPdf) {
              this._captureDropdownSelection();
              this._handlePdfOpen(popupContent);
            } else if (!isVisible && this.currentPdf) {
              this._handlePdfClose();
            }
          }
        });
      });

      observer.observe(popup, { attributes: true });
    }

    _extractPdfUrl(container) {
      const iframe = container.querySelector('iframe');
      let extractedUrl = null;

      if (iframe) {
        try {
          if (iframe.src && (iframe.src.includes('viewer.html') || iframe.src.includes('oread/web/viewer.html'))) {
            const src = new URL(iframe.src, window.location.origin);
            const fileParam = src.searchParams.get('file');
            if (fileParam) {
              extractedUrl = decodeURIComponent(fileParam);
            }
          }
          if (!extractedUrl && iframe.src && !iframe.src.includes('viewer.html')) {
            extractedUrl = iframe.src;
          }
        } catch (e) {
          if (iframe.src) extractedUrl = iframe.src;
        }

        // Try data attributes if URL is still missing
        if (!isValidPdfUrl(extractedUrl)) {
          const attrUrl = iframe.getAttribute('data-src') || iframe.getAttribute('data-file-url');
          if (attrUrl && isValidPdfUrl(attrUrl)) extractedUrl = attrUrl;
        }
      }

      // Try container attributes
      if (!isValidPdfUrl(extractedUrl)) {
        const containerUrl = container.getAttribute('data-pdf-url') || container.getAttribute('data-filename');
        if (containerUrl) extractedUrl = containerUrl;
      }

      // Try global current PDF URL (from caching.js)
      if (!isValidPdfUrl(extractedUrl) && window.materioCurrentPdfUrl) {
        extractedUrl = window.materioCurrentPdfUrl;
      }

      return extractedUrl;
    }

    _handlePdfOpen(container) {
      const title = this.pendingPdfTitle || 'Unknown PDF';

      // Attempt 1: immediate extraction
      let pdfUrl = this._extractPdfUrl(container);

      if (isValidPdfUrl(pdfUrl)) {
        this._startPdfSession(pdfUrl, title);
        return;
      }

      // Attempt 2: delayed extraction (iframe may not be loaded yet)
      setTimeout(() => {
        pdfUrl = this._extractPdfUrl(container);

        // Attempt 3: check global variable from caching.js
        if (!isValidPdfUrl(pdfUrl) && window.materioCurrentPdfUrl) {
          pdfUrl = window.materioCurrentPdfUrl;
        }

        // Attempt 4: use title as identifier (last resort, but at least it's real)
        if (!isValidPdfUrl(pdfUrl) && this.pendingPdfTitle && this.pendingPdfTitle !== 'Unknown Document') {
          pdfUrl = `title:${this.pendingPdfTitle}`;
        }

        if (isValidPdfUrl(pdfUrl) || (pdfUrl && pdfUrl.startsWith('title:'))) {
          this._startPdfSession(pdfUrl, title);
        }
        // If still no valid URL, silently skip — don't pollute the DB with junk
      }, CONFIG.PDF_URL_RETRY_DELAY);
    }

    _startPdfSession(pdfUrl, title) {
      this.currentPdf = pdfUrl;
      this.currentPdfTitle = title;
      this.pdfStartTime = Date.now();
      this.pdfActiveTime = 0;
      this.pdfWasHiddenAt = null;
      this._lastPdfEngagementAt = 0;

      this.push('pdf_open', {
        url: pdfUrl,
        title: title,
        deviceFingerprint: this.deviceFingerprint
      });
    }

    _handlePdfClose() {
      if (!this.currentPdf) return;
      this._closePdfSession();
    }

    _closePdfSession() {
      if (!this.currentPdf) return;

      const activeDuration = this._getCurrentPdfActiveTime();

      this.push('pdf_close', {
        url: this.currentPdf,
        title: this.currentPdfTitle,
        duration_ms: activeDuration,
        duration_sec: Math.round(activeDuration / 1000),
        deviceFingerprint: this.deviceFingerprint
      });

      this.currentPdf = null;
      this.currentPdfTitle = null;
      this.pdfStartTime = null;
      this.pdfActiveTime = 0;
      this.pdfWasHiddenAt = null;
    }

    // ─── PDF Engagement from Iframe ───

    _handlePdfIframeMessage(data) {
      if (!data || !data.type) return;
      if (!this.currentPdf) return;

      const now = Date.now();

      // Throttle engagement events
      const shouldThrottle = (now - this._lastPdfEngagementAt) < CONFIG.PDF_ENGAGEMENT_THROTTLE;

      switch (data.type) {
        case 'pdfPageChanged':
        case 'pagechanging':
          // Page navigation — always track (not throttled)
          this.push('pdf_page_nav', {
            url: this.currentPdf,
            page: data.pageNumber || data.page || null,
            totalPages: data.pagesCount || data.totalPages || null
          });
          this._lastPdfEngagementAt = now;
          break;

        case 'pdfScroll':
        case 'scroll':
          if (!shouldThrottle) {
            this.push('pdf_scroll', {
              url: this.currentPdf,
              scrollPosition: data.scrollTop || data.position || null
            });
            this._lastPdfEngagementAt = now;
          }
          break;

        case 'pdfTextSelected':
        case 'textlayerrendered':
          if (!shouldThrottle) {
            this.push('pdf_interaction', {
              url: this.currentPdf,
              action: 'text_select'
            });
            this._lastPdfEngagementAt = now;
          }
          break;

        case 'pdfZoom':
        case 'scalechanging':
          this.push('pdf_interaction', {
            url: this.currentPdf,
            action: 'zoom',
            scale: data.scale || data.value || null
          });
          this._lastPdfEngagementAt = now;
          break;

        case 'pdfSearch':
        case 'find':
          this.push('pdf_interaction', {
            url: this.currentPdf,
            action: 'search'
          });
          this._lastPdfEngagementAt = now;
          break;
      }
    }
  }

  window.MetricsClient = new MetricsClient();
  window.SyncManager = window.MetricsClient;

  // Backward-compat: main.js share feature references window.pdfAnalytics.currentPdf
  Object.defineProperty(window, 'pdfAnalytics', {
    get() { return window.MetricsClient; },
    configurable: true
  });
})();
