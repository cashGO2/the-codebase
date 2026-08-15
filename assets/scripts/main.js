/**
 * Materio Core
 * © 2024-2026, Materio by JTC.
 */

function closePromoModal() {
  const modal = document.getElementById("promoModal");
  if (modal) {
    modal.style.display = "none";
    // Reset transform in case it was swiped
    const modalContent = modal.querySelector(".promo-modal");
    if (modalContent) modalContent.style.transform = "";
  }
}

function closeExamModal() {
  const modal = document.getElementById("examModal");
  if (modal) {
    modal.style.display = "none";
    // Reset transform in case it was swiped
    const modalContent = modal.querySelector(".exam-modal");
    if (modalContent) modalContent.style.transform = "";
  }
}

document.addEventListener("DOMContentLoaded", function () {
  // Initialize session ID for caching and analytics
  const sessionId = sessionStorage.getItem('materio_session_id') ||
    (crypto.randomUUID ? crypto.randomUUID() : 's-' + Math.random().toString(36).substring(2, 10));
  sessionStorage.setItem('materio_session_id', sessionId);
  window.materioSessionId = sessionId;

  var year = new Date().getFullYear();
  var creatorInfo = document.getElementById("creatorInfo");
  if (creatorInfo) {
    var p = creatorInfo.querySelector("p");
    if (p) {
      p.innerHTML = "&copy; " + year + " - Materio";
    }
  }

  // Check if offline and redirect to downloads tab
  checkOfflineAndRedirect();

  // Preload offline nudge image into memory cache when online
  if (navigator.onLine) {
    const preloadImg = new Image();
    preloadImg.src = "/assets/img/internet.webp";
  }

  // Listen for online/offline changes
  window.addEventListener("online", () => {
    checkOfflineAndRedirect();
  });

  window.addEventListener("offline", () => {
    checkOfflineAndRedirect();
  });

  // Prevent ads inside callout blocks
  const calloutSelectors = [
    "blockquote.note",
    "blockquote.tip",
    "blockquote.important",
    "blockquote.warning",
    "blockquote.caution",
    "blockquote.success",
    "blockquote.info",
    ".callout-note",
    ".callout-tip",
    ".callout-important",
    ".callout-warning",
    ".callout-caution",
  ];

  // Clean up 'handoff' and Cloudflare parameters from URL if present
  const urlParams = new URLSearchParams(window.location.search);
  let paramsChanged = false;
  if (urlParams.has("handoff")) {
    urlParams.delete("handoff");
    paramsChanged = true;
  }
  if (urlParams.has("__cf_chl_f_tk")) {
    urlParams.delete("__cf_chl_f_tk");
    paramsChanged = true;
  }
  if (urlParams.has("__cf_chl_tk")) {
    urlParams.delete("__cf_chl_tk");
    paramsChanged = true;
  }
  
  if (paramsChanged) {
    const newUrl =
      window.location.pathname +
      (urlParams.toString() ? "?" + urlParams.toString() : "") +
      window.location.hash;
    window.history.replaceState({}, document.title, newUrl);
  }

  const callouts = document.querySelectorAll(calloutSelectors.join(", "));
  callouts.forEach((callout) => {
    callout.classList.add("google-auto-ads-ignore");
  });

  // Bug Report Tooltip Logic
  initBugTooltip();

  // Simple Notification Permission Request (For Push Notifications)
  if ('Notification' in window && Notification.permission === 'default') {
    // We don't want to nag users, but we need to at least have the capability ready
    // if the user chooses to enable it. We'll just check permission here.
    // actual prompt usually happens on a user action, which is better.
  }
});

let popupShareTooltipTimer = null;
let popupSharePromoCache = null;
let popupSharePromoCacheAt = 0;

async function getPopupSharePromoConfig() {
  const now = Date.now();
  const cacheTtlMs = 5 * 60 * 1000;

  if (popupSharePromoCache && now - popupSharePromoCacheAt < cacheTtlMs) {
    return popupSharePromoCache;
  }

  try {
    const response = await fetch(`/assets/data/promo.json?t=${now}`);
    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    popupSharePromoCache = data;
    popupSharePromoCacheAt = now;
    return data;
  } catch (error) {
    console.warn("Failed to load promo.json for popup share tooltip:", error);
    return null;
  }
}

function isPopupSharePromoActive(promoConfig) {
  if (!promoConfig || promoConfig.enabled !== true) {
    return false;
  }

  const now = new Date();

  if (promoConfig.startDate) {
    const startDate = new Date(promoConfig.startDate);
    if (!Number.isNaN(startDate.getTime()) && now < startDate) {
      return false;
    }
  }

  if (promoConfig.endDate) {
    const endDate = new Date(promoConfig.endDate);
    if (!Number.isNaN(endDate.getTime()) && now > endDate) {
      return false;
    }
  }

  return true;
}

async function showPopupShareTooltip() {
  const promoConfig = await getPopupSharePromoConfig();
  if (!isPopupSharePromoActive(promoConfig)) {
    closePopupShareTooltip();
    return;
  }

  const tooltip = document.getElementById("popupShareTooltip");
  if (!tooltip) return;

  tooltip.classList.add("show");

  if (popupShareTooltipTimer) {
    clearTimeout(popupShareTooltipTimer);
  }

  popupShareTooltipTimer = setTimeout(() => {
    closePopupShareTooltip();
  }, 5000);
}

window.closePopupShareTooltip = function () {
  const tooltip = document.getElementById("popupShareTooltip");
  if (tooltip) {
    tooltip.classList.remove("show");
  }

  if (popupShareTooltipTimer) {
    clearTimeout(popupShareTooltipTimer);
    popupShareTooltipTimer = null;
  }
};

function initBugTooltip() {
  const tooltip = document.getElementById("bugReportTooltip");
  if (!tooltip) return;

  // Initialize Swipe Gestures for Modals
  initModalSwipeGestures();

  const lastShown = localStorage.getItem("bugTooltipLastShown");
  const now = Date.now();
  const oneWeek = 7 * 24 * 60 * 60 * 1000;

  // Show if never shown or if more than 7 days have passed
  if (!lastShown || now - parseInt(lastShown) > oneWeek) {
    setTimeout(() => {
      tooltip.classList.add("show");

      // Auto close after 10 seconds if not already closed
      setTimeout(() => {
        if (tooltip.classList.contains("show")) {
          closeBugTooltip();
        }
      }, 10000);
    }, 3000); // Show after 3 seconds
  }
}

window.closeBugTooltip = function () {
  const tooltip = document.getElementById("bugReportTooltip");
  if (tooltip) {
    tooltip.classList.remove("show");
    localStorage.setItem("bugTooltipLastShown", Date.now().toString());
  }
};

// Offline detection and nudge
function checkOfflineAndRedirect() {
  if (!navigator.onLine) {
    showOfflineNudge();
  } else {
    // Online - show all tabs
    showAllTabs();
    hideOfflineNudge();
  }
}

function showOfflineNudge() {
  // Check if it already exists
  if (document.getElementById('offlineNudgeCard')) return;

  const card = document.createElement('aside');
  card.id = 'offlineNudgeCard';
  card.className = 'leaderboard-nudge-card';
  card.setAttribute('role', 'status');
  card.setAttribute('aria-live', 'polite');

  card.innerHTML = `
    <img src="/assets/img/internet.webp" alt="" class="leaderboard-nudge-image" />
    <div class="leaderboard-nudge-content">
      <p class="leaderboard-nudge-text">You seem to be offline.<br>Want to access your downloaded materials?</p>
      <div class="leaderboard-nudge-actions">
        <button type="button" class="leaderboard-nudge-btn leaderboard-nudge-btn-primary" data-action="downloads">View Downloads</button>
        <button type="button" class="leaderboard-nudge-btn" data-action="dismiss">Dismiss</button>
      </div>
      <p style="margin: 4px 0 0; font-size: 10px; color: #888; display: flex; align-items: flex-start; gap: 4px; line-height: 1.2;">
        <i class="fas fa-lightbulb" style="color: inherit; font-size: 10px; margin-top: 1px;"></i> 
        <span>You can save pdfs for offline reading by clicking on bookmark icon in viewer</span>
      </p>
    </div>
  `;

  card.addEventListener('click', (event) => {
    const action = event.target?.getAttribute('data-action');
    if (!action) return;

    if (action === 'downloads') {
      showDownloadsTabOffline();
      document.body.classList.remove('leaderboard-nudge-open');
      card.remove();
      return;
    }

    if (action === 'dismiss') {
      document.body.classList.remove('leaderboard-nudge-open');
      card.remove();
    }
  });

  document.body.classList.add('leaderboard-nudge-open');
  document.body.appendChild(card);
}

function hideOfflineNudge() {
  const card = document.getElementById('offlineNudgeCard');
  if (card) {
    card.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
    card.style.opacity = '0';
    card.style.transform = 'translateY(20px) scale(0.95)';
    setTimeout(() => {
      if (card.parentNode) {
        card.remove();
      }
      document.body.classList.remove('leaderboard-nudge-open');
    }, 400);
  }
}

// Expose to window for easy testing in the console
window.showOfflineNudge = showOfflineNudge;
window.hideOfflineNudge = hideOfflineNudge;

// Show Downloads tab directly (works even when not logged in)
function showDownloadsTabOffline() {
  const tabLinks = document.querySelectorAll(".tab-link");
  const tabContents = document.querySelectorAll(".tab-content");
  const downloadsContent = document.getElementById("downloads");

  if (downloadsContent) {
    // Remove active class from all tabs and contents
    tabLinks.forEach((tab) => tab.classList.remove("active"));
    tabContents.forEach((content) => content.classList.remove("active"));

    // Show downloads content
    downloadsContent.classList.add("active");

    // Dispatch event to trigger downloads loading
    document.dispatchEvent(new Event("downloadsTabOpened"));
  }
}

// Show all tabs when online
function showAllTabs() {
  const tabs = document.querySelectorAll(".tab-button");
  tabs.forEach((tab) => {
    tab.style.display = "";
  });
}
function setCookie(name, value, days) {
  var expires = "";
  if (days) {
    var date = new Date();
    date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
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
  tabLinks.forEach((link) => {
    link.classList.remove("active");
    const icon = link.querySelector("i");
    if (icon && !link.querySelector("img")) {
      // Skip profile icon with image
      icon.classList.remove("fas");
      icon.classList.add("far");
    }
  });

  tabContents.forEach((content) => content.classList.remove("active"));

  const selectedTabLink = document.querySelector(
    `.tab-link[data-tab="${activeTab}"]`,
  );
  if (selectedTabLink) {
    selectedTabLink.classList.add("active");
    const icon = selectedTabLink.querySelector("i");
    if (icon && !selectedTabLink.querySelector("img")) {
      // Skip profile icon with image
      icon.classList.remove("far");
      icon.classList.add("fas");
    }
    document.getElementById(activeTab)?.classList.add("active");
  } else {
    const homeLink = document.querySelector('.tab-link[data-tab="home"]');
    homeLink.classList.add("active");
    const icon = homeLink.querySelector("i");
    if (icon && !homeLink.querySelector("img")) {
      icon.classList.remove("far");
      icon.classList.add("fas");
    }
    document.getElementById("home").classList.add("active");
  }

  // Toggle scrollbar visibility for home tab on load
  const currentTab = getCookie("activeTab") || "home";
  document
    .querySelector(".content")
    ?.classList.toggle("hide-scrollbar", currentTab === "home");

  tabLinks.forEach((link) => {
    link.addEventListener("click", function (e) {
      // Check if this is the profile icon with dropdown functionality
      if (
        this.classList.contains("profile-icon") &&
        this.classList.contains("has-dropdown")
      ) {
        return; // Don't execute tab switching for profile dropdown
      }

      // Check if this is a modal trigger (like create note)
      if (this.classList.contains("modal-trigger")) {
        return;
      }

      e.preventDefault();

      // Haptic feedback for tab switch
      if (window.MaterioHaptics) {
        window.MaterioHaptics.vibrate("tab");
      }

      // Remove active class and change icons back to regular for all tabs
      tabLinks.forEach((tab) => {
        tab.classList.remove("active");
        const icon = tab.querySelector("i");
        if (icon && !tab.querySelector("img")) {
          icon.classList.remove("fas");
          icon.classList.add("far");
        }
      });

      tabContents.forEach((content) => content.classList.remove("active"));

      // Add active class and change icon to solid
      this.classList.add("active");
      const icon = this.querySelector("i");
      if (icon && !this.querySelector("img")) {
        icon.classList.remove("far");
        icon.classList.add("fas");
      }

      const tab = this.getAttribute("data-tab");
      document.getElementById(tab)?.classList.add("active");
      setCookie("activeTab", tab, 7);

      // Toggle scrollbar visibility for home tab
      document
        .querySelector(".content")
        ?.classList.toggle("hide-scrollbar", tab === "home");

      // Dispatch event for other scripts to respond to tab change
      document.dispatchEvent(
        new CustomEvent("tabOpened", { detail: { tab: tab } }),
      );

      // Load leaderboard when leaderboard tab opens
      if (tab === "leaderboard" && typeof window.loadLeaderboardData === "function") {
        window.loadLeaderboardData();
      }

      // Hide search dropdown when switching away from home tab
      const searchResults = document.getElementById("quickSearchResults");
      if (searchResults && tab !== "home") {
        searchResults.style.display = "none";
      }
    });
  });

  // Initialize PDF Share
  checkSharedPdf();
  checkCustomPdfOpen();
  const shareBtn = document.getElementById("sharePdfButton");
  if (shareBtn) {
    shareBtn.addEventListener("click", handlePdfShareClick);
  }
});

// Swipe Gesture Logic for Modals
function initModalSwipeGestures() {
  const modals = [
    {
      id: "promoModal",
      contentClass: ".promo-modal",
      closeFunc: closePromoModal,
    },
    { id: "examModal", contentClass: ".exam-modal", closeFunc: closeExamModal }, // Assuming closeExamModal exists or will be created
  ];

  modals.forEach((modalInfo) => {
    const modalOverlay = document.getElementById(modalInfo.id);
    if (!modalOverlay) return;

    const modalContent = modalOverlay.querySelector(modalInfo.contentClass);
    if (!modalContent) return;

    let startY = 0;
    let currentY = 0;
    let isDragging = false;
    const threshold = 100; // Minimum distance to swipe to close

    // Touch Start
    modalContent.addEventListener(
      "touchstart",
      (e) => {
        // Only enable swipe if we are at the top of the scroll
        // Check if the target is scrollable and not at the top
        let target = e.target;
        let isScrollable = false;

        while (target && target !== modalContent) {
          if (
            target.scrollHeight > target.clientHeight &&
            target.scrollTop > 0
          ) {
            isScrollable = true;
            break;
          }
          target = target.parentElement;
        }

        if (isScrollable) return;

        startY = e.touches[0].clientY;
        isDragging = true;
        modalContent.style.transition = "none"; // Disable transition during drag
      },
      { passive: true },
    );

    // Touch Move
    modalContent.addEventListener(
      "touchmove",
      (e) => {
        if (!isDragging) return;

        const touchY = e.touches[0].clientY;
        const deltaY = touchY - startY;

        if (deltaY > 0) {
          // Only allow dragging downwards
          e.preventDefault(); // Prevent scrolling
          currentY = deltaY;
          modalContent.style.transform = `translateY(${currentY}px)`;
        }
      },
      { passive: false },
    );

    // Touch End
    modalContent.addEventListener("touchend", (e) => {
      if (!isDragging) return;
      isDragging = false;
      modalContent.style.transition = "transform 0.3s ease-out";

      if (currentY > threshold) {
        // Swipe success - close modal
        modalContent.style.transform = `translateY(100%)`;
        setTimeout(() => {
          modalInfo.closeFunc();
          modalContent.style.transform = ""; // Reset for next time
        }, 300);
      } else {
        // Swipe cancel - revert position
        modalContent.style.transform = "";
      }
      currentY = 0;
    });
  });

  // Inject CSS for smooth scrolling in modals - Target ONLY touch devices to prevent desktop jitter
  const style = document.createElement("style");
  style.textContent = `
        @media (hover: none) and (pointer: coarse) {
            .promo-modal, .promo-content, .exam-modal-page, .syllabus-full-content {
                -webkit-overflow-scrolling: touch;
                scroll-behavior: smooth;
                overscroll-behavior: contain;
            }
        }
    `;
  document.head.appendChild(style);
}

const submitButton = document.getElementById("submitButton");
const popup = document.getElementById("popup");
const closePopup = document.getElementById("closePopup");

const PDF_LFS_POINTER_MAX_BYTES = 2048;

window.materioTopicMetadataMap = window.materioTopicMetadataMap || new Map();

function resolveTopicOptionData(topicValue, topicItem) {
  const normalizedTopicValue = String(topicValue || "").trim();
  const topicObject =
    topicItem && typeof topicItem === "object" && !Array.isArray(topicItem)
      ? topicItem
      : {};

  const curatedBy =
    topicObject.curatedBy ||
    topicObject.curated_by ||
    topicObject.curator ||
    topicObject.curated ||
    "";
  const contributedBy =
    topicObject.contributedBy ||
    topicObject.contributed_by ||
    topicObject.contributor ||
    topicObject.author ||
    "";

  return {
    title: normalizedTopicValue,
    curatedBy: String(curatedBy || "").trim(),
    contributedBy: String(contributedBy || "").trim(),
  };
}

