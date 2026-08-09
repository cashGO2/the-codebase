/**
 * Health Check Module
 * Monitors system health status and updates the indicator.
 * Checks incident.io public status page API for active incidents.
 * © 2024-2026, Materio by JTC.
 * @module health-check
 */

const HEALTH_API_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
    ? 'http://localhost:1000/api/v2/health' 
    : '/api/v2/health';

/**
 * Check system health and update indicator
 * Fetches status from our internal health API (which proxies incident.io)
 * @returns {Promise<void>}
 */
async function checkHealth() {
    const healthIndicator = document.getElementById('healthIndicator');
    const healthStatusText = document.getElementById('healthStatusText');
    if (!healthIndicator) return;

    function updateStatus(text) {
        if (healthStatusText) {
            healthStatusText.textContent = text;
            const container = healthStatusText.closest('.health-status-container');
            if (container) {
                container.setAttribute('aria-label', `System Status: ${text}`);
            }
        }
    }

    try {
        const response = await fetch(`${HEALTH_API_URL}?t=${Date.now()}`);
        const data = await response.json();

        healthIndicator.classList.remove('ok', 'degraded', 'partial-outage', 'error');

        // Update Build ID if present in API response
        const liveBuildId = data.build?.buildId || data.buildId;
        if (liveBuildId) {
            const buildIdEl = document.getElementById('buildId');
            if (buildIdEl) {
                buildIdEl.textContent = liveBuildId;
            }
        }

        // Check for active incident from our health API response
        const incident = data.incident;
        const status = data.status;

        if (incident) {
            const impact = incident.impact || 'partial_outage';

            // Map impact to indicator class
            if (impact === 'major_outage') {
                healthIndicator.classList.add('error');
                updateStatus('Outage');
            } else if (impact === 'partial_outage') {
                healthIndicator.classList.add('partial-outage');
                updateStatus('Partial Outage');
            } else if (impact === 'degraded_performance' || impact === 'maintenance') {
                healthIndicator.classList.add('degraded');
                updateStatus('Degraded');
            } else {
                healthIndicator.classList.add('partial-outage');
                updateStatus('Issues');
            }
            healthIndicator.title = incident.name || 'Active incident';
            return;
        }

        // If status is offline, handle accordingly
        if (status === 'offline') {
            healthIndicator.classList.add('degraded'); // or a new 'offline' class if styles exist
            healthIndicator.title = data.message || 'Please check your internet connection';
            updateStatus('Offline');
            return;
        }

        // If no incident but status is degraded, show degraded
        if (status === 'degraded') {
            healthIndicator.classList.add('degraded');
            healthIndicator.title = data.message || 'Systems are experiencing issues';
            updateStatus('Degraded');
            return;
        }

        // No incidents - all systems operational
        healthIndicator.classList.add('ok');
        healthIndicator.title = 'All systems operational';
        updateStatus('Operational');
    } catch (error) {
        // If we can't reach our health API
        if (!navigator.onLine) {
            healthIndicator.classList.add('degraded');
            healthIndicator.title = 'You are currently offline';
            updateStatus('Offline');
        } else {
            // If online but API failed, show as ok (don't alarm users)
            healthIndicator.classList.add('ok');
            healthIndicator.title = 'All systems operational';
            updateStatus('Operational');
        }
    }
}

/**
 * Initialize health check on DOM ready
 */
function init() {
    const healthIndicator = document.getElementById('healthIndicator');
    if (!healthIndicator) return;

    checkHealth();
    // Uncomment to enable periodic checks:
    // setInterval(checkHealth, 90 * 60 * 1000);
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

// Export for potential future use
export { checkHealth, init };
