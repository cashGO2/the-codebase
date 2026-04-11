/**
 * Materio Analytics v4 (MIGRATION & FINGERPRINTING)
 */

(function () {
  'use strict';

  const SUPABASE_URL = 'https://popaoujsfvznlqltszfr.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBvcGFvdWpzZnZ6bmxxbHRzemZyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcxMTg1NTIsImV4cCI6MjA2MjY5NDU1Mn0.nJFDXqpcnQDnZa7OueLSiHeqE0RxbINEcKcwv8l8bRw';
  const TABLE = 'user_daily_stats';
  const STORAGE_ANON_ID = 'materio_anon_id';
  const STORAGE_PENDING = 'materio_analytics_pending';

  // ─── 1. One Time Migration (Cleanup old keys) ───
  try {
    if (!localStorage.getItem('m_v4_migrated')) {
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && (k.startsWith('m_') || k.startsWith('materio_meta_') || k.startsWith('materio_analytics_'))) {
          keysToRemove.push(k);
        }
      }
      keysToRemove.forEach(k => localStorage.removeItem(k));
      localStorage.setItem('m_v4_migrated', '1');
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
      setInterval(() => this._flush(), 60000);
      this._flush();
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
      const diff = Math.round((now - this._pageActiveTs) / 1000);
      if (diff > 0) this.usermetaDiff.total_engagement_sec += Math.min(diff, 300); // Sanity cap 5 mins
      this._pageActiveTs = now;
      if (this._pdfTitle && this._pdfOpenTs) {
        const pDiff = Math.round((now - this._pdfOpenTs) / 1000);
        if (pDiff > 0) {
          this.metricsDiff.total_reading_sec += pDiff;
          if (!this.metricsDiff.pdf_counts[this._pdfTitle]) this.metricsDiff.pdf_counts[this._pdfTitle] = { count: 0, time_sec: 0 };
          this.metricsDiff.pdf_counts[this._pdfTitle].time_sec += pDiff;
        }
        this._pdfOpenTs = now;
      }
    }

    _openPdf(title) {
      if (this._isPdfOpening) return;
      this._isPdfOpening = true;
      this._bumpEngagement();
      this._pdfTitle = (title || 'unknown').trim().toLowerCase();
      this._pdfOpenTs = Date.now();
      if (!this.metricsDiff.pdf_counts[this._pdfTitle]) this.metricsDiff.pdf_counts[this._pdfTitle] = { count: 0, time_sec: 0 };
      this.metricsDiff.pdf_counts[this._pdfTitle].count += 1;
      this._isPdfOpening = false;
    }

    _closePdf() { if (this._pdfTitle) { this._bumpEngagement(); this._pdfTitle = null; this._pdfOpenTs = null; } }

    _setupPdfObserver() {
      const p = document.getElementById('popup');
      if (!p) return;
      new MutationObserver(() => {
        const iframe = p.querySelector('iframe');
        const isVisible = p.offsetParent !== null;
        const hasSrc = iframe && iframe.src && !iframe.src.includes('about:blank');
        if (isVisible && hasSrc && !this._pdfTitle) { this._extractTitle(iframe); this._openPdf(this._pendingTitle); }
        else if (!isVisible && this._pdfTitle) { this._closePdf(); }
      }).observe(p, { attributes: true, attributeFilter: ['style', 'class'] });
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
      document.addEventListener('visibilitychange', () => this._bumpEngagement());
      window.addEventListener('beforeunload', () => { this._bumpEngagement(); this._flush(true); });
    }

    async _flush(isBeacon = false) {
      this._bumpEngagement();
      if (!this.usermetaDiff.state) this._refreshState();
      const payload = { metrics: { ...this.metricsDiff }, usermeta: { ...this.usermetaDiff } };
      if (payload.metrics.total_reading_sec <= 0 && Object.keys(payload.metrics.pdf_counts).length === 0 && !payload.usermeta.session && !payload.usermeta.state && Object.keys(payload.usermeta.engagement.clicks).length === 0) return;
      
      this.metricsDiff = { total_reading_sec: 0, pdf_counts: {} };
      this.usermetaDiff.total_engagement_sec = 0; this.usermetaDiff.session = null; this.usermetaDiff.engagement = { clicks: {}, scroll: 0, zoom: 0, shortcuts: {} }; this.usermetaDiff.state = null;

      const url = `${SUPABASE_URL}/rest/v1/rpc/merge_daily_stats?apikey=${SUPABASE_ANON_KEY}`;
      const data = { p_anon_id: this.anonId, p_date: todayISO(), p_metrics_diff: payload.metrics, p_usermeta_diff: payload.usermeta, p_user_id: this.userId };
      if (isBeacon) { navigator.sendBeacon(url, new Blob([JSON.stringify(data)], { type: 'application/json' })); }
      else { try { await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }); } catch { localStorage.setItem(STORAGE_PENDING, JSON.stringify(data)); } }
    }

    async _retryPending() { try { const d = JSON.parse(localStorage.getItem(STORAGE_PENDING)); if (d) { await fetch(`${SUPABASE_URL}/rest/v1/rpc/merge_daily_stats?apikey=${SUPABASE_ANON_KEY}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d) }); localStorage.removeItem(STORAGE_PENDING); } } catch {} }
  }

  window.MetricsClient = new MaterioAnalytics();
  window.SyncManager = window.MetricsClient;
})();
