import { Plugin } from 'obsidian';

export interface JournalPluginSettings {
	folderPath: string; // 保留用于向后兼容
	defaultFolderPath: string | null; // 默认文件夹路径（下拉选择）
	imageLimit: number;
	folderJournalViews: Record<string, string>; // 文件夹路径 -> 视图文件路径
	folderDateFields: Record<string, string>; // 文件夹路径 -> 日期字段名（frontmatter 中的字段名）
	/** 模板文件夹路径，用于从中选择模板文件（如 "Templates"） */
	templateFolderPath: string | null;
	/** 创建新笔记时使用的模板文件路径（如 "Templates/Journal.md"），空则使用默认格式 */
	templatePath: string | null;
	imageGap: number; // 图片容器之间的间距（像素）
	openInNewTab: boolean; // 是否在新标签页打开笔记（true=新标签页，false=当前标签页）
	enableEditorImageLayout: boolean; // 在 Live Preview 中，默认文件夹内的笔记是否启用手记式图片布局
	showJournalStats: boolean; // 是否展示统计栏（连续天数、字数、写手记天数）
}

export const DEFAULT_SETTINGS: JournalPluginSettings = {
	folderPath: '',
	defaultFolderPath: null,
	imageLimit: 3,
	folderJournalViews: {},
	folderDateFields: {},
	templateFolderPath: null,
	templatePath: null,
	imageGap: 10,
	openInNewTab: true,
	enableEditorImageLayout: true,
	showJournalStats: false,
};
