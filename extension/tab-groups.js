const GROUP_COLORS = new Set([
  'grey',
  'blue',
  'red',
  'yellow',
  'green',
  'pink',
  'purple',
  'cyan',
  'orange',
]);

function requireInteger(value, name) {
  if (!Number.isInteger(value)) {
    throw new TypeError(`${name} must be an integer`);
  }
  return value;
}

function requireTitle(value) {
  const title = String(value ?? '').trim();
  if (!title) {
    throw new TypeError('title is required');
  }
  return title;
}

function requireColor(value) {
  if (!GROUP_COLORS.has(value)) {
    throw new TypeError(`Unsupported group color: ${value}`);
  }
  return value;
}

async function activeTab(chromeApi) {
  const [tab] = await chromeApi.tabs.query({active: true, lastFocusedWindow: true});
  if (!Number.isInteger(tab?.id)) {
    throw new Error('No active Chrome tab was found');
  }
  return tab;
}

export function createTabGroupHandlers(chromeApi) {
  return {
    async ping() {
      return {ready: true};
    },

    async listGroups() {
      const [groups, tabs] = await Promise.all([
        chromeApi.tabGroups.query({}),
        chromeApi.tabs.query({}),
      ]);
      const tabsByGroup = new Map();

      for (const tab of tabs) {
        if (tab.groupId === chromeApi.tabGroups.TAB_GROUP_ID_NONE) {
          continue;
        }
        const groupTabs = tabsByGroup.get(tab.groupId) ?? [];
        groupTabs.push({
          id: tab.id,
          index: tab.index,
          title: tab.title ?? '',
          url: tab.url ?? '',
          active: Boolean(tab.active),
        });
        tabsByGroup.set(tab.groupId, groupTabs);
      }

      return groups.map(group => {
        const groupTabs = (tabsByGroup.get(group.id) ?? []).sort((left, right) => (
          left.index - right.index
        ));
        return {
          ...group,
          index: groupTabs[0]?.index ?? -1,
          tabCount: groupTabs.length,
          tabs: groupTabs,
        };
      }).sort((left, right) => (
        left.windowId - right.windowId || left.index - right.index
      ));
    },

    async focusGroup({groupId}) {
      groupId = requireInteger(groupId, 'groupId');
      const group = await chromeApi.tabGroups.get(groupId);
      const tabs = await chromeApi.tabs.query({groupId});
      const tab = tabs.find(candidate => candidate.active) ?? tabs[0];
      if (!tab?.id) {
        throw new Error(`Tab group ${groupId} has no tabs`);
      }
      await chromeApi.windows.update(group.windowId, {focused: true});
      await chromeApi.tabs.update(tab.id, {active: true});
      return group;
    },

    async createGroup({title, color = 'grey'}) {
      const tab = await activeTab(chromeApi);
      const groupId = await chromeApi.tabs.group({tabIds: tab.id});
      return chromeApi.tabGroups.update(groupId, {
        title: requireTitle(title),
        color: requireColor(color),
      });
    },

    async renameGroup({groupId, title}) {
      return chromeApi.tabGroups.update(
        requireInteger(groupId, 'groupId'),
        {title: requireTitle(title)},
      );
    },

    async setGroupColor({groupId, color}) {
      return chromeApi.tabGroups.update(
        requireInteger(groupId, 'groupId'),
        {color: requireColor(color)},
      );
    },

    async setGroupCollapsed({groupId, collapsed = 'toggle'}) {
      groupId = requireInteger(groupId, 'groupId');
      const group = await chromeApi.tabGroups.get(groupId);
      const nextCollapsed = collapsed === 'toggle' ? !group.collapsed : Boolean(collapsed);
      return chromeApi.tabGroups.update(groupId, {collapsed: nextCollapsed});
    },

    async addCurrentTab({groupId}) {
      groupId = requireInteger(groupId, 'groupId');
      const [group, tab] = await Promise.all([
        chromeApi.tabGroups.get(groupId),
        activeTab(chromeApi),
      ]);
      if (tab.windowId !== group.windowId) {
        await chromeApi.tabs.move(tab.id, {windowId: group.windowId, index: -1});
      }
      await chromeApi.tabs.group({tabIds: tab.id, groupId});
      return chromeApi.tabGroups.get(groupId);
    },

    async removeCurrentTab() {
      const tab = await activeTab(chromeApi);
      if (tab.groupId === chromeApi.tabGroups.TAB_GROUP_ID_NONE) {
        throw new Error('The active tab is not in a tab group');
      }
      await chromeApi.tabs.ungroup(tab.id);
      return {tabId: tab.id};
    },

    async moveGroup({groupId, windowId, index = -1}) {
      return chromeApi.tabGroups.move(
        requireInteger(groupId, 'groupId'),
        {
          windowId: requireInteger(windowId, 'windowId'),
          index: requireInteger(index, 'index'),
        },
      );
    },

    async ungroupGroup({groupId}) {
      groupId = requireInteger(groupId, 'groupId');
      const tabs = await chromeApi.tabs.query({groupId});
      if (tabs.length === 0) {
        throw new Error(`Tab group ${groupId} has no tabs`);
      }
      await chromeApi.tabs.ungroup(tabs.map(tab => tab.id));
      return {groupId, tabCount: tabs.length};
    },

    async closeGroup({groupId}) {
      groupId = requireInteger(groupId, 'groupId');
      const tabs = await chromeApi.tabs.query({groupId});
      if (tabs.length === 0) {
        throw new Error(`Tab group ${groupId} has no tabs`);
      }
      await chromeApi.tabs.remove(tabs.map(tab => tab.id));
      return {groupId, tabCount: tabs.length};
    },
  };
}
