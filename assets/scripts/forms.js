/**
 * Dynamic Forms System
 * Handles loading, rendering, and submitting configurable forms
 */

// Store form configuration and state
let formsConfig = null;
let formActivityConfig = null;
let currentFormType = null;
let selectedFiles = [];
let semesterSubjectMappings = {};
let formsShownThisSession = 0;
let lastFormShownTime = 0;
let currentWizardPage = 0; // For multi-page wizard forms

// Initialize on page load
document.addEventListener('DOMContentLoaded', function () {
    loadFormsConfig();
    loadSemesterSubjectMappingsForForms();
    loadFormActivityConfig();
});

function getDynamicFormModal() {
    return document.getElementById('dynamicFormModal');
}

function queryDynamicForm(selector) {
    return getDynamicFormModal()?.querySelector(selector) || null;
}

function getIconClass(icon, fallback = 'fa-solid fa-circle-plus') {
    if (!icon) return fallback;
    return icon.includes('fa-') ? icon : `fa-solid ${icon}`;
}

/**
 * Load forms configuration from JSON
 */
async function loadFormsConfig() {
    try {
        const response = await fetch('/assets/data/forms-config.json');
        if (response.ok) {
            formsConfig = await response.json();

        }
    } catch (error) {

    }
}

/**
 * Load semester-subject mappings for dynamic subject dropdown
 */
async function loadSemesterSubjectMappingsForForms() {
    try {
        const response = await fetch('https://cdn.getmaterio.app/databases/semester-subjects.json');
        if (response.ok) {
            semesterSubjectMappings = await response.json();
        }
    } catch (error) {

        // Use default mappings
        semesterSubjectMappings = {
            "1": ["Applied Mathematics 1", "Applied Physics 1", "Applied Chemistry", "Engineering Mechanics", "Basic Electrical Engineering"],
            "2": ["Applied Mathematics 2", "Applied Physics 2", "Engineering Drawing", "Environmental Studies", "Programming in C"],
            "3": ["Data Structures", "Digital Electronics", "Discrete Mathematics", "Computer Organization", "OOP using C++"],
            "4": ["Operating Systems", "Database Management", "Computer Networks", "Theory of Computation", "Microprocessors"],
            "5": ["Software Engineering", "Web Technologies", "Compiler Design", "Machine Learning", "Information Security"],
            "6": ["Artificial Intelligence", "Cloud Computing", "Big Data Analytics", "Mobile Computing", "IoT"],
            "7": ["Deep Learning", "Natural Language Processing", "Blockchain Technology", "Quantum Computing"],
            "8": ["Project Work", "Industrial Training", "Seminar"]
        };
    }
}

/**
 * Open the dynamic form modal with specified form type
 * @param {string} formType - Type of form to open (contribution, feedback, beta-review)
 * @param {boolean} skipWizard - Whether to skip the wizard and go straight to form
 */
function openDynamicForm(formType, skipWizard = false) {
    if (!formsConfig || !formsConfig.forms[formType]) {

        showNotification('Form not available', 'error');
        return;
    }

    currentFormType = formType;
    currentWizardPage = 0;
    const formConfig = formsConfig.forms[formType];
    const modal = document.getElementById('dynamicFormModal');

    if (!modal) {

        return;
    }

    // Reset states
    const successEl = document.getElementById('dynamicFormSuccess');
    const errorEl = document.getElementById('dynamicFormError');
    const loadingEl = document.getElementById('dynamicFormLoading');
    const submitBtn = document.getElementById('dynamicFormSubmitBtn');

    if (successEl) successEl.style.display = 'none';
    if (errorEl) errorEl.style.display = 'none';
    if (loadingEl) loadingEl.style.display = 'none';
    if (submitBtn) submitBtn.disabled = false;
    selectedFiles = [];

    const buildJsonBtn = document.getElementById('dynamicFormBuildJsonBtn');
    if (buildJsonBtn) {
        const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        if (isLocalhost && formType === 'contribution') {
            buildJsonBtn.style.display = 'flex';
        } else {
            buildJsonBtn.style.display = 'none';
        }
    }

    // Check if this is a wizard form
    if (!skipWizard && formConfig.wizard && formConfig.wizard.enabled && formConfig.wizard.pages) {
        renderWizardPage(formConfig, 0);
    } else {
        renderStandardForm(formConfig);
    }

    // Show modal
    modal.classList.add('show');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');

    // Initialize mobile swipe handling if available
    if (typeof initMobileSwipeHandling === 'function') {
        initMobileSwipeHandling();
    }
}

/**
 * Render standard form without wizard
 */
function renderStandardForm(formConfig) {
    const iconEl = document.getElementById('dynamicFormIcon');
    const titleEl = document.getElementById('dynamicFormTitle');
    const descEl = document.getElementById('dynamicFormDescription');
    const submitTextEl = document.getElementById('dynamicFormSubmitText');
    const submitIconEl = document.getElementById('dynamicFormSubmitIcon');
    const headerEl = queryDynamicForm('.dynamic-form-header');
    const contentWrapper = queryDynamicForm('.dynamic-form-content-wrapper');
    const actionsEl = queryDynamicForm('.dynamic-form-actions');
    const confirmationsContainer = document.getElementById('dynamicFormConfirmations');
    const formContent = document.getElementById('dynamicFormContent');

    // Show header, actions, and confirmations
    if (headerEl) headerEl.style.display = '';
    if (actionsEl) actionsEl.style.display = '';
    if (confirmationsContainer) confirmationsContainer.style.display = '';

    // Restore margin
    if (formContent) formContent.style.marginBottom = '';

    if (contentWrapper) {
        contentWrapper.style.background = '';
        contentWrapper.style.padding = '';
    }

    // Update header
    if (iconEl) {
        iconEl.className = `${getIconClass(formConfig.icon)} dynamic-form-icon`;
        updateDynamicIcon(iconEl, formConfig.icon);
    }
    if (titleEl) titleEl.textContent = formConfig.title;
    if (descEl) descEl.textContent = formConfig.description;

    // Update submit button
    if (submitTextEl) submitTextEl.textContent = formConfig.submitButton.text;
    if (submitIconEl) {
        submitIconEl.className = getIconClass(formConfig.submitButton.icon, 'fa-solid fa-paper-plane');
        updateDynamicIcon(submitIconEl, formConfig.submitButton.icon || 'fa-solid fa-paper-plane');
    }

    // Render form fields
    renderFormFields(formConfig);

    // Focus trap for accessibility
    setTimeout(() => {
        const modal = document.getElementById('dynamicFormModal');
        const firstInput = modal.querySelector('input, select, textarea');
        if (firstInput) firstInput.focus();
    }, 300);
}

