function closePromoModal() {
    const modal = document.getElementById('promoModal');
    modal.style.display = 'none';
}

document.addEventListener('DOMContentLoaded', function () {
    var year = new Date().getFullYear();
    var creatorInfo = document.getElementById('creatorInfo');
    if (creatorInfo) {
        var p = creatorInfo.querySelector('p');
        if (p) {
            p.innerHTML = '&copy; ' + year + ' - Materio';
        }
    }

    // Check if offline and redirect to downloads tab
    checkOfflineAndRedirect();

    // Listen for online/offline changes
    window.addEventListener('online', () => {
        showAllTabs();
    });

    window.addEventListener('offline', () => {
        checkOfflineAndRedirect();
    });

    // Prevent ads inside callout blocks
    const calloutSelectors = [
        'blockquote.note',
        'blockquote.tip',
        'blockquote.important',
        'blockquote.warning',
        'blockquote.caution',
        'blockquote.success',
        'blockquote.info',
        '.callout-note',
        '.callout-tip',
        '.callout-important',
        '.callout-warning',
        '.callout-caution'
    ];

    const callouts = document.querySelectorAll(calloutSelectors.join(', '));
    callouts.forEach(callout => {
        callout.classList.add('google-auto-ads-ignore');
    });
});

// Offline detection and redirect to downloads
function checkOfflineAndRedirect() {
    if (!navigator.onLine) {
        // Hide all tabs except Downloads
        hideNonDownloadTabs();

        // Wait a bit for the page to fully load
        setTimeout(() => {
            // Directly show Downloads tab without needing login/dropdown
            showDownloadsTabOffline();
        }, 500);
    } else {
        // Online - show all tabs
        showAllTabs();
    }
}

// Show Downloads tab directly (works even when not logged in)
function showDownloadsTabOffline() {
    const tabLinks = document.querySelectorAll('.tab-link');
    const tabContents = document.querySelectorAll('.tab-content');
    const downloadsContent = document.getElementById('downloads');

    if (downloadsContent) {
        // Remove active class from all tabs and contents
        tabLinks.forEach(tab => tab.classList.remove('active'));
        tabContents.forEach(content => content.classList.remove('active'));

        // Show downloads content
        downloadsContent.classList.add('active');

        // Dispatch event to trigger downloads loading
        document.dispatchEvent(new Event('downloadsTabOpened'));
    } else {
        console.error('[Offline] Downloads tab element not found');
    }
}

// Hide all tabs except Downloads when offline
function hideNonDownloadTabs() {
    const tabs = document.querySelectorAll('.tab-button');
    tabs.forEach(tab => {
        const tabName = tab.getAttribute('data-tab');
        if (tabName !== 'downloads') {
            tab.style.display = 'none';
        }
    });
}

// Show all tabs when online
function showAllTabs() {
    const tabs = document.querySelectorAll('.tab-button');
    tabs.forEach(tab => {
        tab.style.display = '';
    });
}
function setCookie(name, value, days) {
    var expires = "";
    if (days) {
        var date = new Date();
        date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
        expires = "; expires=" + date.toUTCString();
    }
    document.cookie = name + "=" + (value || "") + expires + "; path=/";
}

function getCookie(name) {
    var nameEQ = name + "=";
    var ca = document.cookie.split(";");
    for (var i = 0; i < ca.length; i++) {
        var c = ca[i];
        while (c.charAt(0) == " ") c = c.substring(1, c.length);
        if (c.indexOf(nameEQ) == 0) return c.substring(nameEQ.length, c.length);
    }
    return null;
}
document.addEventListener("DOMContentLoaded", function () {
    const activeTab = getCookie("activeTab") || "home";
    const tabLinks = document.querySelectorAll(".tab-link");
    const tabContents = document.querySelectorAll(".tab-content");

    // Remove active class from all tabs and set icons to regular
    tabLinks.forEach(link => {
        link.classList.remove("active");
        const icon = link.querySelector('i');
        if (icon && !link.querySelector('img')) { // Skip profile icon with image
            icon.classList.remove('fas');
            icon.classList.add('far');
        }
    });

    tabContents.forEach(content => content.classList.remove("active"));

    const selectedTabLink = document.querySelector(`.tab-link[data-tab="${activeTab}"]`);
    if (selectedTabLink) {
        selectedTabLink.classList.add("active");
        const icon = selectedTabLink.querySelector('i');
        if (icon && !selectedTabLink.querySelector('img')) { // Skip profile icon with image
            icon.classList.remove('far');
            icon.classList.add('fas');
        }
        document.getElementById(activeTab)?.classList.add("active");
    } else {
        const homeLink = document.querySelector('.tab-link[data-tab="home"]');
        homeLink.classList.add("active");
        const icon = homeLink.querySelector('i');
        if (icon && !homeLink.querySelector('img')) {
            icon.classList.remove('far');
            icon.classList.add('fas');
        }
        document.getElementById("home").classList.add("active");
    }

    tabLinks.forEach(link => {
        link.addEventListener("click", function (e) {
            // Check if this is the profile icon with dropdown functionality
            if (this.classList.contains('profile-icon') && this.classList.contains('has-dropdown')) {
                return; // Don't execute tab switching for profile dropdown
            }

            e.preventDefault();

            // Remove active class and change icons back to regular for all tabs
            tabLinks.forEach(tab => {
                tab.classList.remove("active");
                const icon = tab.querySelector('i');
                if (icon && !tab.querySelector('img')) {
                    icon.classList.remove('fas');
                    icon.classList.add('far');
                }
            });

            tabContents.forEach(content => content.classList.remove("active"));

            // Add active class and change icon to solid
            this.classList.add("active");
            const icon = this.querySelector('i');
            if (icon && !this.querySelector('img')) {
                icon.classList.remove('far');
                icon.classList.add('fas');
            }

            const tab = this.getAttribute("data-tab");
            document.getElementById(tab)?.classList.add("active");
            setCookie("activeTab", tab, 7);

            // Hide search dropdown when switching away from home tab
            const searchResults = document.getElementById('quickSearchResults');
            if (searchResults && tab !== 'home') {
                searchResults.style.display = 'none';
            }
        });
    });
});


const submitButton = document.getElementById('submitButton');
const popup = document.getElementById('popup');
const closePopup = document.getElementById('closePopup');

submitButton.addEventListener('click', async () => {
    const semester = document.getElementById('semesterSelect').value;
    const subject = document.getElementById('subjectSelect').value;
    const categorySelect = document.getElementById('categorySelect');
    const topic = document.getElementById('topicSelect').value;

    if (!semester || !subject || categorySelect.selectedIndex === 0 || !topic) {
        const roasts = [
            { message: "Start Reading what? The entire syllabus in one night? Pick a topic before the speedrun glitch-abuses you.", button: "Fair..." },
            { message: "Bro hit Start Reading like he’s about to unlock 16 weeks of content in 16 seconds. Select something before the game crashes.", button: "Valid" },
            { message: "Calm down, scholar. You can’t speedrun the whole syllabus by mashing Start Reading. Choose a chapter before attempting the world record.", button: "Alright, alright" },
            { message: "Trying to Start Reading without picking anything? That’s peak “exam is tomorrow so let me learn the entire degree tonight” energy. Select something.", button: "True" },
            { message: "You pressed Start Reading like Netflix’s “Skip Intro” works on coursework. It doesn’t. Pick a topic.", button: "Touché" },
            { message: "Start Reading with no selection? Bro’s on that “I’ll finish the syllabus tonight, trust me” delusion. Choose something real.", button: "My bad" },
            { message: "You tried to read nothing. Classic exam-eve panic maneuver. Grab a topic before the syllabus grabs YOU.", button: "Okay fine" },
            { message: "This isn’t a Marvel recap. You can’t skip 5 months and Start Reading. Make a selection first, prodigy.", button: "Fair point" },
            { message: "Pressing Start Reading with zero choices… bold. That’s some last-minute all-nighter confidence right there. Select something.", button: "I’ll behave" },
            { message: "Trying to absorb knowledge telepathically now? Pick what you want to read before going full Doctor Strange on the syllabus.", button: "Say less" },
            { message: "Start Reading what exactly? The void? Bro really queued up for the entire syllabus any% speedrun with ZERO selections. Touch some topics first.", button: "My fault gang" },
            { message: "Bro slammed Start Reading like he’s about to fast-travel through 16 weeks in 16 milliseconds. Select something before reality blue-screens.", button: "Real." },
            { message: "Holdup prodigy. You cannot speedrun academia by mashing Start Reading like it's a broken controller. Pick a chapter before activating godmode.", button: "Aight bet" },
            { message: "No selection and still hit Start Reading?? That’s peak ‘exam tomorrow so let me download knowledge via Bluetooth’ behavior. Choose something.", button: "Skill issue tbh" },
            { message: "Bro pressed Start Reading like school has a Skip Intro button. This isn’t Netflix, scholar. Pick a topic before the credits roll.", button: "Trueee" },
            { message: "Start Reading with no selection?? Bro is deep in exam-eve delusion arc thinking he’ll absorb the syllabus osmosis-style. Choose something real.", button: "Ok fine 😭" },
            { message: "Reading nothing?? Peak panic speedrun strat. Pick a topic before the syllabus jumpscares YOU.", button: "Understandable" },
            { message: "This isn’t Marvel bro. You can’t skip 5 months of classes and hit Start Reading like it's a recap episode. Select something before Phase 6 drops.", button: "Fair point ig" },
            { message: "Start Reading with zero choices??? Nah that’s last-minute all-nighter menace behavior. Pick your fate before proceeding.", button: "I'll behave 💀" },
            { message: "Bro tried to Start Reading telepathically. This ain't Doctor Strange multiverse knowledge absorption. Select a topic before casting spells.", button: "Say less wizard" }
        ];
        const randomRoast = roasts[Math.floor(Math.random() * roasts.length)];

        materioAlert(randomRoast.message, {
            title: 'Selection Required',
            type: 'warning',
            buttonText: randomRoast.button
        });
        return;
    }

    // Check if the caching system is available and use it
    if (typeof window.loadPdfWithCache === 'function') {
        let pdfUrl;

        // Special handling for Vault (semester 9999)
        if (semester === '9999') {
            // Format: pdfs/9999/UUID/vault/filename.pdf
            pdfUrl = `https://cdn-materioa.vercel.app/pdfs/${semester}/${subject}/vault/${topic}.pdf`;
        } else {
            // Normal format: pdfs/semester/subject/topic.pdf
            pdfUrl = `https://cdn-materioa.vercel.app/pdfs/${semester}/${subject}/${topic}.pdf`;
        }

        // Transform to local CDN if enabled
        pdfUrl = window.MaterioLocalCDN?.transformUrl(pdfUrl) || pdfUrl;

        // Use the cached loading system
        window.loadPdfWithCache(pdfUrl);
        popup.classList.remove('closing');
        popup.style.display = 'block';
    } else {
        // Fallback to original behavior if caching system not available
        let pdfUrl;

        // Special handling for Vault (semester 9999)
        if (semester === '9999') {
            // Format: pdfs/9999/UUID/vault/filename.pdf
            pdfUrl = `https://cdn-materioa.vercel.app/pdfs/${semester}/${subject}/vault/${topic}.pdf`;
        } else {
            // Normal format: pdfs/semester/subject/topic.pdf
            pdfUrl = `https://cdn-materioa.vercel.app/pdfs/${semester}/${subject}/${topic}.pdf`;
        }

        // Transform to local CDN if enabled
        pdfUrl = window.MaterioLocalCDN?.transformUrl(pdfUrl) || pdfUrl;
        document.getElementById('popupContent').innerHTML =
            `<iframe id="pdf-iframe" scrolling='no' allowfullscreen webkitallowfullscreen style="border:none; width:100%; height:calc(100% - 17px); border-radius:25px; margin-top:22px; corner-shape: squircle;" 
        src="/oread/web/viewer.html?disableStream=false&disableRange=false&rangeChunkSize=1048576&file=${encodeURIComponent(pdfUrl)}"></iframe>`;

        popup.classList.remove('closing');
        popup.style.display = 'block';
    }
});