function storeTopicMetadata(semKey, subjectKey, categoryIndex, topicValue, metadata) {
  if (!topicValue) return;
  const key = `${semKey || ""}::${subjectKey || ""}::${categoryIndex || ""}::${topicValue}`.toLowerCase();
  window.materioTopicMetadataMap.set(key, metadata || {});
}

function buildApiPdfFallbackUrl(pdfUrl) {
  try {
    const parsed = new URL(pdfUrl, window.location.origin);
    const pdfPathPrefix = "/pdfs/";

    if (!parsed.pathname.includes(pdfPathPrefix)) {
      return null;
    }

    const relativePdfPath = parsed.pathname.split(pdfPathPrefix)[1];
    if (!relativePdfPath || !relativePdfPath.toLowerCase().endsWith(".pdf")) {
      return null;
    }

    return `https://cdn.getmaterio.app/api/pdfs/${relativePdfPath}`;
  } catch (error) {
    return null;
  }
}

async function resolvePdfSourceUrl(pdfUrl) {
  const fallbackApiUrl = buildApiPdfFallbackUrl(pdfUrl);
  if (!fallbackApiUrl) {
    return pdfUrl;
  }

  try {
    const headResponse = await fetch(pdfUrl, {
      method: "HEAD",
      cache: "no-store",
    });

    if (headResponse.ok) {
      const contentLengthHeader = headResponse.headers.get("content-length");
      const contentLength = Number(contentLengthHeader);

      if (Number.isFinite(contentLength) && contentLength > 0) {
        if (contentLength <= PDF_LFS_POINTER_MAX_BYTES) {
          return fallbackApiUrl;
        }

        return pdfUrl;
      }
    }

    const probeResponse = await fetch(pdfUrl, {
      method: "GET",
      cache: "no-store",
      headers: {
        Range: `bytes=0-${PDF_LFS_POINTER_MAX_BYTES - 1}`,
      },
    });

    if (!probeResponse.ok) {
      return pdfUrl;
    }

    const probeBuffer = await probeResponse.arrayBuffer();
    if (probeBuffer.byteLength <= PDF_LFS_POINTER_MAX_BYTES) {
      const probeText = new TextDecoder("utf-8").decode(probeBuffer);
      const looksLikeLfsPointer = probeText.includes(
        "version https://git-lfs.github.com/spec/v1",
      );
      const looksLikePdfHeader = probeText.startsWith("%PDF-");

      if (looksLikeLfsPointer || !looksLikePdfHeader) {
        return fallbackApiUrl;
      }
    }
  } catch (error) {
    console.warn("Failed to probe PDF source URL, using original URL:", error);
  }

  return pdfUrl;
}

submitButton.addEventListener("click", async () => {
  // Haptic feedback for submit action
  if (window.MaterioHaptics) {
    window.MaterioHaptics.vibrate("strong");
  }

  const semester = document.getElementById("semesterSelect").value;
  const subject = document.getElementById("subjectSelect").value;
  const categorySelect = document.getElementById("categorySelect");
  const topic = document.getElementById("topicSelect").value;

  if (!semester || !subject || categorySelect.selectedIndex === 0 || !topic) {
    const roasts = [
      {
        message:
          "Start Reading what? The entire syllabus in one night? Pick a topic before the speedrun glitch-abuses you.",
        button: "Fair...",
      },
      {
        message:
          "Bro hit Start Reading like he’s about to unlock 16 weeks of content in 16 seconds. Select something before the game crashes.",
        button: "Valid",
      },
      {
        message:
          "Calm down, scholar. You can’t speedrun the whole syllabus by mashing Start Reading. Choose a chapter before attempting the world record.",
        button: "Alright, alright",
      },
      {
        message:
          "Trying to Start Reading without picking anything? That’s peak “exam is tomorrow so let me learn the entire degree tonight” energy. Select something.",
        button: "True",
      },
      {
        message:
          "You pressed Start Reading like Netflix’s “Skip Intro” works on coursework. It doesn’t. Pick a topic.",
        button: "Touché",
      },
      {
        message:
          "Start Reading with no selection? Bro’s on that “I’ll finish the syllabus tonight, trust me” delusion. Choose something real.",
        button: "My bad",
      },
      {
        message:
          "You tried to read nothing. Classic exam-eve panic maneuver. Grab a topic before the syllabus grabs YOU.",
        button: "Okay fine",
      },
      {
        message:
          "This isn’t a Marvel recap. You can’t skip 5 months and Start Reading. Make a selection first, prodigy.",
        button: "Fair point",
      },
      {
        message:
          "Pressing Start Reading with zero choices… bold. That’s some last-minute all-nighter confidence right there. Select something.",
        button: "I’ll behave",
      },
      {
        message:
          "Trying to absorb knowledge telepathically now? Pick what you want to read before going full Doctor Strange on the syllabus.",
        button: "Say less",
      },
      {
        message:
          "Start Reading what exactly? The void? Bro really queued up for the entire syllabus any% speedrun with ZERO selections. Touch some topics first.",
        button: "My fault gang",
      },
      {
        message:
          "Bro slammed Start Reading like he’s about to fast-travel through 16 weeks in 16 milliseconds. Select something before reality blue-screens.",
        button: "Real.",
      },
      {
        message:
          "Holdup prodigy. You cannot speedrun academia by mashing Start Reading like it's a broken controller. Pick a chapter before activating godmode.",
        button: "Aight bet",
      },
      {
        message:
          "No selection and still hit Start Reading?? That’s peak ‘exam tomorrow so let me download knowledge via Bluetooth’ behavior. Choose something.",
        button: "Skill issue tbh",
      },
      {
        message:
          "Bro pressed Start Reading like school has a Skip Intro button. This isn’t Netflix, scholar. Pick a topic before the credits roll.",
        button: "Trueee",
      },
      {
        message:
          "Start Reading with no selection?? Bro is deep in exam-eve delusion arc thinking he’ll absorb the syllabus osmosis-style. Choose something real.",
        button: "Ok fine 😭",
      },
      {
        message:
          "Reading nothing?? Peak panic speedrun strat. Pick a topic before the syllabus jumpscares YOU.",
        button: "Understandable",
      },
      {
        message:
          "This isn’t Marvel bro. You can’t skip 5 months of classes and hit Start Reading like it's a recap episode. Select something before Phase 6 drops.",
        button: "Fair point ig",
      },
      {
        message:
          "Start Reading with zero choices??? Nah that’s last-minute all-nighter menace behavior. Pick your fate before proceeding.",
        button: "I'll behave 💀",
      },
      {
        message:
          "Bro tried to Start Reading telepathically. This ain't Doctor Strange multiverse knowledge absorption. Select a topic before casting spells.",
        button: "Say less wizard",
      },
    ];
    const randomRoast = roasts[Math.floor(Math.random() * roasts.length)];

    materioAlert(randomRoast.message, {
      title: "Selection Required",
      type: "warning",
      buttonText: randomRoast.button,
    });
    return;
  }

  // Check if the caching system is available and use it
  if (typeof window.loadPdfWithCache === "function") {
    let pdfUrl;

    // Special handling for Vault (semester 9999)
    if (semester === "9999") {
      // Format: pdfs/9999/UUID/vault/filename.pdf
      pdfUrl = `https://cdn.getmaterio.app/pdfs/${semester}/${subject}/vault/${topic}.pdf`;
    } else {
      // Normal format: pdfs/semester/subject/topic.pdf
      pdfUrl = `https://cdn.getmaterio.app/pdfs/${semester}/${subject}/${topic}.pdf`;
    }

    // Transform to local CDN if enabled
    pdfUrl = window.MaterioLocalCDN?.transformUrl(pdfUrl) || pdfUrl;
    pdfUrl = await resolvePdfSourceUrl(pdfUrl);

    // Use the cached loading system
    window.loadPdfWithCache(pdfUrl);
    popup.classList.remove("closing");
    popup.style.display = "block";
    showPopupShareTooltip();
    window.refreshPdfInsightPill?.();
  } else {
    // Fallback to original behavior if caching system not available
    let pdfUrl;

    // Special handling for Vault (semester 9999)
    if (semester === "9999") {
      // Format: pdfs/9999/UUID/vault/filename.pdf
      pdfUrl = `https://cdn.getmaterio.app/pdfs/${semester}/${subject}/vault/${topic}.pdf`;
    } else {
      // Normal format: pdfs/semester/subject/topic.pdf
      pdfUrl = `https://cdn.getmaterio.app/pdfs/${semester}/${subject}/${topic}.pdf`;
    }

    // Transform to local CDN if enabled
    pdfUrl = window.MaterioLocalCDN?.transformUrl(pdfUrl) || pdfUrl;
    pdfUrl = await resolvePdfSourceUrl(pdfUrl);
    document.getElementById("popupContent").innerHTML =
      `<iframe id="pdf-iframe" scrolling='no' allowfullscreen webkitallowfullscreen style="border:none; width:100%; height:calc(100% - 54px); border-radius:25px; margin-top:54px; corner-shape: squircle;"
        src="/oread/web/viewer.html?disableStream=false&disableRange=false&rangeChunkSize=1048576&file=${encodeURIComponent(pdfUrl)}"></iframe>`;

    popup.classList.remove("closing");
    popup.style.display = "block";
    showPopupShareTooltip();
    window.refreshPdfInsightPill?.();
  }
});

closePopup.addEventListener("click", () => {
  popup.classList.add("closing");
});

popup.addEventListener("animationend", (event) => {
  if (event.animationName === "popupFadeOut") {
    popup.style.display = "none";
    popup.classList.remove("closing");
  }
});

/**
 * Custom share modal for PDFs
 * @param {string} actualUrl - The PDF URL to share
 */
