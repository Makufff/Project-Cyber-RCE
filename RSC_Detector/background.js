// background.js - Responsible for managing icon state

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    // Receive alert signal from content.js
    if (request.action === "update_badge" && sender.tab) {
        // Set red background color
        chrome.action.setBadgeBackgroundColor({
            tabId: sender.tab.id,
            color: "#FF0000"
        });
        // Set text to "!"
        chrome.action.setBadgeText({
            tabId: sender.tab.id,
            text: "!"
        });
    }
});