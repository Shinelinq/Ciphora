import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './components/App';
import './input.css';
import './api/tauri-api';
import i18n, { normalizeLanguage, LANG_EXPLICIT_KEY } from './i18n';
import { initPlatform } from './lib/platform';

// 添加一些调试信息
console.log('React app starting...');

// 修复在部分系统下无法删除字符的问题
window.addEventListener('keydown', (e) => {
    const isInput = e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable;
    if (isInput && (e.key === 'Backspace' || e.key === 'Delete')) {
        // 强制停止冒泡和同级监听器，确保事件留在输入框内
        e.stopPropagation();
        if (e.stopImmediatePropagation) e.stopImmediatePropagation();
    }
}, true); // 使用捕获阶段优先处理

const renderApp = () => {
    const root = ReactDOM.createRoot(document.getElementById('app'));
    root.render(
        <React.StrictMode>
            <App />
        </React.StrictMode>
    );

    // 异步获取平台信息，用于移动端能力适配
    initPlatform().catch(err => console.error('Failed to init platform:', err));

    // 异步获取语言，不阻塞首屏渲染
    if (window.api && window.api.getSystemLocale) {
        window.api.getSystemLocale().then(locale => {
            console.log('System locale detected:', locale);
            // 未显式选择过语言时，以系统语言为准（不依赖 WebView 的 navigator.language）
            if (locale && !localStorage.getItem(LANG_EXPLICIT_KEY)) {
                i18n.changeLanguage(normalizeLanguage(locale));
            }
            // 同步当前语言到后端，用于本地化系统托盘菜单
            window.api.setAppLanguage?.(i18n.resolvedLanguage || i18n.language);
        }).catch(err => console.error('Failed to get locale:', err));
    }

    // 语言切换时同步到后端（重建托盘菜单）
    i18n.on('languageChanged', (lang) => {
        window.api?.setAppLanguage?.(normalizeLanguage(lang));
    });
};

renderApp(); 