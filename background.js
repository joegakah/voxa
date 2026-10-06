chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({ id: "voxa-read", title: "Read aloud with Voxa", contexts: ["selection"] });
});

chrome.action.onClicked.addListener(() => chrome.runtime.openOptionsPage());

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== "voxa-read" || !tab) return;
  chrome.tabs
    .sendMessage(tab.id, { type: "read-text", text: info.selectionText }, { frameId: info.frameId || 0 })
    .catch(() => {});
});

chrome.commands.onCommand.addListener(async (cmd) => {
  if (cmd !== "read-selection") return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab) chrome.tabs.sendMessage(tab.id, { type: "read-selection" }).catch(() => {});
});

chrome.runtime.onMessage.addListener((msg, _sender, send) => {
  if (msg.type === "detect") {
    chrome.i18n.detectLanguage(msg.text, (r) => {
      const top = r && r.languages && r.languages[0];
      send({ lang: top ? top.language : null, reliable: !!(r && r.isReliable) });
    });
    return true;
  }
});
