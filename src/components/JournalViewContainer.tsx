import React, { useEffect, useRef } from 'react';
import { JournalDataProvider } from '../context/JournalDataContext';
import { strings } from '../i18n';
import { useJournalEntries } from '../hooks/useJournalEntries';
import { useFileSystemWatchers } from '../hooks/useFileSystemWatchers';
import { useScrollbarWidth } from '../hooks/useScrollbarWidth';
import { JournalViewModeProvider, useJournalViewMode } from '../context/JournalViewModeContext';
import { JournalHeader } from './JournalHeader';
import { JournalStats } from './JournalStats';
import { OnThisDaySection } from './OnThisDaySection';
import { JournalList } from './JournalList';
import { JournalCalendar } from './JournalCalendar';
import { JournalEmptyState } from './JournalEmptyState';
import { MenuProvider } from './JournalCardMenu';
import { useJournalView } from '../context/JournalViewContext';

// 内部组件：在 JournalDataProvider 内部使用文件系统监听器
const JournalViewWithWatchers: React.FC = () => {
	useFileSystemWatchers();
	const { plugin } = useJournalView();
	const showStats = (plugin as { settings?: { showJournalStats?: boolean } })?.settings?.showJournalStats === true;

	return (
		<JournalViewModeProvider>
			<div className="journal-content-wrapper">
				<JournalHeader />
				{showStats && <JournalStats />}
				<JournalViewContentArea />
			</div>
		</JournalViewModeProvider>
	);
};

const JournalViewContentArea: React.FC = () => {
	const { viewMode } = useJournalViewMode();
	if (viewMode === 'calendar') {
		return (
			<div className="journal-calendar-with-list">
				<JournalCalendar />
				<OnThisDaySection />
				<JournalList />
			</div>
		);
	}
	return (
		<>
			<OnThisDaySection />
			<JournalList />
		</>
	);
};

const JournalViewContent: React.FC = () => {
	const { entries, isLoading, error, refresh, updateSingleEntry, updateEntryAfterRename } = useJournalEntries();

	if (isLoading) {
		return (
			<div className="journal-view-container">
				<div>{strings.common.loading}</div>
			</div>
		);
	}

	if (error !== null && error !== undefined) {
		const errorMessage = (error as Error).message || String(error);
		return (
			<div className="journal-view-container">
				<div>{strings.common.error}: {errorMessage}</div>
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
	const [hasOverflow, setHasOverflow] = React.useState(false);

	useEffect(() => {
		const el = containerRef.current;
		if (!el) return;

		const checkOverflow = () => {
			const overflow = el.scrollHeight > el.clientHeight;
			setHasOverflow((prev) => (prev !== overflow ? overflow : prev));
		};

		checkOverflow();

		const resizeObserver = new ResizeObserver(checkOverflow);
		resizeObserver.observe(el);

		const mutationObserver = new MutationObserver(() => {
			requestAnimationFrame(checkOverflow);
		});
		mutationObserver.observe(el, { childList: true, subtree: true });

		return () => {
			resizeObserver.disconnect();
			mutationObserver.disconnect();
		};
	}, []);

	useEffect(() => {
		if (!containerRef.current) return;
		const compensation = hasOverflow ? scrollbarWidth : 0;
		containerRef.current.style.setProperty('--scrollbar-width', `${compensation}px`);
	}, [scrollbarWidth, hasOverflow]);

	return (
		<div ref={containerRef} className="journal-view-container">
			<JournalViewContent />
		</div>
	);
};