closePopup.addEventListener('click', () => {
    popup.classList.add('closing');
});

popup.addEventListener('animationend', (event) => {
    if (event.animationName === 'popupFadeOut') {
        popup.style.display = 'none';
        popup.classList.remove('closing');
    }
});

document.addEventListener('DOMContentLoaded', function () {
    const tabLinks = document.querySelectorAll('.tab-link');
    const tabContents = document.querySelectorAll('.tab-content');

    tabLinks.forEach(link => {
        link.addEventListener('click', function (e) {
            e.preventDefault();

            // Remove active class and change icons back to regular for all tabs
            tabLinks.forEach(tab => {
                tab.classList.remove('active');
                const icon = tab.querySelector('i');
                if (icon && !tab.querySelector('img')) { // Skip profile icon with image
                    icon.classList.remove('fas');
                    icon.classList.add('far');
                }
            });

            // Remove active class from all tab contents
            tabContents.forEach(content => content.classList.remove('active'));

            // Add active class to clicked tab and change icon to solid
            this.classList.add('active');
            const icon = this.querySelector('i');
            if (icon && !this.querySelector('img')) { // Skip profile icon with image
                icon.classList.remove('far');
                icon.classList.add('fas');
            }

            // Show the corresponding tab content
            const tab = this.getAttribute('data-tab');
            document.getElementById(tab).classList.add('active');
        });
    });
});

document.addEventListener('DOMContentLoaded', function () {
    const libUrl = window.MaterioLocalCDN?.transformUrl('https://cdn-materioa.vercel.app/databases/beta/resource.lib.json') || 'https://cdn-materioa.vercel.app/databases/beta/resource.lib.json';
    fetch(libUrl)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            if (!data || typeof data !== 'object') {
                throw new Error('Invalid data format received');
            }
            const semesterMapping = { "9": "Additional Resources" };
            const semesterSelect = document.getElementById('semesterSelect');
            semesterSelect.innerHTML = '';
            const placeholder = document.createElement('option');
            placeholder.value = '';
            placeholder.textContent = 'Select Semester';
            semesterSelect.appendChild(placeholder);

            for (let sem in data) {
                const option = document.createElement('option');
                option.value = sem;
                option.textContent = semesterMapping[sem] ? semesterMapping[sem] : "Semester " + sem;
                if (sem === "6") {
                    option.selected = true;
                }
                semesterSelect.appendChild(option);
            }

            if (semesterSelect.value) {
                semesterSelect.dispatchEvent(new Event('change'));
            }

            semesterSelect.addEventListener('change', function () {
                clearSelect('subjectSelect', 'Select Subject');
                clearSelect('categorySelect', 'Select Category');
                clearSelect('topicSelect', 'Select Topic');
                const semKey = this.value;
                if (!semKey) return;
                const subjects = data[semKey];
                const subjectSelect = document.getElementById('subjectSelect');

                // Special handling for Vault (semester 9999)
                if (semKey === '9999') {
                    // Extract UUID and use it as the subject
                    if (subjects.uuid) {
                        const option = document.createElement('option');
                        option.value = subjects.uuid;
                        option.textContent = 'Vault';  // Display name
                        subjectSelect.appendChild(option);
                        subjectSelect.disabled = false;
                        // Auto-select and trigger change
                        subjectSelect.value = subjects.uuid;
                        subjectSelect.dispatchEvent(new Event('change'));
                    }
                } else {
                    // Normal semester handling
                    for (let subject in subjects) {
                        const option = document.createElement('option');
                        option.value = subject;
                        option.textContent = subject;
                        subjectSelect.appendChild(option);
                    }
                    subjectSelect.disabled = false;
                }
            });

            document.getElementById('subjectSelect').addEventListener('change', function () {
                clearSelect('categorySelect', 'Select Category');
                clearSelect('topicSelect', 'Select Topic');
                const semKey = document.getElementById('semesterSelect').value;
                const subjectKey = this.value;
                if (!subjectKey) return;

                let categoriesArr;

                // Special handling for Vault (semester 9999)
                if (semKey === '9999') {
                    // Get Vault array directly
                    categoriesArr = data[semKey].Vault;
                } else {
                    // Normal semester handling
                    categoriesArr = data[semKey][subjectKey];
                }

                const categorySelect = document.getElementById('categorySelect');
                if (categoriesArr && categoriesArr.length) {
                    let defaultSet = false;
                    categoriesArr.forEach((catObj, idx) => {
                        const option = document.createElement('option');
                        option.value = idx;
                        option.textContent = catObj.type;
                        if (catObj.type.trim().toLowerCase() === "chapters") {
                            option.selected = true;
                            defaultSet = true;
                        }
                        categorySelect.appendChild(option);
                    });
                    categorySelect.disabled = false;
                    if (defaultSet) {
                        categorySelect.dispatchEvent(new Event('change'));
                    }
                }
            });

            document.getElementById('categorySelect').addEventListener('change', function () {
                clearSelect('topicSelect', 'Select Topic');
                const semKey = document.getElementById('semesterSelect').value;
                const subjectKey = document.getElementById('subjectSelect').value;
                const categoryIndex = this.value;
                if (categoryIndex === '') return;

                let catObj;

                // Special handling for Vault (semester 9999)
                if (semKey === '9999') {
                    // Get category from Vault array
                    catObj = data[semKey].Vault[categoryIndex];
                } else {
                    // Normal semester handling
                    catObj = data[semKey][subjectKey][categoryIndex];
                }

                const topics = catObj.content;
                const topicSelect = document.getElementById('topicSelect');
                if (topics && topics.length > 0) {
                    topics.forEach(topic => {
                        const option = document.createElement('option');
                        option.value = topic;
                        option.textContent = topic;
                        topicSelect.appendChild(option);
                    });
                    topicSelect.disabled = false;
                }
            });

            function clearSelect(selectId, placeholder) {
                const select = document.getElementById(selectId);
                select.innerHTML = '';
                const option = document.createElement('option');
                option.value = '';
                option.textContent = placeholder;
                select.appendChild(option);
                select.disabled = true;
            }
        })
        .catch(err => {
            console.error('Error loading resource library:', err);
            // Only show alert when online (offline is expected to fail)
            if (navigator.onLine) {
                const roasts = [
                    { message: "The page is missing a few ingredients. Bro cooked without onions AND salt. Refresh before the dish reports YOU.", button: "Chef moment" },
                    { message: "Resources didn’t load. The page said ‘nah I’m on break.’ Try again before it unionizes.", button: "I'll negotiate" },
                    { message: "The page tried to fetch files but the internet said ‘skill issue.’ Refresh and pray.", button: "True…" },
                    { message: "Some ingredients refused to spawn. RNG is trash today. Reload for better loot.", button: "Reroll" },
                    { message: "The page lagged out mid-load like it’s running on hostel WiFi. Refresh to revive.", button: "Revive pls" },
                    { message: "Something didn’t load. The resources are probably hiding in creative mode.", button: "Teleport them" },
                    { message: "Page assets dipped without notice. They said ‘brb’ and never came back.", button: "Ghosted 💔" },
                    { message: "Resources missing. Bro tried to cook Maggi without Maggi.", button: "Valid" },
                    { message: "The page ingredients clipped through the map. Reload to respawn them.", button: "Respawn" },
                    { message: "Resources refused to load because the syllabus stress aura is too strong.", button: "My bad aura" },
                    { message: "The page couldn’t load stuff. Probably buffering its life choices.", button: "Same tbh" },
                    { message: "Missing ingredients? This page is rawer than a cooking show disaster.", button: "Gordon who?" },
                    { message: "The page tried to load but tripped over its own assets. Reload to help it up.", button: "I'll help" },
                    { message: "Some resources froze like a Windows XP moment. Refresh before it plays the startup sound.", button: "Reboot" },
                    { message: "The page is missing files because the network rage-quit mid-load.", button: "Unrage pls" },
                    { message: "Resources didn’t load. They’re probably respawning in another timeline.", button: "Multiverse moment" },
                    { message: "The page pulled a Thanos snap and half the assets vanished.", button: "Bring them back" },
                    { message: "Something didn’t load. The internet looked at your request and said ‘nah.’", button: "Understandable" },
                    { message: "Ingredients missing. The page is cooking vibes only, no content.", button: "Vibes accepted" },
                    { message: "The page tried to load resources but forgot its own ingredients list. Reload to remind it.", button: "I'll remind it" }
                ];
                const randomRoast = roasts[Math.floor(Math.random() * roasts.length)];

                materioAlert(randomRoast.message, {
                    title: 'Resource Load Error',
                    type: 'error',
                    buttonText: randomRoast.button
                });
            }
        });
});


const themeToggle = document.getElementById('themeToggle');
themeToggle.addEventListener('change', function () {
    // Existing elements
    const elements = [
        document.body,
        document.querySelector('header'),
        document.querySelector('.navbar'),
        document.querySelector('.content'),
        document.getElementById('themeCard'),
        document.getElementById('popup'),
        document.getElementById('versionInfo'),
        document.getElementById('reading'),
        document.getElementById('notices'),
        document.getElementById('notificationBoard'),
        document.getElementById('about'),
        document.getElementById('blogs'),
        document.getElementById('blogPostsContent')
    ];



    // Append all notification cards (they all share id "notify")
    const notifyCards = document.querySelectorAll('#notify');
    notifyCards.forEach(card => elements.push(card));

    // Append all dynamically created insight cards
    const insightCards = document.querySelectorAll('.insight-card');
    insightCards.forEach(item => elements.push(item));

    elements.forEach(el => {
        if (el) {
            this.checked ? el.classList.add('dark-mode') : el.classList.remove('dark-mode');
        }
    });
});


if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    themeToggle.checked = true;
    const elements = [
        document.body,
        document.querySelector('header'),
        document.querySelector('.navbar'),
        document.querySelector('.content'),
        document.getElementById('themeCard'),
        document.getElementById('popup'),
        document.getElementById('versionInfo'),
        document.getElementById('reading'),
        document.getElementById('notices'),
        document.getElementById('about'),
        document.getElementById('notificationBoard'),
        document.getElementById('blogs'),
        document.getElementById('blogPostsContent')
    ];
    elements.forEach(el => el.classList.add('dark-mode'));
}

