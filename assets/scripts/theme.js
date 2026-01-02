document.addEventListener("DOMContentLoaded", function () {
    const themeToggle = document.getElementById('themeToggle');
    const pureLightModeToggle = document.getElementById('pureLightModeToggle');
    const pureLightModeOptions = document.getElementById('pureLightModeOptions');
    const smartDarkModeStatus = document.getElementById('smartDarkModeStatus');

    // Smart dark mode time range (19:00 to 6:45)
    const SMART_DARK_START_HOUR = 19;
    const SMART_DARK_START_MINUTE = 0;
    const SMART_DARK_END_HOUR = 6;
    const SMART_DARK_END_MINUTE = 45;

    let smartDarkModeInterval = null;

    function setCookie(name, value, days) {
        let expires = "";
        if (days) {
            const date = new Date();
            date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
            expires = "; expires=" + date.toUTCString();
        }
        document.cookie = name + "=" + value + expires + "; path=/";
    }

    function getCookie(name) {
        const nameEQ = name + "=";
        const ca = document.cookie.split(";");
        for (let i = 0; i < ca.length; i++) {
            let c = ca[i].trim();
            if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length);
        }
        return null;
    }

    function applyTheme(isDark) {
        const elements = [
            document.body,
            document.querySelector('header'),
            document.querySelector('.navbar'),
            document.querySelector('.content'),
            document.getElementById('themeCard'),
            document.getElementById('bgToggleCard'),
            document.getElementById('popup'),
            document.getElementById('versionInfo'),
            document.getElementById('reading'),
            document.getElementById('notices'),
            document.getElementById('notificationBoard'),
            document.getElementById('advanced'),
            document.getElementById('about'),
            document.getElementById('cookiesToggleCard'), document.getElementById('paperModeCard'),
            document.getElementById('grainSizeControl'),
            document.getElementById('creatorInfo'),
            document.getElementById('licensesCard'),
            document.getElementById('miscCard'),
            document.getElementById('account'),
            document.getElementById('oiaa'),
            document.getElementById('gh'),
            document.getElementById('nightReadingCard'),
            document.getElementById('einkModeCard'),
            document.getElementById('tabSwitcherCard'),
            document.getElementById('blogs'),
            document.getElementById('blogPost1'),
            document.getElementById('blogPost2'),
            document.getElementById('blogPost3'),
            document.getElementById('blogPost4'),
            document.getElementById('blogPost5'),
            document.getElementById('recommendedPosts'),
            document.getElementById('recommendedPost1'),
            document.getElementById('recommendedPost2'),
            document.getElementById('recommendedPost3'),
            document.getElementById('recommendedPost4'),
            document.getElementById('recommendedPost5'),
            document.getElementById('wallpaperSelectionCard'),
            document.getElementById('getinsights'),
            document.getElementById('storageInfoCard'),
            document.getElementById('localCdnCard'),
            document.getElementById('serverTerminal'),
            document.getElementById('invertMode'),
            document.getElementById('clearSiteDataCard'),
            document.getElementById('noiseToggleCard'),
            document.getElementById('hapticToggleCard')

        ];
        const notifyCards = document.querySelectorAll('#notify');
        notifyCards.forEach(card => elements.push(card));

        elements.forEach(el => {
            if (el) {
                isDark ? el.classList.add('dark-mode') : el.classList.remove('dark-mode');
            }
        }); const giscusFrame = document.querySelector("iframe.giscus-frame");
        if (giscusFrame) {
            giscusFrame.contentWindow.postMessage(
                { giscus: { setConfig: { theme: isDark ? "http://localhost:8888/assets/style/giscus.css" : "noborder_light" } } },
                "https://giscus.app"
            );
        }
        // Sync theme with PDF iframe if it exists
        const pdfIframe = document.getElementById('pdf-iframe');
        if (pdfIframe && pdfIframe.contentWindow) {
            try {
                pdfIframe.contentWindow.postMessage({
                    type: 'themeMode',
                    isDark: isDark
                }, '*');
                // console.log('Theme sync sent to PDF iframe: ' + (isDark ? 'dark' : 'light'));
            } catch (e) {
                // console.log('Could not sync theme with PDF iframe: ' + e.message);
            }
        }
    }

    // Check if current time is within smart dark mode hours (19:00 - 6:45)
    function isSmartDarkModeTime() {
        const now = new Date();
        const currentHour = now.getHours();
        const currentMinute = now.getMinutes();
        const currentTimeInMinutes = currentHour * 60 + currentMinute;

        const startTimeInMinutes = SMART_DARK_START_HOUR * 60 + SMART_DARK_START_MINUTE; // 19:00 = 1140
        const endTimeInMinutes = SMART_DARK_END_HOUR * 60 + SMART_DARK_END_MINUTE; // 6:45 = 405

        // Time range spans midnight: 19:00 to 6:45
        // Active if: current >= 19:00 OR current < 6:45
        if (currentTimeInMinutes >= startTimeInMinutes || currentTimeInMinutes < endTimeInMinutes) {
            return true;
        }
        return false;
    }

    // Check if system prefers dark mode
    function systemPrefersDark() {
        return window.matchMedia("(prefers-color-scheme: dark)").matches;
    }

    // Determine if smart dark mode should be active
    function shouldApplySmartDarkMode() {
        const userTheme = getCookie("theme");
        const pureLightMode = getCookie("pureLightMode") === "true";

        // Smart dark mode only applies when:
        // 1. Dark mode toggle is OFF (userTheme !== "dark")
        // 2. System is NOT in dark mode
        // 3. Pure light mode is NOT enabled
        if (userTheme === "dark") {
            return false; // User explicitly wants dark mode all day
        }

        if (systemPrefersDark()) {
            return false; // System dark mode takes precedence
        }

        if (pureLightMode) {
            return false; // User wants pure light mode all day
        }

        // Apply smart switching based on time
        return isSmartDarkModeTime();
    }

    // Update status text
    function updateSmartDarkModeStatus() {
        if (!smartDarkModeStatus) return;

        const userTheme = getCookie("theme");
        const pureLightMode = getCookie("pureLightMode") === "true";

        if (userTheme === "dark") {
            smartDarkModeStatus.textContent = "Dark mode active";
        } else if (systemPrefersDark()) {
            smartDarkModeStatus.textContent = "Following system preference";
        } else if (pureLightMode) {
            smartDarkModeStatus.textContent = "Pure light mode active";
        } else {
            if (isSmartDarkModeTime()) {
                smartDarkModeStatus.textContent = "Smart Dark mode - will auto switch based on time";
            } else {
                smartDarkModeStatus.textContent = "Light mode - will auto switch based on time";
            }
        }
    }

    // Show/hide pure light mode options
    function updatePureLightModeVisibility() {
        if (!pureLightModeOptions) return;

        const userTheme = getCookie("theme");

        // Show pure light mode option when dark mode toggle is OFF
        // (regardless of system preference - user can override with pure light mode)
        if (userTheme !== "dark") {
            pureLightModeOptions.style.display = 'block';
        } else {
            pureLightModeOptions.style.display = 'none';
        }
    }

    // Apply theme based on all conditions
    function applyThemeBasedOnConditions() {
        const userTheme = getCookie("theme");

        if (userTheme === "dark") {
            // User explicitly wants dark mode
            themeToggle.checked = true;
            applyTheme(true);
        } else if (userTheme === "light") {
            // User explicitly wants light mode, but check smart dark mode
            if (shouldApplySmartDarkMode()) {
                themeToggle.checked = false; // Keep toggle off
                applyTheme(true); // But apply dark theme
            } else {
                themeToggle.checked = false;
                applyTheme(false);
            }
        } else {
            // No explicit theme, follow system or smart dark mode
            if (systemPrefersDark()) {
                themeToggle.checked = true;
                applyTheme(true);
            } else if (shouldApplySmartDarkMode()) {
                themeToggle.checked = false;
                applyTheme(true);
            } else {
                themeToggle.checked = false;
                applyTheme(false);
            }
        }

        updateSmartDarkModeStatus();
        updatePureLightModeVisibility();
    }

    // Initialize pure light mode toggle state
    function initPureLightMode() {
        if (!pureLightModeToggle) return;

        const pureLightMode = getCookie("pureLightMode") === "true";
        pureLightModeToggle.checked = pureLightMode;

        pureLightModeToggle.addEventListener("change", function () {
            // Haptic feedback
            if (window.MaterioHaptics) {
                window.MaterioHaptics.vibrate(this.checked ? 'toggleOn' : 'toggleOff');
            }

            const enabled = this.checked;
            setCookie("pureLightMode", enabled ? "true" : "false", 30);
            applyThemeBasedOnConditions();
        });
    }

    // Start smart dark mode checker (runs every minute)
    function startSmartDarkModeChecker() {
        // Clear existing interval if any
        if (smartDarkModeInterval) {
            clearInterval(smartDarkModeInterval);
        }

        // Check every minute
        smartDarkModeInterval = setInterval(() => {
            applyThemeBasedOnConditions();
        }, 60000); // 60 seconds
    }

    // Initialize
    initPureLightMode();
    applyThemeBasedOnConditions();
    startSmartDarkModeChecker();

    // Expose for testing (time override tests)
    window.applyThemeBasedOnConditions = applyThemeBasedOnConditions;

    // Theme toggle change handler
    themeToggle.addEventListener("change", function () {
        const isDark = this.checked;

        // Haptic feedback for toggle
        if (window.MaterioHaptics) {
            window.MaterioHaptics.vibrate(isDark ? 'toggleOn' : 'toggleOff');
        }

        setCookie("theme", isDark ? "dark" : "light", 30);

        // If turning off dark mode, clear pure light mode preference
        if (!isDark) {
            // Keep pureLightMode setting
        }

        applyTheme(isDark);
        updateSmartDarkModeStatus();
        updatePureLightModeVisibility();
    });
});

