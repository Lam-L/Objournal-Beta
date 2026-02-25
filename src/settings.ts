import { Plugin } from 'obsidian';

export interface JournalPluginSettings {
	folderPath: string; // 保留用于向后兼容
	defaultFolderPath: string | null; // 默认文件夹路径（下拉选择）
	imageLimit: number;
	folderJournalViews: Record<string, string>; // 文件夹路径 -> 视图文件路径
	folderDateFields: Record<string, string>; // 文件夹路径 -> 日期字段名（frontmatter 中的字段名）
	defaultTemplate: string; // 创建新笔记时的默认模板
	imageGap: number; // 图片容器之间的间距（像素）
	openInNewTab: boolean; // 是否在新标签页打开笔记（true=新标签页，false=当前标签页）
	enableEditorImageLayout: boolean; // 在 Live Preview 中，默认文件夹内的笔记是否启用手记式图片布局
}

export const DEFAULT_SETTINGS: JournalPluginSettings = {
	folderPath: '',
	defaultFolderPath: null,
	imageLimit: 3,
	folderJournalViews: {},
	folderDateFields: {}, // 文件夹路径 -> 日期字段名
	defaultTemplate: '', // 默认模板（空字符串表示使用默认格式）
	imageGap: 10, // 默认图片间距 10px
	openInNewTab: true, // 默认在新标签页打开
	enableEditorImageLayout: true, // 默认在 Live Preview 中启用手记式图片布局
};
