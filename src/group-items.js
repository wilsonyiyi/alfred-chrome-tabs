export const GROUP_COLOR_OPTIONS = Object.freeze([
  {name: 'grey', label: 'Grey', symbol: '⚪'},
  {name: 'blue', label: 'Blue', symbol: '🔵'},
  {name: 'red', label: 'Red', symbol: '🔴'},
  {name: 'yellow', label: 'Yellow', symbol: '🟡'},
  {name: 'green', label: 'Green', symbol: '🟢'},
  {name: 'pink', label: 'Pink', symbol: '🩷'},
  {name: 'purple', label: 'Purple', symbol: '🟣'},
  {name: 'cyan', label: 'Cyan', symbol: '🩵'},
  {name: 'orange', label: 'Orange', symbol: '🟠'},
]);

const COLOR_BY_NAME = new Map(GROUP_COLOR_OPTIONS.map(color => [color.name, color]));

function action(method, params) {
  return JSON.stringify({method, params});
}

function groupTitle(group) {
  return String(group.title ?? '').trim() || 'Untitled group';
}

function groupSymbol(group) {
  return COLOR_BY_NAME.get(group.color)?.symbol ?? '⚪';
}

function matchesGroup(group, query) {
  const terms = query.toLowerCase().split(/\s+/u).filter(Boolean);
  const searchable = [
    groupTitle(group),
    group.color,
    ...group.tabs.flatMap(tab => [tab.title, tab.url]),
  ].filter(Boolean).join(' ').toLowerCase();
  return terms.every(term => searchable.includes(term));
}

function colorChoiceItems({autocompletePrefix, group}) {
  return GROUP_COLOR_OPTIONS.map(color => ({
    title: `${color.symbol} ${color.label}`,
    subtitle: group
      ? (group.color === color.name ? 'Current color' : `Change “${groupTitle(group)}” to ${color.label}`)
      : 'Press Tab, then enter the new group name',
    ...(group ? {
      arg: action('setGroupColor', {groupId: group.id, color: color.name}),
    } : {
      autocomplete: `${autocompletePrefix}${color.name} `,
      valid: false,
    }),
  }));
}

function createGroupItems(query) {
  const rest = query.slice('new'.length).trimStart();
  if (!rest) {
    return colorChoiceItems({autocompletePrefix: 'new '});
  }

  const firstToken = rest.split(/\s+/u, 1)[0].toLowerCase();
  const matchingColors = GROUP_COLOR_OPTIONS.filter(color => color.name.startsWith(firstToken));
  const hasNameAfterColor = rest.length > firstToken.length && /\s/u.test(rest[firstToken.length]);
  const selectedColor = COLOR_BY_NAME.get(firstToken);

  if (!hasNameAfterColor && matchingColors.length > 0) {
    return matchingColors.map(color => ({
      title: `${color.symbol} ${color.label}`,
      subtitle: 'Press Tab, then enter the new group name',
      autocomplete: `new ${color.name} `,
      valid: false,
    }));
  }

  if (selectedColor && hasNameAfterColor) {
    const title = rest.slice(firstToken.length).trim();
    if (!title) {
      return [{
        title: `Enter a name for the ${selectedColor.label.toLowerCase()} group`,
        subtitle: `c2 new ${selectedColor.name} <name>`,
        valid: false,
      }];
    }
    return [{
      title: `${selectedColor.symbol} Create “${title}”`,
      subtitle: `${selectedColor.label} · Group the current Chrome tab`,
      arg: action('createGroup', {title, color: selectedColor.name}),
    }];
  }

  const title = rest.trim();
  return [{
    title: `⚪ Create “${title}”`,
    subtitle: 'Grey · Group the current Chrome tab',
    arg: action('createGroup', {title, color: 'grey'}),
  }];
}

function recolorGroupItems(groups, query) {
  const rest = query.slice('color'.length).trimStart();
  const selectedGroupMatch = /^@(\d+)\s*$/u.exec(rest);
  if (selectedGroupMatch) {
    const groupId = Number(selectedGroupMatch[1]);
    const group = groups.find(candidate => candidate.id === groupId);
    return group ? colorChoiceItems({group}) : [{
      title: 'Chrome tab group no longer exists',
      subtitle: 'Return to c2 color and choose another group.',
      valid: false,
    }];
  }

  const matchedGroups = groups.filter(group => matchesGroup(group, rest));
  if (matchedGroups.length === 0) {
    return [{
      title: groups.length === 0 ? 'No Chrome tab groups found' : 'No matching Chrome tab groups',
      subtitle: 'Create one with c2 new.',
      valid: false,
    }];
  }

  return matchedGroups.map(group => ({
    title: `${groupSymbol(group)} ${groupTitle(group)}`,
    subtitle: `${COLOR_BY_NAME.get(group.color)?.label ?? 'Grey'} · Press Tab to choose a new color`,
    autocomplete: `color @${group.id} `,
    valid: false,
  }));
}