function updateThemeColor() {
    const isDarkMode = document.body.classList.contains("dark-mode");
    const metaThemeColor = document.querySelector("meta[name=theme-color]");

    if (metaThemeColor) {
        metaThemeColor.setAttribute("content", isDarkMode ? "#1a1a1a" : "#f2f2eb");
    }
}

const themeChoice = document.getElementById("themeToggle");
if (themeChoice) {
    themeChoice.addEventListener("click", () => {
        document.body.classList.toggle("dark-mode");
        updateThemeColor();
    });
}
document.addEventListener("DOMContentLoaded", updateThemeColor);

// Helper function for getCookie outside DOMContentLoaded
function getCookie(name) {
    const nameEQ = name + "=";
    const ca = document.cookie.split(";");
    for (let i = 0; i < ca.length; i++) {
        let c = ca[i].trim();
        if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length);
    }
    return null;
}

// Listen for system theme changes and update PDF iframe if using system theme
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function (e) {
    const userTheme = getCookie("theme");

    // Only auto-switch if using system theme (no explicit theme cookie)
    if (!userTheme) {
        const isDark = e.matches;

        // Update PDF iframe with new system theme
        const pdfIframe = document.getElementById('pdf-iframe');
        if (pdfIframe && pdfIframe.contentWindow) {
            try {
                pdfIframe.contentWindow.postMessage({
                    type: 'themeMode',
                    isDark: isDark
                }, '*');
                // console.log('System theme change detected, updated PDF iframe: ' + (isDark ? 'dark' : 'light'));
            } catch (err) {
                // console.log('Could not sync system theme change with PDF iframe: ' + err.message);
            }
        }
    }
});