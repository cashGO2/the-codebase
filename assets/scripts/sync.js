/**
 * Materio Analytics v4 (FINAL RESTRUCTURED)
 *
 * One row per user per day in Supabase.
 *
 * Columns:
 * - metrics:  SOLELY PDF & Reading data (opens, closes, duration, pdfs_read map)
 * - usermeta: EVERYTHING ELSE (User Agent, IP, Screen, Referrer, Engagement clicks, Cookies/Settings)
 */

(function () {
  'use strict';

  // ─── Supabase Config ───
  const SUPABASE_URL = 'https://popaoujsfvznlqltszfr.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBvcGFvdWpzZnZ6bmxxbHRzemZyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcxMTg1NTIsImV4cCI6MjA2MjY5NDU1Mn0.nJFDXqpcnQDnZa7OueLSiHeqE0RxbINEcKcwv8l8bRw';
  const TABLE = 'user_daily_stats';

  // ─── Constants ───
  const FLUSH_INTERVAL_MS = 60_000;
  const COOKIE_POLL_MS = 5_000;
  const STORAGE_ANON_ID = 'materio_anon_id';
  const STORAGE_PENDING = 'materio_analytics_pending';

  // ─── Helpers ───
  function todayISO() { return new Date().toISOString().slice(0, 10); }
  function uuid() {
    if (crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
  }
  function detectDeviceType() {
    const ua = navigator.userAgent;
    if (/Mobi|Android/i.test(ua)) return 'mobile';
    if (/Tablet|iPad/i.test(ua)) return 'tablet';
    return 'desktop';
  }
  function getMaterialCookies() {
    const result = {};
    document.cookie.split(';').forEach(c => {
      const trimmed = c.trim();
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx < 0) return;
      const name = trimmed.slice(0, eqIdx);
      // EXCLUDE sensitive data like auth tokens or user payloads
      if (name.startsWith('materio_') && !name.includes('auth_token') && !name.includes('user')) {
        result[name.slice(8)] = trimmed.slice(eqIdx + 1);
      }
    });
    return result;
  }
  function getCookieValue(name) {
    const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
    return match ? match[2] : null;
  }

  // ═══════════════════════════════════════════════════
  //  Analytics Client
  // ═══════════════════════════════════════════════════

  class MaterioAnalytics {
    constructor() {
      // ─── Identity ───
      this.anonId = this._loadOrCreateAnonId();
      this.userId = this._readUserId();

      // ─── Diffs for metrics (PDF/Reading) ───
      this.metricsDiff = {
        total_reading_sec: 0,
        pdf_opens_total: 0,
        pdf_closes_total: 0,
        pdfs_read: {}
      };

      // ─── Diffs for usermeta (Engagement/State/Session) ───
      this.usermetaDiff = {
        session: null,
        engagement: { scroll_events: 0, zoom_events: 0, button_clicks: {}, keyboard_shortcuts: {} },
        state: null
      };

      // ─── guards ───
      this._pdfOpenTs = null;
      this._pdfTitle = null;
      this._pdfHiddenAt = null;
      this._pdfActiveMs = 0;
      this._pendingPdfTitle = null;
      this._isPdfOpening = false;

      // ─── Inits ───
      this._lastCookieSnapshot = document.cookie;
      this._retryPending();
      this._prepareSessionMeta();
      this._refreshStateSnapshot();
      this._backfillUserId();
      this._setupEventListeners();
      this._setupPdfTracking();
      this._setupEngagements();
      this._startPeriodicFlush();
      this._startCookiePolling();

      this._flushAll();
    }

    _loadOrCreateAnonId() {
      let id = localStorage.getItem(STORAGE_ANON_ID);
      if (!id) { id = uuid(); localStorage.setItem(STORAGE_ANON_ID, id); }
      return id;
    }

    _readUserId() {
      try {
        const raw = localStorage.getItem('materio_user');
        if (!raw) return null;
        const user = JSON.parse(raw);
        return user?.id || user?.userId || user?.user_id || null;
      } catch { return null; }
    }

    async _backfillUserId() {
      const uId = this._readUserId();
      if (!uId) return;
      try {
        const url = `${SUPABASE_URL}/rest/v1/${TABLE}?anon_id=eq.${this.anonId}&date=eq.${todayISO()}&apikey=${SUPABASE_ANON_KEY}`;
        await fetch(url, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` },
          body: JSON.stringify({ user_id: uId })
        });
      } catch { }
    }

    // ═══════════════════════════════════════════════════
    //  Supabase Transport
    // ═══════════════════════════════════════════════════

    async _upsert(fields) {
      const date = todayISO();
      try {
        const existing = await this._getExisting(date);
        const merged = this._mergeRow(existing, fields);
        const body = { anon_id: this.anonId, date: date, user_id: this._readUserId(), ...merged };

        const url = `${SUPABASE_URL}/rest/v1/${TABLE}?on_conflict=anon_id,date&apikey=${SUPABASE_ANON_KEY}`;
        const resp = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            'Prefer': 'resolution=merge-duplicates'
          },
          body: JSON.stringify(body)
        });

        if (!resp.ok) throw new Error(resp.status);
        localStorage.removeItem(STORAGE_PENDING);
      } catch (err) {
        this._savePending(fields);
      }
    }

    async _getExisting(date) {
      try {
        const url = `${SUPABASE_URL}/rest/v1/${TABLE}?anon_id=eq.${this.anonId}&date=eq.${date}&select=metrics,usermeta&apikey=${SUPABASE_ANON_KEY}`;
        const resp = await fetch(url, { headers: { 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` } });
        const rows = await resp.json();
        return (Array.isArray(rows) && rows.length > 0) ? rows[0] : null;
      } catch { return null; }
    }

    _mergeRow(existing, diff) {
      const result = {};
      // Metrics
      if (diff.metrics) {
        const b = existing?.metrics || { total_reading_sec: 0, pdf_opens_total: 0, pdf_closes_total: 0, pdfs_read: {} };
        const d = diff.metrics;
        const m = { ...b };
        m.total_reading_sec = (b.total_reading_sec || 0) + (d.total_reading_sec || 0);
        m.pdf_opens_total = (b.pdf_opens_total || 0) + (d.pdf_opens_total || 0);
        m.pdf_closes_total = (b.pdf_closes_total || 0) + (d.pdf_closes_total || 0);
        m.pdfs_read = { ...(b.pdfs_read || {}) };
        for (const [t, p] of Object.entries(d.pdfs_read || {})) {
          if (m.pdfs_read[t]) {
            m.pdfs_read[t] = { opens: (m.pdfs_read[t].opens || 0) + p.opens, duration_sec: (m.pdfs_read[t].duration_sec || 0) + p.duration_sec };
          } else {
            m.pdfs_read[t] = { ...p };
          }
        }
        result.metrics = m;
      }
      // UserMeta
      if (diff.usermeta) {
        const b = existing?.usermeta || { session: {}, engagement: { scroll_events: 0, zoom_events: 0, button_clicks: {}, keyboard_shortcuts: {} }, state: {} };
        const d = diff.usermeta;
        const u = { ...b };
        if (d.session && Object.keys(b.session).length === 0) u.session = d.session;
        if (d.state) u.state = d.state;
        if (d.engagement) {
          const be = b.engagement, de = d.engagement;
          u.engagement = {
            scroll_events: (be.scroll_events || 0) + (de.scroll_events || 0),
            zoom_events: (be.zoom_events || 0) + (de.zoom_events || 0),
            button_clicks: { ...(be.button_clicks || {}) },
            keyboard_shortcuts: { ...(be.keyboard_shortcuts || {}) }
          };
          for (const [k, v] of Object.entries(de.button_clicks || {})) u.engagement.button_clicks[k] = (u.engagement.button_clicks[k] || 0) + v;
          for (const [k, v] of Object.entries(de.keyboard_shortcuts || {})) u.engagement.keyboard_shortcuts[k] = (u.engagement.keyboard_shortcuts[k] || 0) + v;
        }
        result.usermeta = u;
      }
      return result;
    }

    _savePending(fields) { try { const e = JSON.parse(localStorage.getItem(STORAGE_PENDING) || '{}'); localStorage.setItem(STORAGE_PENDING, JSON.stringify(this._mergeRow(e, fields))); } catch { } }
    async _retryPending() { try { const r = localStorage.getItem(STORAGE_PENDING); if (r) await this._upsert(JSON.parse(r)); } catch { } }

    // ═══════════════════════════════════════════════════
    //  Data Preparation
    // ═══════════════════════════════════════════════════

    _prepareSessionMeta() {
      const flag = `materio_meta_v4_${todayISO()}`;
      if (localStorage.getItem(flag) === '1') return;
      this.usermetaDiff.session = { user_agent: navigator.userAgent, device: detectDeviceType(), screen: `${screen.width}x${screen.height}`, url: window.location.href };
      fetch('https://api.ipify.org?format=json', { signal: AbortSignal.timeout(2000) })
        .then(r => r.json()).then(d => { if(this.usermetaDiff.session) this.usermetaDiff.session.ip = d.ip; }).catch(() => {});
      localStorage.setItem(flag, '1');
    }

    _refreshStateSnapshot() {
      this.usermetaDiff.state = { updated: new Date().toISOString(), settings: getMaterialCookies(), common: {} };
      ['theme', 'activeTab', 'notificationsEnabled'].forEach(name => {
        const val = getCookieValue(name); if (val !== null) this.usermetaDiff.state.common[name] = val;
      });
    }

    // ═══════════════════════════════════════════════════
    //  PDF Tracking (Metrics)
    // ═══════════════════════════════════════════════════

    _openPdf(rawTitle) {
      if (this._pdfTitle || this._isPdfOpening) return;
      this._isPdfOpening = true;
      const title = (rawTitle || 'unknown').trim().toLowerCase();
      this._pdfTitle = title;
      this._pdfOpenTs = Date.now();
      this._pdfActiveMs = 0;
      this._pdfHiddenAt = null;
      this.metricsDiff.pdf_opens_total += 1;
      if (!this.metricsDiff.pdfs_read[title]) this.metricsDiff.pdfs_read[title] = { opens: 0, duration_sec: 0 };
      this.metricsDiff.pdfs_read[title].opens += 1;
      this._isPdfOpening = false;
    }

    _closePdf() {
      if (!this._pdfTitle) return;
      const sec = Math.round(this._computeActiveMs() / 1000);
      if (sec > 0) {
        this.metricsDiff.total_reading_sec += sec;
        const pdf = this.metricsDiff.pdfs_read[this._pdfTitle];
        if (pdf) pdf.duration_sec += sec;
      }
      this.metricsDiff.pdf_closes_total += 1;
      this._pdfTitle = null; this._pdfOpenTs = null;
    }

    _computeActiveMs() {
      if (!this._pdfOpenTs) return this._pdfActiveMs;
      const now = Date.now();
      return this._pdfActiveMs + (this._pdfHiddenAt ? (this._pdfHiddenAt - this._pdfOpenTs) : (now - this._pdfOpenTs));
    }

    _setupPdfTracking() {
      const p = document.getElementById('popup'); if (!p) return;
      const obs = new MutationObserver((ms) => {
        for (const m of ms) {
          if (m.attributeName === 'style') {
            const v = p.style.display !== 'none' && p.style.display !== '';
            if (v && !this._pdfTitle) { this._captureTitle(); this._openPdf(this._pendingPdfTitle || 'Unknown'); }
            else if (!v && this._pdfTitle) this._closePdf();
          }
          if (m.attributeName === 'class' && p.classList.contains('closing') && this._pdfTitle) this._closePdf();
        }
      });
      obs.observe(p, { attributes: true, attributeFilter: ['style', 'class'] });
      document.getElementById('submitButton')?.addEventListener('click', () => this._captureTitle());
    }

    _captureTitle() {
      try {
        const s = document.getElementById('subjectSelect')?.options[document.getElementById('subjectSelect')?.selectedIndex]?.text;
        const t = document.getElementById('topicSelect')?.options[document.getElementById('topicSelect')?.selectedIndex]?.text;
        if (s && s !== 'Select Subject') this._pendingPdfTitle = (t && t !== 'Select Topic') ? `${s} - ${t}` : s;
        else this._pendingPdfTitle = (t && t !== 'Select Topic') ? t : 'Unknown Document';
      } catch { this._pendingPdfTitle = 'Unknown Document'; }
    }

    // ═══════════════════════════════════════════════════
    //  Engagement Tracking (UserMeta)
    // ═══════════════════════════════════════════════════

    _bumpBtn(k) { this.usermetaDiff.engagement.button_clicks[k] = (this.usermetaDiff.engagement.button_clicks[k] || 0) + 1; }
    _bumpSht(k) { this.usermetaDiff.engagement.keyboard_shortcuts[k] = (this.usermetaDiff.engagement.keyboard_shortcuts[k] || 0) + 1; }

    _setupEngagements() {
      const bMap = { 'submitButton': 'start_reading', 'bugReportBtn': 'bug_report_open', 'quickSearchInput': 'search_focus', 'aiSearchToggle': 'ai_search_toggle', 'aiConnectorsBanner': 'mcp_banner', 'closePopup': 'pdf_close_btn', 'sharePdfButton': 'share_pdf', 'downloadButton': 'download_pdf', 'fullscreenButton': 'fullscreen_pdf', 'keyboardShortcutsBtn': 'shortcuts_open' };
      for (const [id, k] of Object.entries(bMap)) { const el = document.getElementById(id); if (el) el.addEventListener(id==='quickSearchInput'?'focus':'click', () => this._bumpBtn(k)); }
      const mFns = { 'openMcpModal': 'mcp_open', 'closeMcpModal': 'mcp_close', 'openExamModal': 'exam_open', 'closeExamModal': 'exam_close', 'closePromoModal': 'promo_close' };
      for (const [f, k] of Object.entries(mFns)) { const o = window[f]; if (typeof o === 'function') { window[f] = (...a) => { this._bumpBtn(k); return o.apply(window, a); }; } }
      const oF = window.openDynamicForm;
      if (typeof oF === 'function') { window.openDynamicForm = (t, ...a) => { this._bumpBtn(`form_${(t || 'unknown').replace(/[^a-z0-9]/gi, '_')}`); return oF(t, ...a); }; }
      document.querySelectorAll('.tab-link[data-tab]').forEach(l => l.addEventListener('click', () => this._bumpBtn(`tab_${l.getAttribute('data-tab')}`)));
      const pMod = document.getElementById('promoModal');
      if (pMod) {
        new MutationObserver(() => {
          if (pMod.classList.contains('show') && pMod.style.display !== 'none') {
            this._bumpBtn('promo_view');
            const t = pMod.querySelector('.promo-title, h2')?.textContent.trim().toLowerCase().replace(/[^a-z0-9]/gi, '_');
            if (t) this._bumpBtn(`promo_view_${t}`);
          }
        }).observe(pMod, { attributes: true, attributeFilter: ['style', 'class'] });
      }
      let sT; window.addEventListener('scroll', () => { clearTimeout(sT); sT = setTimeout(()=>this.usermetaDiff.engagement.scroll_events++, 300); }, { passive:true });
      window.addEventListener('message', (e) => { if (e.origin === window.location.origin && (e.data?.type === 'pdfZoom' || e.data?.type === 'scalechanging')) this.usermetaDiff.engagement.zoom_events++; });
      document.addEventListener('keydown', (e) => { if (e.ctrlKey) { if (e.key.toLowerCase() === 's') this._bumpSht('ctrl_s'); if (e.key.toLowerCase() === 'p') this._bumpSht('ctrl_p'); if (e.key.toLowerCase() === 'u') this._bumpSht('ctrl_u'); if (e.shiftKey && e.key.toLowerCase() === 'i') this._bumpSht('ctrl_shift_i'); } if (e.key === 'F12') this._bumpSht('f12'); });
    }

    _setupEventListeners() {
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') { this._pdfHiddenAt = Date.now(); } else if (this._pdfOpenTs && this._pdfHiddenAt) { this._pdfActiveMs += (this._pdfHiddenAt - this._pdfOpenTs); this._pdfHiddenAt = null; this._pdfOpenTs = Date.now(); } });
      window.addEventListener('beforeunload', () => { if (this._pdfTitle) this._closePdf(); this._flushViaBeacon(); });
      window.addEventListener('storage', (e) => { if (e.key === 'materio_user' && e.newValue) this._backfillUserId(); });
    }
    _startPeriodicFlush() { setInterval(() => this._flushAll(), FLUSH_INTERVAL_MS); }
    _startCookiePolling() { setInterval(() => { if (document.cookie !== this._lastCookieSnapshot) { this._lastCookieSnapshot = document.cookie; this._refreshStateSnapshot(); this._flushAll(); } }, COOKIE_POLL_MS); }

    async _flushAll() {
      const p = {};
      if (this.metricsDiff.pdf_opens_total > 0 || this.metricsDiff.total_reading_sec > 0) { p.metrics = { ...this.metricsDiff }; this.metricsDiff = { total_reading_sec: 0, pdf_opens_total: 0, pdf_closes_total: 0, pdfs_read: {} }; }
      const u = this.usermetaDiff; if (u.session || u.state || u.engagement.scroll_events > 0 || Object.keys(u.engagement.button_clicks).length > 0) { p.usermeta = { ...u }; this.usermetaDiff = { session: null, engagement: { scroll_events: 0, zoom_events: 0, button_clicks: {}, keyboard_shortcuts: {} }, state: null }; }
      if (Object.keys(p).length > 0) await this._upsert(p);
    }
    _flushViaBeacon() {
      const p = { metrics: this.metricsDiff, usermeta: { ...this.usermetaDiff, state: { ...this.usermetaDiff.state, updated: new Date().toISOString() } } };
      this._savePending(p);
      try { const b = { anon_id: this.anonId, date: todayISO(), user_id: this._readUserId(), ...p }; navigator.sendBeacon(`${SUPABASE_URL}/rest/v1/${TABLE}?on_conflict=anon_id,date&apikey=${SUPABASE_ANON_KEY}`, new Blob([JSON.stringify(b)], { type: 'application/json' })); } catch { }
    }
    push(e, p) { this._bumpBtn(e); }
    flush() { this._flushAll(); }
  }

  const analytics = new MaterioAnalytics();
  window.MetricsClient = analytics; window.SyncManager = analytics;
  Object.defineProperty(window, 'pdfAnalytics', { get: () => ({ currentPdf: analytics._pdfTitle ? `title:${analytics._pdfTitle}` : null }), configurable: true });
})();
