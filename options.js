// DOM Elements
const patternList = document.getElementById('pattern-list');
const addPatternBtn = document.getElementById('add-pattern');
const domainList = document.getElementById('domain-list');
const domainEmpty = document.getElementById('domain-empty');
const addDomainBtn = document.getElementById('add-domain');
const sensitivitySlider = document.getElementById('sensitivity-slider');
const sensitivityValue = document.getElementById('sensitivity-value');
const showBadgeToggle = document.getElementById('show-badge');
const saveBtn = document.getElementById('save-btn');
const resetBtn = document.getElementById('reset-btn');
const exportBtn = document.getElementById('export-btn');
const importFile = document.getElementById('import-file');
const toast = document.getElementById('toast');

// Current settings state
let patterns = [];
let excludedDomains = [];
let sensitivity = 1;
let showBadge = true;

// Initialize options page
async function init() {
  try {
    // First try to get settings from sync storage
    let result = await chrome.storage.sync.get(null);
    
    // If empty, try local storage
    if (!result || Object.keys(result).length === 0) {
      result = await chrome.storage.local.get(null);
    }
    
    // If still empty, get defaults from background
    if (!result || !result.patterns) {
      const defaults = await chrome.runtime.sendMessage({ action: 'getDefaults' });
      result = defaults;
    }
    
    // Apply settings
    if (result.patterns && Array.isArray(result.patterns)) {
      patterns = [...result.patterns];
    }
    
    if (result.excludedDomains && Array.isArray(result.excludedDomains)) {
      excludedDomains = [...result.excludedDomains];
    }
    
    if (result.sensitivity !== undefined) {
      sensitivity = result.sensitivity;
    }
    
    if (result.showBadge !== undefined) {
      showBadge = result.showBadge;
    }
    
    // Render UI
    renderPatterns();
    renderDomains();
    updateSensitivityUI();
    showBadgeToggle.checked = showBadge;
    
  } catch (error) {
    console.error('Error loading settings:', error);
    showToast('Error loading settings', 'error');
  }
}

// Render pattern list
function renderPatterns() {
  patternList.innerHTML = '';
  
  patterns.forEach((pattern, index) => {
    const li = document.createElement('li');
    li.className = 'pattern-item';
    
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'pattern-input';
    input.value = pattern;
    input.placeholder = 'Enter a pattern...';
    input.dataset.index = index;
    input.addEventListener('input', function() {
      patterns[parseInt(this.dataset.index)] = this.value;
    });
    
    const removeBtn = document.createElement('button');
    removeBtn.className = 'pattern-remove';
    removeBtn.textContent = '✕ Remove';
    removeBtn.dataset.index = index;
    removeBtn.addEventListener('click', function() {
      patterns.splice(parseInt(this.dataset.index), 1);
      renderPatterns();
    });
    
    li.appendChild(input);
    li.appendChild(removeBtn);
    patternList.appendChild(li);
  });
}

// Render domain list
function renderDomains() {
  domainList.innerHTML = '';
  
  if (excludedDomains.length === 0) {
    domainEmpty.style.display = 'block';
    return;
  }
  
  domainEmpty.style.display = 'none';
  
  excludedDomains.forEach((domain, index) => {
    const li = document.createElement('li');
    li.className = 'domain-item';
    
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'domain-input';
    input.value = domain;
    input.placeholder = 'example.com';
    input.dataset.index = index;
    input.addEventListener('input', function() {
      excludedDomains[parseInt(this.dataset.index)] = this.value;
    });
    
    const removeBtn = document.createElement('button');
    removeBtn.className = 'domain-remove';
    removeBtn.textContent = '✕ Remove';
    removeBtn.dataset.index = index;
    removeBtn.addEventListener('click', function() {
      excludedDomains.splice(parseInt(this.dataset.index), 1);
      renderDomains();
    });
    
    li.appendChild(input);
    li.appendChild(removeBtn);
    domainList.appendChild(li);
  });
}

// Update sensitivity UI
function updateSensitivityUI() {
  sensitivitySlider.value = sensitivity;
  sensitivityValue.textContent = sensitivity === 1 
    ? '1 pattern' 
    : `${sensitivity} patterns`;
}

// Add new pattern
function addPattern() {
  patterns.push('');
  renderPatterns();
  
  // Focus the newly added input
  const inputs = document.querySelectorAll('.pattern-input');
  if (inputs.length > 0) {
    inputs[inputs.length - 1].focus();
  }
}

