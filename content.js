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

const regexCache = new Map();

// --- Dynamic-content scanning state ---
const pendingRoots = new Set();          // element roots awaiting an incremental scan
let rescanTimer = null;                  // debounce timer shared by incremental + SPA rescans
const observedRoots = new WeakSet();     // shadow roots already being observed (prevents dup/leaks)
const styledShadowRoots = new WeakSet(); // shadow roots we've injected styles into
let lastHref = location.href;            // tracks SPA navigation
let sharedStyleSheet = null;             // constructed stylesheet reused across shadow roots

// Styles mirrored from styles.css so highlights/badge render inside shadow roots,
// which the manifest-injected styles.css does not reach.
const BOTSPOTTER_SHADOW_CSS = `
.botspotter-detected {
  position: relative;
  transition: all 0.3s ease;
  box-decoration-break: clone;
  -webkit-box-decoration-break: clone;
}
.botspotter-detected.botspotter-show-badge::after {
  content: "AI";
  position: absolute;
  top: 2px;
  right: 2px;
  display: inline-block;
  white-space: nowrap;
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
  color: white;
  font-size: 9px;
  font-weight: 700;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  padding: 2px 6px;
  border-radius: 4px;
  letter-spacing: 0.5px;
  opacity: 0.9;
  z-index: 10000;
  pointer-events: none;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
  line-height: 1.2;
}
p.botspotter-detected,
div.botspotter-detected,
li.botspotter-detected,
blockquote.botspotter-detected,
article.botspotter-detected,
section.botspotter-detected {
  padding: 4px;
  margin: 2px 0;
  border-radius: 4px;
}`;

function matchesPattern(text, pattern) {
  if (pattern.startsWith('regex:')) {
    const regexStr = pattern.slice(6);
    if (!regexCache.has(pattern)) {
      try {
        regexCache.set(pattern, { regex: new RegExp(regexStr, 'i'), valid: true });
      } catch (e) {
        regexCache.set(pattern, { regex: null, valid: false });
      }
    }
    const cached = regexCache.get(pattern);
    return cached.valid ? cached.regex.test(text) : false;
  }
  return text.toLowerCase().includes(pattern.toLowerCase());
}

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
      regexCache.clear();
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
      regexCache.clear();
      excludedDomains = settings.excludedDomains;
      showBadge = settings.showBadge;
      sensitivity = settings.sensitivity;
      removeHighlights();
      if (isExtensionEnabled && !isDomainExcluded()) {
        detectAIText();
      }
      break;
      
    case 'getStats':
      sendResponse({ count: document.querySelectorAll('.botspotter-detected').length });
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
  detectedCount = document.querySelectorAll('.botspotter-detected').length;

  const textNodes = getTextNodes(document.body);
  const containerPatterns = new Map();

  textNodes.forEach(node => {
    const text = node.nodeValue;

    const matchingPatterns = aiPatterns.filter(pattern => matchesPattern(text, pattern));

    if (matchingPatterns.length >= sensitivity) {
      const container = findAppropriateContainer(node.parentElement);
      if (!container) return;
      if (container.classList.contains('botspotter-detected')) return;

      if (!containerPatterns.has(container)) {
        containerPatterns.set(container, new Set());
      }
      matchingPatterns.forEach(p => containerPatterns.get(container).add(p));
    }
  });

  for (const [container, patternSet] of containerPatterns) {
    highlightElement(container, Array.from(patternSet));
    detectedCount++;
  }
}

// Incremental detection for newly added nodes only
function detectAITextIncremental(rootNodes) {
  for (const root of rootNodes) {
    if (root.nodeType !== Node.ELEMENT_NODE) continue;

    const textNodes = getTextNodes(root);
    const containerPatterns = new Map();

    textNodes.forEach(node => {
      const text = node.nodeValue;

      const matchingPatterns = aiPatterns.filter(pattern => matchesPattern(text, pattern));

      if (matchingPatterns.length >= sensitivity) {
        const container = findAppropriateContainer(node.parentElement);
        if (!container) return;
        if (container.classList.contains('botspotter-detected')) return;

        if (!containerPatterns.has(container)) {
          containerPatterns.set(container, new Set());
        }
        matchingPatterns.forEach(p => containerPatterns.get(container).add(p));
      }
    });

    for (const [container, patternSet] of containerPatterns) {
      highlightElement(container, Array.from(patternSet));
      detectedCount++;
    }
  }
}

