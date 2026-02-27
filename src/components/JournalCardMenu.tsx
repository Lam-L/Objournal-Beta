import React, { useState, useEffect, useRef, useContext, createContext } from 'react';
import { App } from 'obsidian';
import { JournalEntry } from '../utils/utils';
import { strings } from '../i18n';
import { DeleteConfirmModal } from '../utils/DeleteConfirmModal';

// 全局菜单状态管理（确保只有一个菜单打开）
interface MenuContextValue {
	openMenuId: string | null;
	setOpenMenuId: (id: string | null) => void;
}

const MenuContext = createContext<MenuContextValue | null>(null);

export const MenuProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
	const [openMenuId, setOpenMenuId] = useState<string | null>(null);
	return (
		<MenuContext.Provider value={{ openMenuId, setOpenMenuId }}>
			{children}
		</MenuContext.Provider>
	);
};

const useMenuContext = () => {
	const context = useContext(MenuContext);
	if (!context) {
		throw new Error('useMenuContext must be used within MenuProvider');
	}
	return context;
};

interface JournalCardMenuProps {
	app: App;
	entry: JournalEntry;
	onDelete: () => void;
}

export const JournalCardMenu: React.FC<JournalCardMenuProps> = ({ app, entry, onDelete }) => {
	const { openMenuId, setOpenMenuId } = useMenuContext();
	const menuId = entry.file.path;
	const isOpen = openMenuId === menuId;
	const menuRef = useRef<HTMLDivElement>(null);
	const buttonRef = useRef<HTMLDivElement>(null);

	// 点击外部关闭菜单
	useEffect(() => {
		if (!isOpen) return;

		const handleClickOutside = (e: MouseEvent) => {
			if (
				menuRef.current &&
				buttonRef.current &&
				!menuRef.current.contains(e.target as Node) &&
				!buttonRef.current.contains(e.target as Node)
			) {
				setOpenMenuId(null);
			}
		};

		// 延迟添加事件监听器，避免立即触发
		setTimeout(() => {
			document.addEventListener('click', handleClickOutside);
		}, 0);

		return () => {
			document.removeEventListener('click', handleClickOutside);
		};
	}, [isOpen, setOpenMenuId]);

	const handleButtonClick = (e: React.MouseEvent) => {
		e.stopPropagation(); // 阻止事件冒泡到卡片
		if (isOpen) {
			setOpenMenuId(null);
		} else {
			setOpenMenuId(menuId);
		}
	};

	const handleDeleteClick = (e: React.MouseEvent) => {
		e.stopPropagation();
		setOpenMenuId(null); // 先关闭菜单，避免焦点问题
		new DeleteConfirmModal(app, {
			message: strings.card.deleteConfirm(entry.title || entry.file.basename),
			confirmText: strings.common.delete,
			cancelText: strings.common.cancel,
			onConfirm: onDelete,
		}).open();
	};

	const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});

	// 计算菜单位置（在菜单打开后）
	useEffect(() => {
		if (!isOpen || !buttonRef.current || !menuRef.current) {
			return;
		}

		const updateMenuPosition = () => {
			if (!buttonRef.current || !menuRef.current) return;

			const buttonRect = buttonRef.current.getBoundingClientRect();
			const card = buttonRef.current.closest('.journal-card') as HTMLElement;
			if (!card) return;

			const cardRect = card.getBoundingClientRect();
			const menuRect = menuRef.current.getBoundingClientRect();

			// 菜单显示在按钮上方，右对齐
			const relativeTop = buttonRect.top - cardRect.top;
			const relativeRight = cardRect.right - buttonRect.right;

			setMenuStyle({
				position: 'absolute',
				top: `${relativeTop - menuRect.height - 8}px`,
				right: `${relativeRight}px`,
			});
		};

		// 延迟计算，确保菜单已渲染
		setTimeout(updateMenuPosition, 0);
	}, [isOpen]);

	return (
		<>
			<div
				ref={buttonRef}
				className="journal-card-menu-button"
				onClick={handleButtonClick}
				aria-label="更多选项"
			>
				<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
					<circle cx="12" cy="12" r="1"></circle>
					<circle cx="5" cy="12" r="1"></circle>
					<circle cx="19" cy="12" r="1"></circle>
				</svg>
			</div>
			{isOpen && (
				<div
					ref={menuRef}
					className="journal-card-menu"
					style={menuStyle}
					onClick={(e) => e.stopPropagation()}
				>
					<div className="journal-card-menu-item" onClick={handleDeleteClick}>
						<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
							<polyline points="3 6 5 6 21 6"></polyline>
							<path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
						</svg>
						<span>{strings.common.delete}</span>
					</div>
				</div>
			)}
		</>
	);
};
