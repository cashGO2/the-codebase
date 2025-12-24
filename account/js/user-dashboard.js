/**
 * User Dashboard Logic
 * Populates analytics data from local storage
 */

document.addEventListener('DOMContentLoaded', function () {
    // Initial load from local storage
    loadUserAnalytics();

    // Fetch fresh "Super Data" from server
    fetchServerStats();

    // Listen for sync updates
    window.addEventListener('materio-stats-updated', function () {
        console.log('Refreshing dashboard with synced stats...');
        loadUserAnalytics();
    });
});

async function fetchServerStats() {
    // Wait for Metrics to be ready if needed
    if (!window.MaterioMetrics) {
        setTimeout(fetchServerStats, 500);
        return;
    }

    const userId = window.MaterioMetrics.getUserId();
    if (!userId) return;

    try {
        const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        const API_BASE = isLocal ? 'http://localhost:3000' : 'https://materio-analytics.vercel.app';

        const response = await fetch(`${API_BASE}/stats/${userId}?period=all_time`);
        if (response.ok) {
            const data = await response.json();

            // Construct the "Super Data" object
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

            // Save to local storage so other tabs/scripts see it
            localStorage.setItem('materio_user_stats', JSON.stringify(stats));

            // Update UI
            updateDashboardUI(stats);
        }
    } catch (e) {
        console.error('Failed to fetch server stats', e);
    }
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
        // Extract simpler name from URL if possible
        let name = 'PDF Document';
        try {
            // Try to get filename from URL
            const urlParts = item.url.split('/');
            const filename = urlParts[urlParts.length - 1];
            name = decodeURIComponent(filename.replace('.pdf', '')).split('?')[0]; // Remove query params and extension

            // If name is too cryptic (e.g. UUID), keep it generic or try to format
            if (name.length > 30) name = name.substring(0, 27) + '...';
        } catch (e) { }

        const el = document.createElement('div');
        el.className = 'list-item';
        el.innerHTML = `
            <i class="fas fa-file-pdf"></i>
            <div class="item-details">
                <span class="item-title" title="${item.url}">${name}</span>
                <span class="item-meta">${formatTime(item.duration)} read • ${new Date(item.date).toLocaleDateString()}</span>
            </div>
        `;

        // Make it clickable to reopen if possible (simplified for now)
        el.onclick = () => {
            // Optional: logic to reopen PDF
            window.open(item.url, '_blank');
        };
        el.style.cursor = 'pointer';

        container.appendChild(el);
    });
}
