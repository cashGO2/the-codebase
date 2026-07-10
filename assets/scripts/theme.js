/**
 * Theme Module (ESM)
 * Handles theme switching, smart dark mode, and system preference synchronization.
 * 
 * @module theme
 */

import { setCookie, getCookie } from './utils.js';

// Smart dark mode time range (19:00 to 6:45)
const SMART_DARK_START_HOUR = 19;
const SMART_DARK_START_MINUTE = 0;
const SMART_DARK_END_HOUR = 6;
const SMART_DARK_END_MINUTE = 45;

let smartDarkModeInterval = null;

// Element IDs that need dark mode class
const THEME_ELEMENT_IDS = [
    'themeCard', 'bgToggleCard', 'popup', 'versionInfo', 'reading',
    'notices', 'notificationBoard', 'advanced', 'about', 'cookiesToggleCard',
    'paperModeCard', 'grainSizeControl', 'creatorInfo', 'licensesCard',
    'miscCard', 'account', 'oiaa', 'gh', 'nightReadingCard', 'einkModeCard',
    'tabSwitcherCard', 'blogs', 'blogPost1', 'blogPost2', 'blogPost3',
    'blogPost4', 'blogPost5', 'recommendedPosts', 'recommendedPost1',
    'recommendedPost2', 'recommendedPost3', 'recommendedPost4',
    'recommendedPost5', 'wallpaperSelectionCard', 'getinsights',
    'storageInfoCard', 'localCdnCard', 'serverTerminal', 'invertMode',
    'clearSiteDataCard', 'hapticToggleCard', 'notificationsToggleCard'
];

/**
 * Apply actual theme mode classes
 * @param {string} actualMode - 'light', 'dark', 'coffee', or 'coffee-dark'
 */
function applyThemeModeClass(actualMode) {
    const elements = [
        document.body,
        document.querySelector('header'),
        document.querySelector('.navbar'),
        document.querySelector('.content'),
        ...THEME_ELEMENT_IDS.map(id => document.getElementById(id))
    ];

    // Add notification cards
    const notifyCards = document.querySelectorAll('#notify');
    notifyCards.forEach(card => elements.push(card));

    const isDark = (actualMode === 'dark' || actualMode === 'coffee-dark');

    elements.forEach(el => {
        if (el) {
            el.classList.remove('dark-mode', 'light-mode', 'coffee-mode', 'coffee-dark-mode');
            if (actualMode === 'dark') el.classList.add('dark-mode');
            if (actualMode === 'light') el.classList.add('light-mode');
            if (actualMode === 'coffee') el.classList.add('coffee-mode');
            if (actualMode === 'coffee-dark') {
                el.classList.add('coffee-dark-mode');
                el.classList.add('dark-mode');
            }
        }
    });

    // Sync with Giscus iframe
    const giscusFrame = document.querySelector('iframe.giscus-frame');
    if (giscusFrame?.contentWindow) {
        const giscusDarkTheme = `${window.location.origin}/assets/style/giscus.css`;
        giscusFrame.contentWindow.postMessage({
            giscus: {
                setConfig: {
                    theme: isDark ? giscusDarkTheme : 'noborder_light'
                }
            }
        }, 'https://giscus.app');
    }

    // Sync with PDF iframe
    const pdfIframe = document.getElementById('pdf-iframe');
    if (pdfIframe?.contentWindow) {
        try {
            pdfIframe.contentWindow.postMessage({
                type: 'themeMode',
                isDark: isDark,
                actualMode: actualMode
            }, '*');
        } catch (e) {
            // Silently fail
        }
    }
    
    updateThemeColor(actualMode);
}

function resolveSystemTheme() {
    // Pure light mode cookie overrides system/smart dark mode
    if (getCookie('pureLightMode') === 'true') return 'light';
    
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark';
    
    const now = new Date();
    const current = now.getHours() * 60 + now.getMinutes();
    const start = SMART_DARK_START_HOUR * 60 + SMART_DARK_START_MINUTE;
    const end = SMART_DARK_END_HOUR * 60 + SMART_DARK_END_MINUTE;
    
    if (current >= start || current < end) return 'dark';
    return 'light';
}

