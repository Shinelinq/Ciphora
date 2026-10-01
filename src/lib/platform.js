/**
 * 平台能力探测。
 *
 * 通过后端 `get_app_info`（tauri-plugin-os）获取真实平台，
 * 并在首次渲染前用 UA 做同步兜底，保证移动端布局不闪烁。
 */

export const PLATFORM_EVENT = 'ciphora:platform';

let cachedPlatform = null;
let cachedIsMobile = null;

const MOBILE_PLATFORMS = ['android', 'ios'];

/** 同步兜底：仅靠 UA 判断平台。 */
export function detectPlatformFromUA() {
  if (typeof navigator === 'undefined') return 'web';
  const ua = navigator.userAgent || '';
  if (/Android/i.test(ua)) return 'android';
  if (/iPhone|iPad|iPod/i.test(ua)) return 'ios';
  if (/Macintosh|Mac OS X/i.test(ua)) return 'macos';
  if (/Windows/i.test(ua)) return 'windows';
  if (/Linux/i.test(ua)) return 'linux';
  return 'web';
}

function normalizePlatform(value) {
  if (!value) return null;
  const p = String(value).toLowerCase();
  if (p === 'darwin') return 'macos';
  if (p === 'win32') return 'windows';
  return p;
}

/** 获取当前平台（可能来自后端，也可能来自 UA 兜底）。 */
export function getPlatform() {
  if (typeof window !== 'undefined' && window.__ciphoraPlatform) {
    return window.__ciphoraPlatform;
  }
  if (!cachedPlatform) {
    cachedPlatform = detectPlatformFromUA();
  }
  return cachedPlatform;
}

/** 是否移动平台（Android / iOS）。 */
export function isMobilePlatform() {
  if (cachedIsMobile === null) {
    cachedIsMobile = MOBILE_PLATFORMS.includes(getPlatform());
  }
  return cachedIsMobile;
}

function applyPlatform(platform) {
  const normalized = normalizePlatform(platform) || detectPlatformFromUA();
  cachedPlatform = normalized;
  cachedIsMobile = MOBILE_PLATFORMS.includes(normalized);

  if (typeof window !== 'undefined') {
    window.__ciphoraPlatform = normalized;
    window.__ciphoraIsMobile = cachedIsMobile;
    window.dispatchEvent(new CustomEvent(PLATFORM_EVENT, { detail: normalized }));
  }
  return normalized;
}

// 启动时先用 UA 兜底，避免首屏闪烁
if (typeof window !== 'undefined') {
  cachedPlatform = detectPlatformFromUA();
  cachedIsMobile = MOBILE_PLATFORMS.includes(cachedPlatform);
  window.__ciphoraPlatform = cachedPlatform;
  window.__ciphoraIsMobile = cachedIsMobile;
}

/** 从后端读取真实平台信息并广播；可重复调用。 */
export async function initPlatform() {
  try {
    if (typeof window !== 'undefined' && window.__TAURI_INTERNALS__ && window.api?.getAppInfo) {
      const info = await window.api.getAppInfo();
      if (info?.platform) {
        return applyPlatform(info.platform);
      }
    }
  } catch (error) {
    console.warn('获取平台信息失败，回退到 UA 检测:', error);
  }
  return getPlatform();
}