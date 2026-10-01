import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import enTranslation from './locales/en.json';
import zhCNTranslation from './locales/zh-CN.json';

const resources = {
  en: {
    translation: enTranslation
  },
  'zh-CN': {
    translation: zhCNTranslation
  }
};

/** 用户显式选择过语言的标记（存在时才尊重缓存，否则跟随系统语言）。 */
export const LANG_EXPLICIT_KEY = 'ciphora.langExplicit';

/**
 * 归一化语言标签。
 * 系统/浏览器可能给出 zh、zh_CN、zh-Hans、zh-Hans-CN、zh-TW 等变体，
 * 统一归到已注册的 zh-CN / en，避免匹配不到而回退英文。
 */
export const normalizeLanguage = (lng) => {
  const value = String(lng || '').toLowerCase();
  if (value.startsWith('zh')) return 'zh-CN';
  return 'en';
};

/** 同步初值：仅当用户显式选择过才用缓存，否则用页面语言（随后由系统语言纠正）。 */
const getInitialLanguage = () => {
  try {
    if (localStorage.getItem(LANG_EXPLICIT_KEY)) {
      return normalizeLanguage(localStorage.getItem('i18nextLng'));
    }
    return normalizeLanguage(document.documentElement.lang || 'zh-CN');
  } catch {
    return 'zh-CN';
  }
};

i18n.use(initReactI18next).init({
  resources,
  lng: getInitialLanguage(),
  supportedLngs: ['en', 'zh-CN'],
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false
  }
});

// 同步 <html lang>，兼顾可访问性与下一次启动的同步初值
i18n.on('languageChanged', (lang) => {
  if (typeof document !== 'undefined') {
    document.documentElement.lang = normalizeLanguage(lang);
  }
});

export default i18n;