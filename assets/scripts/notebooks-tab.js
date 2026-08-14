/**
 * Notebooks Tab Logic
 * Handles rendering the list of notebooks in the home page tab
 */

document.addEventListener('DOMContentLoaded', () => {
    // Wait for notebook bundle to load
    if (window.MaterioNotebook) {
        initNotebooksTab();
    } else {
        window.addEventListener('bundle:loaded', initNotebooksTab);
    }
});

function initNotebooksTab() {
    const PDF_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="12" height="12" color="currentColor" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: inline-block; vertical-align: middle; margin-right: 4px;">
        <path d="M20 13V10.6569C20 9.83935 20 9.4306 19.8478 9.06306C19.6955 8.69552 19.4065 8.40649 18.8284 7.82843L14.0919 3.09188C13.593 2.593 13.3436 2.34355 13.0345 2.19575C12.9702 2.165 12.9044 2.13772 12.8372 2.11401C12.5141 2 12.1614 2 11.4558 2C8.21082 2 6.58831 2 5.48933 2.88607C5.26731 3.06508 5.06508 3.26731 4.88607 3.48933C4 4.58831 4 6.21082 4 9.45584V13M13 2.5V3C13 5.82843 13 7.24264 13.8787 8.12132C14.7574 9 16.1716 9 19 9H19.5"></path>
        <path d="M19.75 16H17.25C16.6977 16 16.25 16.4477 16.25 17V19M16.25 19V22M16.25 19H19.25M4.25 22V19.5M4.25 19.5V16H6C6.9665 16 7.75 16.7835 7.75 17.75C7.75 18.7165 6.9665 19.5 6 19.5H4.25ZM10.25 16H11.75C12.8546 16 13.75 16.8954 13.75 18V20C13.75 21.1046 12.8546 22 11.75 22H10.25V16Z"></path>
    </svg>`;

    const CLOUD_CHECK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="12" height="12" color="currentColor" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: inline-block; vertical-align: middle;">
        <path d="M17.5 18C19.9853 18 22 15.9853 22 13.5C22 11.0147 19.9853 9 17.5 9C17.4925 9 17.485 9.00002 17.4776 9.00005M17.4776 9.00005C17.4924 8.83536 17.5 8.66856 17.5 8.5C17.5 5.46243 15.0376 3 12 3C9.12324 3 6.76233 5.20862 6.52042 8.0227M17.4776 9.00005C17.4131 9.71494 17.2119 10.3904 16.9003 11M6.52042 8.0227C3.98398 8.26407 2 10.4003 2 13C2 15.419 3.71776 17.4367 6 17.9M6.52042 8.0227C6.67826 8.00768 6.83823 8 7 8C8.12582 8 9.16474 8.37209 10.0005 9"></path>
        <path d="M9 19C9 19 10 19 11 21C11 21 14.1765 16 17 15"></path>
    </svg>`;

    const grid = document.getElementById('notebooksGridInTab');
    const emptyState = document.getElementById('emptyStateInTab');
    const syncBtn = document.getElementById('syncBtnInTab');

    if (!window.MaterioNotebook || !grid) {
        return;
    }

    // Show sync button for privileged users
    if (window.materioUserHasAdminPrivileges || window.materioUserHasPrivateAccess) {
        if (syncBtn) syncBtn.style.display = 'inline-flex';
    }

    function renderNotebooks() {
        const notebooks = window.MaterioNotebook.getAll();
        const filter = document.getElementById('notebookFilter')?.value || 'all';

        let filteredNotebooks = notebooks;
        if (filter === 'linked') {
            filteredNotebooks = notebooks.filter(n => n.linkedPdf);
        }

        if (filteredNotebooks.length === 0) {
            grid.style.display = 'none';
            if (emptyState) {
                emptyState.style.display = 'block';
                const emptyText = emptyState.querySelector('p');
                if (emptyText) {
                    emptyText.textContent = filter === 'linked' ? 'No notes are linked to PDFs yet.' : 'Create your first note to get started.';
                }
            }
            return;
        }

        grid.style.display = 'grid';
        if (emptyState) emptyState.style.display = 'none';
        grid.innerHTML = '';

        // Sort by updated date desc
        const sortedNotebooks = [...filteredNotebooks].sort((a, b) =>
            new Date(b.updatedAt) - new Date(a.updatedAt)
        );

        sortedNotebooks.forEach(notebook => {
            const card = document.createElement('div');
            card.className = 'notebook-card';

            // Render markdown to HTML first, then strip HTML tags for clean text preview
            let content = notebook.content || '';
            if (window.MaterioNotebook && window.MaterioNotebook.markdownToHtml) {
                content = window.MaterioNotebook.markdownToHtml(content);
            }
            // Replace line breaks and blocks with spaces to prevent words/URLs from running together
            content = content.replace(/<br\s*\/?>/gi, ' ')
                             .replace(/<\/p>/gi, ' ')
                             .replace(/<\/div>/gi, ' ');

            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = content;
            const previewText = tempDiv.textContent || 'No content';

            const dateStr = new Date(notebook.updatedAt).toLocaleDateString(undefined, {
                month: 'short', day: 'numeric', year: 'numeric'
            });

            let badgeHtml = '';
            if (notebook.linkedPdf) {
                badgeHtml = `<div class="notebook-card-link">${PDF_SVG} PDF</div>`;
            }

            if (notebook.syncedToCloud) {
                badgeHtml += `<div class="notebook-card-link" style="margin-left: 6px; background: var(--notebook-accent-light); color: var(--notebook-accent);">${CLOUD_CHECK_SVG}</div>`;
            }

            card.innerHTML = `
                <div class="notebook-card-content" onclick="window.MaterioNotebook.open('${notebook.id}')">
                    <h3 class="notebook-card-title">
                        <i class="far fa-file-lines"></i>
                        ${notebook.title || 'Untitled Note'}
                    </h3>
                    <div class="notebook-card-preview">${previewText.slice(0, 150)}${previewText.length > 150 ? '...' : ''}</div>
                    <div class="notebook-card-meta">
                        <span class="notebook-card-date">${dateStr}</span>
                        <div class="notebook-card-badges">${badgeHtml}</div>
                    </div>
                </div>
                <div class="notebook-card-actions-quick">
                    <button class="card-action-btn delete" title="Delete note" onclick="event.stopPropagation(); window.MaterioNotebook.delete('${notebook.id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `;
            grid.appendChild(card);
        });
    }

    // Initial render
    renderNotebooks();

    // Listen for storage changes to update list
    window.addEventListener('storage', (e) => {
        if (e.key === 'materio_notebooks') {
            renderNotebooks();
        }
    });

    // Listen for local notebook updates (save/delete from modal)
    document.addEventListener('notebook:update', () => {
        renderNotebooks();
    });

    // Listen for tab switch to notebooks
    document.addEventListener('tabOpened', (e) => {
        if (e.detail.tab === 'notebooks') {
            renderNotebooks();
        }
    });

    // Add filter change listener
    const filter = document.getElementById('notebookFilter');
    if (filter) {
        filter.addEventListener('change', () => {
            renderNotebooks();
        });
    }

    // Setup custom filter dropdown
    const filterSelector = document.getElementById('notebookFilterSelector');
    const filterDropdown = document.getElementById('notebookFilterDropdown');
    const nativeFilter = document.getElementById('notebookFilter');
    const currentText = document.getElementById('currentNotebookFilterText');

    if (filterSelector && filterDropdown && nativeFilter) {
        filterSelector.addEventListener('click', (e) => {
            e.stopPropagation();
            const isShowing = filterDropdown.classList.contains('show');
            document.querySelectorAll('.accent-dropdown.show').forEach(el => {
                if (el !== filterDropdown) el.classList.remove('show');
            });
            if (isShowing) {
                filterDropdown.classList.remove('show');
            } else {
                filterDropdown.classList.add('show');
            }
        });

        // Close on clicking outside
        document.addEventListener('click', (e) => {
            if (!filterSelector.contains(e.target) && !filterDropdown.contains(e.target)) {
                filterDropdown.classList.remove('show');
            }
        });

        // Item selection
        filterDropdown.querySelectorAll('.theme-dropdown-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                const value = item.dataset.filter;
                
                // Update active class
                filterDropdown.querySelectorAll('.theme-dropdown-item').forEach(el => el.classList.remove('active'));
                item.classList.add('active');

                // Update text
                if (currentText) {
                    currentText.textContent = item.querySelector('span').textContent;
                }

                // Update native select and trigger change
                nativeFilter.value = value;
                nativeFilter.dispatchEvent(new Event('change'));

                // Close dropdown
                filterDropdown.classList.remove('show');
                
                if (window.MaterioHaptics) {
                    window.MaterioHaptics.vibrate('tap');
                }
            });
        });
    }

    // Global sync function for the tab
    window.syncNotebooks = async () => {
        const btn = document.getElementById('syncBtnInTab');
        if (!btn) return;

        const icon = btn.querySelector('i');
        const originalIconClass = icon.className;

        icon.className = 'fas fa-spinner fa-spin';
        btn.disabled = true;

        if (window.MaterioNotebook.syncToCloud) {
            await window.MaterioNotebook.syncToCloud();
        }

        // re-render in case of updates
        renderNotebooks();

        setTimeout(() => {
            icon.className = originalIconClass;
            btn.disabled = false;
        }, 1000);
    };
}
