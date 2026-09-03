const STORAGE_KEY = 'savedGroups';
const MAX_SAVED_GROUPS = 200;

function requireInteger(value, name) {
  if (!Number.isInteger(value)) {
    throw new TypeError(`${name} must be an integer`);
  }
  return value;
}

function requireId(value) {
  const id = String(value ?? '').trim();
  if (!id) {
    throw new TypeError('savedGroupId is required');
  }
  return id;
}

function tabUrl(tab) {
  return String(tab.url || tab.pendingUrl || '').trim();
}

function sameSaveTarget(left, right) {
  return String(left.title ?? '').trim().toLowerCase() === String(right.title ?? '').trim().toLowerCase()
    && (left.color ?? 'grey') === (right.color ?? 'grey');
}

function memoryStorage() {
  const data = {};
  return {
    local: {
      async get(key) {
        return key in data ? {[key]: data[key]} : {};
      },
      async set(items) {
        Object.assign(data, items);
      },
    },
  };
}

export function createSavedGroupHandlers(chromeApi, {
  now = Date.now,
  createId = () => crypto.randomUUID(),
} = {}) {
  const storage = chromeApi.storage ?? memoryStorage();

  async function load() {
    const result = await storage.local.get(STORAGE_KEY);
    return Array.isArray(result[STORAGE_KEY]) ? result[STORAGE_KEY] : [];
  }

  async function save(savedGroups) {
    await storage.local.set({[STORAGE_KEY]: savedGroups.slice(0, MAX_SAVED_GROUPS)});
  }

  return {
    async listSavedGroups() {
      return (await load()).sort((left, right) => (
        (Number(right.savedAt) || 0) - (Number(left.savedAt) || 0)
      ));
    },

    async saveGroup({groupId} = {}) {
      groupId = requireInteger(groupId, 'groupId');
      const [group, tabs] = await Promise.all([
        chromeApi.tabGroups.get(groupId),
        chromeApi.tabs.query({groupId}),
      ]);
      const entry = {
        id: createId(),
        title: String(group.title ?? '').trim(),
        color: group.color ?? 'grey',
        savedAt: now(),
        tabs: tabs
          .slice()
          .sort((left, right) => left.index - right.index)
          .map(tab => ({title: tab.title ?? '', url: tabUrl(tab)}))
          .filter(tab => tab.url),
      };
      if (entry.tabs.length === 0) {
        throw new Error(`Tab group ${groupId} has no saveable tabs`);
      }

      // Saving the same title and color again replaces that entry so repeated
      // saves update one record instead of piling up duplicates.
      const existing = await load();
      const previous = existing.find(item => sameSaveTarget(item, entry));
      const rest = existing.filter(item => item !== previous);
      await save([{...entry, id: previous?.id ?? entry.id}, ...rest]);
      return entry;
    },

    async deleteSavedGroup({savedGroupId} = {}) {
      const id = requireId(savedGroupId);
      const existing = await load();
      const remaining = existing.filter(item => item.id !== id);
      if (remaining.length === existing.length) {
        throw new Error('That saved tab group no longer exists');
      }

      await save(remaining);
      return {savedGroupId: id};
    },

    async openSavedGroup({savedGroupId} = {}) {
      const id = requireId(savedGroupId);
      const entry = (await load()).find(item => item.id === id);
      if (!entry) {
        throw new Error('That saved tab group no longer exists');
      }

      const tabIds = [];
      for (const tab of entry.tabs) {
        const created = await chromeApi.tabs.create({url: tab.url, active: false});
        if (Number.isInteger(created?.id)) {
          tabIds.push(created.id);
        }
      }
      if (tabIds.length === 0) {
        throw new Error('No tabs could be reopened for this saved tab group');
      }

      const groupId = await chromeApi.tabs.group({tabIds});
      const group = await chromeApi.tabGroups.update(groupId, {
        title: entry.title,
        color: entry.color,
      });
      const firstTab = await chromeApi.tabs.get(tabIds[0]);
      if (Number.isInteger(firstTab?.windowId)) {
        await chromeApi.windows.update(firstTab.windowId, {focused: true});
      }
      await chromeApi.tabs.update(tabIds[0], {active: true});
      return group;
    },
  };
}
