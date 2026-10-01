/**
 * Ciphora Autofill — MV3 service worker.
 *
 * 所有私密数据都通过本地桥接从 Ciphora 桌面应用读取，
 * 扩展本身不持久化任何密码或密钥。
 *
 * 授权模型：扩展用主密码通过 `/authorize` 换取短期会话令牌，
 * 令牌仅存于 `chrome.storage.session`（内存态，浏览器关闭即清除），
 * 因此下次打开浏览器需要重新授权。
 */

const DEFAULT_CONFIG = { port: 37123 };
const SESSION_KEY = 'ciphoraSession';
const PENDING_KEY = 'ciphoraPendingAuth';

function bridgeError(message, code) {
  const error = new Error(message);
  if (code) error.code = code;
  return error;
}

async function getConfig() {
  const stored = await chrome.storage.local.get('bridge');
  return { ...DEFAULT_CONFIG, ...(stored.bridge || {}) };
}

async function getSessionToken() {
  const stored = await chrome.storage.session.get(SESSION_KEY);
  const entry = stored[SESSION_KEY];
  if (!entry?.token) return '';
  if (entry.expiresAt && Date.now() > entry.expiresAt) {
    await chrome.storage.session.remove(SESSION_KEY);
    return '';
  }
  return entry.token;
}

async function setSession(token, expiresInSeconds) {
  await chrome.storage.session.set({
    [SESSION_KEY]: { token, expiresAt: Date.now() + (expiresInSeconds || 900) * 1000 }
  });
}

async function clearSession() {
  await chrome.storage.session.remove(SESSION_KEY);
}

/** 无需授权的公共请求（/status、/authorize）。 */
async function fetchPublic(path, options = {}) {
  const config = await getConfig();
  let response;
  try {
    response = await fetch(`http://127.0.0.1:${config.port}${path}`, {
      method: options.method || 'GET',
      body: options.body,
      headers: { ...(options.body ? { 'content-type': 'application/json' } : {}) }
    });
  } catch (_) {
    throw bridgeError('无法连接 Ciphora 桌面应用，请确认应用已启动且桥接已开启', 'offline');
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || `请求失败 (HTTP ${response.status})`);
  }
  return data;
}

/** 需要短期会话的数据请求。 */
async function bridgeFetch(path, options = {}) {
  const config = await getConfig();
  const token = await getSessionToken();
  if (!token) {
    throw bridgeError('未授权，请先输入主密码', 'unauthorized');
  }

  let response;
  try {
    response = await fetch(`http://127.0.0.1:${config.port}${path}`, {
      method: options.method || 'GET',
      body: options.body,
      headers: {
        'x-ciphora-session': token,
        ...(options.body ? { 'content-type': 'application/json' } : {}),
        ...(options.headers || {})
      }
    });
  } catch (_) {
    throw bridgeError('无法连接 Ciphora 桌面应用，请确认应用已启动且桥接已开启', 'offline');
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401) {
      await clearSession();
      throw bridgeError('授权已过期，请重新输入主密码', 'unauthorized');
    }
    if (response.status === 429) {
      throw bridgeError(data.message || '尝试过于频繁，请稍后再试', 'rate_limited');
    }
    throw new Error(data.message || `请求失败 (HTTP ${response.status})`);
  }
  return data;
}

/** 发起一次授权请求（桌面端会弹到前台等待用户确认）。 */
async function authorizeStart() {
  const config = await getConfig();
  let response;
  try {
    response = await fetch(`http://127.0.0.1:${config.port}/authorize/start`, { method: 'POST' });
  } catch (_) {
    throw bridgeError('无法连接 Ciphora 桌面应用，请确认应用已启动且桥接已开启', 'offline');
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401) {
      throw bridgeError(data.message || '请先在桌面应用解锁密码库', 'locked');
    }
    if (response.status === 429) {
      throw bridgeError(data.message || '尝试过于频繁，请稍后再试', 'rate_limited');
    }
    throw new Error(data.message || `请求失败 (HTTP ${response.status})`);
  }
  await chrome.storage.session.set({
    [PENDING_KEY]: { requestId: data.requestId, expiresAt: Date.now() + (data.expiresIn || 120) * 1000 }
  });
  return data;
}

