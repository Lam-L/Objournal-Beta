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
		this.targetFolderPath = state?.targetFolderPath || null;
		// 如果 React 组件已渲染，更新它
		if (this.root) {
			this.renderReact();
		}
	}

	async onOpen(): Promise<void> {
		const container = this.containerEl.children[1] as HTMLElement;
		if (!container) {
			return;
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