export function buildGroupItems(groups) {
  return groups.map(group => {
    const title = groupTitle(group);
    const searchable = group.tabs.flatMap(tab => [tab.title, tab.url]).filter(Boolean);
    const state = group.collapsed ? 'Collapsed' : 'Expanded';

    return {
      title: `${groupSymbol(group)} ${title}`,
      subtitle: `${group.tabCount} tabs · ${state} · Window ${group.windowId}`,
      match: `${title} ${group.color} ${searchable.join(' ')}`,
      arg: action('focusGroup', {groupId: group.id}),
      mods: {
        alt: {
          arg: action('setGroupCollapsed', {groupId: group.id}),
          subtitle: group.collapsed ? '⌥: Expand this group' : '⌥: Collapse this group',
        },
        shift: {
          arg: action('addCurrentTab', {groupId: group.id}),
          subtitle: '⇧: Add the current Chrome tab to this group',
        },
        ctrl: {
          arg: action('ungroupGroup', {groupId: group.id}),
          subtitle: '⌃: Ungroup all tabs without closing them',
        },
        cmd: {
          arg: action('closeGroup', {groupId: group.id}),
          subtitle: '⌘: Close every tab in this group',
        },
        'cmd+alt': {
          arg: action('saveGroup', {groupId: group.id}),
          subtitle: '⌘⌥: Save this group so it can be reopened later',
        },
      },
    };
  });
}

export function buildSavedGroupItems(savedGroups) {
  return savedGroups.map(group => {
    const title = groupTitle(group);
    const searchable = (group.tabs ?? []).flatMap(tab => [tab.title, tab.url]).filter(Boolean);

    return {
      title: `${groupSymbol(group)} ${title}`,
      subtitle: `${(group.tabs ?? []).length} tabs · Saved · Return reopens this group`,
      match: `${title} ${group.color} saved ${searchable.join(' ')}`,
      arg: action('openSavedGroup', {savedGroupId: group.id}),
      mods: {
        cmd: {
          arg: action('deleteSavedGroup', {savedGroupId: group.id}),
          subtitle: '⌘: Forget this saved group',
        },
      },
    };
  });
}

export function matchesSavedGroup(group, query) {
  return matchesGroup({...group, tabs: group.tabs ?? []}, query);
}

export function buildGroupCommandItems(groups, input = '', {savedGroups = []} = {}) {
  const query = String(input ?? '').trimStart();
  if (/^new(?:\s|$)/iu.test(query)) {
    return createGroupItems(query);
  }
  if (/^color(?:\s|$)/iu.test(query)) {
    return recolorGroupItems(groups, query);
  }

  const rootActions = [{
    title: 'Create a new tab group…',
    subtitle: 'Press Tab to choose a color and enter a name',
    autocomplete: 'new ',
    valid: false,
    match: 'new create 新建 创建',
  }, {
    title: 'Change a tab group color…',
    subtitle: 'Press Tab to choose a group',
    autocomplete: 'color ',
    valid: false,
    match: 'color colour change 修改 颜色',
  }];
  const normalizedQuery = query.trim().toLowerCase();
  const actions = rootActions.filter(item => (
    !normalizedQuery || `${item.title} ${item.match}`.toLowerCase().includes(normalizedQuery)
  ));
  const matchedGroups = groups.filter(group => matchesGroup(group, normalizedQuery));
  const matchedSaved = savedGroups.filter(group => matchesSavedGroup(group, normalizedQuery));
  // Group results are the primary content. Keep commands below them and omit
  // item UIDs so Alfred Knowledge cannot reorder commands ahead of groups.
  const items = [
    ...buildGroupItems(matchedGroups),
    ...buildSavedGroupItems(matchedSaved),
    ...actions,
  ];

  if (items.length === 0) {
    return [{
      title: groups.length === 0 ? 'No Chrome tab groups found' : 'No matching Chrome tab groups',
      subtitle: 'Use c2 new to group the current Chrome tab.',
      valid: false,
    }];
  }
  return items;
}
