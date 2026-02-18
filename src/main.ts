import { Plugin, TFolder } from 'obsidian';
import { JournalView, JOURNAL_VIEW_TYPE } from './view/JournalView';
import { JournalPluginSettings, DEFAULT_SETTINGS } from './settings';
import { JournalSettingTab } from './settings/JournalSettingTab';
import { EditorImageLayout } from './EditorImageLayout';

export class JournalViewPlugin extends Plugin {
	settings: JournalPluginSettings;
	view: JournalView | null = null;
	private editorImageLayout: EditorImageLayout | null = null;

	async onload() {
		await this.loadSettings();

		// 初始化编辑器图片布局增强
		this.editorImageLayout = new EditorImageLayout(this.app, this);
		this.editorImageLayout.initialize();

		// 注册视图
		this.registerView(JOURNAL_VIEW_TYPE, (leaf) => {
			const view = new JournalView(leaf, this.app, this);
			this.view = view;
			return view;
		});

		// 添加命令打开视图
		this.addCommand({
			id: 'open-journal-view',
			name: '打开手记视图',
			callback: () => {
				this.activateView();
			},
		});

		// 添加命令刷新手记视图
		this.addCommand({
			id: 'refresh-journal-view',
			name: '刷新手记视图',
			callback: () => {
				if (this.view) {
					this.view.refresh();
				}
			},
		});

		// 添加设置标签
		this.addSettingTab(new JournalSettingTab(this.app, this));

		// 如果已经有打开的视图，激活它
		this.app.workspace.onLayoutReady(() => {
			const existingLeaf = this.app.workspace.getLeavesOfType(
				JOURNAL_VIEW_TYPE
			)[0];
			if (existingLeaf && existingLeaf.view instanceof JournalView) {
				this.view = existingLeaf.view;
			}
		});

		console.log('Journal View Plugin (React) loaded');
	}

	async onunload() {
		console.log('Journal View Plugin (React) unloaded');
	}

	async activateView() {
		const { workspace } = this.app;
		let leaf = workspace.getLeavesOfType(JOURNAL_VIEW_TYPE)[0];

		if (!leaf) {
			const newLeaf = workspace.getRightLeaf(false);
			if (newLeaf) {
				await newLeaf.setViewState({ type: JOURNAL_VIEW_TYPE });
				leaf = newLeaf;
			}
		}

		if (leaf && leaf.view instanceof JournalView) {
			// 如果设置了默认文件夹，使用默认文件夹
			if (this.settings.defaultFolderPath) {
				const defaultFolder = this.app.vault.getAbstractFileByPath(this.settings.defaultFolderPath);
				if (defaultFolder instanceof TFolder) {
					// 只有当目标文件夹改变时才刷新
					if (leaf.view.targetFolderPath !== defaultFolder.path) {
						leaf.view.targetFolderPath = defaultFolder.path;
						await leaf.view.refresh();
					}
				} else {
					// 如果默认文件夹不存在，清空路径（扫描整个vault）
					if (leaf.view.targetFolderPath !== null) {
						leaf.view.targetFolderPath = null;
						await leaf.view.refresh();
					}
				}
			} else {
				// 如果没有设置默认文件夹，使用旧的 folderPath 设置（向后兼容）
				if (this.settings.folderPath) {
					const folder = this.app.vault.getAbstractFileByPath(this.settings.folderPath);
					if (folder instanceof TFolder) {
						if (leaf.view.targetFolderPath !== folder.path) {
							leaf.view.targetFolderPath = folder.path;
							await leaf.view.refresh();
						}
					}
				}
			}

			workspace.revealLeaf(leaf);
		}
	}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData()
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

export default JournalViewPlugin;
