/**
 * Help hints and tooltips system for CRM app
 * Provides contextual help throughout the application
 */

export const __esModule = true;

const TOOLTIP_CLASS = 'help-tooltip';
const TOOLTIP_VISIBLE_CLASS = 'help-tooltip-visible';
const TOOLTIP_Z_INDEX = 10000;

let tooltipElement = null;
let currentHintElement = null;
let hideTimeout = null;

function createTooltip() {
  if (tooltipElement) return tooltipElement;
  
  tooltipElement = document.createElement('div');
  tooltipElement.className = TOOLTIP_CLASS;
  tooltipElement.style.cssText = `
    position: fixed;
    z-index: ${TOOLTIP_Z_INDEX};
    background: #1e293b;
    color: white;
    padding: 8px 12px;
    border-radius: 6px;
    font-size: 13px;
    line-height: 1.4;
    max-width: 280px;
    pointer-events: none;
    opacity: 0;
    transition: opacity 0.2s ease;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
  `;
  document.body.appendChild(tooltipElement);
  return tooltipElement;
}

function positionTooltip(hintElement, tooltip) {
  const rect = hintElement.getBoundingClientRect();
  const tooltipRect = tooltip.getBoundingClientRect();
  
  // Position above the hint by default
  let top = rect.top - tooltipRect.height - 8;
  let left = rect.left + (rect.width / 2) - (tooltipRect.width / 2);
  
  // Adjust if tooltip would go off screen
  if (top < 8) {
    // Position below instead
    top = rect.bottom + 8;
  }
  
  if (left < 8) {
    left = 8;
  } else if (left + tooltipRect.width > window.innerWidth - 8) {
    left = window.innerWidth - tooltipRect.width - 8;
  }
  
  tooltip.style.top = `${top}px`;
  tooltip.style.left = `${left}px`;
}

function showTooltip(hintElement, text) {
  if (hideTimeout) {
    clearTimeout(hideTimeout);
    hideTimeout = null;
  }
  
  const tooltip = createTooltip();
  tooltip.textContent = text;
  currentHintElement = hintElement;
  
  // Force reflow to ensure transition works
  tooltip.style.opacity = '0';
  tooltip.offsetHeight;
  
  positionTooltip(hintElement, tooltip);
  
  requestAnimationFrame(() => {
    tooltip.style.opacity = '1';
    tooltip.classList.add(TOOLTIP_VISIBLE_CLASS);
  });
}

function hideTooltip(immediate = false) {
  if (!tooltipElement) return;
  
  if (hideTimeout) {
    clearTimeout(hideTimeout);
    hideTimeout = null;
  }
  
  const hide = () => {
    if (tooltipElement) {
      tooltipElement.style.opacity = '0';
      tooltipElement.classList.remove(TOOLTIP_VISIBLE_CLASS);
      currentHintElement = null;
    }
  };
  
  if (immediate) {
    hide();
  } else {
    hideTimeout = setTimeout(hide, 150);
  }
}

function handleHintMouseEnter(evt) {
  const hintElement = evt.currentTarget;
  const text = hintElement.getAttribute('data-hint') || hintElement.getAttribute('title') || '';
  if (text) {
    // Remove title to prevent browser tooltip
    if (hintElement.hasAttribute('title')) {
      hintElement.setAttribute('data-original-title', hintElement.getAttribute('title'));
      hintElement.removeAttribute('title');
    }
    showTooltip(hintElement, text);
  }
}

function handleHintMouseLeave() {
  hideTooltip();
}

function handleHintFocus(evt) {
  handleHintMouseEnter(evt);
}

function handleHintBlur() {
  hideTooltip(true);
}

function attachToHint(element) {
  if (element.hasAttribute('data-hint-attached')) return;
  
  element.setAttribute('data-hint-attached', 'true');
  element.addEventListener('mouseenter', handleHintMouseEnter);
  element.addEventListener('mouseleave', handleHintMouseLeave);
  element.addEventListener('focus', handleHintFocus);
  element.addEventListener('blur', handleHintBlur);
}

function detachFromHint(element) {
  if (!element.hasAttribute('data-hint-attached')) return;
  
  element.removeAttribute('data-hint-attached');
  element.removeEventListener('mouseenter', handleHintMouseEnter);
  element.removeEventListener('mouseleave', handleHintMouseLeave);
  element.removeEventListener('focus', handleHintFocus);
  element.removeEventListener('blur', handleHintBlur);
  
  // Restore original title if it existed
  if (element.hasAttribute('data-original-title')) {
    element.setAttribute('title', element.getAttribute('data-original-title'));
    element.removeAttribute('data-original-title');
  }
}

export function initHelpHints() {
  // Find all help hints and attach event listeners
  const hints = document.querySelectorAll('.help-hint, [data-hint]');
  hints.forEach(attachToHint);
  
  // Use MutationObserver to handle dynamically added hints
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          if (node.classList?.contains('help-hint') || node.hasAttribute?.('data-hint')) {
            attachToHint(node);
          }
          // Check descendants
          const descendants = node.querySelectorAll?.('.help-hint, [data-hint]');
          descendants?.forEach(attachToHint);
        }
      });
      
      mutation.removedNodes.forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          if (node.classList?.contains('help-hint') || node.hasAttribute?.('data-hint')) {
            detachFromHint(node);
          }
        }
      });
    });
  });
  
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
  
  // Handle window resize
  let resizeTimeout;
  window.addEventListener('resize', () => {
    if (resizeTimeout) clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      if (currentHintElement && tooltipElement && tooltipElement.style.opacity !== '0') {
        positionTooltip(currentHintElement, tooltipElement);
      }
    }, 100);
  });
}

// Auto-initialize on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initHelpHints);
} else {
  initHelpHints();
}
