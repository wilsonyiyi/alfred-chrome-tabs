function run() {
  const chrome = Application('Google Chrome');

  if (!chrome.running()) {
    return JSON.stringify({running: false, tabs: []});
  }

  const titlesByWindow = chrome.windows.tabs.title();
  const urlsByWindow = chrome.windows.tabs.url();
  const tabs = [];

  for (let windowIndex = 0; windowIndex < titlesByWindow.length; windowIndex += 1) {
    const titles = titlesByWindow[windowIndex];
    const urls = urlsByWindow[windowIndex];

    for (let tabIndex = 0; tabIndex < titles.length; tabIndex += 1) {
      tabs.push({
        windowIndex,
        tabIndex,
        title: titles[tabIndex],
        url: urls[tabIndex],
      });
    }
  }

  return JSON.stringify({running: true, tabs});
}
