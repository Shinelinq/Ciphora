import { sendMessage, copyText } from './shared.js';
import { t, applyI18n } from './i18n.js';

const els = {
  status: document.getElementById('status'),
  retryBtn: document.getElementById('retryBtn'),
  onboardBox: document.getElementById('onboardBox'),
  error: document.getElementById('errorBox'),
  unlockBox: document.getElementById('unlockBox'),
  authorizeBtn: document.getElementById('authorizeBtn'),
  mainBox: document.getElementById('mainBox'),
  lockBtn: document.getElementById('lockBtn'),
  search: document.getElementById('searchInput'),
  list: document.getElementById('entryList'),
  detail: document.getElementById('detail'),
  detailTitle: document.getElementById('detailTitle'),
  detailUsername: document.getElementById('detailUsername'),
  fillBtn: document.getElementById('fillBtn'),
  copyUserBtn: document.getElementById('copyUserBtn'),
  copyPassBtn: document.getElementById('copyPassBtn'),
  totpBox: document.getElementById('totpBox'),
  totpCode: document.getElementById('totpCode'),
  totpBar: document.getElementById('totpBar'),
  copyTotpBtn: document.getElementById('copyTotpBtn'),
  fillTotpBtn: document.getElementById('fillTotpBtn'),
  genBtn: document.getElementById('genBtn'),
  genOutput: document.getElementById('genOutput'),
  genCopyBtn: document.getElementById('genCopyBtn'),
  openOptions: document.getElementById('openOptions'),
  downloadBtn: document.getElementById('downloadBtn'),
  toast: document.getElementById('toast')
};

let selected = null;
let totpTimer = null;
let lastTotp = '';
let toastTimer = null;

applyI18n();

function showError(message, withRetry = false) {
  els.error.textContent = message;
  els.error.classList.remove('hidden');
  els.retryBtn.classList.toggle('hidden', !withRetry);
}

function clearError() {
  els.error.classList.add('hidden');
  els.error.textContent = '';
  els.retryBtn.classList.add('hidden');
}

function toast(message, kind = 'ok') {
  if (!message) return;
  els.toast.textContent = message;
  els.toast.className = `toast ${kind === 'err' ? 'err' : 'ok'}`;
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    els.toast.className = 'toast hidden';
  }, 1800);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function stopTotpTimer() {
  if (totpTimer) {
    clearInterval(totpTimer);
    totpTimer = null;
  }
}

function showOnboard() {
  stopTotpTimer();
  selected = null;
  lastTotp = '';
  els.onboardBox.classList.remove('hidden');
  els.unlockBox.classList.add('hidden');
  els.mainBox.classList.add('hidden');
  els.lockBtn.classList.add('hidden');
  els.detail.classList.add('hidden');
  clearError();
  els.retryBtn.classList.remove('hidden');
}

function showUnlock(message) {
  stopTotpTimer();
  selected = null;
  lastTotp = '';
  els.onboardBox.classList.add('hidden');
  els.unlockBox.classList.remove('hidden');
  els.mainBox.classList.add('hidden');
  els.lockBtn.classList.add('hidden');
  els.detail.classList.add('hidden');
  clearError();
  if (message) showError(message);
}

function showMain() {
  els.onboardBox.classList.add('hidden');
  els.unlockBox.classList.add('hidden');
  els.mainBox.classList.remove('hidden');
  els.lockBtn.classList.remove('hidden');
  clearError();
}

async function refreshStatus() {
  const res = await sendMessage({ type: 'status' });
  if (!res.ok) {
    els.status.textContent = t('status.disconnected');
    showOnboard();
    return null;
  }
  const data = res.data;
  els.status.textContent = data.authorized
    ? (data.locked ? t('status.locked') : t('status.unlocked'))
    : t('status.unauthorized');
  if (!data.authorized) {
    showUnlock(data.locked ? t('unlock.hintLocked') : t('unlock.hint'));
    return data;
  }
  showMain();
  return data;
}

async function loadTotp(entry) {
  stopTotpTimer();
  lastTotp = '';
  els.totpBox.classList.remove('hidden');

  const tick = async () => {
    // 只传 id，避免明文密钥出现在请求 URL 中
    const res = await sendMessage({ type: 'totp', id: entry.id });
    if (!res.ok) {
      els.totpCode.textContent = '------';
      els.totpBar.style.width = '0%';
      showError(res.error);
      stopTotpTimer();
      return;
    }
    lastTotp = res.data.totp;
    els.totpCode.textContent = res.data.totp;
    els.totpBar.style.width = `${(res.data.remaining / 30) * 100}%`;
  };

  await tick();
  totpTimer = setInterval(tick, 1000);
}

async function selectEntry(id) {
  clearError();
  const res = await sendMessage({ type: 'entry', id });
  if (!res.ok) {
    showError(res.error, true);
    return;
  }
  selected = res.data;
  els.detail.classList.remove('hidden');
  els.detailTitle.textContent = selected.website || selected.description || t('entry.unnamed');
  els.detailUsername.textContent = selected.username || t('entry.noUsername');

  if (selected.hasTotp) {
    await loadTotp(selected);
  } else {
    stopTotpTimer();
    lastTotp = '';
    els.totpBox.classList.add('hidden');
  }

  window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
}

