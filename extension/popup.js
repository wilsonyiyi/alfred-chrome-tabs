import {bridgeStatusView, historyPermissionView} from './popup-state.js';

const version = document.querySelector('#version');
const statusCard = document.querySelector('#status-card');
const statusLabel = document.querySelector('#status-label');
const statusDetail = document.querySelector('#status-detail');
const retryButton = document.querySelector('#retry');
const historyDetail = document.querySelector('#history-detail');
const historyPermissionButton = document.querySelector('#history-permission');

version.textContent = `v${chrome.runtime.getManifest().version}`;

function sendRuntimeMessage(message) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, response => {
      const error = chrome.runtime.lastError;
      if (error) {
        reject(new Error(error.message));
        return;
      }
      resolve(response);
    });
  });
}

function render(state) {
  const view = bridgeStatusView(state);
  statusCard.dataset.tone = view.tone;
  statusLabel.textContent = view.label;
  statusDetail.textContent = view.detail;
  statusDetail.hidden = state?.status === 'connected';
  retryButton.hidden = !view.canRetry;
  retryButton.disabled = state?.status === 'connecting';
  retryButton.ariaBusy = String(state?.status === 'connecting');
}

function renderHistoryPermission(status) {
  const view = historyPermissionView(status);
  historyPermissionButton.textContent = view.label;
  historyPermissionButton.disabled = view.disabled;
  historyPermissionButton.dataset.tone = view.tone;
  historyPermissionButton.ariaBusy = String(status === 'checking' || status === 'requesting');
  historyDetail.textContent = view.detail;
}

async function refreshHistoryPermission() {
  renderHistoryPermission('checking');
  try {
    const granted = await chrome.permissions.contains({permissions: ['history']});
    renderHistoryPermission(granted ? 'granted' : 'denied');
  } catch {
    renderHistoryPermission('error');
  }
}

async function refresh() {
  try {
    const response = await sendRuntimeMessage({type: 'getBridgeStatus'});
    render(response?.state);
  } catch (error) {
    render({status: 'disconnected', detail: error.message});
  }
}

retryButton.addEventListener('click', async () => {
  render({status: 'connecting', detail: 'Retrying the native messaging host…'});
  try {
    const response = await sendRuntimeMessage({type: 'reconnectNativeHost'});
    render(response?.state);
  } catch (error) {
    render({status: 'disconnected', detail: error.message});
  }
});

historyPermissionButton.addEventListener('click', async () => {
  renderHistoryPermission('requesting');
  try {
    const granted = await chrome.permissions.request({permissions: ['history']});
    renderHistoryPermission(granted ? 'granted' : 'denied');
  } catch {
    renderHistoryPermission('error');
  }
});

chrome.runtime.onMessage.addListener(message => {
  if (message.type === 'bridgeStatusChanged') {
    render(message.state);
  }
});

chrome.permissions.onAdded.addListener(permissions => {
  if (permissions.permissions?.includes('history')) {
    renderHistoryPermission('granted');
  }
});

chrome.permissions.onRemoved.addListener(permissions => {
  if (permissions.permissions?.includes('history')) {
    renderHistoryPermission('denied');
  }
});

void refresh();
void refreshHistoryPermission();
