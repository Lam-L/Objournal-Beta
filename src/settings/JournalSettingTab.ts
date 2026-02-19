import { PluginSettingTab, Setting, App, TFolder, TFile } from 'obsidian';
import { JournalViewPlugin } from '../main';
import { JournalPluginSettings } from '../settings';

export class JournalSettingTab extends PluginSettingTab {
	plugin: JournalViewPlugin;

	constructor(app: App, plugin: JournalViewPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl('h2', { text: '手记视图设置' });

		// 获取所有文件夹列表（递归获取所有子文件夹）
		const getAllFolders = (): TFolder[] => {
			const folders: TFolder[] = [];
			const processFolder = (folder: TFolder) => {
				folders.push(folder);
				for (const child of folder.children) {
					if (child instanceof TFolder) {
						processFolder(child);
					}
				}
			};
			// 从根目录开始，递归处理所有文件夹
			const rootFolders = this.app.vault.getAllFolders();
			for (const folder of rootFolders) {
				processFolder(folder);
			}
			// 按路径排序
			return folders.sort((a, b) => a.path.localeCompare(b.path));
		};

		// 从文件夹中提取所有 frontmatter 字段
		const extractFrontmatterFields = (folderPath: string | null): Set<string> => {
			const fields = new Set<string>();
			if (!folderPath) return fields;

			const folder = this.app.vault.getAbstractFileByPath(folderPath);
			if (!(folder instanceof TFolder)) return fields;

			// 递归获取文件夹下的所有 Markdown 文件
			const getMarkdownFiles = (f: TFolder): TFile[] => {
				const files: TFile[] = [];
				for (const child of f.children) {
					if (child instanceof TFile && child.extension === 'md') {
						files.push(child);
					} else if (child instanceof TFolder) {
						files.push(...getMarkdownFiles(child));
					}
				}
				return files;
			};

			const files = getMarkdownFiles(folder);
			for (const file of files) {
				const metadata = this.app.metadataCache.getFileCache(file);
				if (metadata?.frontmatter) {
					// 提取所有 frontmatter 字段名
					for (const key in metadata.frontmatter) {
						if (metadata.frontmatter.hasOwnProperty(key)) {
							fields.add(key);
						}
					}
				}
			}
			return fields;
		};

		// 日期字段配置（仅在选择了文件夹时显示）
		const dateFieldSetting = new Setting(containerEl)
			.setName('日期字段')
			.setDesc('指定该文件夹下文件使用的日期字段（frontmatter 中的字段名）。如果文件没有该字段，将使用文件创建时间。选择"使用默认字段"则使用默认字段（date, Date, created, created_time）。')
			.addDropdown((dropdown) => {
				// 添加常用日期字段选项
				dropdown.addOption('', '使用默认字段');
				dropdown.addOption('date', 'date');
				dropdown.addOption('Date', 'Date');
				dropdown.addOption('created', 'created');
				dropdown.addOption('created_time', 'created_time');
				dropdown.addOption('created_at', 'created_at');
				dropdown.addOption('publish_date', 'publish_date');
				dropdown.addOption('publishDate', 'publishDate');

				// 从文件夹中提取所有 frontmatter 字段并添加到下拉列表
				let currentPath = this.plugin.settings.defaultFolderPath || this.plugin.settings.folderPath || '';
				if (currentPath) {
					const folderFields = extractFrontmatterFields(currentPath);
					const commonFields = new Set(['', 'date', 'Date', 'created', 'created_time', 'created_at', 'publish_date', 'publishDate']);

					// 添加文件夹中实际使用的字段（排除已添加的常用字段）
					const sortedFields = Array.from(folderFields)
						.filter(field => !commonFields.has(field))
						.sort();

					if (sortedFields.length > 0) {
						// 添加分隔线（使用特殊值）
						dropdown.addOption('---separator---', '──────────');
						// 添加文件夹中的字段
						for (const field of sortedFields) {
							dropdown.addOption(field, field);
						}
					}
				}

				dropdown.addOption('custom', '自定义...');

				// 设置当前值
				currentPath = this.plugin.settings.defaultFolderPath || this.plugin.settings.folderPath || '';
				const currentDateField = currentPath ? (this.plugin.settings.folderDateFields[currentPath] || '') : '';

				// 如果当前值在下拉选项中存在，直接设置；否则设置为"custom"
				if (currentDateField) {
					// 检查选项是否存在
					const optionExists = Array.from(dropdown.selectEl.options).some(opt => opt.value === currentDateField);
					if (optionExists && currentDateField !== '---separator---') {
						dropdown.setValue(currentDateField);
					} else {
						dropdown.setValue('custom');
					}
				} else {
					dropdown.setValue('');
				}

				dropdown.onChange(async (value) => {
					// 忽略分隔线选项
					if (value === '---separator---') {
						dropdown.setValue(currentDateField || '');
						return;
					}

					const folderPath = this.plugin.settings.defaultFolderPath || this.plugin.settings.folderPath || '';
					if (folderPath) {
						if (value === 'custom') {
							// 如果选择"自定义"，显示输入框让用户输入
							const customInput = document.createElement('input');
							customInput.type = 'text';
							customInput.placeholder = '输入自定义字段名';
							const currentDateField = folderPath ? (this.plugin.settings.folderDateFields[folderPath] || '') : '';
							// 检查当前值是否在下拉选项中
							const optionExists = Array.from(dropdown.selectEl.options).some(opt => opt.value === currentDateField && opt.value !== '---separator---');
							customInput.value = currentDateField && !optionExists ? currentDateField : '';
							customInput.style.width = '200px';
							customInput.style.marginLeft = '10px';

							// 移除之前的自定义输入框（如果存在）
							const existingInput = dateFieldSetting.settingEl.querySelector('.custom-date-field-input') as HTMLInputElement;
							if (existingInput) {
								existingInput.remove();
							}

							customInput.classList.add('custom-date-field-input');
							dateFieldSetting.settingEl.appendChild(customInput);

							// 聚焦输入框
							customInput.focus();

							// 监听输入框变化
							const handleCustomInput = async () => {
								const customValue = customInput.value.trim();
								if (customValue) {
									this.plugin.settings.folderDateFields[folderPath] = customValue;
								} else {
									delete this.plugin.settings.folderDateFields[folderPath];
								}
								await this.plugin.saveSettings();

								// 如果视图已打开，自动刷新
								if (this.plugin.view) {
									await this.plugin.view.refresh();
								}
							};

							customInput.addEventListener('blur', handleCustomInput);
							customInput.addEventListener('keydown', (e) => {
								if (e.key === 'Enter') {
									e.preventDefault();
									handleCustomInput();
									customInput.blur();
								}
							});
						} else {
							// 移除自定义输入框（如果存在）
							const existingInput = dateFieldSetting.settingEl.querySelector('.custom-date-field-input') as HTMLInputElement;
							if (existingInput) {
								existingInput.remove();
							}

							if (value) {
								this.plugin.settings.folderDateFields[folderPath] = value;
							} else {
								delete this.plugin.settings.folderDateFields[folderPath];
							}
							await this.plugin.saveSettings();

							// 如果视图已打开，自动刷新
							if (this.plugin.view) {
								await this.plugin.view.refresh();
							}
						}
					}
				});
			});

		// 更新下拉选择器的选项（当文件夹改变时）
		const updateDropdownOptions = (dropdown: HTMLSelectElement, folderPath: string | null) => {
			// 保存当前选中的值
			const currentValue = dropdown.value;

			// 清除除默认选项外的所有选项（包括分隔线）
			const defaultOptions = ['', 'date', 'Date', 'created', 'created_time', 'created_at', 'publish_date', 'publishDate', 'custom'];
			const optionsToKeep = new Set(defaultOptions);

			// 移除不在默认列表中的选项（包括分隔线）
			for (let i = dropdown.options.length - 1; i >= 0; i--) {
				const option = dropdown.options[i];
				if (!optionsToKeep.has(option.value)) {
					dropdown.remove(i);
				}
			}

			// 从新文件夹中提取字段
			if (folderPath) {
				const folderFields = extractFrontmatterFields(folderPath);
				const commonFields = new Set(['', 'date', 'Date', 'created', 'created_time', 'created_at', 'publish_date', 'publishDate']);

				// 添加文件夹中实际使用的字段（排除已添加的常用字段）
				const sortedFields = Array.from(folderFields)
					.filter(field => !commonFields.has(field))
					.sort();

				if (sortedFields.length > 0) {
					// 找到"custom"选项的位置
					const customOptionIndex = Array.from(dropdown.options).findIndex(opt => opt.value === 'custom');

					// 在"custom"之前插入分隔线和字段
					if (customOptionIndex >= 0) {
						// 检查是否已有分隔线
						const hasSeparator = Array.from(dropdown.options).some(opt => opt.value === '---separator---');
						if (!hasSeparator) {
							const separatorOption = new Option('──────────', '---separator---');
							separatorOption.disabled = true;
							dropdown.insertBefore(separatorOption, dropdown.options[customOptionIndex]);
						}

						// 插入字段选项
						for (let i = sortedFields.length - 1; i >= 0; i--) {
							const field = sortedFields[i];
							const option = new Option(field, field);
							dropdown.insertBefore(option, dropdown.options[customOptionIndex + (hasSeparator ? 1 : 2)]);
						}
					}
				}
			}

			// 恢复之前选中的值（如果仍然存在）
			if (currentValue && Array.from(dropdown.options).some(opt => opt.value === currentValue)) {
				dropdown.value = currentValue;
			} else {
				// 如果之前的值不存在了，检查是否应该设置为"custom"
				const currentPath = this.plugin.settings.defaultFolderPath || this.plugin.settings.folderPath || '';
				const currentDateField = currentPath ? (this.plugin.settings.folderDateFields[currentPath] || '') : '';
				if (currentDateField && currentDateField !== currentValue) {
					dropdown.value = 'custom';
				} else {
					dropdown.value = '';
				}
			}
		};

		// 根据当前选择的文件夹显示/隐藏日期字段设置
		const updateDateFieldVisibility = () => {
			const currentPath = this.plugin.settings.defaultFolderPath || this.plugin.settings.folderPath || '';
			if (currentPath) {
				dateFieldSetting.settingEl.style.display = '';
				// 更新下拉选择器的值和选项
				const dropdown = dateFieldSetting.settingEl.querySelector('select') as HTMLSelectElement;
				if (dropdown) {
					// 更新选项列表
					updateDropdownOptions(dropdown, currentPath);

					const currentDateField = this.plugin.settings.folderDateFields[currentPath] || '';
					// 如果当前值在下拉选项中存在，直接设置；否则设置为"custom"
					if (currentDateField) {
						const optionExists = Array.from(dropdown.options).some(opt => opt.value === currentDateField && opt.value !== '---separator---');
						if (optionExists) {
							dropdown.value = currentDateField;
						} else {
							dropdown.value = 'custom';
							// 如果选择的是自定义，确保输入框存在并更新值
							let customInput = dateFieldSetting.settingEl.querySelector('.custom-date-field-input') as HTMLInputElement;
							if (!customInput) {
								customInput = document.createElement('input');
								customInput.type = 'text';
								customInput.placeholder = '输入自定义字段名';
								customInput.style.width = '200px';
								customInput.style.marginLeft = '10px';
								customInput.classList.add('custom-date-field-input');
								dateFieldSetting.settingEl.appendChild(customInput);

								// 监听输入框变化
								const handleCustomInput = async () => {
									const customValue = customInput.value.trim();
									if (customValue) {
										this.plugin.settings.folderDateFields[currentPath] = customValue;
									} else {
										delete this.plugin.settings.folderDateFields[currentPath];
									}
									await this.plugin.saveSettings();

									// 如果视图已打开，自动刷新
									if (this.plugin.view) {
										await this.plugin.view.refresh();
									}
								};

								customInput.addEventListener('blur', handleCustomInput);
								customInput.addEventListener('keydown', (e) => {
									if (e.key === 'Enter') {
										e.preventDefault();
										handleCustomInput();
										customInput.blur();
									}
								});
							}
							customInput.value = currentDateField;
						}
					} else {
						dropdown.value = '';
						// 移除自定义输入框（如果存在）
						const existingInput = dateFieldSetting.settingEl.querySelector('.custom-date-field-input') as HTMLInputElement;
						if (existingInput) {
							existingInput.remove();
						}
					}
				}
			} else {
				dateFieldSetting.settingEl.style.display = 'none';
			}
		};

		// 默认模板配置
		new Setting(containerEl)
			.setName('默认模板')
			.setDesc('创建新笔记时使用的模板。支持变量：{{date}}（日期 YYYY-MM-DD）、{{year}}、{{month}}、{{day}}、{{title}}（标题）。留空则使用默认格式。')
			.addTextArea((text) => {
				text.setPlaceholder('例如：---\ndate: {{date}}\ntags: [日记]\n---\n\n# {{title}}\n\n');
				text.setValue(this.plugin.settings.defaultTemplate || '');
				text.inputEl.rows = 6;
				text.inputEl.style.width = '100%';
				text.onChange(async (value) => {
					this.plugin.settings.defaultTemplate = value;
					await this.plugin.saveSettings();
				});
			});

		// 默认文件夹选择（下拉）
		new Setting(containerEl)
			.setName('默认文件夹')
			.setDesc('选择默认的日记文件夹。使用 Ctrl+P 打开手记视图时将自动打开此文件夹的视图。')
			.addDropdown((dropdown) => {
				// 添加"扫描整个 Vault"选项
				dropdown.addOption('', '扫描整个 Vault');

				// 添加所有文件夹选项
				const folders = getAllFolders();
				for (const folder of folders) {
					dropdown.addOption(folder.path, folder.path);
				}

				// 设置当前值
				const currentPath = this.plugin.settings.defaultFolderPath || this.plugin.settings.folderPath || '';
				dropdown.setValue(currentPath);

				dropdown.onChange(async (value) => {
					this.plugin.settings.defaultFolderPath = value || null;
					// 同时更新旧的 folderPath 以保持向后兼容
					this.plugin.settings.folderPath = value;
					await this.plugin.saveSettings();

					// 更新日期字段下拉选择器的选项（从新文件夹中提取字段）
					const dateFieldDropdown = dateFieldSetting.settingEl.querySelector('select') as HTMLSelectElement;
					if (dateFieldDropdown) {
						updateDropdownOptions(dateFieldDropdown, value || null);
					}

					// 更新日期字段设置的显示状态和值
					updateDateFieldVisibility();

					// 如果视图已打开，自动刷新
					if (this.plugin.view) {
						if (value) {
							const folder = this.app.vault.getAbstractFileByPath(value);
							if (folder instanceof TFolder) {
								this.plugin.view.targetFolderPath = folder.path;
							} else {
								this.plugin.view.targetFolderPath = null;
							}
						} else {
							this.plugin.view.targetFolderPath = null;
						}
						await this.plugin.view.refresh();
					}
				});
			});

		// 初始显示状态
		updateDateFieldVisibility();

		// 是否在手记视图文件夹中启用自动布局
		new Setting(containerEl)
			.setName('是否在手记视图文件夹中启用自动布局')
			.setDesc('启用后，仅在默认文件夹中的文件会应用自动图片布局。默认为否。')
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.enableAutoLayout)
					.onChange(async (value) => {
						this.plugin.settings.enableAutoLayout = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName('图片显示限制')
			.setDesc('每个手记卡片最多显示的图片数量')
			.addSlider((slider) =>
				slider
					.setLimits(1, 10, 1)
					.setValue(this.plugin.settings.imageLimit)
					.setDynamicTooltip()
					.onChange(async (value) => {
						this.plugin.settings.imageLimit = value;
						await this.plugin.saveSettings();
						// 刷新视图
						if (this.plugin.view) {
							this.plugin.view.refresh();
						}
					})
			);

		new Setting(containerEl)
			.setName('图片间距')
			.setDesc('图片容器之间的间距（像素）')
			.addSlider((slider) =>
				slider
					.setLimits(0, 30, 1)
					.setValue(this.plugin.settings.imageGap)
					.setDynamicTooltip()
					.onChange(async (value) => {
						this.plugin.settings.imageGap = value;
						await this.plugin.saveSettings();
						// 更新 CSS 变量
						document.documentElement.style.setProperty('--journal-image-gap', `${value}px`);
						// 刷新视图
						if (this.plugin.view) {
							this.plugin.view.refresh();
						}
					})
			);

		new Setting(containerEl)
			.setName('打开笔记方式')
			.setDesc('选择在手记视图中点击笔记卡片的打开方式。')
			.addToggle((toggle) => {
				toggle
					.setValue(this.plugin.settings.openInNewTab)
					.setTooltip(this.plugin.settings.openInNewTab ? '当前：新标签页打开' : '当前：当前标签页打开')
					.onChange(async (value) => {
						this.plugin.settings.openInNewTab = value;
						await this.plugin.saveSettings();
						// 更新 tooltip
						toggle.setTooltip(value ? '当前：新标签页打开' : '当前：当前标签页打开');
					});
			})
			.addExtraButton((button) => {
				button
					.setIcon('info')
					.setTooltip('新标签页：在新标签页打开笔记（默认）\n当前标签页：在当前标签页打开笔记，可以使用回退键返回原视图')
					.onClick(() => {});
			});
	}
}
