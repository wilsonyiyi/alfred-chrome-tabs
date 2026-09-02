function run(argv) {
  const windowIndex = Number(argv[0]);
  const tabIndex = Number(argv[1]);
  const chrome = Application('Google Chrome');
  const browserWindow = chrome.windows()[windowIndex];

  if (!browserWindow) {
    throw new Error(`Chrome window ${windowIndex} no longer exists`);
  }

  if (!browserWindow.tabs()[tabIndex]) {
    throw new Error(`Chrome tab ${tabIndex} no longer exists`);
  }

  browserWindow.activeTabIndex = tabIndex + 1;
  browserWindow.index = 1;
  chrome.activate();
}