function materioShareModal(actualUrl) {
  // Extract topic/subject/semester from the CDN URL
  // Format: https://cdn.getmaterio.app/pdfs/{semester}/{subject}/{topic}.pdf
  let pdfSemester = "",
    pdfSubject = "",
    pdfTopic = "";
  try {
    const u = new URL(actualUrl);
    const parts = u.pathname.split("/").filter(Boolean); // ['pdfs', sem, subject, topic.pdf]
    if (parts.length >= 4) {
      pdfSemester = parts[1];
      pdfSubject = decodeURIComponent(parts[2]).replace(/[-_]/g, " ");
      pdfTopic = decodeURIComponent(parts[parts.length - 1])
        .replace(/\.pdf$/i, "")
        .replace(/[-_]/g, " ");
    }
  } catch (e) {
    /* ignore */
  }

  const semLabel =
    pdfSemester && pdfSemester !== "9999"
      ? `Semester ${pdfSemester}`
      : "Additional Resources";
  const aiPrompt = pdfTopic
    ? `Help me with ${pdfTopic}${pdfSubject ? ` (${pdfSubject})` : ""}${pdfSemester && pdfSemester !== "9999" ? `, ${semLabel}` : ""}.`
    : "Help me study this topic.";

  const claudeClipboardPrompt = `@materio ${aiPrompt}`;

  const chatGptUrl =
    `https://chatgpt.com/g/g-69b90f449ff08191a3d32d3c0bec0591-materio` +
    `?prompt=${encodeURIComponent(aiPrompt)}`;

  const claudePromptUrl = `claude://open?q=${encodeURIComponent(aiPrompt)}`;

  // Platform detection — Claude Desktop not available on mobile or Linux
  const ua = navigator.userAgent;
  const isMobile =
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
  const isLinux = /Linux/i.test(ua) && !/Android/i.test(ua);
  const claudeAvailable = !isMobile && !isLinux;
  const claudeUnavailableReason = isMobile
    ? "Mobile not supported"
    : isLinux
      ? "Linux not supported"
      : "";

  const SPINNER_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" color="currentColor" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" class="hgi-spin">
    <path d="M11.9961 3V6"></path>
    <path d="M11.9961 18V21"></path>
    <path d="M20.9961 12H17.9961"></path>
    <path d="M5.99609 12H2.99609"></path>
    <path d="M18.3596 5.63672L16.2383 7.75804"></path>
    <path d="M7.75413 16.2422L5.63281 18.3635"></path>
    <path d="M18.3596 18.3635L16.2383 16.2422"></path>
    <path d="M7.75413 7.75804L5.63281 5.63672"></path>
  </svg>`;

  const COPY_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" color="currentColor" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M7 11V9C7 5.70017 7 4.05025 8.02513 3.02513C9.05025 2 10.7002 2 14 2C17.2998 2 18.9497 2 19.9749 3.02513C21 4.05025 21 5.70017 21 9V11C21 14.2998 21 15.9497 19.9749 16.9749C18.9497 18 17.2998 18 14 18C10.7002 18 9.05025 18 8.02513 16.9749C7 15.9497 7 14.2998 7 11Z"></path>
    <path d="M3 6V15C3 18.2998 3 19.9497 4.02513 20.9749C5.05025 22 6.70017 22 10 22H17"></path>
  </svg>`;

  const COPY_CHECKED_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" color="currentColor" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M11 10.6667C11 10.6667 11.75 10.6667 12.5 12C12.5 12 14.8824 8.66667 17 8"></path>
    <path d="M7 11V9C7 5.70017 7 4.05025 8.02513 3.02513C9.05025 2 10.7002 2 14 2C17.2998 2 18.9497 2 19.9749 3.02513C21 4.05025 21 5.70017 21 9V11C21 14.2998 21 15.9497 19.9749 16.9749C18.9497 18 17.2998 18 14 18C10.7002 18 9.05025 18 8.02513 16.9749C7 15.9497 7 14.2998 7 11Z"></path>
    <path d="M3 6V15C3 18.2998 3 19.9497 4.02513 20.9749C5.05025 22 6.70017 22 10 22H17"></path>
  </svg>`;

  const WARNING_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" color="currentColor" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="12" cy="12" r="10" stroke="currentColor" />
    <path d="M11.992 15H12.001" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path>
    <path d="M12 12L12 8" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"></path>
  </svg>`;

  const CHECKMARK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" color="currentColor" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: inline-block; vertical-align: middle; margin-right: 4px;">
    <path d="M5 14.5C5 14.5 6.5 14.5 8.5 18C8.5 18 14.0588 8.83333 19 7"></path>
  </svg>`;

  // Create overlay
  const overlay = document.createElement("div");
  overlay.className = "materio-modal-overlay";
  overlay.innerHTML = `
        <div class="materio-modal" role="dialog" aria-modal="true" aria-labelledby="share-modal-title">
            <h3 class="materio-modal-title" id="share-modal-title">Share PDF</h3>

            <div class="share-input-container" id="share-input-container">
                <input type="text" class="share-url-input" id="share-url-input" readonly value="Crafting your secure link..." aria-label="Share URL">
                <button class="share-copy-btn" id="share-copy-btn" disabled aria-label="Copy link">
                    ${SPINNER_SVG}
                </button>
            </div>

            <div class="ai-ask-divider">
                <span>Share Context with</span>
            </div>

            <div class="ai-ask-buttons">
                <button class="ai-ask-btn chatgpt-btn" id="ai-chatgpt-btn" title="Ask ChatGPT">
                    <svg class="ai-btn-icon" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.896zm16.597 3.855l-5.843-3.372L15.115 7.2a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.403-.667zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135l-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08L8.704 5.46a.795.795 0 0 0-.393.681zm1.097-2.365l2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z"/></svg>
                    <span>ChatGPT</span>
                </button>
                <button class="ai-ask-btn claude-btn ${claudeAvailable ? "" : "ai-btn-disabled"}" id="ai-claude-btn" title="${claudeAvailable ? "Ask Claude Desktop" : claudeUnavailableReason}">
                    <svg class="ai-btn-icon" viewBox="0 0 1200 1200" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M 233.959793 800.214905 L 468.644287 668.536987 L 472.590637 657.100647 L 468.644287 650.738403 L 457.208069 650.738403 L 417.986633 648.322144 L 283.892639 644.69812 L 167.597321 639.865845 L 54.926208 633.825623 L 26.577238 627.785339 L 3.3e-05 592.751709 L 2.73832 575.27533 L 26.577238 559.248352 L 60.724873 562.228149 L 136.187973 567.382629 L 249.422867 575.194763 L 331.570496 580.026978 L 453.261841 592.671082 L 472.590637 592.671082 L 475.328857 584.859009 L 468.724915 580.026978 L 463.570557 575.194763 L 346.389313 495.785217 L 219.543671 411.865906 L 153.100723 363.543762 L 117.181267 339.060425 L 99.060455 316.107361 L 91.248367 266.01355 L 123.865784 230.093994 L 167.677887 233.073853 L 178.872513 236.053772 L 223.248367 270.201477 L 318.040283 343.570496 L 441.825592 434.738342 L 459.946411 449.798706 L 467.194672 444.64447 L 468.080597 441.020203 L 459.946411 427.409485 L 392.617493 305.718323 L 320.778564 181.932983 L 288.80542 130.630859 L 280.348999 99.865845 C 277.369171 87.221436 275.194641 76.590698 275.194641 63.624268 L 312.322174 13.20813 L 332.8591 6.604126 L 382.389313 13.20813 L 403.248352 31.328979 L 434.013519 101.71814 L 483.865753 212.537048 L 561.181274 363.221497 L 583.812134 407.919434 L 595.892639 449.315491 L 600.40271 461.959839 L 608.214783 461.959839 L 608.214783 454.711609 L 614.577271 369.825623 L 626.335632 265.61084 L 637.771851 131.516846 L 641.718201 93.745117 L 660.402832 48.483276 L 697.530334 24.000122 L 726.52356 37.852417 L 750.362549 72 L 747.060486 94.067139 L 732.886047 186.201416 L 705.100708 330.52356 L 686.979919 427.167847 L 697.530334 427.167847 L 709.61084 415.087341 L 758.496704 350.174561 L 840.644348 247.490051 L 876.885925 206.738342 L 919.167847 161.71814 L 946.308838 140.29541 L 997.61084 140.29541 L 1035.38269 196.429626 L 1018.469849 254.416199 L 965.637634 321.422852 L 921.825562 378.201538 L 859.006714 462.765259 L 819.785278 530.41626 L 823.409424 535.812073 L 832.75177 534.92627 L 974.657776 504.724915 L 1051.328979 490.872559 L 1142.818848 475.167786 L 1184.214844 494.496582 L 1188.724854 514.147644 L 1172.456421 554.335693 L 1074.604126 578.496765 L 959.838989 601.449829 L 788.939636 641.879272 L 786.845764 643.409485 L 789.261841 646.389343 L 866.255127 653.637634 L 899.194702 655.409424 L 979.812134 655.409424 L 1129.932861 666.604187 L 1169.154419 692.537109 L 1192.671265 724.268677 L 1188.724854 748.429688 L 1128.322144 779.194641 L 1046.818848 759.865845 L 856.590759 714.604126 L 791.355774 698.335754 L 782.335693 698.335754 L 782.335693 703.731567 L 836.69812 756.885986 L 936.322205 846.845581 L 1061.073975 962.81897 L 1067.436279 991.490112 L 1051.409424 1014.120911 L 1034.496704 1011.704712 L 924.885986 929.234924 L 882.604126 892.107544 L 786.845764 811.48999 L 780.483276 811.48999 L 780.483276 819.946289 L 802.550415 852.241699 L 919.087341 1027.409424 L 925.127625 1081.127686 L 916.671204 1098.604126 L 886.469849 1109.154419 L 853.288696 1103.114136 L 785.073914 1007.355835 L 714.684631 899.516785 L 657.906067 802.872498 L 650.979858 806.81897 L 617.476624 1167.704834 L 601.771851 1186.147705 L 565.530212 1200 L 535.328857 1177.046997 L 519.302124 1139.919556 L 535.328857 1066.550537 L 554.657776 970.792053 L 570.362488 894.68457 L 584.536926 800.134277 L 592.993347 768.724976 L 592.429626 766.630859 L 585.503479 767.516968 L 514.22821 865.369263 L 405.825531 1011.865906 L 320.053711 1103.677979 L 299.516815 1111.812256 L 263.919525 1093.369263 L 267.221497 1060.429688 L 287.114136 1031.114136 L 405.825531 880.107361 L 477.422913 786.52356 L 523.651062 732.483276 L 523.328918 724.671265 L 520.590698 724.671265 L 205.288605 929.395935 L 149.154434 936.644409 L 124.993355 914.01355 L 127.973183 876.885986 L 139.409409 864.80542 L 234.201385 799.570435 Z"/></svg>
                    <span class="ai-btn-label-group">
                        <span>Claude</span>
                        ${!claudeAvailable ? `<span class="ai-btn-unavail-reason">${claudeUnavailableReason}</span>` : ""}
                    </span>
                </button>
            </div>

            <div class="ai-mcp-hint">
                <a href="https://materioa.vercel.app/docs/mcp" target="_blank" rel="noopener">Setup MCP in Claude Desktop →</a>
            </div>

            <div class="materio-modal-buttons">
                <button class="materio-modal-btn primary" id="share-modal-close" style="max-width: 100%; flex: 1;">Back</button>
            </div>
        </div>
    `;

  document.body.appendChild(overlay);

  // Trigger animation
  requestAnimationFrame(() => {
    overlay.classList.add("visible");
  });

  const input = overlay.querySelector("#share-url-input");
  const inputContainer = overlay.querySelector("#share-input-container");
  const copyBtn = overlay.querySelector("#share-copy-btn");
  const closeBtn = overlay.querySelector("#share-modal-close");
  const chatGptBtn = overlay.querySelector("#ai-chatgpt-btn");
  const claudeBtn = overlay.querySelector("#ai-claude-btn");

  // Auto-select input on click
  input.addEventListener("click", () => input.select());

  // Close function
  function closeModal() {
    overlay.classList.remove("visible");
    setTimeout(() => {
      overlay.remove();
    }, 250);
  }

  // Event listeners
  closeBtn.addEventListener("click", closeModal);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeModal();
  });

  // Handle Esc key
  const escHandler = (e) => {
    if (e.key === "Escape") {
      document.removeEventListener("keydown", escHandler);
      closeModal();
    }
  };
  document.addEventListener("keydown", escHandler);

  // Initial focus
  setTimeout(() => closeBtn.focus(), 100);

  // Helper to set the copy button behavior
  function setupCopyBtn(url) {
    copyBtn.onclick = async () => {
      try {
        await navigator.clipboard.writeText(url);
        copyBtn.innerHTML = COPY_CHECKED_SVG;
        copyBtn.classList.add("success");
        setTimeout(() => {
          copyBtn.innerHTML = COPY_SVG;
          copyBtn.classList.remove("success");
        }, 2000);
      } catch (err) {
        console.error("Copy failed:", err);
      }
    };
  }

  // ChatGPT button
  chatGptBtn.addEventListener("click", () => {
    window.open(chatGptUrl, "_blank", "noopener");
  });

  // Claude button — desktop only, copies prompt then opens Claude Desktop
  if (claudeAvailable) {
    claudeBtn.addEventListener("click", async () => {
      // 1. Copy the prompt (prefixed with @materio for MCP context) to clipboard
      try {
        await navigator.clipboard.writeText(claudeClipboardPrompt);
      } catch (e) {
        // fallback — textarea trick
        const ta = document.createElement("textarea");
        ta.value = claudeClipboardPrompt;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        ta.remove();
      }

      // 2. Show inline notice on the button
      const original = claudeBtn.innerHTML;
      claudeBtn.innerHTML = `${CHECKMARK_SVG} <span>Paste in Claude App</span>`;
      claudeBtn.disabled = true;

      // 3. Open Claude Desktop (params ignored by the app, that's fine)
      const iframe = document.createElement("iframe");
      iframe.style.display = "none";
      document.body.appendChild(iframe);
      try {
        iframe.src = "claude://open";
      } catch (e) {
        /* ignore */
      }
      setTimeout(() => iframe.remove(), 2000);

      // 4. Restore button after 3s
      setTimeout(() => {
        claudeBtn.innerHTML = original;
        claudeBtn.disabled = false;
      }, 3000);
    });
  }

  // Normal share API call
  (async () => {
    try {
      const response = await fetch(
        "/api/v2/features?action=pdf-share&subAction=create",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ actualUrl }),
        },
      );

      const data = await response.json();
      if (data.maskId) {
        const shareUrl = `${window.location.origin}${window.location.pathname}?share=${data.maskId}`;
        input.value = shareUrl;
        copyBtn.innerHTML = COPY_SVG;
        copyBtn.disabled = false;
        setupCopyBtn(shareUrl);
      } else {
        throw new Error("No maskId");
      }
    } catch (e) {
      console.error("Share error:", e);
      input.value = "Failed to generate link";
      copyBtn.innerHTML = WARNING_SVG;
      copyBtn.style.background = "#dc3545";
    }
  })();
}

// PDF Share Logic
async function handlePdfShareClick() {
  // 1. Try global variable from caching.js
  let actualUrl = window.materioCurrentPdfUrl;

  // 2. Fallback to Analytics variable
  if (!actualUrl && window.pdfAnalytics) {
    actualUrl = window.pdfAnalytics.currentPdf;
  }

  // 3. Last resort: Try to extract from iframe
  if (!actualUrl) {
    const iframe =
      document.getElementById("pdf-iframe") ||
      document.querySelector("#popupContent iframe");
    if (iframe && iframe.src) {
      try {
        const url = new URL(iframe.src, window.location.origin);
        actualUrl = url.searchParams.get("file");
      } catch (e) {
        console.error("Failed to parse iframe src");
      }
    }
  }

  if (!actualUrl || actualUrl === "unknown") {
    if (window.materioAlert) {
      window.materioAlert(
        "Could not identify the PDF to share. Please try re-opening it.",
        { type: "warning" },
      );
    }
    return;
  }

  // Open share modal
  materioShareModal(actualUrl);
}

// Function removed as its logic is now inside materioShareModal
// async function generateAndShareLink(actualUrl) { ... }

async function checkSharedPdf() {
  const urlParams = new URLSearchParams(window.location.search);
  const maskId = urlParams.get("share");
  if (!maskId) return;

  try {
    const response = await fetch(
      `/api/v2/features?action=pdf-share&subAction=resolve&maskId=${maskId}`,
    );
    const data = await response.json();

    if (data.actualUrl) {
      const resolvedPdfUrl = await resolvePdfSourceUrl(data.actualUrl);
      const popup = document.getElementById("popup");
      if (typeof window.loadPdfWithCache === "function") {
        window.loadPdfWithCache(resolvedPdfUrl);
      } else {
        document.getElementById("popupContent").innerHTML =
          `<iframe id="pdf-iframe" scrolling='no' allowfullscreen webkitallowfullscreen style="border:none; width:100%; height:calc(100% - 54px); border-radius:25px; margin-top:54px; corner-shape: squircle;"
                src="/oread/web/viewer.html?file=${encodeURIComponent(resolvedPdfUrl)}"></iframe>`;
      }
      if (popup) {
        popup.classList.remove("closing");
        popup.style.display = "block";
        showPopupShareTooltip();
        window.refreshPdfInsightPill?.();
      }

      // Clean URL
      const newUrl = window.location.origin + window.location.pathname;
      window.history.replaceState({}, document.title, newUrl);
    }
  } catch (e) {
    console.error("Failed to resolve shared PDF:", e);
  }
}

// Open custom PDF from URL parameter (?open= or ?file=)
async function checkCustomPdfOpen() {
  const urlParams = new URLSearchParams(window.location.search);
  const customUrl = urlParams.get("open") || urlParams.get("file");
  if (!customUrl) return;

  try {
    const popup = document.getElementById("popup");
    const decodedUrl = decodeURIComponent(customUrl);

    // For custom/external URLs, skip loadPdfWithCache (which does HEAD validation)
    // and load directly in iframe to avoid CORS issues with validation
    // The viewer.html will handle the PDF loading directly

    const initializeIframe = () => {
      let pdfIframe = document.getElementById('pdf-iframe');

      if (!pdfIframe) {
        pdfIframe = document.createElement('iframe');
        pdfIframe.id = 'pdf-iframe';
        pdfIframe.style.border = 'none';
        pdfIframe.style.width = '100%';
        pdfIframe.style.height = 'calc(100% - 17px)';
        pdfIframe.style.borderRadius = '10px';
        pdfIframe.style.marginTop = '22px';
        pdfIframe.setAttribute('scrolling', 'no');
        pdfIframe.setAttribute('allowfullscreen', '');
        pdfIframe.setAttribute('webkitallowfullscreen', '');
        document.getElementById('popupContent').innerHTML = '';
        document.getElementById('popupContent').appendChild(pdfIframe);
      }

      // Load viewer with custom PDF URL - bypass caching validation
      pdfIframe.src = `/oread/web/viewer.html?file=${encodeURIComponent(decodedUrl)}`;
    };

    initializeIframe();

    if (popup) {
      popup.classList.remove("closing");
      popup.style.display = "block";
      showPopupShareTooltip();
      window.refreshPdfInsightPill?.();
    }

    // Clean URL
    const newUrl = window.location.origin + window.location.pathname;
    window.history.replaceState({}, document.title, newUrl);
  } catch (e) {
    console.error("Failed to open custom PDF:", e);
    window.materioAlert("Could not open the PDF. Please check the URL.", { type: "error" });
  }
}

document.addEventListener("DOMContentLoaded", function () {
  const libUrl =
    window.MaterioLocalCDN?.transformUrl(
      "https://cdn.getmaterio.app/databases/beta/resource.lib.json",
    ) || "https://cdn.getmaterio.app/databases/beta/resource.lib.json";
  fetch(libUrl)
    .then((response) => {
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.json();
    })
    .then((data) => {
      if (!data || typeof data !== "object") {
        throw new Error("Invalid data format received");
      }
      const semesterMapping = { 9: "Additional Resources" };
      const semesterSelect = document.getElementById("semesterSelect");
      semesterSelect.innerHTML = "";
      const placeholder = document.createElement("option");
      placeholder.value = "";
      placeholder.textContent = "Select Semester";
      semesterSelect.appendChild(placeholder);

      for (let sem in data) {
        const option = document.createElement("option");
        option.value = sem;
        option.textContent = semesterMapping[sem]
          ? semesterMapping[sem]
          : "Semester " + sem;
        if (sem === "7") {
          option.selected = true;
        }
        semesterSelect.appendChild(option);
      }

      if (semesterSelect.value) {
        semesterSelect.dispatchEvent(new Event("change"));
      }

      semesterSelect.addEventListener("change", function () {
        clearSelect("subjectSelect", "Select Subject");
        clearSelect("categorySelect", "Select Category");
        clearSelect("topicSelect", "Select Topic");
        const semKey = this.value;
        if (!semKey) return;
        const subjects = data[semKey];
        const subjectSelect = document.getElementById("subjectSelect");

        // Special handling for Vault (semester 9999)
        if (semKey === "9999") {
          // Extract UUID and use it as the subject
          if (subjects.uuid) {
            const option = document.createElement("option");
            option.value = subjects.uuid;
            option.textContent = "Vault"; // Display name
            subjectSelect.appendChild(option);
            subjectSelect.disabled = false;
            // Auto-select and trigger change
            subjectSelect.value = subjects.uuid;
            subjectSelect.dispatchEvent(new Event("change"));
          }
        } else {
          // Normal semester handling
          for (let subject in subjects) {
            const option = document.createElement("option");
            option.value = subject;
            option.textContent = subject;
            subjectSelect.appendChild(option);
          }
          subjectSelect.disabled = false;
        }
      });

      document
        .getElementById("subjectSelect")
        .addEventListener("change", function () {
          clearSelect("categorySelect", "Select Category");
          clearSelect("topicSelect", "Select Topic");
          const semKey = document.getElementById("semesterSelect").value;
          const subjectKey = this.value;
          if (!subjectKey) return;

          let categoriesArr;

          // Special handling for Vault (semester 9999)
          if (semKey === "9999") {
            // Get Vault array directly
            categoriesArr = data[semKey].Vault;
          } else {
            // Normal semester handling
            categoriesArr = data[semKey][subjectKey];
          }

          const categorySelect = document.getElementById("categorySelect");
          if (categoriesArr && categoriesArr.length) {
            let defaultSet = false;
            categoriesArr.forEach((catObj, idx) => {
              const option = document.createElement("option");
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
              categorySelect.dispatchEvent(new Event("change"));
            } else if (categoriesArr.length > 0) {
              // Fallback: select the first category if "chapters" not found
              categorySelect.selectedIndex = 1;
              categorySelect.dispatchEvent(new Event("change"));
            }
          }
        });

      document
        .getElementById("categorySelect")
        .addEventListener("change", function () {
          clearSelect("topicSelect", "Select Topic");
          const semKey = document.getElementById("semesterSelect").value;
          const subjectKey = document.getElementById("subjectSelect").value;
          const categoryIndex = this.value;
          if (categoryIndex === "") return;

          let catObj;

          // Special handling for Vault (semester 9999)
          if (semKey === "9999") {
            // Get category from Vault array
            catObj = data[semKey].Vault[categoryIndex];
          } else {
            // Normal semester handling
            catObj = data[semKey][subjectKey][categoryIndex];
          }

          const topics = catObj.content;
          const topicSelect = document.getElementById("topicSelect");
          if (topics && topics.length > 0) {
            topics.forEach((topicItem) => {
              const topicName =
                typeof topicItem === "string"
                  ? topicItem
                  : topicItem?.name || topicItem?.title || topicItem?.topic || "";

              if (!topicName) return;

              const topicMetadata = resolveTopicOptionData(topicName, topicItem);
              storeTopicMetadata(
                semKey,
                subjectKey,
                categoryIndex,
                topicName,
                topicMetadata,
              );

              const option = document.createElement("option");
              option.value = topicName;
              option.textContent = topicName;
              if (topicMetadata.curatedBy) {
                option.dataset.curatedBy = topicMetadata.curatedBy;
              }
              if (topicMetadata.contributedBy) {
                option.dataset.contributedBy = topicMetadata.contributedBy;
              }
              topicSelect.appendChild(option);
            });
            topicSelect.disabled = false;
            // Default to first topic
            if (topics.length > 0) {
              topicSelect.selectedIndex = 1;
              topicSelect.dispatchEvent(new Event("change"));
            }
          }
        });

      function clearSelect(selectId, placeholder) {
        const select = document.getElementById(selectId);
        select.innerHTML = "";
        const option = document.createElement("option");
        option.value = "";
        option.textContent = placeholder;
        select.appendChild(option);
        select.disabled = true;
      }
    })
    .catch((err) => {
      // Resource load failed
      // Only show alert when online (offline is expected to fail)
      if (navigator.onLine) {
        const roasts = [
          {
            message:
              "The page is missing a few ingredients. Bro cooked without onions AND salt. Refresh before the dish reports YOU.",
            button: "Chef moment",
          },
          {
            message:
              "Resources didn’t load. The page said ‘nah I’m on break.’ Try again before it unionizes.",
            button: "I'll negotiate",
          },
          {
            message:
              "The page tried to fetch files but the internet said ‘skill issue.’ Refresh and pray.",
            button: "True…",
          },
          {
            message:
              "Some ingredients refused to spawn. RNG is trash today. Reload for better loot.",
            button: "Reroll",
          },
          {
            message:
              "The page lagged out mid-load like it’s running on hostel WiFi. Refresh to revive.",
            button: "Revive pls",
          },
          {
            message:
              "Something didn’t load. The resources are probably hiding in creative mode.",
            button: "Teleport them",
          },
          {
            message:
              "Page assets dipped without notice. They said ‘brb’ and never came back.",
            button: "Ghosted 💔",
          },
          {
            message:
              "Resources missing. Bro tried to cook Maggi without Maggi.",
            button: "Valid",
          },
          {
            message:
              "The page ingredients clipped through the map. Reload to respawn them.",
            button: "Respawn",
          },
          {
            message:
              "Resources refused to load because the syllabus stress aura is too strong.",
            button: "My bad aura",
          },
          {
            message:
              "The page couldn’t load stuff. Probably buffering its life choices.",
            button: "Same tbh",
          },
          {
            message:
              "Missing ingredients? This page is rawer than a cooking show disaster.",
            button: "Gordon who?",
          },
          {
            message:
              "The page tried to load but tripped over its own assets. Reload to help it up.",
            button: "I'll help",
          },
          {
            message:
              "Some resources froze like a Windows XP moment. Refresh before it plays the startup sound.",
            button: "Reboot",
          },
          {
            message:
              "The page is missing files because the network rage-quit mid-load.",
            button: "Unrage pls",
          },
          {
            message:
              "Resources didn’t load. They’re probably respawning in another timeline.",
            button: "Multiverse moment",
          },
          {
            message:
              "The page pulled a Thanos snap and half the assets vanished.",
            button: "Bring them back",
          },
          {
            message:
              "Something didn’t load. The internet looked at your request and said ‘nah.’",
            button: "Understandable",
          },
          {
            message:
              "Ingredients missing. The page is cooking vibes only, no content.",
            button: "Vibes accepted",
          },
          {
            message:
              "The page tried to load resources but forgot its own ingredients list. Reload to remind it.",
            button: "I'll remind it",
          },
        ];
        const randomRoast = roasts[Math.floor(Math.random() * roasts.length)];

        materioAlert(randomRoast.message, {
          title: "Resource Load Error",
          type: "error",
          buttonText: randomRoast.button,
        });
      }
    });
});

// Theme is managed by assets/scripts/theme.js via bundle.js.
// Legacy inline toggling here was causing conflicts with saved theme preferences.

document.addEventListener("DOMContentLoaded", function () {
  const isDark =
    document.body.classList.contains("dark-mode") ||
    (window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);
  const giscusScript = document.querySelector(
    'script[src="https://giscus.app/client.js"]',
  );
  if (giscusScript) {
    giscusScript.setAttribute(
      "data-theme",
      isDark ? "noborder_dark" : "noborder_light",
    );
  }
});

// No per-card class sync needed; CSS uses body.dark-mode selectors.

// Fullscreen management - prevent ESC from exiting, only Shift+F or button can toggle
const fullscreenButton = document.getElementById("fullscreenButton");
const pdfPresentationButton = document.getElementById("pdfPresentationButton");
let intentionalFullscreenExit = false; // Flag to track if exit was triggered by user action (button/shortcut)

// The popup chrome is outside the PDF.js iframe. Forward these actions to the
// native PDF.js controls so preset and custom zoom values remain consistent.
function clickPdfViewerControl(id) {
  const iframe = document.getElementById("pdf-iframe");
  const control = iframe?.contentDocument?.getElementById(id);
  if (control && !control.disabled) {
    control.click();
    return true;
  }
  return false;
}

pdfPresentationButton?.addEventListener("click", () => {
  if (clickPdfViewerControl("presentationMode")) {
    pdfPresentationButton.setAttribute("aria-label", "Exit presentation mode");
  }
});

// Intercept ESC key to prevent browser from exiting fullscreen
// This listener must be added with capture:true to intercept before browser handles it
document.addEventListener(
  "keydown",
  (e) => {
    // Only intercept ESC when in fullscreen mode
    if (e.key === "Escape" && document.fullscreenElement) {
      // Prevent the default browser behavior (exiting fullscreen)
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      // Do nothing - fullscreen stays active
      // User must use Shift+F or click fullscreen button to exit
      return false;
    }
  },
  true,
); // capture: true is critical to intercept before browser

fullscreenButton.addEventListener("click", () => {
  if (!document.fullscreenElement) {
    intentionalFullscreenExit = false;
    document.documentElement
      .requestFullscreen()
      .then(() => {
        popup.classList.add("fullscreen");
        // Change to exit fullscreen icon
        const icon = fullscreenButton.querySelector("i");
        icon.className = "fa-solid fa-compress";
        fullscreenButton.setAttribute("aria-label", "Exit fullscreen");
      })
      .catch((err) => { });
  } else {
    // Mark this as an intentional exit so fullscreenchange handler doesn't block it
    intentionalFullscreenExit = true;
    document
      .exitFullscreen()
      .then(() => {
        popup.classList.remove("fullscreen");
        // Change to enter fullscreen icon
        const icon = fullscreenButton.querySelector("i");
        icon.className = "fas fa-expand";
        fullscreenButton.setAttribute("aria-label", "Enter fullscreen");
      })
      .catch((err) => { });
  }
});

// Listen for fullscreen changes to update UI state
document.addEventListener("fullscreenchange", () => {
  if (!document.fullscreenElement) {
    // Fullscreen was exited - update UI
    popup.classList.remove("fullscreen");
    const icon = fullscreenButton.querySelector("i");
    icon.className = "fas fa-expand";
    fullscreenButton.setAttribute("aria-label", "Enter fullscreen");
    // Reset flag
    intentionalFullscreenExit = false;
  }
});

// Expose the intentional exit flag globally so keyboard-shortcuts.js can set it
window.setIntentionalFullscreenExit = (value) => {
  intentionalFullscreenExit = value;
};

// Function to load resources data
function loadResourcesData(restoreSemester = null) {
  const libUrl =
    window.MaterioLocalCDN?.transformUrl(
      "https://cdn.getmaterio.app/databases/beta/resource.lib.json",
    ) || "https://cdn.getmaterio.app/databases/beta/resource.lib.json";
  return fetch(libUrl)
    .then((response) => {
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.json();
    })
    .then((data) => {
      if (!data || typeof data !== "object") {
        throw new Error("Invalid data format received");
      }
      const semesterMapping = {
        9: "Additional Resources",
      };

      const semesterSelect = document.getElementById("semesterSelect");
      const currentSemester = restoreSemester || semesterSelect.value;

      semesterSelect.innerHTML = "";
      const placeholder = document.createElement("option");
      placeholder.value = "";
      placeholder.textContent = "Select Semester";
      semesterSelect.appendChild(placeholder);

      for (let sem in data) {
        const option = document.createElement("option");
        option.value = sem;
        option.textContent = semesterMapping[sem]
          ? semesterMapping[sem]
          : "Semester " + sem;
        semesterSelect.appendChild(option);
      }

      // Remove existing event listeners by cloning BEFORE setting value
      const oldSemesterSelect = semesterSelect;
      const newSemesterSelect = semesterSelect.cloneNode(true);
      oldSemesterSelect.parentNode.replaceChild(
        newSemesterSelect,
        oldSemesterSelect,
      );

      // Now get the new element and set up everything
      const finalSemesterSelect = document.getElementById("semesterSelect");

      // Restore the previous semester value if exists, otherwise leave unselected
      if (currentSemester && data[currentSemester]) {
        finalSemesterSelect.value = currentSemester;
      } else {
        // Default to semester 6
        finalSemesterSelect.value = "7";
      }

      // Chain listeners for automated selection
      finalSemesterSelect.addEventListener("change", function () {
        clearSelect("subjectSelect", "Select Subject");
        clearSelect("categorySelect", "Select Category");
        clearSelect("topicSelect", "Select Topic");
        const semKey = this.value;
        if (!semKey) return;
        const subjects = data[semKey];
        const subjectSelect = document.getElementById("subjectSelect");
        for (let subject in subjects) {
          const option = document.createElement("option");
          option.value = subject;
          option.textContent = subject;
          subjectSelect.appendChild(option);
        }
        subjectSelect.disabled = false;
      });

      document.getElementById("subjectSelect").addEventListener("change", function () {
        clearSelect("categorySelect", "Select Category");
        clearSelect("topicSelect", "Select Topic");
        const semKey = document.getElementById("semesterSelect").value;
        const subjectKey = this.value;
        if (!subjectKey) return;

        let categoriesArr;

        // Special handling for Vault (semester 9999)
        if (semKey === "9999") {
          // Get Vault array directly
          categoriesArr = data[semKey].Vault;
        } else {
          // Normal semester handling
          categoriesArr = data[semKey][subjectKey];
        }

        const categorySelect = document.getElementById("categorySelect");
        if (categoriesArr && categoriesArr.length) {
          let defaultSet = false;
          categoriesArr.forEach((catObj, idx) => {
            const option = document.createElement("option");
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
            categorySelect.dispatchEvent(new Event("change"));
          } else if (categoriesArr.length > 0) {
            categorySelect.selectedIndex = 1;
            categorySelect.dispatchEvent(new Event("change"));
          }
        }
      });

      document.getElementById("categorySelect").addEventListener("change", function () {
        clearSelect("topicSelect", "Select Topic");
        const semKey = document.getElementById("semesterSelect").value;
        const subjectKey = document.getElementById("subjectSelect").value;
        const categoryIndex = this.value;
        if (categoryIndex === "") return;

        let catObj;

        // Special handling for Vault (semester 9999)
        if (semKey === "9999") {
          // Get category from Vault array
          catObj = data[semKey].Vault[categoryIndex];
        } else {
          // Normal semester handling
          catObj = data[semKey][subjectKey][categoryIndex];
        }

        const topics = catObj.content;
        const topicSelect = document.getElementById("topicSelect");
        if (topics && topics.length > 0) {
          topics.forEach((topicItem) => {
            const topicName =
              typeof topicItem === "string"
                ? topicItem
                : topicItem?.name || topicItem?.title || topicItem?.topic || "";

            if (!topicName) return;

            const topicMetadata = resolveTopicOptionData(topicName, topicItem);
            storeTopicMetadata(
              semKey,
              subjectKey,
              categoryIndex,
              topicName,
              topicMetadata,
            );

            const option = document.createElement("option");
            option.value = topicName;
            option.textContent = topicName;
            if (topicMetadata.curatedBy) {
              option.dataset.curatedBy = topicMetadata.curatedBy;
            }
            if (topicMetadata.contributedBy) {
              option.dataset.contributedBy = topicMetadata.contributedBy;
            }
            topicSelect.appendChild(option);
          });
          topicSelect.disabled = false;
          // Default select first topic
          topicSelect.selectedIndex = 1;
          topicSelect.dispatchEvent(new Event("change"));
        }
      });

      function clearSelect(selectId, placeholderText) {
        const select = document.getElementById(selectId);
        select.innerHTML = "";
        const option = document.createElement("option");
        option.value = "";
        option.textContent = placeholderText;
        select.appendChild(option);
        select.disabled = true;
      }

      // Trigger change event after everything is set up
      if (finalSemesterSelect.value) {
        finalSemesterSelect.dispatchEvent(new Event("change"));
      }

      return data;
    })
    .catch((err) => {
      throw err;
    });
}

// Initial load
loadResourcesData();



// Load licenses content
document.addEventListener("DOMContentLoaded", function () {
  // Load licenses text when the details element is opened
  const licensesCard = document.getElementById("licensesCard");
  if (licensesCard) {
    const details = licensesCard.querySelector("details");
    let licensesLoaded = false;

    details.addEventListener("toggle", function () {
      if (this.open && !licensesLoaded) {
        const licensesText = document.getElementById("licensesText");
        licensesText.textContent = "Loading licenses...";

        fetch("/licenses.txt")
          .then((response) => {
            if (!response.ok) {
              throw new Error("Failed to load licenses");
            }
            return response.text();
          })
          .then((text) => {
            licensesText.textContent = text;
            licensesLoaded = true;
          })
          .catch((error) => {
            licensesText.textContent =
              "Error loading licenses. Please try again later.";
          });
      }
    });
  }
}); // Tab switcher functionality
document.addEventListener("DOMContentLoaded", function () {
  const tabSwitcherCard = document.getElementById("tabSwitcherCard");
  if (tabSwitcherCard) {
    const tabTexts = tabSwitcherCard.querySelectorAll(".tab-text");
    const activeIndicator = document.getElementById("activeTabIndicator");
    const contentSections = document.querySelectorAll(".tab-content-section"); // Initialize indicator position
    function updateIndicatorPosition(targetTab) {
      if (activeIndicator) {
        // Pill-shaped positioning - properly centered
        const leftPosition = targetTab === "preferences" ? "0" : "50%";
        activeIndicator.style.left = leftPosition;
      }
    }

    tabTexts.forEach((tabText) => {
      tabText.addEventListener("click", function () {
        const targetTab = this.getAttribute("data-target");

        // Update text states
        tabTexts.forEach((text) => text.classList.remove("active"));
        this.classList.add("active");

        // Update indicator position smoothly
        updateIndicatorPosition(targetTab);

        // Hide all content sections
        contentSections.forEach((section) => {
          section.classList.remove("active");
        });

        // Show target content section with slight delay
        const targetContent = document.getElementById(targetTab + "-content");
        if (targetContent) {
          setTimeout(() => {
            targetContent.classList.add("active");
          }, 150);
        }
      });
    });

    // Initialize position on load
    const activeTab = document.querySelector(".tab-text.active");
    if (activeTab) {
      // Wait for layout to be ready
      requestAnimationFrame(() => {
        updateIndicatorPosition(activeTab.getAttribute("data-target"));
      });
    }

    // Update position on window resize
    window.addEventListener("resize", () => {
      const activeTab = document.querySelector(".tab-text.active");
      if (activeTab) {
        requestAnimationFrame(() => {
          updateIndicatorPosition(activeTab.getAttribute("data-target"));
        });
      }
    });
  }
});

// Handle info icon click/tap to show tooltip
document.addEventListener("DOMContentLoaded", function () {
  const infoIcons = document.querySelectorAll(".info-icon");

  function adjustTooltipPosition(icon) {
    const tooltip = icon.querySelector(".tooltip");
    if (!tooltip || window.innerWidth > 768) return;

    // Reset classes
    tooltip.classList.remove("flip-left");

    // Check if tooltip would go off-screen to the right
    const iconRect = icon.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();
    const viewportWidth = window.innerWidth;

    if (iconRect.left + 200 > viewportWidth - 20) {
      tooltip.classList.add("flip-left");
    }
  }

  infoIcons.forEach((icon) => {
    // Handle both click and touch events
    icon.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();

      // Toggle active class for this icon
      this.classList.toggle("active");

      // Close other open tooltips
      infoIcons.forEach((otherIcon) => {
        if (otherIcon !== this) {
          otherIcon.classList.remove("active");
        }
      });

      // Adjust positioning if needed (mobile)
      if (this.classList.contains("active")) {
        setTimeout(() => adjustTooltipPosition(this), 10);
      }
    });

    // Handle touch events for better mobile experience
    icon.addEventListener("touchstart", function (e) {
      e.preventDefault();
      e.stopPropagation();
    });
  });

  // Close tooltip when clicking/touching outside
  document.addEventListener("click", function (e) {
    if (!e.target.closest(".info-icon")) {
      infoIcons.forEach((icon) => {
        icon.classList.remove("active");
      });
    }
  });

  // Close tooltip on touch outside for mobile
  document.addEventListener("touchstart", function (e) {
    if (!e.target.closest(".info-icon")) {
      infoIcons.forEach((icon) => {
        icon.classList.remove("active");
      });
    }
  });

  // Close tooltip when scrolling on mobile - use passive listener
  document.addEventListener(
    "scroll",
    function () {
      if (window.innerWidth <= 768) {
        infoIcons.forEach((icon) => {
          icon.classList.remove("active");
        });
      }
    },
    { passive: true },
  );

  // Reposition tooltips on window resize
  window.addEventListener("resize", function () {
    infoIcons.forEach((icon) => {
      if (icon.classList.contains("active")) {
        adjustTooltipPosition(icon);
      }
    });
  });
});

// ================================================
// INSIGHTROOM API - LOAD POSTS FROM API
// ================================================

const INSIGHTROOM_BASE_URL = (window.MATERIO_CONFIG && window.MATERIO_CONFIG.INSIGHTROOM_API) || "https://room.getmaterio.app/api/posts";
const INSIGHTROOM_APIS = [
  `${INSIGHTROOM_BASE_URL}?num=5`,
  "https://insightroom.vercel.app/api/posts?num=5",
];

async function fetchInsightroomPostsWithFallback() {
  let lastError = null;

  for (const endpoint of INSIGHTROOM_APIS) {
    try {
      const response = await fetch(endpoint, { redirect: "follow" });
      if (!response.ok) {
        throw new Error(`Failed to fetch posts from ${endpoint}: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error("Failed to fetch InsightRoom posts from all endpoints");
}

