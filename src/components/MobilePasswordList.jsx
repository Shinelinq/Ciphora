import React, { useRef, useState } from 'react';
import {
  LockClosedIcon,
  ClockIcon,
  KeyIcon,
  DocumentTextIcon,
  CodeBracketIcon,
  ChevronRightIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import MobilePasswordSheet from './MobilePasswordSheet';
import { haptic } from '../lib/utils';
import { useTranslation } from 'react-i18next';

const TYPE_META = {
  password: { icon: LockClosedIcon, color: 'text-blue-600', bg: 'bg-blue-50' },
  mfa: { icon: ClockIcon, color: 'text-green-600', bg: 'bg-green-50' },
  base64: { icon: KeyIcon, color: 'text-amber-600', bg: 'bg-amber-50' },
  string: { icon: DocumentTextIcon, color: 'text-rose-600', bg: 'bg-rose-50' },
  json: { icon: CodeBracketIcon, color: 'text-purple-600', bg: 'bg-purple-50' },
};

const OPEN_WIDTH = 84;

/**
 * 可左滑显示删除按钮的列表行。
 * 使用 pan-y，让浏览器处理纵向滚动，横向手势交给 JS。
 */
const SwipeRow = ({ onOpen, onDelete, deleteLabel, children }) => {
  const swipeEnabled = Boolean(onDelete);
  const [offset, setOffset] = useState(0);
  const startRef = useRef(null);
  const draggingRef = useRef(false);
  const suppressClickRef = useRef(false);
  const offsetRef = useRef(0);

  const setOff = (value) => {
    offsetRef.current = value;
    setOffset(value);
  };

  const handleTouchStart = (e) => {
    startRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    draggingRef.current = false;
  };

  const handleTouchMove = (e) => {
    if (!swipeEnabled || !startRef.current) return;
    const dx = e.touches[0].clientX - startRef.current.x;
    const dy = e.touches[0].clientY - startRef.current.y;
    if (!draggingRef.current) {
      // 判定为横向滑动前，先让位给纵向滚动
      if (Math.abs(dx) < 8 || Math.abs(dx) < Math.abs(dy)) return;
      draggingRef.current = true;
    }
    const base = offsetRef.current < 0 ? -OPEN_WIDTH : 0;
    setOff(Math.max(-OPEN_WIDTH, Math.min(0, base + dx)));
  };

  const handleTouchEnd = () => {
    if (draggingRef.current) {
      suppressClickRef.current = true;
      const shouldOpen = offsetRef.current < -OPEN_WIDTH / 2;
      setOff(shouldOpen ? -OPEN_WIDTH : 0);
      if (shouldOpen) haptic(10);
      setTimeout(() => { suppressClickRef.current = false; }, 0);
    }
    startRef.current = null;
  };

  const handleClick = () => {
    if (suppressClickRef.current || draggingRef.current) return;
    if (offsetRef.current < 0) {
      setOff(0);
      return;
    }
    onOpen();
  };

  return (
    <div className="relative overflow-hidden">
      {/* 背景删除按钮 */}
      {swipeEnabled && (
        <button
          onClick={() => { haptic(15); onDelete?.(); }}
          aria-label={deleteLabel}
          className="absolute inset-y-0 right-0 flex flex-col items-center justify-center gap-1 bg-red-500 text-white"
          style={{ width: OPEN_WIDTH }}
        >
          <TrashIcon className="w-5 h-5" />
          <span className="text-[10px] font-medium">{deleteLabel}</span>
        </button>
      )}

      {/* 可滑动的前景内容 */}
      <div
        className="relative bg-white"
        style={{
          transform: `translateX(${offset}px)`,
          transition: draggingRef.current ? 'none' : 'transform 0.2s ease',
          touchAction: 'pan-y',
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <button
          onClick={handleClick}
          className="w-full flex items-center gap-3 px-4 py-3 text-left active:bg-gray-50 transition-colors"
        >
          {children}
        </button>
      </div>
    </div>
  );
};

/**
 * 移动端密码列表。
 * 系统设置式的分组列表（无阴影大卡片），点击行从底部弹出详情，
 * 左滑行可露出删除按钮。
 */
const MobilePasswordList = ({ passwords = [], onEdit, onDelete, hideSensitiveButtons = false, activePassword, onPasswordChange }) => {
  const { t } = useTranslation();
  const [internalActive, setInternalActive] = useState(null);
  // 受控模式：状态提升到 App，以便 Android 返回键能关闭详情面板
  const isControlled = typeof onPasswordChange === 'function';
  const active = isControlled ? activePassword : internalActive;
  const setActive = isControlled ? onPasswordChange : setInternalActive;

  return (
    <>
      <ul className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-100 overflow-hidden">
        {passwords.map((password) => {
          const meta = TYPE_META[password.type] || TYPE_META.string;
          const Icon = meta.icon;
          const subtitle = password.username?.trim?.() || t(`dataTypes.${password.type || 'string'}`);

          return (
            <li key={password.id}>
              <SwipeRow
                deleteLabel={t('common.delete')}
                onOpen={() => setActive(password)}
                onDelete={hideSensitiveButtons ? undefined : () => onDelete?.(password)}
              >
                <span className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${meta.bg} ${meta.color}`}>
                  <Icon className="w-5 h-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-medium text-gray-900 truncate">
                    {password.website || t('common.unnamed')}
                  </span>
                  <span className="block text-xs text-gray-500 truncate mt-0.5">
                    {subtitle}
                  </span>
                </span>
                <ChevronRightIcon className="w-4 h-4 text-gray-300 shrink-0" />
              </SwipeRow>
            </li>
          );
        })}
      </ul>

      {active && (
        <MobilePasswordSheet
          password={active}
          hideSensitiveButtons={hideSensitiveButtons}
          onClose={() => setActive(null)}
          onEdit={(p) => {
            setActive(null);
            onEdit?.(p);
          }}
          onDelete={(p) => {
            setActive(null);
            onDelete?.(p);
          }}
        />
      )}
    </>
  );
};

export default MobilePasswordList;