document.addEventListener("DOMContentLoaded", function () {
    const isDark = document.body.classList.contains("dark-mode") ||
        (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
    const giscusScript = document.querySelector('script[src="https://giscus.app/client.js"]');
    if (giscusScript) {
        giscusScript.setAttribute('data-theme', isDark ? 'noborder_dark' : 'noborder_light');
    }
});

// Apply dark mode to dynamically loaded insight cards when they're loaded
window.addEventListener('insightroomPostsLoaded', function () {
    const isDark = document.body.classList.contains("dark-mode") ||
        (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);

    if (isDark) {
        const insightCards = document.querySelectorAll('.insight-card');
        insightCards.forEach(item => item.classList.add('dark-mode'));
    }
});

const fullscreenButton = document.getElementById('fullscreenButton');
fullscreenButton.addEventListener('click', () => {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().then(() => {
            popup.classList.add('fullscreen');
            // Change to exit fullscreen icon
            const icon = fullscreenButton.querySelector('i');
            icon.className = 'fa-solid fa-compress';
            fullscreenButton.setAttribute('aria-label', 'Exit fullscreen');
        }).catch(err => {
            console.error(`Failed to enable fullscreen mode: ${err.message}`);
        });
    } else {
        document.exitFullscreen().then(() => {
            popup.classList.remove('fullscreen');
            // Change to enter fullscreen icon
            const icon = fullscreenButton.querySelector('i');
            icon.className = 'fas fa-expand';
            fullscreenButton.setAttribute('aria-label', 'Enter fullscreen');
        }).catch(err => {
            console.error(`Failed to exit fullscreen mode: ${err.message}`);
        });
    }
});

// Function to load resources data
function loadResourcesData(restoreSemester = null) {
    const libUrl = window.MaterioLocalCDN?.transformUrl('https://cdn-materioa.vercel.app/databases/beta/resource.lib.json') || 'https://cdn-materioa.vercel.app/databases/beta/resource.lib.json';
    return fetch(libUrl)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            if (!data || typeof data !== 'object') {
                throw new Error('Invalid data format received');
            }
            const semesterMapping = {
                "9": "Additional Resources"
            };

            const semesterSelect = document.getElementById('semesterSelect');
            const currentSemester = restoreSemester || semesterSelect.value;

            semesterSelect.innerHTML = '';
            const placeholder = document.createElement('option');
            placeholder.value = '';
            placeholder.textContent = 'Select Semester';
            semesterSelect.appendChild(placeholder);

            for (let sem in data) {
                const option = document.createElement('option');
                option.value = sem;
                option.textContent = (semesterMapping[sem]) ? semesterMapping[sem] : "Semester " + sem;
                semesterSelect.appendChild(option);
            }

            // Remove existing event listeners by cloning BEFORE setting value
            const oldSemesterSelect = semesterSelect;
            const newSemesterSelect = semesterSelect.cloneNode(true);
            oldSemesterSelect.parentNode.replaceChild(newSemesterSelect, oldSemesterSelect);

            // Now get the new element and set up everything
            const finalSemesterSelect = document.getElementById('semesterSelect');

            // Restore the previous semester value or set default to semester 5
            if (currentSemester && data[currentSemester]) {
                finalSemesterSelect.value = currentSemester;
            } else {
                // Default to semester 6
                finalSemesterSelect.value = "6";
            }

            finalSemesterSelect.addEventListener('change', function () {
                clearSelect('subjectSelect', 'Select Subject');
                clearSelect('categorySelect', 'Select Category');
                clearSelect('topicSelect', 'Select Topic');
                const semKey = this.value;
                if (!semKey) return;
                const subjects = data[semKey];
                const subjectSelect = document.getElementById('subjectSelect');
                for (let subject in subjects) {
                    const option = document.createElement('option');
                    option.value = subject;
                    option.textContent = subject;
                    subjectSelect.appendChild(option);
                }
                subjectSelect.disabled = false;
            });

            function clearSelect(selectId, placeholderText) {
                const select = document.getElementById(selectId);
                select.innerHTML = '';
                const option = document.createElement('option');
                option.value = '';
                option.textContent = placeholderText;
                select.appendChild(option);
                select.disabled = true;
            }

            // Trigger change event after everything is set up
            if (finalSemesterSelect.value) {
                finalSemesterSelect.dispatchEvent(new Event('change'));
            }

            return data;
        })
        .catch(err => {
            console.error('Error loading data:', err);
            throw err;
        });
}

// Initial load
loadResourcesData();

const libUrl = window.MaterioLocalCDN?.transformUrl('https://cdn-materioa.vercel.app/databases/beta/resource.lib.json') || 'https://cdn-materioa.vercel.app/databases/beta/resource.lib.json';
fetch(libUrl)
    .then(response => {
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        if (!data || typeof data !== 'object') {
            throw new Error('Invalid data format received');
        }
        const semesterMapping = {
            "9": "Additional Resources"
        };

        const semesterSelect = document.getElementById('semesterSelect');
        semesterSelect.innerHTML = '';
        const placeholder = document.createElement('option');
        placeholder.value = '';
        placeholder.textContent = 'Select Semester';
        semesterSelect.appendChild(placeholder);

        for (let sem in data) {
            const option = document.createElement('option');
            option.value = sem;
            option.textContent = (semesterMapping[sem]) ? semesterMapping[sem] : "Semester " + sem;
            semesterSelect.appendChild(option);
        }

        semesterSelect.value = "";
        if (semesterSelect.value) {
            semesterSelect.dispatchEvent(new Event('change'));
        }

        semesterSelect.addEventListener('change', function () {
            clearSelect('subjectSelect', 'Select Subject');
            clearSelect('categorySelect', 'Select Category');
            clearSelect('topicSelect', 'Select Topic');
            const semKey = this.value;
            if (!semKey) return;
            const subjects = data[semKey];
            const subjectSelect = document.getElementById('subjectSelect');
            for (let subject in subjects) {
                const option = document.createElement('option');
                option.value = subject;
                option.textContent = subject;
                subjectSelect.appendChild(option);
            }
            subjectSelect.disabled = false;
        }); function clearSelect(selectId, placeholderText) {
            const select = document.getElementById(selectId);
            select.innerHTML = '';
            const option = document.createElement('option');
            option.value = '';
            option.textContent = placeholderText;
            select.appendChild(option);
            select.disabled = true;
        }
    })
    .catch(err => {
        console.error('Error loading initial resource data:', err);
        // Only show alert when online (offline is expected to fail)
        if (navigator.onLine) {
            const roasts = [
                { message: "The page is missing a few ingredients. Bro cooked without onions AND salt. Refresh before the dish reports YOU.", button: "Chef moment" },
                { message: "Resources didn’t load. The page said ‘nah I’m on break.’ Try again before it unionizes.", button: "I'll negotiate" },
                { message: "The page tried to fetch files but the internet said ‘skill issue.’ Refresh and pray.", button: "True…" },
                { message: "Some ingredients refused to spawn. RNG is trash today. Reload for better loot.", button: "Reroll" },
                { message: "The page lagged out mid-load like it’s running on hostel WiFi. Refresh to revive.", button: "Revive pls" },
                { message: "Something didn’t load. The resources are probably hiding in creative mode.", button: "Teleport them" },
                { message: "Page assets dipped without notice. They said ‘brb’ and never came back.", button: "Ghosted 💔" },
                { message: "Resources missing. Bro tried to cook Maggi without Maggi.", button: "Valid" },
                { message: "The page ingredients clipped through the map. Reload to respawn them.", button: "Respawn" },
                { message: "Resources refused to load because the syllabus stress aura is too strong.", button: "My bad aura" },
                { message: "The page couldn’t load stuff. Probably buffering its life choices.", button: "Same tbh" },
                { message: "Missing ingredients? This page is rawer than a cooking show disaster.", button: "Gordon who?" },
                { message: "The page tried to load but tripped over its own assets. Reload to help it up.", button: "I'll help" },
                { message: "Some resources froze like a Windows XP moment. Refresh before it plays the startup sound.", button: "Reboot" },
                { message: "The page is missing files because the network rage-quit mid-load.", button: "Unrage pls" },
                { message: "Resources didn’t load. They’re probably respawning in another timeline.", button: "Multiverse moment" },
                { message: "The page pulled a Thanos snap and half the assets vanished.", button: "Bring them back" },
                { message: "Something didn’t load. The internet looked at your request and said ‘nah.’", button: "Understandable" },
                { message: "Ingredients missing. The page is cooking vibes only, no content.", button: "Vibes accepted" },
                { message: "The page tried to load resources but forgot its own ingredients list. Reload to remind it.", button: "I'll remind it" }
            ];
            const randomRoast = roasts[Math.floor(Math.random() * roasts.length)];

            materioAlert(randomRoast.message, {
                title: 'Resource Load Error',
                type: 'error',
                buttonText: randomRoast.button
            });
        }
    });

// Load licenses content
document.addEventListener('DOMContentLoaded', function () {
    // Load licenses text when the details element is opened
    const licensesCard = document.getElementById('licensesCard');
    if (licensesCard) {
        const details = licensesCard.querySelector('details');
        let licensesLoaded = false;

        details.addEventListener('toggle', function () {
            if (this.open && !licensesLoaded) {
                const licensesText = document.getElementById('licensesText');
                licensesText.textContent = 'Loading licenses...';

                fetch('/licenses.txt')
                    .then(response => {
                        if (!response.ok) {
                            throw new Error('Failed to load licenses');
                        }
                        return response.text();
                    })
                    .then(text => {
                        licensesText.textContent = text;
                        licensesLoaded = true;
                    })
                    .catch(error => {
                        console.error('Error loading licenses:', error);
                        licensesText.textContent = 'Error loading licenses. Please try again later.';
                    });
            }
        });
    }
});                // Tab switcher functionality
document.addEventListener('DOMContentLoaded', function () {
    const tabSwitcherCard = document.getElementById('tabSwitcherCard');
    if (tabSwitcherCard) {
        const tabTexts = tabSwitcherCard.querySelectorAll('.tab-text');
        const activeIndicator = document.getElementById('activeTabIndicator');
        const contentSections = document.querySelectorAll('.tab-content-section');                        // Initialize indicator position
        function updateIndicatorPosition(targetTab) {
            if (activeIndicator) {
                // Pill-shaped positioning - properly centered
                const leftPosition = targetTab === 'preferences' ? '0' : '50%';
                activeIndicator.style.left = leftPosition;
            }
        }

        tabTexts.forEach(tabText => {
            tabText.addEventListener('click', function () {
                const targetTab = this.getAttribute('data-target');

                // Update text states
                tabTexts.forEach(text => text.classList.remove('active'));
                this.classList.add('active');

                // Update indicator position smoothly
                updateIndicatorPosition(targetTab);

                // Hide all content sections
                contentSections.forEach(section => {
                    section.classList.remove('active');
                });

                // Show target content section with slight delay
                const targetContent = document.getElementById(targetTab + '-content');
                if (targetContent) {
                    setTimeout(() => {
                        targetContent.classList.add('active');
                    }, 150);
                }
            });
        });

        // Initialize position on load
        const activeTab = document.querySelector('.tab-text.active');
        if (activeTab) {
            // Wait for layout to be ready
            requestAnimationFrame(() => {
                updateIndicatorPosition(activeTab.getAttribute('data-target'));
            });
        }

        // Update position on window resize
        window.addEventListener('resize', () => {
            const activeTab = document.querySelector('.tab-text.active');
            if (activeTab) {
                requestAnimationFrame(() => {
                    updateIndicatorPosition(activeTab.getAttribute('data-target'));
                });
            }
        });
    }
});

