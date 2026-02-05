/**
 * Health Check Module
 * Monitors system health status and updates the indicator.
 * Checks incident.io public status page API for active incidents.
 * © 2024-2026, Materio by JTC.
 * @module health-check
 */

const INCIDENT_IO_SUMMARY_URL = 'https://statuspage.incident.io/materio/api/v1/summary';

/**
 * Check system health and update indicator
 * Fetches status from incident.io public widgets API
 * @returns {Promise<void>}
 */
async function checkHealth() {
    const healthIndicator = document.getElementById('healthIndicator');
    if (!healthIndicator) return;

    try {
        const response = await fetch(INCIDENT_IO_SUMMARY_URL);
        const data = await response.json();

        healthIndicator.classList.remove('ok', 'degraded', 'partial-outage', 'error');

        // Check for ongoing incidents
        const ongoingIncidents = data.ongoing_incidents || [];
        const inProgressMaintenances = data.in_progress_maintenances || [];

        if (ongoingIncidents.length > 0) {
            const incident = ongoingIncidents[0];
            const impact = incident.current_worst_impact || 'partial_outage';

            // Map impact to indicator class
            // major_outage = red (#dd340d)
            // partial_outage = orange (#f5785c)  
            // degraded_performance = yellow (#e4ba31)
            if (impact === 'major_outage') {
                healthIndicator.classList.add('error');
            } else if (impact === 'partial_outage') {
                healthIndicator.classList.add('partial-outage');
            } else if (impact === 'degraded_performance') {
                healthIndicator.classList.add('degraded');
            } else {
                healthIndicator.classList.add('partial-outage');
            }
            healthIndicator.title = incident.name || 'Active incident';
            return;
        }

        if (inProgressMaintenances.length > 0) {
            healthIndicator.classList.add('degraded');
            healthIndicator.title = inProgressMaintenances[0].name || 'Maintenance in progress';
            return;
        }

        // No incidents - all systems operational
        healthIndicator.classList.add('ok');
        healthIndicator.title = 'All systems operational';
    } catch (error) {
        // If we can't reach incident.io, show as ok (don't alarm users)
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
