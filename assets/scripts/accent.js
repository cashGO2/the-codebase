/**
 * Accent Color Manager
 * Handles user selection of custom accent colors, applies CSS classes, and saves preference.
 */
import { setCookie, getCookie } from './utils.js';

const ACCENT_COLORS = {
    default: { name: 'Default', hex: '#e07200' },
    orange: { name: 'Orange', hex: '#ff6138' },
    yellow: { name: 'Yellow', hex: '#f1b539' },
    green: { name: 'Green', hex: '#257d2d' },
    teal: { name: 'Teal', hex: '#3ab49b' },
    blue: { name: 'Blue', hex: '#3f6bbd' },
    pink: { name: 'Pink', hex: '#f47272' },
    purple: { name: 'Purple', hex: '#967bb6' },
    lilac: { name: 'Lilac', hex: '#c8a2c8' },
    grey: { name: 'Grey', hex: '#8a8d91' }
};

let currentAccent = 'default';

export function applyAccentColor(colorKey) {
    if (!ACCENT_COLORS[colorKey]) return;
    
    // Remove all accent classes
    document.body.classList.remove(
        'accent-orange', 'accent-yellow', 'accent-green', 'accent-teal', 
        'accent-blue', 'accent-pink', 'accent-purple', 'accent-lilac', 'accent-grey'
    );
    
    // Apply new class if not default
    if (colorKey !== 'default') {
        document.body.classList.add(`accent-${colorKey}`);
    }
    
    currentAccent = colorKey;
    
    // Update UI if it exists
    const currentText = document.getElementById('currentAccentText');
    const currentDot = document.getElementById('currentAccentDot');
    
    if (currentText && currentDot) {
        currentText.textContent = ACCENT_COLORS[colorKey].name;
        // The dot color relies on CSS var(--color-primary), but force update is safer for the active indicator
        currentDot.style.backgroundColor = 'var(--color-primary)';
    }
    
    // Update dropdown active state
    document.querySelectorAll('.accent-dropdown-item').forEach(item => {
        if (item.dataset.color === colorKey) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });
}

function initAccentColor() {
    // Read from cookie
    const savedAccent = getCookie('accentColor');
    if (savedAccent && ACCENT_COLORS[savedAccent]) {
        applyAccentColor(savedAccent);
    }
    
    // Wire up UI
    const selector = document.getElementById('accentColorSelector');
    const dropdown = document.getElementById('accentDropdown');
    
    if (selector && dropdown) {
        // Toggle dropdown
        selector.addEventListener('click', (e) => {
            e.stopPropagation();
            const isShowing = dropdown.classList.contains('show');
            
            // Close other dropdowns if any
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
        document.querySelectorAll('.accent-dropdown-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                const color = item.dataset.color;
                
                applyAccentColor(color);
                setCookie('accentColor', color, 365); // Save for 1 year
                
                // Haptic feedback if available
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

// Run init when DOM is ready
document.addEventListener('DOMContentLoaded', initAccentColor);