// Handle info icon click/tap to show tooltip
document.addEventListener('DOMContentLoaded', function () {
    const infoIcons = document.querySelectorAll('.info-icon');

    function adjustTooltipPosition(icon) {
        const tooltip = icon.querySelector('.tooltip');
        if (!tooltip || window.innerWidth > 768) return;

        // Reset classes
        tooltip.classList.remove('flip-left');

        // Check if tooltip would go off-screen to the right
        const iconRect = icon.getBoundingClientRect();
        const tooltipRect = tooltip.getBoundingClientRect();
        const viewportWidth = window.innerWidth;

        if (iconRect.left + 200 > viewportWidth - 20) {
            tooltip.classList.add('flip-left');
        }
    }

    infoIcons.forEach(icon => {
        // Handle both click and touch events
        icon.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();

            // Toggle active class for this icon
            this.classList.toggle('active');

            // Close other open tooltips
            infoIcons.forEach(otherIcon => {
                if (otherIcon !== this) {
                    otherIcon.classList.remove('active');
                }
            });

            // Adjust positioning if needed (mobile)
            if (this.classList.contains('active')) {
                setTimeout(() => adjustTooltipPosition(this), 10);
            }
        });

        // Handle touch events for better mobile experience
        icon.addEventListener('touchstart', function (e) {
            e.preventDefault();
            e.stopPropagation();
        });
    });

    // Close tooltip when clicking/touching outside
    document.addEventListener('click', function (e) {
        if (!e.target.closest('.info-icon')) {
            infoIcons.forEach(icon => {
                icon.classList.remove('active');
            });
        }
    });

    // Close tooltip on touch outside for mobile
    document.addEventListener('touchstart', function (e) {
        if (!e.target.closest('.info-icon')) {
            infoIcons.forEach(icon => {
                icon.classList.remove('active');
            });
        }
    });

    // Close tooltip when scrolling on mobile - use passive listener
    document.addEventListener('scroll', function () {
        if (window.innerWidth <= 768) {
            infoIcons.forEach(icon => {
                icon.classList.remove('active');
            });
        }
    }, { passive: true });

    // Reposition tooltips on window resize
    window.addEventListener('resize', function () {
        infoIcons.forEach(icon => {
            if (icon.classList.contains('active')) {
                adjustTooltipPosition(icon);
            }
        });
    });
});

// ================================================
// INSIGHTROOM API - LOAD POSTS FROM API
// ================================================

const INSIGHTROOM_API = 'https://insightroom.vercel.app/api/posts';

// Function to load posts from InsightRoom API
async function loadInsightroomPosts() {
    const defaultPostsContainer = document.getElementById('defaultPosts');
    const loadingEl = document.getElementById('postsLoading');
    const errorEl = document.getElementById('postsError');
    const allPostsDataEl = document.getElementById('allPostsData');

    if (!defaultPostsContainer || !allPostsDataEl) return;

    try {
        const response = await fetch(INSIGHTROOM_API);
        if (!response.ok) throw new Error('Failed to fetch posts');

        const allPosts = await response.json();

        // Filter out private posts and get latest 5
        const publicPosts = allPosts.filter(post => post.visibility !== 'private');
        const latestPosts = publicPosts.slice(0, 5);

        // Hide loading
        if (loadingEl) loadingEl.style.display = 'none';

        // Render posts as horizontal scrolling squircle cards
        latestPosts.forEach((post, index) => {
            const postDate = new Date(post.date);
            const formattedDate = postDate.toLocaleDateString('en-GB', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
            }).replace(/\//g, '-');

            const excerpt = post.excerpt || '';
            const truncatedExcerpt = excerpt.split(' ').slice(0, 12).join(' ') + (excerpt.split(' ').length > 12 ? '...' : '');

            // Use imgUrl from API or fallback to noidea.png
            let imageUrl = post.imgUrl || '';
            if (!imageUrl || imageUrl === 'null' || imageUrl === 'undefined' || imageUrl.trim() === '') {
                imageUrl = '/assets/img/noidea.png';
            }

            const postHTML = `
                <a href="${post.link}" class="insight-card-link" target="_blank" ${post.visibility === 'private' ? 'data-visibility="private"' : ''}>
                    <article class="insight-card" id="blogPost${index + 1}" style="--card-bg: url('${imageUrl}')">
                        <div class="insight-card-bg"></div>
                        <div class="insight-card-gradient"></div>
                        <div class="insight-card-content">
                            <h3 class="insight-card-title">${post.title}</h3>
                            <p class="insight-card-excerpt">${truncatedExcerpt} <span class="insight-card-read-more">Read</span></p>
                            <span class="insight-card-date">${formattedDate}</span>
                        </div>
                    </article>
                </a>
            `;
            defaultPostsContainer.insertAdjacentHTML('beforeend', postHTML);
        });

        // Populate allPostsData for filtering/recommendations
        const postsData = publicPosts.map(post => ({
            title: post.title,
            url: post.link,
            date: new Date(post.date).toLocaleDateString('en-GB', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
            }).replace(/\//g, '-'),
            imgUrl: post.imgUrl || '',
            excerpt_home: post.excerpt || '',
            excerpt: post.excerpt || '',
            semester: post.semester || '',
            subject: post.subject || '',
            visibility: post.visibility || 'public'
        }));
        allPostsDataEl.textContent = JSON.stringify(postsData);

        // Apply dark mode to dynamically created posts if dark mode is active
        const isDarkMode = document.body.classList.contains('dark-mode') ||
            (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);

        if (isDarkMode) {
            latestPosts.forEach((post, index) => {
                const postElement = document.getElementById(`blogPost${index + 1}`);
                if (postElement) {
                    postElement.classList.add('dark-mode');
                }
            });
        }

        // Dispatch event to notify that posts are loaded
        window.dispatchEvent(new CustomEvent('insightroomPostsLoaded', { detail: postsData }));

    } catch (error) {
        console.error('Error loading InsightRoom posts:', error);
        if (loadingEl) loadingEl.style.display = 'none';
        if (errorEl) errorEl.style.display = 'block';
    }
}

// Load InsightRoom posts on DOM ready
document.addEventListener('DOMContentLoaded', loadInsightroomPosts);

// ================================================
// SMART RECOMMENDATION SYSTEM
// ================================================

// Smart Recommendation System
document.addEventListener('DOMContentLoaded', function () {
    const semesterSelect = document.getElementById('semesterSelect');
    const subjectSelect = document.getElementById('subjectSelect');
    const blogCardHeading = document.getElementById('blogCardHeading');
    const defaultPosts = document.getElementById('defaultPosts');
    const recommendedPosts = document.getElementById('recommendedPosts');
    const noPostsMessage = document.getElementById('noPostsMessage');
    const allPostsDataElement = document.getElementById('allPostsData');

    // Parse all posts data - will be populated by loadInsightroomPosts
    let allPosts = [];

    // Function to parse posts data
    function parsePostsData() {
        try {
            allPosts = JSON.parse(allPostsDataElement.textContent);
        } catch (e) {
            console.error('Error parsing posts data:', e);
        }
    }

    // Initial parse (may be empty if API hasn't loaded yet)
    parsePostsData();

    // Re-parse when InsightRoom posts are loaded
    window.addEventListener('insightroomPostsLoaded', function (e) {
        parsePostsData();
    });

    // Check authentication and hide private posts if not authenticated
    checkAuthAndFilterPosts();

    // Function to check authentication and hide private posts
    async function checkAuthAndFilterPosts() {
        const token = localStorage.getItem('materio_auth_token');
        let hasAdminPrivileges = false;
        let isPlusUser = false;

        // Hide entire blogs card if user is not logged in
        const blogsCard = document.getElementById('blogs');
        if (!token) {
            if (blogsCard) {
                blogsCard.style.display = 'none';
            }
            return;
        }

        if (token) {
            try {
                const response = await fetch('/api/v2/profile', {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    credentials: 'same-origin'
                });

                if (response.ok) {
                    const userData = await response.json();
                    hasAdminPrivileges = userData.user?.hasAdminPrivileges || false;
                    isPlusUser = userData.user?.isPlusUser || false;
                } else {
                    // If API call fails, hide the blogs card
                    if (blogsCard) {
                        blogsCard.style.display = 'none';
                    }
                    return;
                }
            } catch (error) {
                // If auth check fails, hide the blogs card
                if (blogsCard) {
                    blogsCard.style.display = 'none';
                }
                return;
            }
        }

        // Show blogs card only if user is plus user OR admin
        if (blogsCard) {
            if (isPlusUser || hasAdminPrivileges) {
                blogsCard.style.display = 'block';
            } else {
                blogsCard.style.display = 'none';
                return;
            }
        }

        // Hide private posts in default listing if no admin privileges or plus membership
        if (!hasAdminPrivileges && !isPlusUser) {
            const privatePosts = document.querySelectorAll('#defaultPosts [data-visibility="private"]');
            privatePosts.forEach(post => {
                post.style.display = 'none';
            });
        }

        // Store private access status for filtering recommendations  
        window.materioUserHasPrivateAccess = hasAdminPrivileges || isPlusUser;
        window.materioUserHasAdminPrivileges = hasAdminPrivileges;

        // Apply appropriate logo based on user privileges
        const versionInfo = document.getElementById('versionInfo');
        if (versionInfo) {
            // Remove any existing privilege classes
            versionInfo.classList.remove('premium-user', 'plus-user', 'admin-user');

            // Apply the appropriate class based on privileges
            if (hasAdminPrivileges) {
                versionInfo.classList.add('admin-user');
            } else if (isPlusUser) {
                versionInfo.classList.add('plus-user');
            }
        }
    }

    // Function to create post HTML
    function createPostHTML(post, index) {
        const fullExcerpt = post.excerpt_home || post.excerpt || '';
        const truncatedExcerpt = fullExcerpt.split(' ').slice(0, 12).join(' ') + (fullExcerpt.split(' ').length > 12 ? '...' : '');
        const visibilityAttr = post.visibility === 'private' ? 'data-visibility="private"' : '';

        // Use imgUrl from API or fallback to noidea.png
        let imageUrl = post.imgUrl || '';
        if (!imageUrl || imageUrl === 'null' || imageUrl === 'undefined' || imageUrl.trim() === '') {
            imageUrl = '/assets/img/noidea.png';
        }

        return `
            <a href="${post.url}" class="insight-card-link" target="_blank" ${visibilityAttr}>
                <article class="insight-card" id="recommendedPost${index}" style="--card-bg: url('${imageUrl}')">
                    <div class="insight-card-bg"></div>
                    <div class="insight-card-gradient"></div>
                    <div class="insight-card-content">
                        <h3 class="insight-card-title">${post.title}</h3>
                        <p class="insight-card-excerpt">${truncatedExcerpt} <span class="insight-card-read-more">Read</span></p>
                        <span class="insight-card-date">${post.date}</span>
                    </div>
                </article>
            </a>
        `;
    }

    // Function to update blog recommendations
    function updateBlogRecommendations() {
        const selectedSemester = semesterSelect.value;
        const selectedSubject = subjectSelect.value;

        // If no semester or subject selected, show default posts
        if (!selectedSemester || !selectedSubject) {
            blogCardHeading.textContent = 'Latest from the Insightroom';
            defaultPosts.style.removeProperty('display');
            recommendedPosts.style.setProperty('display', 'none', 'important');
            noPostsMessage.style.display = 'none';
            return;
        }

        // Filter posts based on semester and subject
        const filteredPosts = allPosts.filter(post => {
            const selectedSem = String(selectedSemester).toLowerCase().trim();
            const selectedSub = String(selectedSubject).toLowerCase().trim();

            // Filter out private posts if user doesn't have admin privileges or plus access
            if (post.visibility === 'private' && !window.materioUserHasPrivateAccess) {
                return false;
            }

            // Handle semester matching (can be string or array)
            let semesterMatch = false;
            if (Array.isArray(post.semester)) {
                semesterMatch = post.semester.some(sem => String(sem).toLowerCase().trim() === selectedSem);
            } else if (post.semester) {
                semesterMatch = String(post.semester).toLowerCase().trim() === selectedSem;
            }

            // Handle subject matching (can be string or array)
            let subjectMatch = false;
            if (Array.isArray(post.subject)) {
                subjectMatch = post.subject.some(sub => String(sub).toLowerCase().trim() === selectedSub);
            } else if (post.subject) {
                subjectMatch = String(post.subject).toLowerCase().trim() === selectedSub;
            }

            return semesterMatch && subjectMatch;
        });

        // Update heading and content
        if (filteredPosts.length > 0) {
            blogCardHeading.innerHTML = '<i class="fa-solid fa-book-sparkles"></i> Smart Recommendations';
            defaultPosts.style.setProperty('display', 'none', 'important');
            noPostsMessage.style.display = 'none';
            recommendedPosts.style.removeProperty('display');

            // Limit to 5 posts and create HTML
            const postsToShow = filteredPosts.slice(0, 5);
            recommendedPosts.innerHTML = postsToShow
                .map((post, index) => createPostHTML(post, index + 1))
                .join('');

            // Apply current theme to newly created recommended posts
            const isDarkMode = document.body.classList.contains('dark-mode');
            postsToShow.forEach((post, index) => {
                const postElement = document.getElementById(`recommendedPost${index + 1}`);
                if (postElement) {
                    if (isDarkMode) {
                        postElement.classList.add('dark-mode');
                    } else {
                        postElement.classList.remove('dark-mode');
                    }
                }
            });
        } else {
            // No posts found for selected criteria
            blogCardHeading.innerHTML = '<i class="fa-solid fa-book-sparkles"></i> Smart Recommendations';
            defaultPosts.style.setProperty('display', 'none', 'important');
            recommendedPosts.style.setProperty('display', 'none', 'important');
            noPostsMessage.style.display = 'block';
        }
    }

    // Add event listeners to dropdowns
    semesterSelect.addEventListener('change', updateBlogRecommendations);
    subjectSelect.addEventListener('change', updateBlogRecommendations);
});

