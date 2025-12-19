// Color presets - curated for highlighting
const COLOR_PRESETS = [
  { name: 'Light Yellow', color: '#fffde7' },
  { name: 'Peach', color: '#ffe4c4' },
  { name: 'Mint', color: '#e8f5e9' },
  { name: 'Sky', color: '#e3f2fd' },
  { name: 'Lavender', color: '#f3e5f5' },
  { name: 'Rose', color: '#fce4ec' },
  { name: 'Coral', color: '#ffccbc' },
  { name: 'Lime', color: '#f0f4c3' }
];

// DOM Elements
const detectionToggle = document.getElementById('detection-toggle');
const colorPicker = document.getElementById('color-picker');
const colorHex = document.getElementById('color-hex');
const colorPresetsContainer = document.getElementById('color-presets');
const opacitySlider = document.getElementById('opacity-slider');
const opacityValue = document.getElementById('opacity-value');
const styleOptions = document.querySelectorAll('.style-option');
const currentCountElement = document.getElementById('current-count');
const optionsBtn = document.getElementById('options-btn');
const rescanBtn = document.getElementById('rescan-btn');
const domainWarning = document.getElementById('domain-warning');

// Current settings
let currentColor = '#fffde7';
let currentOpacity = 100;
let currentStyle = 'background';

// Initialize popup
async function initPopup() {
  // Render color presets
  renderColorPresets();
  
  // Get current settings from storage
  try {
    const result = await chrome.storage.sync.get([
      'enabled',
      'highlightColor',
      'highlightStyle',
      'highlightOpacity',
      'excludedDomains'
    ]);
    
    // Set toggle state
    detectionToggle.checked = result.enabled !== false;
    
    // Set color
    if (result.highlightColor) {
      currentColor = result.highlightColor;
      updateColorUI(currentColor);
    }
    
    // Set opacity
    if (result.highlightOpacity !== undefined) {
      currentOpacity = result.highlightOpacity;
      opacitySlider.value = currentOpacity;
      opacityValue.textContent = `${currentOpacity}%`;
    }
    
    // Set style
    if (result.highlightStyle) {
      currentStyle = result.highlightStyle;
      updateStyleUI(currentStyle);
    }
    
    // Check if current domain is excluded
    if (result.excludedDomains && Array.isArray(result.excludedDomains)) {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs.length > 0) {
        try {
          const url = new URL(tabs[0].url);
          const currentDomain = url.hostname.replace('www.', '');
          const isExcluded = result.excludedDomains.some(d => 
            currentDomain.includes(d.replace('www.', '').toLowerCase())
          );
          if (isExcluded) {
            domainWarning.style.display = 'block';
          }
        } catch (e) {
          // Not a valid URL (like chrome:// pages)
        }
      }
    }
    
  } catch (error) {
    console.error('Error loading settings:', error);
  }
  
  // Get stats
  updateStats();
}

// Render color preset swatches
function renderColorPresets() {
  colorPresetsContainer.innerHTML = '';
  
  COLOR_PRESETS.forEach(preset => {
    const swatch = document.createElement('div');
    swatch.className = 'color-preset';
    swatch.style.backgroundColor = preset.color;
    swatch.title = preset.name;
    swatch.dataset.color = preset.color;
    
    if (preset.color.toLowerCase() === currentColor.toLowerCase()) {
      swatch.classList.add('selected');
    }
    
    swatch.addEventListener('click', () => selectPresetColor(preset.color));
    colorPresetsContainer.appendChild(swatch);
  });
}

// Select a preset color
function selectPresetColor(color) {
  currentColor = color;
  updateColorUI(color);
  saveColor(color);
}

// Update color UI elements
function updateColorUI(color) {
  colorPicker.value = color;
  colorHex.value = color.toUpperCase();
  
  // Update preset selection
  document.querySelectorAll('.color-preset').forEach(swatch => {
    swatch.classList.toggle('selected', 
      swatch.dataset.color.toLowerCase() === color.toLowerCase()
    );
  });
}

// Update style UI
function updateStyleUI(style) {
  styleOptions.forEach(option => {
    option.classList.toggle('selected', option.dataset.style === style);
  });
}

