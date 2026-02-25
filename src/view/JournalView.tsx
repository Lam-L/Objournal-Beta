import { ItemView, WorkspaceLeaf, App, Plugin } from 'obsidian';
import { createRoot, Root } from 'react-dom/client';
import React from 'react';
import { JournalViewProvider } from '../context/JournalViewContext';
import { JournalViewContainer } from '../components/JournalViewContainer';

export const JOURNAL_VIEW_TYPE = 'journal-view-react';

export class JournalView extends ItemView {
	private root: Root | null = null;
	private plugin: Plugin | null = null;
	public targetFolderPath: string | null = null;

	constructor(leaf: WorkspaceLeaf, app: App, plugin?: Plugin) {
		super(leaf);
		this.plugin = plugin || null;
	}

	async refresh(): Promise<void> {
		// 重新渲染 React 组件以触发数据刷新
		if (this.root) {
			this.renderReact();
		}
	}

	getViewType(): string {
		return JOURNAL_VIEW_TYPE;
	}

	getDisplayText(): string {
		return '手记视图';
	}

	getIcon(): string {
		return 'calendar';
	}

	getState(): any {
		return {
			targetFolderPath: this.targetFolderPath,
		};
	}

	async setState(state: any): Promise<void> {
		// 如果状态中有 targetFolderPath，使用它
		// 否则保持当前值（如果存在），避免被意外清空
		if (state?.targetFolderPath !== undefined) {
			this.targetFolderPath = state.targetFolderPath;
		} else if (this.targetFolderPath === null && this.plugin) {
			// 如果当前值为 null 且状态中没有，尝试从插件设置中恢复
			const pluginSettings = (this.plugin as any).settings;
			if (pluginSettings?.defaultFolderPath) {
				this.targetFolderPath = pluginSettings.defaultFolderPath;
			} else if (pluginSettings?.folderPath) {
				this.targetFolderPath = pluginSettings.folderPath;
			}
		}
		// 如果 React 组件已渲染，更新它
		if (this.root) {
			this.renderReact();
		}
	}

	async onOpen(): Promise<void> {
		// 使用 ItemView 的 contentEl（Obsidian 官方 API），避免依赖 DOM 结构
		const container = this.contentEl;
		if (!container) {
			return;
		}

		// 确保 targetFolderPath 被正确设置
		// 优先使用已保存的状态，如果没有则从插件设置中恢复
		if (this.targetFolderPath === null && this.plugin) {
			const pluginSettings = (this.plugin as any).settings;
			if (pluginSettings?.defaultFolderPath) {
				this.targetFolderPath = pluginSettings.defaultFolderPath;
			} else if (pluginSettings?.folderPath) {
				this.targetFolderPath = pluginSettings.folderPath;
			}
		}

		// 应用图片间距设置
		if (this.plugin) {
			const pluginSettings = (this.plugin as any).settings;
			if (pluginSettings?.imageGap !== undefined) {
				document.documentElement.style.setProperty('--journal-image-gap', `${pluginSettings.imageGap}px`);
			}
		}

		// 创建 React Root
		this.root = createRoot(container);
		this.renderReact();
	}

	async onClose(): Promise<void> {
		if (this.root) {
			this.root.unmount();
			this.root = null;
		}
	}

	private renderReact(): void {
		if (!this.root) {
			return;
		}

		// 应用图片间距设置（每次渲染时更新）
		if (this.plugin) {
			const pluginSettings = (this.plugin as any).settings;
			if (pluginSettings?.imageGap !== undefined) {
				document.documentElement.style.setProperty('--journal-image-gap', `${pluginSettings.imageGap}px`);
			}
		}

		this.root.render(
			<React.StrictMode>
				<JournalViewProvider
					app={this.app}
					plugin={this.plugin}
					targetFolderPath={this.targetFolderPath}
				setTargetFolderPath={(path: string | null) => {
					this.targetFolderPath = path;
					this.renderReact();
				}}
				>
					<JournalViewContainer />
				</JournalViewProvider>
			</React.StrictMode>
		);
	}
}
