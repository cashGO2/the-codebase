/**
 * Materio Analytics v4 (MIGRATION & FINGERPRINTING)
 */

(function () {
  'use strict';

  const TABLE = 'user_daily_stats';
  const STORAGE_ANON_ID = 'materio_anon_id';
  const STORAGE_PENDING = 'materio_analytics_pending';

  // ─── 1. One Time Migration (Cleanup old keys) ───
  try {
    if (!localStorage.getItem('m_v4_migrated')) {
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        // CRITICAL: Preserve the force clear version key to avoid refresh loops
        if (k === 'm_last_force_clear') continue;
        
        if (k && (k.startsWith('m_') || k.startsWith('materio_meta_') || k.startsWith('materio_analytics_'))) {
          keysToRemove.push(k);
        }
      }
      keysToRemove.forEach(k => localStorage.removeItem(k));
      localStorage.setItem('m_v4_migrated', 'true');
    }
  } catch (e) {}

  // ─── 2. Helpers ───
  function todayISO() { return new Date().toISOString().slice(0, 10); }
  function generateFingerprint() {
    const nav = window.navigator;
    const screen = window.screen;
    const data = [
      nav.userAgent,
      nav.language,
      screen.colorDepth,
      screen.width + 'x' + screen.height,
      new Date().getTimezoneOffset(),
      nav.platform,
      nav.hardwareConcurrency
    ].join('###');
    
    // Simple fast hash
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0;
    }
    return Math.abs(hash).toString(16);
  }

  function getSettings() {
    const s = {};
    document.cookie.split(';').forEach(c => {
      const p = c.trim().split('=');
      if (p.length < 2) return;
      const k = p[0];
      if (k === 'theme' || k === 'remindLaterTime' || k.startsWith('materio_') && !k.includes('auth') && !k.includes('user')) {
        s[k.replace('materio_', '')] = p[1];
      }
    });
    ['promoLastShown', 'promoRemindLaterTime', 'usr_enr'].forEach(k => {
      const val = localStorage.getItem(k);
      if (val) s[k] = val;
    });
    return s;
  }

  class MaterioAnalytics {
    constructor() {
      this.anonId = this._loadIdentity();
      this.userId = this._readUserId();
      this.metricsDiff = { total_reading_sec: 0, pdf_counts: {} };
      this.usermetaDiff = { total_engagement_sec: 0, session: null, engagement: { clicks: {}, scroll: 0, zoom: 0, shortcuts: {} }, state: null };
      
      this._pageActiveTs = Date.now();
      this._pdfOpenTs = null;
      this._pdfTitle = null;
      this._isPdfOpening = false;
      this._lastActivityTs = Date.now(); // Track last interaction time
      this._init();
    }

    _loadIdentity() {
      let id = localStorage.getItem(STORAGE_ANON_ID);
      const fp = generateFingerprint();
      
      // If no ID but we have a fingerprint, we can prefix the fingerprint to avoid duplicates
      if (!id) {
        // Generate a random ID with fingerprint seed
        id = fp + '-' + Math.random().toString(36).substring(2, 10);
        localStorage.setItem(STORAGE_ANON_ID, id);
      }
      return id;
    }

    _readUserId() { try { return JSON.parse(localStorage.getItem('materio_user'))?.id || null; } catch { return null; } }

    _init() {
      this._retryPending();
      this._prepareSession();
      this._refreshState();
      this._setupListeners();
      this._setupPdfObserver();
      this._setupClickTracking();
      console.log('Materio Analytics v4 Started. ID:', this.anonId);
      setInterval(() => this._flush(), 300000); // 5-minute interval
      setTimeout(() => this._flush(), 5000);   // Delayed initial capture
    }

    _prepareSession() {
      const flag = `m_v4_meta_${todayISO()}`;
      if (localStorage.getItem(flag)) return;
      this.usermetaDiff.session = {
        ua: navigator.userAgent,
        screen: `${screen.width}x${screen.height}`,
        ref: document.referrer || null,
        url: window.location.href,
        fp: generateFingerprint() // Store the seed for server-side linking
      };
      localStorage.setItem(flag, '1');
    }

    _refreshState() {
      this.usermetaDiff.state = { updated: new Date().toISOString(), settings: getSettings() };
    }

    // [All other methods remain the same but optimized for stability]
    _bumpEngagement() {
      const now = Date.now();
      const idleSec = (now - this._lastActivityTs) / 1000;
      
      // Idle Thresholds:
      // - Standard Page: 60s
      // - PDF Reading: 300s (5 mins grace for reading blocks)
      const threshold = this._pdfTitle ? 300 : 60;
      
      if (idleSec > threshold) {
        this._pageActiveTs = now;
        if (this._pdfOpenTs) this._pdfOpenTs = now;
        return;
      }

      const diff = Math.round((now - this._pageActiveTs) / 1000);
      if (diff > 0) this.usermetaDiff.total_engagement_sec += Math.min(diff, 305); // Allow slightly over interval
      
      this._pageActiveTs = now;

      if (this._pdfTitle && this._pdfOpenTs) {
        const pDiff = Math.round((now - this._pdfOpenTs) / 1000);
        if (pDiff > 0) {
          const actualPDiff = Math.min(pDiff, 305);
          this.metricsDiff.total_reading_sec += actualPDiff;
          if (!this.metricsDiff.pdf_counts[this._pdfTitle]) this.metricsDiff.pdf_counts[this._pdfTitle] = { count: 0, time_sec: 0 };
          this.metricsDiff.pdf_counts[this._pdfTitle].time_sec += actualPDiff;
        }
        this._pdfOpenTs = now;
      }
    }

    _openPdf(title) {
      if (this._isPdfOpening) return;
      this._isPdfOpening = true;
      this._bumpEngagement();
      const cleanTitle = (title || 'unknown').trim().toLowerCase();
      
      // Prevent duplicate open calls for same title within 5s
      if (this._pdfTitle === cleanTitle && (Date.now() - this._pdfOpenTs < 5000)) {
        this._isPdfOpening = false;
        return;
      }

      this._pdfTitle = cleanTitle;
      this._pdfOpenTs = Date.now();
      if (!this.metricsDiff.pdf_counts[this._pdfTitle]) this.metricsDiff.pdf_counts[this._pdfTitle] = { count: 0, time_sec: 0 };
      this.metricsDiff.pdf_counts[this._pdfTitle].count += 1;
      
      console.log('PDF Tracked: Open ->', this._pdfTitle);
      this._isPdfOpening = false;
      this._flush(); // Immediate sync on open
    }

    _closePdf() { 
      if (this._pdfTitle) { 
        console.log('PDF Tracked: Close ->', this._pdfTitle);
        this._bumpEngagement(); 
        this._flush(); // Immediate sync on close
        this._pdfTitle = null; 
        this._pdfOpenTs = null; 
      } 
    }

    _setupPdfObserver() {
      const p = document.getElementById('popup');
      if (!p) return;
      
      const checkPdf = () => {
        const iframe = p.querySelector('iframe');
        const isVisible = p.offsetParent !== null || p.style.display === 'block' || p.classList.contains('active');
        const hasSrc = iframe && iframe.src && !iframe.src.includes('about:blank');
        
        if (isVisible && hasSrc) {
          if (!this._pdfTitle) {
            this._extractTitle(iframe);
            this._openPdf(this._pendingTitle);
          }
        } else if (!isVisible && this._pdfTitle) {
          this._closePdf();
        }
      };

      const observer = new MutationObserver(checkPdf);
      observer.observe(p, { attributes: true, attributeFilter: ['style', 'class'], childList: true, subtree: true });
      
      // Also poll slightly for the first 10 seconds to ensure we didn't miss the initial load
      let polls = 0;
      const poll = setInterval(() => {
        checkPdf();
        if (++polls > 10) clearInterval(poll);
      }, 1000);
    }

    _extractTitle(iframe) {
      try {
        const url = new URL(iframe.src, window.location.origin);
        const f = url.searchParams.get('file');
        if (f) { this._pendingTitle = decodeURIComponent(f).split('/').pop().split('?')[0].replace(/\.pdf$/i, '').replace(/[-_]/g, ' '); }
        else {
          const s = document.getElementById('subjectSelect')?.options[document.getElementById('subjectSelect')?.selectedIndex]?.text;
          const t = document.getElementById('topicSelect')?.options[document.getElementById('topicSelect')?.selectedIndex]?.text;
          this._pendingTitle = (s && s !== 'Select Subject') ? ((t && t !== 'Select Topic') ? `${s} - ${t}` : s) : 'unknown';
        }
      } catch { this._pendingTitle = 'unknown'; }
    }

    _setupClickTracking() {
      const ids = { 'submitButton': 'start_reading', 'bugReportBtn': 'bug_report', 'aiConnectorsBanner': 'mcp_banner', 'sharePdfButton': 'share', 'downloadButton': 'download' };
      Object.entries(ids).forEach(([id, k]) => document.getElementById(id)?.addEventListener('click', () => { this.usermetaDiff.engagement.clicks[k] = (this.usermetaDiff.engagement.clicks[k] || 0) + 1; }));
      const orig = window.openDynamicForm;
      if (typeof orig === 'function') { window.openDynamicForm = (t, ...a) => { this.usermetaDiff.engagement.clicks[`form_${t}`] = (this.usermetaDiff.engagement.clicks[`form_${t}`] || 0) + 1; return orig(t, ...a); }; }
    }

    _setupListeners() {
      const activityEvents = ['mousedown', 'keydown', 'scroll', 'touchstart', 'mousemove'];
      activityEvents.forEach(e => document.addEventListener(e, () => { this._lastActivityTs = Date.now(); }, { passive: true }));
      
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          this._pageActiveTs = Date.now();
          this._lastActivityTs = Date.now(); 
        }
        this._bumpEngagement();
      });
      window.addEventListener('beforeunload', () => { this._bumpEngagement(); this._flush(true); });
    }

    async _flush(isBeacon = false) {
      if (document.visibilityState === 'visible') this._bumpEngagement();
      if (!this.usermetaDiff.state) this._refreshState();
      
      const payload = { metrics: { ...this.metricsDiff }, usermeta: { ...this.usermetaDiff } };
      
      // Strict Gatekeeper: Only flush if there is meaningful new data
      const hasMetrics = payload.metrics.total_reading_sec > 0 || Object.keys(payload.metrics.pdf_counts).length > 0;
      const hasEngagement = payload.usermeta.total_engagement_sec > 0 || Object.keys(payload.usermeta.engagement.clicks).length > 0;
      const hasSession = !!payload.usermeta.session || !!payload.usermeta.state;
      
      if (!hasMetrics && !hasEngagement && !hasSession) return;
      
      console.log('Analytics Flush:', payload);
      
      this.metricsDiff = { total_reading_sec: 0, pdf_counts: {} };
      this.usermetaDiff.total_engagement_sec = 0; this.usermetaDiff.session = null; this.usermetaDiff.engagement = { clicks: {}, scroll: 0, zoom: 0, shortcuts: {} }; this.usermetaDiff.state = null;

      const url = `/api/v2/features?action=analytics`;
      const data = { p_anon_id: this.anonId, p_date: todayISO(), p_metrics_diff: payload.metrics, p_usermeta_diff: payload.usermeta, p_user_id: this.userId };
      
      if (isBeacon) { 
        navigator.sendBeacon(url, new Blob([JSON.stringify(data)], { type: 'application/json' })); 
      }
      else { 
        try { 
          await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }); 
        } catch { 
          localStorage.setItem(STORAGE_PENDING, JSON.stringify(data)); 
        } 
      }
    }

    async _retryPending() { 
      try { 
        const d = JSON.parse(localStorage.getItem(STORAGE_PENDING)); 
        if (d) { 
          await fetch(`/api/v2/features?action=analytics`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d) }); 
          localStorage.removeItem(STORAGE_PENDING); 
        } 
      } catch {} 
    }
  }

  window.MetricsClient = new MaterioAnalytics();
  window.SyncManager = window.MetricsClient;
})();
