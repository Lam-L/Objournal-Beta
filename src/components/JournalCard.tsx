import React, { memo, useRef, useState } from 'react';
import { strings } from '../i18n';
import { JournalEntry, formatDate } from '../utils/utils';
import { CONTENT } from '../constants';
import { JournalImageContainer } from './JournalImageContainer';
import { JournalCardMenu } from './JournalCardMenu';
import { useJournalView } from '../context/JournalViewContext';

interface JournalCardProps {
	entry: JournalEntry;
	/** 虚拟化列表中设为 true，图片直接渲染避免闪烁 */
	skipLazyLoad?: boolean;
}

export const JournalCard: React.FC<JournalCardProps> = memo(({ entry, skipLazyLoad = false }) => {
	const { app, plugin } = useJournalView();
	const cardRef = useRef<HTMLDivElement>(null);
	const scrollContainerRef = useRef<HTMLElement | null>(null);
	const lastScrollTopRef = useRef<number>(0);

	// 获取滚动容器引用
	React.useEffect(() => {
		const scrollContainer = document.querySelector('.journal-list-container') as HTMLElement;
		if (scrollContainer) {
			scrollContainerRef.current = scrollContainer;
			lastScrollTopRef.current = scrollContainer.scrollTop;
		}
	}, []);

	const handleCardClick = async (e: React.MouseEvent) => {
		// 检查点击目标是否是卡片本身或其子元素（排除图片点击和菜单按钮）
		const target = e.target as HTMLElement;

		// 如果点击的是图片容器，不处理（图片有自己的点击事件）
		if (target.closest('.journal-image-container')) {
			return;
		}

		// 如果点击的是菜单按钮或菜单，不处理
		if (target.closest('.journal-card-menu-button') || target.closest('.journal-card-menu')) {
			return;
		}

		// 检查是否在滚动（参考原始实现）
		if (scrollContainerRef.current) {
			const currentScrollTop = scrollContainerRef.current.scrollTop;
			const isScrolling = currentScrollTop !== lastScrollTopRef.current;
			lastScrollTopRef.current = currentScrollTop;

			// 如果刚刚滚动过，不打开文件
			if (isScrolling) {
				return;
			}
		}

		// 打开文件
		try {
			// 获取打开方式设置
			let openInNewTab = true; // 默认在新标签页打开
			if (plugin) {
				const pluginSettings = (plugin as any).settings;
				if (pluginSettings?.openInNewTab !== undefined) {
					openInNewTab = pluginSettings.openInNewTab;
				}
			}

			if (openInNewTab) {
				// 在新标签页打开
				app.workspace.openLinkText(entry.file.path, '', true);
			} else {
				// 在当前标签页打开
				// 获取当前活动的 leaf，如果它是手记视图，直接使用它；否则获取一个可用的 leaf
				const activeLeaf = app.workspace.activeLeaf;
				let targetLeaf = activeLeaf;

				// 如果当前活动的 leaf 是手记视图，直接使用它
				// 否则获取一个可用的 leaf（getLeaf(false) 会返回可导航的 leaf 或创建新的）
				if (activeLeaf && activeLeaf.getViewState().type === 'journal-view-react') {
					// 当前是手记视图，直接使用它来打开文件（会替换视图）
					targetLeaf = activeLeaf;
				} else {
					// 当前不是手记视图，获取一个可用的 leaf
					targetLeaf = app.workspace.getLeaf(false);
				}

				if (targetLeaf) {
					await targetLeaf.openFile(entry.file, { active: true });
				}
			}
		} catch (error) {
			console.error('Failed to open file:', entry.file.path, error);
		}
	};

	return (
		<div ref={cardRef} className="journal-card" onClick={handleCardClick}>
			{/* 图片 */}
			{entry.images.length > 0 && (
				<JournalImageContainer
					images={entry.images.slice(0, CONTENT.MAX_IMAGES_PER_CARD)}
					totalImages={entry.images.length}
					allImages={entry.images}
					skipLazyLoad={skipLazyLoad}
				/>
			)}

			{/* 标题 */}
			{entry.title && (
				<h3 className="journal-title">{entry.title}</h3>
			)}

			{/* 内容预览 */}
			<div className="journal-content">
				<div className="journal-preview">{entry.preview}</div>
			</div>

			{/* 日期和菜单按钮容器 */}
			<div className="journal-date-container">
				<div className="journal-date">{formatDate(entry.date)}</div>
				<JournalCardMenu
					app={app}
					entry={entry}
					onDelete={async () => {
						try {
							await app.vault.delete(entry.file);
							// 文件删除后，实时更新会自动处理
						} catch (error) {
							console.error('删除文件失败:', error);
							alert(strings.card.deleteFailed);
						}
					}}
				/>
			</div>
		</div>
	);
}, (prevProps, nextProps) => {
	// 自定义比较函数：只有当关键属性变化时才重新渲染
	return (
		prevProps.entry.file.path === nextProps.entry.file.path &&
		prevProps.entry.file.stat.mtime === nextProps.entry.file.stat.mtime &&
		prevProps.entry.title === nextProps.entry.title &&
		prevProps.entry.preview === nextProps.entry.preview &&
		prevProps.entry.images.length === nextProps.entry.images.length &&
		prevProps.entry.date.getTime() === nextProps.entry.date.getTime()
	);
});
