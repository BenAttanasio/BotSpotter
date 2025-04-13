// DOM Elements
const detectionToggle = document.getElementById('detection-toggle');
const colorPicker = document.getElementById('color-picker');
const optionsBtn = document.getElementById('options-btn');
const currentCountElement = document.getElementById('current-count');

// Initialize popup
function initPopup() {
  // Get current settings from storage
  chrome.storage.sync.get(['enabled', 'highlightColor'], function(result) {
    // Set toggle state
    if (result.enabled !== undefined) {
      detectionToggle.checked = result.enabled;
    }
    
    // Set color picker value
    if (result.highlightColor) {
      colorPicker.value = hexColor(result.highlightColor);
    }
  });
  
  // Get stats from current active tab
  updateStats();
}

// Convert any color to hex format
function hexColor(color) {
  // If already hex, return as is
  if (color.startsWith('#')) {
    return color;
  }
  
  // For named colors like "yellow", create a temporary element to get hex
  const temp = document.createElement('div');
  temp.style.color = color;
  document.body.appendChild(temp);
  const computedColor = getComputedStyle(temp).color;
  document.body.removeChild(temp);
  
  // Convert rgb to hex
  if (computedColor.startsWith('rgb')) {
    const rgb = computedColor.match(/\d+/g);
    if (rgb && rgb.length >= 3) {
      return `#${parseInt(rgb[0]).toString(16).padStart(2, '0')}${parseInt(rgb[1]).toString(16).padStart(2, '0')}${parseInt(rgb[2]).toString(16).padStart(2, '0')}`;
    }
  }
  
  return color;
}

// Update detection statistics
function updateStats() {
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    if (tabs.length > 0) {
      chrome.tabs.sendMessage(tabs[0].id, {action: "getStats"}, function(response) {
        if (response && response.count !== undefined) {
          currentCountElement.textContent = response.count;
        } else {
          currentCountElement.textContent = "N/A";
        }
      });
    }
  });
}

// Event Listeners
detectionToggle.addEventListener('change', function() {
  const enabled = this.checked;
  
  // Save to storage
  chrome.storage.sync.set({enabled: enabled});
  
  // Send message to background and content scripts
  chrome.runtime.sendMessage({
    action: 'toggleDetection',
    enabled: enabled
  });
  
  // Update active tab
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    if (tabs.length > 0) {
      chrome.tabs.sendMessage(tabs[0].id, {
        action: 'toggleDetection',
        enabled: enabled
      });
    }
  });
});

colorPicker.addEventListener('change', function() {
  const color = this.value;
  
  // Save to storage
  chrome.storage.sync.set({highlightColor: color});
  
  // Send message to background and content scripts
  chrome.runtime.sendMessage({
    action: 'updateHighlightColor',
    color: color
  });
  
  // Update active tab
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    if (tabs.length > 0) {
      chrome.tabs.sendMessage(tabs[0].id, {
        action: 'updateHighlightColor',
        color: color
      });
    }
  });
});

optionsBtn.addEventListener('click', function() {
  if (chrome.runtime.openOptionsPage) {
    chrome.runtime.openOptionsPage();
  } else {
    window.open(chrome.runtime.getURL('options.html'));
  }
});

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', initPopup);