// BotSpotter Content Script
// Detects and highlights potentially AI-generated text

// Default patterns (will be overwritten by stored patterns)
let aiPatterns = [];
let isExtensionEnabled = true;
let highlightColor = '#fffde7';
let highlightStyle = 'background';
let highlightOpacity = 100;
let excludedDomains = [];
let showBadge = true;
let sensitivity = 1;
let detectedCount = 0;

// Check if current domain is excluded
function isDomainExcluded() {
  const currentDomain = window.location.hostname.replace('www.', '');
  return excludedDomains.some(domain => {
    const cleanDomain = domain.replace('www.', '').toLowerCase();
    return currentDomain.toLowerCase().includes(cleanDomain);
  });
}

// Initialize extension
async function init() {
  try {
    // Load settings from storage
    const result = await chrome.storage.sync.get([
      'enabled',
      'highlightColor',
      'highlightStyle',
      'highlightOpacity',
      'patterns',
      'excludedDomains',
      'showBadge',
      'sensitivity'
    ]);
    
    // Apply settings with fallbacks
    if (result.enabled !== undefined) isExtensionEnabled = result.enabled;
    if (result.highlightColor) highlightColor = result.highlightColor;
    if (result.highlightStyle) highlightStyle = result.highlightStyle;
    if (result.highlightOpacity !== undefined) highlightOpacity = result.highlightOpacity;
    if (result.patterns && Array.isArray(result.patterns)) aiPatterns = result.patterns;
    if (result.excludedDomains && Array.isArray(result.excludedDomains)) excludedDomains = result.excludedDomains;
    if (result.showBadge !== undefined) showBadge = result.showBadge;
    if (result.sensitivity !== undefined) sensitivity = result.sensitivity;
    
    // Check if domain is excluded
    if (isDomainExcluded()) {
      console.log('BotSpotter: Domain excluded');
      return;
    }
    
    // Run detection if enabled
    if (isExtensionEnabled && aiPatterns.length > 0) {
      detectAIText();
    }
  } catch (error) {
    console.error('BotSpotter: Error initializing:', error);
  }
  
  // Set up message listener
  chrome.runtime.onMessage.addListener(handleMessage);
}

// Handle messages from popup/background
function handleMessage(request, sender, sendResponse) {
  switch (request.action) {
    case 'toggleDetection':
      isExtensionEnabled = request.enabled;
      if (isExtensionEnabled && !isDomainExcluded()) {
        detectAIText();
      } else {
        removeHighlights();
      }
      break;
      
    case 'updateHighlightColor':
      highlightColor = request.color;
      updateHighlightStyles();
      break;
      
    case 'updateHighlightStyle':
      highlightStyle = request.style;
      updateHighlightStyles();
      break;
      
    case 'updateHighlightOpacity':
      highlightOpacity = request.opacity;
      updateHighlightStyles();
      break;
      
    case 'updatePatterns':
      aiPatterns = request.patterns;
      removeHighlights();
      if (isExtensionEnabled && !isDomainExcluded()) {
        detectAIText();
      }
      break;
      
    case 'updateSensitivity':
      sensitivity = request.sensitivity;
      removeHighlights();
      if (isExtensionEnabled && !isDomainExcluded()) {
        detectAIText();
      }
      break;
      
    case 'updateShowBadge':
      showBadge = request.showBadge;
      updateBadgeVisibility();
      break;
      
    case 'settingsReset':
      // Apply all reset settings
      const settings = request.settings;
      isExtensionEnabled = settings.enabled;
      highlightColor = settings.highlightColor;
      highlightStyle = settings.highlightStyle;
      highlightOpacity = settings.highlightOpacity;
      aiPatterns = settings.patterns;
      excludedDomains = settings.excludedDomains;
      showBadge = settings.showBadge;
      sensitivity = settings.sensitivity;
      removeHighlights();
      if (isExtensionEnabled && !isDomainExcluded()) {
        detectAIText();
      }
      break;
      
    case 'getStats':
      sendResponse({ count: detectedCount });
      return true;
      
    case 'rescan':
      removeHighlights();
      if (isExtensionEnabled && !isDomainExcluded()) {
        detectAIText();
      }
      sendResponse({ count: detectedCount });
      return true;
  }
  
  return true;
}

// Main detection function
function detectAIText() {
  detectedCount = 0;
  
  // Get all text nodes in the document
  const textNodes = getTextNodes(document.body);
  
  // Track which containers have already been processed
  const processedContainers = new Set();
  
  // Process each text node
  textNodes.forEach(node => {
    const text = node.nodeValue;
    
    // Count how many patterns match
    const matchingPatterns = aiPatterns.filter(pattern => 
      text.toLowerCase().includes(pattern.toLowerCase())
    );
    
    // Check if enough patterns match based on sensitivity
    if (matchingPatterns.length >= sensitivity) {
      // Find appropriate container element to highlight
      const container = findAppropriateContainer(node.parentElement);
      
      // Skip if already processed
      if (processedContainers.has(container)) return;
      processedContainers.add(container);
      
      highlightElement(container, matchingPatterns);
      detectedCount++;
    }
  });
}

