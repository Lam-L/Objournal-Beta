import { TFile, App } from 'obsidian';
import { strings } from '../i18n';

export interface ImageInfo {
	name: string;
	path: string;
	url: string;
	altText?: string;
	position: number;
}

export interface JournalEntry {
	file: TFile;
	date: Date;
	images: ImageInfo[];
	content: string;
	preview: string;
	wordCount: number;
	title: string;
}

/**
 * 从 Markdown 正文中提取图片信息
 */
export function extractImagesFromContent(
	content: string,
	file: TFile,
	app: App
): ImageInfo[] {
	const images: ImageInfo[] = [];

	// 1. 提取 Wikilink 格式: ![[image.png]] 或 ![[image.png|100x100]]
	const wikiLinkRegex = /!\[\[([^\]]+)\]\]/g;
	let match;

	while ((match = wikiLinkRegex.exec(content)) !== null) {
		const imageRef = match[1];
		const position = match.index;

		// 处理带尺寸的格式: image.png|100x100
		const [imageName] = imageRef.split('|');

		// 使用 Obsidian API 解析图片路径
		const imageFile = app.metadataCache.getFirstLinkpathDest(
			imageName.trim(),
			file.path
		);

		if (imageFile && imageFile instanceof TFile) {
			// 检查是否是图片文件
			const imageExtensions = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico'];
			const isImage = imageExtensions.includes(imageFile.extension.toLowerCase());

			if (isImage) {
				try {
					const resourcePath = app.vault.getResourcePath(imageFile);
					images.push({
						name: imageName.trim(),
						path: imageFile.path,
						url: resourcePath,
						position: position,
					});
				} catch (error) {
					console.warn(`Failed to get resource path for image ${imageFile.path}:`, error);
				}
			}
		}
	}

	// 2. 提取标准 Markdown 格式: ![alt text](path/to/image.png)
	const markdownImageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
	while ((match = markdownImageRegex.exec(content)) !== null) {
		const altText = match[1];
		const imagePath = match[2];
		const position = match.index;

		// 跳过外部链接
		if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
			continue;
		}

		// 处理相对路径和绝对路径
		let imageFile: TFile | null = null;

		if (imagePath.startsWith('/')) {
			// 绝对路径（相对于 vault 根目录）
			imageFile = app.vault.getAbstractFileByPath(
				imagePath.slice(1)
			) as TFile;
		} else {
			// 相对路径
			const fileDir = file.parent?.path || '';
			const fullPath = fileDir ? `${fileDir}/${imagePath}` : imagePath;
			// 规范化路径
			const normalizedPath = fullPath.split('/').filter(p => p !== '.').join('/');
			imageFile = app.vault.getAbstractFileByPath(normalizedPath) as TFile;
		}

		if (imageFile && imageFile instanceof TFile) {
			// 检查是否是图片文件
			const imageExtensions = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico'];
			const isImage = imageExtensions.includes(imageFile.extension.toLowerCase());

			if (isImage) {
				try {
					const resourcePath = app.vault.getResourcePath(imageFile);
					images.push({
						name: imageFile.basename,
						path: imageFile.path,
						url: resourcePath,
						altText: altText || undefined,
						position: position,
					});
				} catch (error) {
					console.warn(`Failed to get resource path for image ${imageFile.path}:`, error);
				}
			}
		}
	}

	// 按在原文中的位置排序
	return images.sort((a, b) => a.position - b.position);
}

/**
 * 解析日期值
 */
export function parseDate(dateValue: any): Date | null {
	if (!dateValue) return null;

	if (dateValue instanceof Date) {
		return dateValue;
	}

	if (typeof dateValue === 'string') {
		const parsed = new Date(dateValue);
		if (!isNaN(parsed.getTime())) {
			return parsed;
		}
	}

	return null;
}

/**
 * 从文件提取日期
 * 优先级1：Frontmatter（自定义字段或 date/Date/created/created_time）
 * 优先级2：文件创建时间
 */
