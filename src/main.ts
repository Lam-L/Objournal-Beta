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
			// 在主内容区域打开（而不是侧边栏）
			const newLeaf = workspace.getLeaf(true);
			if (newLeaf) {
				await newLeaf.setViewState({ type: JOURNAL_VIEW_TYPE, active: true });
				leaf = newLeaf;
			}
		}

		if (leaf && leaf.view instanceof JournalView) {
			// 确保 targetFolderPath 被正确设置
			let targetPath: string | null = null;

			// 如果设置了默认文件夹，使用默认文件夹
			if (this.settings.defaultFolderPath) {
				const defaultFolder = this.app.vault.getAbstractFileByPath(this.settings.defaultFolderPath);
				if (defaultFolder instanceof TFolder) {
					targetPath = defaultFolder.path;
				}
			} else if (this.settings.folderPath) {
				// 如果没有设置默认文件夹，使用旧的 folderPath 设置（向后兼容）
				const folder = this.app.vault.getAbstractFileByPath(this.settings.folderPath);
				if (folder instanceof TFolder) {
					targetPath = folder.path;
				}
			}

			// 强制设置 targetFolderPath（即使相同也要设置，确保状态正确）
			// 这样可以确保即使视图被替换后重新打开，也能正确恢复
			const previousPath = leaf.view.targetFolderPath;
			leaf.view.targetFolderPath = targetPath;
			
			// 如果路径改变了，或者视图刚被打开（需要初始化），则刷新
			// 通过检查 leaf 的 viewState 来判断视图是否刚被创建
			const viewState = leaf.getViewState();
			const isNewView = !viewState.state || !viewState.state.targetFolderPath;
			
			if (previousPath !== targetPath || isNewView) {
				await leaf.view.refresh();
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
