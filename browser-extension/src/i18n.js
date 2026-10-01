/**
 * 扩展内的轻量 i18n：跟随浏览器语言（中文 / 英文）。
 */

const MESSAGES = {
  'zh-CN': {
    'status.connecting': '正在连接…',
    'status.disconnected': '未连接',
    'status.locked': '已锁定',
    'status.unlocked': '已解锁',
    'status.unauthorized': '未授权',
    'action.retry': '重试连接',
    'action.lock': '退出授权',
    'action.settings': '设置',
    'unlock.title': '在 Ciphora 中授权',
    'unlock.desc': '点击下方按钮，Ciphora 桌面应用会弹到前台，请在那里点击「允许」完成授权。',
    'unlock.button': '请求授权',
    'unlock.busy': '等待确认…',
    'unlock.tip': '请先在桌面应用解锁密码库。会话仅存于浏览器内存，过期后需重新授权。',
    'unlock.hintLocked': '请先在 Ciphora 桌面应用解锁密码库，再点击请求授权。',
    'unlock.hint': '点击「请求授权」，然后在桌面应用中点击「允许」。',
    'unlock.denied': '已在桌面端拒绝授权。',
    'unlock.expired': '授权请求已超时，请重试。',
    'unlock.done': '已退出授权，下次使用需重新输入主密码。',
    'search.placeholder': '搜索网站 / 用户名…',
    'entry.notFound': '未找到匹配项',
    'entry.unnamed': '未命名',
    'entry.noUsername': '（无用户名）',
    'tag.password': '密码',
    'tag.mfa': 'MFA',
    'detail.fill': '填充当前页面',
    'detail.copyUser': '复制用户名',
    'detail.copyPass': '复制密码',
    'detail.copyTotp': '复制验证码',
    'detail.fillTotp': '填充验证码',
    'generator.title': '密码生成器',
    'generator.generate': '生成',
    'generator.placeholder': '点击「生成」',
    'generator.copy': '复制',
    'footer.note': '数据来自本地 Ciphora 应用，不会上传到网络',
    'label.user': '用户名',
    'label.password': '密码',
    'label.totp': '验证码',
    'toast.copied': '{label}已复制',
    'toast.copyFail': '复制失败，请手动选择复制',
    'toast.filled': '已填充到当前页面',
    'toast.fillNone': '未找到匹配输入框，可手动复制',
    'toast.totpFilled': '验证码已填充',
    'toast.totpNone': '未找到验证码输入框，可手动复制',
    'toast.generated': '已生成新密码',
    'toast.authorized': '授权成功',
    'onboard.title': '未检测到 Ciphora 桌面应用',
    'onboard.desc': '浏览器扩展需要本地运行的 Ciphora 主程序才能读取密码。',
    'onboard.installed': '已安装？请打开 Ciphora，并在「设置 → 浏览器扩展桥接」中开启服务（默认关闭）。',
    'onboard.download': '下载 Ciphora',
    'options.subtitle': '连接本地 Ciphora 桌面应用，安全地自动填充账号、密码与 MFA 验证码。',
    'options.portLabel': '桥接端口',
    'options.portNote': '需与 Ciphora 设置中的「监听端口」一致（默认 37123）。',
    'options.save': '保存并测试',
    'options.test': '仅测试连接',
    'options.floatingLabel': '在网页显示悬浮填充按钮',
    'options.floatingNote': '开启后，访问含登录框的页面时右下角会出现一个悬浮箭头，点击即可快速填充，无需打开扩展弹窗。',
    'options.autoFillLabel': '登录页按域名自动填充',
    'options.autoFillNote': '当登录页的域名与某条记录完全匹配且唯一时，自动填入账号密码（需先在弹窗完成授权）。',
    'options.howTitle': '如何连接？',
    'options.step1': '打开 Ciphora 桌面应用。',
    'options.step2': '进入「设置 → 基本设置 → 浏览器扩展桥接」，打开开关。',
    'options.step3': '在本页填写与桌面端一致的「监听端口」，点击「保存并测试」。',
    'options.step4': '点击工具栏上的扩展图标，点「请求授权」，然后在桌面应用中点「允许」。',
    'options.note': '本扩展不保存任何长期令牌，也不接触主密码：授权时 Ciphora 桌面应用会弹到前台由你确认，批准后获得仅存于浏览器内存的短期会话。关闭浏览器、库锁定或应用重启后需重新授权。桥接仅在 127.0.0.1 本机监听，扩展不会把任何密码上传到互联网。',
    'options.status.saving': '配置已保存，正在测试连接…',
    'options.status.testing': '正在测试连接…',
    'options.status.ok': '连接成功：{detail}',
    'options.status.fail': '连接失败 (HTTP {code})',
    'options.status.offline': '无法连接，请确认 Ciphora 桌面应用正在运行且桥接已开启。',
    'options.status.locked': '库已锁定',
    'options.status.unlocked': '库已解锁',
    'options.status.authorized': '扩展已授权',
    'options.status.unauthorized': '扩展未授权'
  },
  en: {
    'status.connecting': 'Connecting…',
    'status.disconnected': 'Disconnected',
    'status.locked': 'Locked',
    'status.unlocked': 'Unlocked',
    'status.unauthorized': 'Not authorized',
    'action.retry': 'Retry',
    'action.lock': 'Sign out',
    'action.settings': 'Settings',
    'unlock.title': 'Authorize in Ciphora',
    'unlock.desc': 'Click the button below. The Ciphora desktop app will come to the front — click "Allow" there to finish.',
    'unlock.button': 'Request authorization',
    'unlock.busy': 'Waiting for confirmation…',
    'unlock.tip': 'Unlock the vault in the desktop app first. The session lives only in browser memory and expires over time.',
    'unlock.hintLocked': 'Unlock the vault in the Ciphora desktop app first, then request authorization.',
    'unlock.hint': 'Click "Request authorization", then click "Allow" in the desktop app.',
    'unlock.denied': 'Authorization was denied on the desktop.',
    'unlock.expired': 'The authorization request timed out. Please try again.',
    'unlock.done': 'Signed out. Enter your master password again next time.',
    'search.placeholder': 'Search site / username…',
    'entry.notFound': 'No matching entries',
    'entry.unnamed': 'Untitled',
    'entry.noUsername': '(no username)',
    'tag.password': 'Password',
    'tag.mfa': 'MFA',
    'detail.fill': 'Fill this page',
    'detail.copyUser': 'Copy username',
    'detail.copyPass': 'Copy password',
    'detail.copyTotp': 'Copy code',
    'detail.fillTotp': 'Fill code',
    'generator.title': 'Password generator',
    'generator.generate': 'Generate',
    'generator.placeholder': 'Click "Generate"',
    'generator.copy': 'Copy',
    'footer.note': 'Data comes from the local Ciphora app and never leaves your machine',
    'label.user': 'Username',
    'label.password': 'Password',
    'label.totp': 'Code',
    'toast.copied': '{label} copied',
    'toast.copyFail': 'Copy failed, please copy manually',
    'toast.filled': 'Filled into the current page',
    'toast.fillNone': 'No matching field found — copy manually',
    'toast.totpFilled': 'Code filled',
    'toast.totpNone': 'No code field found — copy manually',
    'toast.generated': 'New password generated',
    'toast.authorized': 'Authorized',
    'onboard.title': 'Ciphora desktop app not detected',
    'onboard.desc': 'The extension needs the locally running Ciphora app to read your passwords.',
    'onboard.installed': 'Already installed? Open Ciphora and enable the service under "Settings → Browser extension bridge" (off by default).',
    'onboard.download': 'Download Ciphora',
    'options.subtitle': 'Connect to the local Ciphora desktop app to autofill logins and MFA codes securely.',
    'options.portLabel': 'Bridge port',
    'options.portNote': 'Must match the "Listen port" in Ciphora settings (default 37123).',
    'options.save': 'Save & test',
    'options.test': 'Test only',
    'options.floatingLabel': 'Show a floating fill button on web pages',
    'options.floatingNote': 'When enabled, a floating arrow appears at the bottom-right of pages that contain login fields, for one-click filling without opening the popup.',
    'options.autoFillLabel': 'Auto-fill login pages by domain',
    'options.autoFillNote': 'When a login page\'s domain exactly matches a single saved entry, credentials are filled automatically (requires authorization in the popup first).',
    'options.howTitle': 'How to connect',
    'options.step1': 'Open the Ciphora desktop app.',
    'options.step2': 'Go to "Settings → General → Browser extension bridge" and turn it on.',
    'options.step3': 'Enter the same listen port here and click "Save & test".',
    'options.step4': 'Click the extension icon, press "Request authorization", then click "Allow" in the desktop app.',
    'options.note': 'This extension stores no long-lived token and never touches your master password: authorization pops up in the Ciphora desktop app for you to confirm, granting a short-lived session kept only in browser memory. Closing the browser, locking the vault, or restarting the app requires re-authorization. The bridge listens on 127.0.0.1 only and never uploads passwords.',
    'options.status.saving': 'Saved. Testing connection…',
    'options.status.testing': 'Testing connection…',
    'options.status.ok': 'Connected: {detail}',
    'options.status.fail': 'Connection failed (HTTP {code})',
    'options.status.offline': 'Cannot connect. Make sure Ciphora is running and the bridge is enabled.',
    'options.status.locked': 'vault locked',
    'options.status.unlocked': 'vault unlocked',
    'options.status.authorized': 'extension authorized',
    'options.status.unauthorized': 'extension not authorized'
  }
};

function detectLang() {
  const raw = (typeof navigator !== 'undefined' && navigator.language ? navigator.language : 'en').toLowerCase();
  return raw.startsWith('zh') ? 'zh-CN' : 'en';
}

const current = detectLang();

export function t(key, vars) {
  const dict = MESSAGES[current] || MESSAGES.en;
  let text = dict[key] ?? MESSAGES.en[key] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
    }
  }
  return text;
}

export function currentLang() {
  return current;
}

/** 应用 HTML 中的 data-i18n / data-i18n-placeholder / data-i18n-title。 */
export function applyI18n(root = document) {
  root.querySelectorAll('[data-i18n]').forEach((el) => {
    el.textContent = t(el.dataset.i18n);
  });
  root.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
    el.placeholder = t(el.dataset.i18nPlaceholder);
  });
  root.querySelectorAll('[data-i18n-title]').forEach((el) => {
    el.title = t(el.dataset.i18nTitle);
  });
  if (document.documentElement) document.documentElement.lang = current;
}