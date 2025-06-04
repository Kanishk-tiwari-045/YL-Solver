// Content script to extract page data if needed
function extractYouTubeData() {
  const title = document.querySelector('h1.title')?.textContent || '';
  const description = document.querySelector('#description')?.textContent || '';
  return { title, description };
}

function extractLeetCodeData() {
  const title = document.querySelector('[data-cy="question-title"]')?.textContent || '';
  const description = document.querySelector('.content__u3I1')?.textContent || '';
  return { title, description };
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'extractData') {
    let data = {};
    if (window.location.href.includes('youtube.com')) {
      data = extractYouTubeData();
    } else if (window.location.href.includes('leetcode.com')) {
      data = extractLeetCodeData();
    }
    sendResponse(data);
  }
});