const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'INPUT', 'TEXTAREA',
                            'SELECT', 'OPTION', 'BUTTON', 'IFRAME', 'SVG', 'CANVAS']);

// Get all text nodes under the given root, descending into open shadow roots.
function getTextNodes(root) {
  const textNodes = [];
  collectTextNodes(root, textNodes);
  return textNodes;
}

// Collect text nodes from `node`'s light DOM, then recurse into any open shadow
// roots it contains. A TreeWalker does not pierce shadow DOM, so we must walk
// each shadow root separately.
function collectTextNodes(node, out) {
  if (!node) return;

  const walk = document.createTreeWalker(
    node,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: textNode => {
        // Skip empty nodes
        if (!textNode.nodeValue.trim()) return NodeFilter.FILTER_REJECT;

        // Skip non-content elements
        const parent = textNode.parentElement;
        if (parent && SKIP_TAGS.has(parent.tagName)) {
          return NodeFilter.FILTER_REJECT;
        }

        return NodeFilter.FILTER_ACCEPT;
      }
    }
  );

  let textNode;
  while (textNode = walk.nextNode()) {
    out.push(textNode);
  }

  // Recurse into open shadow roots (closed roots expose no shadowRoot and are skipped).
  const hosts = [];
  if (node.nodeType === Node.ELEMENT_NODE && node.shadowRoot) hosts.push(node);
  if (typeof node.querySelectorAll === 'function') {
    node.querySelectorAll('*').forEach(el => {
      if (el.shadowRoot) hosts.push(el);
    });
  }
  for (const host of hosts) collectTextNodes(host.shadowRoot, out);
}

// Find appropriate container for highlighting
function findAppropriateContainer(element) {
  if (!element) return null;

  const SAFE_STOP_TAGS = new Set(['P', 'LI', 'BLOCKQUOTE', 'TD', 'TH']);
  const UNSAFE_TAGS    = new Set(['BODY', 'HTML', 'ARTICLE', 'SECTION',
                                   'MAIN', 'HEADER', 'FOOTER', 'NAV']);

  let container = element;

  while (container.parentElement) {
    const tag = container.tagName;

    // Never return a top-level structural element
    if (UNSAFE_TAGS.has(tag)) return null;

    // Good semantic block containers — stop here
    if (SAFE_STOP_TAGS.has(tag)) return container;

    // Substantial div — stop here
    if (tag === 'DIV' && container.textContent.length >= 100) return container;

    // Peek at parent — stop before climbing into unsafe territory
    if (UNSAFE_TAGS.has(container.parentElement.tagName)) return container;

    container = container.parentElement;
  }

  // Final safety: don't return a structural element
  return UNSAFE_TAGS.has(container.tagName) ? null : container;
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
  
  element.classList.add('botspotter-detected');
  if (showBadge) {
    element.classList.add('botspotter-show-badge');
  }

  // Store original styles for restoration
  element.dataset.bsOriginalBg = element.style.backgroundColor || '';
  element.dataset.bsOriginalBorder = element.style.border || '';
  element.dataset.bsOriginalTextDecoration = element.style.textDecoration || '';
  element.dataset.bsMatchedPatterns = JSON.stringify(matchingPatterns);

  // Build tooltip text listing the triggering phrases
  const phraseList = matchingPatterns.map(p => {
    if (p.startsWith('regex:')) return `[pattern] ${p.slice(6)}`;
    return `"${p}"`;
  }).join(', ');
  element.dataset.bsTooltip = `AI phrase${matchingPatterns.length > 1 ? 's' : ''} detected: ${phraseList}`;

  // If this element lives inside a shadow root, make sure our styles reach it
  // (the manifest-injected styles.css does not cascade into shadow DOM).
  ensureShadowStyles(element);

  // Apply highlight style
  applyHighlightStyle(element);
}

