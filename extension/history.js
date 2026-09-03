const HISTORY_PERMISSION = 'history';
const DEFAULT_HISTORY_DAYS = 365;
const DEFAULT_MAX_RESULTS = 50;
const MAX_RESULTS = 100;

function permissionRequiredError() {
  const error = new Error('Enable History Search from the Chrome Tabs extension popup.');
  error.code = 'HISTORY_PERMISSION_REQUIRED';
  return error;
}

function requireUrl(url) {
  if (typeof url !== 'string' || !url.trim()) {
    throw new TypeError('url is required');
  }

  return url.trim();
}

function boundedMaxResults(value) {
  const number = Number(value ?? DEFAULT_MAX_RESULTS);
  if (!Number.isFinite(number)) {
    return DEFAULT_MAX_RESULTS;
  }

  return Math.min(MAX_RESULTS, Math.max(1, Math.trunc(number)));
}

export function createHistoryHandlers(chromeApi, {now = Date.now} = {}) {
  return {
    async searchHistory({text = '', startTime, maxResults} = {}) {
      const granted = await chromeApi.permissions.contains({permissions: [HISTORY_PERMISSION]});
      if (!granted) {
        throw permissionRequiredError();
      }

      const earliestVisit = Number.isFinite(Number(startTime))
        ? Number(startTime)
        : now() - DEFAULT_HISTORY_DAYS * 24 * 60 * 60 * 1000;
      const results = await chromeApi.history.search({
        text: String(text).trim(),
        startTime: earliestVisit,
        maxResults: boundedMaxResults(maxResults),
      });

      return results.map(item => ({
        id: item.id,
        title: item.title ?? '',
        url: item.url ?? '',
        lastVisitTime: item.lastVisitTime ?? 0,
        typedCount: item.typedCount ?? 0,
        visitCount: item.visitCount ?? 0,
      }));
    },

    async openHistoryItem({url, forceNew = false} = {}) {
      url = requireUrl(url);

      if (!forceNew) {
        const tabs = await chromeApi.tabs.query({});
        const existingTab = tabs.find(tab => tab.url === url);
        if (Number.isInteger(existingTab?.id) && Number.isInteger(existingTab?.windowId)) {
          await chromeApi.windows.update(existingTab.windowId, {focused: true});
          await chromeApi.tabs.update(existingTab.id, {active: true});
          return {tabId: existingTab.id, reused: true};
        }
      }

      const tab = await chromeApi.tabs.create({url});
      return {tabId: tab.id, reused: false};
    },
  };
}
