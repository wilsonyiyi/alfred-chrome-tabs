import {buildGroupItems} from './group-items.js';
import {buildHistoryItems} from './history-items.js';

const SCOPE_ALIASES = Object.freeze({
  t: 'tabs',
  tab: 'tabs',
  tabs: 'tabs',
  g: 'groups',
  group: 'groups',
  groups: 'groups',
  h: 'history',
  history: 'history',
});

function normalizeText(value) {
  return String(value ?? '')
    .replace(/[\u200B-\u200D\u2060-\u206F\uFEFF]/gu, '')
    .trim();
}

function displayUrl(url) {
  return normalizeText(url)
    .replace(/^https?:\/\//u, '')
    .replace(/\/$/u, '');
}

function canonicalUrl(url) {
  return normalizeText(url).replace(/\/$/u, '');
}

function matchesQuery(haystack, query) {
  const terms = query.toLowerCase().split(/\s+/u).filter(Boolean);
  const searchable = haystack.toLowerCase();
  return terms.every(term => searchable.includes(term));
}

function groupTitle(tab) {
  return normalizeText(tab.groupTitle) || (tab.groupId == null ? '' : 'Untitled group');
}

function includesHistory(scope) {
  return scope === 'all' || scope === 'history';
}

function includesTabs(scope) {
  return scope === 'all' || scope === 'tabs';
}

function includesGroups(scope) {
  return scope === 'all' || scope === 'groups';
}

export function parseSearchQuery(input) {
  const raw = String(input ?? '');
  const match = /^(tabs?|t|groups?|g|history|h)\s*:\s*(.*)$/iu.exec(raw.trimStart());
  if (!match) {
    return {scope: 'all', query: raw.trim()};
  }

  return {
    scope: SCOPE_ALIASES[match[1].toLowerCase()],
    query: match[2].trim(),
  };
}

function sortTabs(tabs) {
  return [...tabs].sort((left, right) => {
    const activeDelta = Number(Boolean(right.active)) - Number(Boolean(left.active));
    if (activeDelta !== 0) {
      return activeDelta;
    }

    const windowLeft = left.windowId ?? left.windowIndex ?? 0;
    const windowRight = right.windowId ?? right.windowIndex ?? 0;
    if (windowLeft !== windowRight) {
      return windowLeft - windowRight;
    }

    return (left.index ?? left.tabIndex ?? 0) - (right.index ?? right.tabIndex ?? 0);
  });
}

function tabAction(tab) {
  if (Number.isInteger(tab.id)) {
    return {method: 'focusTab', params: {tabId: tab.id}};
  }

  return {
    method: 'focusTabByIndex',
    params: {windowIndex: tab.windowIndex, tabIndex: tab.tabIndex},
  };
}

function buildUnifiedTabItems(tabs, query) {
  return sortTabs(tabs)
    .filter(tab => matchesQuery(
      [normalizeText(tab.title), displayUrl(tab.url), groupTitle(tab)].join(' '),
      query,
    ))
    .map(tab => {
      const title = normalizeText(tab.title) || 'Untitled tab';
      const windowLabel = `Window ${tab.windowId ?? (Number(tab.windowIndex) + 1)}`;
      const subtitle = [
        'Tab',
        tab.active ? 'Active' : undefined,
        displayUrl(tab.url),
        windowLabel,
        groupTitle(tab) || undefined,
      ].filter(Boolean).join(' · ');

      return {
        title,
        subtitle,
        arg: JSON.stringify(tabAction(tab)),
      };
    });
}

function buildUnifiedGroupItems(groups, query) {
  const matched = groups.filter(group => matchesQuery(
    [
      normalizeText(group.title) || 'Untitled group',
      group.color,
      ...(group.tabs ?? []).map(tab => tab.title),
    ].join(' '),
    query,
  ));

  return buildGroupItems(matched).map(item => ({
    ...item,
    subtitle: `Group · ${item.subtitle}`,
  }));
}

function buildUnifiedHistoryItems(historyItems, {query, openUrls, dedupeOpenTabs, now}) {
  const filtered = historyItems.filter(item => {
    if (typeof item.url !== 'string' || !item.url) {
      return false;
    }
    if (dedupeOpenTabs && openUrls.has(canonicalUrl(item.url))) {
      return false;
    }
    return matchesQuery(`${normalizeText(item.title)} ${displayUrl(item.url)}`, query);
  });

  return buildHistoryItems(filtered, {now}).map(item => ({
    ...item,
    subtitle: `History · ${item.subtitle}`,
  }));
}

function permissionItem() {
  return {
    title: 'Enable Chrome History Search',
    subtitle: 'Open the Chrome Tabs extension popup and click Enable.',
    valid: false,
  };
}

function emptyItem(scope, query) {
  if (!query) {
    if (scope === 'history') {
      return {
        title: 'No Chrome history found',
        subtitle: 'Try a different title or URL.',
        valid: false,
      };
    }
    if (scope === 'groups') {
      return {
        title: 'No Chrome tab groups found',
        valid: false,
      };
    }
    if (scope === 'tabs') {
      return {
        title: 'No Chrome tabs found',
        valid: false,
      };
    }
    return {
      title: 'No Chrome tabs or tab groups found',
      valid: false,
    };
  }

  const labels = {
    all: 'Chrome tabs, groups, or history',
    tabs: 'Chrome tabs',
    groups: 'Chrome tab groups',
    history: 'Chrome history',
  };
  return {
    title: `No matching ${labels[scope] ?? labels.all} found`,
    subtitle: 'Try a different title or URL.',
    valid: false,
  };
}

export function buildUnifiedSearchItems({
  tabs = [],
  groups = [],
  history = [],
  historyStatus = 'skipped',
  scope = 'all',
  query = '',
  now,
} = {}) {
  const openUrls = new Set(
    tabs
      .map(tab => canonicalUrl(tab.url))
      .filter(Boolean),
  );
  const items = [];

  if (includesTabs(scope)) {
    items.push(...buildUnifiedTabItems(tabs, query));
  }
  if (includesGroups(scope)) {
    items.push(...buildUnifiedGroupItems(groups, query));
  }
  if (includesHistory(scope) && historyStatus === 'ok') {
    items.push(...buildUnifiedHistoryItems(history, {
      query,
      openUrls,
      dedupeOpenTabs: scope === 'all',
      now,
    }));
  }
  if (includesHistory(scope) && historyStatus === 'permission-required') {
    items.push(permissionItem());
  }

  if (items.length === 0) {
    return [emptyItem(scope, query)];
  }

  return items;
}