/**
 * Render a wizard page
 */
function renderWizardPage(formConfig, pageIndex) {
    currentWizardPage = pageIndex;
    const page = formConfig.wizard.pages[pageIndex];
    const fieldsContainer = document.getElementById('dynamicFormFields');
    const confirmationsContainer = document.getElementById('dynamicFormConfirmations');

    fieldsContainer.innerHTML = '';
    if (confirmationsContainer) confirmationsContainer.innerHTML = '';

    if (page.type === 'cover') {
        renderCoverPage(page, formConfig, pageIndex);
    } else if (page.type === 'info') {
        renderInfoPage(page, formConfig, pageIndex);
    } else if (page.type === 'form') {
        renderFormPage(page, formConfig);
    }
}

/**
 * Render cover page
 */
function renderCoverPage(page, formConfig, pageIndex) {
    const fieldsContainer = document.getElementById('dynamicFormFields');
    const confirmationsContainer = document.getElementById('dynamicFormConfirmations');
    const headerEl = queryDynamicForm('.dynamic-form-header');
    const actionsEl = queryDynamicForm('.dynamic-form-actions');
    const contentWrapper = queryDynamicForm('.dynamic-form-content-wrapper');
    const formContent = document.getElementById('dynamicFormContent');

    // Hide default header, actions, and confirmations
    if (headerEl) headerEl.style.display = 'none';
    if (actionsEl) actionsEl.style.display = 'none';
    if (confirmationsContainer) confirmationsContainer.style.display = 'none';

    // Remove margin from form container
    if (formContent) formContent.style.marginBottom = '0';

    // Determine media type from extension
    const mediaUrl = (page.backgroundImage || page.backgroundMedia || '').replace(/([^:])\/{2,}/g, '$1/');
    let isVideo = false;
    let mediaHtml = '';

    if (mediaUrl) {
        const ext = mediaUrl.split('.').pop().toLowerCase().split('?')[0];
        isVideo = ['webm', 'mp4', 'mov', 'ogg'].includes(ext);

        if (isVideo) {
            // Video background
            mediaHtml = `
                <video class="wizard-cover-video" autoplay loop muted playsinline>
                    <source src="${mediaUrl}" type="video/${ext === 'mov' ? 'quicktime' : ext}">
                </video>
            `;
        }
    }

    // Set background for images/gradients (not for video)
    if (contentWrapper) {
        if (!isVideo && mediaUrl) {
            const gradient = page.backgroundGradient ? `${page.backgroundGradient}, ` : '';
            contentWrapper.style.background = `${gradient}url('${mediaUrl}') center/cover`;
        } else if (page.backgroundGradient) {
            contentWrapper.style.background = page.backgroundGradient;
        } else if (isVideo) {
            contentWrapper.style.background = 'transparent';
        }
        contentWrapper.style.padding = '0';
    }

    fieldsContainer.innerHTML = `
        <div class="wizard-cover-page">
            ${mediaHtml}
            ${isVideo && page.backgroundGradient ? `<div class="wizard-cover-overlay" style="background: ${page.backgroundGradient}"></div>` : ''}
            <div class="wizard-cover-content">
                ${getIconHtml(page.icon || 'fa-solid fa-gift', 'wizard-cover-icon')}
                <h1 class="wizard-cover-title">${page.title}</h1>
                <p class="wizard-cover-subtitle">${page.subtitle || ''}</p>
                <button type="button" class="wizard-next-btn" onclick="goToWizardPage(${pageIndex + 1})">
                    ${page.nextButton.text}
                    ${page.nextButton.icon ? getIconHtml(page.nextButton.icon) : ''}
                </button>
            </div>
        </div>
    `;
}

/**
 * Render info/explanation page
 */
function renderInfoPage(page, formConfig, pageIndex) {
    const fieldsContainer = document.getElementById('dynamicFormFields');
    const headerEl = queryDynamicForm('.dynamic-form-header');
    const actionsEl = queryDynamicForm('.dynamic-form-actions');
    const contentWrapper = queryDynamicForm('.dynamic-form-content-wrapper');

    const confirmationsContainer = document.getElementById('dynamicFormConfirmations');
    const formContent = document.getElementById('dynamicFormContent');

    // Hide default header, actions, and confirmations
    if (headerEl) headerEl.style.display = 'none';
    if (actionsEl) actionsEl.style.display = 'none';
    if (confirmationsContainer) confirmationsContainer.style.display = 'none';

    // Remove margin from form container (info page handles its own spacing)
    if (formContent) formContent.style.marginBottom = '0';

    if (contentWrapper) {
        contentWrapper.style.background = '';
        contentWrapper.style.padding = '';
    }

    let contentHtml = '';
    if (page.content && Array.isArray(page.content)) {
        contentHtml = page.content.map(item => {
            // Handle simple string content
            if (typeof item === 'string') {
                return `<p class="wizard-info-paragraph">${item}</p>`;
            }

            // Handle object content (cards or simple text with title)
            if (typeof item === 'object') {
                // If it has an icon, render as a card
                if (item.icon) {
                    return `
                        <div class="wizard-info-item">
                            <div class="wizard-info-icon">${getIconHtml(item.icon)}</div>
                            <div class="wizard-info-text">
                                ${item.title ? `<h4>${item.title}</h4>` : ''}
                                <p>${item.description || ''}</p>
                            </div>
                        </div>
                    `;
                }

                // If no icon but has title/description, render as titled text
                return `
                    <div class="wizard-info-text-block">
                        ${item.title ? `<h4>${item.title}</h4>` : ''}
                        ${item.description ? `<p>${item.description}</p>` : ''}
                    </div>
                `;
            }
            return '';
        }).join('');
    }

    fieldsContainer.innerHTML = `
        <div class="wizard-info-page">
            <h2 class="wizard-info-title">${page.title}</h2>
            <div class="wizard-info-content">
                ${contentHtml}
            </div>
            <div class="wizard-info-actions">
                <button type="button" class="wizard-continue-btn" onclick="goToWizardPage(${pageIndex + 1})">
                    ${page.continueButton.text}
                    ${page.continueButton.icon ? getIconHtml(page.continueButton.icon) : ''}
                </button>
                <button type="button" class="wizard-exit-btn" onclick="closeDynamicForm()">
                    ${page.exitButton.icon ? getIconHtml(page.exitButton.icon) : ''}
                    ${page.exitButton.text}
                </button>
            </div>
        </div>
    `;
}

