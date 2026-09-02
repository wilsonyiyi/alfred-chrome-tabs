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