function renderEntries(entries) {
  els.list.innerHTML = '';
  if (!entries.length) {
    const li = document.createElement('li');
    li.style.cursor = 'default';
    li.innerHTML = `<div class="meta"><div class="website">${t('entry.notFound')}</div></div>`;
    els.list.appendChild(li);
    return;
  }

  for (const entry of entries) {
    const li = document.createElement('li');
    li.innerHTML = `
      <div class="meta">
        <div class="website">${escapeHtml(entry.website || entry.description || t('entry.unnamed'))}</div>
        <div class="username">${escapeHtml(entry.username || '')}</div>
      </div>
      <div class="tags">
        ${entry.hasPassword ? `<span class="tag">${t('tag.password')}</span>` : ''}
        ${entry.hasTotp ? `<span class="tag">${t('tag.mfa')}</span>` : ''}
      </div>`;
    li.addEventListener('click', () => selectEntry(entry.id));
    els.list.appendChild(li);
  }
}

let searchTimer = null;
function scheduleSearch() {
  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    runSearch(els.search.value.trim());
  }, 180);
}

async function runSearch(query) {
  const res = await sendMessage({ type: 'search', query });
  if (!res.ok) {
    showError(res.error, true);
    renderEntries([]);
    return [];
  }
  clearError();
  const entries = res.data.entries || [];
  renderEntries(entries);
  return entries;
}

async function copyWithFeedback(text, label) {
  const ok = await copyText(text);
  toast(ok ? t('toast.copied', { label }) : t('toast.copyFail'), ok ? 'ok' : 'err');
}

els.search.addEventListener('input', scheduleSearch);
els.retryBtn.addEventListener('click', () => init());

els.authorizeBtn.addEventListener('click', doUnlock);

async function doUnlock() {
  clearError();
  els.authorizeBtn.disabled = true;
  els.authorizeBtn.textContent = t('unlock.busy');
  const res = await sendMessage({ type: 'authorizeStart' });
  if (!res.ok) {
    els.authorizeBtn.disabled = false;
    els.authorizeBtn.textContent = t('unlock.button');
    showError(res.error);
    return;
  }
  pollUntilAuthorized();
}

let authPollTimer = null;
function stopAuthPolling() {
  if (authPollTimer) {
    clearInterval(authPollTimer);
    authPollTimer = null;
  }
}

function pollUntilAuthorized() {
  stopAuthPolling();
  const tick = async () => {
    const res = await sendMessage({ type: 'authorizePoll' });
    const reset = () => {
      stopAuthPolling();
      els.authorizeBtn.disabled = false;
      els.authorizeBtn.textContent = t('unlock.button');
    };
    if (!res.ok) {
      reset();
      showError(res.error);
      return;
    }
    const status = res.data?.status;
    if (status === 'approved') {
      reset();
      showMain();
      initEntries();
      toast(t('toast.authorized'));
    } else if (status === 'denied' || status === 'expired') {
      reset();
      showError(status === 'denied' ? t('unlock.denied') : t('unlock.expired'));
    } else if (status === 'none') {
      // 无进行中的请求，恢复为可点击状态
      reset();
    }
    // pending：继续轮询
  };
  tick();
  authPollTimer = setInterval(tick, 1500);
}

els.lockBtn.addEventListener('click', async () => {
  await sendMessage({ type: 'lock' });
  els.status.textContent = t('status.unauthorized');
  showUnlock(t('unlock.done'));
});

els.fillBtn.addEventListener('click', async () => {
  if (!selected) return;
  const payload = { username: selected.username, password: selected.password };
  const res = await sendMessage({ type: 'autofill', payload });
  if (!res.ok) {
    showError(res.error);
    toast(res.error, 'err');
    return;
  }
  if (res.data?.filled) {
    toast(t('toast.filled'));
  } else {
    toast(t('toast.fillNone'), 'err');
  }
});

els.copyUserBtn.addEventListener('click', async () => {
  if (selected) await copyWithFeedback(selected.username, t('label.user'));
});

els.copyPassBtn.addEventListener('click', async () => {
  if (selected) await copyWithFeedback(selected.password, t('label.password'));
});

els.copyTotpBtn.addEventListener('click', async () => {
  if (lastTotp) await copyWithFeedback(lastTotp, t('label.totp'));
});

els.fillTotpBtn.addEventListener('click', async () => {
  if (!selected || !lastTotp) return;
  const res = await sendMessage({ type: 'autofill', payload: { totp: lastTotp } });
  if (!res.ok) {
    showError(res.error);
    return;
  }
  if (res.data?.filled) {
    toast(t('toast.totpFilled'));
  } else {
    toast(t('toast.totpNone'), 'err');
  }
});

els.genBtn.addEventListener('click', async () => {
  const res = await sendMessage({ type: 'generate', options: { length: 20 } });
  if (!res.ok) {
    showError(res.error);
    return;
  }
  els.genOutput.value = res.data.password;
  toast(t('toast.generated'));
});

els.genCopyBtn.addEventListener('click', async () => {
  if (els.genOutput.value) await copyWithFeedback(els.genOutput.value, t('label.password'));
});

els.openOptions.addEventListener('click', () => chrome.runtime.openOptionsPage());

els.downloadBtn?.addEventListener('click', (e) => {
  e.preventDefault();
  chrome.tabs.create({ url: els.downloadBtn.href });
});

/** 优先按当前网站自动匹配；只能匹配到一条时自动展开详情。 */
async function initEntries() {
  const hostRes = await sendMessage({ type: 'pageHost' });
  const host = hostRes.ok ? hostRes.data?.host : '';
  if (host) {
    els.search.value = host;
    const entries = await runSearch(host);
    if (entries.length === 1) {
      await selectEntry(entries[0].id);
    }
    return;
  }
  await runSearch('');
}

async function init() {
  const data = await refreshStatus();
  if (data?.authorized) {
    initEntries();
  } else if (data) {
    // 可能已有进行中的授权请求，重开弹窗时自动继续轮询
    pollUntilAuthorized();
  }
}

init();