/**
 * Render the actual form page
 */
function renderFormPage(page, formConfig) {
    const headerEl = queryDynamicForm('.dynamic-form-header');
    const actionsEl = queryDynamicForm('.dynamic-form-actions');
    const contentWrapper = queryDynamicForm('.dynamic-form-content-wrapper');
    const iconEl = document.getElementById('dynamicFormIcon');
    const titleEl = document.getElementById('dynamicFormTitle');
    const descEl = document.getElementById('dynamicFormDescription');
    const submitTextEl = document.getElementById('dynamicFormSubmitText');
    const submitIconEl = document.getElementById('dynamicFormSubmitIcon');

    const confirmationsContainer = document.getElementById('dynamicFormConfirmations');
    const formContent = document.getElementById('dynamicFormContent');

    // Show header, actions, and confirmations
    if (headerEl) headerEl.style.display = '';
    if (actionsEl) actionsEl.style.display = '';
    if (confirmationsContainer) confirmationsContainer.style.display = '';

    // Restore margin
    if (formContent) formContent.style.marginBottom = '';

    if (contentWrapper) {
        contentWrapper.style.background = '';
        contentWrapper.style.padding = '';
    }

    // Update header with page-specific or form default
    if (iconEl) {
        iconEl.className = `${getIconClass(formConfig.icon)} dynamic-form-icon`;
        updateDynamicIcon(iconEl, formConfig.icon);
    }
    if (titleEl) titleEl.textContent = page.title || formConfig.title;
    if (descEl) descEl.textContent = page.description || formConfig.description;

    // Update submit button
    if (submitTextEl) submitTextEl.textContent = formConfig.submitButton.text;
    if (submitIconEl) {
        submitIconEl.className = getIconClass(formConfig.submitButton.icon, 'fa-solid fa-paper-plane');
        updateDynamicIcon(submitIconEl, formConfig.submitButton.icon || 'fa-solid fa-paper-plane');
    }

    // Render form fields
    renderFormFields(formConfig);

    // Focus first input
    setTimeout(() => {
        const modal = document.getElementById('dynamicFormModal');
        const firstInput = modal.querySelector('input, select, textarea');
        if (firstInput) firstInput.focus();
    }, 300);
}

/**
 * Navigate to a specific wizard page
 */
function goToWizardPage(pageIndex) {
    if (!currentFormType || !formsConfig) return;
    const formConfig = formsConfig.forms[currentFormType];

    if (formConfig.wizard && formConfig.wizard.pages && pageIndex < formConfig.wizard.pages.length) {
        renderWizardPage(formConfig, pageIndex);
    }
}

/**
 * Close the dynamic form modal
 */
function closeDynamicForm() {
    const modal = document.getElementById('dynamicFormModal');
    if (!modal) return;

    // Add closing animation - works on both mobile and desktop
    const formModalElement = modal.querySelector('.dynamic-form-modal');
    if (formModalElement) {
        // Prepare for animation
        formModalElement.style.willChange = 'transform, opacity';
        formModalElement.classList.add('closing');

        // Animate overlay fade out
        modal.style.transition = 'opacity 0.4s cubic-bezier(0.32, 0.72, 0, 1)';
        modal.style.opacity = '0';

        // Wait for animation to finish before hiding
        setTimeout(() => {
            modal.classList.remove('show');
            modal.setAttribute('aria-hidden', 'true');
            modal.style.opacity = '';
            modal.style.transition = '';
            formModalElement.classList.remove('closing');
            formModalElement.style.willChange = '';
            formModalElement.style.transform = '';
            document.body.classList.remove('modal-open');

            // Reset form state
            resetFormState();
        }, 400);
    } else {
        // Fallback if modal element doesn't exist
        modal.classList.remove('show');
        modal.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('modal-open');
        resetFormState();
    }
}

/**
 * Reset form state after closing
 */
function resetFormState() {
    currentFormType = null;
    selectedFiles = [];

    // Clear dynamic fields
    const fieldsContainer = document.getElementById('dynamicFormFields');
    const confirmationsContainer = document.getElementById('dynamicFormConfirmations');
    if (fieldsContainer) fieldsContainer.innerHTML = '';
    if (confirmationsContainer) confirmationsContainer.innerHTML = '';

    // Hide success/error states
    const successState = document.getElementById('dynamicFormSuccess');
    const errorState = document.getElementById('dynamicFormError');
    if (successState) successState.style.display = 'none';
    if (errorState) errorState.style.display = 'none';

    // Reset submit button
    const submitBtn = document.getElementById('dynamicFormSubmitBtn');
    if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i id="dynamicFormSubmitIcon" class="fa-solid fa-paper-plane" style="margin-right: 8px;"></i><span id="dynamicFormSubmitText">Submit</span>';
    }
}

/**
 * Reset form to initial state after error
 */
function resetDynamicForm() {
    document.getElementById('dynamicFormError').style.display = 'none';
    document.getElementById('dynamicFormSubmitBtn').disabled = false;

    // Re-render fields
    if (currentFormType && formsConfig) {
        renderFormFields(formsConfig.forms[currentFormType]);
    }
}

/**
 * Render form fields based on configuration
 * @param {Object} formConfig - Form configuration object
 */
function renderFormFields(formConfig) {
    const fieldsContainer = document.getElementById('dynamicFormFields');
    const confirmationsContainer = document.getElementById('dynamicFormConfirmations');

    fieldsContainer.innerHTML = '';
    confirmationsContainer.innerHTML = '';

    // Render each field
    formConfig.fields.forEach(field => {
        const fieldElement = createFieldElement(field);
        if (fieldElement) {
            fieldsContainer.appendChild(fieldElement);
        }
    });

    // Render confirmations
    if (formConfig.confirmations && formConfig.confirmations.length > 0) {
        formConfig.confirmations.forEach(confirmation => {
            const confirmElement = createConfirmationElement(confirmation);
            confirmationsContainer.appendChild(confirmElement);
        });
    }

    // Setup conditional visibility
    setupConditionalFields(formConfig.fields);
}

/**
 * Create a form field element based on field configuration
 * @param {Object} field - Field configuration
 * @returns {HTMLElement} - The field element
 */
