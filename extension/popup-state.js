const STATUS_VIEWS = Object.freeze({
  connected: {label: 'Connected', tone: 'success', fallbackDetail: 'Native messaging host is ready.'},
  connecting: {label: 'Connecting…', tone: 'progress', fallbackDetail: 'Connecting to the native messaging host…'},
  reconnecting: {label: 'Reconnecting…', tone: 'warning', fallbackDetail: 'Waiting for the native messaging host…'},
  disconnected: {label: 'Disconnected', tone: 'danger', fallbackDetail: 'Native messaging host is unavailable.'},
});

export function bridgeStatusView(state = {}) {
  const view = STATUS_VIEWS[state.status] ?? STATUS_VIEWS.disconnected;
  return {...view, detail: state.detail || view.fallbackDetail, canRetry: state.status !== 'connected'};
}

const HISTORY_PERMISSION_VIEWS = Object.freeze({
  checking: {label: 'Checking…', detail: 'Checking Chrome permission', disabled: true, tone: 'progress'},
  requesting: {label: 'Enabling…', detail: 'Waiting for your approval', disabled: true, tone: 'progress'},
  granted: {label: 'Enabled', detail: 'Search titles and URLs', disabled: true, tone: 'success'},
  denied: {label: 'Enable', detail: 'Search titles and URLs', disabled: false, tone: 'neutral'},
  error: {label: 'Retry', detail: 'Could not check permission', disabled: false, tone: 'danger'},
});

export function historyPermissionView(status = 'checking') {
  return HISTORY_PERMISSION_VIEWS[status] ?? HISTORY_PERMISSION_VIEWS.error;
}
