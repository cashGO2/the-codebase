/**
 * Materio Haptics System
 * Provides haptic feedback (vibration) for interactive elements
 * Uses the Web Vibration API (supported on mobile devices)
 */

(function () {
    'use strict';

    // Check if vibration is supported
    const isVibrationSupported = 'vibrate' in navigator;

    // Haptic feedback patterns (in milliseconds)
    // Format: [vibrate, pause, vibrate, pause, ...]
    const HapticPatterns = {
        // Light tap - for toggles, checkboxes, radio buttons
        light: [10],

        // Medium tap - for buttons, navbar clicks
        medium: [20],

        // Strong tap - for important actions like submit
        strong: [30],

        // Double tap - for dropdown actions
        double: [15, 50, 15],

        // Success - for completed actions
        success: [20, 50, 30],

        // Error/Warning - for errors or validation issues
        error: [50, 100, 50, 100, 50],

        // Slider tick - for slider movements
        tick: [5],

        // Tab switch - for navbar tab changes
        tab: [12, 40, 12],

        // Loading pattern - "zzz zz zz zz zz zzzzz" style
        // Simulates: short-pause-shorter-pause-shorter-pause-shorter-pause-shorter-pause-long
        loading: [80, 150, 40, 120, 40, 120, 40, 120, 40, 120, 150],

        // Loading step - individual pulse during loading
        loadingPulse: [30, 80],

        // PDF loaded - final confirmation vibration
        loadComplete: [40, 60, 80, 60, 120],

        // Scroll/swipe feedback
        scroll: [8],

        // Toggle on
        toggleOn: [15, 30, 25],

        // Toggle off
        toggleOff: [25, 30, 15],

        // Dropdown open
        dropdownOpen: [12, 40, 20],

        // Dropdown close
        dropdownClose: [20, 40, 12],

        // Selection made
        select: [18]
    };
    // Intensity multipliers
    const IntensityMultipliers = {
        minimal: 0.5,
        medium: 1.0,
        strong: 1.5
    };

    /**
     * Get current intensity setting
     * @returns {string} - 'minimal', 'medium', or 'strong'
     */
    function getIntensity() {
        return localStorage.getItem('materio_haptics_intensity') || 'medium';
    }

    /**
     * Set intensity setting
     * @param {string} intensity - 'minimal', 'medium', or 'strong'
     */
    function setIntensity(intensity) {
        if (IntensityMultipliers[intensity] !== undefined) {
            localStorage.setItem('materio_haptics_intensity', intensity);
        }
    }

    /**
     * Scale a vibration pattern based on current intensity
     * @param {number[]} pattern - Original pattern array
     * @returns {number[]} - Scaled pattern
     */
    function scalePattern(pattern) {
        const multiplier = IntensityMultipliers[getIntensity()] || 1.0;
        return pattern.map(duration => Math.round(duration * multiplier));
    }

    /**
     * Trigger a haptic feedback
     * @param {string|number[]} pattern - Pattern name or custom pattern array
     */
    function vibrate(pattern) {
        if (!isVibrationSupported) return false;

        // Check if user has disabled haptics
        if (localStorage.getItem('materio_haptics_disabled') === 'true') {
            return false;
        }

        let vibrationPattern;

        if (typeof pattern === 'string') {
            vibrationPattern = HapticPatterns[pattern];
            if (!vibrationPattern) {
                console.warn(`Haptic pattern "${pattern}" not found, using default`);
                vibrationPattern = HapticPatterns.light;
            }
        } else if (Array.isArray(pattern)) {
            vibrationPattern = pattern;
        } else {
            vibrationPattern = HapticPatterns.light;
        }

        // Scale the pattern based on intensity
        const scaledPattern = scalePattern(vibrationPattern);

        try {
            return navigator.vibrate(scaledPattern);
        } catch (error) {
            console.warn('Haptic feedback failed:', error);
            return false;
        }
    }

    /**
     * Stop any ongoing vibration
     */
    function stopVibration() {
        if (isVibrationSupported) {
            navigator.vibrate(0);
        }
    }

    /**
     * Loading vibration sequence - creates the "zzz zz zz zz zz zzzzz opens" effect
     * Call this when PDF starts loading, it will create a pulsing effect
     * @param {Function} checkComplete - Function that returns true when loading is complete
     * @param {number} maxDuration - Maximum duration in ms (default 10 seconds)
     * @returns {Promise} - Resolves when loading completes or times out
     */
    function startLoadingVibration(checkComplete, maxDuration = 10000) {
        return new Promise((resolve) => {
            if (!isVibrationSupported || localStorage.getItem('materio_haptics_disabled') === 'true') {
                resolve();
                return;
            }

            let elapsed = 0;
            const pulseInterval = 200; // ms between pulses
            let pulseCount = 0;

            const intervalId = setInterval(() => {
                elapsed += pulseInterval;

                // Check if loading is complete
                if (checkComplete && checkComplete()) {
                    clearInterval(intervalId);
                    // Final "opens" vibration
                    setTimeout(() => {
                        vibrate('loadComplete');
                        resolve();
                    }, 100);
                    return;
                }

                // Check if we've exceeded max duration
                if (elapsed >= maxDuration) {
                    clearInterval(intervalId);
                    stopVibration();
                    resolve();
                    return;
                }

                // Create varying pulse pattern: "zzz zz zz zz zz"
                // Longer pulses at start, shorter in middle
                pulseCount++;
                if (pulseCount === 1) {
                    // First pulse - longer (zzz)
                    vibrate([60]);
                } else if (pulseCount <= 5) {
                    // Middle pulses - shorter (zz)
                    vibrate([35]);
                } else {
                    // Reset cycle
                    pulseCount = 0;
                }
            }, pulseInterval);
        });
    }

    /**
     * Simple loading start vibration (use when you don't have a completion checker)
     */
    function loadingStart() {
        vibrate('loading');
    }

    /**
     * Loading complete vibration
     */
    function loadingComplete() {
        vibrate('loadComplete');
    }

    /**
     * Auto-attach haptic feedback to common interactive elements
     * Call this after DOM is loaded
     */
    function autoAttachHaptics() {
        // Toggles/Switches (checkbox inputs styled as toggles)
        document.querySelectorAll('input[type="checkbox"].toggle, input[type="checkbox"][id*="Toggle"], .toggle-switch input').forEach(toggle => {
            if (!toggle.dataset.hapticAttached) {
                toggle.addEventListener('change', function () {
                    vibrate(this.checked ? 'toggleOn' : 'toggleOff');
                });
                toggle.dataset.hapticAttached = 'true';
            }
        });

        // Sliders/Range inputs
        document.querySelectorAll('input[type="range"]').forEach(slider => {
            if (!slider.dataset.hapticAttached) {
                let lastValue = slider.value;
                slider.addEventListener('input', function () {
                    // Only vibrate when value changes significantly
                    const step = parseFloat(slider.step) || 1;
                    const newValue = parseFloat(this.value);
                    const oldValue = parseFloat(lastValue);

                    if (Math.abs(newValue - oldValue) >= step) {
                        vibrate('tick');
                        lastValue = this.value;
                    }
                });
                slider.dataset.hapticAttached = 'true';
            }
        });

        // Navbar tab links
        document.querySelectorAll('.tab-link, .nav-link, [data-tab]').forEach(link => {
            if (!link.dataset.hapticAttached) {
                link.addEventListener('click', function () {
                    vibrate('tab');
                });
                link.dataset.hapticAttached = 'true';
            }
        });

        // Dropdown triggers
        document.querySelectorAll('[id*="DropdownTrigger"], .dropdown-trigger, [data-dropdown-toggle]').forEach(trigger => {
            if (!trigger.dataset.hapticAttached) {
                trigger.addEventListener('click', function () {
                    const wrapper = this.closest('[class*="dropdown"]') || this.parentElement;
                    const isOpen = wrapper && (wrapper.classList.contains('open') || wrapper.classList.contains('show'));
                    vibrate(isOpen ? 'dropdownClose' : 'dropdownOpen');
                });
                trigger.dataset.hapticAttached = 'true';
            }
        });

        // Dropdown items
        document.querySelectorAll('.dropdown-item, [class*="dropdown"] [class*="item"]').forEach(item => {
            if (!item.dataset.hapticAttached) {
                item.addEventListener('click', function () {
                    vibrate('select');
                });
                item.dataset.hapticAttached = 'true';
            }
        });

        // General buttons
        document.querySelectorAll('button:not([data-haptic-attached]), .btn:not([data-haptic-attached])').forEach(btn => {
            if (!btn.dataset.hapticAttached && !btn.id?.includes('submit')) {
                btn.addEventListener('click', function () {
                    vibrate('medium');
                });
                btn.dataset.hapticAttached = 'true';
            }
        });
    }

    /**
     * Attach haptic to submit button with loading pattern
     * @param {string} submitButtonId - ID of the submit button
     * @param {Function} loadingChecker - Function that returns true when loading is complete
     */
    function attachSubmitHaptic(submitButtonId, loadingChecker) {
        const submitBtn = document.getElementById(submitButtonId);
        if (submitBtn && !submitBtn.dataset.hapticSubmitAttached) {
            submitBtn.addEventListener('click', function () {
                // Strong initial tap
                vibrate('strong');

                // If a loading checker is provided, start loading vibration
                if (loadingChecker && typeof loadingChecker === 'function') {
                    setTimeout(() => {
                        startLoadingVibration(loadingChecker);
                    }, 100);
                }
            });
            submitBtn.dataset.hapticSubmitAttached = 'true';
        }
    }

    /**
     * Enable/Disable haptic feedback
     * @param {boolean} enabled 
     */
    function setHapticsEnabled(enabled) {
        localStorage.setItem('materio_haptics_disabled', enabled ? 'false' : 'true');
    }

    /**
     * Check if haptics are enabled
     * @returns {boolean}
     */
    function isHapticsEnabled() {
        return localStorage.getItem('materio_haptics_disabled') !== 'true';
    }

    // Expose the API globally
    window.MaterioHaptics = {
        vibrate,
        stopVibration,
        startLoadingVibration,
        loadingStart,
        loadingComplete,
        autoAttachHaptics,
        attachSubmitHaptic,
        setHapticsEnabled,
        isHapticsEnabled,
        getIntensity,
        setIntensity,
        patterns: HapticPatterns,
        isSupported: isVibrationSupported
    };

    // Auto-initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () {
            autoAttachHaptics();
            initializeHapticToggle();
        });
    } else {
        // DOM already loaded
        autoAttachHaptics();
        initializeHapticToggle();
    }

    /**
     * Initialize the haptic toggle UI in settings
     */
    function initializeHapticToggle() {
        const hapticToggle = document.getElementById('hapticToggle');
        const hapticIntensityOptions = document.getElementById('hapticIntensityOptions');
        const intensitySlider = document.getElementById('hapticIntensitySlider');
        const intensityValue = document.getElementById('hapticIntensityValue');

        // Intensity labels for display
        const intensityLabels = ['Minimal', 'Medium', 'Strong'];
        const intensityValues = ['minimal', 'medium', 'strong'];

        if (!hapticToggle) return;

        // Set initial state based on stored preference
        const hapticsEnabled = isHapticsEnabled();
        hapticToggle.checked = hapticsEnabled;

        // Show/hide intensity options based on initial state
        if (hapticIntensityOptions) {
            hapticIntensityOptions.style.display = hapticsEnabled ? 'block' : 'none';
        }

        // Set initial slider position based on stored intensity
        if (intensitySlider) {
            const currentIntensity = getIntensity();
            const sliderValue = intensityValues.indexOf(currentIntensity);
            intensitySlider.value = sliderValue >= 0 ? sliderValue : 1; // Default to medium (1)

            // Update display value
            if (intensityValue) {
                intensityValue.textContent = intensityLabels[intensitySlider.value];
            }
        }

        // Add change event listener to toggle
        hapticToggle.addEventListener('change', function () {
            const enabled = this.checked;
            setHapticsEnabled(enabled);

            // Show/hide intensity options
            if (hapticIntensityOptions) {
                hapticIntensityOptions.style.display = enabled ? 'block' : 'none';
            }

            // Provide feedback on the toggle itself (if enabling)
            if (enabled && isVibrationSupported) {
                vibrate('success');
            }
        });

        // Add input handler to intensity slider
        if (intensitySlider) {
            intensitySlider.addEventListener('input', function () {
                const sliderVal = parseInt(this.value);
                const intensity = intensityValues[sliderVal];

                // Update display value
                if (intensityValue) {
                    intensityValue.textContent = intensityLabels[sliderVal];
                }

                // Save the intensity setting
                setIntensity(intensity);

                // Provide haptic feedback with the new intensity
                vibrate('tick');
            });

            // Add change event for final selection feedback
            intensitySlider.addEventListener('change', function () {
                vibrate('medium');
            });
        }

        // Hide the haptic toggle card on desktop (only relevant for mobile)
        const hapticCard = document.getElementById('hapticToggleCard');
        if (hapticCard && !isVibrationSupported) {
            hapticCard.style.display = 'none';
        }
    }


    // Re-attach haptics when new content is added (for dynamically loaded content)
    const observer = new MutationObserver(function (mutations) {
        let hasNewInteractiveElements = false;

        mutations.forEach(function (mutation) {
            if (mutation.addedNodes.length) {
                mutation.addedNodes.forEach(function (node) {
                    if (node.nodeType === 1) { // Element node
                        // Check if the added node or its children contain interactive elements
                        if (node.matches && (
                            node.matches('input, button, .btn, .tab-link, .dropdown-item') ||
                            node.querySelector && node.querySelector('input, button, .btn, .tab-link, .dropdown-item')
                        )) {
                            hasNewInteractiveElements = true;
                        }
                    }
                });
            }
        });

        if (hasNewInteractiveElements) {
            // Debounce re-attachment
            clearTimeout(observer.debounceTimer);
            observer.debounceTimer = setTimeout(autoAttachHaptics, 100);
        }
    });

    // Observe the document for changes
    observer.observe(document.body || document.documentElement, {
        childList: true,
        subtree: true
    });

    console.log('[Haptics] Materio Haptics System initialized', isVibrationSupported ? '(vibration supported)' : '(vibration not supported)');
})();
