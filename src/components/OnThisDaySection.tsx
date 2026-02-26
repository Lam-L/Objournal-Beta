import React from 'react';
import { useJournalData } from '../context/JournalDataContext';
import { useOnThisDay } from '../context/OnThisDayContext';
import { JournalCard } from './JournalCard';
import { getOnThisDayEntries, getLatestOnThisDayWithinYear, formatYearsAgo } from '../utils/onThisDay';

export const OnThisDaySection: React.FC = () => {
	const { entries } = useJournalData();
	const { displayMode } = useOnThisDay();
	const onThisDayEntries = getOnThisDayEntries(entries);

	if (displayMode === 'hidden') return null;
	if (onThisDayEntries.length === 0) return null;

	const entriesToShow = displayMode === 'single' ? [getLatestOnThisDayWithinYear(entries)!] : onThisDayEntries;

	return (
		<div className="on-this-day-section">
			<div className="on-this-day-section-header">
				<span className="on-this-day-section-title">那年今日</span>
			</div>
			<div className="on-this-day-section-list">
				{entriesToShow.map((entry) => (
					<div key={entry.file.path} className="on-this-day-section-card-wrapper">
						<div className="on-this-day-section-label">{formatYearsAgo(entry)}</div>
						<JournalCard entry={entry} />
					</div>
				))}
			</div>
		</div>
	);
};
