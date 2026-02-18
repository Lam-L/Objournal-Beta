import { Plugin } from 'obsidian';

export interface JournalPluginSettings {
	folderPath: string; // 保留用于向后兼容
	defaultFolderPath: string | null; // 默认文件夹路径（下拉选择）
	imageLimit: number;
	folderJournalViews: Record<string, string>; // 文件夹路径 -> 视图文件路径
	enableAutoLayout: boolean; // 是否在手记视图文件夹中启用自动布局
	folderDateFields: Record<string, string>; // 文件夹路径 -> 日期字段名（frontmatter 中的字段名）
	defaultTemplate: string; // 创建新笔记时的默认模板
}

export const DEFAULT_SETTINGS: JournalPluginSettings = {
	folderPath: '',
	defaultFolderPath: null,
	imageLimit: 3,
	folderJournalViews: {},
	enableAutoLayout: false, // 默认不启用
	folderDateFields: {}, // 文件夹路径 -> 日期字段名
	defaultTemplate: '', // 默认模板（空字符串表示使用默认格式）
};
