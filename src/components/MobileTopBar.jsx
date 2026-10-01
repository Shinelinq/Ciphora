import React from 'react';
import { ArrowRightOnRectangleIcon } from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';

/**
 * 移动端顶部栏。
 * 移动端隐藏了桌面 Header，这里提供品牌信息与退出入口，
 * 避免移动端用户无法退出登录。
 */
const MobileTopBar = ({ onLogout }) => {
    const { t } = useTranslation();

    return (
        <header className="flex-shrink-0 safe-area-top bg-white/80 dark:bg-gray-900/80 backdrop-blur border-b border-gray-100 dark:border-gray-800">
            <div className="flex items-center justify-between px-4 h-14">
                <div className="flex items-center gap-2 min-w-0">
                    <img src="/res/logo.png" alt="Ciphora" className="w-8 h-8 rounded-lg" />
                    <span className="text-lg font-bold text-gray-900 dark:text-white truncate">Ciphora</span>
                </div>
                <button
                    onClick={onLogout}
                    className="flex items-center gap-1 px-3 py-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-sm font-medium"
                    aria-label={t('header.logout')}
                >
                    <ArrowRightOnRectangleIcon className="w-5 h-5" />
                    <span>{t('header.logout')}</span>
                </button>
            </div>
        </header>
    );
};

export default MobileTopBar;