// ================================================
// AD-FREE EXPERIENCE FOR PLUS & ADMIN USERS
// ================================================

// Function to check if user has ad-free privileges
function checkAndApplyAdFreeExperience() {
    try {
        // Get user data from localStorage
        const userDataStr = localStorage.getItem('materio_user');
        if (!userDataStr) {
            // No user data, remove ad-free class if it exists
            document.body.classList.remove('ad-free-user');
            return false;
        }

        const userData = JSON.parse(userDataStr);

        // Check if user has plus or admin privileges
        const hasAdFreePrivileges = userData.isPlusUser === true || userData.hasAdminPrivileges === true;

        if (hasAdFreePrivileges) {
            // Apply ad-free experience
            document.body.classList.add('ad-free-user');

            // Hide any dynamically loaded ads
            hideExistingAds();

            return true;
        } else {
            // Remove ad-free class if user doesn't have privileges
            document.body.classList.remove('ad-free-user');
            return false;
        }
    } catch (error) {
        console.error('Error checking ad-free privileges:', error);
        // On error, don't apply ad-free experience (safe default)
        document.body.classList.remove('ad-free-user');
        return false;
    }
}

// Function to hide any existing ads that might have loaded
function hideExistingAds() {
    // Hide AdSense ads
    const adsenseElements = document.querySelectorAll('.adsbygoogle, ins[class*="adsbygoogle"]');
    adsenseElements.forEach(ad => {
        ad.style.display = 'none';
        ad.style.visibility = 'hidden';
    });

    // Hide common ad containers
    const adContainers = document.querySelectorAll(
        '.ad-container, .advertisement, .ad-banner, .google-ads, [id*="google_ads"], [class*="google-ad"]'
    );
    adContainers.forEach(container => {
        container.style.display = 'none';
    });
}

// Check for ad-free experience on page load
document.addEventListener('DOMContentLoaded', function () {
    checkAndApplyAdFreeExperience();
});

// Re-check when user data changes (e.g., after login/logout)
window.addEventListener('storage', function (e) {
    if (e.key === 'materio_user') {
        checkAndApplyAdFreeExperience();
    }
});
// Expose the function globally so other scripts can call it
window.checkAndApplyAdFreeExperience = checkAndApplyAdFreeExperience;

// ================================================
// INSIGHTROOM SECTION TOGGLE FUNCTIONALITY
// ================================================

// Function to get Insightroom settings from cookie (returns [enabled, view])
function getInsightroomSettings() {
    const settingsCookie = getCookie('insightroomSettings');
    if (settingsCookie) {
        try {
            const settings = JSON.parse(settingsCookie);
            if (Array.isArray(settings) && settings.length === 2) {
                return settings;
            }
        } catch (e) {
            console.warn('Error parsing insightroomSettings cookie:', e);
        }
    }
    // Default: [enabled=true, view='normal']
    return [true, 'normal'];
}

// Function to save Insightroom settings to cookie
function saveInsightroomSettings(enabled, view) {
    const settings = [enabled, view];
    setCookie('insightroomSettings', JSON.stringify(settings), 365);
}

// Function to handle Insightroom section visibility and view mode
function handleInsightroomToggle() {
    const insightroomToggle = document.getElementById('insightroomToggle');
    const blogsSection = document.getElementById('blogs');
    const viewOptions = document.getElementById('insightroomViewOptions');
    const dropdownWrapper = document.getElementById('viewStyleDropdownWrapper');
    const dropdownTrigger = document.getElementById('viewStyleDropdownTrigger');
    const dropdown = document.getElementById('viewStyleDropdown');
    const selectedText = document.getElementById('viewStyleSelectedText');
    const dropdownItems = document.querySelectorAll('.view-style-item');

    if (!insightroomToggle || !blogsSection) {
        return;
    }

    // Load saved preferences
    const [isEnabled, viewMode] = getInsightroomSettings();

    // Set toggle state
    insightroomToggle.checked = isEnabled;

    // Set dropdown selected state
    if (selectedText) {
        selectedText.textContent = viewMode === 'folded' ? 'Folded' : 'Normal';
    }

    // Mark the selected item
    dropdownItems.forEach(item => {
        if (item.dataset.value === viewMode) {
            item.classList.add('selected');
        } else {
            item.classList.remove('selected');
        }
    });

    // Show/hide view options based on toggle state
    if (viewOptions) {
        viewOptions.style.display = isEnabled ? 'block' : 'none';
    }

    // Apply initial state
    applyInsightroomViewMode(isEnabled, viewMode);

    // Add event listener for toggle changes
    insightroomToggle.addEventListener('change', function () {
        const enabled = this.checked;
        const currentView = selectedText && selectedText.textContent.toLowerCase() === 'folded' ? 'folded' : 'normal';

        // Show/hide view options
        if (viewOptions) {
            viewOptions.style.display = enabled ? 'block' : 'none';
        }

        applyInsightroomViewMode(enabled, currentView);
        saveInsightroomSettings(enabled, currentView);
    });

    // Dropdown toggle
    if (dropdownTrigger && dropdownWrapper) {
        dropdownTrigger.addEventListener('click', function (e) {
            e.stopPropagation();
            e.preventDefault();
            dropdownWrapper.classList.toggle('open');
            dropdown.classList.toggle('show');
        });
    }

    // Dropdown item selection
    dropdownItems.forEach(item => {
        item.addEventListener('click', function (e) {
            e.preventDefault();
            const value = this.dataset.value;
            const label = value === 'folded' ? 'Folded' : 'Normal';

            // Update selected text
            if (selectedText) {
                selectedText.textContent = label;
            }

            // Update selected state
            dropdownItems.forEach(i => i.classList.remove('selected'));
            this.classList.add('selected');

            // Close dropdown
            dropdownWrapper.classList.remove('open');
            dropdown.classList.remove('show');

            // Apply and save
            const enabled = insightroomToggle.checked;
            applyInsightroomViewMode(enabled, value);
            saveInsightroomSettings(enabled, value);
        });
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', function (e) {
        if (dropdownWrapper && !dropdownWrapper.contains(e.target)) {
            dropdownWrapper.classList.remove('open');
            if (dropdown) dropdown.classList.remove('show');
        }
    });
}

// Function to apply the Insightroom view mode
function applyInsightroomViewMode(enabled, viewMode) {
    const blogsSection = document.getElementById('blogs');
    const headerContainer = document.getElementById('blogHeaderContainer');
    const postsContainer = document.getElementById('blogPostsContent');
    const chevron = document.getElementById('blogFoldChevron');

    if (!blogsSection) return;

    if (!enabled) {
        // Section is disabled - hide everything
        blogsSection.style.display = 'none';
        return;
    }

    // Section is enabled
    blogsSection.style.display = 'block';

    if (viewMode === 'folded') {
        // Folded mode: show chevron, make header clickable, hide posts by default
        blogsSection.classList.add('blog-folded');
        if (chevron) {
            chevron.style.display = 'inline-block';
            chevron.style.transform = 'rotate(0deg)';
        }
        if (headerContainer) {
            headerContainer.style.cursor = 'pointer';
        }
        if (postsContainer) {
            postsContainer.style.display = 'none';
        }
        // Reset expanded state
        blogsSection.classList.remove('blog-expanded');
    } else {
        // Normal mode: hide chevron, show posts, header not clickable
        blogsSection.classList.remove('blog-folded');
        blogsSection.classList.remove('blog-expanded');
        if (chevron) {
            chevron.style.display = 'none';
        }
        if (headerContainer) {
            headerContainer.style.cursor = 'default';
        }
        if (postsContainer) {
            postsContainer.style.display = 'block';
        }
    }
}

