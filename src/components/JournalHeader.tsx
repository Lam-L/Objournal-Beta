import React from 'react';
import { TFolder, TFile } from 'obsidian';
import { useJournalView } from '../context/JournalViewContext';
import { useJournalData } from '../context/JournalDataContext';
import { useJournalViewMode } from '../context/JournalViewModeContext';
import { strings } from '../i18n';

export const JournalHeader: React.FC = () => {
	const { app, plugin, targetFolderPath } = useJournalView();
	const { refresh } = useJournalData();
	const { viewMode, cycleViewMode } = useJournalViewMode();

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

			// 获取内容：仅当设置了模板文件时从模板读取并替换变量，否则留空
			let fileContent = '';
			const templatePath = (plugin as { settings?: { templatePath?: string | null } })?.settings?.templatePath;

			if (templatePath) {
				const today = new Date();
				const year = today.getFullYear();
				const month = String(today.getMonth() + 1).padStart(2, '0');
				const day = String(today.getDate()).padStart(2, '0');
				const titleStr = `${year}年${month}月${day}日`;
				const timeStr = `${String(today.getHours()).padStart(2, '0')}-${String(today.getMinutes()).padStart(2, '0')}`;
				const templateFile = app.vault.getAbstractFileByPath(templatePath);
				if (templateFile instanceof TFile) {
					try {
						const raw = await app.vault.read(templateFile);
						fileContent = raw
							.replace(/\{\{date\}\}/g, `${year}-${month}-${day}`)
							.replace(/\{\{year\}\}/g, String(year))
							.replace(/\{\{month\}\}/g, month)
							.replace(/\{\{day\}\}/g, day)
							.replace(/\{\{title\}\}/g, titleStr)
							.replace(/\{\{time\}\}/g, timeStr);
					} catch {
						// 模板读取失败时留空
					}
				}
			}

			// 文件名：Untitled，冲突时加编号
			let finalPath = targetFolder.path === '/' ? 'Untitled.md' : `${targetFolder.path}/Untitled.md`;
			let counter = 1;
			while (await app.vault.adapter.exists(finalPath)) {
				finalPath = targetFolder.path === '/'
					? `Untitled ${counter}.md`
					: `${targetFolder.path}/Untitled ${counter}.md`;
				counter++;
				if (counter > 100) break;
			}

			// 创建文件
			const newFile = await app.vault.create(finalPath, fileContent);

			// 打开新创建的文件：根据设置决定在新标签页或当前标签页打开
			const openInNewTab = (plugin as { settings?: { openInNewTab?: boolean } })?.settings?.openInNewTab !== false;
			if (openInNewTab) {
				await app.workspace.openLinkText(finalPath, '', true);
			} else {
				const activeLeaf = app.workspace.activeLeaf;
				const targetLeaf =
					activeLeaf?.getViewState?.().type === 'journal-view-react'
						? activeLeaf
						: app.workspace.getLeaf(false);
				await targetLeaf?.openFile(newFile, { active: true });
			}

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
				<h1 className="journal-title-header">{strings.view.title}</h1>
				<div className="journal-header-buttons">
					<button
						className={`journal-header-button journal-header-button-view-mode ${viewMode === 'calendar' ? 'journal-header-button-view-mode-active' : ''}`}
						onClick={cycleViewMode}
						title={viewMode === 'list' ? strings.view.switchToCalendar : strings.view.switchToList}
						aria-label={viewMode === 'list' ? strings.view.switchToCalendar : strings.view.switchToList}
					>
						{viewMode === 'list' ? (
							<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
								<rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
								<line x1="16" y1="2" x2="16" y2="6" />
								<line x1="8" y1="2" x2="8" y2="6" />
								<line x1="3" y1="10" x2="21" y2="10" />
							</svg>
						) : (
							<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
								<line x1="8" y1="6" x2="21" y2="6" />
								<line x1="8" y1="12" x2="21" y2="12" />
								<line x1="8" y1="18" x2="21" y2="18" />
								<line x1="3" y1="6" x2="3.01" y2="6" />
								<line x1="3" y1="12" x2="3.01" y2="12" />
								<line x1="3" y1="18" x2="3.01" y2="18" />
							</svg>
						)}
					</button>
					<button
						className="journal-header-button journal-header-button-primary"
						onClick={handleCreateNote}
						title={strings.view.newNote}
						aria-label={strings.view.newNote}
					>
						<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
							<line x1="12" y1="5" x2="12" y2="19" />
							<line x1="5" y1="12" x2="19" y2="12" />
						</svg>
					</button>
				</div>
			</div>
		</div>
	);
};
