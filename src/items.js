function normalizeText(value) {
  return value
    .replace(/[\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/g, '')
    .trim();
}

function displayUrl(url) {
  return normalizeText(url)
    .replace(/^https?:\/\//, '')
    .replace(/\/$/, '');
}

export function buildTabItems(tabs) {
  return tabs.map(tab => {
    const title = normalizeText(tab.title || '') || 'Untitled tab';
    const subtitle = displayUrl(tab.url || '');

    return {
      uid: `${tab.windowIndex}:${tab.tabIndex}`,
      title,
      subtitle,
      match: `${title} ${subtitle}`,
      arg: JSON.stringify({
        windowIndex: tab.windowIndex,
        tabIndex: tab.tabIndex,
      }),
      autocomplete: title,
    };
  });
}
