const leaderboardCache = new Map();
const leaderboardFetchInFlight = new Map();
let leaderboardRangeMode = 'weekly';

function generateFingerprint() {
  const nav = window.navigator;
  const screen = window.screen;
  const data = [
    nav.userAgent,
    nav.language,
    screen.colorDepth,
    `${screen.width}x${screen.height}`,
    new Date().getTimezoneOffset(),
    nav.platform,
    nav.hardwareConcurrency
  ].join('###');

  let hash = 0;
  for (let i = 0; i < data.length; i += 1) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }

  return Math.abs(hash).toString(16);
}

function getUserIdentityPayload() {
  const anonId = localStorage.getItem('materio_anon_id') || '';
  const fingerprint = generateFingerprint();

  let userId = '';
  try {
    const user = JSON.parse(localStorage.getItem('materio_user') || 'null');
    userId = user?.id || '';
  } catch (error) {
    userId = '';
  }

  return { anonId, userId, fingerprint };
}

function formatLeaderboardValue(entry) {
  const readHours = formatHours(entry.totalReadSec || 0);
  const uniques = Number(entry.uniquePdfs || 0).toLocaleString();
  return `${readHours}h • ${uniques} unique`;
}

function formatHours(seconds) {
  const safeSeconds = Math.max(0, Number(seconds) || 0);
  const hours = safeSeconds / 3600;
  const rounded = Math.round(hours * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getTodayDateKey() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getLeaderboardCacheKey(rangeMode, dateKey) {
  return `${rangeMode}:${dateKey || ''}`;
}

async function fetchLeaderboardData(rangeMode = 'weekly') {
  const safeRangeMode = rangeMode === 'today' ? 'today' : 'weekly';
  const dateKey = safeRangeMode === 'today' ? getTodayDateKey() : '';
  const cacheKey = getLeaderboardCacheKey(safeRangeMode, dateKey);
  const now = Date.now();
  const cached = leaderboardCache.get(cacheKey);
  if (cached && now - cached.at < 2 * 60 * 1000) {
    return cached.data;
  }

  if (leaderboardFetchInFlight.has(cacheKey)) {
    return leaderboardFetchInFlight.get(cacheKey);
  }

  const { anonId, userId, fingerprint } = getUserIdentityPayload();
  const query = new URLSearchParams({
    action: 'leaderboard',
    limit: '50',
    anonId,
    timeframe: safeRangeMode
  });

  if (fingerprint) {
    query.set('fp', fingerprint);
  }

  if (userId) {
    query.set('userId', userId);
  }

  if (safeRangeMode === 'today') {
    query.set('date', dateKey);
  }

  const endpoint = '/api/v2/features';
  const requestUrl = `${endpoint}?${query.toString()}`;
  const fallbackQuery = new URLSearchParams(query);
  fallbackQuery.set('action', 'analytics-leaderboard');
  const fallbackRequestUrl = `${endpoint}?${fallbackQuery.toString()}`;

  const request = (async () => {
    let response = await fetch(requestUrl, { cache: 'no-store' });

    // Backward-compat fallback for older backends that still use analytics-leaderboard.
    if (response.status === 404) {
      response = await fetch(fallbackRequestUrl, { cache: 'no-store' });
    }

    if (!response.ok) {
      throw new Error(`Leaderboard API responded with ${response.status}`);
    }

    const payload = await response.json();
    leaderboardCache.set(cacheKey, {
      at: Date.now(),
      data: payload
    });
    return payload;
  })()
    .finally(() => {
      leaderboardFetchInFlight.delete(cacheKey);
    });

  leaderboardFetchInFlight.set(cacheKey, request);
  return request;
}

function renderTopThree(entries) {
  const medals = ['stage-first', 'stage-second', 'stage-third'];
  const ordered = [entries[1], entries[0], entries[2]].filter(Boolean);

  return ordered
    .map((entry) => {
      const rank = Number(entry.rank);
      const stageClass = medals[Math.max(0, Math.min(2, rank - 1))] || 'stage-third';
      const displayName = escapeHtml(entry.displayName || `Reader ${rank}`);
      const value = escapeHtml(formatLeaderboardValue(entry));

      return `
        <article class="leaderboard-stage ${stageClass}">
          <div class="leaderboard-stage-inner">
            <div class="leaderboard-stage-rank">#${rank}</div>
            <div class="leaderboard-stage-name" title="${displayName}">${displayName}</div>
            <div class="leaderboard-stage-value">${value}</div>
          </div>
        </article>
      `;
    })
    .join('');
}

function renderOtherRows(entries) {
  if (!entries.length) {
    return '<p class="leaderboard-empty">No additional entries yet.</p>';
  }

  const rows = entries
    .map((entry) => {
      const rank = Number(entry.rank);
      const name = escapeHtml(entry.displayName || `Reader ${rank}`);
      const readHours = escapeHtml(formatHours(entry.totalReadSec || 0));
      const uniques = Number(entry.uniquePdfs || 0).toLocaleString();

      return `
        <tr>
          <td class="leaderboard-table-rank">#${rank}</td>
          <td class="leaderboard-table-name" title="${name}">${name}</td>
          <td class="leaderboard-table-metric">${readHours}h</td>
          <td class="leaderboard-table-metric">${uniques}</td>
        </tr>
      `;
    })
    .join('');

  return `
    <table class="leaderboard-table" aria-label="Leaderboard rankings">
      <thead>
        <tr>
          <th>Rank</th>
          <th>Name</th>
          <th style="text-align:right;">Time (hrs)</th>
          <th style="text-align:right;">Unique</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  `;
}

function renderLeaderboard(data) {
  const loadingState = document.getElementById('leaderboardLoadingState');
  const content = document.getElementById('leaderboardContent');
  if (!content) return;

  if (loadingState) {
    loadingState.style.display = 'none';
  }

  const entries = Array.isArray(data?.entries) ? data.entries : [];
  if (!entries.length) {
    content.innerHTML = '<p class="leaderboard-empty">Leaderboard data is not available yet.</p>';
    return;
  }

  const topThree = entries.slice(0, 3);
  const others = entries.slice(3, 50);

  content.innerHTML = `
    <section class="leaderboard-podium-zone" aria-label="Top three readers">
      <div class="leaderboard-podium">
        ${renderTopThree(topThree)}
      </div>
    </section>
    <section class="leaderboard-table-wrap" aria-label="Leaderboard table">
      ${renderOtherRows(others)}
    </section>
  `;
}

function renderNudgeCard(config) {
  const existing = document.getElementById('leaderboardTop50Nudge');
  if (existing) {
    existing.dataset.nudgeKind = config?.kind || 'generic';
    document.body.classList.add('leaderboard-nudge-open');
    return existing;
  }

  const card = document.createElement('aside');
  card.id = 'leaderboardTop50Nudge';
  card.className = 'leaderboard-nudge-card';
  card.dataset.nudgeKind = config?.kind || 'generic';
  card.setAttribute('role', 'status');
  card.setAttribute('aria-live', 'polite');
  const secondaryAction = config?.secondaryAction
    ? `<button type="button" class="leaderboard-nudge-btn" data-action="${escapeHtml(config.secondaryAction.action)}">${escapeHtml(config.secondaryAction.label)}</button>`
    : '';

  card.innerHTML = `
    <img src="/assets/img/greet.webp" alt="" class="leaderboard-nudge-image" />
    <div class="leaderboard-nudge-content">
      <p class="leaderboard-nudge-text">${config?.text || ''}</p>
      <div class="leaderboard-nudge-actions">
        <button type="button" class="leaderboard-nudge-btn leaderboard-nudge-btn-primary" data-action="${escapeHtml(config?.primaryAction?.action || 'dismiss')}">${escapeHtml(config?.primaryAction?.label || 'Dismiss')}</button>
        ${secondaryAction}
      </div>
    </div>
  `;

  card.addEventListener('click', (event) => {
    const action = event.target?.getAttribute('data-action');
    if (!action) return;

    const today = new Date().toISOString().split('T')[0];
    if (config?.storageKey) {
      localStorage.setItem(config.storageKey, today);
    }

    if (action === 'create-account') {
      document.body.classList.remove('leaderboard-nudge-open');
      window.location.href = '/account/';
      return;
    }

    if (action === 'open-leaderboard') {
      document.body.classList.remove('leaderboard-nudge-open');
      card.remove();
      const tab = document.querySelector('.tab-link[data-tab="leaderboard"]');
      if (tab) tab.click();
      return;
    }

    document.body.classList.remove('leaderboard-nudge-open');
    card.remove();
  });

  document.body.classList.add('leaderboard-nudge-open');
  document.body.appendChild(card);
  return card;
}

function renderTop50NudgeCard() {
  return renderNudgeCard({
    kind: 'top50',
    storageKey: 'materio_top50_nudge_shown_on',
    text: 'Hey, You might be on the leaderboard<br>Create an account to see where you rank !',
    primaryAction: { action: 'create-account', label: 'Create Account' },
    secondaryAction: { action: 'dismiss', label: "Nah I'm good" }
  });
}

function canShowBrowserNotificationNudge() {
  if (!('Notification' in window)) return false;
  if (Notification.permission !== 'granted') return false;

  const notificationsPref = localStorage.getItem('materio_notifications_enabled');
  if (notificationsPref === 'false') return false;

  return true;
}

function sendTop50BrowserNudge(rank) {
  if (!canShowBrowserNotificationNudge()) return;

  const title = "You're a Top Reader";
  const message = rank
    ? `You're currently #${rank}. Sign up to see your full top-50 leaderboard profile.`
    : 'You might be in the top 50. Sign up to see your leaderboard position.';

  if (navigator.serviceWorker && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({
      type: 'SHOW_NOTIFICATION',
      title,
      message,
      url: '/account/'
    });
    return;
  }

  const notification = new Notification(title, {
    body: message,
    icon: '/assets/img/icon.svg',
    data: { url: '/account/' }
  });

  notification.onclick = (event) => {
    event.preventDefault();
    window.location.href = '/account/';
  };
}

function maybeShowModerationNotice(data) {
  const notice = data?.moderationNotice;
  if (!notice || notice.active === false) {
    return false;
  }

  const action = String(notice.action || '').toLowerCase();
  if (!['warn', 'ban'].includes(action)) {
    return false;
  }

  const dayKey = new Date().toISOString().slice(0, 10);
  const storageKey = `materio_moderation_notice_seen_${action}`;
  if (localStorage.getItem(storageKey) === dayKey) {
    return true;
  }

  const title = escapeHtml(notice.title || (action === 'ban' ? 'Access Restricted' : 'Account Notice'));
  const body = escapeHtml(notice.body || (action === 'ban'
    ? 'Your activity matched a blocked device profile. Access has been limited.'
    : 'Your activity matched a review profile. Please follow platform usage guidelines.'));

  renderNudgeCard({
    kind: action,
    storageKey,
    text: `${title}<br>${body}`,
    primaryAction: { action: action === 'ban' ? 'dismiss' : 'open-leaderboard', label: action === 'ban' ? 'Understood' : 'View Leaderboard' },
    secondaryAction: { action: 'dismiss', label: action === 'ban' ? 'Close' : 'Dismiss' }
  });

  return true;
}

function maybeShowTop50Nudge(data) {
  const rank = Number(data?.requester?.rank || 0);
  const isAnonymous = data?.requester?.isAnonymous === true;
  if (!rank || rank > 50 || !isAnonymous) {
    return;
  }

  const today = new Date().toISOString().split('T')[0];
  const nudgeKey = 'materio_top50_nudge_shown_on';
  if (localStorage.getItem(nudgeKey) === today) {
    return;
  }

  renderTop50NudgeCard();
  localStorage.setItem(nudgeKey, today);

  const browserNudgeKey = 'materio_top50_browser_nudge_on';
  if (localStorage.getItem(browserNudgeKey) !== today) {
    sendTop50BrowserNudge(rank);
    localStorage.setItem(browserNudgeKey, today);
  }
}

function showLeaderboardNudgeFromConsole() {
  localStorage.removeItem('materio_top50_nudge_shown_on');
  renderTop50NudgeCard();
}

function hideLeaderboardNudgeFromConsole() {
  const card = document.getElementById('leaderboardTop50Nudge');
  if (card) {
    card.remove();
  }
  document.body.classList.remove('leaderboard-nudge-open');
}

function applyLeaderboardRangeUI() {
  const buttons = document.querySelectorAll('.leaderboard-filter-btn[data-leaderboard-range]');
  buttons.forEach((button) => {
    const isActive = button.getAttribute('data-leaderboard-range') === leaderboardRangeMode;
    button.classList.toggle('active', isActive);
    button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
  });
}

function updateLeaderboardSubtitle() {
  const subtitle = document.querySelector('.leaderboard-subtitle');
  if (!subtitle) return;

  if (leaderboardRangeMode === 'today') {
    subtitle.textContent = 'Showing only current date data.';
    return;
  }

  subtitle.textContent = 'Showing summed data across all recorded daily entries.';
}

async function loadLeaderboardData(rangeMode = leaderboardRangeMode) {
  const nextMode = rangeMode === 'today' ? 'today' : 'weekly';
  const dateKey = nextMode === 'today' ? getTodayDateKey() : '';
  const cacheKey = getLeaderboardCacheKey(nextMode, dateKey);
  const now = Date.now();
  const cached = leaderboardCache.get(cacheKey);
  const isCacheValid = cached && (now - cached.at < 2 * 60 * 1000);

  leaderboardRangeMode = nextMode;
  applyLeaderboardRangeUI();
  updateLeaderboardSubtitle();

  const loadingState = document.getElementById('leaderboardLoadingState');
  const content = document.getElementById('leaderboardContent');

  if (!content) {
    return;
  }

  // If we have valid cache, render it immediately and don't show loading spinner
  if (isCacheValid) {
    renderLeaderboard(cached.data);
    if (loadingState) loadingState.style.display = 'none';
  } else {
    // Only clear and show loading if we don't have a valid cache
    if (loadingState) {
      loadingState.style.display = 'block';
    }
    content.innerHTML = '';
  }

  try {
    const data = await fetchLeaderboardData(leaderboardRangeMode);
    
    // If cache was invalid or different, render the fresh data
    if (!isCacheValid || JSON.stringify(data) !== JSON.stringify(cached?.data)) {
        renderLeaderboard(data);
    }
    
    if (loadingState) loadingState.style.display = 'none';

    if (!maybeShowModerationNotice(data)) {
      maybeShowTop50Nudge(data);
    }
  } catch (error) {
    if (loadingState) {
      loadingState.style.display = 'none';
    }

    console.warn('Leaderboard load failed:', error);
    // Only show error if we didn't manage to render from cache
    if (content.innerHTML === '' || content.querySelector('.leaderboard-loader')) {
      const reason = escapeHtml(error?.message || 'Unknown error');
      content.innerHTML = `<p class="leaderboard-error">Could not load leaderboard: ${reason}</p>`;
    }
  }
}

async function checkTopReaderStatusInBackground() {
  const today = new Date().toISOString().split('T')[0];
  const checkKey = 'materio_top_reader_status_checked_on';
  if (localStorage.getItem(checkKey) === today) {
    return;
  }

  try {
    const data = await fetchLeaderboardData('weekly');
    localStorage.setItem(checkKey, today);
    if (!maybeShowModerationNotice(data)) {
      maybeShowTop50Nudge(data);
    }
  } catch (error) {
    // Silent fail: leaderboard popup is opportunistic.
  }
}

function initLeaderboard() {
  const syncLeaderboardTabLayoutState = () => {
    const leaderboardTab = document.getElementById('leaderboard');
    const contentRoot = document.querySelector('.content');
    const isActive = Boolean(leaderboardTab?.classList.contains('active'));
    if (contentRoot) {
      contentRoot.classList.toggle('leaderboard-tab-active', isActive);
    }
  };

  const rangeButtons = document.querySelectorAll('.leaderboard-filter-btn[data-leaderboard-range]');
  rangeButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const nextMode = button.getAttribute('data-leaderboard-range') === 'today' ? 'today' : 'weekly';
      if (nextMode === leaderboardRangeMode) return;
      loadLeaderboardData(nextMode);
    });
  });

  applyLeaderboardRangeUI();
  updateLeaderboardSubtitle();

  document.addEventListener('tabOpened', (e) => {
    syncLeaderboardTabLayoutState();
    if (e.detail?.tab === 'leaderboard') {
      loadLeaderboardData();
    }
  });

  const leaderboardTabLink = document.querySelector('.tab-link[data-tab="leaderboard"]');
  if (leaderboardTabLink) {
    leaderboardTabLink.addEventListener('click', () => {
      // Let tab switch complete before rendering.
      setTimeout(() => {
        loadLeaderboardData();
      }, 0);
    });
  }

  const leaderboardTab = document.getElementById('leaderboard');
  if (leaderboardTab?.classList.contains('active')) {
    loadLeaderboardData();
  }

  syncLeaderboardTabLayoutState();
  checkTopReaderStatusInBackground();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initLeaderboard);
} else {
  initLeaderboard();
}

window.loadLeaderboardData = loadLeaderboardData;
window.showLeaderboardNudge = showLeaderboardNudgeFromConsole;
window.hideLeaderboardNudge = hideLeaderboardNudgeFromConsole;
