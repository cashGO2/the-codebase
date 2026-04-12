/**
 * User Dashboard Logic
 * Keeps dashboard stats synced with analytics API and renders admin insights.
 */

let adminTopPdfsCache = [];
let adminPdfSearchDebounce = null;

document.addEventListener('DOMContentLoaded', function () {
    // Initial optimistic load from local storage, then hard sync from server.
    loadUserAnalytics();
    fetchServerStats();
    fetchAdminInsights();

    window.addEventListener('materio-stats-updated', function () {
        fetchServerStats();
        fetchAdminInsights();
    });

    window.addEventListener('materio-profile-loaded', function () {
        fetchServerStats();
        fetchAdminInsights();
    });

    document.addEventListener('visibilitychange', function () {
        if (!document.hidden) {
            fetchServerStats();
            fetchAdminInsights();
        }
    });

    const pdfSearch = document.getElementById('admin-pdf-search');
    if (pdfSearch) {
        pdfSearch.addEventListener('input', function () {
            const query = this.value || '';
            if (adminPdfSearchDebounce) {
                clearTimeout(adminPdfSearchDebounce);
            }
            adminPdfSearchDebounce = setTimeout(function () {
                fetchAdminInsights(query);
            }, 250);
        });
    }
});

function getApiBase() {
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    return isLocal ? 'http://localhost:3000' : 'https://materiosync.vercel.app';
}

function decodeUserIdFromToken() {
    const token = localStorage.getItem('materio_auth_token');
    if (!token) return null;

    try {
        const base64Url = token.split('.')[1];
        if (!base64Url) return null;
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(
            window.atob(base64).split('').map(function (c) {
                return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
            }).join('')
        );
        const payload = JSON.parse(jsonPayload);
        return payload.sub || payload.id || payload.user_id || payload.uid || null;
    } catch (e) {
        return null;
    }
}

function getCurrentUser() {
    try {
        const raw = localStorage.getItem('materio_user');
        return raw ? JSON.parse(raw) : null;
    } catch (e) {
        return null;
    }
}

function getCurrentUserId() {
    if (window.MetricsClient && typeof window.MetricsClient.getUserId === 'function') {
        const metricsUserId = window.MetricsClient.getUserId();
        if (metricsUserId) return metricsUserId;
    }

    const user = getCurrentUser();
    if (user && (user.id || user.userId || user.user_id)) {
        return user.id || user.userId || user.user_id;
    }

    return decodeUserIdFromToken();
}

async function fetchServerStats() {
    const userId = getCurrentUserId();
    if (!userId) return;

    try {
        const API_BASE = getApiBase();

        const response = await fetch(`${API_BASE}/stats/${userId}?period=all_time`, {
            cache: 'no-store'
        });

        if (response.ok) {
            const data = await response.json();

            const stats = {
                pdfsRead: data.metrics.pdfs_read_count || 0,
                timeSpent: (data.metrics.reading_time_seconds || 0) + (data.metrics.engagement_time_seconds || 0),
                streak: data.streak || 0,
                history: data.history || [],
                trends: data.trends || {},
                lastReadDate: null
            };

            if (stats.history.length > 0) {
                stats.lastReadDate = stats.history[0].date.split('T')[0];
            }

            localStorage.setItem('materio_user_stats', JSON.stringify(stats));
            updateDashboardUI(stats);
        }
    } catch (e) {
        console.error('Failed to fetch server stats', e);
    }
}

function isAdminOrSuperUser() {
    const user = getCurrentUser();
    return Boolean(user && user.hasAdminPrivileges);
}

async function fetchAdminInsights(pdfSearchQuery) {
    const section = document.getElementById('admin-analytics-section');
    if (!section) return;

    if (!isAdminOrSuperUser()) {
        section.style.display = 'none';
        return;
    }

    section.style.display = 'block';

    const adminUserId = getCurrentUserId();
    if (!adminUserId) {
        renderAdminTableFallback('admin-top-pdfs-body', 4, 'Unable to resolve admin user.');
        renderAdminTableFallback('admin-top-users-body', 4, 'Unable to resolve admin user.');
        return;
    }

    try {
        const API_BASE = getApiBase();
        const search = typeof pdfSearchQuery === 'string' ? pdfSearchQuery.trim() : '';
        const url = `${API_BASE}/admin/reading-insights?period=all_time&limit=50&adminUserId=${encodeURIComponent(adminUserId)}&pdfSearch=${encodeURIComponent(search)}`;
        const response = await fetch(url, { cache: 'no-store' });

        if (!response.ok) {
            throw new Error(`Failed to load admin insights (${response.status})`);
        }

        const payload = await response.json();
        renderTopPdfsTable(payload.top_pdfs || []);
        renderTopUsersTable(payload.top_users || []);
    } catch (error) {
        console.error('Failed to fetch admin insights', error);
        renderAdminTableFallback('admin-top-pdfs-body', 4, 'Unable to load data right now.');
        renderAdminTableFallback('admin-top-users-body', 4, 'Unable to load data right now.');
    }
}

