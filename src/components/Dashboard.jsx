import React, { useState } from 'react';
import {
    LockClosedIcon,
    PlusIcon,
    HashtagIcon,
    ShieldCheckIcon,
    KeyIcon,
    CogIcon,
    TrashIcon,
    ArrowUpTrayIcon,
    ArrowDownTrayIcon,
    QrCodeIcon,
} from "@heroicons/react/24/outline";

import { BentoCard, BentoGrid } from "./ui/bento-grid";
import ImportExportModal from "./ImportExportModal";
import SecurityModal from "./SecurityModal";
import { useMobile } from '../hooks/useMobile';
import { useTranslation } from 'react-i18next';

// 创建 features 数组的函数
const createFeatures = (passwordCount, t) => [
    {
        Icon: PlusIcon,
        name: t('dashboard.addPassword.name'),
        description: t('dashboard.addPassword.description'),
        href: "#",
        cta: t('dashboard.addPassword.cta'),
        ctaClassName: "h-8 px-3 text-xs",
        background: (
            <div className="absolute -right-20 -top-20 h-40 w-40 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-600/50 blur-3xl" />
        ),
        className: "lg:row-start-1 lg:row-end-4 lg:col-start-2 lg:col-end-3",
    },
    {
        Icon: HashtagIcon,
        name: t('dashboard.passwordCount.name'),
        description: t('dashboard.passwordCount.description'),
        href: "#",
        cta: "",
        comment: (
            <div className="pointer-events-none absolute right-4 top-3 text-4xl font-bold text-green-600/80 lg:inset-0 lg:flex lg:items-center lg:justify-center lg:text-7xl lg:text-green-600">
                {passwordCount}
            </div>
        ),
        background: (
            <div className="absolute -right-20 -top-20 h-40 w-40 rounded-full bg-gradient-to-br from-green-500/20 to-blue-600/50 blur-3xl" />
        ),
        className: "lg:col-start-1 lg:col-end-2 lg:row-start-1 lg:row-end-3",
    },
    {
        Icon: ShieldCheckIcon,
        name: t('dashboard.security.name'),
        description: t('dashboard.security.description'),
        href: "#",
        cta: t('dashboard.security.cta'),
        background: (
            <div className="absolute -right-20 -top-20 h-40 w-40 rounded-full bg-gradient-to-br from-red-500/20 to-orange-600/50 blur-3xl" />
        ),
        className: "lg:col-start-1 lg:col-end-2 lg:row-start-3 lg:row-end-4",
    },
    {
        Icon: ArrowUpTrayIcon,
        name: t('dashboard.exportBackup.name'),
        description: t('dashboard.exportBackup.description'),
        href: "#",
        cta: t('dashboard.exportBackup.cta'),
        ctaClassName: "h-8 px-3 text-xs",
        background: (
            <div className="absolute -right-20 -top-20 h-40 w-40 rounded-full bg-gradient-to-br from-teal-500/20 to-green-600/50 blur-3xl" />
        ),
        className: "lg:col-start-3 lg:col-end-4 lg:row-start-2 lg:row-end-3",
    },
    {
        Icon: ArrowDownTrayIcon,
        name: t('dashboard.importData.name'),
        description: t('dashboard.importData.description'),
        href: "#",
        cta: t('dashboard.importData.cta'),
        ctaClassName: "h-8 px-3 text-xs",
        background: (
            <div className="absolute -right-20 -top-20 h-40 w-40 rounded-full bg-gradient-to-br from-indigo-500/20 to-purple-600/50 blur-3xl" />
        ),
        className: "lg:col-start-3 lg:col-end-4 lg:row-start-1 lg:row-end-2",
    },
    {
        Icon: QrCodeIcon,
        name: t('dashboard.cimbar.name'),
        description: t('dashboard.cimbar.description'),
        href: "#",
        cta: t('dashboard.cimbar.cta'),
        ctaClassName: "h-10 px-4 text-sm",
        background: (
            <div className="absolute inset-0 flex items-center justify-center opacity-40">
                <div className="w-full h-full bg-white/90 border border-dashed border-blue-400 border-2 rounded-xl flex items-center justify-center shadow-inner">
                    {/* <QrCodeIcon className="w-16 h-16 text-blue-500" /> */}
                </div>
            </div>
        ),
        className: "lg:col-start-3 lg:col-end-4 lg:row-start-3 lg:row-end-4",
    },
];

