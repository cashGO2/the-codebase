/**
 * Health Check Module (ESM)
 * Monitors system health status and updates the indicator.
 * © 2024-2026, Materio by JTC.
 * @module health-check
 */

/**
 * Check system health and update indicator
 * @returns {Promise<void>}
 */
async function checkHealth() {
    const healthIndicator = document.getElementById('healthIndicator');
    if (!healthIndicator) return;

    try {
        const response = await fetch('/api/v2/health');
        const data = await response.json();

        healthIndicator.classList.remove('ok', 'degraded', 'error');

        if (data.status === 'ok') {
            healthIndicator.classList.add('ok');
            healthIndicator.title = 'All systems operational';
        } else if (data.status === 'degraded') {
            healthIndicator.classList.add('degraded');
            healthIndicator.title = 'Some systems degraded';
        } else {
            healthIndicator.classList.add('error');
            healthIndicator.title = 'System error';
        }
    } catch (error) {
        healthIndicator.classList.remove('ok', 'degraded');
        healthIndicator.classList.add('error');
        healthIndicator.title = 'Unable to check system health';
        console.error('Health check failed:', error);
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
