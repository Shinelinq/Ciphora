import { t, applyI18n } from './i18n.js';

const portInput = document.getElementById('port');
const statusEl = document.getElementById('status');
const saveBtn = document.getElementById('saveBtn');
const testBtn = document.getElementById('testBtn');
const showFloating = document.getElementById('showFloating');
const autoFill = document.getElementById('autoFill');

applyI18n();

function setStatus(text, kind) {
  statusEl.textContent = text;
  statusEl.className = `status${kind ? ' ' + kind : ''}`;
}

function readPort() {
  return parseInt(portInput.value, 10) || 37123;
}

async function load() {
  const { bridge, ui } = await chrome.storage.local.get(['bridge', 'ui']);
  portInput.value = bridge?.port || 37123;
  showFloating.checked = Boolean(ui?.showFloating);
  // 默认开启自动填充
  autoFill.checked = ui?.autoFill !== false;
  // 打开设置页时主动检查一次连接状态
  await test({ silent: true });
}

async function save() {
  const port = readPort();
  await chrome.storage.local.set({ bridge: { port } });
  setStatus(t('options.status.saving'));
  await test();
}

async function test({ silent = false } = {}) {
  const port = readPort();
  if (!silent) setStatus(t('options.status.testing'));
  try {
    const response = await fetch(`http://127.0.0.1:${port}/status`);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setStatus(t('options.status.fail', { code: response.status }), 'err');
      return;
    }
    const detail = [
      `Ciphora v${data.version}`,
      data.locked ? t('options.status.locked') : t('options.status.unlocked'),
      data.authorized ? t('options.status.authorized') : t('options.status.unauthorized')
    ].join(' · ');
    setStatus(t('options.status.ok', { detail }), data.authorized ? 'ok' : 'warn');
  } catch (_) {
    setStatus(t('options.status.offline'), 'err');
  }
}

saveBtn.addEventListener('click', save);
testBtn.addEventListener('click', () => test());

// 悬浮按钮开关：即时生效
showFloating.addEventListener('change', async () => {
  const { ui } = await chrome.storage.local.get('ui');
  await chrome.storage.local.set({ ui: { ...(ui || {}), showFloating: showFloating.checked } });
});

// 自动填充开关：即时生效
autoFill.addEventListener('change', async () => {
  const { ui } = await chrome.storage.local.get('ui');
  await chrome.storage.local.set({ ui: { ...(ui || {}), autoFill: autoFill.checked } });
});

// 输入变化时清除过期的状态提示
portInput.addEventListener('input', () => setStatus(''));

load();