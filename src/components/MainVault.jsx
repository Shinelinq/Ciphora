import React, { useState, useMemo, useCallback, useRef } from 'react';
import PasswordCard from './PasswordCard';
import MobilePasswordList from './MobilePasswordList';
import SearchBox from './SearchBox';
import GroupTabs from './GroupTabs';
import GroupManageModal from './GroupManageModal';
import { useGroups } from '../hooks/useGroups';
import { PlusIcon, ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { haptic } from '../lib/utils';
import { useMobile } from '../hooks/useMobile';
import { useTranslation } from 'react-i18next';

const MainVault = ({ passwords = [], isLoading = false, onAddPassword, onEditPassword, onDeletePassword, onRefresh, hideSensitiveButtons = false, settings = null, activeSheetPassword = null, onSheetPasswordChange }) => {
    const { t } = useTranslation();
    const [searchQuery, setSearchQuery] = useState('');
    const { isMobile } = useMobile();
    const { groups, addGroup, updateGroup, deleteGroup } = useGroups();
    const [selectedGroupIds, setSelectedGroupIds] = useState([]); // [] = all
    const [showGroupModal, setShowGroupModal] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);

    // 移动端滑删：先隐藏并弹出「撤销」条，超时后再真正删除
    const [pendingDelete, setPendingDelete] = useState(null);
    const pendingDeleteRef = useRef(null);
    const pendingTimerRef = useRef(null);

    const requestDelete = useCallback((password) => {
        // 若已有待删项，先立即提交，避免覆盖丢失
        if (pendingDeleteRef.current) {
            if (pendingTimerRef.current) clearTimeout(pendingTimerRef.current);
            onDeletePassword(pendingDeleteRef.current.id);
        }
        const commit = () => {
            const target = pendingDeleteRef.current;
            pendingDeleteRef.current = null;
            pendingTimerRef.current = null;
            setPendingDelete(null);
            if (target) onDeletePassword(target.id);
        };
        pendingDeleteRef.current = password;
        setPendingDelete(password);
        pendingTimerRef.current = setTimeout(commit, 5000);
        haptic(15);
    }, [onDeletePassword]);

    const undoDelete = useCallback(() => {
        if (pendingTimerRef.current) {
            clearTimeout(pendingTimerRef.current);
            pendingTimerRef.current = null;
        }
        pendingDeleteRef.current = null;
        setPendingDelete(null);
        haptic(10);
    }, []);

    const filteredByGroup = passwords.filter(password => {
        if (pendingDelete && password.id === pendingDelete.id) return false;
        if (selectedGroupIds.length === 0) return true;
        return selectedGroupIds.some(id => {
            if (id === 'ungrouped') return !password.groupId;
            return password.groupId === id;
        });
    });

    const sq = searchQuery.toLowerCase();
    const filteredPasswords = filteredByGroup.filter(password => {
        const str = (v) => (typeof v === 'string' ? v : String(v ?? '')).toLowerCase();
        return str(password.website).includes(sq) ||
            str(password.username).includes(sq) ||
            str(password.description).includes(sq) ||
            str(password.type).includes(sq);
    });

    // 排序逻辑
    const sortedPasswords = useMemo(() => {
        const order = settings?.ui?.cardOrder || 'usage';
        return [...filteredPasswords].sort((a, b) => {
            switch (order) {
                case 'usage':
                    return (b.usageCount || 0) - (a.usageCount || 0);
                case 'createdAt':
                    return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
                case 'updatedAt':
                    return new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0);
                case 'username': {
                    const au = typeof a.username === 'string' ? a.username : String(a.username ?? '');
                    const bu = typeof b.username === 'string' ? b.username : String(b.username ?? '');
                    return au.localeCompare(bu);
                }
                default:
                    return 0;
            }
        });
    }, [filteredPasswords, settings?.ui?.cardOrder]);

    // 分页逻辑
    const paginationEnabled = settings?.ui?.pagination?.enabled || false;
    const pageSize = settings?.ui?.pagination?.pageSize || 20;
    
    const totalPages = Math.ceil(sortedPasswords.length / pageSize);
    const paginatedPasswords = useMemo(() => {
        if (!paginationEnabled) return sortedPasswords;
        const start = (currentPage - 1) * pageSize;
        return sortedPasswords.slice(start, start + pageSize);
    }, [sortedPasswords, paginationEnabled, currentPage, pageSize]);

    // 当搜索或过滤变化时重置页码
    React.useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery, selectedGroupIds]);

    const handleDelete = (password) => {
        if (confirm(t('vault.deleteConfirm', { website: password.website }))) {
            onDeletePassword(password.id);
        }
    };

    const renderPagination = () => {
        if (!paginationEnabled || totalPages <= 1) return null;

        return (
            <div className="flex items-center justify-center gap-1.5 lg:gap-2 mt-4 lg:mt-8 pb-4 lg:pb-12">
                <button
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="p-2 rounded-lg bg-white border border-gray-200 text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
                >
                    <ChevronLeftIcon className="w-5 h-5" />
                </button>
                
                <div className="flex items-center gap-1">
                    {[...Array(totalPages)].map((_, i) => {
                        const page = i + 1;
                        // 只显示当前页附近的页码
                        if (totalPages > 7) {
                            if (page !== 1 && page !== totalPages && Math.abs(page - currentPage) > 1) {
                                if (page === 2 || page === totalPages - 1) {
                                    return <span key={page} className="px-1 text-gray-400">...</span>;
                                }
                                return null;
                            }
                        }
                        
                        return (
                            <button
                                key={page}
                                onClick={() => setCurrentPage(page)}
                                className={`w-8 h-8 lg:w-10 lg:h-10 rounded-lg border text-xs lg:text-sm font-medium transition-all ${
                                    currentPage === page
                                        ? 'bg-blue-600 border-blue-600 text-white shadow-md'
                                        : 'bg-white border-gray-200 text-gray-600 hover:border-blue-400 hover:text-blue-600'
                                }`}
                            >
                                {page}
                            </button>
                        );
                    }).filter(Boolean)}
                </div>

                <button
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    className="p-2 rounded-lg bg-white border border-gray-200 text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
                >
                    <ChevronRightIcon className="w-5 h-5" />
                </button>
            </div>
        );
    };

    return (
        <div className="h-full flex flex-col">
            {/* Toolbar: group tabs | search | buttons in one row */}
            <div className={`flex-shrink-0 ${isMobile ? 'p-3 safe-area-top' : 'p-4'}`}>
                <div className={`max-w-7xl mx-auto ${isMobile ? 'space-y-3' : 'flex items-center gap-3'}`}>
                    {/* Group tabs — occupy remaining space */}
                    {isMobile ? (
                        <GroupTabs
                            selectedGroupIds={selectedGroupIds}
                            onGroupFilterChange={setSelectedGroupIds}
                            groups={groups}
                            passwords={passwords}
                            onManageGroups={() => setShowGroupModal(true)}
                        />
                    ) : (
                        <div className="flex-1 min-w-0">
                            <GroupTabs
                                selectedGroupIds={selectedGroupIds}
                                onGroupFilterChange={setSelectedGroupIds}
                                groups={groups}
                                passwords={passwords}
                                onManageGroups={() => setShowGroupModal(true)}
                            />
                        </div>
                    )}

                    {/* Search + add — fixed width on right */}
                    {!isMobile && (
                        <div className="flex items-center gap-2 flex-shrink-0">
                            <div className="w-96">
                                <SearchBox value={searchQuery} onChange={setSearchQuery} />
                            </div>
                            <div
                                onClick={onAddPassword}
                                disabled={isLoading}
                                className="inline-flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all duration-200 shadow-md hover:shadow-lg transform hover:-translate-y-0.5 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                            >
                                <PlusIcon className="w-4 h-4" />
                                <span>{isLoading ? t('common.loading') : t('common.add')}</span>
                            </div>
                        </div>
                    )}

                    {/* Mobile: Search + add */}
                    {isMobile && (
                        <div className="flex items-center gap-2">
                            <div className="flex-1">
                                <SearchBox value={searchQuery} onChange={setSearchQuery} />
                            </div>
                            <button
                                onClick={onAddPassword}
                                disabled={isLoading}
                                className="inline-flex items-center justify-center w-10 h-10 bg-blue-600 text-white rounded-xl active:bg-blue-700 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                            >
                                <PlusIcon className="w-5 h-5" />
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Scrollable card grid */}
            <div className="flex-1 overflow-y-auto swipe-container">
                <div className={`max-w-7xl mx-auto ${isMobile ? 'px-3 pt-2 pb-24' : 'px-4 sm:px-6 lg:px-8 pt-4 pb-24'}`}>
                    {isLoading ? (
                        <div className="text-center py-12">
                            <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                            <p className="text-gray-600">{t('common.loading')}</p>
                        </div>
                    ) : paginatedPasswords.length > 0 ? (
                        <>
                            {isMobile ? (
                                <MobilePasswordList
                                    passwords={paginatedPasswords}
                                    onEdit={onEditPassword}
                                    onDelete={requestDelete}
                                    hideSensitiveButtons={hideSensitiveButtons}
                                    activePassword={activeSheetPassword}
                                    onPasswordChange={onSheetPasswordChange}
                                />
                            ) : (
                                <div className={`grid ${isMobile ? 'grid-cols-1 gap-3' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'}`}>
                                    {paginatedPasswords.map((password) => (
                                        <div key={password.id} className="relative h-full">
                                            <PasswordCard
                                                password={password}
                                                onEdit={onEditPassword}
                                                onDelete={handleDelete}
                                                hideSensitiveButtons={hideSensitiveButtons}
                                            />
                                        </div>
                                    ))}
                                </div>
                            )}
                            {renderPagination()}
                        </>
                    ) : (
                        <div className="text-center py-8 lg:py-12">
                            <div className="w-16 h-16 lg:w-24 lg:h-24 bg-gradient-to-br from-gray-200 to-gray-300 rounded-full flex items-center justify-center mx-auto mb-3 lg:mb-4">
                                <PlusIcon className="w-8 h-8 lg:w-12 lg:h-12 text-gray-400" />
                            </div>
                            <h3 className="text-lg lg:text-xl font-semibold text-gray-600 mb-2">
                                {searchQuery ? t('vault.noResults') : t('vault.noPasswords')}
                            </h3>
                            <p className="text-sm lg:text-base text-gray-500 mb-4 lg:mb-6 px-4">
                                {searchQuery ? t('vault.noResultsDesc') : t('vault.noPasswordsDesc')}
                            </p>
                            {!searchQuery && (
                                <button
                                    onClick={onAddPassword}
                                    className="inline-flex items-center gap-2 px-5 py-2.5 lg:px-6 lg:py-3 bg-blue-600 text-white rounded-xl active:bg-blue-700 lg:hover:bg-blue-700 transition-all shadow-sm lg:shadow-lg font-medium text-sm lg:text-base"
                                >
                                    <PlusIcon className="w-5 h-5" />
                                    <span>{t('vault.addFirstPassword')}</span>
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <GroupManageModal
                isOpen={showGroupModal}
                onClose={() => setShowGroupModal(false)}
                groups={groups}
                onAdd={addGroup}
                onUpdate={updateGroup}
                onDelete={deleteGroup}
            />

            {/* 滑删撤销条 */}
            {pendingDelete && (
                <div className="fixed left-1/2 -translate-x-1/2 bottom-20 lg:bottom-8 z-[70] flex items-center gap-2 bg-gray-900 text-white pl-4 pr-1.5 py-2 rounded-2xl shadow-2xl animate-sheet-up">
                    <span className="text-sm max-w-[60vw] truncate">
                        {t('vault.deletedItem', { website: pendingDelete.website || t('common.unnamed') })}
                    </span>
                    <button
                        onClick={undoDelete}
                        className="text-sm font-bold text-blue-300 px-3 py-1.5 rounded-xl active:bg-white/10 shrink-0"
                    >
                        {t('common.undo')}
                    </button>
                </div>
            )}
        </div>
    );
};

export default MainVault;