// Function to toggle folded blog section expand/collapse
function toggleBlogFoldedState() {
    const blogsSection = document.getElementById('blogs');
    const postsContainer = document.getElementById('blogPostsContent');
    const chevron = document.getElementById('blogFoldChevron');

    if (!blogsSection || !postsContainer) return;

    const isExpanded = blogsSection.classList.contains('blog-expanded');

    if (isExpanded) {
        // Collapse - add blog-folded back for compact height
        blogsSection.classList.remove('blog-expanded');
        blogsSection.classList.add('blog-folded');
        postsContainer.style.display = 'none';
        if (chevron) {
            chevron.style.transform = 'rotate(0deg)';
        }
    } else {
        // Expand - remove blog-folded to allow full height
        blogsSection.classList.add('blog-expanded');
        blogsSection.classList.remove('blog-folded');
        postsContainer.style.display = 'block';
        if (chevron) {
            chevron.style.transform = 'rotate(180deg)';
        }
    }
}

// Initialize Insightroom toggle when DOM is loaded
document.addEventListener('DOMContentLoaded', function () {
    // Small delay to ensure all other elements are initialized first
    setTimeout(handleInsightroomToggle, 100);

    // Add click handler for header in folded mode
    const headerContainer = document.getElementById('blogHeaderContainer');
    if (headerContainer) {
        headerContainer.addEventListener('click', function (e) {
            // Only toggle if in folded mode (chevron is visible)
            const chevron = document.getElementById('blogFoldChevron');
            if (chevron && chevron.style.display !== 'none') {
                // Don't toggle if clicking on the View More link
                if (!e.target.closest('.view-more-btn')) {
                    toggleBlogFoldedState();
                }
            }
        });
    }
});

// ================================================
// CLEAR SITE DATA FUNCTIONALITY
// ================================================

// Function to clear all site data (cookies, cache, IndexedDB, service workers)
async function clearAllSiteData() {
    // Show confirmation dialog using custom modal
    const confirmed = await materioConfirm(
        'This will clear all site data including:\n\n• Cookies and local storage\n• Cached files\n• Your Downloaded files\n• Service workers\n\nYou will be logged out and all preferences will be reset.',
        {
            title: 'Clear All Data?',
            type: 'danger',
            confirmText: 'Clear All Data',
            cancelText: 'Cancel',
            danger: true
        }
    );

    if (!confirmed) return;

    try {
        // Show loading state
        const card = document.getElementById('clearSiteDataCard');
        if (card) {
            card.style.opacity = '0.5';
            card.style.pointerEvents = 'none';
        }

        // 1. Clear all cookies
        document.cookie.split(';').forEach(function (c) {
            const name = c.split('=')[0].trim();
            document.cookie = name + '=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/';
            document.cookie = name + '=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=' + window.location.hostname;
        });
        console.log('Cookies cleared');

        // 2. Clear localStorage
        localStorage.clear();
        console.log('localStorage cleared');

        // 3. Clear sessionStorage
        sessionStorage.clear();
        console.log('sessionStorage cleared');

        // 4. Clear IndexedDB databases
        if (window.indexedDB && indexedDB.databases) {
            const databases = await indexedDB.databases();
            for (const db of databases) {
                if (db.name) {
                    indexedDB.deleteDatabase(db.name);
                    console.log('Deleted IndexedDB:', db.name);
                }
            }
        }

        // 5. Unregister all service workers
        if ('serviceWorker' in navigator) {
            const registrations = await navigator.serviceWorker.getRegistrations();
            for (const registration of registrations) {
                await registration.unregister();
                console.log('Unregistered service worker:', registration.scope);
            }
        }

        // 6. Clear Cache Storage
        if ('caches' in window) {
            const cacheNames = await caches.keys();
            for (const cacheName of cacheNames) {
                await caches.delete(cacheName);
                console.log('Deleted cache:', cacheName);
            }
        }

        // Show success message using custom modal
        await materioAlert('All site data has been cleared successfully.\n\nThe page will now reload.', {
            title: 'Data Cleared',
            type: 'success',
            buttonText: 'Reload'
        });

        // Reload the page to apply changes
        window.location.reload(true);

    } catch (error) {
        console.error('Error clearing site data:', error);
        await materioAlert('An error occurred while clearing site data. Some data may not have been cleared.', {
            title: 'Error',
            type: 'danger',
            buttonText: 'OK'
        });

        // Restore card state
        const card = document.getElementById('clearSiteDataCard');
        if (card) {
            card.style.opacity = '1';
            card.style.pointerEvents = 'auto';
        }
    }
}

// Make function globally accessible for onclick handler
window.clearAllSiteData = clearAllSiteData;

// ================================================
// QUICK RESOURCE SEARCH FUNCTIONALITY
// ================================================

let searchTimeout = null;
let currentSearchController = null;
let aiSearchEnabled = false; // Track AI search mode

// Initialize quick search functionality
document.addEventListener('DOMContentLoaded', function () {
    const searchInput = document.getElementById('quickSearchInput');
    const searchResults = document.getElementById('quickSearchResults');
    const aiToggleBtn = document.getElementById('aiSearchToggle');
    const clearBtn = document.getElementById('clearSearchBtn');

    if (!searchInput || !searchResults) return;

    // Handle clear button click
    if (clearBtn) {
        clearBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            searchInput.value = '';
            this.style.display = 'none';
            searchResults.style.display = 'none';
            searchInput.focus();
        });

        // Check initial state
        if (searchInput.value.trim().length > 0) {
            clearBtn.style.display = 'flex';
        }
    }

    // Handle AI search toggle
    if (aiToggleBtn) {
        aiToggleBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            aiSearchEnabled = !aiSearchEnabled;

            // Update UI
            if (aiSearchEnabled) {
                this.classList.add('active');
                searchInput.classList.add('ai-mode');
                searchInput.placeholder = 'AI-powered search';
            } else {
                this.classList.remove('active');
                searchInput.classList.remove('ai-mode');
                searchInput.placeholder = 'Quick search';
            }

            // Re-run search if there's a query
            const query = searchInput.value.trim();
            if (query.length > 0) {
                performQuickSearch(query);
            }
        });
    }

    // Handle search input with debounce
    searchInput.addEventListener('input', function () {
        const query = this.value.trim();

        // Show/hide clear button
        if (clearBtn) {
            clearBtn.style.display = query.length > 0 ? 'flex' : 'none';
        }

        // Clear previous timeout
        if (searchTimeout) {
            clearTimeout(searchTimeout);
        }

        // Hide results if query is empty
        if (query.length === 0) {
            searchResults.style.display = 'none';
            return;
        }

        // Only show search results on home tab
        const homeTab = document.getElementById('home');
        if (!homeTab || !homeTab.classList.contains('active')) {
            return;
        }

        // Debounce search - wait 300ms after user stops typing
        searchTimeout = setTimeout(() => {
            performQuickSearch(query);
        }, 300);
    });

    // Close search results when clicking outside
    document.addEventListener('click', function (e) {
        const aiToggle = document.getElementById('aiSearchToggle');
        if (!searchInput.contains(e.target) &&
            !searchResults.contains(e.target) &&
            !aiToggle?.contains(e.target)) {
            searchResults.style.display = 'none';
        }
    });

    // Reopen results when clicking on input if there are results
    searchInput.addEventListener('click', function () {
        // Only show on home tab
        const homeTab = document.getElementById('home');
        if (!homeTab || !homeTab.classList.contains('active')) {
            return;
        }

        if (this.value.trim().length > 0 && searchResults.children.length > 0) {
            searchResults.style.display = 'block';
            // Reposition on click
            repositionSearchDropdown();
        }
    });

    // Reposition dropdown on scroll and resize (for position: fixed) - use passive listener
    window.addEventListener('scroll', repositionSearchDropdown, { passive: true });
    window.addEventListener('resize', repositionSearchDropdown, { passive: true });
});

// Reposition search dropdown (needed for position: absolute at body level)
function repositionSearchDropdown() {
    const searchResults = document.getElementById('quickSearchResults');
    const searchInput = document.getElementById('quickSearchInput');

    if (searchResults && searchInput && searchResults.style.display === 'block') {
        const rect = searchInput.getBoundingClientRect();
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
        const isMobile = window.innerWidth <= 768;

        if (isMobile) {
            searchResults.style.top = '425px';
        } else {
            searchResults.style.top = `${rect.bottom + scrollTop + 8}px`;
        }
        searchResults.style.left = `${rect.left + scrollLeft}px`;
        searchResults.style.width = `${rect.width}px`;
    }
}

// Create sparkle particles animation

// Perform search using the API
async function performQuickSearch(query) {
    const searchResults = document.getElementById('quickSearchResults');
    const searchInput = document.getElementById('quickSearchInput');

    // If query is not provided, get it from the input field
    if (!query && searchInput) {
        query = searchInput.value.trim();
    }

    // Don't search if query is empty
    if (!query) {
        searchResults.style.display = 'none';
        return;
    }

    // Cancel previous request if any
    if (currentSearchController) {
        currentSearchController.abort();
    }

    // Show loading state
    const loadingIcon = aiSearchEnabled ? 'fa-sparkles' : 'fa-spinner fa-spin';
    const loadingText = aiSearchEnabled ? 'AI searching...' : 'Searching...';
    searchResults.innerHTML = `<div class="search-loading"><i class="far ${loadingIcon}"></i> ${loadingText}</div>`;
    searchResults.style.display = 'block';

    try {
        // Create new abort controller
        currentSearchController = new AbortController();

        // Build API URL with useAI parameter and aiMode=pure
        const apiUrl = `/api/v2/search?q=${encodeURIComponent(query)}${aiSearchEnabled ? '&useAI=true&aiMode=pure' : ''}`;

        // Call search API
        const response = await fetch(apiUrl, {
            signal: currentSearchController.signal
        });

        if (!response.ok) {
            throw new Error(`Search failed: ${response.status}`);
        }

        const data = await response.json();

        if (!data.success) {
            throw new Error(data.error || 'Search failed');
        }

        // Store AI data globally for displaying suggestions
        window.currentAIData = data.ai || null;

        displaySearchResults(data.results, query);

    } catch (error) {
        if (error.name === 'AbortError') {
            return;
        }

        console.error('Search error:', error);
        searchResults.innerHTML = `
            <div class="search-error">
                <i class="far fa-exclamation-triangle"></i> 
                <p style="margin: 8px 0 0 0; font-size: 14px;">Search failed. Please try again.</p>
            </div>
        `;
        searchResults.style.display = 'block';
    }
}