// Save color to storage and notify content script
async function saveColor(color) {
  await chrome.storage.sync.set({ highlightColor: color });
  
  // Notify background script
  chrome.runtime.sendMessage({
    action: 'updateHighlightColor',
    color: color
  });
  
  // Update active tab
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tabs.length > 0) {
    chrome.tabs.sendMessage(tabs[0].id, {
      action: 'updateHighlightColor',
      color: color
    }).catch(() => {});
  }
}

// Update stats from content script
async function updateStats() {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs.length > 0) {
      chrome.tabs.sendMessage(tabs[0].id, { action: 'getStats' }, response => {
        if (chrome.runtime.lastError) {
          currentCountElement.textContent = '—';
          return;
        }
        if (response && response.count !== undefined) {
          currentCountElement.textContent = response.count;
        } else {
          currentCountElement.textContent = '—';
        }
      });
    }
  } catch (error) {
    currentCountElement.textContent = '—';
  }
}

// Event Listeners

// Detection toggle
detectionToggle.addEventListener('change', async function() {
  const enabled = this.checked;
  
  await chrome.storage.sync.set({ enabled });
  
  chrome.runtime.sendMessage({
    action: 'toggleDetection',
    enabled
  });
  
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tabs.length > 0) {
    chrome.tabs.sendMessage(tabs[0].id, {
      action: 'toggleDetection',
      enabled
    }).catch(() => {});
  }
  
  // Update stats after a short delay
  setTimeout(updateStats, 300);
});

// Color picker change
colorPicker.addEventListener('input', function() {
  currentColor = this.value;
  updateColorUI(currentColor);
});

colorPicker.addEventListener('change', function() {
  saveColor(this.value);
});

// Hex input
colorHex.addEventListener('input', function() {
  let value = this.value;
  
  // Auto-add # if missing
  if (value && !value.startsWith('#')) {
    value = '#' + value;
  }
  
  // Validate hex format
  if (/^#[0-9A-Fa-f]{6}$/.test(value)) {
    currentColor = value;
    colorPicker.value = value;
    updateColorUI(value);
  }
});

colorHex.addEventListener('change', function() {
  let value = this.value;
  if (value && !value.startsWith('#')) {
    value = '#' + value;
    this.value = value;
  }
  
  if (/^#[0-9A-Fa-f]{6}$/.test(value)) {
    saveColor(value);
  }
});

// Opacity slider
opacitySlider.addEventListener('input', function() {
  currentOpacity = parseInt(this.value);
  opacityValue.textContent = `${currentOpacity}%`;
});

opacitySlider.addEventListener('change', async function() {
  const opacity = parseInt(this.value);
  
  await chrome.storage.sync.set({ highlightOpacity: opacity });
  
  chrome.runtime.sendMessage({
    action: 'updateHighlightOpacity',
    opacity
  });
  
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tabs.length > 0) {
    chrome.tabs.sendMessage(tabs[0].id, {
      action: 'updateHighlightOpacity',
      opacity
    }).catch(() => {});
  }
});

// Style options
styleOptions.forEach(option => {
  option.addEventListener('click', async function() {
    const style = this.dataset.style;
    currentStyle = style;
    updateStyleUI(style);
    
    await chrome.storage.sync.set({ highlightStyle: style });
    
    chrome.runtime.sendMessage({
      action: 'updateHighlightStyle',
      style
    });
    
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs.length > 0) {
      chrome.tabs.sendMessage(tabs[0].id, {
        action: 'updateHighlightStyle',
        style
      }).catch(() => {});
    }
  });
});

// Rescan button
rescanBtn.addEventListener('click', async function() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tabs.length > 0) {
    chrome.tabs.sendMessage(tabs[0].id, { action: 'rescan' }, response => {
      if (!chrome.runtime.lastError && response) {
        currentCountElement.textContent = response.count;
      }
    });
  }
});

// Options button
optionsBtn.addEventListener('click', function() {
  if (chrome.runtime.openOptionsPage) {
    chrome.runtime.openOptionsPage();
  } else {
    window.open(chrome.runtime.getURL('options.html'));
  }
});

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', initPopup);
