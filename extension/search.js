import {createHistoryHandlers} from './history.js';
import {createTabGroupHandlers} from './tab-groups.js';

function requireInteger(value, name) {
  if (!Number.isInteger(value)) {
    throw new TypeError(`${name} must be an integer`);
  }
  return value;
}

function mapTab(tab, groupTitleById, noneGroupId) {
  const grouped = Number.isInteger(tab.groupId) && tab.groupId !== noneGroupId;
  return {
    id: tab.id,
    title: tab.title ?? '',
    url: tab.url ?? '',
    active: Boolean(tab.active),
    windowId: tab.windowId,
    index: tab.index,
    groupId: grouped ? tab.groupId : undefined,
    groupTitle: grouped ? (groupTitleById.get(tab.groupId) ?? '') : '',
  };
}

export function createSearchHandlers(chromeApi, {now = Date.now} = {}) {
  const groupHandlers = createTabGroupHandlers(chromeApi);
  const historyHandlers = createHistoryHandlers(chromeApi, {now});
  const noneGroupId = chromeApi.tabGroups?.TAB_GROUP_ID_NONE ?? -1;

  return {
    async searchAll({text = '', maxResults, includeHistory = false} = {}) {
      const [rawTabs, groups] = await Promise.all([
        chromeApi.tabs.query({}),
        groupHandlers.listGroups(),
      ]);
      const groupTitleById = new Map(groups.map(group => [group.id, group.title ?? '']));
      const tabs = rawTabs
        .map(tab => mapTab(tab, groupTitleById, noneGroupId))
        .sort((left, right) => (
          left.windowId - right.windowId || left.index - right.index
        ));

      if (!includeHistory) {
        return {tabs, groups, history: [], historyStatus: 'skipped'};
      }

      try {
        const history = await historyHandlers.searchHistory({text, maxResults});
        return {tabs, groups, history, historyStatus: 'ok'};
      } catch (error) {
        if (error.code === 'HISTORY_PERMISSION_REQUIRED') {
          return {tabs, groups, history: [], historyStatus: 'permission-required'};
        }
        throw error;
      }
    },

    async focusTab({tabId} = {}) {
      tabId = requireInteger(tabId, 'tabId');
      const tab = await chromeApi.tabs.get(tabId);
      if (!Number.isInteger(tab?.id) || !Number.isInteger(tab?.windowId)) {
        throw new Error(`Chrome tab ${tabId} no longer exists`);
      }

      await chromeApi.windows.update(tab.windowId, {focused: true});
      await chromeApi.tabs.update(tab.id, {active: true});
      return tab;
    },
  };
}
