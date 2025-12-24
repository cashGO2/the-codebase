/**
 * Materio Analytics/Metrics Client
 * Handles data collection: Page Views, PDF Reads, Engagement Time
 * Integrates with /collect and /identify endpoints
 */

(function () {
  'use strict';

  // Environment detection
  const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  const API_BASE = isLocal ? 'http://localhost:3000' : 'https://materio-analytics.vercel.app';

  const CONFIG = {
    API_COLLECT: `${API_BASE}/collect`,
    API_IDENTIFY: `${API_BASE}/identify`,
    BATCH_INTERVAL: 30000, // 30 seconds
    MIN_ENGAGEMENT_TIME: 2000, // 2 seconds
    STORAGE_KEY_EVENTS: 'materio_analytics_events',
    STORAGE_KEY_ANON_ID: 'materio_anonymous_id',
    STORAGE_KEY_AUTH_TOKEN: 'materio_auth_token'
  };

  class MetricsClient {
    constructor() {
      this.buffer = [];
      this.sessionId = this.generateUUID();
      this.anonymousId = this.getAnonymousId();
      this.isTrackingEngagement = false;
      this.engagementStartTime = Date.now();
      this.pdfStartTime = null;
      this.currentPdf = null;
      this.hasIdentified = false;

      // Initial setup
      this.loadBuffer();
      this.setupEventListeners();
      this.startBatchTimer();

      // Track initial page view
      this.track('page_view', {
        title: document.title,
        path: window.location.pathname
      });

      // Attempt identification if user is logged in
      this.identify();

      console.log(`[Metrics] Initialized (${isLocal ? 'Local' : 'Prod'})`);
    }

    generateUUID() {
      if (crypto && crypto.randomUUID) {
        return crypto.randomUUID();
      }
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      });
    }

    getAnonymousId() {
      let id = localStorage.getItem(CONFIG.STORAGE_KEY_ANON_ID);
      if (!id) {
        id = this.generateUUID();
        localStorage.setItem(CONFIG.STORAGE_KEY_ANON_ID, id);
      }
      return id;
    }

    getUserId() {
      const token = localStorage.getItem(CONFIG.STORAGE_KEY_AUTH_TOKEN);
      if (!token) return null;

      try {
        // Decode JWT to get user ID
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(window.atob(base64).split('').map(function (c) {
          return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));

        const payload = JSON.parse(jsonPayload);
        // Adjust property based on your JWT structure (usually 'sub', 'id', or 'user_id')
        return payload.sub || payload.id || payload.user_id || payload.uid;
      } catch (e) {
        // console.warn('[Metrics] Failed to decode auth token', e);
        return null;
      }
    }

    // Identify user and bind anonymous history
    async identify() {
      const userId = this.getUserId();
      if (userId && !this.hasIdentified) {
        try {
          // Send identification request
          // We don't batch this, we send it immediately to ensure binding happens
          const response = await fetch(CONFIG.API_IDENTIFY, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: userId,
              anonymousId: this.anonymousId
            })
          });

          if (response.ok) {
            this.hasIdentified = true;
            // console.log('[Metrics] Identified user:', userId);

            // Sync stats from server
            this.syncStats(userId);
          }
        } catch (e) {
          console.error('[Metrics] Identify failed', e);
        }
      }
    }

    async syncStats(userId) {
      try {
        const response = await fetch(`${API_BASE}/stats/${userId}?period=all_time`);

        if (response.ok) {
          const data = await response.json();

          const stats = {
            pdfsRead: data.metrics.pdfs_read_count || 0,
            timeSpent: (data.metrics.reading_time_seconds || 0) + (data.metrics.engagement_time_seconds || 0),
            streak: data.streak || 0,
            history: data.history || [],
            lastReadDate: null
          };

          if (stats.history.length > 0) {
            stats.lastReadDate = stats.history[0].date.split('T')[0];
          }

          localStorage.setItem('materio_user_stats', JSON.stringify(stats));
          console.log(`[Metrics] Stats synced. User: ${userId}. History: ${stats.history.length}. PDFs: ${stats.pdfsRead}`);

          // Notify other scripts
          window.dispatchEvent(new CustomEvent('materio-stats-updated', { detail: stats }));
        } else {
          console.error('[Metrics] Sync failed. Status:', response.status);
        }
      } catch (e) {
        console.error('[Metrics] Sync stats failed', e);
      }
    }

    // Add event to buffer
    track(eventName, properties = {}) {
      const event = {
        type: eventName,
        data: properties,
        timestamp: new Date().toISOString(),
        sessionId: this.sessionId,
        url: window.location.href,
        referrer: document.referrer
      };

      this.buffer.push(event);
      this.saveBuffer();

      // If critical event or buffer becoming too large, flush immediately
      if (this.buffer.length >= 50) {
        this.flush();
      }

      this.updateLocalStats(eventName, properties);
    }

    updateLocalStats(type, data) {
      const statsKey = 'materio_user_stats';
      let stats = JSON.parse(localStorage.getItem(statsKey) || '{"pdfsRead":0, "timeSpent":0, "streak":0, "lastReadDate":null, "history": []}');
      const today = new Date().toISOString().split('T')[0];

      if (type === 'pdf_read') {
        stats.pdfsRead++;
        // Basic history tracking (keep last 50)
        stats.history.unshift({
          url: data.url,
          date: new Date().toISOString(),
          duration: data.duration_sec
        });
        if (stats.history.length > 50) stats.history.pop();

        // Streak Logic
        if (stats.lastReadDate !== today) {
          // If last read was yesterday, increment streak
          const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
          if (stats.lastReadDate === yesterday) {
            stats.streak++;
          } else if (stats.lastReadDate !== today) {
            // Reset if gap > 1 day (and not today)
            stats.streak = 1;
          }
          stats.lastReadDate = today;
        }
      }

      if (type === 'user_engagement' || type === 'pdf_read') {
        stats.timeSpent += (data.duration_sec || 0);
      }

      localStorage.setItem(statsKey, JSON.stringify(stats));
    }

    loadBuffer() {
      try {
        const stored = localStorage.getItem(CONFIG.STORAGE_KEY_EVENTS);
        if (stored) {
          this.buffer = JSON.parse(stored);
        }
      } catch (e) {
        console.error('[Metrics] Failed to load buffer', e);
        this.buffer = [];
      }
    }

    saveBuffer() {
      try {
        localStorage.setItem(CONFIG.STORAGE_KEY_EVENTS, JSON.stringify(this.buffer));
      } catch (e) {
        console.error('[Metrics] Failed to save buffer', e);
      }
    }

    async flush() {
      if (this.buffer.length === 0) return;

      const eventsToSend = [...this.buffer];
      // Clear buffer immediately to prevent duplicates if flush is called again
      this.buffer = [];
      this.saveBuffer();

      try {
        const payload = {
          anonymousId: this.anonymousId,
          userId: this.getUserId(),
          events: eventsToSend
        };

        // Use navigator.sendBeacon if available and just unloading
        if (navigator.sendBeacon && document.visibilityState === 'hidden') {
          const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
          navigator.sendBeacon(CONFIG.API_COLLECT, blob);
        } else {
          const response = await fetch(CONFIG.API_COLLECT, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
          });

          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
        }

        console.log(`[Metrics] Sent ${eventsToSend.length} events`);

      } catch (e) {
        console.warn('[Metrics] Failed to send events, requeuing', e);
        // Re-queue events on failure
        this.buffer = [...eventsToSend, ...this.buffer];
        this.saveBuffer();
      }
    }

    setupEventListeners() {
      // Visibility change for engagement tracking
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
          this.stopEngagementTracking();
          this.flush();
        } else {
          this.startEngagementTracking();
        }
      });

      // Page unload
      window.addEventListener('beforeunload', () => {
        this.stopEngagementTracking();
        this.flush();
      });

      // PDF Modal Observer
      this.setupPdfTracking();
    }

    startBatchTimer() {
      // We do not auto-flush based on time anymore
      // Only flush on unload or visibility hidden
    }

    startEngagementTracking() {
      this.engagementStartTime = Date.now();
    }

    stopEngagementTracking() {
      const timeSpent = Date.now() - this.engagementStartTime;
      if (timeSpent >= CONFIG.MIN_ENGAGEMENT_TIME) {
        this.track('user_engagement', {
          duration_ms: timeSpent,
          duration_sec: Math.round(timeSpent / 1000)
        });
      }
    }

    setupPdfTracking() {
      const popup = document.getElementById('popup');
      const popupContent = document.getElementById('popupContent');

      if (!popup) return;

      // Observer for popup visibility/class changes
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
            const isVisible = popup.style.display !== 'none' && popup.style.display !== '';

            if (isVisible && !this.currentPdf) {
              // PDF Opened
              this.handlePdfOpen(popupContent);
            } else if (!isVisible && this.currentPdf) {
              // PDF Closed
              this.handlePdfClose();
            }
          }
        });
      });

      observer.observe(popup, { attributes: true });
    }

    handlePdfOpen(container) {
      // Try to find iframe to get URL
      const iframe = container.querySelector('iframe');
      let pdfUrl = 'unknown';

      if (iframe) {
        // 1. Try to get the file parameter from the viewer URL
        try {
          if (iframe.src.includes('viewer.html') || iframe.src.includes('oread/web/viewer.html')) {
            const src = new URL(iframe.src, window.location.origin);
            const fileParam = src.searchParams.get('file');
            if (fileParam) {
              pdfUrl = decodeURIComponent(fileParam);
            } else {
              pdfUrl = iframe.src;
            }
          } else {
            // Direct PDF link or other iframe
            pdfUrl = iframe.src;
          }
        } catch (e) {
          pdfUrl = iframe.src;
        }

        // 2. Fallback: Check for attributes on the iframe if URL is generic/blob
        if (pdfUrl === 'unknown' || pdfUrl.startsWith('blob:') || pdfUrl === 'about:blank') {
          const attrUrl = iframe.getAttribute('data-src') || iframe.getAttribute('data-file-url') || iframe.getAttribute('src');
          if (attrUrl && attrUrl.length > 5) pdfUrl = attrUrl;
        }
      }

      // 3. Last resort: Check container attributes
      if (pdfUrl === 'unknown' || pdfUrl.includes('viewer.html')) {
        const containerUrl = container.getAttribute('data-pdf-url') || container.getAttribute('data-filename');
        if (containerUrl) pdfUrl = containerUrl;
      }

      this.currentPdf = pdfUrl;
      this.pdfStartTime = Date.now();

      this.track('pdf_opened', {
        url: pdfUrl
      });
      console.log('[Metrics] PDF Opened:', pdfUrl);
    }

    handlePdfClose() {
      if (!this.currentPdf) return;

      const duration = Date.now() - this.pdfStartTime;

      this.track('pdf_read', {
        url: this.currentPdf,
        duration_ms: duration,
        duration_sec: Math.round(duration / 1000)
      });

      console.log('[Metrics] PDF Closed. Duration:', Math.round(duration / 1000) + 's');

      this.currentPdf = null;
      this.pdfStartTime = null;
    }
  }

  // Initialize
  window.MaterioMetrics = new MetricsClient();

})();