// Function to load posts from InsightRoom API
async function loadInsightroomPosts() {
  const defaultPostsContainer = document.getElementById("defaultPosts");
  const loadingEl = document.getElementById("postsLoading");
  const errorEl = document.getElementById("postsError");
  const allPostsDataEl = document.getElementById("allPostsData");

  if (!defaultPostsContainer || !allPostsDataEl) return;

  try {
    const allPosts = await fetchInsightroomPostsWithFallback();

    // Filter out private posts and get latest 5
    const publicPosts = allPosts.filter(
      (post) => post.visibility !== "private",
    );
    const latestPosts = publicPosts.slice(0, 5);

    // Hide loading
    if (loadingEl) loadingEl.style.display = "none";

    // Keep the exam card if it exists in the default view
    const examCardDefault = defaultPostsContainer.querySelector("#examCardDefault");

    // Replace any server-rendered fallback cards so the live feed stays authoritative.
    defaultPostsContainer.innerHTML = "";

    // Render posts as horizontal scrolling squircle cards
    latestPosts.forEach((post, index) => {
      const postDate = new Date(post.date);
      const formattedDate = postDate
        .toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        })
        .replace(/\//g, "-");

      const excerpt = post.excerpt || "";
      const truncatedExcerpt =
        excerpt.split(" ").slice(0, 12).join(" ") +
        (excerpt.split(" ").length > 12 ? "..." : "");

      // Use imgUrl from API or fallback to noidea.png
      let imageUrl = post.imgUrl || "";
      if (
        !imageUrl ||
        imageUrl === "null" ||
        imageUrl === "undefined" ||
        imageUrl.trim() === ""
      ) {
        imageUrl = "/assets/img/noidea.png";
      }

      const postHTML = `
                <a href="${post.link}" class="insight-card-link" target="_blank" ${post.visibility === "private" ? 'data-visibility="private"' : ""}>
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
      defaultPostsContainer.insertAdjacentHTML("beforeend", postHTML);
    });

    if (examCardDefault) {
      defaultPostsContainer.prepend(examCardDefault);
    }

    // Populate allPostsData for filtering/recommendations
    const postsData = publicPosts.map((post) => ({
      title: post.title,
      url: post.link,
      date: new Date(post.date)
        .toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        })
        .replace(/\//g, "-"),
      imgUrl: post.imgUrl || "",
      excerpt_home: post.excerpt || "",
      excerpt: post.excerpt || "",
      semester: post.semester || "",
      subject: post.subject || "",
      visibility: post.visibility || "public",
    }));
    allPostsDataEl.textContent = JSON.stringify(postsData);

    // Apply dark mode to dynamically created posts if dark mode is active
    const isDarkMode =
      document.body.classList.contains("dark-mode") ||
      (window.matchMedia &&
        window.matchMedia("(prefers-color-scheme: dark)").matches);

    if (isDarkMode) {
      latestPosts.forEach((post, index) => {
        const postElement = document.getElementById(`blogPost${index + 1}`);
        if (postElement) {
          postElement.classList.add("dark-mode");
        }
      });
    }

    // Dispatch event to notify that posts are loaded
    window.dispatchEvent(
      new CustomEvent("insightroomPostsLoaded", { detail: postsData }),
    );
  } catch (error) {
    if (loadingEl) loadingEl.style.display = "none";
    if (errorEl) errorEl.style.display = "block";
  }
}

// Load InsightRoom posts on DOM ready
document.addEventListener("DOMContentLoaded", loadInsightroomPosts);

// ================================================
// SMART RECOMMENDATION SYSTEM
// ================================================

// CDN URL for attachments database
const ATTACHMENTS_CDN_URL =
  "https://static-materio.vercel.app/attachments.json";
const ATTACHMENTS_BASE_URL = "https://static-materio.vercel.app/";

// Cache for attachments data
let allAttachments = [];
let attachmentsLoaded = false;

// Function to load attachments from CDN
async function loadAttachmentsData() {
  if (attachmentsLoaded) return allAttachments;

  try {
    const response = await fetch(ATTACHMENTS_CDN_URL);
    if (!response.ok) throw new Error("Failed to fetch attachments");
    allAttachments = await response.json();
    attachmentsLoaded = true;
    return allAttachments;
  } catch (error) {
    return [];
  }
}

// Function to get icon for file type
function getFileTypeIcon(extension) {
  const iconMap = {
    // Programming languages
    java: "fa-brands fa-java",
    py: "fa-brands fa-python",
    js: "fa-brands fa-js",
    html: "fa-brands fa-html5",
    css: "fa-brands fa-css3-alt",
    c: "fa-solid fa-c",
    cpp: "fa-solid fa-c",
    h: "fa-solid fa-c",
    kt: "fa-solid fa-k",
    ts: "fa-brands fa-js",

    // Documents
    txt: "fa-solid fa-file-lines",
    md: "fa-brands fa-markdown",
    docx: "fa-solid fa-file-word",
    doc: "fa-solid fa-file-word",
    pptx: "fa-solid fa-file-powerpoint",
    ppt: "fa-solid fa-file-powerpoint",
    xlsx: "fa-solid fa-file-excel",
    xls: "fa-solid fa-file-excel",
    pdf: "fa-solid fa-file-pdf",

    // Data formats
    json: "fa-solid fa-brackets-curly",
    xml: "fa-solid fa-code",
    sql: "fa-solid fa-database",
    ipynb: "fa-solid fa-notebook",

    // Default
    default: "fa-solid fa-file-code",
  };

  return iconMap[extension.toLowerCase()] || iconMap["default"];
}

// Smart Recommendation System
document.addEventListener("DOMContentLoaded", function () {
  const semesterSelect = document.getElementById("semesterSelect");
  const subjectSelect = document.getElementById("subjectSelect");
  const categorySelect = document.getElementById("categorySelect");
  const topicSelect = document.getElementById("topicSelect");
  const blogCardHeading = document.getElementById("blogCardHeading");
  const defaultPosts = document.getElementById("defaultPosts");
  const recommendedPosts = document.getElementById("recommendedPosts");
  const noPostsMessage = document.getElementById("noPostsMessage");
  const allPostsDataElement = document.getElementById("allPostsData");
  const attachmentsCard = document.getElementById("attachmentsCard");
  const attachmentsPillsContainer = document.getElementById(
    "attachmentsPillsContainer",
  );
  const attachmentsEmpty = document.getElementById("attachmentsEmpty");

  // FORCE RESET: Ensure we start with "Latest from Insightroom" on every load
  // The user requested that it should be "latest... initially".
  const readingForm = document.getElementById("readingSelectionForm");
  if (readingForm) {
    readingForm.reset();
    // Also manually reset selects to be sure (browser might persist values)
    if (semesterSelect) {
      semesterSelect.value = "7";
      semesterSelect.dispatchEvent(new Event("change"));
    }
    if (subjectSelect) subjectSelect.value = "";
    if (categorySelect) categorySelect.value = "";
    if (topicSelect) topicSelect.value = "";
  }

  // IMMEDIATE CHECK: Now this will likely be false, but kept for robustness
  const initialSem = semesterSelect?.value;
  const initialSub = subjectSelect?.value;
  if (
    (initialSem && initialSem.trim() !== "") ||
    (initialSub && initialSub.trim() !== "")
  ) {
    if (blogCardHeading) blogCardHeading.innerHTML = "Smart Recommendations";
    if (defaultPosts)
      defaultPosts.style.setProperty("display", "none", "important");
  }

  // Parse all posts data - will be populated by loadInsightroomPosts
  let allPosts = [];

  // Function to parse posts data
  function parsePostsData() {
    try {
      allPosts = JSON.parse(allPostsDataElement.textContent);
    } catch (e) {
      // Error parsing posts data
    }
  }

  // Initial parse (may be empty if API hasn't loaded yet)
  parsePostsData();

  // Re-parse when InsightRoom posts are loaded
  window.addEventListener("insightroomPostsLoaded", function (e) {
    parsePostsData();
    // Trigger update in case selections are already made
    updateSmartRecommendations();
  });

  // Load attachments data proactively
  loadAttachmentsData();

  // Check authentication and hide private posts if not authenticated
  checkAuthAndFilterPosts();

  // Function to check authentication and hide private posts
  async function checkAuthAndFilterPosts() {
    const token = localStorage.getItem("materio_auth_token");
    let hasAdminPrivileges = false;
    let isProUser = false;
    let isLiteUser = false;

    // Hide entire blogs card if user is not logged in
    const blogsCard = document.getElementById("blogs");
    if (!token) {
      if (blogsCard) {
        blogsCard.style.display = "none";
      }
      return;
    }

    if (token) {
      try {
        const response = await fetch("/api/v2/profile", {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          credentials: "same-origin",
        });

        if (response.ok) {
          const userData = await response.json();
          hasAdminPrivileges = userData.user?.hasAdminPrivileges || false;
          isProUser = userData.user?.isPlusUser || false;
          isLiteUser = userData.user?.isLiteUser || false;
        }
      } catch (error) {
        // Keep defaults when profile lookup fails; visibility is controlled by user toggle.
      }
    }

    // Show/hide blogs card by InsightRoom toggle preference.
    // Access flags still control private content filtering below.
    if (blogsCard) {
      let isInsightroomEnabled = true; // default
      const settingsCookie = getCookie("insightroomSettings");
      if (settingsCookie) {
        try {
          // Handle both encoded and non-encoded cookie values
          let decoded = settingsCookie;
          try {
            decoded = decodeURIComponent(settingsCookie);
          } catch (e) {
            // Already decoded or not encoded
          }
          const settings = JSON.parse(decoded);
          if (Array.isArray(settings) && settings.length === 2) {
            isInsightroomEnabled = settings[0];
          }
        } catch (e) {
          // ignore parse errors, use default
        }
      }
      blogsCard.style.display = isInsightroomEnabled ? "block" : "none";
    }

    // Hide private posts in default listing if no admin privileges or pro membership
    if (!hasAdminPrivileges && !isProUser) {
      const privatePosts = document.querySelectorAll(
        '#defaultPosts [data-visibility="private"]',
      );
      privatePosts.forEach((post) => {
        post.style.display = "none";
      });
    }

    // Store private access status for filtering recommendations
    window.materioUserHasPrivateAccess = hasAdminPrivileges || isProUser;
    window.materioUserHasAdminPrivileges = hasAdminPrivileges;

    // Apply appropriate logo based on user privileges
    const versionInfo = document.getElementById("versionInfo");
    if (versionInfo) {
      // Remove any existing privilege classes
      versionInfo.classList.remove(
        "premium-user",
        "plus-user",
        "admin-user",
        "pro-user",
      );

      // Apply the appropriate class based on privileges
      if (hasAdminPrivileges) {
        versionInfo.classList.add("admin-user");
      } else if (isProUser) {
        versionInfo.classList.add("pro-user");
      } else if (isLiteUser) {
        versionInfo.classList.add("plus-user"); // Plus (Lite) users get the plu.svg
      }

      // Force a repaint/style update to ensure the change is visible immediately
      // This can sometimes help with SVG background images not updating
      const display = versionInfo.style.display;
      versionInfo.style.display = "none";
      versionInfo.offsetHeight; // trigger reflow
      versionInfo.style.display = display;
    }
  }

  // Function to create post HTML
  function createPostHTML(post, index) {
    const fullExcerpt = post.excerpt_home || post.excerpt || "";
    const truncatedExcerpt =
      fullExcerpt.split(" ").slice(0, 12).join(" ") +
      (fullExcerpt.split(" ").length > 12 ? "..." : "");
    const visibilityAttr =
      post.visibility === "private" ? 'data-visibility="private"' : "";

    // Use imgUrl from API or fallback to noidea.png
    let imageUrl = post.imgUrl || "";
    if (
      !imageUrl ||
      imageUrl === "null" ||
      imageUrl === "undefined" ||
      imageUrl.trim() === ""
    ) {
      imageUrl = "/assets/img/noidea.png";
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

  // Function to create attachment pill HTML
  function createAttachmentPillHTML(attachment) {
    const extension =
      attachment.type || attachment.path?.split(".").pop() || "file";
    const displayName =
      attachment.name || attachment.path?.split("/").pop() || "Unknown";
    const iconClass = getFileTypeIcon(extension);
    const fileUrl = `https://static-materio.vercel.app/${attachment.path}`;

    return `
            <a href="${fileUrl}"
               class="attachment-pill"
               data-type="${extension.toLowerCase()}"
               target="_blank"
               title="${displayName}"
               rel="noopener noreferrer">
                <i class="${iconClass} attachment-pill-icon"></i>
                <span class="attachment-pill-name">${displayName}</span>
            </a>
        `;
  }

  // Function to filter attachments based on current selection
  function filterAttachments(attachments, semester, subject, category, topic) {
    if (!attachments || attachments.length === 0) return [];

    return attachments.filter((att) => {
      // Normalize all values for comparison
      const normalize = (val) => (val ? String(val).toLowerCase().trim() : "");

      const attSemester = normalize(att.semester);
      const attSubject = normalize(att.subject);
      const attCategory = normalize(att.category);
      const attTopic = normalize(att.topic);

      const selSemester = normalize(semester);
      const selSubject = normalize(subject);
      const selCategory = normalize(category);
      const selTopic = normalize(topic);

      // Match logic: attachment matches if it matches ANY of the selected criteria
      // Priority: topic > category > subject > semester
      // If more specific selection is made, use that; otherwise fall back to broader match

      // If topic is selected, match on topic (most specific)
      if (selTopic && attTopic === selTopic) return true;

      // If category is selected, match on category
      if (selCategory && attCategory === selCategory) return true;

      // If subject is selected, match on subject
      if (selSubject && attSubject === selSubject) return true;

      // If only semester selected, match on semester
      if (selSemester && attSemester === selSemester) return true;

      return false;
    });
  }

  // Function to update attachments card
  async function updateAttachmentsCard() {
    if (!attachmentsCard || !attachmentsPillsContainer) return;

    const selectedSemester = semesterSelect?.value || "";
    const selectedSubject = subjectSelect?.value || "";
    const selectedCategory = categorySelect?.value || "";
    const selectedTopic = topicSelect?.value || "";

    // Only show if at least semester or subject is selected
    if (!selectedSemester && !selectedSubject) {
      attachmentsCard.style.display = "none";
      return;
    }

    // Load attachments if not already loaded
    const attachments = await loadAttachmentsData();

    // Filter attachments based on current selection
    const filteredAttachments = filterAttachments(
      attachments,
      selectedSemester,
      selectedSubject,
      selectedCategory,
      selectedTopic,
    );

    if (filteredAttachments.length > 0) {
      attachmentsCard.style.display = "flex";
      attachmentsPillsContainer.style.display = "flex";
      if (attachmentsEmpty) attachmentsEmpty.style.display = "none";

      // Render all matched pills; vertical scroll handles long lists.
      attachmentsPillsContainer.innerHTML = filteredAttachments
        .map((att) => createAttachmentPillHTML(att))
        .join("");
    } else {
      // Hide card entirely if no attachments found
      attachmentsCard.style.display = "none";
    }
  }

  // Function to fetch recommendations dynamically based on semester & subject
  async function fetchInsightroomRecommendations(semester, subject) {
    let lastError = null;
    const params = [];
    if (semester) params.push(`semester=${encodeURIComponent(semester)}`);
    if (subject) params.push(`subject=${encodeURIComponent(subject)}`);
    const queryString = params.length > 0 ? `?${params.join("&")}` : "";

    const endpoints = [
      `${INSIGHTROOM_BASE_URL}${queryString}`,
      `https://insightroom.vercel.app/api/posts${queryString}`
    ];

    for (const endpoint of endpoints) {
      try {
        const response = await fetch(endpoint, { redirect: "follow" });
        if (!response.ok) {
          throw new Error(`Failed to fetch recommendations from ${endpoint}: ${response.status}`);
        }
        const rawPosts = await response.json();
        
        // Map to expected format for createPostHTML
        const mappedPosts = rawPosts.map((post) => ({
          title: post.title,
          url: post.link || post.url,
          date: post.date ? new Date(post.date)
            .toLocaleDateString("en-GB", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
            })
            .replace(/\//g, "-") : "",
          imgUrl: post.imgUrl || "",
          excerpt_home: post.excerpt || "",
          excerpt: post.excerpt || "",
          semester: post.semester || "",
          subject: post.subject || "",
          visibility: post.visibility || "public",
        }));

        // Filter private posts client-side based on user access
        return mappedPosts.filter((post) => {
          if (
            post.visibility === "private" &&
            !window.materioUserHasPrivateAccess
          ) {
            return false;
          }
          return true;
        });
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError || new Error("Failed to fetch InsightRoom recommendations from all endpoints");
  }

  // Main function to update smart recommendations (posts + attachments)
  async function updateSmartRecommendations() {
    const selectedSemester = semesterSelect?.value || "";
    const selectedSubject = subjectSelect?.value || "";
    const selectedCategory = categorySelect?.value || "";
    const selectedTopic = topicSelect?.value || "";

    // Check if any selection is made
    const hasSelection =
      (selectedSemester && selectedSemester.trim() !== "") ||
      (selectedSubject && selectedSubject.trim() !== "");

    // If no semester or subject selected, show default posts
    if (!hasSelection) {
      if (blogCardHeading) {
        blogCardHeading.innerHTML = "Latest from the Insightroom";
      }
      if (defaultPosts) defaultPosts.style.removeProperty("display");
      if (recommendedPosts)
        recommendedPosts.style.setProperty("display", "none", "important");
      if (noPostsMessage) noPostsMessage.style.display = "none";
      if (attachmentsCard) attachmentsCard.style.display = "none";
      return;
    }

    // Filter posts based on semester and subject
    let filteredPosts = [];
    try {
      filteredPosts = await fetchInsightroomRecommendations(selectedSemester, selectedSubject);
    } catch (e) {
      console.error("Failed to fetch recommendations dynamically:", e);
      // Fallback to local filtering of allPosts in case fetch fails
      filteredPosts = allPosts.filter((post) => {
        const selectedSem = String(selectedSemester).toLowerCase().trim();
        const selectedSub = String(selectedSubject).toLowerCase().trim();

        // Filter out private posts if user doesn't have admin privileges or plus access
        if (
          post.visibility === "private" &&
          !window.materioUserHasPrivateAccess
        ) {
          return false;
        }

        // Handle semester matching (can be string or array)
        let semesterMatch = false;
        if (selectedSem) {
          if (Array.isArray(post.semester)) {
            semesterMatch = post.semester.some(
              (sem) => String(sem).toLowerCase().trim() === selectedSem,
            );
          } else if (post.semester) {
            semesterMatch =
              String(post.semester).toLowerCase().trim() === selectedSem;
          }
        }

        // Handle subject matching (can be string or array)
        let subjectMatch = false;
        if (selectedSub) {
          if (Array.isArray(post.subject)) {
            subjectMatch = post.subject.some(
              (sub) => String(sub).toLowerCase().trim() === selectedSub,
            );
          } else if (post.subject) {
            subjectMatch =
              String(post.subject).toLowerCase().trim() === selectedSub;
          }
        }

        // Match if either both match, or if only one is selected and it matches
        if (selectedSem && selectedSub) {
          return semesterMatch && subjectMatch;
        } else if (selectedSem) {
          return semesterMatch;
        } else if (selectedSub) {
          return subjectMatch;
        }
        return false;
      });
    }

    // Update attachments card
    await updateAttachmentsCard();

    // Get reference to attachments card to preserve it
    const attachmentsCardHTML = attachmentsCard
      ? attachmentsCard.outerHTML
      : "";

    if (
      filteredPosts.length > 0 ||
      (attachmentsCard && attachmentsCard.style.display !== "none")
    ) {
      if (blogCardHeading) blogCardHeading.innerHTML = "Smart Recommendations";

      // Hide default posts
      if (defaultPosts) {
        defaultPosts.style.setProperty("display", "none", "important");
      }
      if (noPostsMessage) noPostsMessage.style.display = "none";

      // Show recommended posts with flex layout
      if (recommendedPosts) {
        recommendedPosts.style.removeProperty("display");
        if (getComputedStyle(recommendedPosts).display === "none") {
          recommendedPosts.style.display = "flex";
        }

        // Show all filtered posts without limit
        const postsToShow = filteredPosts;
        const postsHTML = postsToShow
          .map((post, index) => createPostHTML(post, index + 1))
          .join("");

        // NON-DESTRUCTIVE UPDATE:
        // 1. Remove existing post links (but keep Attachments Card and Exam Card)
        const existingPostLinks =
          recommendedPosts.querySelectorAll(".insight-card-link");
        existingPostLinks.forEach((el) => el.remove());

        // 2. Insert new posts after attachments card (at the end of container)
        recommendedPosts.insertAdjacentHTML("beforeend", postsHTML);

        // Apply current theme to newly created recommended posts
        const isDarkMode = document.body.classList.contains("dark-mode");
        postsToShow.forEach((post, index) => {
          const postElement = document.getElementById(
            `recommendedPost${index + 1}`,
          );
          if (postElement) {
            if (isDarkMode) {
              postElement.classList.add("dark-mode");
            } else {
              postElement.classList.remove("dark-mode");
            }
          }
        });
      }

      // Trigger exam card display logic for Smart Recommendations view
      if (window.loadAndDisplayExamCard) {
        window.loadAndDisplayExamCard();
      }
    } else {
      // No posts found for selected criteria - but show attachments if available
      if (blogCardHeading) blogCardHeading.innerHTML = "Smart Recommendations";

      // Hide default posts
      if (defaultPosts) {
        defaultPosts.style.setProperty("display", "none", "important");
      }

      if (attachmentsCard && attachmentsCard.style.display !== "none") {
        // Show only attachments card
        if (recommendedPosts) {
          recommendedPosts.style.removeProperty("display");
          if (getComputedStyle(recommendedPosts).display === "none") {
            recommendedPosts.style.display = "flex";
          }
          // Clear posts
          const existingPostLinks =
            recommendedPosts.querySelectorAll(".insight-card-link");
          existingPostLinks.forEach((el) => el.remove());
        }
        if (noPostsMessage) noPostsMessage.style.display = "none";
      } else {
        // No posts and no attachments - but exam card might still need to show
        // Keep recommendedPosts visible so exam card can render inside it.
        // The async loadAndDisplayExamCard / displayExamCard in exam-card.js
        // will ensure #recommendedPosts stays visible if the exam card is needed.
        if (recommendedPosts) {
          recommendedPosts.style.removeProperty("display");
          if (getComputedStyle(recommendedPosts).display === "none") {
            recommendedPosts.style.display = "flex";
          }
          // Clear any leftover post links
          const existingPostLinks =
            recommendedPosts.querySelectorAll(".insight-card-link");
          existingPostLinks.forEach((el) => el.remove());
        }
        // Hide "no posts" message initially (exam card may still appear)
        if (noPostsMessage) noPostsMessage.style.display = "none";
      }

      // Trigger exam card display logic for Smart Recommendations view
      if (window.loadAndDisplayExamCard) {
        window.loadAndDisplayExamCard();
      }
    }
  }

  // Add event listeners to all dropdowns for consistent triggering
  if (semesterSelect) {
    semesterSelect.addEventListener("change", updateSmartRecommendations);
  }
  if (subjectSelect) {
    subjectSelect.addEventListener("change", updateSmartRecommendations);
  }
  if (categorySelect) {
    categorySelect.addEventListener("change", updateSmartRecommendations);
  }
  if (topicSelect) {
    topicSelect.addEventListener("change", updateSmartRecommendations);
  }

  // Expose function globally for external triggers
  window.updateSmartRecommendations = updateSmartRecommendations;
});

// ================================================
// AD-FREE EXPERIENCE FOR PLUS & ADMIN USERS
// ================================================

// Function to check if user has ad-free privileges
function checkAndApplyAdFreeExperience() {
  try {
    // Get user data from localStorage
    const userDataStr = localStorage.getItem("materio_user");
    if (!userDataStr) {
      // No user data, remove ad-free class if it exists
      document.body.classList.remove("ad-free-user");
      return false;
    }

    const userData = JSON.parse(userDataStr);

    // Check if user has plus or admin privileges
    const hasAdFreePrivileges =
      userData.isPlusUser === true || userData.hasAdminPrivileges === true;

    if (hasAdFreePrivileges) {
      // Apply ad-free experience
      document.body.classList.add("ad-free-user");

      // Hide any dynamically loaded ads
      hideExistingAds();

      return true;
    } else {
      // Remove ad-free class if user doesn't have privileges
      document.body.classList.remove("ad-free-user");
      return false;
    }
  } catch (error) {
    // On error, don't apply ad-free experience (safe default)
    document.body.classList.remove("ad-free-user");
    return false;
  }
}

// Function to hide any existing ads that might have loaded
function hideExistingAds() {
  // Hide AdSense ads
  const adsenseElements = document.querySelectorAll(
    '.adsbygoogle, ins[class*="adsbygoogle"]',
  );
  adsenseElements.forEach((ad) => {
    ad.style.display = "none";
    ad.style.visibility = "hidden";
  });

  // Hide common ad containers
  const adContainers = document.querySelectorAll(
    '.ad-container, .advertisement, .ad-banner, .google-ads, [id*="google_ads"], [class*="google-ad"]',
  );
  adContainers.forEach((container) => {
    container.style.display = "none";
  });
}

// Check for ad-free experience on page load
document.addEventListener("DOMContentLoaded", function () {
  checkAndApplyAdFreeExperience();
});

// Re-check when user data changes (e.g., after login/logout)
window.addEventListener("storage", function (e) {
  if (e.key === "materio_user") {
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
  const settingsCookie = getCookie("insightroomSettings");
  if (settingsCookie) {
    try {
      // Try to decode URI component (for newly saved cookies)
      let decoded = settingsCookie;
      try {
        decoded = decodeURIComponent(settingsCookie);
      } catch (e) {
        // Already decoded or not encoded, use as-is
      }
      const settings = JSON.parse(decoded);
      if (Array.isArray(settings) && settings.length === 2) {
        return settings;
      }
    } catch (e) {
      // Error parsing insightroomSettings cookie
    }
  }
  // Default: [enabled=true, view='normal']
  return [true, "normal"];
}

// Function to save Insightroom settings to cookie
function saveInsightroomSettings(enabled, view) {
  const settings = [enabled, view];
  // Use encodeURIComponent to properly escape JSON special characters
  setCookie(
    "insightroomSettings",
    encodeURIComponent(JSON.stringify(settings)),
    365,
  );
}

// Function to handle Insightroom section visibility and view mode
function handleInsightroomToggle() {
  const insightroomToggle = document.getElementById("insightroomToggle");
  const blogsSection = document.getElementById("blogs");
  const viewOptions = document.getElementById("insightroomViewOptions");
  const dropdownWrapper = document.getElementById("viewStyleDropdownWrapper");
  const dropdownTrigger = document.getElementById("viewStyleDropdownTrigger");
  const dropdown = document.getElementById("viewStyleDropdown");
  const selectedText = document.getElementById("viewStyleSelectedText");
  const dropdownItems = document.querySelectorAll(".view-style-item");

  if (!insightroomToggle || !blogsSection) {
    return;
  }

  // Load saved preferences
  const [isEnabled, viewMode] = getInsightroomSettings();

  // Set toggle state
  insightroomToggle.checked = isEnabled;

  // Set dropdown selected state
  if (selectedText) {
    selectedText.textContent = viewMode === "folded" ? "Folded" : "Normal";
  }

  // Mark the selected item
  dropdownItems.forEach((item) => {
    if (item.dataset.value === viewMode) {
      item.classList.add("selected");
    } else {
      item.classList.remove("selected");
    }
  });

  // Show/hide view options based on toggle state
  if (viewOptions) {
    viewOptions.style.display = isEnabled ? "block" : "none";
  }

  // Apply initial state
  applyInsightroomViewMode(isEnabled, viewMode);

  // Add event listener for toggle changes
  insightroomToggle.addEventListener("change", function () {
    // Haptic feedback
    if (window.MaterioHaptics) {
      window.MaterioHaptics.vibrate(this.checked ? "toggleOn" : "toggleOff");
    }

    const enabled = this.checked;
    // Read the view mode from saved settings to preserve it, not from DOM which could be stale
    const [, savedViewMode] = getInsightroomSettings();
    const currentView = savedViewMode || "normal";

    // Show/hide view options
    if (viewOptions) {
      viewOptions.style.display = enabled ? "block" : "none";
    }

    applyInsightroomViewMode(enabled, currentView);
    saveInsightroomSettings(enabled, currentView);
  });

  // Dropdown toggle
  if (dropdownTrigger && dropdownWrapper) {
    dropdownTrigger.addEventListener("click", function (e) {
      e.stopPropagation();
      e.preventDefault();
      const isOpen = dropdownWrapper.classList.contains("open");
      // Haptic feedback
      if (window.MaterioHaptics) {
        window.MaterioHaptics.vibrate(
          isOpen ? "dropdownClose" : "dropdownOpen",
        );
      }
      dropdownWrapper.classList.toggle("open");
      dropdown.classList.toggle("show");
    });
  }

  // Dropdown item selection
  dropdownItems.forEach((item) => {
    item.addEventListener("click", function (e) {
      e.preventDefault();

      // Haptic feedback
      if (window.MaterioHaptics) {
        window.MaterioHaptics.vibrate("select");
      }

      const value = this.dataset.value;
      const label = value === "folded" ? "Folded" : "Normal";

      // Update selected text
      if (selectedText) {
        selectedText.textContent = label;
      }

      // Update selected state
      dropdownItems.forEach((i) => i.classList.remove("selected"));
      this.classList.add("selected");

      // Close dropdown
      dropdownWrapper.classList.remove("open");
      dropdown.classList.remove("show");

      // Apply and save
      const enabled = insightroomToggle.checked;
      applyInsightroomViewMode(enabled, value);
      saveInsightroomSettings(enabled, value);
    });
  });

  // Close dropdown when clicking outside
  document.addEventListener("click", function (e) {
    if (dropdownWrapper && !dropdownWrapper.contains(e.target)) {
      dropdownWrapper.classList.remove("open");
      if (dropdown) dropdown.classList.remove("show");
    }
  });
}

// Function to apply the Insightroom view mode
function applyInsightroomViewMode(enabled, viewMode) {
  const blogsSection = document.getElementById("blogs");
  const headerContainer = document.getElementById("blogHeaderContainer");
  const postsContainer = document.getElementById("blogPostsContent");
  const chevron = document.getElementById("blogFoldChevron");

  if (!blogsSection) return;

  if (!enabled) {
    // Section is disabled - hide everything
    blogsSection.style.display = "none";
    return;
  }

  // Section is enabled
  blogsSection.style.display = "block";

  if (viewMode === "folded") {
    // Folded mode: show chevron, make header clickable, hide posts by default
    blogsSection.classList.add("blog-folded");
    if (chevron) {
      chevron.style.display = "inline-block";
      chevron.style.transform = "rotate(0deg)";
    }
    if (headerContainer) {
      headerContainer.style.cursor = "pointer";
    }
    if (postsContainer) {
      postsContainer.style.display = "none";
    }
    // Reset expanded state
    blogsSection.classList.remove("blog-expanded");
  } else {
    // Normal mode: hide chevron, show posts, header not clickable
    blogsSection.classList.remove("blog-folded");
    blogsSection.classList.remove("blog-expanded");
    if (chevron) {
      chevron.style.display = "none";
    }
    if (headerContainer) {
      headerContainer.style.cursor = "default";
    }
    if (postsContainer) {
      postsContainer.style.display = "block";
    }
  }
}

// Function to toggle folded blog section expand/collapse
function toggleBlogFoldedState() {
  const blogsSection = document.getElementById("blogs");
  const postsContainer = document.getElementById("blogPostsContent");
  const chevron = document.getElementById("blogFoldChevron");

  if (!blogsSection || !postsContainer) return;

  const isExpanded = blogsSection.classList.contains("blog-expanded");

  if (isExpanded) {
    // Collapse - add blog-folded back for compact height
    blogsSection.classList.remove("blog-expanded");
    blogsSection.classList.add("blog-folded");
    postsContainer.style.display = "none";
    if (chevron) {
      chevron.style.transform = "rotate(0deg)";
    }
  } else {
    // Expand - remove blog-folded to allow full height
    blogsSection.classList.add("blog-expanded");
    blogsSection.classList.remove("blog-folded");
    postsContainer.style.display = "block";
    if (chevron) {
      chevron.style.transform = "rotate(180deg)";
    }
  }
}

// Initialize Insightroom toggle when DOM is loaded
document.addEventListener("DOMContentLoaded", function () {
  // Initialize immediately - no delay needed, this prevents flash of incorrect state
  handleInsightroomToggle();

  // Add click handler for header in folded mode
  const headerContainer = document.getElementById("blogHeaderContainer");
  if (headerContainer) {
    headerContainer.addEventListener("click", function (e) {
      // Only toggle if in folded mode (chevron is visible)
      const chevron = document.getElementById("blogFoldChevron");
      if (chevron && chevron.style.display !== "none") {
        // Don't toggle if clicking on the View More link
        if (!e.target.closest(".view-more-btn")) {
          toggleBlogFoldedState();
        }
      }
    });
  }
});

// Global function to toggle Insightroom feed on/off (used by keyboard shortcuts)
// This properly toggles AND persists the state
window.toggleInsightroomFeed = function () {
  const insightroomToggle = document.getElementById("insightroomToggle");
  if (insightroomToggle) {
    // Toggle the checkbox state
    insightroomToggle.checked = !insightroomToggle.checked;
    // Dispatch change event to trigger the handler
    insightroomToggle.dispatchEvent(new Event("change", { bubbles: true }));
  }
};

// ================================================
// CLEAR SITE DATA FUNCTIONALITY
// ================================================

// Function to clear all site data (cookies, cache, IndexedDB, service workers)
async function clearAllSiteData() {
  // Show confirmation dialog using custom modal
  const confirmed = await materioConfirm(
    "This will clear all site data including:\n\n• Cookies and local storage\n• Cached files\n• Your Downloaded files\n• Service workers\n\nYou will be logged out and all preferences will be reset.",
    {
      title: "Clear All Data?",
      type: "danger",
      confirmText: "Clear All Data",
      cancelText: "Cancel",
      danger: true,
    },
  );

  if (!confirmed) return;

  try {
    // Show loading state
    const card = document.getElementById("clearSiteDataCard");
    if (card) {
      card.style.opacity = "0.5";
      card.style.pointerEvents = "none";
    }

    document.cookie.split(";").forEach(function (c) {
      const name = c.split("=")[0].trim();
      document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/";
      document.cookie =
        name +
        "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=" +
        window.location.hostname;
    });

    // 2. Clear localStorage
    localStorage.clear();

    // 3. Clear sessionStorage
    sessionStorage.clear();

    // 4. Clear IndexedDB databases
    if (window.indexedDB && indexedDB.databases) {
      const databases = await indexedDB.databases();
      for (const db of databases) {
        if (db.name) {
          indexedDB.deleteDatabase(db.name);
        }
      }
    }

    // 5. Unregister all service workers
    if ("serviceWorker" in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const registration of registrations) {
        await registration.unregister();
      }
    }

    // 6. Clear Cache Storage
    if ("caches" in window) {
      const cacheNames = await caches.keys();
      for (const cacheName of cacheNames) {
        await caches.delete(cacheName);
      }
    }

    // Show success message using custom modal
    await materioAlert(
      "All site data has been cleared successfully.\n\nThe page will now reload.",
      {
        title: "Data Cleared",
        type: "success",
        buttonText: "Reload",
      },
    );

    // Reload the page to apply changes
    window.location.reload(true);
  } catch (error) {
    await materioAlert(
      "An error occurred while clearing site data. Some data may not have been cleared.",
      {
        title: "Error",
        type: "danger",
        buttonText: "OK",
      },
    );

    // Restore card state
    const card = document.getElementById("clearSiteDataCard");
    if (card) {
      card.style.opacity = "1";
      card.style.pointerEvents = "auto";
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
let searchLoadingTimer = null;

function stopSearchLoading() {
  if (searchLoadingTimer) {
    clearTimeout(searchLoadingTimer);
    searchLoadingTimer = null;
  }
}

function buildDidYouMeanSuggestion(query) {
  if (!query) return "";

  let cleaned = String(query)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) return "";

  cleaned = cleaned.replace(/\bch\s*(\d+)\b/g, "chapter $1");
  cleaned = cleaned.replace(/\bunit\s*(\d+)\b/g, "unit $1");

  const fillerPatterns = [
    /\bthat one\b/g,
    /\bthis one\b/g,
    /\bthat pdf\b/g,
    /\bthis pdf\b/g,
    /\bthe pdf\b/g,
    /\bpdf with\b/g,
    /\bpdf about\b/g,
    /\bcontent about\b/g,
    /\bcontent on\b/g,
    /\bnotes on\b/g,
    /\bnotes about\b/g,
    /\blooking for\b/g,
    /\bi want\b/g,
    /\bi need\b/g,
    /\bcan you\b/g,
    /\bplease\b/g,
    /\bpls\b/g,
    /\bshow me\b/g,
    /\bgive me\b/g,
    /\bfind me\b/g,
    /\bneed help with\b/g,
  ];

  for (const pattern of fillerPatterns) {
    cleaned = cleaned.replace(pattern, " ");
  }

  cleaned = cleaned.replace(
    /\b(pdf|notes|note|material|materials|content|chapter|unit|module|topic|document|file|with|on|about|for|of|the|a|an|one|that|this|please|pls|show|give|find|need|want|looking|help|info|information)\b/g,
    " ",
  );

  cleaned = cleaned.replace(/\s+/g, " ").trim();
  return cleaned;
}

function startSearchLoading(modalList, query, aiMode) {
  if (!modalList) return;
  stopSearchLoading();

  const textEl = modalList.querySelector(".search-loading-text");
  if (!textEl) return;

  const safeQuery = String(query || "").trim();
  const steps = aiMode
    ? [
        "Calling tool",
        `Searching for "${safeQuery}"`,
        "Ranking",
        "Finding best match",
        "Just a sec",
        "Almost there",
      ]
    : [
        `Searching for "${safeQuery}"`,
        "Ranking",
        "Finding best match",
        "Just a sec",
        "Almost there",
      ];

  const delays = aiMode
    ? [1600, 700, 650, 600, 600, 600]
    : [700, 650, 600, 600, 600];

  let index = 0;
  textEl.textContent = steps[index];

  const advance = () => {
    index = (index + 1) % steps.length;
    textEl.textContent = steps[index];
    const delay = delays[index] || 600;
    searchLoadingTimer = setTimeout(advance, delay);
  };

  searchLoadingTimer = setTimeout(advance, delays[0]);
}

// Global function to trigger AI pulse wave animation
window.triggerAIPulse = function() {
  const pulseWave = document.querySelector('.pulse-wave');
  if (!pulseWave) return;
  pulseWave.classList.remove('active-pulse');
  void pulseWave.offsetWidth; // Force reflow
  pulseWave.classList.add('active-pulse');
};

// Initialize quick search functionality
document.addEventListener("DOMContentLoaded", function () {
  const searchInput = document.getElementById("quickSearchInput");
  const searchResults = document.getElementById("quickSearchResults");
  const aiToggleBtn = document.getElementById("aiSearchToggle");
  const clearBtn = document.getElementById("clearSearchBtn");

  if (!searchInput || !searchResults) return;

  // Mutation observer to toggle active-results on quick-search-wrapper
  const searchWrapper = searchInput.closest(".quick-search-wrapper");
  if (searchWrapper) {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === "style") {
          const isVisible = searchResults.style.display === "block";
          if (isVisible) {
            searchWrapper.classList.add("active-results");
            searchResults.classList.add("active-results");
          } else {
            searchWrapper.classList.remove("active-results");
            searchResults.classList.remove("active-results");
          }
        }
      });
    });
    observer.observe(searchResults, { attributes: true, attributeFilter: ["style"] });
  }

  // Handle clear button click
  if (clearBtn) {
    clearBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      searchInput.value = "";
      this.style.display = "none";
      searchResults.style.display = "none";
      searchInput.focus();
    });

    // Check initial state
    if (searchInput.value.trim().length > 0) {
      clearBtn.style.display = "flex";
    }
  }

  // Handle AI search toggle
  if (aiToggleBtn) {
    aiToggleBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      aiSearchEnabled = !aiSearchEnabled;
      const searchWrapper = searchInput.closest('.quick-search-wrapper');

      // Update UI
      if (aiSearchEnabled) {
        this.classList.add("active");
        searchInput.classList.add("ai-mode");
        if (searchWrapper) searchWrapper.classList.add("ai-mode");
        if (searchResults) searchResults.classList.add("ai-mode");
        searchInput.placeholder = "AI-powered search";
        window.triggerAIPulse();
      } else {
        this.classList.remove("active");
        searchInput.classList.remove("ai-mode");
        if (searchWrapper) searchWrapper.classList.remove("ai-mode");
        if (searchResults) searchResults.classList.remove("ai-mode");
        searchInput.placeholder = "Quick search";
      }

      // Re-run search if there's a query
      const query = searchInput.value.trim();
      if (query.length > 0) {
        performQuickSearch(query);
      }
    });
  }

  // Handle search input with debounce — opens the modal
  searchInput.addEventListener("input", function () {
    const query = this.value.trim();

    // Show/hide clear button
    if (clearBtn) {
      clearBtn.style.display = query.length > 0 ? "flex" : "none";
    }

    // Clear previous timeout
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }

    // Close modal if query is empty
    if (query.length === 0) {
      closeSearchResultsModal();
      return;
    }

    // Only show search results on home tab
    const homeTab = document.getElementById("home");
    if (!homeTab || !homeTab.classList.contains("active")) {
      return;
    }

    // Open the modal (moves search bar into it)
    openSearchModal();

    // Debounce search - wait 300ms after user stops typing
    searchTimeout = setTimeout(() => {
      performQuickSearch(query);
    }, 300);
  });

  // Handle keydown for Enter key to trigger pulse wave explicitly without triggering on typing
  searchInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter") {
      const query = this.value.trim();
      if (query.length > 0 && aiSearchEnabled && typeof window.triggerAIPulse === 'function') {
        window.triggerAIPulse();
      }
    }
    if (e.key === "Escape") {
      closeSearchResultsModal();
    }
  });

  // Open modal when clicking on input
  searchInput.addEventListener("click", function () {
    // Only show on home tab
    const homeTab = document.getElementById("home");
    if (!homeTab || !homeTab.classList.contains("active")) {
      return;
    }

    if (this.value.trim().length > 0) {
      openSearchModal();
    }
  });
});