function createFieldElement(field) {
    const group = document.createElement('div');
    group.className = 'dynamic-form-group';
    group.id = `field-group-${field.name}`;

    // Create label
    const label = document.createElement('label');
    label.setAttribute('for', `field-${field.name}`);
    label.innerHTML = field.label + (field.required ? '<span class="required">*</span>' : '');
    group.appendChild(label);

    // Create input based on type
    let input;
    switch (field.type) {
        case 'text':
        case 'email':
            input = document.createElement('input');
            input.type = field.type;
            input.id = `field-${field.name}`;
            input.name = field.name;
            input.placeholder = field.placeholder || '';
            input.required = field.required || false;
            if (field.maxLength) input.maxLength = field.maxLength;
            break;

        case 'select':
            input = document.createElement('select');
            input.id = `field-${field.name}`;
            input.name = field.name;
            input.required = field.required || false;

            // Add placeholder option
            const placeholder = document.createElement('option');
            placeholder.value = '';
            placeholder.textContent = `Select ${field.label}`;
            placeholder.disabled = true;

            // Check if user is logged in for identity field
            const isLoggedIn = !!localStorage.getItem('materio_user');
            const isIdentityField = field.name === 'userIdentity';

            // Only select placeholder if not identity field or not logged in
            placeholder.selected = !(isIdentityField && isLoggedIn);
            input.appendChild(placeholder);

            // Add options
            if (field.options) {
                field.options.forEach(opt => {
                    const option = document.createElement('option');
                    option.value = opt.value;
                    option.textContent = opt.label;

                    // Pre-select 'authenticated' if logged in and this is identity field
                    if (isIdentityField && isLoggedIn && opt.value === 'authenticated') {
                        option.selected = true;
                    }

                    input.appendChild(option);
                });
            }

            // Special handling for semester field - add change listener for subject
            if (field.dynamicSubject) {
                input.addEventListener('change', function () {
                    populateSubjectsForForm(this.value);
                });
            }

            // Add "Other" option if allowed
            if (field.allowOther && !field.dynamicFromSemester) {
                const otherOption = document.createElement('option');
                otherOption.value = '__other__';
                otherOption.textContent = 'Other';
                input.appendChild(otherOption);
            }
            break;

        case 'textarea':
            input = document.createElement('textarea');
            input.id = `field-${field.name}`;
            input.name = field.name;
            input.placeholder = field.placeholder || '';
            input.required = field.required || false;
            input.rows = 4;
            if (field.maxLength) input.maxLength = field.maxLength;
            if (field.minLength) input.minLength = field.minLength;
            break;

        case 'file':
            const fileArea = createFileUploadArea(field);
            group.appendChild(fileArea);
            return group;

        case 'rating':
            input = createRatingField(field);
            break;

        default:
            input = document.createElement('input');
            input.type = 'text';
            input.id = `field-${field.name}`;
            input.name = field.name;
    }

    if (input) {
        group.appendChild(input);
    }

    // Add hint if present
    if (field.hint) {
        const hint = document.createElement('small');
        hint.className = 'field-hint';
        hint.textContent = field.hint;
        group.appendChild(hint);
    }

    // Add custom input for "Other" option
    if (field.allowOther) {
        const customInput = document.createElement('input');
        customInput.type = 'text';
        customInput.id = `field-${field.name}-custom`;
        customInput.name = `${field.name}_custom`;
        customInput.placeholder = field.otherPlaceholder || 'Enter custom value';
        customInput.style.display = 'none';
        customInput.style.marginTop = '8px';
        group.appendChild(customInput);

        // Show/hide custom input based on selection
        if (input && input.tagName === 'SELECT') {
            input.addEventListener('change', function () {
                customInput.style.display = this.value === '__other__' ? 'block' : 'none';
                if (this.value === '__other__') {
                    customInput.required = field.required || false;
                    customInput.focus();
                } else {
                    customInput.required = false;
                }
            });
        }
    }

    return group;
}

/**
 * Create file upload area
 * @param {Object} field - File field configuration
 * @returns {HTMLElement} - File upload area element
 */
function createFileUploadArea(field) {
    const area = document.createElement('div');
    area.className = 'dynamic-form-file-area';
    area.id = `field-${field.name}-area`;

    area.innerHTML = `
    <i class="fas fa-cloud-upload-alt"></i>
    <p><strong>Drop files here</strong> or click to upload</p>
    <small>${field.hint || 'Select files to upload'}</small>
    <input type="file" id="field-${field.name}" name="${field.name}" 
           ${field.accept ? `accept="${field.accept}"` : ''} 
           ${field.multiple ? 'multiple' : ''}>
  `;

    const fileInput = area.querySelector('input[type="file"]');
    const previewContainer = document.createElement('div');
    previewContainer.className = 'dynamic-form-file-preview';
    previewContainer.id = `field-${field.name}-preview`;

    // Click to select files
    area.addEventListener('click', () => fileInput.click());

    // Drag and drop
    area.addEventListener('dragover', (e) => {
        e.preventDefault();
        area.classList.add('dragover');
    });

    area.addEventListener('dragleave', () => {
        area.classList.remove('dragover');
    });

    area.addEventListener('drop', (e) => {
        e.preventDefault();
        area.classList.remove('dragover');
        handleFileSelection(e.dataTransfer.files, field);
    });

    // File input change
    fileInput.addEventListener('change', (e) => {
        handleFileSelection(e.target.files, field);
    });

    // Wrap in container with preview
    const container = document.createElement('div');
    container.appendChild(area);
    container.appendChild(previewContainer);

    return container;
}

/**
 * Handle file selection
 * @param {FileList} files - Selected files
 * @param {Object} field - Field configuration
 */
function handleFileSelection(files, field) {
    const previewContainer = document.getElementById(`field-${field.name}-preview`);
    previewContainer.innerHTML = '';

    selectedFiles = Array.from(files);

    // Check total size
    const totalSize = selectedFiles.reduce((sum, file) => sum + file.size, 0);
    const maxSize = field.maxSize || 6291456; // 6MB default

    if (totalSize > maxSize) {
        showNotification(`Total file size exceeds ${field.maxSizeLabel || '6MB'} limit`, 'error');
        selectedFiles = [];
        return;
    }

    // Render preview items
    selectedFiles.forEach((file, index) => {
        const item = document.createElement('div');
        item.className = 'dynamic-form-file-item';
        item.innerHTML = `
      <i class="fas fa-file-pdf"></i>
      <span class="file-name">${file.name}</span>
      <span class="file-size">${formatFileSize(file.size)}</span>
      <button type="button" class="remove-file" onclick="removeSelectedFile(${index}, '${field.name}')">
        <i class="fas fa-times"></i>
      </button>
    `;
        previewContainer.appendChild(item);
    });
}

