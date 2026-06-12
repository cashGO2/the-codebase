/**
 * Custom Select - Global modal dropdown wizard for reading card selects
 * Intercepts native select taps and shows a styled promo-modal with wizard navigation.
 */
(function () {
  'use strict';

  const SELECT_ORDER = ['semesterSelect', 'subjectSelect', 'categorySelect', 'topicSelect'];
  const SELECT_LABELS = {
    semesterSelect: 'Select Semester',
    subjectSelect: 'Select Subject',
    categorySelect: 'Select Category',
    topicSelect: 'Select Topic'
  };

  let modal = null;
  let backdrop = null;
  let currentStepIndex = 0;
  let closeTimeout = null;

  function isMobile() {
    return window.innerWidth <= 768;
  }

  function createModal() {
    if (modal) return;

    backdrop = document.createElement('div');
    backdrop.className = 'promo-modal-overlay custom-select-backdrop';
    backdrop.style.zIndex = '9999';
    backdrop.style.display = 'flex';
    backdrop.style.opacity = '0';
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) closeModal();
    });

    modal = document.createElement('div');
    modal.className = 'promo-modal custom-select-promo';
    modal.style.maxWidth = '450px';
    modal.style.width = '90%';
    modal.style.maxHeight = '85vh';
    
    // We omit the promo-image to make it a content-only modal
    modal.innerHTML = `
      <i class="fas fa-times promo-close-btn" style="z-index:10; cursor:pointer;" onclick="document.querySelector('.custom-select-backdrop').click()"></i>
      <div class="promo-content custom-select-wizard-container" style="width: 100%; box-sizing: border-box; position: relative; min-height: 350px;">
        <!-- The wizard view will be injected here -->
      </div>
    `;

    // Global scrollbar styles injected into head to guarantee visibility over any wildcard overrides
    if (!document.getElementById('custom-select-scrollbar-styles')) {
        const style = document.createElement('style');
        style.id = 'custom-select-scrollbar-styles';
        style.textContent = `
            .custom-select-options {
                scrollbar-width: thin !important;
                scrollbar-color: rgba(0, 0, 0, 0.2) transparent !important;
            }
            body.dark-mode .custom-select-options {
                scrollbar-color: rgba(255, 255, 255, 0.2) transparent !important;
            }
            .custom-select-options::-webkit-scrollbar {
                width: 6px !important;
                display: block !important;
                -webkit-appearance: none !important;
            }
            .custom-select-options::-webkit-scrollbar-track {
                background: transparent !important;
            }
            .custom-select-options::-webkit-scrollbar-thumb {
                background-color: rgba(0, 0, 0, 0.2) !important;
                border-radius: 10px !important;
            }
            body.dark-mode .custom-select-options::-webkit-scrollbar-thumb {
                background-color: rgba(255, 255, 255, 0.2) !important;
            }
        `;
        document.head.appendChild(style);
    }

    document.body.appendChild(backdrop);
    backdrop.appendChild(modal);

    // Swipe down to close on mobile
    let startY = 0;
    let currentY = 0;
    modal.addEventListener('touchstart', (e) => {
      startY = e.touches[0].clientY;
    }, { passive: true });

    modal.addEventListener('touchmove', (e) => {
      // Check if we are scrolling inside the options container
      const optionsContainer = e.target.closest('.custom-select-options');
      if (optionsContainer && optionsContainer.scrollTop > 0) {
          return; // Let the container scroll natively
      }

      currentY = e.touches[0].clientY;
      const diff = currentY - startY;
      if (diff > 0 && isMobile()) {
        modal.style.transform = `translateY(${diff}px)`;
      }
    }, { passive: true });

    modal.addEventListener('touchend', () => {
      if (!isMobile()) return;
      const diff = currentY - startY;
      if (diff > 80) {
        closeModal();
      } else {
        modal.style.transform = '';
      }
      startY = 0;
      currentY = 0;
    });
  }

  function renderWizardStep(stepIndex, animationClass) {
    try {
      const selectId = SELECT_ORDER[stepIndex];
      const select = document.getElementById(selectId);
      if (!select) return null;

      const view = document.createElement('div');
      view.className = `custom-select-wizard-view ${animationClass}`;

      // 1. Top Row (Search Box + Inline Close Button)
      const topRow = document.createElement('div');
      topRow.className = 'custom-select-top-row';
      topRow.style.display = 'flex';
      topRow.style.alignItems = 'center';
      topRow.style.gap = '15px';
      topRow.style.width = '100%';
      topRow.style.marginTop = '15px';
      topRow.style.marginBottom = '25px';
      topRow.style.flexShrink = '0';

      const searchBox = document.createElement('button');
      searchBox.className = 'custom-select-search-box';
      searchBox.style.margin = '0';
      searchBox.style.flex = '1';
      searchBox.innerHTML = '<i class="fa-solid fa-magnifying-glass" style="opacity: 0.5; margin-right: 8px;"></i> <span style="opacity: 0.5;">Finder / AI Mode</span>';
      searchBox.addEventListener('click', () => {
        closeModal();
        // Trigger the search modal by focusing the actual search trigger or opening search directly
        const actualSearchInput = document.getElementById('searchTrigger');
        if (actualSearchInput) {
           actualSearchInput.focus();
           actualSearchInput.click();
        } else if (typeof openSearchModal === 'function') {
           openSearchModal();
        }
      });

      const closeBtn = document.createElement('button');
      closeBtn.className = 'custom-select-close-icon';
      closeBtn.innerHTML = '<i class="fas fa-times"></i>';
      closeBtn.style.background = 'transparent';
      closeBtn.style.border = 'none';
      closeBtn.style.fontSize = '20px';
      closeBtn.style.cursor = 'pointer';
      closeBtn.style.padding = '5px';
      closeBtn.addEventListener('click', () => {
        closeModal();
      });

      topRow.appendChild(searchBox);
      topRow.appendChild(closeBtn);

      // 2. Title
      const titleHtml = `<h2 style="margin-top: 0; margin-bottom: 5px;"><span class="promo-title">${SELECT_LABELS[selectId]}</span></h2>`;

      // 3. Options Container
      const optionsContainer = document.createElement('div');
      optionsContainer.className = 'custom-select-options';
      optionsContainer.style.overflowY = 'auto';
      // Inline hide-scrollbar styles removed to allow CSS to display thin scrollbar
      optionsContainer.style.flex = '1';
      optionsContainer.style.display = 'flex';
      optionsContainer.style.flexDirection = 'column';
      optionsContainer.style.gap = '8px';
      optionsContainer.style.paddingBottom = '10px';

      // Auto-select first real option if nothing is selected
      const selectOptions = Array.from(select.options);
      const realOptions = selectOptions.filter(o => o.value);
      if (!select.value && realOptions.length > 0) {
          select.value = realOptions[0].value;
          try {
              select.dispatchEvent(new Event('change'));
          } catch(e) {
              console.warn("Error dispatching change event:", e);
          }
      }

      selectOptions.forEach((option) => {
        if (!option.value) return; // skip placeholder

        const item = document.createElement('button');
        item.className = 'site-button promo-secondary-btn custom-select-option';
        item.style.width = '100%';
        item.style.textAlign = 'left';
        item.style.justifyContent = 'flex-start';
        item.style.padding = '12px 20px';
        
        // Highlight selected option
        if (option.value === select.value) {
          item.classList.add('selected');
        }
        
        item.innerHTML = `<span style="flex: 1;">${option.textContent}</span>`;
        
        item.addEventListener('click', () => {
          select.selectedIndex = option.index;
          select.value = option.value;
          
          // Show selection immediately
          const container = modal.querySelector('.custom-select-wizard-container');
          const oldView = container.querySelector('.custom-select-wizard-view:not([class*="slide-out"])');
          if (oldView) {
              const buttons = oldView.querySelectorAll('.custom-select-option');
              buttons.forEach(btn => btn.classList.remove('selected'));
              item.classList.add('selected');
          }

          try {
              select.dispatchEvent(new Event('change', { bubbles: true }));
          } catch(e) {
              console.warn("Error dispatching change event on option click:", e);
          }
          
          // Auto-flow to next
          if (stepIndex < SELECT_ORDER.length - 1) {
            const nextSelect = document.getElementById(SELECT_ORDER[stepIndex + 1]);
            if (nextSelect && !nextSelect.disabled) {
              setTimeout(() => {
                goToStep(stepIndex + 1, true);
              }, 250); // slight delay to show selection
            }
          }
        });

        optionsContainer.appendChild(item);
      });

      // 4. Footer
      const footer = document.createElement('div');
      footer.className = 'custom-select-footer';
      footer.style.flexWrap = 'nowrap';
      
      // Buttons roundness formula: inner_radius = outer_radius(40px) - padding(20px) = 20px
      const btnRadius = '20px';

      // Prev Button
      const prevBtn = document.createElement('button');
      prevBtn.className = 'site-button promo-secondary-btn';
      prevBtn.innerHTML = '<i class="fa-solid fa-chevron-left"></i>';
      prevBtn.style.padding = '12px 15px';
      prevBtn.style.flex = '0 0 auto';
      prevBtn.style.width = 'auto';
      prevBtn.style.borderRadius = btnRadius;
      if (stepIndex === 0) {
          prevBtn.style.opacity = '0.5';
          prevBtn.style.pointerEvents = 'none';
      } else {
          prevBtn.addEventListener('click', () => goToStep(stepIndex - 1, false));
      }

      // Next Button / Start Reading
      const actionBtn = document.createElement('button');
      if (stepIndex === SELECT_ORDER.length - 1) {
          actionBtn.className = 'site-button promo-primary-btn';
          actionBtn.innerHTML = 'Start Reading';
          actionBtn.style.flex = '1'; // flex 1 instead of 1 0 auto to allow shrinking and prevent overflow clipping
          actionBtn.style.background = '#ff5400';
          actionBtn.style.color = '#fff';
          actionBtn.style.border = 'none';
          actionBtn.style.padding = '12px 20px';
          actionBtn.style.fontWeight = 'bold';
          actionBtn.style.fontFamily = 'inherit';
          actionBtn.style.whiteSpace = 'nowrap';
          actionBtn.style.cursor = 'pointer';
          actionBtn.style.borderRadius = btnRadius;
          actionBtn.addEventListener('click', () => {
              closeModal();
              const submitBtn = document.getElementById('submitButton');
              if (submitBtn) submitBtn.click();
          });
      } else {
          actionBtn.className = 'site-button promo-primary-btn';
          actionBtn.innerHTML = 'Continue <i class="fa-solid fa-chevron-right" style="margin-left:5px"></i>';
          actionBtn.style.flex = '1'; // allow shrinking
          actionBtn.style.background = '#ff5400';
          actionBtn.style.color = '#fff';
          actionBtn.style.border = 'none';
          actionBtn.style.padding = '12px 20px';
          actionBtn.style.fontWeight = 'bold';
          actionBtn.style.fontFamily = 'inherit';
          actionBtn.style.whiteSpace = 'nowrap';
          actionBtn.style.cursor = 'pointer';
          actionBtn.style.borderRadius = btnRadius;
          
          // Disable next if nothing selected
          if (!select.value) {
              actionBtn.style.opacity = '0.5';
              actionBtn.style.pointerEvents = 'none';
          } else {
              actionBtn.addEventListener('click', () => goToStep(stepIndex + 1, true));
          }
      }

      footer.appendChild(prevBtn);
      footer.appendChild(actionBtn);

      view.appendChild(topRow);
      view.insertAdjacentHTML('beforeend', titleHtml);
      view.appendChild(optionsContainer);
      view.appendChild(footer);

      return view;
    } catch(err) {
      alert("renderWizardStep Error: " + err.message + "\n" + err.stack);
      console.error(err);
      return null;
    }
  }

  function goToStep(newIndex, forward = true) {
    if (!modal) return;
    const container = modal.querySelector('.custom-select-wizard-container');
    
    // Force remove any old views that got stuck
    const stuckViews = container.querySelectorAll('.custom-select-wizard-view[class*="slide-out"]');
    stuckViews.forEach(v => v.remove());
    
    const oldView = container.querySelector('.custom-select-wizard-view:not([class*="slide-out"])');
    
    currentStepIndex = newIndex;
    const newView = renderWizardStep(newIndex, forward ? 'wizard-slide-in-right' : 'wizard-slide-in-left');
    
    if (oldView) {
        oldView.classList.add(forward ? 'wizard-slide-out-left' : 'wizard-slide-out-right');
        setTimeout(() => {
            if (oldView && oldView.parentNode) {
                oldView.remove();
            }
        }, 350);
    }
    
    container.appendChild(newView);
    
    requestAnimationFrame(() => {
        const selected = newView.querySelector('.selected');
        if (selected) {
            const optionsContainer = newView.querySelector('.custom-select-options');
            if (optionsContainer) {
                optionsContainer.scrollTop = selected.offsetTop - optionsContainer.offsetTop - 20;
            }
        }
    });
  }

  function openModal(selectId) {
    try {
      if (closeTimeout) {
          clearTimeout(closeTimeout);
          closeTimeout = null;
      }

      const select = document.getElementById(selectId);
      if (!select || select.disabled) return;

      createModal();
      
      const targetIndex = SELECT_ORDER.indexOf(selectId);
      currentStepIndex = targetIndex !== -1 ? targetIndex : 0;
      
      const container = modal.querySelector('.custom-select-wizard-container');
      container.innerHTML = ''; // Clear previous state
      
      const newView = renderWizardStep(currentStepIndex, '');
      container.appendChild(newView);

      // Show
      backdrop.style.display = 'flex';
      // Trigger reflow
      void backdrop.offsetWidth;
      backdrop.style.opacity = '1';
      modal.style.transform = '';
      document.body.style.overflow = 'hidden';

      requestAnimationFrame(() => {
          const selected = newView.querySelector('.selected');
          if (selected) {
              const optionsContainer = newView.querySelector('.custom-select-options');
              if (optionsContainer) {
                  optionsContainer.scrollTop = selected.offsetTop - optionsContainer.offsetTop - 20;
              }
          }
      });
    } catch (err) {
      alert("openModal Error: " + err.message + "\n" + err.stack);
      console.error(err);
    }
  }

  function closeModal() {
    if (!backdrop) return;
    backdrop.style.opacity = '0';
    if (closeTimeout) clearTimeout(closeTimeout);
    closeTimeout = setTimeout(() => {
      backdrop.style.display = 'none';
      document.body.style.overflow = '';
      if (modal) {
          const container = modal.querySelector('.custom-select-wizard-container');
          if (container) container.innerHTML = '';
      }
    }, 400); // match promo transition
  }

  // We use event delegation with a unified pointer events listener so it survives DOM re-renders
  const INTERCEPT_EVENTS = ['click', 'mousedown', 'pointerdown', 'touchstart'];
  let lastTriggeredTime = 0;

  function handleSelectIntercept(e) {
    try {
      SELECT_ORDER.forEach(id => {
          const select = document.getElementById(id);
          if (!select) return;
          const wrapper = select.parentElement;
          
          let clickedLabel = false;
          const label = e.target.closest('label');
          if (label && label.htmlFor === id) {
              clickedLabel = true;
          }

          const isTarget = (e.target === select || (wrapper && wrapper.contains(e.target)));

          if (clickedLabel || isTarget) {
              if (!select.disabled) {
                  if (e.cancelable) {
                      e.preventDefault();
                  }
                  e.stopPropagation();
                  
                  const now = Date.now();
                  if (now - lastTriggeredTime > 200) {
                      lastTriggeredTime = now;
                      openModal(id);
                  }
              }
          }
      });
    } catch(err) {
      alert("handleSelectIntercept Error: " + err.message + "\n" + err.stack);
    }
  }

  INTERCEPT_EVENTS.forEach(eventName => {
      document.addEventListener(eventName, handleSelectIntercept, true);
  });

  // Intercept focus events to prevent native browser selects from opening/getting focus
  document.addEventListener('focus', (e) => {
      if (SELECT_ORDER.includes(e.target.id)) {
          e.target.blur();
          if (!e.target.disabled) {
              openModal(e.target.id);
          }
      }
  }, true);

  // Setup pointer-events to auto initially (allowing direct pointer capture)
  function setupSelects() {
    SELECT_ORDER.forEach(id => {
      const select = document.getElementById(id);
      if (select) {
          select.style.pointerEvents = 'auto'; // allow JS to catch it directly
          select.setAttribute('tabindex', '-1');
          
          if (!select._customIntercepted) {
              select._customIntercepted = true;
              
              const blockAndOpen = (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  select.blur(); // immediately remove focus to stop native UI
                  
                  const now = Date.now();
                  if (now - lastTriggeredTime > 200 && !select.disabled) {
                      lastTriggeredTime = now;
                      openModal(id);
                  }
              };
              
              select.addEventListener('touchstart', blockAndOpen, {passive: false, capture: true});
              select.addEventListener('mousedown', blockAndOpen, {capture: true});
              select.addEventListener('click', blockAndOpen, {capture: true});
              
              // Also catch clicks on the wrapper just in case
              const wrapper = select.parentElement;
              if (wrapper) {
                  wrapper.addEventListener('click', (e) => {
                      if (e.target !== select) {
                          blockAndOpen(e);
                      }
                  });
              }
          }
      }
    });
  }

  document.addEventListener('keydown', (e) => {
    if (!backdrop || backdrop.style.display === 'none' || backdrop.style.opacity === '0') return;

    if (e.key === 'Escape') {
      closeModal();
      return;
    }

    const container = modal.querySelector('.custom-select-wizard-container');
    const activeView = container.querySelector('.custom-select-wizard-view:not([class*="slide-out"])');
    if (!activeView) return;

    const options = Array.from(activeView.querySelectorAll('.custom-select-option'));
    if (!options.length) return;

    let currentIndex = options.findIndex(opt => opt.classList.contains('selected'));

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      let nextIndex = currentIndex + 1;
      if (nextIndex >= options.length) nextIndex = 0;
      options.forEach(opt => {
        opt.classList.remove('selected');
      });
      options[nextIndex].classList.add('selected');
      const optionsContainer = activeView.querySelector('.custom-select-options');
      if (optionsContainer) {
          optionsContainer.scrollTop = options[nextIndex].offsetTop - optionsContainer.offsetTop - 20;
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      let prevIndex = currentIndex - 1;
      if (prevIndex < 0) prevIndex = options.length - 1;
      options.forEach(opt => {
        opt.classList.remove('selected');
      });
      options[prevIndex].classList.add('selected');
      const optionsContainer = activeView.querySelector('.custom-select-options');
      if (optionsContainer) {
          optionsContainer.scrollTop = options[prevIndex].offsetTop - optionsContainer.offsetTop - 20;
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (currentIndex !== -1) {
        options[currentIndex].click();
      }
      
      const actionBtn = activeView.querySelector('.custom-select-footer .promo-primary-btn');
      if (actionBtn && !actionBtn.style.pointerEvents) {
          const isLastStep = actionBtn.textContent.includes('Start Reading');
          if (isLastStep || currentIndex === -1) {
              actionBtn.click();
          }
      }
    }
  });

  function init() {
    setupSelects();
    setInterval(setupSelects, 1000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