// Store original parent of quickSearchContainer for returning it later
let _searchContainerOriginalParent = null;
let _searchContainerNextSibling = null;

// Open the search results modal (promo-style) — moves quickSearchContainer into modal
function openSearchModal() {
  const modal = document.getElementById("searchResultsModal");
  const slot = document.getElementById("modalSearchSlot");
  const searchContainer = document.getElementById("quickSearchContainer");
  const searchInput = document.getElementById("quickSearchInput");

  if (!modal || !slot || !searchContainer) return;

  // Remember original position so we can move it back on close
  if (!_searchContainerOriginalParent) {
    _searchContainerOriginalParent = searchContainer.parentNode;
    _searchContainerNextSibling = searchContainer.nextSibling;
  }

  // Move the search container into the modal slot
  if (!slot.contains(searchContainer)) {
    slot.appendChild(searchContainer);
  }

  // Show modal if not already visible
  if (modal.style.display !== "flex") {
    modal.style.display = "flex";
    modal.classList.add("show");
    document.body.classList.add("modal-open");
  }

  // Focus the search input inside modal
  if (searchInput) {
    setTimeout(() => searchInput.focus(), 100);
  }
}
window.openSearchModal = openSearchModal;

// Create sparkle particles animation

// Perform search using the API
let currentAiSearchController = null;