function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function renderAdminTableFallback(tbodyId, colspan, message) {
    const tbody = document.getElementById(tbodyId);
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="${colspan}" class="admin-empty-cell">${escapeHtml(message)}</td></tr>`;
}

function renderTopPdfsTable(rows) {
    const tbody = document.getElementById('admin-top-pdfs-body');
    if (!tbody) return;

    adminTopPdfsCache = Array.isArray(rows) ? rows : [];

    if (!adminTopPdfsCache.length) {
        renderAdminTableFallback('admin-top-pdfs-body', 4, 'No PDF reading data yet.');
        return;
    }

    tbody.innerHTML = adminTopPdfsCache.map(function (row, index) {
        const title = escapeHtml(row.title || 'Untitled PDF');
        return `
            <tr>
                <td>${index + 1}</td>
                <td><span class="admin-pdf-name" title="${title}">${title}</span></td>
                <td>${row.reads || 0}</td>
                <td>${row.unique_readers || 0}</td>
            </tr>
        `;
    }).join('');
}

function renderTopUsersTable(rows) {
    const tbody = document.getElementById('admin-top-users-body');
    if (!tbody) return;

    if (!rows.length) {
        renderAdminTableFallback('admin-top-users-body', 4, 'No user reading data yet.');
        return;
    }

    tbody.innerHTML = rows.map(function (row, index) {
        const isAnon = row && (row.participant_type === 'anon' || (!row.user_id && row.anon_id));
        const displayName = escapeHtml(
            isAnon
                ? 'Anonymous User'
                : (row.display_name || row.username || row.user_id || 'Unknown User')
        );
        return `
            <tr>
                <td>${index + 1}</td>
                <td><span class="admin-user-name" title="${displayName}">${displayName}</span></td>
                <td><span class="admin-reading-time">${escapeHtml(row.reading_time_human || '00:00:00')}</span></td>
                <td>${row.pdf_reads || 0}</td>
            </tr>
        `;
    }).join('');
}

function loadUserAnalytics() {
    const statsKey = 'materio_user_stats';
    let stats = { pdfsRead: 0, timeSpent: 0, streak: 0, history: [] };

    try {
        const stored = localStorage.getItem(statsKey);
        if (stored) {
            stats = JSON.parse(stored);
        }
    } catch (e) {
        console.error('Failed to load user stats', e);
    }

    updateDashboardUI(stats);
}

function updateDashboardUI(stats) {
    // Update Stats
    updateElement('dash-streak', stats.streak);
    updateElement('dash-pdfs-read', stats.pdfsRead);
    updateElement('dash-time-spent', formatTime(stats.timeSpent));

    // Render History
    renderHistory(stats.history);
}

function updateElement(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
}

function formatTime(seconds) {
    if (!seconds) return '0m';
    if (seconds < 60) return seconds + 's';
    if (seconds < 3600) return Math.round(seconds / 60) + 'm';
    return (seconds / 3600).toFixed(1) + 'h';
}

function renderHistory(history) {
    const container = document.getElementById('dash-history-list');
    if (!container) return;

    if (!history || history.length === 0) {
        container.innerHTML = '<div class="empty-state-text">No recently read PDFs.</div>';
        return;
    }

    container.innerHTML = '';

    // Show top 5 recent
    history.slice(0, 5).forEach(item => {
        // Prefer the captured title from the database
        let name = item.title;

        if (!name || name === 'Unknown PDF' || name === 'PDF Document') {
            try {
                // Try to get filename from URL as fallback
                const urlParts = item.url.split('/');
                const filename = urlParts[urlParts.length - 1];
                name = decodeURIComponent(filename.replace('.pdf', '')).split('?')[0];

                if (name.length > 30) name = name.substring(0, 27) + '...';
            } catch (e) {
                name = 'PDF Document';
            }
        }

        const el = document.createElement('div');
        el.className = 'list-item';
        // Note: No onclick or pointer cursor as per user request
        el.style.cursor = 'default';

        el.innerHTML = `
            <i class="fas fa-file-pdf"></i>
            <div class="item-details">
                <span class="item-title" style="font-style: normal;" title="${item.url}">${name}</span>
                <span class="item-meta">${formatTime(item.duration)} read • ${new Date(item.date).toLocaleDateString()}</span>
            </div>
        `;

        container.appendChild(el);
    });
}
