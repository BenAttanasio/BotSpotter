// Default settings - single source of truth
const DEFAULT_SETTINGS = {
  enabled: true,
  highlightColor: '#fffde7', // Subtle light yellow
  highlightStyle: 'background', // 'background', 'border', 'underline'
  highlightOpacity: 100,
  patterns: [
    "isn't just about",
    "—it's about",
    "more than just",
    "; it's a",
    "it's important to",
    "dive into",
    "delve into",
    "in today's world",
    "landscape",
    "navigate",
    "foster",
    "leverage",
    "in conclusion",
    "it's worth noting",
    "I cannot and will not",
    "boundaries",
    "I cannot provide",
    "I cannot assist"
  ],
  excludedDomains: [],
  showBadge: true,
  sensitivity: 1 // Number of patterns required to trigger (1 = any match)
};

// Initialize settings - runs on install AND on startup to ensure settings exist
async function initializeSettings(isInstall = false) {
  try {
    const result = await chrome.storage.sync.get(null);
    
    // Check if settings need to be initialized or migrated
    const needsInit = isInstall || !result.hasOwnProperty('enabled');
    
    if (needsInit) {
      // Merge existing settings with defaults (preserves user customizations on update)
      const settings = { ...DEFAULT_SETTINGS };
      
      // Keep any existing custom patterns if this is an update
      if (result.patterns && Array.isArray(result.patterns) && result.patterns.length > 0) {
        settings.patterns = result.patterns;
      }
      
      // Keep existing color if set
      if (result.highlightColor) {
        settings.highlightColor = result.highlightColor;
      }
      
      await chrome.storage.sync.set(settings);
      console.log('BotSpotter: Settings initialized/updated');
    }
    
    return true;
  } catch (error) {
    console.error('BotSpotter: Error initializing settings:', error);
    // Try local storage as fallback
    try {
      await chrome.storage.local.set(DEFAULT_SETTINGS);
      console.log('BotSpotter: Using local storage fallback');
      return true;
    } catch (localError) {
      console.error('BotSpotter: Local storage fallback failed:', localError);
      return false;
    }
  }
}

// Get settings with fallback chain
async function getSettings() {
  try {
    let result = await chrome.storage.sync.get(null);
    
    // If sync storage is empty, try local
    if (!result || Object.keys(result).length === 0) {
      result = await chrome.storage.local.get(null);
    }
    
    // Merge with defaults to ensure all keys exist
    return { ...DEFAULT_SETTINGS, ...result };
  } catch (error) {
    console.error('BotSpotter: Error getting settings:', error);
    return DEFAULT_SETTINGS;
  }
}

// Save settings with sync and local backup
async function saveSettings(settings) {
  try {
    await chrome.storage.sync.set(settings);
    // Also save to local as backup
    await chrome.storage.local.set(settings);
    return true;
  } catch (error) {
    console.error('BotSpotter: Error saving to sync storage:', error);
    try {
      await chrome.storage.local.set(settings);
      return true;
    } catch (localError) {
      console.error('BotSpotter: Error saving to local storage:', localError);
      return false;
    }
  }
}

// Initialize on extension install
chrome.runtime.onInstalled.addListener(async (details) => {
  await initializeSettings(details.reason === 'install');
});

// Also check settings on startup (handles cases where storage was cleared)
chrome.runtime.onStartup.addListener(async () => {
  await initializeSettings(false);
});

// Listen for messages from popup or content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  handleMessage(request, sender, sendResponse);
  return true; // Keep channel open for async response
});

async function handleMessage(request, sender, sendResponse) {
  switch (request.action) {
    case 'toggleDetection': {
      const success = await saveSettings({ enabled: request.enabled });
      broadcastToTabs({ action: 'toggleDetection', enabled: request.enabled });
      sendResponse({ success });
      break;
    }
    
    case 'updateHighlightColor': {
      const success = await saveSettings({ highlightColor: request.color });
      broadcastToTabs({ action: 'updateHighlightColor', color: request.color });
      sendResponse({ success });
      break;
    }
    
    case 'updateHighlightStyle': {
      const success = await saveSettings({ highlightStyle: request.style });
      broadcastToTabs({ action: 'updateHighlightStyle', style: request.style });
      sendResponse({ success });
      break;
    }
    
    case 'updateHighlightOpacity': {
      const success = await saveSettings({ highlightOpacity: request.opacity });
      broadcastToTabs({ action: 'updateHighlightOpacity', opacity: request.opacity });
      sendResponse({ success });
      break;
    }
    
    case 'updatePatterns': {
      const success = await saveSettings({ patterns: request.patterns });
      broadcastToTabs({ action: 'updatePatterns', patterns: request.patterns });
      sendResponse({ success });
      break;
    }
    
    case 'updateExcludedDomains': {
      const success = await saveSettings({ excludedDomains: request.domains });
      sendResponse({ success });
      break;
    }
    
    case 'updateSensitivity': {
      const success = await saveSettings({ sensitivity: request.sensitivity });
      broadcastToTabs({ action: 'updateSensitivity', sensitivity: request.sensitivity });
      sendResponse({ success });
      break;
    }
    
    case 'updateShowBadge': {
      const success = await saveSettings({ showBadge: request.showBadge });
      broadcastToTabs({ action: 'updateShowBadge', showBadge: request.showBadge });
      sendResponse({ success });
      break;
    }
    
    case 'getSettings': {
      const settings = await getSettings();
      sendResponse(settings);
      break;
    }
    
    case 'getDefaults': {
      sendResponse(DEFAULT_SETTINGS);
      break;
    }
    
    case 'resetToDefaults': {
      const success = await saveSettings(DEFAULT_SETTINGS);
      broadcastToTabs({ action: 'settingsReset', settings: DEFAULT_SETTINGS });
      sendResponse({ success, settings: DEFAULT_SETTINGS });
      break;
    }
    
    default:
      sendResponse({ error: 'Unknown action' });
  }
}

// Function to broadcast a message to all tabs
function broadcastToTabs(message) {
  chrome.tabs.query({}, (tabs) => {
    for (const tab of tabs) {
      chrome.tabs.sendMessage(tab.id, message).catch(() => {
        // Ignore errors from tabs that don't have the content script
      });
    }
  });
}
