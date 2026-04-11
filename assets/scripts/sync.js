/**
 * Materio Analytics v4 (REFINED)
 *
 * One row per user per day in Supabase.
 * - metrics: PDF Title, Count, and Time (Reading only)
 * - usermeta: Engagement Time, Clicks, and Browser/State data
 */

(function () {
  'use strict';

  const SUPABASE_URL = 'https://popaoujsfvznlqltszfr.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBvcGFvdWpzZnZ6bmxxbHRzemZyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcxMTg1NTIsImV4cCI6MjA2MjY5NDU1Mn0.nJFDXqpcnQDnZa7OueLSiHeqE0RxbINEcKcwv8l8bRw';
  const TABLE = 'user_daily_stats';

  const FLUSH_INTERVAL_MS = 60_000;
  const STORAGE_ANON_ID = 'materio_anon_id';
  const STORAGE_PENDING = 'materio_analytics_pending';

  function todayISO() { return new Date().toISOString().slice(0, 10); }
  function uuid() { return (crypto && crypto.randomUUID) ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16); }); }
  
  function getSettings() {
    const s = {};
    // Capture specific Materio cookies
    document.cookie.split(';').forEach(c => {
      const pair = c.trim().split('=');
      if (pair.length < 2) return;
      const k = pair[0];
      if (k === 'theme' || k === 'remindLaterTime' || k.startsWith('materio_') && !k.includes('auth') && !k.includes('user')) {
        s[k.replace('materio_', '')] = pair[1];
      }
    });
    // Record specific localStorage keys
    ['promoLastShown', 'promoRemindLaterTime', 'usr_enr'].forEach(k => {
      const val = localStorage.getItem(k);
      if (val) s[k] = val;
    });
    return s;
  }

  class MaterioAnalytics {
    constructor() {
      this.anonId = this._loadId();
      this.userId = this._readUserId();

      this.metricsDiff = {
        total_reading_time: 0,
        pdf_counts: {} // { "Title": { count: 0, time: 0 } }
      };

      this.usermetaDiff = {
        total_engagement_time: 0,
        session: null,
        engagement: { clicks: {}, scroll: 0, zoom: 0, shortcuts: {} },
        state: null
      };

      // Tracking variables
      this._pageActiveTs = Date.now();
      this._pdfOpenTs = null;
      this._pdfTitle = null;
      this._isPdfOpening = false;

      this._init();
    }

    _loadId() { 
      let id = localStorage.getItem(STORAGE_ANON_ID);
      if (!id) { id = uuid(); localStorage.setItem(STORAGE_ANON_ID, id); }
      return id;
    }

    _readUserId() {
      try { return JSON.parse(localStorage.getItem('materio_user'))?.id || null; } catch { return null; }
    }

    _init() {
      this._retryPending();
      this._prepareSession();
      this._refreshState();
      this._setupListeners();
      this._setupPdfObserver();
      this._setupClickTracking();
      setInterval(() => this._flush(), FLUSH_INTERVAL_MS);
      // Initial state sync
      this._flush();
    }

    _prepareSession() {
      const flag = `m_meta_${todayISO()}`;
      if (localStorage.getItem(flag)) return;
      this.usermetaDiff.session = {
        ua: navigator.userAgent,
        screen: `${screen.width}x${screen.height}`,
        ref: document.referrer || null,
        url: window.location.href
      };
      localStorage.setItem(flag, '1');
    }

    _refreshState() {
      const s = getSettings();
      this.usermetaDiff.state = { updated: new Date().toISOString(), settings: s };
    }

    // ═══════════════════════════════════════════════════
    //  Core Tracking
    // ═══════════════════════════════════════════════════

    _bumpEngagement() {
      const now = Date.now();
      const diff = Math.round((now - this._pageActiveTs) / 1000);
      if (diff > 0) this.usermetaDiff.total_engagement_time += diff;
      this._pageActiveTs = now;

      if (this._pdfTitle && this._pdfOpenTs) {
        const pDiff = Math.round((now - this._pdfOpenTs) / 1000);
        if (pDiff > 0) {
          this.metricsDiff.total_reading_time += pDiff;
          if (!this.metricsDiff.pdf_counts[this._pdfTitle]) this.metricsDiff.pdf_counts[this._pdfTitle] = { count: 0, time: 0 };
          this.metricsDiff.pdf_counts[this._pdfTitle].time += pDiff;
        }
        this._pdfOpenTs = now;
      }
    }

    _openPdf(title) {
      if (this._isPdfOpening) return;
      this._isPdfOpening = true;
      this._bumpEngagement(); // Close old gaps
      this._pdfTitle = (title || 'unknown document').trim().toLowerCase();
      this._pdfOpenTs = Date.now();
      
      if (!this.metricsDiff.pdf_counts[this._pdfTitle]) {
        this.metricsDiff.pdf_counts[this._pdfTitle] = { count: 0, time: 0 };
      }
      this.metricsDiff.pdf_counts[this._pdfTitle].count += 1;
      this._isPdfOpening = false;
    }

    _closePdf() {
      if (!this._pdfTitle) return;
      this._bumpEngagement();
      this._pdfTitle = null;
      this._pdfOpenTs = null;
    }

    _setupPdfObserver() {
      const p = document.getElementById('popup');
      if (!p) return;
      const observer = new MutationObserver(() => {
        // More robust visibility check
        const isVisible = p.offsetParent !== null || p.style.display === 'block';
        if (isVisible && !this._pdfTitle) {
          this._extractTitle();
          this._openPdf(this._pendingTitle);
        } else if (!isVisible && this._pdfTitle) {
          this._closePdf();
        }
      });
      observer.observe(p, { attributes: true, attributeFilter: ['style', 'class'] });
    }

    _extractTitle() {
      try {
        const iframe = document.querySelector('#popup iframe');
        let requestTitle = null;

        // 1. Try to get title from the PDF request URL
        if (iframe && iframe.src) {
          try {
            const url = new URL(iframe.src, window.location.origin);
            const fileUrl = url.searchParams.get('file');
            if (fileUrl) {
              // Extract filename, strip query params if any, and remove extension
              const rawFile = decodeURIComponent(fileUrl).split('/').pop();
              const filename = rawFile.split('?')[0].replace(/\.pdf$/i, '');
              
              if (filename && filename !== 'viewer.html') {
                requestTitle = filename.replace(/_/g, ' ').replace(/-/g, ' ');
              }
            }
          } catch (e) { /* ignore parse error */ }
        }

        // 2. Fallback to dropdown selections
        if (!requestTitle) {
          const s = document.getElementById('subjectSelect')?.options[document.getElementById('subjectSelect')?.selectedIndex]?.text;
          const t = document.getElementById('topicSelect')?.options[document.getElementById('topicSelect')?.selectedIndex]?.text;
          if (s && s !== 'Select Subject') requestTitle = (t && t !== 'Select Topic') ? `${s} - ${t}` : s;
          else if (t && t !== 'Select Topic') requestTitle = t;
        }

        this._pendingTitle = requestTitle || 'Unknown Document';
      } catch { 
        this._pendingTitle = 'Unknown Document'; 
      }
    }

    _setupClickTracking() {
      const ids = { 'submitButton': 'start_reading', 'bugReportBtn': 'bug_report', 'aiConnectorsBanner': 'mcp_banner', 'sharePdfButton': 'share', 'downloadButton': 'download' };
      Object.entries(ids).forEach(([id, key]) => {
        document.getElementById(id)?.addEventListener('click', () => {
          this.usermetaDiff.engagement.clicks[key] = (this.usermetaDiff.engagement.clicks[key] || 0) + 1;
        });
      });
      
      // Dynamic Forms
      const orig = window.openDynamicForm;
      if (typeof orig === 'function') {
        window.openDynamicForm = (t, ...a) => {
          this.usermetaDiff.engagement.clicks[`form_${t}`] = (this.usermetaDiff.engagement.clicks[`form_${t}`] || 0) + 1;
          return orig(t, ...a);
        };
      }
    }

    _setupListeners() {
      document.addEventListener('visibilitychange', () => this._bumpEngagement());
      window.addEventListener('beforeunload', () => { this._bumpEngagement(); this._flush(true); });
      window.addEventListener('scroll', () => { this.usermetaDiff.engagement.scroll++; }, { passive: true });
    }

    // ═══════════════════════════════════════════════════
    //  Sync
    // ═══════════════════════════════════════════════════

    async _flush(isBeacon = false) {
      this._bumpEngagement();
      this._refreshState();

      const payload = {
        metrics: { ...this.metricsDiff },
        usermeta: { ...this.usermetaDiff }
      };

      // Only sync if there is something to report
      const hasMetrics = payload.metrics.total_reading_time > 0 || Object.keys(payload.metrics.pdf_counts).length > 0;
      const hasMeta = payload.usermeta.total_engagement_time > 0 || Object.keys(payload.usermeta.engagement.clicks).length > 0 || payload.usermeta.session || payload.usermeta.state;

      if (!hasMetrics && !hasMeta) return;

      // Reset markers
      this.metricsDiff = { total_reading_time: 0, pdf_counts: {} };
      this.usermetaDiff.total_engagement_time = 0;
      this.usermetaDiff.session = null;
      this.usermetaDiff.engagement = { clicks: {}, scroll: 0, zoom: 0, shortcuts: {} };
      this.usermetaDiff.state = null;

      const url = `${SUPABASE_URL}/rest/v1/rpc/merge_daily_stats?apikey=${SUPABASE_ANON_KEY}`;
      const data = { p_anon_id: this.anonId, p_date: todayISO(), p_metrics_diff: payload.metrics, p_usermeta_diff: payload.usermeta, p_user_id: this.userId };

      if (isBeacon) {
        navigator.sendBeacon(url, new Blob([JSON.stringify(data)], { type: 'application/json' }));
      } else {
        try {
          await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` }, body: JSON.stringify(data) });
        } catch { this._savePending(data); }
      }
    }

    _savePending(data) { try { localStorage.setItem(STORAGE_PENDING, JSON.stringify(data)); } catch {} }
    async _retryPending() { try { const d = JSON.parse(localStorage.getItem(STORAGE_PENDING)); if (d) { await fetch(`${SUPABASE_URL}/rest/v1/rpc/merge_daily_stats?apikey=${SUPABASE_ANON_KEY}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d) }); localStorage.removeItem(STORAGE_PENDING); } } catch {} }
  }

  window.MetricsClient = new MaterioAnalytics();
})();