function applyThemeBasedOnConditions() {
    let mode = getCookie('theme') || 'system';
    
    // Handle old cookies (if it was 'dark'/'light' boolean strings before dropdown)
    if (mode === 'true' || mode === 'false') {
        mode = mode === 'true' ? 'dark' : 'light';
        setCookie('theme', mode, 365);
    }
    
    let actualMode = mode;
    if (mode === 'system') {
        actualMode = resolveSystemTheme();
    }
    
    // Apply Pure Light Mode check if mode is forced 'light'
    if (mode === 'light' && getCookie('pureLightMode') === 'true') {
        actualMode = 'light';
    }
    
    // Coffee sub-theme switch (light vs dark coffee)
    if (actualMode === 'coffee') {
        const isCoffeeDark = getCookie('coffeeDarkMode') === 'true';
        if (isCoffeeDark) {
            actualMode = 'coffee-dark';
        }
    }
    
    applyThemeModeClass(actualMode);
    updateSmartDarkModeStatus(mode);
    updateDropdownUI(mode, actualMode);
    updateSubTogglesVisibility(mode);
}

function updateDropdownUI(mode, actualMode) {
    const currentText = document.getElementById('currentThemeText');
    const currentIcon = document.getElementById('currentThemeIcon');
    
    if (currentText) {
        const labels = { system: 'System', light: 'Light', dark: 'Dark', coffee: 'Coffee' };
        currentText.textContent = labels[mode] || 'System';
    }
    
    if (currentIcon) {
        currentIcon.className = ''; // Reset classes
        if (mode === 'system') {
            currentIcon.className = 'fa-solid fa-circle-half-stroke';
        } else if (mode === 'light') {
            currentIcon.className = 'fa-solid fa-sun';
        } else if (mode === 'dark') {
            currentIcon.className = 'fa-solid fa-moon';
        } else if (mode === 'coffee') {
            currentIcon.className = 'fa-solid fa-mug-hot';
        }
        currentIcon.style.color = 'var(--color-primary)';
    }
    
    document.querySelectorAll('#themeDropdown .theme-dropdown-item').forEach(item => {
        if (item.dataset.theme === mode) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });
}

function updateSmartDarkModeStatus(mode) {
    const statusEl = document.getElementById('smartDarkModeStatus');
    if (!statusEl) return;

    if (mode === 'system') {
        statusEl.textContent = 'Auto switch based on time/OS';
    } else if (mode === 'dark') {
        statusEl.textContent = 'Dark mode active';
    } else if (mode === 'light') {
        statusEl.textContent = 'Light mode active';
    } else if (mode === 'coffee') {
        const isCoffeeDark = getCookie('coffeeDarkMode') === 'true';
        statusEl.textContent = isCoffeeDark ? 'Coffee Espresso (Dark) active' : 'Coffee Latte (Light) active';
    }
}

function updateSubTogglesVisibility(mode) {
    const pureLightEl = document.getElementById('pureLightModeOptions');
    
    if (pureLightEl) {
        pureLightEl.style.display = (mode === 'system' || mode === 'light') ? 'flex' : 'none';
    }
}

function updateThemeColor(actualMode) {
    const metaThemeColor = document.querySelector('meta[name=theme-color]');
    if (!metaThemeColor) return;

    if (actualMode === 'dark' || actualMode === 'coffee-dark') {
        metaThemeColor.setAttribute('content', actualMode === 'coffee-dark' ? '#1c1510' : '#121212');
    } else if (actualMode === 'coffee') {
        metaThemeColor.setAttribute('content', '#fdf6e3');
    } else {
        metaThemeColor.setAttribute('content', '#faf9f5');
    }
}

