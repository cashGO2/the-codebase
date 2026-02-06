/**
 * Health Check Module
 * Monitors system health status and updates the indicator.
 * Checks incident.io public status page API for active incidents.
 * © 2024-2026, Materio by JTC.
 * @module health-check
 */

const HEALTH_API_URL = '/api/v2/health';

/**
 * Check system health and update indicator
 * Fetches status from our internal health API (which proxies incident.io)
 * @returns {Promise<void>}
 */
async function checkHealth() {
    const healthIndicator = document.getElementById('healthIndicator');
    if (!healthIndicator) return;

    try {
        const response = await fetch(HEALTH_API_URL);
        const data = await response.json();

        healthIndicator.classList.remove('ok', 'degraded', 'partial-outage', 'error');

        // Check for active incident from our health API response
        const incident = data.incident;
        const status = data.status;

        if (incident) {
            const impact = incident.impact || 'partial_outage';

            // Map impact to indicator class
            if (impact === 'major_outage') {
                healthIndicator.classList.add('error');
            } else if (impact === 'partial_outage') {
                healthIndicator.classList.add('partial-outage');
            } else if (impact === 'degraded_performance' || impact === 'maintenance') {
                healthIndicator.classList.add('degraded');
            } else {
                healthIndicator.classList.add('partial-outage');
            }
            healthIndicator.title = incident.name || 'Active incident';
            return;
        }

        // If no incident but status is degraded, show degraded
        if (status === 'degraded') {
            healthIndicator.classList.add('degraded');
            healthIndicator.title = data.message || 'Systems are experiencing issues';
            return;
        }

        // No incidents - all systems operational
        healthIndicator.classList.add('ok');
        healthIndicator.title = 'All systems operational';
    } catch (error) {
        // If we can't reach our health API, show as ok (don't alarm users)
        healthIndicator.classList.add('ok');
        healthIndicator.title = 'All systems operational';
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
