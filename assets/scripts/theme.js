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
        let svgHtml = '';
        if (mode === 'system') {
            svgHtml = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" color="currentColor" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M14 21H16M14 21C13.1716 21 12.5 20.3284 12.5 19.5V17L12 17M14 21H10M10 21H8M10 21C10.8284 21 11.5 20.3284 11.5 19.5V17L12 17M12 17V21"></path>
                <path d="M16 3H8C5.17157 3 3.75736 3 2.87868 3.87868C2 4.75736 2 6.17157 2 9V11C2 13.8284 2 15.2426 2.87868 16.1213C3.75736 17 5.17157 17 8 17H16C18.8284 17 20.2426 17 21.1213 16.1213C22 15.2426 22 13.8284 22 11V9C22 6.17157 22 4.75736 21.1213 3.87868C20.2426 3 18.8284 3 16 3Z"></path>
            </svg>`;
        } else if (mode === 'light') {
            svgHtml = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" color="currentColor" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M17 12C17 14.7614 14.7614 17 12 17C9.23858 17 7 14.7614 7 12C7 9.23858 9.23858 7 12 7C14.7614 7 17 9.23858 17 12Z"></path>
                <path d="M12 2V3.5M12 20.5V22M19.0708 19.0713L18.0101 18.0106M5.98926 5.98926L4.9286 4.9286M22 12H20.5M3.5 12H2M19.0713 4.92871L18.0106 5.98937M5.98975 18.0107L4.92909 19.0714" stroke-linecap="round"></path>
            </svg>`;
        } else if (mode === 'dark') {
            svgHtml = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" color="currentColor" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21.5 14.0784C20.3003 14.7189 18.9301 15.0821 17.4751 15.0821C12.7491 15.0821 8.91792 11.2509 8.91792 6.52485C8.91792 5.06986 9.28105 3.69968 9.92163 2.5C5.66765 3.49698 2.5 7.31513 2.5 11.8731C2.5 17.1899 6.8101 21.5 12.1269 21.5C16.6849 21.5 20.503 18.3324 21.5 14.0784Z"></path>
            </svg>`;
        } else if (mode === 'coffee') {
            svgHtml = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" color="currentColor" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                <path d="M18.2505 10.5H19.6403C21.4918 10.5 22.0421 10.7655 21.9975 12.0838C21.9237 14.2674 20.939 16.8047 17 17.5"></path>
                <path d="M5.94627 20.6145C2.57185 18.02 2.07468 14.3401 2.00143 10.5001C1.96979 8.8413 2.45126 8.5 4.65919 8.5H15.3408C17.5487 8.5 18.0302 8.8413 17.9986 10.5001C17.9253 14.3401 17.4281 18.02 14.0537 20.6145C13.0934 21.3528 12.2831 21.5 10.9194 21.5H9.08064C7.71686 21.5 6.90658 21.3528 5.94627 20.6145Z"></path>
                <path d="M11.3089 2.5C10.7622 2.83861 10.0012 4 10.0012 5.5M7.53971 4C7.53971 4 7 4.5 7 5.5M14.0012 4C13.7279 4.1693 13.5 5 13.5 5.5" stroke-linejoin="round"></path>
            </svg>`;
        }
        currentIcon.innerHTML = svgHtml;
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
        statusEl.textContent = 'Changes with the daylight';
    } else if (mode === 'dark') {
        statusEl.textContent = 'After hours';
    } else if (mode === 'light') {
        statusEl.textContent = 'The morning brews';
    } else if (mode === 'coffee') {
        const isCoffeeDark = getCookie('coffeeDarkMode') === 'true';
        statusEl.textContent = isCoffeeDark ? 'Pure and concentrated espresso' : 'Smooth and creamy latte';
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

function cycleTheme() {
    const theme = getCookie('theme') || 'system';
    const isCoffeeDark = getCookie('coffeeDarkMode') === 'true';

    let nextTheme = 'system';
    let nextCoffeeDark = isCoffeeDark;

    if (theme === 'system') {
        nextTheme = 'light';
    } else if (theme === 'light') {
        nextTheme = 'dark';
    } else if (theme === 'dark') {
        nextTheme = 'coffee';
        nextCoffeeDark = false; // Latte first
    } else if (theme === 'coffee') {
        if (!isCoffeeDark) {
            nextTheme = 'coffee';
            nextCoffeeDark = true; // Espresso next
        } else {
            nextTheme = 'system';
        }
    }

    setCookie('theme', nextTheme, 365);
    setCookie('coffeeDarkMode', nextCoffeeDark ? 'true' : 'false', 365);

    const coffeeDarkToggle = document.getElementById('coffeeDarkModeToggle');
    if (coffeeDarkToggle) {
        coffeeDarkToggle.checked = nextCoffeeDark;
    }

    applyThemeBasedOnConditions();
    if (window.MaterioHaptics) {
        window.MaterioHaptics.vibrate('tap');
    }
}

window.cycleTheme = cycleTheme;
window.applyThemeBasedOnConditions = applyThemeBasedOnConditions;

export {
    init,
    applyThemeModeClass as applyTheme,
    applyThemeBasedOnConditions,
    resolveSystemTheme,
    updateThemeColor,
    updateSmartDarkModeStatus
};