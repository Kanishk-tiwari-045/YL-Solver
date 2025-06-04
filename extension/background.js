chrome.runtime.onInstalled.addListener(() => {
  console.log('YouTube LeetCode Solver extension installed');
});

// Listen for tab updates to detect YouTube/LeetCode pages
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    if (tab.url.includes('youtube.com/watch') || tab.url.includes('leetcode.com/problems/')) {
      // Show page action for relevant pages
      chrome.action.setIcon({
        tabId: tabId,
        path: {
          "16": "icon16.png"
        }
      });
    }
  }
});