function Dashboard({ onAddPassword, onSearch, onSettings, onClearData, onImportPasswords, onExportPasswords, onCreateBackup, onRestoreBackup, passwordCount = 0, onShowCimbar }) {
    const { t } = useTranslation();
    const [showImportModal, setShowImportModal] = useState(false);
    const [showExportModal, setShowExportModal] = useState(false);
    const [showSecurityModal, setShowSecurityModal] = useState(false);
    const { isMobile } = useMobile();

    // 处理导入功能
    const handleImportClick = () => {
        setShowImportModal(true);
    };

    // 处理导出功能
    const handleExportClick = () => {
        setShowExportModal(true);
    };

    // 处理导入确认
    const handleImportConfirm = (format) => {
        onImportPasswords(format);
    };

    // 处理导出确认
    const handleExportConfirm = (format) => {
        onExportPasswords(format);
    };

    // 处理安全原理查看
    const handleSecurityClick = () => {
        setShowSecurityModal(true);
    };

    // 创建动态功能数组
    const features = createFeatures(passwordCount, t);

    // 更新功能数组，添加点击处理
    const featuresWithHandlers = features.map(feature => {
        if (feature.name === t('dashboard.addPassword.name')) {
            return { ...feature, onClick: onAddPassword };
        } else if (feature.name === t('dashboard.importData.name')) {
            return { ...feature, onClick: handleImportClick };
        } else if (feature.name === t('dashboard.exportBackup.name')) {
            return { ...feature, onClick: handleExportClick };
        } else if (feature.name === t('dashboard.security.name')) {
            return { ...feature, onClick: handleSecurityClick };
        } else if (feature.name === t('dashboard.cimbar.name')) {
            return { ...feature, onClick: onShowCimbar };
        }
        return feature;
    });

    // 移动端：使用简洁的操作面板（图标宫格 + 统计头部），不沿用桌面 bento 大卡
    if (isMobile) {
        const mobileActions = [
            { id: 'add', Icon: PlusIcon, name: t('dashboard.addPassword.name'), desc: t('dashboard.addPassword.description'), onClick: onAddPassword, color: 'from-blue-500 to-indigo-500' },
            { id: 'import', Icon: ArrowDownTrayIcon, name: t('dashboard.importData.name'), onClick: handleImportClick, color: 'from-indigo-500 to-purple-500' },
            { id: 'export', Icon: ArrowUpTrayIcon, name: t('dashboard.exportBackup.name'), onClick: handleExportClick, color: 'from-teal-500 to-emerald-500' },
            { id: 'cimbar', Icon: QrCodeIcon, name: t('dashboard.cimbar.name'), onClick: onShowCimbar, color: 'from-sky-500 to-blue-500' },
            { id: 'security', Icon: ShieldCheckIcon, name: t('dashboard.security.name'), onClick: handleSecurityClick, color: 'from-rose-500 to-orange-500' },
        ];

        return (
            <div className="h-full overflow-y-auto bg-slate-50 px-4 pt-4 pb-24">
                {/* 统计头部 */}
                <div className="mb-4 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white p-4 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-white/15 flex items-center justify-center">
                            <HashtagIcon className="w-5 h-5" />
                        </div>
                        <div>
                            <div className="text-xs opacity-80">{t('dashboard.passwordCount.name')}</div>
                            <div className="text-2xl font-bold leading-tight">{passwordCount}</div>
                        </div>
                    </div>
                </div>

                {/* 操作宫格 */}
                <div className="grid grid-cols-2 gap-3">
                    {mobileActions.map((action) => (
                        <button
                            key={action.id}
                            onClick={action.onClick}
                            className={`relative overflow-hidden rounded-2xl bg-white border border-gray-100 p-4 text-left active:scale-[0.98] transition-transform ${action.id === 'add' ? 'col-span-2' : ''}`}
                        >
                            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${action.color} text-white flex items-center justify-center mb-3`}>
                                <action.Icon className="w-5 h-5" />
                            </div>
                            <div className="text-sm font-semibold text-gray-900">{action.name}</div>
                            {action.desc && (
                                <div className="text-xs text-gray-400 mt-0.5 line-clamp-2">{action.desc}</div>
                            )}
                        </button>
                    ))}
                </div>

                <ImportExportModal
                    isOpen={showImportModal}
                    onClose={() => setShowImportModal(false)}
                    onImport={handleImportConfirm}
                    onExport={null}
                    type="import"
                />
                <ImportExportModal
                    isOpen={showExportModal}
                    onClose={() => setShowExportModal(false)}
                    onImport={null}
                    onExport={handleExportConfirm}
                    type="export"
                />
                <SecurityModal
                    isOpen={showSecurityModal}
                    onClose={() => setShowSecurityModal(false)}
                />
            </div>
        );
    }

    return (
        <div className={`h-full bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 ${isMobile ? 'p-4 overflow-y-auto' : 'p-8 overflow-hidden'}`}>
            {/* Bento Grid Features */}
            <div className={isMobile ? 'mb-4' : 'mb-12'}>
                <div className="max-w-7xl mx-auto">
                    <BentoGrid className={isMobile ? 'grid-rows-auto' : 'lg:grid-rows-3'}>
                        {featuresWithHandlers.map((feature) => (
                            <BentoCard key={feature.name} {...feature} />
                        ))}
                    </BentoGrid>
                </div>
            </div>

            {/* Import Modal */}
            <ImportExportModal
                isOpen={showImportModal}
                onClose={() => setShowImportModal(false)}
                onImport={handleImportConfirm}
                onExport={null}
                type="import"
            />

            {/* Export Modal */}
            <ImportExportModal
                isOpen={showExportModal}
                onClose={() => setShowExportModal(false)}
                onImport={null}
                onExport={handleExportConfirm}
                type="export"
            />

            {/* Security Modal */}
            <SecurityModal
                isOpen={showSecurityModal}
                onClose={() => setShowSecurityModal(false)}
            />
        </div>
    );
}

export default Dashboard; 