/** 查询授权结果；批准后保存会话令牌。 */
async function authorizePoll() {
  const stored = await chrome.storage.session.get(PENDING_KEY);
  const pending = stored[PENDING_KEY];
  if (!pending?.requestId) return { status: 'none' };
  if (pending.expiresAt && Date.now() > pending.expiresAt) {
    await chrome.storage.session.remove(PENDING_KEY);
    return { status: 'expired' };
  }

  const config = await getConfig();
  let response;
  try {
    response = await fetch(
      `http://127.0.0.1:${config.port}/authorize/result?request=${encodeURIComponent(pending.requestId)}`
    );
  } catch (_) {
    throw bridgeError('无法连接 Ciphora 桌面应用，请确认应用已启动且桥接已开启', 'offline');
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || `请求失败 (HTTP ${response.status})`);
  }

  if (data.status === 'approved' && data.sessionToken) {
    await setSession(data.sessionToken, data.expiresIn);
    await chrome.storage.session.remove(PENDING_KEY);
  } else if (data.status === 'denied' || data.status === 'expired') {
    await chrome.storage.session.remove(PENDING_KEY);
  }
  return data;
}

async function activeTabHost() {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  return { host: extractHost(tab?.url), url: tab?.url || '' };
}

/** 从 URL 提取用于搜索的关键词（多级域名取主体部分，如 accounts.google.com → google）。 */
function extractHost(url) {
  if (!url) return '';
  try {
    const { hostname } = new URL(url);
    const parts = hostname.replace(/^www\./i, '').split('.').filter(Boolean);
    if (parts.length === 0) return '';
    if (parts.length === 1) return parts[0];
    const suffix2 = parts.slice(-2).join('.');
    const commonSecondLevel = /^(co|com|net|org|gov|edu|ac)\.[a-z]{2}$/i.test(suffix2);
    return commonSecondLevel && parts.length >= 3 ? parts[parts.length - 3] : parts[parts.length - 2];
  } catch (_) {
    return '';
  }
}

const RESTRICTED_URL = /^(chrome|edge|about|chrome-extension|moz-extension|devtools|view-source|file):/i;
const STORE_URL = /(chrome\.google\.com\/webstore|microsoftedge\.microsoft\.com\/addons|addons\.mozilla\.org)/i;

async function autofillActiveTab(payload) {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (!tab?.id) {
    throw new Error('未找到活动标签页');
  }

  const url = tab.url || '';
  if (url && (RESTRICTED_URL.test(url) || STORE_URL.test(url))) {
    throw new Error('当前页面不允许扩展填充（浏览器内部页面或扩展商店）');
  }

  let response;
  try {
    response = await chrome.tabs.sendMessage(tab.id, { type: 'ciphora_fill', payload });
  } catch (_error) {
    // 内容脚本可能尚未注入（例如扩展刚安装），注入后重试一次
    await chrome.scripting.executeScript({
      target: { tabId: tab.id, allFrames: true },
      files: ['src/content.js']
    });
    response = await chrome.tabs.sendMessage(tab.id, { type: 'ciphora_fill', payload });
  }
  return { filled: Boolean(response?.filled) };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  (async () => {
    try {
      switch (message?.type) {
        case 'status': {
          const hasSession = Boolean(await getSessionToken());
          const data = await fetchPublic('/status');
          const effectiveAuthorized = hasSession && data.authorized;
          // 服务端会话已失效时，顺带清理扩展侧的陈旧令牌
          if (hasSession && !data.authorized) {
            await clearSession();
          }
          sendResponse({
            ok: true,
            data: {
              app: data.app,
              version: data.version,
              locked: data.locked,
              authorized: effectiveAuthorized
            }
          });
          break;
        }
        case 'authorizeStart':
          sendResponse({ ok: true, data: await authorizeStart() });
          break;
        case 'authorizePoll':
          sendResponse({ ok: true, data: await authorizePoll() });
          break;
        case 'lock':
          try {
            await bridgeFetch('/lock', { method: 'POST' });
          } catch (_) {
            // 会话可能已失效，仍清理本地令牌
          }
          await clearSession();
          sendResponse({ ok: true, data: { authorized: false } });
          break;
        case 'search':
          sendResponse({
            ok: true,
            data: await bridgeFetch(`/entries?q=${encodeURIComponent(message.query || '')}`)
          });
          break;
        case 'entry':
          sendResponse({ ok: true, data: await bridgeFetch(`/entry?id=${encodeURIComponent(message.id)}`) });
          break;
        case 'totp':
          sendResponse({ ok: true, data: await bridgeFetch(`/totp?id=${encodeURIComponent(message.id)}`) });
          break;
        case 'generate':
          sendResponse({
            ok: true,
            data: await bridgeFetch('/generate', {
              method: 'POST',
              body: JSON.stringify(message.options || {})
            })
          });
          break;
        case 'autofill':
          sendResponse({ ok: true, data: await autofillActiveTab(message.payload) });
          break;
        case 'pageHost':
          sendResponse({ ok: true, data: await activeTabHost() });
          break;
        default:
          sendResponse({ ok: false, error: 'unknown_message' });
      }
    } catch (error) {
      sendResponse({ ok: false, error: error.message || String(error), code: error.code || null });
    }
  })();

  return true;
});