// Display search results
function displaySearchResults(results, query) {
    const searchResults = document.getElementById('quickSearchResults');
    const searchInput = document.getElementById('quickSearchInput');

    // Store all results globally for expansion
    window.allSearchResults = results;
    window.currentDisplayCount = 8;
    window.currentSearchQuery = query;

    // Position dropdown below the search input (using absolute positioning)
    if (searchInput) {
        const rect = searchInput.getBoundingClientRect();
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
        const isMobile = window.innerWidth <= 768;

        if (isMobile) {
            searchResults.style.top = '425px';
        } else {
            searchResults.style.top = `${rect.bottom + scrollTop + 8}px`;
        }
        searchResults.style.left = `${rect.left + scrollLeft}px`;
        searchResults.style.width = `${rect.width}px`;
    }

    if (!results || results.length === 0) {
        const aiIcon = aiSearchEnabled ? '<i class="far fa-sparkles" style="color: #ff2d95;"></i> ' : '';
        const aiData = window.currentAIData;

        // Show AI suggestions if available
        let suggestionsHtml = '';
        if (aiSearchEnabled && aiData && aiData.suggestions && aiData.suggestions.length > 0) {
            suggestionsHtml = `
                <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid rgba(255, 130, 0, 0.1);">
                    <p style="font-size: 12px; font-weight: 600; color: #ff2d95; margin-bottom: 6px;">
                        <i class="far fa-lightbulb"></i> AI Suggestions:
                    </p>
                    ${aiData.suggestions.map(s => `
                        <div onclick="document.getElementById('quickSearchInput').value='${s.replace(/'/g, "\\'")}'; performQuickSearch('${s.replace(/'/g, "\\'")}')" 
                             style="padding: 6px 8px; margin: 4px 0; background: rgba(255, 130, 0, 0.05); border-radius: 4px; font-size: 11px; color: #666; cursor: pointer; transition: all 0.2s;"
                             onmouseover="this.style.background='rgba(255, 130, 0, 0.1)'"
                             onmouseout="this.style.background='rgba(255, 130, 0, 0.05)'">
                            <i class="far fa-search" style="opacity: 0.5; margin-right: 4px;"></i>${s}
                        </div>
                    `).join('')}
                </div>
            `;
        } else {
            suggestionsHtml = '<p style="margin: 4px 0 0 0; font-size: 12px; opacity: 0.7;">Try: "os intro", "dadv qb", "epj servlets"</p>';
        }

        searchResults.innerHTML = `
            <div class="search-no-results">
                <i class="far fa-search"></i>
                <p style="margin: 8px 0 0 0; font-size: 14px;">${aiIcon}No results found for "${query}"</p>
                ${suggestionsHtml}
            </div>
        `;
        searchResults.style.display = 'block';
        return;
    }

    renderSearchResults(query);
}

// Render search results (can be called to expand)
function renderSearchResults(query) {
    const searchResults = document.getElementById('quickSearchResults');
    const results = window.allSearchResults || [];
    const displayCount = window.currentDisplayCount || 8;

    // Build HTML for results
    let html = '';

    // Add AI mode indicator if enabled
    if (aiSearchEnabled) {
        const aiData = window.currentAIData;
        const intentText = aiData && aiData.intent ? aiData.intent : 'AI-Powered Results';

        html += `
            <div style="padding: 8px 16px; background: linear-gradient(135deg, rgba(255, 130, 0, 0.1), rgba(255, 45, 149, 0.1)); border-bottom: 1px solid rgba(255, 130, 0, 0.2);">
                <div style="display: flex; align-items: center; gap: 8px;">
                    <i class="far fa-sparkles" style="color: #ff2d95; animation: sparkle 1.5s ease-in-out infinite;"></i>
                    <span style="font-size: 12px; font-weight: 600; color: #ff2d95;">AI-Powered Results</span>
                </div>
                ${aiData && aiData.intent ? `
                    <div style="margin-top: 4px; font-size: 11px; color: #666; font-style: italic;">
                        <i class="far fa-brain" style="margin-right: 4px;"></i>${aiData.intent}
                    </div>
                ` : ''}
            </div>
        `;
    }

    // Show results based on display count
    const topResults = results.slice(0, displayCount);

    topResults.forEach((result, index) => {
        const scoreColor = result.score >= 75 ? '#28a745' :
            result.score >= 60 ? '#ff8200' : '#6c757d';

        // Show AI explanation if available (pure AI mode)
        const aiExplanation = result.aiExplanation ? `
            <div class="search-result-ai-explanation" style="margin-top: 6px; font-size: 11px; color: #6c757d; font-style: italic; line-height: 1.4;">
                <i class="far fa-sparkles" style="color: #ff2d95; margin-right: 4px;"></i>
                ${result.aiExplanation}
            </div>
        ` : '';

        html += `
            <div class="search-result-item" style="display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 12px 16px;"
                 data-semester="${result.semester}"
                 data-subject="${result.subject}"
                 data-category="${result.category}"
                 data-topic="${result.topic}">
                <div style="flex: 1; min-width: 0; cursor: pointer;" onclick="selectSearchResult('${result.semester}', \`${result.subject.replace(/`/g, '\\`')}\`, \`${result.category.replace(/`/g, '\\`')}\`, \`${result.topic.replace(/`/g, '\\`')}\`)">
                    <div class="search-result-semester">
                        <i class="far fa-graduation-cap" style="margin-right: 4px;"></i>
                        Semester ${result.semester} • ${result.subject}
                    </div>
                    <div class="search-result-title">
                        ${result.topic}
                    </div>
                    <div class="search-result-category">
                        ${result.category}
                    </div>
                    ${aiExplanation}
                </div>
                <div style="flex-shrink: 0; display: flex; align-items: center; gap: 8px;">
                    <span class="search-result-score" style="background: ${scoreColor}20; color: ${scoreColor};">
                        ${result.score}%
                    </span>
                    <button onclick="openSearchResultPdf(event, '${result.semester}', \`${result.subject.replace(/`/g, '\\`')}\`, \`${result.topic.replace(/`/g, '\\`')}\`)" 
                            style="padding: 8px 16px; background: #ff8400; color: white; border: none; border-radius: 20px; font-size: 13px; font-weight: 600; cursor: pointer; white-space: nowrap; transition: all 0.2s ease; font-family: 'Manrope', sans-serif;"
                            onmouseover="this.style.background='#ff9500'; this.style.transform='scale(1.05)'; this.style.boxShadow='0 4px 12px rgba(255, 132, 0, 0.4)'"
                            onmouseout="this.style.background='#ff8400'; this.style.transform='scale(1)'; this.style.boxShadow='none'">
                        <i class="far fa-external-link" style="margin-right: 4px;"></i>Open
                    </button>
                </div>
            </div>
        `;
    });

    // Add "Show more" button if there are more results
    if (results.length > displayCount) {
        html += `
            <div onclick="showMoreSearchResults(event)" style="padding: 12px 16px; text-align: center; color: #ff8200; font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.2s ease; border-top: 1px solid rgba(255, 130, 0, 0.1);" 
                 onmouseover="this.style.background='rgba(255, 130, 0, 0.05)'" 
                 onmouseout="this.style.background='transparent'">
                <i class="far fa-chevron-down"></i> Show ${results.length - displayCount} more result${results.length - displayCount === 1 ? '' : 's'}
            </div>
        `;
    } else if (displayCount > 8 && results.length === displayCount) {
        // Show collapse button if expanded
        html += `
            <div onclick="collapseSearchResults(event)" style="padding: 12px 16px; text-align: center; color: #6c757d; font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.2s ease; border-top: 1px solid rgba(108, 117, 125, 0.1);" 
                 onmouseover="this.style.background='rgba(108, 117, 125, 0.05)'" 
                 onmouseout="this.style.background='transparent'">
                <i class="far fa-chevron-up"></i> Show less
            </div>
        `;
    }

    searchResults.innerHTML = html;
    searchResults.style.display = 'block';
}

// Expand search results to show all
function showMoreSearchResults(event) {
    if (event) event.stopPropagation();
    window.currentDisplayCount = window.allSearchResults.length;
    renderSearchResults(window.currentSearchQuery);
}

// Collapse search results back to 8
function collapseSearchResults(event) {
    if (event) event.stopPropagation();
    window.currentDisplayCount = 8;
    renderSearchResults(window.currentSearchQuery);

    // Scroll back to top of results
    const searchResults = document.getElementById('quickSearchResults');
    if (searchResults) {
        searchResults.scrollTop = 0;
    }
}

// Open PDF directly from search result
function openSearchResultPdf(event, semester, subject, topic) {
    // Stop event propagation to prevent selecting the result
    if (event) event.stopPropagation();

    // Hide search results
    const searchResults = document.getElementById('quickSearchResults');
    const searchInput = document.getElementById('quickSearchInput');
    if (searchResults) searchResults.style.display = 'none';
    if (searchInput) searchInput.value = '';

    // Get popup element
    const popup = document.getElementById('popup');
    if (!popup) {
        return;
    }

    // Build PDF URL
    let pdfUrl;
    if (semester === '9999') {
        // Special handling for Vault (semester 9999)
        pdfUrl = `https://cdn-materioa.vercel.app/pdfs/${semester}/${subject}/vault/${topic}.pdf`;
    } else {
        // Normal format: pdfs/semester/subject/topic.pdf
        pdfUrl = `https://cdn-materioa.vercel.app/pdfs/${semester}/${subject}/${topic}.pdf`;
    }

    // Transform to local CDN if enabled
    pdfUrl = window.MaterioLocalCDN?.transformUrl(pdfUrl) || pdfUrl;

    // Open PDF using cache system if available
    if (typeof window.loadPdfWithCache === 'function') {
        window.loadPdfWithCache(pdfUrl);
        popup.classList.remove('closing');
        popup.style.display = 'block';
    } else {
        // Fallback to original behavior
        document.getElementById('popupContent').innerHTML =
            `<iframe id="pdf-iframe" scrolling='no' allowfullscreen webkitallowfullscreen style="border:none; width:100%; height:calc(100% - 17px); border-radius:25px; margin-top:22px; corner-shape: squircle;" 
        src="/oread/web/viewer.html?disableStream=false&disableRange=false&rangeChunkSize=1048576&file=${encodeURIComponent(pdfUrl)}"></iframe>`;

        popup.classList.remove('closing');
        popup.style.display = 'block';
    }
}

