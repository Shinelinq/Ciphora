import React, { useState, useRef } from 'react';
import {
  XMarkIcon,
  UserIcon,
  KeyIcon,
  GlobeAltIcon,
  ClipboardDocumentIcon,
  PencilIcon,
  TrashIcon,
  EyeIcon,
  EyeSlashIcon,
  ClockIcon,
  DocumentTextIcon,
  CodeBracketIcon,
  LockClosedIcon,
  ArrowTopRightOnSquareIcon,
} from '@heroicons/react/24/outline';
import TOTPDisplay from './TOTPDisplay';
import { copyToClipboard } from '../lib/utils';
import { useTranslation } from 'react-i18next';

const TYPE_META = {
  password: { icon: LockClosedIcon, color: 'text-blue-600', bg: 'bg-blue-50', badge: 'bg-blue-100 text-blue-700 border-blue-200' },
  mfa: { icon: ClockIcon, color: 'text-green-600', bg: 'bg-green-50', badge: 'bg-green-100 text-green-700 border-green-200' },
  base64: { icon: KeyIcon, color: 'text-amber-600', bg: 'bg-amber-50', badge: 'bg-amber-100 text-amber-700 border-amber-200' },
  string: { icon: DocumentTextIcon, color: 'text-rose-600', bg: 'bg-rose-50', badge: 'bg-rose-100 text-rose-700 border-rose-200' },
  json: { icon: CodeBracketIcon, color: 'text-purple-600', bg: 'bg-purple-50', badge: 'bg-purple-100 text-purple-700 border-purple-200' },
};

const Field = ({ icon, label, value, onCopy, actionIcon, onAction }) => (
  <div className="flex items-center gap-3 bg-gray-50 border border-gray-100 rounded-2xl px-3 py-2.5">
    <span className="text-gray-400 shrink-0">{icon}</span>
    <div className="min-w-0 flex-1">
      <div className="text-[10px] uppercase tracking-wider text-gray-400 leading-none mb-1">{label}</div>
      <div className="text-sm text-gray-800 truncate">{value}</div>
    </div>
    {onAction && (
      <button onClick={onAction} className="w-9 h-9 flex items-center justify-center rounded-xl text-gray-500 active:bg-gray-100">
        {actionIcon}
      </button>
    )}
    {onCopy && (
      <button onClick={onCopy} className="w-9 h-9 flex items-center justify-center rounded-xl text-blue-600 active:bg-gray-100">
        <ClipboardDocumentIcon className="w-5 h-5" />
      </button>
    )}
  </div>
);