/**
 * Remove a selected file
 * @param {number} index - File index
 * @param {string} fieldName - Field name
 */
function removeSelectedFile(index, fieldName) {
    selectedFiles.splice(index, 1);
    const previewContainer = document.getElementById(`field-${fieldName}-preview`);

    // Re-render preview
    previewContainer.innerHTML = '';
    selectedFiles.forEach((file, i) => {
        const item = document.createElement('div');
        item.className = 'dynamic-form-file-item';
        item.innerHTML = `
      <i class="fas fa-file-pdf"></i>
      <span class="file-name">${file.name}</span>
      <span class="file-size">${formatFileSize(file.size)}</span>
      <button type="button" class="remove-file" onclick="removeSelectedFile(${i}, '${fieldName}')">
        <i class="fas fa-times"></i>
      </button>
    `;
        previewContainer.appendChild(item);
    });
}

/**
 * Create rating field (star rating)
 * @param {Object} field - Field configuration
 * @returns {HTMLElement} - Rating element
 */
function createRatingField(field) {
    const container = document.createElement('div');
    container.className = 'dynamic-form-rating';
    container.id = `field-${field.name}`;

    const max = field.max || 5;
    let selectedRating = 0;

    for (let i = 1; i <= max; i++) {
        const star = document.createElement('i');
        star.className = 'fa-regular fa-star star';
        star.dataset.value = i;

        star.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            selectedRating = i;
            container.dataset.value = i;

            // Update all stars
            const allStars = container.querySelectorAll('.star');
            allStars.forEach((s, idx) => {
                if (idx < i) {
                    s.className = 'fa-solid fa-star star active';
                    s.style.color = '#ff8200';
                } else {
                    s.className = 'fa-regular fa-star star';
                    s.style.color = '';
                }
            });

            // Update hidden input
            const hiddenInput = container.querySelector('input[type="hidden"]');
            if (hiddenInput) {
                hiddenInput.value = i;
            }
        });

        star.addEventListener('mouseenter', function () {
            const allStars = container.querySelectorAll('.star');
            allStars.forEach((s, idx) => {
                if (idx < i) {
                    s.classList.add('hovered');
                }
            });
        });

        star.addEventListener('mouseleave', function () {
            const allStars = container.querySelectorAll('.star');
            allStars.forEach((s) => {
                s.classList.remove('hovered');
            });
        });

        container.appendChild(star);
    }

    // Hidden input for form data
    const hiddenInput = document.createElement('input');
    hiddenInput.type = 'hidden';
    hiddenInput.name = field.name;
    hiddenInput.id = `field-${field.name}-value`;
    container.appendChild(hiddenInput);

    return container;
}

/**
 * Update star display
 * @param {HTMLElement} container - Stars container
 * @param {number} rating - Current rating
 * @param {boolean} isHover - Whether it's a hover state
 */
function updateStars(container, rating, isHover = false) {
    const stars = container.querySelectorAll('.star');
    stars.forEach((star, index) => {
        if (index < rating) {
            star.classList.add(isHover ? 'hovered' : 'active');
            if (!isHover) star.classList.remove('hovered');
        } else {
            star.classList.remove('active', 'hovered');
        }
    });

    // Update hidden input
    const hiddenInput = container.querySelector('input[type="hidden"]');
    if (hiddenInput && !isHover) {
        hiddenInput.value = rating;
    }
}

/**
 * Create confirmation checkbox element
 * @param {Object} confirmation - Confirmation configuration
 * @returns {HTMLElement} - Confirmation element
 */
function createConfirmationElement(confirmation) {
    const container = document.createElement('div');
    container.className = 'dynamic-form-confirmation';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = `confirm-${confirmation.name}`;
    checkbox.name = confirmation.name;
    checkbox.required = confirmation.required || false;

    const label = document.createElement('label');
    label.setAttribute('for', `confirm-${confirmation.name}`);
    label.textContent = confirmation.label;

    container.appendChild(checkbox);
    container.appendChild(label);

    return container;
}

/**
 * Setup conditional field visibility
 * @param {Array} fields - Field configurations
 */
function setupConditionalFields(fields) {
    fields.forEach(field => {
        if (field.showWhen) {
            const targetField = document.getElementById(`field-${field.showWhen.field}`);
            const currentFieldGroup = document.getElementById(`field-group-${field.name}`);

            if (targetField && currentFieldGroup) {
                // Initially hide
                currentFieldGroup.style.display = 'none';

                // Listen for changes
                targetField.addEventListener('change', function () {
                    if (this.value === field.showWhen.value) {
                        currentFieldGroup.style.display = 'flex';
                    } else {
                        currentFieldGroup.style.display = 'none';
                        // Clear value when hidden
                        const input = currentFieldGroup.querySelector('input, select, textarea');
                        if (input) input.value = '';
                    }
                });
            }
        }
    });
}

/**
 * Populate subjects dropdown based on selected semester
 * @param {string} semester - Selected semester value
 */
function populateSubjectsForForm(semester) {
    const subjectSelect = document.getElementById('field-subject');
    if (!subjectSelect) return;

    // Clear existing options
    subjectSelect.innerHTML = '';

    // Add placeholder
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = 'Select Subject';
    placeholder.disabled = true;
    placeholder.selected = true;
    subjectSelect.appendChild(placeholder);

    // Add subjects from mapping
    if (semester && semesterSubjectMappings[semester]) {
        semesterSubjectMappings[semester].forEach(subject => {
            const option = document.createElement('option');
            option.value = subject;
            option.textContent = subject;
            subjectSelect.appendChild(option);
        });
    }

    // Add "Other" option
    const otherOption = document.createElement('option');
    otherOption.value = '__other__';
    otherOption.textContent = 'Other';
    subjectSelect.appendChild(otherOption);

    // Enable select
    subjectSelect.disabled = false;

    // Show/hide custom input
    subjectSelect.addEventListener('change', function () {
        const customInput = document.getElementById('field-subject-custom');
        if (customInput) {
            customInput.style.display = this.value === '__other__' ? 'block' : 'none';
            if (this.value === '__other__') {
                customInput.required = true;
                customInput.focus();
            } else {
                customInput.required = false;
            }
        }
    });
}