// Handle result selection
function selectSearchResult(semester, subject, category, topic) {
    // Hide search results first
    const searchResults = document.getElementById('quickSearchResults');
    const searchInput = document.getElementById('quickSearchInput');
    if (searchResults) searchResults.style.display = 'none';
    if (searchInput) searchInput.value = '';

    // Populate the selection form
    const semesterSelect = document.getElementById('semesterSelect');
    const subjectSelect = document.getElementById('subjectSelect');
    const categorySelect = document.getElementById('categorySelect');
    const topicSelect = document.getElementById('topicSelect');

    if (!semesterSelect || !subjectSelect || !categorySelect || !topicSelect) {
        return;
    }

    // Helper function to wait for dropdown to be enabled and populated
    function waitForDropdownReady(selectElement, targetValue, maxAttempts = 30, matchByText = false) {
        return new Promise((resolve, reject) => {
            let attempts = 0;
            const checkInterval = setInterval(() => {
                attempts++;

                // Check if dropdown is enabled and has the target option
                const isEnabled = !selectElement.disabled;
                const hasOptions = selectElement.options.length > 1; // More than just placeholder

                let option;
                if (matchByText) {
                    // For category dropdown - match by text content
                    option = Array.from(selectElement.options).find(opt => opt.textContent.trim() === targetValue.trim());
                } else {
                    // For other dropdowns - match by value
                    option = Array.from(selectElement.options).find(opt => opt.value === targetValue);
                }

                if (isEnabled && hasOptions && option) {
                    clearInterval(checkInterval);
                    resolve(option.value); // Return the actual value (index for category)
                } else if (attempts >= maxAttempts) {
                    clearInterval(checkInterval);
                    reject(false);
                }
            }, 150); // Check every 150ms
        });
    }

    // Helper function to set dropdown value and trigger change
    function setDropdownValue(selectElement, value) {
        // Remove disabled attribute
        selectElement.disabled = false;

        // Set the value
        selectElement.value = value;

        // Trigger multiple events to ensure compatibility
        selectElement.dispatchEvent(new Event('change', { bubbles: true }));
        selectElement.dispatchEvent(new Event('input', { bubbles: true }));

        // Also trigger jQuery change if available (some forms use jQuery)
        if (window.jQuery) {
            window.jQuery(selectElement).trigger('change');
        }
    }

    // Chain the selections with proper waiting
    async function populateAllFields() {
        try {
            // Step 1: Set semester
            setDropdownValue(semesterSelect, semester);
            await new Promise(resolve => setTimeout(resolve, 300)); // Give it time to process

            // Step 2: Wait for subject dropdown to populate, then set it
            await waitForDropdownReady(subjectSelect, subject);
            setDropdownValue(subjectSelect, subject);
            await new Promise(resolve => setTimeout(resolve, 300)); // Give it time to process

            // Step 3: Wait for category dropdown to populate, then find by TEXT and set by INDEX
            const categoryIndex = await waitForDropdownReady(categorySelect, category, 30, true); // matchByText = true
            setDropdownValue(categorySelect, categoryIndex);
            await new Promise(resolve => setTimeout(resolve, 300)); // Give it time to process

            // Step 4: Wait for topic dropdown to populate, then set it
            await waitForDropdownReady(topicSelect, topic);
            setDropdownValue(topicSelect, topic);

            // Scroll to the form
            setTimeout(() => {
                const readingCard = document.getElementById('reading');
                if (readingCard) {
                    readingCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            }, 300);

        } catch (error) {
            console.error('=== Error populating fields ===', error);
        }
    }

    // Execute the population
    populateAllFields();
}

// Expose functions globally for inline onclick handlers
window.selectSearchResult = selectSearchResult;
window.performQuickSearch = performQuickSearch;
window.openSearchResultPdf = openSearchResultPdf;
window.showMoreSearchResults = showMoreSearchResults;
window.collapseSearchResults = collapseSearchResults;

// ================================================
// CUSTOM MODAL SYSTEM (Alert & Confirm)
// ================================================

/**
 * Custom alert modal - replaces browser's native alert()
 * @param {string} message - The message to display
 * @param {Object} options - Optional configuration
 * @param {string} options.title - Modal title (default: "Notice")
 * @param {string} options.type - Icon type: 'info', 'success', 'warning', 'danger' (default: 'info')
 * @param {string} options.buttonText - OK button text (default: "OK")
 * @returns {Promise<void>} Resolves when user clicks OK
 */
function materioAlert(message, options = {}) {
    return new Promise((resolve) => {
        const {
            title = 'Notice',
            type = 'info',
            buttonText = 'OK'
        } = options;

        // Create overlay
        const overlay = document.createElement('div');
        overlay.className = 'materio-modal-overlay';
        overlay.innerHTML = `
            <div class="materio-modal" role="alertdialog" aria-modal="true" aria-labelledby="materio-modal-title">
                <div class="materio-modal-icon ${type}">
                    <i class="fa-solid ${getIconForType(type)}"></i>
                </div>
                <h3 class="materio-modal-title" id="materio-modal-title">${escapeHtml(title)}</h3>
                <p class="materio-modal-message">${escapeHtml(message)}</p>
                <div class="materio-modal-buttons">
                    <button class="materio-modal-btn primary" id="materio-modal-ok">${escapeHtml(buttonText)}</button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        // Trigger animation
        requestAnimationFrame(() => {
            overlay.classList.add('visible');
        });

        // Focus the button
        const okBtn = overlay.querySelector('#materio-modal-ok');
        setTimeout(() => okBtn.focus(), 100);

        // Close function
        function closeModal() {
            overlay.classList.remove('visible');
            setTimeout(() => {
                overlay.remove();
                resolve();
            }, 250);
        }

        // Event listeners
        okBtn.addEventListener('click', closeModal);
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) closeModal();
        });
        document.addEventListener('keydown', function escHandler(e) {
            if (e.key === 'Escape' || e.key === 'Enter') {
                document.removeEventListener('keydown', escHandler);
                closeModal();
            }
        });
    });
}

/**
 * Custom confirm modal - replaces browser's native confirm()
 * @param {string} message - The message to display
 * @param {Object} options - Optional configuration
 * @param {string} options.title - Modal title (default: "Confirm")
 * @param {string} options.type - Icon type: 'info', 'success', 'warning', 'danger' (default: 'warning')
 * @param {string} options.confirmText - Confirm button text (default: "Confirm")
 * @param {string} options.cancelText - Cancel button text (default: "Cancel")
 * @param {boolean} options.danger - If true, confirm button is red (default: false)
 * @returns {Promise<boolean>} Resolves true if confirmed, false if cancelled
 */
function materioConfirm(message, options = {}) {
    return new Promise((resolve) => {
        const {
            title = 'Confirm',
            type = 'warning',
            confirmText = 'Confirm',
            cancelText = 'Cancel',
            danger = false
        } = options;

        // Create overlay
        const overlay = document.createElement('div');
        overlay.className = 'materio-modal-overlay';
        overlay.innerHTML = `
            <div class="materio-modal" role="alertdialog" aria-modal="true" aria-labelledby="materio-modal-title">
                <div class="materio-modal-icon ${type}">
                    <i class="fa-solid ${getIconForType(type)}"></i>
                </div>
                <h3 class="materio-modal-title" id="materio-modal-title">${escapeHtml(title)}</h3>
                <p class="materio-modal-message">${escapeHtml(message)}</p>
                <div class="materio-modal-buttons">
                    <button class="materio-modal-btn secondary" id="materio-modal-cancel">${escapeHtml(cancelText)}</button>
                    <button class="materio-modal-btn ${danger ? 'danger' : 'primary'}" id="materio-modal-confirm">${escapeHtml(confirmText)}</button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        // Trigger animation
        requestAnimationFrame(() => {
            overlay.classList.add('visible');
        });

        // Focus the cancel button (safer default)
        const cancelBtn = overlay.querySelector('#materio-modal-cancel');
        const confirmBtn = overlay.querySelector('#materio-modal-confirm');
        setTimeout(() => cancelBtn.focus(), 100);

        // Close function
        function closeModal(result) {
            overlay.classList.remove('visible');
            setTimeout(() => {
                overlay.remove();
                resolve(result);
            }, 250);
        }

        // Event listeners
        confirmBtn.addEventListener('click', () => closeModal(true));
        cancelBtn.addEventListener('click', () => closeModal(false));
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) closeModal(false);
        });
        document.addEventListener('keydown', function escHandler(e) {
            if (e.key === 'Escape') {
                document.removeEventListener('keydown', escHandler);
                closeModal(false);
            } else if (e.key === 'Enter') {
                document.removeEventListener('keydown', escHandler);
                closeModal(true);
            }
        });
    });
}

// Helper: Get FontAwesome icon class for modal type
function getIconForType(type) {
    const icons = {
        'info': 'fa-circle-info',
        'success': 'fa-circle-check',
        'warning': 'fa-triangle-exclamation',
        'danger': 'fa-circle-xmark'
    };
    return icons[type] || icons.info;
}

// Helper: Escape HTML to prevent XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Make modal functions globally accessible
window.materioAlert = materioAlert;
window.materioConfirm = materioConfirm;

(function () {
    var breakAfter = 4; // change to 5 if you prefer 5 words
    var mobileWidth = 600;

    function applyWordWrap() {
        document.querySelectorAll('.paper-mode-description').forEach(function (el) {
            // store original text once
            var original = el.getAttribute('data-original-text');
            if (!original) {
                original = (el.textContent || '').trim();
                el.setAttribute('data-original-text', original);
            }
            if (window.innerWidth <= mobileWidth) {
                var words = original.split(/\s+/);
                if (words.length > breakAfter) {
                    var first = words.slice(0, breakAfter).join(' ');
                    var rest = words.slice(breakAfter).join(' ');
                    el.innerHTML = first + '<br>' + rest;
                } else {
                    el.textContent = original;
                }
            } else {
                // restore original on larger screens
                el.textContent = original;
            }
        });
    }

    document.addEventListener('DOMContentLoaded', applyWordWrap);
    var _t;
    window.addEventListener('resize', function () {
        clearTimeout(_t);
        _t = setTimeout(applyWordWrap, 120);
    });
})();

// ================================================
// KEYBOARD SHORTCUTS MODAL
// ================================================

(function () {
    function openKeyboardShortcutsModal() {
        const modal = document.getElementById('keyboardShortcutsModal');
        if (modal) {
            modal.classList.add('visible');
            modal.setAttribute('aria-hidden', 'false');
            document.body.style.overflow = 'hidden';
        }
    }

    function closeKeyboardShortcutsModal() {
        const modal = document.getElementById('keyboardShortcutsModal');
        if (modal) {
            modal.classList.remove('visible');
            modal.setAttribute('aria-hidden', 'true');
            document.body.style.overflow = '';
        }
    }

    document.addEventListener('DOMContentLoaded', function () {
        const openBtn = document.getElementById('keyboardShortcutsBtn');
        const closeBtn = document.getElementById('shortcutsCloseBtn');
        const backdrop = document.getElementById('keyboardShortcutsBackdrop');

        // Open modal on button click
        if (openBtn) {
            // Check if user has seen shortcuts before
            if (localStorage.getItem('keyboardShortcutsSeen')) {
                openBtn.classList.add('seen');
            }

            openBtn.addEventListener('click', function (e) {
                e.preventDefault();
                // Mark as seen
                localStorage.setItem('keyboardShortcutsSeen', 'true');
                openBtn.classList.add('seen');
                openKeyboardShortcutsModal();
            });
        }

        // Close modal on close button click
        if (closeBtn) {
            closeBtn.addEventListener('click', closeKeyboardShortcutsModal);
        }

        // Close modal on backdrop click
        if (backdrop) {
            backdrop.addEventListener('click', closeKeyboardShortcutsModal);
        }
    });

    // Expose functions globally for keyboard-shortcuts.js
    window.openKeyboardShortcutsModal = openKeyboardShortcutsModal;
    window.closeKeyboardShortcutsModal = closeKeyboardShortcutsModal;
})();