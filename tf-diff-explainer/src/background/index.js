// Service worker — sets default storage on first install
chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === 'install') {
    chrome.storage.local.set({
      enabled: true,
      disabledHosts: [],
      apiKey: null,
    });
  }
});
