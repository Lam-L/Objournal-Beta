import React, { useEffect, useRef } from 'react';
import { JournalDataProvider } from '../context/JournalDataContext';
import { useJournalEntries } from '../hooks/useJournalEntries';
import { useFileSystemWatchers } from '../hooks/useFileSystemWatchers';
import { useScrollbarWidth } from '../hooks/useScrollbarWidth';
import { JournalHeader } from './JournalHeader';
import { JournalStats } from './JournalStats';
import { JournalList } from './JournalList';
import { JournalEmptyState } from './JournalEmptyState';
import { MenuProvider } from './JournalCardMenu';

// 内部组件：在 JournalDataProvider 内部使用文件系统监听器
const JournalViewWithWatchers: React.FC = () => {
	// 启用文件系统监听器（实时更新）
	useFileSystemWatchers();

	return (
		<div className="journal-content-wrapper">
			<JournalHeader />
			<JournalStats />
			<JournalList />
		</div>
	);
};

const JournalViewContent: React.FC = () => {
	const { entries, isLoading, error, refresh, updateSingleEntry, updateEntryAfterRename } = useJournalEntries();

	if (isLoading) {
		return (
			<div className="journal-view-container">
				<div>加载中...</div>
			</div>
		);
	}

	if (error !== null && error !== undefined) {
		const errorMessage = (error as Error).message || String(error);
		return (
			<div className="journal-view-container">
				<div>错误: {errorMessage}</div>
			</div>
		);
	}

	if (entries.length === 0) {
		return (
			<div className="journal-view-container">
				<JournalEmptyState />
			</div>
		);
	}

	return (
		<MenuProvider>
			<JournalDataProvider 
				entries={entries} 
				isLoading={isLoading} 
				error={error} 
				refresh={refresh} 
				updateSingleEntry={updateSingleEntry}
				updateEntryAfterRename={updateEntryAfterRename}
			>
				<JournalViewWithWatchers />
			</JournalDataProvider>
		</MenuProvider>
	);
};

export const JournalViewContainer: React.FC = () => {
	const containerRef = useRef<HTMLDivElement>(null);
	const scrollbarWidth = useScrollbarWidth();

	useEffect(() => {
		if (containerRef.current && scrollbarWidth > 0) {
			// 动态设置右侧 padding，补偿滚动条宽度
			// 这样左右 padding 在视觉上就完全一致了
			containerRef.current.style.setProperty(
				'--scrollbar-compensation',
				`${scrollbarWidth}px`
			);
		}
	}, [scrollbarWidth]);

	return (
		<div ref={containerRef} className="journal-view-container">
			<JournalViewContent />
		</div>
	);
};