async function performQuickSearch(query) {
  const searchInput = document.getElementById("quickSearchInput");

  if (!query && searchInput) {
    query = searchInput.value.trim();
  }

  if (!query) {
    closeSearchResultsModal();
    return;
  }

  // Cancel previous requests
  if (currentSearchController) {
    currentSearchController.abort();
  }
  if (currentAiSearchController) {
    currentAiSearchController.abort();
  }

  const modalList = document.getElementById("searchResultsModalList");
  const modalTitle = document.getElementById("searchResultsModalTitle");
  const modal = document.getElementById("searchResultsModal");

  // If user toggled AI, check if we already preloaded this query's AI data
  if (aiSearchEnabled && window.preloadedAiQuery === query && window.preloadedAiData) {
      if (modalList && modalTitle && modal) {
          modalTitle.textContent = `Search results for "${query}"`;
          openSearchModal();
          window.currentAIData = window.preloadedAiData.ai || null;
          displaySearchResults(window.preloadedAiData.results, query);
      }
      return;
  }

  if (modalList && modalTitle && modal) {
    modalTitle.textContent = `Search results for "${query}"`;
    modalList.innerHTML = `
      <div class="search-loading">
          <div class="search-loading-text"></div>
      </div>
    `;
    startSearchLoading(modalList, query, aiSearchEnabled);
    openSearchModal();
  }

  try {
    currentSearchController = new AbortController();
    const selectedSemester = document.getElementById('semesterSelect')?.value || '';
    const semesterParam = selectedSemester ? `&semester=${encodeURIComponent(selectedSemester)}` : '';
    
    // Always fetch algorithmic results first (FAST)
    const algoUrl = `/api/v2/search?q=${encodeURIComponent(query)}${semesterParam}`;
    
    // Background fetch AI results (only when AI is enabled and online)
    const isOffline = typeof navigator !== 'undefined' && navigator.onLine === false;
    if (aiSearchEnabled && !isOffline) {
      const aiUrl = `/api/v2/search?q=${encodeURIComponent(query)}&useAI=true&aiMode=pure${semesterParam}`;
      currentAiSearchController = new AbortController();

      // Reset preload cache for new query
      window.preloadedAiQuery = query;
      window.preloadedAiData = null;

      fetch(aiUrl, { signal: currentAiSearchController.signal })
        .then(res => {
          if (!res.ok) {
            throw new Error(`AI preload failed: ${res.status}`);
          }
          return res.json();
        })
        .then(data => {
          if (data.success) {
            window.preloadedAiData = data;
            // If user enabled AI mode while this was loading, update UI now
            if (aiSearchEnabled && window.currentSearchQuery === query) {
              stopSearchLoading();
              window.currentAIData = data.ai || null;
              displaySearchResults(data.results, query);
            }
          }
        })
        .catch(err => {
          if (err.name !== "AbortError") console.warn("AI Preload failed:", err);
        });
    }

    const response = await fetch(algoUrl, {
      signal: currentSearchController.signal,
    });

    if (!response.ok) throw new Error(`Search failed: ${response.status}`);
    const data = await response.json();
    if (!data.success) throw new Error(data.error || "Search failed");

    // Display algorithmic results immediately if AI mode is OFF
    if (!aiSearchEnabled) {
        stopSearchLoading();
        window.currentAIData = null;
        if (data.isDiscovery && data.results?.length > 0) {
            if (modalTitle) modalTitle.textContent = `✨ Suggested for you`;
        }
        displaySearchResults(data.results, query);
    } else {
        // If AI is ON, wait for the AI fetch. 
        // If it already resolved, preloadedAiData is set.
        if (window.preloadedAiData) {
            stopSearchLoading();
            window.currentAIData = window.preloadedAiData.ai || null;
            displaySearchResults(window.preloadedAiData.results, query);
        }
    }
  } catch (error) {
    if (error.name === "AbortError") {
      stopSearchLoading();
      return;
    }
    stopSearchLoading();
    if (modalList) {
      modalList.innerHTML = `
        <div class="search-error">
            <i class="far fa-exclamation-triangle"></i>
            <p style="margin: 8px 0 0 0; font-size: 14px;">Search failed. Please try again.</p>
        </div>
      `;
    }
  }
}