export function extractDate(file: TFile, content: string, app: App, customDateField?: string): Date | null {
	// 优先级1：从 frontmatter 提取
	const metadata = app.metadataCache.getFileCache(file);
	if (metadata?.frontmatter) {
		// 如果指定了自定义日期字段，优先使用该字段
		if (customDateField && metadata.frontmatter[customDateField]) {
			const parsed = parseDate(metadata.frontmatter[customDateField]);
			if (parsed) return parsed;
		}

		// 如果没有指定自定义字段或自定义字段无值，使用默认的日期字段列表
		if (!customDateField) {
			const dateFields = ['date', 'Date', 'created', 'created_time'] as const;
			for (const field of dateFields) {
				if (metadata.frontmatter[field]) {
					const parsed = parseDate(metadata.frontmatter[field]);
					if (parsed) return parsed;
				}
			}
		}
	}

	// 优先级2：文件创建时间
	return new Date(file.stat.ctime);
}

/**
 * 从内容中提取标题
 * 直接使用文件名作为标题
 */
export function extractTitle(content: string, fileName: string, app: App, file: TFile): string {
	return fileName;
}

/**
 * 生成内容预览
 */
export function generatePreview(content: string, maxLength: number): string {
	// 移除 frontmatter
	const withoutFrontmatter = content.replace(/^---[\s\S]*?---\n/, '');
	// 移除图片标记
	const withoutImages = withoutFrontmatter.replace(
		/!\[\[[^\]]+\]\]|!\[[^\]]*\]\([^)]+\)/g,
		''
	);
	// 移除标题标记
	const withoutHeaders = withoutImages.replace(/^#+\s+/gm, '');
	// 提取纯文本
	const text = withoutHeaders.replace(/[#*_`~\[\]()]/g, '').trim();

	if (text.length <= maxLength) {
		return text;
	}

	return text.substring(0, maxLength) + '...';
}

/**
 * 统计字数
 */
export function countWords(content: string): number {
	// 移除 frontmatter
	const withoutFrontmatter = content.replace(/^---[\s\S]*?---\n/, '');
	// 移除 Markdown 语法
	const text = withoutFrontmatter.replace(/[#*_`~\[\]()!]/g, '');
	// 中文字符按字计算，英文按词计算
	const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
	const englishWords = text.split(/\s+/).filter((w) => /[a-zA-Z]/.test(w))
		.length;
	return chineseChars + englishWords;
}

/**
 * 格式化日期显示（根据当前语言）
 */
export function formatDate(date: Date): string {
	return strings.formatDate(date);
}

/**
 * 判断两个日期是否是同一天
 */
function isSameDay(date1: Date, date2: Date): boolean {
	return (
		date1.getFullYear() === date2.getFullYear() &&
		date1.getMonth() === date2.getMonth() &&
		date1.getDate() === date2.getDate()
	);
}

/**
 * 按月份分组条目，但将今天和昨天单独分组
 */
export function groupByMonth(
	entries: JournalEntry[]
): Record<string, JournalEntry[]> {
	const grouped: Record<string, JournalEntry[]> = {};

	// 获取今天和昨天的日期（只比较年月日，忽略时分秒）
	const today = new Date();
	today.setHours(0, 0, 0, 0);

	const yesterday = new Date(today);
	yesterday.setDate(yesterday.getDate() - 1);

	for (const entry of entries) {
		// 将条目的日期也设置为 0 时 0 分 0 秒，只比较年月日
		const entryDate = new Date(entry.date);
		entryDate.setHours(0, 0, 0, 0);

		let groupKey: string;

		if (isSameDay(entryDate, today)) {
			groupKey = strings.dateGroups.today;
		} else if (isSameDay(entryDate, yesterday)) {
			groupKey = strings.dateGroups.yesterday;
		} else {
			groupKey = strings.formatMonthGroupKey(entryDate.getFullYear(), entryDate.getMonth());
		}

		if (!grouped[groupKey]) {
			grouped[groupKey] = [];
		}
		grouped[groupKey].push(entry);
	}

	return grouped;
}
