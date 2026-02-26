import React from 'react';
import { TFolder, TFile } from 'obsidian';
import { useJournalView } from '../context/JournalViewContext';
import { useJournalData } from '../context/JournalDataContext';
import { useOnThisDay } from '../context/OnThisDayContext';

export const JournalHeader: React.FC = () => {
	const { app, plugin, targetFolderPath } = useJournalView();
	const { refresh } = useJournalData();
	const { cycleDisplayMode, displayMode } = useOnThisDay();

	const handleCreateNote = async () => {
		try {
			// 确定目标文件夹
			let targetFolder: TFolder | null = null;

			if (targetFolderPath) {
				const folder = app.vault.getAbstractFileByPath(targetFolderPath);
				if (folder instanceof TFolder) {
					targetFolder = folder;
				}
			}

			// 如果没有指定文件夹，使用Vault根目录
			if (!targetFolder) {
				// 尝试获取第一个顶级文件夹，或者使用根目录
				const rootFolders = app.vault.getAllFolders();
				if (rootFolders.length > 0) {
					// 使用第一个文件夹的父目录（通常是根目录）
					targetFolder = rootFolders[0].parent;
				}
			}

			if (!targetFolder) {
				console.error('无法确定目标文件夹');
				return;
			}

			// 生成文件名（使用当前日期）
			const today = new Date();
			const year = today.getFullYear();
			const month = String(today.getMonth() + 1).padStart(2, '0');
			const day = String(today.getDate()).padStart(2, '0');
			const fileName = `${year}-${month}-${day}.md`;
			const filePath = targetFolder.path === '/'
				? fileName
				: `${targetFolder.path}/${fileName}`;

			// 检查文件是否已存在，如果存在则添加时间戳
			let finalPath = filePath;
			let counter = 1;
			while (await app.vault.adapter.exists(finalPath)) {
				const timeStr = `${String(today.getHours()).padStart(2, '0')}-${String(today.getMinutes()).padStart(2, '0')}`;
				finalPath = targetFolder.path === '/'
					? `${year}-${month}-${day}-${timeStr}.md`
					: `${targetFolder.path}/${year}-${month}-${day}-${timeStr}.md`;
				counter++;
				// 防止无限循环
				if (counter > 100) break;
			}

			// 获取模板（从插件设置中获取）
			let fileContent = '';
			// @ts-ignore - plugin 可能是 JournalPlugin，需要访问 settings
			if (plugin && (plugin as any).settings && (plugin as any).settings.defaultTemplate) {
				// @ts-ignore
				const template = (plugin as any).settings.defaultTemplate;
				// 替换模板变量
				fileContent = template
					.replace(/\{\{date\}\}/g, `${year}-${month}-${day}`)
					.replace(/\{\{year\}\}/g, String(year))
					.replace(/\{\{month\}\}/g, month)
					.replace(/\{\{day\}\}/g, day)
					.replace(/\{\{title\}\}/g, `${year}年${month}月${day}日`);
			} else {
				// 使用默认格式
				fileContent = `---
date: ${year}-${month}-${day}
---

# ${year}年${month}月${day}日

`;
			}

			// 创建文件
			const newFile = await app.vault.create(finalPath, fileContent);

			// 打开新创建的文件
			await app.workspace.openLinkText(finalPath, '', true);

			// 等待文件元数据（创建时间）完全更新后刷新
			// 延迟足够的时间，确保文件元数据已完全更新
			setTimeout(async () => {
				// 重新获取文件对象，确保获取最新的元数据
				const file = app.vault.getAbstractFileByPath(finalPath);
				if (file instanceof TFile) {
					console.debug('准备刷新，新文件信息:', {
						path: file.path,
						ctime: new Date(file.stat.ctime).toISOString(),
						ctimeMs: file.stat.ctime
					});
				}

				// 执行刷新
				await refresh();
			}, 500);
		} catch (error) {
			console.error('创建笔记失败:', error);
		}
	};

	return (
		<div className="journal-header">
			<div className="journal-title-container">
				<h1 className="journal-title-header">手记</h1>
				<div className="journal-header-buttons">
					<button
						className={`journal-header-button journal-header-button-on-this-day ${displayMode === 'hidden' ? 'journal-header-button-on-this-day-inactive' : ''}`}
						onClick={cycleDisplayMode}
						title={
							displayMode === 'single'
								? '那年今日：最近一条（点击切换为展示全部）'
								: displayMode === 'all'
									? '那年今日：展示全部（点击切换为隐藏）'
									: '那年今日：已隐藏（点击切换为展示）'
						}
					>
						<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
							<rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
							<line x1="16" y1="2" x2="16" y2="6"></line>
							<line x1="8" y1="2" x2="8" y2="6"></line>
							<line x1="3" y1="10" x2="21" y2="10"></line>
						</svg>
						<span className="journal-header-button-label">那年今日</span>
					</button>
					<button
						className="journal-header-button journal-header-button-primary"
						onClick={handleCreateNote}
						title="新建笔记"
					>
						<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
							<line x1="12" y1="5" x2="12" y2="19"></line>
							<line x1="5" y1="12" x2="19" y2="12"></line>
						</svg>
					</button>
				</div>
			</div>
		</div>
	);
};
