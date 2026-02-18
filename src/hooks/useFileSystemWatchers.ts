import { useEffect, useRef, useCallback } from 'react';
import { TAbstractFile, TFile, EventRef } from 'obsidian';
import { useJournalView } from '../context/JournalViewContext';
import { useJournalData } from '../context/JournalDataContext';

export const useFileSystemWatchers = () => {
    const { app, targetFolderPath } = useJournalView();
    const { refresh, updateSingleEntry } = useJournalData();
    const refreshTimerRef = useRef<number | null>(null);
    const eventRefsRef = useRef<EventRef[]>([]);

    const shouldRefreshForFile = useCallback((file: TAbstractFile): boolean => {
        if (!(file instanceof TFile)) {
            return false;
        }

        if (file.extension !== 'md') {
            return false;
        }

        if (targetFolderPath && !file.path.startsWith(targetFolderPath)) {
            return false;
        }

        return true;
    }, [targetFolderPath]);

    const debouncedRefresh = useCallback(() => {
        if (refreshTimerRef.current) {
            clearTimeout(refreshTimerRef.current);
        }

        refreshTimerRef.current = window.setTimeout(() => {
            refresh();
            refreshTimerRef.current = null;
        }, 500); // 增加防抖时间到 500ms，减少频繁刷新
    }, [refresh]);

    useEffect(() => {
        const handleFileCreate = (file: TAbstractFile) => {
            if (shouldRefreshForFile(file)) {
                debouncedRefresh();
            }
        };

        const handleFileDelete = (file: TAbstractFile) => {
            if (shouldRefreshForFile(file)) {
                debouncedRefresh();
            }
        };

        const handleFileModify = (file: TAbstractFile) => {
            if (shouldRefreshForFile(file) && file instanceof TFile) {
                // 对于修改操作，使用增量更新
                updateSingleEntry(file);
            }
        };

        const handleFileRename = (file: TAbstractFile, oldPath: string) => {
            const oldPathInTarget = targetFolderPath ? oldPath.startsWith(targetFolderPath) : true;
            const newPathInTarget = shouldRefreshForFile(file);

            if (oldPathInTarget || newPathInTarget) {
                debouncedRefresh();
            }
        };

        const handleMetadataChange = (file: TAbstractFile | null) => {
            if (!file) {
                return;
            }

            if (shouldRefreshForFile(file) && file instanceof TFile) {
                // 对于元数据变化，使用增量更新
                updateSingleEntry(file);
            }
        };

        // 注册 Vault 事件监听器
        const vaultEventRefs: EventRef[] = [
            app.vault.on('create', handleFileCreate),
            app.vault.on('delete', handleFileDelete),
            app.vault.on('rename', handleFileRename),
            app.vault.on('modify', handleFileModify),
        ];

        // 注册 Metadata Cache 事件监听器
        const metadataEventRef = app.metadataCache.on('changed', handleMetadataChange);

        // 保存所有事件引用
        eventRefsRef.current = [...vaultEventRefs, metadataEventRef];

        // 清理函数
        return () => {
            // 清理防抖定时器
            if (refreshTimerRef.current) {
                clearTimeout(refreshTimerRef.current);
                refreshTimerRef.current = null;
            }

            // 清理所有事件监听器
            eventRefsRef.current.forEach((eventRef) => {
                app.vault.offref(eventRef);
            });
            app.metadataCache.offref(metadataEventRef);
            eventRefsRef.current = [];
        };
    }, [app, targetFolderPath, shouldRefreshForFile, debouncedRefresh]);
};