// Inject BotSpotter styles into a shadow root once, so highlights/badge render there.
function ensureShadowStyles(node) {
  if (!node || typeof node.getRootNode !== 'function') return;
  const root = node.getRootNode();
  // Only shadow roots need their own copy; the document already has styles.css.
  if (!(typeof ShadowRoot !== 'undefined' && root instanceof ShadowRoot)) return;
  if (styledShadowRoots.has(root)) return;
  styledShadowRoots.add(root);

  try {
    if ('adoptedStyleSheets' in root && typeof CSSStyleSheet === 'function') {
      if (!sharedStyleSheet) {
        sharedStyleSheet = new CSSStyleSheet();
        sharedStyleSheet.replaceSync(BOTSPOTTER_SHADOW_CSS);
      }
      // Avoid clobbering the site's own adopted sheets.
      if (!root.adoptedStyleSheets.includes(sharedStyleSheet)) {
        root.adoptedStyleSheets = [...root.adoptedStyleSheets, sharedStyleSheet];
      }
    } else {
      const style = document.createElement('style');
      style.textContent = BOTSPOTTER_SHADOW_CSS;
      root.appendChild(style);
    }
  } catch (e) {
    // Site may freeze adoptedStyleSheets; inline highlight styles still apply.
    console.error('BotSpotter: could not inject shadow styles', e);
  }
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
    delete element.dataset.bsTooltip;
  });
  
  detectedCount = 0;
  hideTooltip();
}

// Tooltip – a single fixed-position <div> on <body> so it escapes overflow:hidden.
let tooltipEl = null;
let currentTooltipTarget = null;

function getTooltip() {
  if (!tooltipEl || !tooltipEl.isConnected) {
    if (tooltipEl) tooltipEl.remove();
    tooltipEl = document.createElement('div');
    tooltipEl.id = 'botspotter-tooltip';
    document.body.appendChild(tooltipEl);
  }
  return tooltipEl;
}

function showTooltipFor(detected) {
  if (!detected || !detected.dataset.bsTooltip) return;

  currentTooltipTarget = detected;
  const tip = getTooltip();
  tip.textContent = detected.dataset.bsTooltip;

  // Position off-screen first so we can measure true size
  tip.classList.remove('visible');
  tip.style.left = '-9999px';
  tip.style.top = '-9999px';
  tip.style.display = 'block';

  // Force layout so measurements are accurate
  const tipWidth = tip.offsetWidth;
  const tipHeight = tip.offsetHeight;
  const elRect = detected.getBoundingClientRect();

  let top = elRect.top - tipHeight - 6;
  if (top < 0) top = elRect.bottom + 6;

  let left = elRect.left;
  if (left + tipWidth > window.innerWidth - 8) {
    left = window.innerWidth - tipWidth - 8;
  }
  if (left < 8) left = 8;

  tip.style.top = `${top}px`;
  tip.style.left = `${left}px`;
  tip.classList.add('visible');
}

function hideTooltip() {
  currentTooltipTarget = null;
  if (tooltipEl) {
    tooltipEl.classList.remove('visible');
    tooltipEl.style.display = 'none';
  }
}

// Use mouseover (bubbles from children) for enter detection
document.addEventListener('mouseover', (e) => {
  // Ignore events on the tooltip itself
  if (tooltipEl && tooltipEl.contains(e.target)) return;

  const detected = e.target.closest('.botspotter-detected');
  if (detected && detected !== currentTooltipTarget) {
    showTooltipFor(detected);
  } else if (!detected && currentTooltipTarget) {
    hideTooltip();
  }
});

// Hide when leaving the page entirely
document.addEventListener('mouseleave', hideTooltip);
window.addEventListener('scroll', hideTooltip);

// Initialize the extension
init();

