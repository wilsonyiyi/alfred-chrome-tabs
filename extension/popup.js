import {bridgeStatusView} from './popup-state.js';

const version = document.querySelector('#version');
const statusCard = document.querySelector('#status-card');
const statusLabel = document.querySelector('#status-label');
const statusDetail = document.querySelector('#status-detail');
const retryButton = document.querySelector('#retry');

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
  retryButton.hidden = !view.canRetry;
  retryButton.disabled = state?.status === 'connecting';
  retryButton.ariaBusy = String(state?.status === 'connecting');
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

chrome.runtime.onMessage.addListener(message => {
  if (message.type === 'bridgeStatusChanged') {
    render(message.state);
  }
});

void refresh();
