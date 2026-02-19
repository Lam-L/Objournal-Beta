import { useState, useEffect, useCallback, useRef } from 'react';
import { TFile, TFolder } from 'obsidian';
import { useJournalView } from '../context/JournalViewContext';
import { JournalEntry, extractDate, extractImagesFromContent, generatePreview, countWords, extractTitle } from '../utils/utils';
import { PAGINATION } from '../constants';

export const useJournalEntries = () => {
	const { app, targetFolderPath, plugin } = useJournalView();
	const [entries, setEntries] = useState<JournalEntry[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<Error | null>(null);
	const entriesMapRef = useRef<Map<string, JournalEntry>>(new Map()); // 用于快速查找

	const loadEntryMetadata = async (file: TFile): Promise<JournalEntry | null> => {
		try {
			const content = await app.vault.read(file);
			
			// 获取当前文件夹的自定义日期字段配置
			let customDateField: string | undefined = undefined;
			if (plugin && targetFolderPath) {
				const pluginSettings = (plugin as any).settings;
				if (pluginSettings?.folderDateFields && pluginSettings.folderDateFields[targetFolderPath]) {
					customDateField = pluginSettings.folderDateFields[targetFolderPath];
				}
			}
			
			const date = extractDate(file, content, app, customDateField);
			if (!date) {
				// 如果没有日期，跳过这个文件
				return null;
			}
			const title = extractTitle(content, file.basename, app, file);
			const images = extractImagesFromContent(content, file, app);
			const preview = generatePreview(content, 200); // 使用默认最大长度
			const wordCount = countWords(content);

			return {
				file,
				date,
				title,
				content,
				images,
				preview,
				wordCount,
			};
		} catch (error) {
			console.error(`Error loading entry ${file.path}:`, error);
			return null;
		}
	};

	const getMarkdownFilesInFolder = (folder: TFolder): TFile[] => {
		const files: TFile[] = [];
		const processFolder = (f: TFolder) => {
			for (const child of f.children) {
				if (child instanceof TFile && child.extension === 'md') {
					files.push(child);
				} else if (child instanceof TFolder) {
					processFolder(child);
				}
			}
		};
		processFolder(folder);
		return files;
	};

	const loadEntries = useCallback(async () => {
		setIsLoading(true);
		setError(null);

		try {
			let files: TFile[] = [];
			
			if (targetFolderPath) {
				const targetFolder = app.vault.getAbstractFileByPath(targetFolderPath);
				if (targetFolder instanceof TFolder) {
					files = getMarkdownFilesInFolder(targetFolder);
				} else {
					files = app.vault.getMarkdownFiles();
				}
			} else {
				files = app.vault.getMarkdownFiles();
			}

			// 构建当前文件路径集合
			const currentFilePaths = new Set(files.map(f => f.path));
			
			// 找出需要删除的文件（在缓存中但不在当前文件列表中）
			const toRemove: string[] = [];
			for (const [path] of entriesMapRef.current) {
				if (!currentFilePaths.has(path)) {
					toRemove.push(path);
				}
			}
			
			// 找出需要添加或更新的文件
			const toProcess: TFile[] = [];
			for (const file of files) {
				const cached = entriesMapRef.current.get(file.path);
				if (!cached || cached.file.stat.mtime !== file.stat.mtime) {
					// 新文件或修改过的文件
					toProcess.push(file);
				}
			}

			// 删除已移除的文件
			for (const path of toRemove) {
				entriesMapRef.current.delete(path);
			}

			// 批量处理需要添加或更新的文件
			if (toProcess.length > 0) {
				const batchSize = PAGINATION.BATCH_SIZE;
				for (let i = 0; i < toProcess.length; i += batchSize) {
					const batch = toProcess.slice(i, i + batchSize);
					const batchResults = await Promise.all(
						batch.map(file =>
							loadEntryMetadata(file).catch(error => {
								console.error(`Error processing file ${file.path}:`, error);
								return null;
							})
						)
					);
					
					// 更新缓存
					for (const entry of batchResults) {
						if (entry) {
							entriesMapRef.current.set(entry.file.path, entry);
						}
					}
				}
			}

			// 从缓存构建排序后的数组
			const results = Array.from(entriesMapRef.current.values());
			
			// 排序：按日期（最新的在前），如果日期相同则按创建时间（最新的在前）
			results.sort((a, b) => {
				const dateDiff = b.date.getTime() - a.date.getTime();
				if (dateDiff !== 0) {
					return dateDiff;
				}
				const ctimeDiff = b.file.stat.ctime - a.file.stat.ctime;
				if (ctimeDiff !== 0) {
					return ctimeDiff;
				}
				return b.file.path.localeCompare(a.file.path);
			});

			// 只有当结果真正变化时才更新（保持引用稳定性）
			setEntries(prevEntries => {
				// 如果长度不同，肯定有变化
				if (prevEntries.length !== results.length) {
					return results;
				}
				
				// 检查是否有实际变化（通过比较路径和修改时间）
				const prevMap = new Map(prevEntries.map(e => [e.file.path, e]));
				let hasChange = false;
				
				for (const entry of results) {
					const prev = prevMap.get(entry.file.path);
					if (!prev || prev.file.stat.mtime !== entry.file.stat.mtime) {
						hasChange = true;
						break;
					}
				}
				
				return hasChange ? results : prevEntries;
			});
		} catch (err) {
			setError(err instanceof Error ? err : new Error('Unknown error'));
		} finally {
			setIsLoading(false);
		}
	}, [app, targetFolderPath]);

	// 增量更新单个文件
	const updateSingleEntry = useCallback(async (file: TFile) => {
		const entry = await loadEntryMetadata(file);
		if (!entry) {
			// 如果加载失败，从缓存中移除
			entriesMapRef.current.delete(file.path);
		} else {
			// 更新缓存
			entriesMapRef.current.set(file.path, entry);
		}

		// 从缓存构建排序后的数组
		const results = Array.from(entriesMapRef.current.values());
		results.sort((a, b) => {
			const dateDiff = b.date.getTime() - a.date.getTime();
			if (dateDiff !== 0) {
				return dateDiff;
			}
			const ctimeDiff = b.file.stat.ctime - a.file.stat.ctime;
			if (ctimeDiff !== 0) {
				return ctimeDiff;
			}
			return b.file.path.localeCompare(a.file.path);
		});

		setEntries(results);
	}, []);

	// 处理文件重命名：删除旧路径，添加新路径
	const updateEntryAfterRename = useCallback(async (file: TFile, oldPath: string) => {
		// 从缓存中删除旧路径
		entriesMapRef.current.delete(oldPath);

		// 加载新路径的文件
		const entry = await loadEntryMetadata(file);
		if (entry) {
			// 更新缓存
			entriesMapRef.current.set(file.path, entry);
		}

		// 从缓存构建排序后的数组
		const results = Array.from(entriesMapRef.current.values());
		results.sort((a, b) => {
			const dateDiff = b.date.getTime() - a.date.getTime();
			if (dateDiff !== 0) {
				return dateDiff;
			}
			const ctimeDiff = b.file.stat.ctime - a.file.stat.ctime;
			if (ctimeDiff !== 0) {
				return ctimeDiff;
			}
			return b.file.path.localeCompare(a.file.path);
		});

		setEntries(results);
	}, [app, targetFolderPath, plugin]); // 依赖 loadEntryMetadata 使用的变量

	useEffect(() => {
		loadEntries();
	}, [loadEntries]);

	return {
		entries,
		isLoading,
		error,
		refresh: loadEntries,
		updateSingleEntry,
		updateEntryAfterRename,
	};
};