// Display search results
function displaySearchResults(results, query) {
  // Store all results globally for expansion
  window.allSearchResults = results;
  window.currentDisplayCount = results ? results.length : 0;
  window.currentSearchQuery = query;

  const modalTitle = document.getElementById("searchResultsModalTitle");
  if (modalTitle) {
    modalTitle.textContent = `Search results for "${query}"`;
  }

  if (!results || results.length === 0) {
    const aiData = window.currentAIData;

    // Show AI suggestions if available
    let suggestionsHtml = "";
    if (
      aiSearchEnabled &&
      aiData &&
      aiData.suggestions &&
      aiData.suggestions.length > 0
    ) {
      suggestionsHtml = `
                <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid rgba(255, 130, 0, 0.1);">
                    <p style="font-size: 12px; font-weight: 600; color: #ff2d95; margin-bottom: 6px;">
                        <i class="far fa-lightbulb"></i> AI Suggestions:
                    </p>
                    ${aiData.suggestions
          .map(
            (s) => `
                        <div onclick="document.getElementById('modalSearchInput').value='${s.replace(/'/g, "\\'")}'; performQuickSearch('${s.replace(/'/g, "\\'")}')"
                             style="padding: 6px 8px; margin: 4px 0; background: rgba(255, 130, 0, 0.05); border-radius: 4px; font-size: 11px; color: #666; cursor: pointer; transition: all 0.2s;"
                             onmouseover="this.style.background='rgba(255, 130, 0, 0.1)'"
                             onmouseout="this.style.background='rgba(255, 130, 0, 0.05)'">
                            <i class="far fa-search" style="opacity: 0.5; margin-right: 4px;"></i>${s}
                        </div>
                    `,
          )
          .join("")}
                </div>
            `;
    } else {
      const didYouMean = buildDidYouMeanSuggestion(query);
      if (didYouMean) {
        const safeSuggestion = didYouMean.replace(/'/g, "\\'");
        suggestionsHtml = `
          <div class="search-did-you-mean">
            Did you mean:
            <span class="search-did-you-mean-value" onclick="document.getElementById('modalSearchInput').value='${safeSuggestion}'; performQuickSearch('${safeSuggestion}')">${didYouMean}</span>
          </div>
        `;
      }
    }

    const noResultsHtml = `
            <div class="search-no-results">
                <i class="far fa-search"></i>
          <p style="margin: 8px 0 0 0; font-size: 14px;">No results found for "${query}"</p>
                ${suggestionsHtml}
            </div>
        `;

    const modalList = document.getElementById("searchResultsModalList");
    if (modalList) {
      modalList.innerHTML = noResultsHtml;
    }
    return;
  }

  renderSearchResults(query);
}

