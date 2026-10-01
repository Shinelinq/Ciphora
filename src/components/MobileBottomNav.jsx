import React from 'react';
import {
  HomeIcon,
  ShieldCheckIcon,
  CogIcon,
  QrCodeIcon,
} from '@heroicons/react/24/outline';
import {
  HomeIcon as HomeIconSolid,
  ShieldCheckIcon as ShieldCheckIconSolid,
  CogIcon as CogIconSolid,
  QrCodeIcon as QrCodeIconSolid,
} from '@heroicons/react/24/solid';
import { useTranslation } from 'react-i18next';

export default function MobileBottomNav({ currentView, onViewChange, onShowCimbar }) {
  const { t } = useTranslation();
  const navItems = [
    {
      id: 'main',
      label: t('header.vault'),
      icon: HomeIcon,
      iconSolid: HomeIconSolid,
      view: 'main',
    },
    {
      id: 'dashboard',
      label: t('header.dashboard'),
      icon: ShieldCheckIcon,
      iconSolid: ShieldCheckIconSolid,
      view: 'dashboard',
    },
    {
      id: 'cimbar',
      label: t('header.transfer'),
      icon: QrCodeIcon,
      iconSolid: QrCodeIconSolid,
      view: null,
      action: onShowCimbar,
    },
    {
      id: 'settings',
      label: t('settings.title'),
      icon: CogIcon,
      iconSolid: CogIconSolid,
      view: 'settings',
    },
  ];

  return (
    <nav className="bottom-nav safe-area-bottom">
      {navItems.map((item) => {
        const isActive = currentView === item.view;
        const Icon = isActive ? item.iconSolid : item.icon;

        return (
          <button
            key={item.id}
            onClick={() => {
              if (item.action) {
                item.action();
              } else if (item.view) {
                onViewChange(item.view);
              }
            }}
            className={`relative flex flex-col items-center justify-center gap-0.5 flex-1 mx-1 my-1.5 py-1.5 rounded-xl transition-all active:scale-95 ${
              isActive
                ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10'
                : 'text-gray-500 dark:text-gray-400'
            }`}
          >
            <Icon className="w-6 h-6" />
            <span className="text-[10px] font-medium leading-none">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}