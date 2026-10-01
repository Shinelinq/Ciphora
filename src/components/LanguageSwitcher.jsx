import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { LanguageIcon, CheckIcon } from '@heroicons/react/24/outline';

const languages = [
  { code: 'zh-CN', name: '简体中文', nativeName: '简体中文' },
  { code: 'en', name: 'English', nativeName: 'English' }
];

const LanguageSwitcher = () => {
  const { i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handleClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const changeLanguage = (code) => {
    try {
      // 记录为用户显式选择，之后不再被系统语言覆盖
      localStorage.setItem('i18nextLng', code);
      localStorage.setItem('ciphora.langExplicit', '1');
    } catch {
      // 忽略：localStorage 不可用
    }
    i18n.changeLanguage(code);
    setOpen(false);
  };

  const activeLang = i18n.resolvedLanguage || i18n.language;
  const currentLang = languages.find(lang => lang.code === activeLang) || languages[0];

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
        title="切换语言 / Switch Language"
      >
        <LanguageIcon className="w-5 h-5" />
        <span>{currentLang.nativeName}</span>
      </button>

      {open && (
        <div className="absolute top-full right-0 mt-2 z-50 bg-white rounded-xl shadow-xl border border-gray-100 py-1.5 min-w-[160px]">
          {languages.map(lang => {
            const active = activeLang === lang.code;
            return (
              <button
                key={lang.code}
                onClick={() => changeLanguage(lang.code)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors ${
                  active ? 'text-blue-600 bg-blue-50' : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <span className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 border ${
                  active ? 'bg-blue-600 border-blue-600' : 'border-gray-300'
                }`}>
                  {active && <CheckIcon className="w-3 h-3 text-white" />}
                </span>
                <span className="flex-1 text-left">{lang.nativeName}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default LanguageSwitcher;
