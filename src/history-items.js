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

export function relativeVisitTime(lastVisitTime, now = Date.now()) {
  const timestamp = Number(lastVisitTime);
  if (!Number.isFinite(timestamp) || timestamp <= 0) return 'Unknown time';

  const elapsed = Math.max(0, now - timestamp);
  const minutes = Math.floor(elapsed / 60_000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;

  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;

  return `${Math.floor(months / 12)}y ago`;
}

export function buildHistoryItems(historyItems, {now = Date.now()} = {}) {
  return historyItems
    .filter(item => typeof item.url === 'string' && item.url)
    .map(item => {
      const url = normalizeText(item.url);
      const title = normalizeText(item.title) || displayUrl(url) || 'Untitled page';
      const subtitle = [
        displayUrl(url),
        relativeVisitTime(item.lastVisitTime, now),
        Number(item.visitCount) > 1 ? `${item.visitCount} visits` : undefined,
      ].filter(Boolean).join(' · ');
      const action = {
        method: 'openHistoryItem',
        params: {url},
      };

      return {
        title,
        subtitle,
        match: `${title} ${displayUrl(url)}`,
        arg: JSON.stringify(action),
        mods: {
          cmd: {
            arg: JSON.stringify({
              method: 'openHistoryItem',
              params: {url, forceNew: true},
            }),
            subtitle: 'Open in a new Chrome tab',
          },
        },
      };
    });
}