const MobilePasswordSheet = ({ password, onClose, onEdit, onDelete, hideSensitiveButtons = false }) => {
  const { t } = useTranslation();
  const [showPassword, setShowPassword] = useState(false);
  const [dragY, setDragY] = useState(0);
  const panelRef = useRef(null);
  const dragStartRef = useRef(null);
  const canDragRef = useRef(false);

  if (!password) return null;

  const handleTouchStart = (e) => {
    // 仅在面板滚动到顶部时允许下拉关闭，避免与内容滚动冲突
    canDragRef.current = (panelRef.current?.scrollTop || 0) <= 0;
    dragStartRef.current = e.touches[0].clientY;
  };

  const handleTouchMove = (e) => {
    if (!canDragRef.current || dragStartRef.current == null) return;
    const delta = e.touches[0].clientY - dragStartRef.current;
    if (delta > 0) setDragY(delta);
  };

  const handleTouchEnd = () => {
    if (dragY > 110) {
      onClose?.();
    } else {
      setDragY(0);
    }
    dragStartRef.current = null;
    canDragRef.current = false;
  };

  const meta = TYPE_META[password.type] || TYPE_META.string;
  const Icon = meta.icon;
  const typeLabel = t(`dataTypes.${password.type || 'string'}`);
  const hasUsername = password.username && String(password.username).trim();

  const copy = async (value) => {
    await copyToClipboard(value);
    window.api?.incrementUsageCount?.(password.id);
  };

  const formatDate = (value) => {
    if (!value) return t('common.unknown');
    try {
      return new Date(value).toLocaleString();
    } catch {
      return t('common.unknown');
    }
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        className="w-full max-h-[88dvh] bg-white rounded-t-3xl overflow-y-auto safe-area-bottom animate-sheet-up"
        style={{ transform: `translateY(${dragY}px)`, transition: dragY ? 'none' : 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)' }}
        onClick={(e) => e.stopPropagation()}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* 把手 + 头部 */}
        <div className="sticky top-0 z-10 bg-white/95 backdrop-blur border-b border-gray-100">
          <div className="flex justify-center pt-2.5">
            <div className="w-10 h-1 rounded-full bg-gray-300" />
          </div>
          <div className="flex items-start gap-3 px-5 py-3">
            <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${meta.bg} ${meta.color}`}>
              <Icon className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-bold truncate">{password.website || t('common.unnamed')}</h2>
              <span className={`inline-block mt-1 text-[10px] px-2 py-0.5 rounded-full border ${meta.badge}`}>
                {typeLabel}
              </span>
            </div>
            <button onClick={onClose} className="w-9 h-9 flex items-center justify-center rounded-xl bg-gray-50 text-gray-500 active:bg-gray-100">
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="px-5 pt-4 pb-6 space-y-3">
          {/* 主凭据 */}
          {password.type === 'password' && password.password && (
            <div className="rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 px-4 py-3">
              <div className="text-[10px] uppercase tracking-wider text-blue-500 mb-1">{t('fields.password')}</div>
              <div className="flex items-center gap-2">
                <span className="flex-1 font-mono text-lg break-all">
                  {showPassword ? password.password : '••••••••••'}
                </span>
                <button onClick={() => setShowPassword(v => !v)} className="w-9 h-9 flex items-center justify-center text-gray-500">
                  {showPassword ? <EyeSlashIcon className="w-5 h-5" /> : <EyeIcon className="w-5 h-5" />}
                </button>
                <button onClick={() => copy(password.password)} className="w-9 h-9 flex items-center justify-center text-blue-600">
                  <ClipboardDocumentIcon className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}

          {password.type === 'mfa' && password.secret && (
            <TOTPDisplay
              compact
              secret={password.secret}
              issuer={password.website || 'Ciphora'}
              accountName={password.username || 'Account'}
            />
          )}

          {hasUsername && (
            <Field
              icon={<UserIcon className="w-5 h-5" />}
              label={t('fields.username')}
              value={password.username}
              onCopy={() => copy(password.username)}
            />
          )}

          {password.url && (
            <Field
              icon={<GlobeAltIcon className="w-5 h-5" />}
              label={t('fields.url')}
              value={password.url}
              onAction={() => window.api?.openUrl?.(password.url + (password.urlSuffix || ''))}
              actionIcon={<ArrowTopRightOnSquareIcon className="w-5 h-5" />}
            />
          )}

          {password.type === 'string' && password.stringData && (
            <div className="rounded-2xl bg-gray-50 border border-gray-100 p-3">
              <div className="text-[10px] uppercase tracking-wider text-gray-400 mb-1">{t('fields.stringData')}</div>
              <pre className="whitespace-pre-wrap break-words text-sm max-h-40 overflow-y-auto">{password.stringData}</pre>
              <button onClick={() => copy(password.stringData)} className="mt-2 text-xs text-blue-600">{t('common.copy')}</button>
            </div>
          )}

          {password.type === 'base64' && password.base64Data && (
            <div className="rounded-2xl bg-gray-50 border border-gray-100 p-3">
              <div className="text-[10px] uppercase tracking-wider text-gray-400 mb-1">{t('fields.base64Data')}</div>
              <pre className="whitespace-pre-wrap break-all text-xs max-h-40 overflow-y-auto">{password.base64Data}</pre>
              <button onClick={() => copy(password.base64Data)} className="mt-2 text-xs text-blue-600">{t('common.copy')}</button>
            </div>
          )}

          {password.type === 'json' && password.jsonData && (
            <div className="rounded-2xl bg-gray-50 border border-gray-100 p-3">
              <div className="text-[10px] uppercase tracking-wider text-gray-400 mb-1">{t('fields.jsonData')}</div>
              <pre className="whitespace-pre-wrap break-words text-xs max-h-40 overflow-y-auto">{password.jsonData}</pre>
              <button onClick={() => copy(password.jsonData)} className="mt-2 text-xs text-blue-600">{t('common.copy')}</button>
            </div>
          )}

          {password.notes && (
            <div className="rounded-2xl bg-gray-50 border border-gray-100 p-3">
              <div className="text-[10px] uppercase tracking-wider text-gray-400 mb-1">{t('fields.notes')}</div>
              <p className="text-sm text-gray-700 break-words whitespace-pre-wrap">{password.notes}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 text-[10px] px-1 pt-1">
            <div>
              <div className="text-gray-400 uppercase tracking-wider mb-0.5">{t('fields.createdAt')}</div>
              <div className="font-medium text-gray-600">{formatDate(password.createdAt)}</div>
            </div>
            <div>
              <div className="text-gray-400 uppercase tracking-wider mb-0.5">{t('fields.updatedAt')}</div>
              <div className="font-medium text-gray-600">{formatDate(password.updatedAt)}</div>
            </div>
          </div>

          {/* 操作 */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={() => onEdit?.(password)}
              className="flex-1 h-12 rounded-2xl bg-blue-600 text-white font-semibold flex items-center justify-center gap-2 active:bg-blue-700"
            >
              <PencilIcon className="w-5 h-5" /> {t('common.edit')}
            </button>
            {!hideSensitiveButtons && (
              <button
                onClick={() => onDelete?.(password)}
                className="flex-1 h-12 rounded-2xl bg-red-50 text-red-600 font-semibold flex items-center justify-center gap-2 active:bg-red-100"
              >
                <TrashIcon className="w-5 h-5" /> {t('common.delete')}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MobilePasswordSheet;