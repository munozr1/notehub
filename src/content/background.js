chrome.runtime.onInstalled.addListener(() => {
  chrome.scripting.registerContentScripts([{
    id: "session-script",
    js: ["./src/content/notion.js"],
    persistAcrossSessions: false,
    matches: ["https://www.notion.so/*"],
    runAt: "document_end",
  }])
  .then(() => console.log("Content script registration complete"))
  .catch((err) => console.warn("Unexpected error", err));
});

