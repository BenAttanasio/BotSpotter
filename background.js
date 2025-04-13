// Initialize default settings when extension is installed
chrome.runtime.onInstalled.addListener(function() {
    chrome.storage.sync.set({
      enabled: true,
      highlightColor: 'yellow',
      patterns: [
        "isn't just about",
        "—it's about",
        "—",
        "more than just",
        "; it's a"
      ]
    }, function() {
      console.log('BotSpotter initialized with default settings');
    });
  });
  
  // Listen for messages from popup or content scripts
  chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    // Toggle extension state
    if (request.action === 'toggleDetection') {
      chrome.storage.sync.set({ enabled: request.enabled }, function() {
        // Send message to all tabs to update their state
        broadcastToTabs({ action: 'toggleDetection', enabled: request.enabled });
        sendResponse({ success: true });
      });
    }
    
    // Update highlight color
    if (request.action === 'updateHighlightColor') {
      chrome.storage.sync.set({ highlightColor: request.color }, function() {
        // Send message to all tabs to update highlight color
        broadcastToTabs({ action: 'updateHighlightColor', color: request.color });
        sendResponse({ success: true });
      });
    }
    
    // Update AI detection patterns
    if (request.action === 'updatePatterns') {
      chrome.storage.sync.set({ patterns: request.patterns }, function() {
        sendResponse({ success: true });
      });
    }
    
    // Get current settings
    if (request.action === 'getSettings') {
      chrome.storage.sync.get(['enabled', 'highlightColor', 'patterns'], function(result) {
        sendResponse(result);
      });
    }
    
    // Return true to indicate async response
    return true;
  });
  
  // Function to broadcast a message to all tabs
  function broadcastToTabs(message) {
    chrome.tabs.query({}, function(tabs) {
      for (let tab of tabs) {
        chrome.tabs.sendMessage(tab.id, message).catch(error => {
          // Ignore errors from tabs that don't have the content script running
          console.log(`Could not send message to tab ${tab.id}:`, error);
        });
      }
    });
  }