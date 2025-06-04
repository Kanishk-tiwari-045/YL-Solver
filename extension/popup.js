document.addEventListener('DOMContentLoaded', function() {
  const processBtn = document.getElementById('processBtn');
  const statusDiv = document.getElementById('status');

  processBtn.addEventListener('click', async function() {
    try {
      // Get current tab URL
      const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
      const url = tab.url;

      // Validate URL
      if (!isValidUrl(url)) {
        showStatus('Please navigate to a YouTube video or LeetCode problem', 'error');
        return;
      }

      showStatus('Processing... This may take a few minutes', 'processing');
      
      // Send to backend
      const response = await fetch('http://localhost:3000/api/process', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: url })
      });

      const result = await response.json();
      
      if (response.ok) {
        showStatus('Processing started! You will receive an email in ~5 minutes', 'success');
      } else {
        showStatus(`Error: ${result.error}`, 'error');
      }
    } catch (error) {
      showStatus(`Network error: ${error.message}`, 'error');
    }
  });

  function isValidUrl(url) {
    return url.includes('youtube.com/watch') || url.includes('leetcode.com/problems/');
  }

  function showStatus(message, type) {
    statusDiv.textContent = message;
    statusDiv.className = `status ${type}`;
  }
});