// Render search results (always inside modal)
function renderSearchResults(query) {
  const results = window.allSearchResults || [];
  const displayCount = results.length;

  // Build HTML for results
  let html = "";

  // Add AI mode indicator if enabled
  if (aiSearchEnabled) {
    const aiData = window.currentAIData;

    html += `
            <div style="padding: 8px 16px; background: linear-gradient(135deg, rgba(255, 130, 0, 0.1), rgba(255, 45, 149, 0.1)); border-bottom: 1px solid rgba(255, 130, 0, 0.2); border-radius: 16px; margin-bottom: 8px;">
                <div style="display: flex; align-items: center; gap: 8px;">
                    <i class="far fa-sparkles" style="color: #ff2d95; animation: sparkle 1.5s ease-in-out infinite;"></i>
                    <span style="font-size: 12px; font-weight: 600; color: #ff2d95;">AI-Powered Results</span>
                </div>
                ${aiData && aiData.intent
        ? `
                    <div style="margin-top: 4px; font-size: 11px; color: #666; font-style: italic;">
                        <i class="far fa-brain" style="margin-right: 4px;"></i>${aiData.intent}
                    </div>
                `
        : ""
      }
            </div>
        `;
  }

  // Show all results
  const topResults = results.slice(0, displayCount);

  topResults.forEach((result, index) => {
    const scoreColor =
      result.score >= 75
        ? "#28a745"
        : result.score >= 60
          ? "#ff8200"
          : "#6c757d";

    // Show AI explanation if available (pure AI mode)
    const aiExplanation = result.aiExplanation
      ? `
            <div class="search-result-ai-explanation" style="margin-top: 6px; font-size: 11px; color: #6c757d; font-style: italic; line-height: 1.4;">
                <i class="far fa-sparkles" style="color: #ff2d95; margin-right: 4px;"></i>
                ${result.aiExplanation}
            </div>
        `
      : "";

    html += `
            <div class="search-result-item" style="display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 12px 16px;"
                 data-semester="${result.semester}"
                 data-subject="${result.subject}"
                 data-category="${result.category}"
                 data-topic="${result.topic}">
                <div style="flex: 1; min-width: 0; cursor: pointer;" onclick="selectSearchResult('${result.semester}', \`${result.subject.replace(/`/g, "\\`")}\`, \`${result.category.replace(/`/g, "\\`")}\`, \`${result.topic.replace(/`/g, "\\`")}\`)">
                    <div class="search-result-semester">
                        ${result.semester} • ${result.subject}
                    </div>
                    <div class="search-result-title">
                        ${result.topic} <span style="color: ${scoreColor}; font-size: 11px; font-weight: 700; font-family: var(--font-primary), sans-serif; margin-left: 6px;">${result.score}%</span>
                    </div>
                    <div class="search-result-category">
                        ${result.category}
                    </div>
                    ${aiExplanation}
                </div>
                <div style="flex-shrink: 0; display: flex; align-items: center; gap: 8px;">
                    <button onclick="openSearchResultPdf(event, '${result.semester}', \`${result.subject.replace(/`/g, "\\`")}\`, \`${result.topic.replace(/`/g, "\\`")}\`)"
                            style="padding: 8px 16px; background: #ff8400; color: white; border: none; border-radius: 12px; corner-shape: squircle; font-size: 13px; font-weight: 600; cursor: pointer; white-space: nowrap; transition: all 0.2s ease; font-family: 'Manrope', sans-serif;"
                            onmouseover="this.style.background='#ff9500'; this.style.transform='scale(1.05)'; this.style.boxShadow='0 4px 12px rgba(255, 132, 0, 0.4)'"
                            onmouseout="this.style.background='#ff8400'; this.style.transform='scale(1)'; this.style.boxShadow='none'">
                        <i class="far fa-external-link" style="margin-right: 4px;"></i>Open
                    </button>
                </div>
            </div>
        `;
  });

  const modalList = document.getElementById("searchResultsModalList");
  if (modalList) {
    modalList.innerHTML = html;
  }
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
  const searchResults = document.getElementById("quickSearchResults");
  if (searchResults) {
    searchResults.scrollTop = 0;
  }
}

// Close search results modal — moves quickSearchContainer back to original position
function closeSearchResultsModal() {
  const modal = document.getElementById('searchResultsModal');
  if (!modal || modal.style.display === 'none') return;

  // Move search container back to its original location
  const searchContainer = document.getElementById("quickSearchContainer");
  if (searchContainer && _searchContainerOriginalParent) {
    if (_searchContainerNextSibling) {
      _searchContainerOriginalParent.insertBefore(searchContainer, _searchContainerNextSibling);
    } else {
      _searchContainerOriginalParent.appendChild(searchContainer);
    }
  }

  const promoModalElement = modal.querySelector('.promo-modal');
  if (promoModalElement) {
    promoModalElement.style.willChange = 'transform, opacity';
    promoModalElement.classList.add('closing');

    modal.style.transition = 'opacity 0.4s cubic-bezier(0.32, 0.72, 0, 1)';
    modal.style.opacity = '0';

    setTimeout(() => {
      modal.style.display = 'none';
      modal.classList.remove('show');
      modal.style.opacity = '';
      modal.style.transition = '';
      promoModalElement.classList.remove('closing');
      promoModalElement.style.willChange = '';
      promoModalElement.style.transform = '';
      document.body.classList.remove('modal-open');
    }, 400);
  } else {
    modal.style.display = 'none';
    modal.classList.remove('show');
    document.body.classList.remove('modal-open');
  }

  // Clear search input on dismiss
  const searchInput = document.getElementById("quickSearchInput");
  const clearBtn = document.getElementById("clearSearchBtn");
  if (searchInput) {
    searchInput.value = "";
    searchInput.blur();
  }
  if (clearBtn) clearBtn.style.display = "none";
}
window.closeSearchResultsModal = closeSearchResultsModal;

// Open PDF directly from search result
async function openSearchResultPdf(event, semester, subject, topic) {
  // Stop event propagation to prevent selecting the result
  if (event) event.stopPropagation();

  // Close the search modal
  closeSearchResultsModal();

  // Get popup element
  const popup = document.getElementById("popup");
  if (!popup) {
    return;
  }

  // Build PDF URL
  let pdfUrl;
  if (semester === "9999") {
    // Special handling for Vault (semester 9999)
    pdfUrl = `https://cdn.getmaterio.app/pdfs/${semester}/${subject}/vault/${topic}.pdf`;
  } else {
    // Normal format: pdfs/semester/subject/topic.pdf
    pdfUrl = `https://cdn.getmaterio.app/pdfs/${semester}/${subject}/${topic}.pdf`;
  }

  // Transform to local CDN if enabled
  pdfUrl = window.MaterioLocalCDN?.transformUrl(pdfUrl) || pdfUrl;
  pdfUrl = await resolvePdfSourceUrl(pdfUrl);

  // Open PDF using cache system if available
  if (typeof window.loadPdfWithCache === "function") {
    window.loadPdfWithCache(pdfUrl);
    popup.classList.remove("closing");
    popup.style.display = "block";
    showPopupShareTooltip();
    window.refreshPdfInsightPill?.();
  } else {
    // Fallback to original behavior
    document.getElementById("popupContent").innerHTML =
      `<iframe id="pdf-iframe" scrolling='no' allowfullscreen webkitallowfullscreen style="border:none; width:100%; height:calc(100% - 54px); border-radius:25px; margin-top:54px; corner-shape: squircle;"
        src="/oread/web/viewer.html?disableStream=false&disableRange=false&rangeChunkSize=1048576&file=${encodeURIComponent(pdfUrl)}"></iframe>`;

    popup.classList.remove("closing");
    popup.style.display = "block";
    showPopupShareTooltip();
    window.refreshPdfInsightPill?.();
  }
}

// Handle result selection
function selectSearchResult(semester, subject, category, topic) {
  // Close the search modal
  closeSearchResultsModal();

  // Populate the selection form
  const semesterSelect = document.getElementById("semesterSelect");
  const subjectSelect = document.getElementById("subjectSelect");
  const categorySelect = document.getElementById("categorySelect");
  const topicSelect = document.getElementById("topicSelect");

  if (!semesterSelect || !subjectSelect || !categorySelect || !topicSelect) {
    return;
  }

  // Helper function to wait for dropdown to be enabled and populated
  function waitForDropdownReady(
    selectElement,
    targetValue,
    maxAttempts = 30,
    matchByText = false,
  ) {
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
          option = Array.from(selectElement.options).find(
            (opt) => opt.textContent.trim() === targetValue.trim(),
          );
        } else {
          // For other dropdowns - match by value
          option = Array.from(selectElement.options).find(
            (opt) => opt.value === targetValue,
          );
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
    selectElement.dispatchEvent(new Event("change", { bubbles: true }));
    selectElement.dispatchEvent(new Event("input", { bubbles: true }));

    // Also trigger jQuery change if available (some forms use jQuery)
    if (window.jQuery) {
      window.jQuery(selectElement).trigger("change");
    }
  }

  // Chain the selections with proper waiting
  async function populateAllFields() {
    try {
      // Step 1: Set semester
      setDropdownValue(semesterSelect, semester);
      await new Promise((resolve) => setTimeout(resolve, 300)); // Give it time to process

      // Step 2: Wait for subject dropdown to populate, then set it
      await waitForDropdownReady(subjectSelect, subject);
      setDropdownValue(subjectSelect, subject);
      await new Promise((resolve) => setTimeout(resolve, 300)); // Give it time to process

      // Step 3: Wait for category dropdown to populate, then find by TEXT and set by INDEX
      const categoryIndex = await waitForDropdownReady(
        categorySelect,
        category,
        30,
        true,
      ); // matchByText = true
      setDropdownValue(categorySelect, categoryIndex);
      await new Promise((resolve) => setTimeout(resolve, 300)); // Give it time to process

      // Step 4: Wait for topic dropdown to populate, then set it
      await waitForDropdownReady(topicSelect, topic);
      setDropdownValue(topicSelect, topic);

      // Scroll to the form
      setTimeout(() => {
        const readingCard = document.getElementById("reading");
        if (readingCard) {
          readingCard.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }, 300);
    } catch (error) { }
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
      title = "Notice",
      type = "info",
      buttonText = "OK",
      iconClass,
    } = options;

    // Create overlay
    const overlay = document.createElement("div");
    overlay.className = "materio-modal-overlay";
    overlay.innerHTML = `
            <div class="materio-modal" role="alertdialog" aria-modal="true" aria-labelledby="materio-modal-title">
                <div class="materio-modal-icon ${type}">
                  <i class="fa-solid ${iconClass || getIconForType(type)}"></i>
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
      overlay.classList.add("visible");
    });

    // Focus the button
    const okBtn = overlay.querySelector("#materio-modal-ok");
    setTimeout(() => okBtn.focus(), 100);

    // Close function
    function closeModal() {
      overlay.classList.remove("visible");
      setTimeout(() => {
        overlay.remove();
        resolve();
      }, 250);
    }

    // Event listeners
    okBtn.addEventListener("click", closeModal);
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) closeModal();
    });
    document.addEventListener("keydown", function escHandler(e) {
      if (e.key === "Escape" || e.key === "Enter") {
        document.removeEventListener("keydown", escHandler);
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
      title = "Confirm",
      type = "warning",
      confirmText = "Confirm",
      cancelText = "Cancel",
      danger = false,
      iconClass,
    } = options;

    // Create overlay
    const overlay = document.createElement("div");
    overlay.className = "materio-modal-overlay";
    overlay.innerHTML = `
            <div class="materio-modal" role="alertdialog" aria-modal="true" aria-labelledby="materio-modal-title">
                <div class="materio-modal-icon ${type}">
                  <i class="fa-solid ${iconClass || getIconForType(type)}"></i>
                </div>
                <h3 class="materio-modal-title" id="materio-modal-title">${escapeHtml(title)}</h3>
                <p class="materio-modal-message">${escapeHtml(message)}</p>
                <div class="materio-modal-buttons">
                    <button class="materio-modal-btn secondary" id="materio-modal-cancel">${escapeHtml(cancelText)}</button>
                    <button class="materio-modal-btn ${danger ? "danger" : "primary"}" id="materio-modal-confirm">${escapeHtml(confirmText)}</button>
                </div>
            </div>
        `;

    document.body.appendChild(overlay);

    // Trigger animation
    requestAnimationFrame(() => {
      overlay.classList.add("visible");
    });

    // Focus the cancel button (safer default)
    const cancelBtn = overlay.querySelector("#materio-modal-cancel");
    const confirmBtn = overlay.querySelector("#materio-modal-confirm");
    setTimeout(() => cancelBtn.focus(), 100);

    // Close function
    function closeModal(result) {
      overlay.classList.remove("visible");
      setTimeout(() => {
        overlay.remove();
        resolve(result);
      }, 250);
    }

    // Event listeners
    confirmBtn.addEventListener("click", () => closeModal(true));
    cancelBtn.addEventListener("click", () => closeModal(false));
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) closeModal(false);
    });
    document.addEventListener("keydown", function escHandler(e) {
      if (e.key === "Escape") {
        document.removeEventListener("keydown", escHandler);
        closeModal(false);
      } else if (e.key === "Enter") {
        document.removeEventListener("keydown", escHandler);
        closeModal(true);
      }
    });
  });
}

// Helper: Get FontAwesome icon class for modal type
function getIconForType(type) {
  const icons = {
    info: "fa-circle-info",
    success: "fa-circle-check",
    warning: "fa-triangle-exclamation",
    danger: "fa-circle-xmark",
  };
  return icons[type] || icons.info;
}

// Helper: Escape HTML to prevent XSS
function escapeHtml(text) {
  const div = document.createElement("div");
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
    document.querySelectorAll(".paper-mode-description").forEach(function (el) {
      // store original text once
      var original = el.getAttribute("data-original-text");
      if (!original) {
        original = (el.textContent || "").trim();
        el.setAttribute("data-original-text", original);
      }
      if (window.innerWidth <= mobileWidth) {
        var words = original.split(/\s+/);
        if (words.length > breakAfter) {
          var first = words.slice(0, breakAfter).join(" ");
          var rest = words.slice(breakAfter).join(" ");
          el.innerHTML = first + "<br>" + rest;
        } else {
          el.textContent = original;
        }
      } else {
        // restore original on larger screens
        el.textContent = original;
      }
    });
  }

  document.addEventListener("DOMContentLoaded", applyWordWrap);
  var _t;
  window.addEventListener("resize", function () {
    clearTimeout(_t);
    _t = setTimeout(applyWordWrap, 120);
  });
})();

// ================================================
// KEYBOARD SHORTCUTS MODAL
// ================================================

(function () {
  function openKeyboardShortcutsModal() {
    const modal = document.getElementById("keyboardShortcutsModal");
    if (modal) {
      modal.classList.add("visible");
      modal.setAttribute("aria-hidden", "false");
      document.body.style.overflow = "hidden";
    }
  }

  function closeKeyboardShortcutsModal() {
    const modal = document.getElementById("keyboardShortcutsModal");
    if (modal) {
      modal.classList.remove("visible");
      modal.setAttribute("aria-hidden", "true");
      document.body.style.overflow = "";
    }
  }

  document.addEventListener("DOMContentLoaded", function () {
    const openBtn = document.getElementById("keyboardShortcutsBtn");
    const closeBtn = document.getElementById("shortcutsCloseBtn");
    const backdrop = document.getElementById("keyboardShortcutsBackdrop");

    // Open modal on button click
    if (openBtn) {
      // Check if user has seen shortcuts before
      if (localStorage.getItem("keyboardShortcutsSeen")) {
        openBtn.classList.add("seen");
      }

      openBtn.addEventListener("click", function (e) {
        e.preventDefault();
        // Mark as seen
        localStorage.setItem("keyboardShortcutsSeen", "true");
        openBtn.classList.add("seen");
        openKeyboardShortcutsModal();
      });
    }

    // Close modal on close button click
    if (closeBtn) {
      closeBtn.addEventListener("click", closeKeyboardShortcutsModal);
    }

    // Close modal on backdrop click
    if (backdrop) {
      backdrop.addEventListener("click", closeKeyboardShortcutsModal);
    }
  });

  // Expose functions globally for keyboard-shortcuts.js
  window.openKeyboardShortcutsModal = openKeyboardShortcutsModal;
  window.closeKeyboardShortcutsModal = closeKeyboardShortcutsModal;
})();

// Changelog update indicator logic
document.addEventListener("DOMContentLoaded", function () {
  const changelogBtn = document.querySelector(".changelog-btn");
  if (!changelogBtn) return;

  const latestUpdate = changelogBtn.getAttribute("data-latest-update");
  if (!latestUpdate) return;

  const lastSeenUpdate = localStorage.getItem("lastSeenChangelogDate");

  // Show indicator if we have a new update we haven't seen yet
  if (!lastSeenUpdate || parseInt(latestUpdate) > parseInt(lastSeenUpdate)) {
    changelogBtn.classList.add("has-update");
  }

  // Mark as seen when clicked
  changelogBtn.addEventListener("click", function () {
    localStorage.setItem("lastSeenChangelogDate", latestUpdate);
    changelogBtn.classList.remove("has-update");
  });
});

// ================================================
// PDF LINK INTERCEPTOR
// ================================================
document.addEventListener("click", async function (e) {
  // Find closest anchor tag
  const link = e.target.closest("a");
  if (!link) return;

  const href = link.href;
  if (!href) return;

  // Check if it's a PDF
  // 1. Ends with .pdf (ignoring query params)
  // 2. Has data-type="pdf"
  let isPdf = false;

  try {
    const urlObj = new URL(href, window.location.origin);
    // Check pathname for .pdf extension
    if (urlObj.pathname.toLowerCase().endsWith(".pdf")) {
      isPdf = true;
    }
  } catch (e) {
    // invalid URL, ignore
  }

  if (!isPdf && link.dataset.type === "pdf") {
    isPdf = true;
  }

  if (isPdf) {
    // Prevent default navigation (opening in new tab or navigating away)
    e.preventDefault();
    const resolvedHref = await resolvePdfSourceUrl(href);

    // Use the cache loader/popup viewer if available
    if (typeof window.loadPdfWithCache === "function") {
      window.loadPdfWithCache(resolvedHref);
    } else {
      // Fallback context: just let it open if our viewer isn't ready,
      // but we intercepted it so we must handle it.
      window.open(resolvedHref, "_blank");
    }
  }
});
