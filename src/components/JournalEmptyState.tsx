import React from 'react';
import { useJournalView } from '../context/JournalViewContext';

export const JournalEmptyState: React.FC = () => {
	const { app } = useJournalView();

	const handleScan = async () => {
		// TODO: 实现扫描逻辑
		console.log('Scan files');
	};

	return (
		<div className="journal-welcome">
			<div className="journal-welcome-card">
				<h2>欢迎使用手记视图</h2>
				<p>还没有找到任何手记文件</p>
				<button className="journal-welcome-button" onClick={handleScan}>
					开始扫描
				</button>
			</div>
		</div>
	);
};
