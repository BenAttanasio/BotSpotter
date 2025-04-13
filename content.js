// AI pattern detection configurations
const AI_PATTERNS = [
    "isn't just about",
    "—it's about", 
    "—", // Long dashes
    "more than just",
    "; it's a"
  ];
  
  // Default state - can be updated from background.js
  let isExtensionEnabled = true;
  let highlightColor = "yellow";
  
  // Initialize
  function init() {
    // Get extension state from storage
    chrome.storage.sync.get(['enabled', 'highlightColor'], function(result) {
      if (result.enabled !== undefined) {
        isExtensionEnabled = result.enabled;
      }
      
      if (result.highlightColor) {
        highlightColor = result.highlightColor;
      }
      
      // Only run the detector if enabled
      if (isExtensionEnabled) {
        detectAIText();
      }
    });
    
    // Listen for messages from popup or background
    chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
      if (request.action === "toggleDetection") {
        isExtensionEnabled = request.enabled;
        
        if (isExtensionEnabled) {
          detectAIText();
        } else {
          removeHighlights();
        }
      }
      
      if (request.action === "updateHighlightColor") {
        highlightColor = request.color;
        updateHighlights();
      }
      
      // Always return true for async response
      return true;
    });
  }
  
  // Main detection function
  function detectAIText() {
    // Get all text nodes in the document
    const textNodes = getTextNodes(document.body);
    
    // Process each text node
    textNodes.forEach(node => {
      const text = node.nodeValue;
      
      // Check if any AI pattern is present
      const hasAIPattern = AI_PATTERNS.some(pattern => text.includes(pattern));
      
      if (hasAIPattern) {
        // Find appropriate container element to highlight
        const container = findAppropriateContainer(node.parentElement);
        highlightElement(container);
      }
    });
  }
  
  // Get all text nodes under the given element
  function getTextNodes(element) {
    let textNodes = [];
    
    if (element) {
      const walk = document.createTreeWalker(
        element,
        NodeFilter.SHOW_TEXT,
        { acceptNode: node => node.nodeValue.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT },
        false
      );
      
      let node;
      while (node = walk.nextNode()) {
        textNodes.push(node);
      }
    }
    
    return textNodes;
  }
  
  // Find appropriate container for highlighting
  function findAppropriateContainer(element) {
    // Start with the element containing the matched text
    let container = element;
    
    // Check if element exists
    if (!container) return document.body;
    
    // Move up to parent elements like paragraphs, list items, divs with specific content
    while (container.parentElement && 
           (container.tagName !== 'P' && 
            container.tagName !== 'LI' && 
            container.tagName !== 'DIV' ||
            container.textContent.length < 100)) {
      container = container.parentElement;
      
      // Don't go too high in the DOM hierarchy
      if (container.tagName === 'ARTICLE' || 
          container.tagName === 'SECTION' || 
          container.tagName === 'BODY') {
        break;
      }
    }
    
    return container;
  }
  
  // Highlight element as potentially AI-generated
  function highlightElement(element) {
    // Don't re-highlight already highlighted elements
    if (element.classList.contains('ai-text-detected')) {
      return;
    }
    
    // Add highlight class
    element.classList.add('ai-text-detected');
    
    // Store original background for potential later restoration
    element.dataset.originalBackground = element.style.backgroundColor || '';
    
    // Apply the highlight
    element.style.backgroundColor = highlightColor;
    element.style.padding = "2px";
    element.style.position = "relative";
  }
  
  // Remove all highlights
  function removeHighlights() {
    const highlightedElements = document.querySelectorAll('.ai-text-detected');
    
    highlightedElements.forEach(element => {
      // Restore original background
      element.style.backgroundColor = element.dataset.originalBackground || '';
      element.style.padding = "";
      
      // Remove class
      element.classList.remove('ai-text-detected');
    });
  }
  
  // Update existing highlights with new color
  function updateHighlights() {
    const highlightedElements = document.querySelectorAll('.ai-text-detected');
    
    highlightedElements.forEach(element => {
      element.style.backgroundColor = highlightColor;
    });
  }
  
  // Initialize the extension
  init();
  
  // Check for dynamically added content
  const observer = new MutationObserver(mutations => {
    if (isExtensionEnabled) {
      mutations.forEach(mutation => {
        if (mutation.addedNodes && mutation.addedNodes.length > 0) {
          detectAIText();
        }
      });
    }
  });
  
  // Start observing
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });