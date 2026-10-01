/**
 * Ciphora Autofill — 内容脚本。
 * 负责在网页中识别账号 / 密码 / 验证码输入框并填入数据，
 * 并（可选）注入一个悬浮填充入口。
 */

(function () {
  if (window.__ciphoraAutofillInjected) return;
  window.__ciphoraAutofillInjected = true;

  function sendBg(message) {
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage(message, (response) => {
          if (chrome.runtime.lastError) {
            resolve({ ok: false, error: chrome.runtime.lastError.message, code: 'offline' });
            return;
          }
          resolve(response || { ok: false, error: 'no_response' });
        });
      } catch (_) {
        resolve({ ok: false, error: 'extension_unavailable', code: 'offline' });
      }
    });
  }

  // ==================== 表单识别与填充 ====================

  function isVisible(el) {
    if (!el || el.disabled || el.readOnly) return false;
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  const USER_PATTERNS = [/user/, /email/, /account/, /login/, /phone/, /手机/, /账号/, /邮箱/];
  const OTP_PATTERNS = [/otp/, /totp/, /验证码/, /one-?time/, /2fa/, /mfa/];

  function scoreField(el, patterns) {
    const haystack = [el.name, el.id, el.autocomplete, el.placeholder, el.getAttribute('aria-label')]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return patterns.some((p) => p.test(haystack)) ? 1 : 0;
  }

  function collectInputs(root) {
    const results = [];
    const walk = (node) => {
      if (!node || typeof node.querySelectorAll !== 'function') return;
      for (const el of node.querySelectorAll('input')) results.push(el);
      // 穿透开放的 Shadow DOM（现代登录组件常用）
      for (const el of node.querySelectorAll('*')) {
        if (el.shadowRoot) walk(el.shadowRoot);
      }
    };
    walk(root);
    return results.filter(isVisible);
  }

  function collectFields(root) {
    const elements = collectInputs(root);
    let userField = null;
    let passField = null;
    let otpField = null;

    for (const el of elements) {
      const type = (el.type || 'text').toLowerCase();
      if (type === 'password' && !passField) {
        passField = el;
        continue;
      }
      if (type === 'text' || type === 'email' || type === 'tel') {
        if (!otpField && scoreField(el, OTP_PATTERNS)) {
          otpField = el;
        } else if (!userField && scoreField(el, USER_PATTERNS)) {
          userField = el;
        }
      }
    }

    return { userField, passField, otpField };
  }

  function setValue(el, value) {
    if (!el || value === undefined || value === null) return;
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    if (setter) {
      setter.call(el, value);
    } else {
      el.value = value;
    }
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function fill(payload) {
    const { username, password, totp } = payload || {};
    // 在顶层以及所有同源 iframe 中尝试填写
    const scopes = [document];
    for (const iframe of document.querySelectorAll('iframe')) {
      try {
        if (iframe.contentDocument) scopes.push(iframe.contentDocument);
      } catch (_) {
        // 跨域 iframe 忽略
      }
    }

    let filled = false;
    for (const scope of scopes) {
      const { userField, passField, otpField } = collectFields(scope);
      if (userField && username) {
        setValue(userField, username);
        filled = true;
      }
      if (passField && password) {
        setValue(passField, password);
        filled = true;
      }
      if (otpField && totp) {
        setValue(otpField, totp);
        filled = true;
      }
      if (filled) break;
    }

    if (!filled && password) {
      // 回退：填充当前聚焦的输入框
      const active = document.activeElement;
      if (active && active.tagName === 'INPUT') {
        setValue(active, password);
        filled = true;
      }
    }

    return filled;
  }

  // ==================== 悬浮入口（可选） ====================

  const FAB_HOST_ID = 'ciphora-fab-host';
  const LANG = (navigator.language || 'en').toLowerCase().startsWith('zh') ? 'zh' : 'en';
  const TXT = {
    zh: {
      loading: '加载中…',
      noEntries: '未找到匹配的条目',
      authHint: '请输入主密码以授权',
      masterPassword: '主密码',
      authorize: '授权',
      filled: '已填充到当前页面',
      fillNone: '未找到匹配的输入框',
      autoFilled: 'Ciphora 已自动填充'
    },
    en: {
      loading: 'Loading…',
      noEntries: 'No matching entries',
      authHint: 'Enter your master password to authorize',
      masterPassword: 'Master password',
      authorize: 'Authorize',
      filled: 'Filled into the current page',
      fillNone: 'No matching input field found',
      autoFilled: 'Auto-filled by Ciphora'
    }
  };
  const L = (key) => (TXT[LANG] || TXT.en)[key] || key;
  let shadow = null;
  let panelEl = null;
  let observer = null;

  function pageKeyword() {
    try {
      const parts = location.hostname.replace(/^www\./i, '').split('.').filter(Boolean);
      if (parts.length === 0) return '';
      if (parts.length === 1) return parts[0];
      const suffix2 = parts.slice(-2).join('.');
      const commonSecondLevel = /^(co|com|net|org|gov|edu|ac)\.[a-z]{2}$/i.test(suffix2);
      return commonSecondLevel && parts.length >= 3 ? parts[parts.length - 3] : parts[parts.length - 2];
    } catch (_) {
      return '';
    }
  }

  function hasLoginField() {
    return collectInputs(document).some((el) => {
      const t = (el.type || '').toLowerCase();
      return t === 'password' || scoreField(el, USER_PATTERNS) || scoreField(el, OTP_PATTERNS);
    });
  }

  function buildFab() {
    const host = document.createElement('div');
    host.id = FAB_HOST_ID;
    host.style.cssText = 'position:fixed;z-index:2147483646;right:16px;bottom:16px;';
    shadow = host.attachShadow({ mode: 'open' });
    shadow.innerHTML = `
      <style>
        * { box-sizing: border-box; }
        .fab {
          width: 44px; height: 44px; border-radius: 50%; border: none; cursor: pointer;
          background: linear-gradient(135deg, #2563eb, #4f46e5); color: #fff;
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 6px 20px rgba(37, 99, 235, 0.45);
        }
        .fab:hover { filter: brightness(1.08); }
        .panel {
          position: absolute; right: 0; bottom: 54px; width: 288px; max-height: 360px;
          background: #fff; color: #111827; border: 1px solid #e5e7eb; border-radius: 12px;
          box-shadow: 0 16px 40px rgba(0,0,0,0.22); overflow: hidden;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", sans-serif;
          display: flex; flex-direction: column;
        }
        .panel.hidden { display: none; }
        .head { display: flex; align-items: center; justify-content: space-between;
          padding: 10px 12px; border-bottom: 1px solid #f1f5f9; font-weight: 700; font-size: 13px; }
        .head button { border: none; background: transparent; cursor: pointer; color: #6b7280; font-size: 16px; }
        .list { overflow-y: auto; }
        .item { padding: 9px 12px; cursor: pointer; border-bottom: 1px solid #f8fafc; }
        .item:hover { background: #f8fafc; }
        .item .t { font-size: 13px; font-weight: 600; }
        .item .u { font-size: 11px; color: #6b7280; }
        .empty, .auth { padding: 14px 12px; font-size: 12px; color: #6b7280; }
        .auth input { width: 100%; padding: 8px 10px; border: 1px solid #e5e7eb; border-radius: 8px; font-size: 13px; margin-bottom: 8px; }
        .auth button { width: 100%; padding: 8px; border: none; border-radius: 8px;
          background: #2563eb; color: #fff; font-weight: 600; cursor: pointer; font-size: 13px; }
        .msg { padding: 7px 12px; font-size: 11px; color: #15803d; }
        .msg.err { color: #b91c1c; }
      </style>
      <button class="fab" title="Ciphora 自动填充">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 19V5M5 12l7-7 7 7"/>
        </svg>
      </button>
      <div class="panel hidden"></div>
    `;
    shadow.querySelector('.fab').addEventListener('click', openPanel);
    document.body.appendChild(host);
    panelEl = shadow.querySelector('.panel');
  }

  function removeFab() {
    const host = document.getElementById(FAB_HOST_ID);
    if (host) host.remove();
    shadow = null;
    panelEl = null;
  }

  function setPanel(html) {
    panelEl.innerHTML = html;
    panelEl.classList.remove('hidden');
  }

  function closePanel() {
    if (panelEl) panelEl.classList.add('hidden');
  }

  async function openPanel() {
    setPanel(`<div class="head"><span>Ciphora</span><button data-close>&times;</button></div><div class="empty">${L('loading')}</div>`);
    bindPanelCommon();
    const res = await sendBg({ type: 'search', query: pageKeyword() });
    if (!res.ok) {
      if (res.code === 'unauthorized') {
        renderAuth(res.error);
      } else {
        setPanel(`<div class="head"><span>Ciphora</span><button data-close>&times;</button></div><div class="empty">${escapeText(res.error)}</div>`);
        bindPanelCommon();
      }
      return;
    }
    renderEntries(res.data.entries || []);
  }

  function bindPanelCommon() {
    const close = panelEl.querySelector('[data-close]');
    if (close) close.addEventListener('click', closePanel);
  }

  function renderEntries(entries) {
    const head = `<div class="head"><span>Ciphora</span><button data-close>&times;</button></div>`;
    if (!entries.length) {
      setPanel(`${head}<div class="empty">${L('noEntries')}</div>`);
      bindPanelCommon();
      return;
    }
    const rows = entries
      .map(
        (e) => `<div class="item" data-id="${escapeText(e.id)}">
          <div class="t">${escapeText(e.website || e.description || '未命名')}</div>
          <div class="u">${escapeText(e.username || '')}</div>
        </div>`
      )
      .join('');
    setPanel(`${head}<div class="list">${rows}</div>`);
    bindPanelCommon();
    panelEl.querySelectorAll('.item').forEach((row) => {
      row.addEventListener('click', () => fillEntry(row.dataset.id));
    });
  }

  function renderAuth(message) {
    setPanel(`
      <div class="head"><span>Ciphora</span><button data-close>&times;</button></div>
      <div class="auth">
        <div style="margin-bottom:8px;">${escapeText(message || L('authHint'))}</div>
        <input type="password" placeholder="${L('masterPassword')}" data-pwd />
        <button data-auth>${L('authorize')}</button>
      </div>`);
    bindPanelCommon();
    const input = panelEl.querySelector('[data-pwd]');
    const submit = async () => {
      const pwd = input.value;
      if (!pwd) return;
      const res = await sendBg({ type: 'authorize', masterPassword: pwd });
      if (!res.ok) {
        renderAuth(res.error);
        return;
      }
      openPanel();
    };
    panelEl.querySelector('[data-auth]').addEventListener('click', submit);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') submit();
    });
    input.focus();
  }

  async function fillEntry(id) {
    const res = await sendBg({ type: 'entry', id });
    if (!res.ok) {
      openPanel();
      return;
    }
    const entry = res.data;
    const payload = { username: entry.username, password: entry.password };
    if (entry.hasTotp) {
      const totpRes = await sendBg({ type: 'totp', id });
      if (totpRes.ok) payload.totp = totpRes.data.totp;
    }
    const ok = fill(payload);
    setPanel(
      `<div class="head"><span>Ciphora</span><button data-close>&times;</button></div>
       <div class="msg ${ok ? '' : 'err'}">${ok ? L('filled') : L('fillNone')}</div>`
    );
    bindPanelCommon();
  }

  function escapeText(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function syncFabVisibility() {
    // 仅在顶层框架显示悬浮入口，避免在 iframe 内重复注入
    if (window.top !== window.self) return;
    const enabled = Boolean(uiSettings.showFloating);
    if (!enabled) {
      removeFab();
      return;
    }
    if (document.getElementById(FAB_HOST_ID)) return;
    // 仅在检测到登录类输入框时注入，避免污染普通页面
    if (hasLoginField()) {
      buildFab();
    } else {
      startDetectObserver();
    }
  }

  function startDetectObserver() {
    if (observer) return;
    observer = new MutationObserver(() => {
      if (!document.getElementById(FAB_HOST_ID) && hasLoginField()) {
        stopDetectObserver();
        buildFab();
      }
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  function stopDetectObserver() {
    if (observer) {
      observer.disconnect();
      observer = null;
    }
  }

  // ==================== 登录页自动填充 ====================

  const COMMON_SECOND_LEVEL = /^(co|com|net|org|gov|edu|ac)\.[a-z]{2}$/i;

  function registrableDomain(host) {
    if (!host) return '';
    const parts = String(host).toLowerCase().replace(/^www\./, '').split('.').filter(Boolean);
    if (parts.length <= 2) return parts.join('.');
    const suffix2 = parts.slice(-2).join('.');
    return COMMON_SECOND_LEVEL.test(suffix2) ? parts.slice(-3).join('.') : parts.slice(-2).join('.');
  }

  function domainOfUrl(value) {
    if (!value) return '';
    try {
      const u = new URL(value.includes('://') ? value : `https://${value}`);
      return registrableDomain(u.hostname);
    } catch (_) {
      return '';
    }
  }

  function entryDomain(entry) {
    const fromUrl = domainOfUrl(entry.url);
    if (fromUrl) return fromUrl;
    // 有些条目只填了 website，且它本身就是域名
    return entry.website && entry.website.includes('.') ? domainOfUrl(entry.website) : '';
  }

  function isLoginForm() {
    const passwords = collectInputs(document).filter((el) => {
      if ((el.type || '').toLowerCase() !== 'password') return false;
      // 排除注册/修改密码场景
      return (el.autocomplete || '').toLowerCase() !== 'new-password';
    });
    return passwords.length === 1;
  }

  let uiSettings = { autoFill: true, showFloating: false };
  let autoFillTimer = null;
  let autoFilledFor = null;

  function showToast(message) {
    let host = document.getElementById('ciphora-toast-host');
    if (!host) {
      host = document.createElement('div');
      host.id = 'ciphora-toast-host';
      host.style.cssText = 'position:fixed;z-index:2147483647;right:16px;bottom:72px;';
      const root = host.attachShadow({ mode: 'open' });
      root.innerHTML = `<style>div{background:#111827;color:#fff;padding:8px 12px;border-radius:10px;` +
        `font:12px -apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif;` +
        `box-shadow:0 6px 20px rgba(0,0,0,.25);opacity:0;transition:opacity .2s}</style><div></div>`;
      (document.body || document.documentElement).appendChild(host);
    }
    const box = host.shadowRoot.querySelector('div');
    box.textContent = message;
    box.style.opacity = '1';
    clearTimeout(host.__hideTimer);
    host.__hideTimer = setTimeout(() => { box.style.opacity = '0'; }, 2200);
  }

  async function tryAutoFill() {
    if (!uiSettings.autoFill) return;
    // 每个页面路径只自动填充一次，避免循环
    const navKey = location.origin + location.pathname;
    if (autoFilledFor === navKey) return;
    if (!isLoginForm()) return;

    const domain = registrableDomain(location.hostname);
    if (!domain) return;

    const res = await sendBg({ type: 'search', query: pageKeyword() });
    // 未授权 / 离线：静默（用户需先在弹窗授权）
    if (!res.ok) return;

    const entries = res.data.entries || [];
    const matches = entries.filter(
      (e) => e.hasPassword && entryDomain(e) && entryDomain(e) === domain
    );
    if (matches.length !== 1) return;

    const full = await sendBg({ type: 'entry', id: matches[0].id });
    if (!full.ok) return;

    const filled = fill({ username: full.data.username, password: full.data.password });
    if (filled) {
      autoFilledFor = navKey;
      showToast(L('autoFilled'));
    }
  }

  function scheduleAutoFill() {
    clearTimeout(autoFillTimer);
    autoFillTimer = setTimeout(tryAutoFill, 600);
  }

  // ==================== 消息入口 ====================

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === 'ciphora_fill') {
      let filled = false;
      try {
        filled = fill(message.payload);
      } catch (_) {
        filled = false;
      }
      sendResponse({ filled });
    }
    // 同步调用 sendResponse，无需保持通道
    return false;
  });

  // 设置变化时动态显示 / 隐藏悬浮入口，并同步自动填充开关
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.ui) {
      loadUiSettings();
    }
  });

  function loadUiSettings() {
    chrome.storage.local.get('ui', (stored) => {
      uiSettings = { autoFill: true, showFloating: false, ...(stored?.ui || {}) };
      syncFabVisibility();
      scheduleAutoFill();
    });
  }

  // 仅在 DOM 新增 input 时触发自动填充，避免在高频页面上反复扫描
  const autoFillObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType !== 1) continue;
        if (node.tagName === 'INPUT' || (typeof node.querySelector === 'function' && node.querySelector('input'))) {
          scheduleAutoFill();
          return;
        }
      }
    }
  });
  autoFillObserver.observe(document.documentElement, { childList: true, subtree: true });

  loadUiSettings();
})();