function initThemeDropdown() {
    const selector = document.getElementById('themeModeSelector');
    const dropdown = document.getElementById('themeDropdown');
    
    if (selector && dropdown) {
        // Toggle dropdown
        selector.addEventListener('click', (e) => {
            e.stopPropagation();
            const isShowing = dropdown.classList.contains('show');
            
            // Close other dropdowns
            document.querySelectorAll('.show').forEach(el => {
                if (el !== dropdown) el.classList.remove('show');
            });
            
            if (isShowing) {
                dropdown.classList.remove('show');
            } else {
                dropdown.classList.add('show');
            }
        });
        
        // Handle selection
        document.querySelectorAll('#themeDropdown .theme-dropdown-item').forEach(item => {
            item.addEventListener('click', (e) => {
                // If clicking the toggle switch or its container, do not select theme or close dropdown
                if (e.target.closest('.coffee-toggle-switch') || e.target.closest('.coffee-toggle-container')) {
                    return;
                }
                
                e.stopPropagation();
                const mode = item.dataset.theme;
                
                setCookie('theme', mode, 365);
                applyThemeBasedOnConditions();
                
                if (window.MaterioHaptics) {
                    window.MaterioHaptics.vibrate('tap');
                }
                
                dropdown.classList.remove('show');
            });
        });
        
        // Close when clicking outside
        document.addEventListener('click', (e) => {
            if (!selector.contains(e.target) && !dropdown.contains(e.target)) {
                dropdown.classList.remove('show');
            }
        });
    }
}

function initSubToggles() {
    const pureLightToggle = document.getElementById('pureLightModeToggle');
    const coffeeDarkToggle = document.getElementById('coffeeDarkModeToggle');
    
    if (pureLightToggle) {
        pureLightToggle.checked = getCookie('pureLightMode') === 'true';
        pureLightToggle.addEventListener('change', function () {
            if (window.MaterioHaptics) {
                window.MaterioHaptics.vibrate(this.checked ? 'toggleOn' : 'toggleOff');
            }
            setCookie('pureLightMode', this.checked ? 'true' : 'false', 365);
            applyThemeBasedOnConditions();
        });
    }
    
    if (coffeeDarkToggle) {
        // Prevent click events on the toggle from propagating and triggering theme selection
        const toggleWrapper = coffeeDarkToggle.closest('.coffee-toggle-switch');
        if (toggleWrapper) {
            toggleWrapper.addEventListener('click', (e) => {
                e.stopPropagation();
            });
        }

        coffeeDarkToggle.checked = getCookie('coffeeDarkMode') === 'true';
        coffeeDarkToggle.addEventListener('change', function (e) {
            e.stopPropagation();
            if (window.MaterioHaptics) {
                window.MaterioHaptics.vibrate(this.checked ? 'toggleOn' : 'toggleOff');
            }
            setCookie('coffeeDarkMode', this.checked ? 'true' : 'false', 365);
            applyThemeBasedOnConditions();
        });
    }
}

function startSmartDarkModeChecker() {
    if (smartDarkModeInterval) clearInterval(smartDarkModeInterval);
    smartDarkModeInterval = setInterval(() => {
        const mode = getCookie('theme') || 'system';
        if (mode === 'system') {
            applyThemeBasedOnConditions();
        }
    }, 60000);
}

function setupSystemThemeListener() {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
        const mode = getCookie('theme') || 'system';
        if (mode === 'system') {
            applyThemeBasedOnConditions();
        }
    });
}

function init() {
    initThemeDropdown();
    initSubToggles();
    applyThemeBasedOnConditions();
    startSmartDarkModeChecker();
    setupSystemThemeListener();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

window.applyThemeBasedOnConditions = applyThemeBasedOnConditions;

export {
    init,
    applyThemeModeClass as applyTheme,
    applyThemeBasedOnConditions,
    resolveSystemTheme,
    updateThemeColor,
    updateSmartDarkModeStatus
};