// Get all text nodes under the given element
function getTextNodes(element) {
  const textNodes = [];
  
  if (!element) return textNodes;
  
  const walk = document.createTreeWalker(
    element,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: node => {
        // Skip empty nodes
        if (!node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        
        // Skip script and style elements
        const parent = node.parentElement;
        if (parent && (parent.tagName === 'SCRIPT' || parent.tagName === 'STYLE' || parent.tagName === 'NOSCRIPT')) {
          return NodeFilter.FILTER_REJECT;
        }
        
        return NodeFilter.FILTER_ACCEPT;
      }
    }
  );
  
  let node;
  while (node = walk.nextNode()) {
    textNodes.push(node);
  }
  
  return textNodes;
}

// Find appropriate container for highlighting
function findAppropriateContainer(element) {
  let container = element;
  
  if (!container) return null;
  
  // Move up to parent elements like paragraphs, list items, divs
  while (container.parentElement) {
    const tag = container.tagName;
    
    // Stop at appropriate block-level elements
    if (tag === 'P' || tag === 'LI' || tag === 'BLOCKQUOTE' || tag === 'TD' || tag === 'TH') {
      break;
    }
    
    // Stop at divs that seem like content containers (have enough text)
    if (tag === 'DIV' && container.textContent.length >= 100) {
      break;
    }
    
    // Don't go too high in the DOM hierarchy
    if (tag === 'ARTICLE' || tag === 'SECTION' || tag === 'BODY' || tag === 'HTML') {
      break;
    }
    
    container = container.parentElement;
  }
  
  return container;
}

// Calculate highlight color with opacity
function getHighlightColorWithOpacity() {
  // Parse hex color
  let hex = highlightColor.replace('#', '');
  if (hex.length === 3) {
    hex = hex.split('').map(c => c + c).join('');
  }
  
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  const a = highlightOpacity / 100;
  
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

// Highlight element as potentially AI-generated
function highlightElement(element, matchingPatterns = []) {
  if (!element) return;
  
  // Don't re-highlight already highlighted elements
  if (element.classList.contains('botspotter-detected')) {
    return;
  }
  
  // Add detection class
  element.classList.add('botspotter-detected');
  
  // Store original styles for restoration
  element.dataset.bsOriginalBg = element.style.backgroundColor || '';
  element.dataset.bsOriginalBorder = element.style.border || '';
  element.dataset.bsOriginalTextDecoration = element.style.textDecoration || '';
  element.dataset.bsMatchedPatterns = JSON.stringify(matchingPatterns);
  
  // Apply highlight style
  applyHighlightStyle(element);
}

// Apply the current highlight style to an element
function applyHighlightStyle(element) {
  const color = getHighlightColorWithOpacity();
  
  // Reset all styles first
  element.style.backgroundColor = element.dataset.bsOriginalBg || '';
  element.style.border = element.dataset.bsOriginalBorder || '';
  element.style.textDecoration = element.dataset.bsOriginalTextDecoration || '';
  
  switch (highlightStyle) {
    case 'background':
      element.style.backgroundColor = color;
      break;
    case 'border':
      element.style.border = `2px solid ${highlightColor}`;
      element.style.borderRadius = '4px';
      break;
    case 'underline':
      element.style.textDecoration = `underline wavy ${highlightColor}`;
      break;
  }
  
  // Ensure position is relative for badge
  if (showBadge) {
    element.style.position = 'relative';
  }
}

// Update badge visibility on all highlighted elements
function updateBadgeVisibility() {
  const elements = document.querySelectorAll('.botspotter-detected');
  elements.forEach(el => {
    if (showBadge) {
      el.classList.add('botspotter-show-badge');
    } else {
      el.classList.remove('botspotter-show-badge');
    }
  });
}

// Update existing highlights with new styles
function updateHighlightStyles() {
  const elements = document.querySelectorAll('.botspotter-detected');
  elements.forEach(el => {
    applyHighlightStyle(el);
  });
  updateBadgeVisibility();
}

// Remove all highlights
function removeHighlights() {
  const elements = document.querySelectorAll('.botspotter-detected');
  
  elements.forEach(element => {
    // Restore original styles
    element.style.backgroundColor = element.dataset.bsOriginalBg || '';
    element.style.border = element.dataset.bsOriginalBorder || '';
    element.style.textDecoration = element.dataset.bsOriginalTextDecoration || '';
    
    // Remove classes and data attributes
    element.classList.remove('botspotter-detected', 'botspotter-show-badge');
    delete element.dataset.bsOriginalBg;
    delete element.dataset.bsOriginalBorder;
    delete element.dataset.bsOriginalTextDecoration;
    delete element.dataset.bsMatchedPatterns;
  });
  
  detectedCount = 0;
}

// Initialize the extension
init();

// Watch for dynamically added content
const observer = new MutationObserver(mutations => {
  if (!isExtensionEnabled || isDomainExcluded()) return;
  
  let shouldRescan = false;
  
  for (const mutation of mutations) {
    if (mutation.addedNodes.length > 0) {
      // Check if any added nodes contain text
      for (const node of mutation.addedNodes) {
        if (node.nodeType === Node.ELEMENT_NODE || node.nodeType === Node.TEXT_NODE) {
          shouldRescan = true;
          break;
        }
      }
    }
    if (shouldRescan) break;
  }
  
  if (shouldRescan) {
    // Debounce the rescan
    clearTimeout(observer.rescanTimeout);
    observer.rescanTimeout = setTimeout(() => {
      detectAIText();
    }, 500);
  }
});

// Start observing when DOM is ready
if (document.body) {
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
}