// Watch for dynamically added content. A single shared observer is reused for the
// document body and every shadow root we discover, so all mutations funnel through
// the same accumulate-and-flush pipeline.
const observer = new MutationObserver(mutations => {
  try {
    if (!isExtensionEnabled || isDomainExcluded()) return;

    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          if (node.id && node.id.startsWith('botspotter-')) continue;
          pendingRoots.add(node);
        }
      }
    }

    if (pendingRoots.size === 0) return;

    // Debounce, but accumulate into a persistent queue so that resetting the
    // timer never drops nodes from earlier mutation batches.
    clearTimeout(rescanTimer);
    rescanTimer = setTimeout(flushPendingRoots, 500);
  } catch (error) {
    console.error('BotSpotter: Error in MutationObserver callback:', error);
  }
});

// Drain the queued roots: scan each for AI text and observe any new shadow roots.
function flushPendingRoots() {
  rescanTimer = null;
  if (!isExtensionEnabled || isDomainExcluded()) {
    pendingRoots.clear();
    return;
  }

  // Snapshot + clear so mutations during the scan accumulate for the next flush.
  const roots = dedupeRoots([...pendingRoots]).filter(node => node.isConnected);
  pendingRoots.clear();
  if (roots.length === 0) return;

  try {
    detectAITextIncremental(roots);
  } catch (error) {
    console.error('BotSpotter: Error during incremental scan:', error);
  }

  // Attach observers to any shadow roots that arrived with these nodes.
  roots.forEach(observeShadowRoots);
}

// Drop any node whose ancestor is also queued — scanning the ancestor covers it.
function dedupeRoots(nodes) {
  return nodes.filter(node =>
    !nodes.some(other => other !== node && other.contains(node))
  );
}

// Attach the shared observer to every open shadow root under `root` (recursively).
function observeShadowRoots(root) {
  if (!root || typeof root.querySelectorAll !== 'function') return;

  if (root.nodeType === Node.ELEMENT_NODE && root.shadowRoot) {
    attachShadowObserver(root.shadowRoot);
  }
  root.querySelectorAll('*').forEach(el => {
    if (el.shadowRoot) attachShadowObserver(el.shadowRoot);
  });
}

function attachShadowObserver(shadowRoot) {
  if (observedRoots.has(shadowRoot)) return;
  observedRoots.add(shadowRoot);
  try {
    observer.observe(shadowRoot, { childList: true, subtree: true });
  } catch (error) {
    console.error('BotSpotter: Error observing shadow root:', error);
  }
  observeShadowRoots(shadowRoot); // nested shadow roots
}

// Re-scan after single-page-app navigation (Reddit changes the URL without a reload).
function onSpaNavigate() {
  if (location.href === lastHref) return;
  lastHref = location.href;
  if (!isExtensionEnabled || isDomainExcluded() || aiPatterns.length === 0) return;

  // Let the SPA swap content in, then run a full (idempotent) rescan.
  clearTimeout(rescanTimer);
  rescanTimer = setTimeout(() => {
    rescanTimer = null;
    try {
      detectAIText();
      observeShadowRoots(document);
    } catch (error) {
      console.error('BotSpotter: Error during SPA rescan:', error);
    }
  }, 600);
}

function setupSpaNavigationWatch() {
  const wrap = fn => function (...args) {
    const result = fn.apply(this, args);
    try { onSpaNavigate(); } catch (e) { /* never break the host's navigation */ }
    return result;
  };
  try {
    history.pushState = wrap(history.pushState);
    history.replaceState = wrap(history.replaceState);
  } catch (e) {
    console.error('BotSpotter: Could not patch history methods', e);
  }
  window.addEventListener('popstate', onSpaNavigate);
  window.addEventListener('hashchange', onSpaNavigate);
  // Backstop in case the site replaces history methods or uses an unusual router.
  setInterval(onSpaNavigate, 1000);
}

// Wire up observers + navigation watch once the DOM is ready.
function startObserving() {
  const begin = () => {
    if (document.body) {
      observer.observe(document.body, { childList: true, subtree: true });
    }
    observeShadowRoots(document);
    setupSpaNavigationWatch();
  };
  if (document.body) {
    begin();
  } else {
    document.addEventListener('DOMContentLoaded', begin, { once: true });
  }
}

startObserving();