/**
 * Safely parse JSON from a fetch response, with fallback on non-JSON responses
 */
async function safeJsonParse(response) {
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
        throw new Error(`Server error (${response.status}): Unexpected response from server`);
    }
    return response.json();
}

/**
 * Submit the dynamic form
 */
async function submitDynamicForm() {
    if (!currentFormType || !formsConfig) {
        showNotification('Form not initialized', 'error');
        return;
    }

    const formConfig = formsConfig.forms[currentFormType];
    const submitBtn = document.getElementById('dynamicFormSubmitBtn');
    const form = document.getElementById('dynamicFormContent');

    // Validate form
    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }

    // Validate confirmations
    const confirmations = formConfig.confirmations || [];
    for (const conf of confirmations) {
        const checkbox = document.getElementById(`confirm-${conf.name}`);
        if (conf.required && checkbox && !checkbox.checked) {
            showNotification('Please confirm all required checkboxes', 'error');
            checkbox.focus();
            return;
        }
    }

    // Collect form data
    const formData = {};
    const confirmationData = {};

    formConfig.fields.forEach(field => {
        let value;

        if (field.type === 'file') {
            // Files handled separately
            return;
        } else if (field.type === 'rating') {
            const hiddenInput = document.getElementById(`field-${field.name}-value`);
            value = hiddenInput ? parseInt(hiddenInput.value) || 0 : 0;
        } else {
            const input = document.getElementById(`field-${field.name}`);
            if (input) {
                value = input.value;

                // Check for "Other" custom value
                if (value === '__other__') {
                    const customInput = document.getElementById(`field-${field.name}-custom`);
                    value = customInput ? customInput.value : '';
                }
            }
        }

        if (value !== undefined && value !== '') {
            formData[field.name] = value;
        }
    });

    confirmations.forEach(conf => {
        const checkbox = document.getElementById(`confirm-${conf.name}`);
        confirmationData[conf.name] = checkbox ? checkbox.checked : false;
    });

    // Get user info - always include Materio account if available
    let userType = formData.userIdentity || 'anonymous';
    let username = null;
    let githubUsername = null;
    let materioUser = null;

    // Read Materio user from localStorage - always attach if available
    try {
        const materioUserStr = localStorage.getItem('materio_user');
        if (materioUserStr) {
            materioUser = JSON.parse(materioUserStr);
            // Always set username from Materio account
            username = materioUser.username || materioUser.email || materioUser.id || null;

            // If user chose authenticated, or no identity field exists, use Materio account
            if (userType === 'authenticated' || !formData.userIdentity) {
                userType = 'authenticated';
            }
        }
    } catch (e) {
        console.warn('Could not parse materio_user:', e);
    }

    // Get GitHub username if selected
    if (userType === 'github') {
        githubUsername = formData.githubUsername || null;
    }

    // Show loading state
    submitBtn.disabled = true;
    const isFileUpload = currentFormType === 'contribution' && selectedFiles.length > 0;
    submitBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> <span>${isFileUpload ? 'Uploading...' : 'Submitting...'}</span>`;

    try {
        // Handle contribution form with file uploads
        if (currentFormType === 'contribution' && selectedFiles.length > 0 && formConfig.fileUpload?.uploadToGitHub) {
            // Use FormData for file upload
            const uploadFormData = new FormData();
            uploadFormData.append('semester', formData.semester);
            uploadFormData.append('subject', formData.subject);
            uploadFormData.append('category', formData.category);
            uploadFormData.append('userType', userType);

            if (username) {
                uploadFormData.append('username', username);
            }
            if (githubUsername) {
                uploadFormData.append('githubUsername', githubUsername);
            }

            // Append all files
            selectedFiles.forEach(file => {
                uploadFormData.append('files', file);
            });

            // Upload to contribution API (via features.js)
            const response = await fetch('/api/v2/features?action=contribute', {
                method: 'POST',
                body: uploadFormData
            });

            const result = await safeJsonParse(response);

            if (response.ok && result.success) {
                // Show success state
                document.getElementById('dynamicFormSuccessMessage').textContent =
                    getSuccessMessage(currentFormType);
                document.getElementById('dynamicFormSuccess').style.display = 'flex';
            } else {
                throw new Error(result.error || 'Upload failed');
            }
        } else if (currentFormType === 'bug-report') {
            // Bug reports go to the health API /report endpoint (MongoDB)
            // Fire-and-forget: show success immediately, submit in background
            const sessionId = window.materioSessionId || sessionStorage.getItem('materio_session_id');


            const payload = JSON.stringify({
                title: formData.title,
                severity: formData.severity,
                affectedArea: formData.affectedArea,
                description: formData.description,
                stepsToReproduce: formData.stepsToReproduce || null,
                email: formData.email || null,
                sessionId: sessionId
            });

            // Show success immediately — don't make user wait
            document.getElementById('dynamicFormSuccessMessage').textContent =
                getSuccessMessage(currentFormType);
            document.getElementById('dynamicFormSuccess').style.display = 'flex';

            // Submit in background (fire-and-forget)
            fetch('/api/v2/health?action=report', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: payload
            }).then(async resp => {
                if (!resp.ok) {
                    const err = await safeJsonParse(resp).catch(() => ({}));
                    console.warn('Bug report background submit issue:', err.error || resp.status);
                }
            }).catch(err => {
                console.warn('Bug report background submit failed (will retry on next visit):', err.message);
            });
        } else {
            // For non-file forms (feedback, beta-review), use JSON API
            const token = localStorage.getItem('materio_token');
            const userInfo = {
                type: userType,
                username: username,
                githubUsername: githubUsername
            };

            // Fire-and-forget: show success immediately, submit in background
            const payload = JSON.stringify({
                formType: currentFormType,
                user: userInfo,
                data: formData,
                confirmations: confirmationData
            });

            // Show success immediately — don't make user wait for DB write
            document.getElementById('dynamicFormSuccessMessage').textContent =
                getSuccessMessage(currentFormType);
            document.getElementById('dynamicFormSuccess').style.display = 'flex';

            // Submit in background (fire-and-forget)
            fetch('/api/v2/features?action=forms', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                },
                body: payload
            }).then(async resp => {
                if (!resp.ok) {
                    const err = await safeJsonParse(resp).catch(() => ({}));
                    // Form background submit issue
                }
            }).catch(err => {
                // Form background submit failed
            });
        }
    } catch (error) {
        // Form submission error
        document.getElementById('dynamicFormErrorMessage').textContent = error.message;
        document.getElementById('dynamicFormError').style.display = 'flex';
    }
}

/**
 * Get success message based on form type
 * @param {string} formType - Form type
 * @returns {string} - Success message
 */
function getSuccessMessage(formType) {
    const messages = {
        'contribution': 'Thank you for your contribution! Our team will review and add your materials soon.',
        'feedback': 'Thank you for your feedback! We really appreciate you taking the time to help us improve.',
        'beta-review': 'Thank you for your beta testing review! Your feedback helps us build a better product.',
        'bug-report': 'Bug report submitted! Our team will investigate this issue. Thank you for helping improve Materio!'
    };
    return messages[formType] || 'Your submission has been received. Thank you!';
}

/**
 * Format file size in human readable format
 * @param {number} bytes - File size in bytes
 * @returns {string} - Formatted size
 */
function formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// ==========================================
// HUGEICONS DYNAMIC SVG MIGRATION
// ==========================================
const HUGEICONS_DYNAMIC_PATHS = {
    "fa-users": "<path d=\"M15.5 11C15.5 9.067 13.933 7.5 12 7.5C10.067 7.5 8.5 9.067 8.5 11C8.5 12.933 10.067 14.5 12 14.5C13.933 14.5 15.5 12.933 15.5 11Z\" stroke=\"currentColor\"  stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\r <path d=\"M15.4827 11.3499C15.8047 11.4475 16.1462 11.5 16.5 11.5C18.433 11.5 20 9.933 20 8C20 6.067 18.433 4.5 16.5 4.5C14.6851 4.5 13.1928 5.8814 13.0173 7.65013\" stroke=\"currentColor\"  stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\r <path d=\"M10.9827 7.65013C10.8072 5.8814 9.31492 4.5 7.5 4.5C5.567 4.5 4 6.067 4 8C4 9.933 5.567 11.5 7.5 11.5C7.85381 11.5 8.19535 11.4475 8.51727 11.3499\" stroke=\"currentColor\"  stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\r <path d=\"M22 16.5C22 13.7386 19.5376 11.5 16.5 11.5\" stroke=\"currentColor\"  stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\r <path d=\"M17.5 19.5C17.5 16.7386 15.0376 14.5 12 14.5C8.96243 14.5 6.5 16.7386 6.5 19.5\" stroke=\"currentColor\"  stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\r <path d=\"M7.5 11.5C4.46243 11.5 2 13.7386 2 16.5\" stroke=\"currentColor\"  stroke-linecap=\"round\" stroke-linejoin=\"round\"/>",
    "fa-gift": "<path d=\"M4 11V15C4 18.2998 4 19.9497 5.02513 20.9749C6.05025 22 7.70017 22 11 22H13C16.2998 22 17.9497 22 18.9749 20.9749C20 19.9497 20 18.2998 20 15V11\" stroke=\"currentColor\"  stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\r <path d=\"M3 9C3 8.25231 3 7.87846 3.20096 7.6C3.33261 7.41758 3.52197 7.26609 3.75 7.16077C4.09808 7 4.56538 7 5.5 7H18.5C19.4346 7 19.9019 7 20.25 7.16077C20.478 7.26609 20.6674 7.41758 20.799 7.6C21 7.87846 21 8.25231 21 9C21 9.74769 21 10.1215 20.799 10.4C20.6674 10.5824 20.478 10.7339 20.25 10.8392C19.9019 11 19.4346 11 18.5 11H5.5C4.56538 11 4.09808 11 3.75 10.8392C3.52197 10.7339 3.33261 10.5824 3.20096 10.4C3 10.1215 3 9.74769 3 9Z\" stroke=\"currentColor\"  stroke-linejoin=\"round\"/>\r <path d=\"M6 3.78571C6 2.79949 6.79949 2 7.78571 2H8.14286C10.2731 2 12 3.7269 12 5.85714V7H9.21429C7.43908 7 6 5.56091 6 3.78571Z\" stroke=\"currentColor\"  stroke-linejoin=\"round\"/>\r <path d=\"M18 3.78571C18 2.79949 17.2005 2 16.2143 2H15.8571C13.7269 2 12 3.7269 12 5.85714V7H14.7857C16.5609 7 18 5.56091 18 3.78571Z\" stroke=\"currentColor\"  stroke-linejoin=\"round\"/>\r <path d=\"M12 11L12 22\" stroke=\"currentColor\"  stroke-linecap=\"round\" stroke-linejoin=\"round\"/>",
    "fa-arrow-right": "<path d=\"M9.00005 6C9.00005 6 15 10.4189 15 12C15 13.5812 9 18 9 18\" stroke=\"currentColor\"  stroke-linecap=\"round\" stroke-linejoin=\"round\"/>",
    "fa-comment-dots": "<path d=\"M22 11.5667C22 16.8499 17.5222 21.1334 12 21.1334C11.3507 21.1343 10.7032 21.0742 10.0654 20.9545C9.60633 20.8682 9.37678 20.8251 9.21653 20.8496C9.05627 20.8741 8.82918 20.9948 8.37499 21.2364C7.09014 21.9197 5.59195 22.161 4.15111 21.893C4.69874 21.2194 5.07275 20.4112 5.23778 19.5448C5.33778 19.0148 5.09 18.5 4.71889 18.1231C3.03333 16.4115 2 14.1051 2 11.5667C2 6.28357 6.47778 2 12 2C17.5222 2 22 6.28357 22 11.5667Z\" stroke=\"currentColor\"  stroke-linejoin=\"round\"/>\r <path d=\"M11.9955 12H12.0045M15.991 12H16M8 12H8.00897\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>",
    "fa-paper-plane": "<path d=\"M21.0477 3.05293C18.8697 0.707363 2.48648 6.4532 2.50001 8.551C2.51535 10.9299 8.89809 11.6617 10.6672 12.1581C11.7311 12.4565 12.016 12.7625 12.2613 13.8781C13.3723 18.9305 13.9301 21.4435 15.2014 21.4996C17.2278 21.5892 23.1733 5.342 21.0477 3.05293Z\" stroke=\"currentColor\" />\r <path d=\"M11.5 12.5L15 9\" stroke=\"currentColor\"  stroke-linecap=\"round\" stroke-linejoin=\"round\"/>",
    "fa-flask": "<path d=\"M17.5 21C15.567 21 14 19.433 14 17.5L14 3L21 3L21 17.5C21 19.433 19.433 21 17.5 21Z\" stroke=\"currentColor\" />\r <path d=\"M22 3L13 3\" stroke=\"currentColor\"  stroke-linecap=\"round\"/>\r <path d=\"M17 7H14\" stroke=\"currentColor\"  stroke-linecap=\"round\"/>\r <path d=\"M10 16.875C10 19.9126 8 21 6 21C4 21 2 19.9126 2 16.875C2 13.8374 6 10 6 10C6 10 10 13.8374 10 16.875Z\" stroke=\"currentColor\"  stroke-linejoin=\"round\"/>\r <path d=\"M14 12C15.083 11.1336 16.2974 9.87843 17.771 10.7626C19.0014 11.5009 20.0342 10.7244 21 10\" stroke=\"currentColor\"  stroke-linecap=\"round\"/>",
    "fa-check": "<path d=\"M5 14.5C5 14.5 6.5 14.5 8.5 18C8.5 18 14.0588 8.83333 19 7\" stroke=\"currentColor\"  stroke-linecap=\"round\" stroke-linejoin=\"round\"/>",
    "fa-heart": "<path d=\"M10.4107 19.9677C7.58942 17.858 2 13.0348 2 8.69444C2 5.82563 4.10526 3.5 7 3.5C8.5 3.5 10 4 12 6C14 4 15.5 3.5 17 3.5C19.8947 3.5 22 5.82563 22 8.69444C22 13.0348 16.4106 17.858 13.5893 19.9677C12.6399 20.6776 11.3601 20.6776 10.4107 19.9677Z\" stroke=\"currentColor\"  stroke-linecap=\"round\" stroke-linejoin=\"round\"/>",
    "fa-bug": "<path d=\"M3.01309 4.99084C2.89323 6.05084 3.55249 8.42285 6.48923 8.42285\" stroke=\"currentColor\"  stroke-linecap=\"round\"/>\r <path d=\"M17.5951 8.38081C18.8357 8.57881 21.1132 7.49881 20.9957 5.00281\" stroke=\"currentColor\"  stroke-linecap=\"round\"/>\r <path d=\"M20.9928 20.9989C21.0528 19.9429 20.1777 17.5549 17.599 17.4229\" stroke=\"currentColor\"  stroke-linecap=\"round\"/>\r <path d=\"M6.45163 17.4708C5.65013 17.2308 3.01306 18.3348 3.01306 20.9988\" stroke=\"currentColor\"  stroke-linecap=\"round\"/>\r <path d=\"M9.3299 6.11884C9.35388 5.09884 9.84533 2.99884 12.0029 2.99884C13.9208 2.99884 14.5861 4.61884 14.676 6.11884M6.26131 9.41884C6.38118 8.63884 7.29216 6.81484 9.36586 6.63484C11.4635 6.55564 14.3403 6.58684 14.8797 6.67084C15.5869 6.73377 17.2951 7.43884 17.7506 9.41884C17.9124 10.4388 17.8285 11.8788 17.8524 12.7188C17.8165 13.5588 17.9207 15.2623 17.7565 16.1388C17.6367 17.0988 16.9894 18.4668 16.1024 19.3068C14.7838 20.7228 11.1639 22.2108 8.03534 19.4508C6.41713 17.8908 6.30925 16.3788 6.18939 15.7788C6.15725 15.4571 6.15875 13.8763 6.16541 12.3588C6.14144 11.046 6.17235 9.78063 6.26131 9.41884Z\" stroke=\"currentColor\" />\r <path d=\"M3.01306 12.8988H5.9498\" stroke=\"currentColor\"  stroke-linecap=\"round\"/>\r <path d=\"M20.9929 12.8988L18.1161 12.8988\" stroke=\"currentColor\"  stroke-linecap=\"round\"/>\r <path d=\"M12.0033 16.4988L12.0033 20.2788\" stroke=\"currentColor\"  stroke-linecap=\"round\"/>",
    "fa-circle-plus": "<path d=\"M12 8V16M16 12H8\" stroke=\"currentColor\"  stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\r <circle cx=\"12\" cy=\"12\" r=\"10\" stroke=\"currentColor\" />",
    "fa-plus-circle": "<path d=\"M12 8V16M16 12H8\" stroke=\"currentColor\"  stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\r <circle cx=\"12\" cy=\"12\" r=\"10\" stroke=\"currentColor\" />"
};

function getHugeiconSvgHtml(faClass) {
    const innerPath = HUGEICONS_DYNAMIC_PATHS[faClass] || HUGEICONS_DYNAMIC_PATHS['fa-circle-plus'];
    return `<svg class="hgi hgi-dynamic" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="1em" height="1em" color="currentColor" fill="none" stroke="currentColor"  stroke-linecap="round" stroke-linejoin="round">${innerPath}</svg>`;
}

function getIconHtml(iconClass, extraClasses = '') {
    if (!iconClass) return '';
    // Extract fa- class
    const classes = iconClass.split(/\s+/);
    const faClass = classes.find(c => c.startsWith('fa-') && !['fa-solid', 'fa-regular', 'fa-light', 'fa-thin', 'fa-brands', 'fa-duotone', 'fa-sharp', 'fa-spin'].includes(c));
    
    if (faClass && HUGEICONS_DYNAMIC_PATHS[faClass]) {
        return `<i class="${iconClass} ${extraClasses}" aria-hidden="true">${getHugeiconSvgHtml(faClass)}</i>`;
    }
    // Fallback to default tag structure
    return `<i class="${iconClass} ${extraClasses}" aria-hidden="true"></i>`;
}

function updateDynamicIcon(iconEl, iconClass) {
    if (!iconEl) return;
    if (!iconClass) return;

    const classes = iconClass.split(/\s+/);
    const faClass = classes.find(c => c.startsWith('fa-') && !['fa-solid', 'fa-regular', 'fa-light', 'fa-thin', 'fa-brands', 'fa-duotone', 'fa-sharp', 'fa-spin'].includes(c));
    
    if (faClass && HUGEICONS_DYNAMIC_PATHS[faClass]) {
        iconEl.innerHTML = getHugeiconSvgHtml(faClass);
    }
}
