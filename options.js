// DOM elements
const patternList = document.getElementById('pattern-list');
const addPatternBtn = document.getElementById('add-pattern');
const saveBtn = document.getElementById('save-btn');
const statusEl = document.getElementById('status');

// Current patterns
let patterns = [];

// Initialize options page
function init() {
  // Get current patterns from storage
  chrome.storage.sync.get(['patterns'], function(result) {
    if (result.patterns && Array.isArray(result.patterns)) {
      patterns = result.patterns;
      renderPatterns();
    }
  });
}

// Render the pattern list
function renderPatterns() {
  // Clear current list
  patternList.innerHTML = '';
  
  // Add each pattern
  patterns.forEach((pattern, index) => {
    const li = document.createElement('li');
    li.className = 'pattern-item';
    
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'pattern-input';
    input.value = pattern;
    input.dataset.index = index;
    input.addEventListener('input', function() {
      patterns[this.dataset.index] = this.value;
    });
    
    const removeBtn = document.createElement('button');
    removeBtn.className = 'pattern-remove';
    removeBtn.textContent = 'Remove';
    removeBtn.dataset.index = index;
    removeBtn.addEventListener('click', function() {
      removePattern(parseInt(this.dataset.index));
    });
    
    li.appendChild(input);
    li.appendChild(removeBtn);
    patternList.appendChild(li);
  });
}

// Add a new pattern
function addPattern() {
  patterns.push('');
  renderPatterns();
  
  // Focus the newly added input
  const inputs = document.querySelectorAll('.pattern-input');
  if (inputs.length > 0) {
    inputs[inputs.length - 1].focus();
  }
}

// Remove a pattern
function removePattern(index) {
  patterns.splice(index, 1);
  renderPatterns();
}

// Save patterns to storage
function savePatterns() {
  // Filter out empty patterns
  const filteredPatterns = patterns.filter(pattern => pattern.trim() !== '');
  
  chrome.storage.sync.set({patterns: filteredPatterns}, function() {
    // Show success message
    showStatus('Settings saved successfully!', 'success');
    
    // Update pattern list in case empty ones were removed
    patterns = filteredPatterns;
    renderPatterns();
  });
}

// Show status message
function showStatus(message, type) {
  statusEl.textContent = message;
  statusEl.className = `status ${type}`;
  statusEl.style.display = 'block';
  
  // Hide status after 3 seconds
  setTimeout(() => {
    statusEl.style.display = 'none';
  }, 3000);
}

// Event listeners
addPatternBtn.addEventListener('click', addPattern);
saveBtn.addEventListener('click', savePatterns);

// Initialize options when DOM is loaded
document.addEventListener('DOMContentLoaded', init);