// Add new domain
function addDomain() {
  excludedDomains.push('');
  renderDomains();
  
  // Focus the newly added input
  const inputs = document.querySelectorAll('.domain-input');
  if (inputs.length > 0) {
    inputs[inputs.length - 1].focus();
  }
}

// Save all settings
async function saveSettings() {
  try {
    // Clean up empty values
    const cleanPatterns = patterns.filter(p => p.trim() !== '');
    const cleanDomains = excludedDomains.filter(d => d.trim() !== '');
    
    const settings = {
      patterns: cleanPatterns,
      excludedDomains: cleanDomains,
      sensitivity,
      showBadge
    };
    
    // Save to both sync and local storage for redundancy
    await chrome.storage.sync.set(settings);
    await chrome.storage.local.set(settings);
    
    // Update local state
    patterns = cleanPatterns;
    excludedDomains = cleanDomains;
    
    // Re-render to remove empty items
    renderPatterns();
    renderDomains();
    
    // Notify background script of changes
    chrome.runtime.sendMessage({ action: 'updatePatterns', patterns: cleanPatterns });
    chrome.runtime.sendMessage({ action: 'updateExcludedDomains', domains: cleanDomains });
    chrome.runtime.sendMessage({ action: 'updateSensitivity', sensitivity });
    chrome.runtime.sendMessage({ action: 'updateShowBadge', showBadge });
    
    showToast('Settings saved successfully!', 'success');
  } catch (error) {
    console.error('Error saving settings:', error);
    showToast('Error saving settings', 'error');
  }
}

// Reset to defaults
async function resetToDefaults() {
  if (!confirm('Are you sure you want to reset all settings to defaults? This cannot be undone.')) {
    return;
  }
  
  try {
    const response = await chrome.runtime.sendMessage({ action: 'resetToDefaults' });
    
    if (response && response.settings) {
      patterns = [...response.settings.patterns];
      excludedDomains = [...response.settings.excludedDomains];
      sensitivity = response.settings.sensitivity;
      showBadge = response.settings.showBadge;
      
      renderPatterns();
      renderDomains();
      updateSensitivityUI();
      showBadgeToggle.checked = showBadge;
      
      showToast('Settings reset to defaults', 'success');
    }
  } catch (error) {
    console.error('Error resetting settings:', error);
    showToast('Error resetting settings', 'error');
  }
}

// Export settings to JSON file
async function exportSettings() {
  try {
    const result = await chrome.storage.sync.get(null);
    
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `botspotter-settings-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    
    URL.revokeObjectURL(url);
    showToast('Settings exported successfully!', 'success');
  } catch (error) {
    console.error('Error exporting settings:', error);
    showToast('Error exporting settings', 'error');
  }
}

// Import settings from JSON file
function importSettings(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = async function(e) {
    try {
      const settings = JSON.parse(e.target.result);
      
      // Validate imported settings
      if (!settings.patterns || !Array.isArray(settings.patterns)) {
        throw new Error('Invalid settings file: missing patterns');
      }
      
      // Save imported settings
      await chrome.storage.sync.set(settings);
      await chrome.storage.local.set(settings);
      
      // Reload page to apply changes
      showToast('Settings imported successfully! Reloading...', 'success');
      setTimeout(() => location.reload(), 1500);
      
    } catch (error) {
      console.error('Error importing settings:', error);
      showToast('Error importing settings: Invalid file format', 'error');
    }
  };
  
  reader.readAsText(file);
  event.target.value = ''; // Reset input
}

// Show toast notification
function showToast(message, type = 'success') {
  toast.textContent = message;
  toast.className = `toast ${type} show`;
  
  setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}

// Event Listeners
addPatternBtn.addEventListener('click', addPattern);
addDomainBtn.addEventListener('click', addDomain);

sensitivitySlider.addEventListener('input', function() {
  sensitivity = parseInt(this.value);
  updateSensitivityUI();
});

showBadgeToggle.addEventListener('change', function() {
  showBadge = this.checked;
});

saveBtn.addEventListener('click', saveSettings);
resetBtn.addEventListener('click', resetToDefaults);
exportBtn.addEventListener('click', exportSettings);
importFile.addEventListener('change', importSettings);

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', init);
