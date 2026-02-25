import { App, MarkdownPostProcessorContext, MarkdownView } from 'obsidian';

/**
 * Live Preview 下的编辑器图片布局
 * 在默认文件夹中的笔记，将图片按首页手记卡片的布局展示（1/2/3/4/5+ 张）
 * 支持实时：添加/删除图片时自动重新渲染
 */
export class EditorImageLayout {
	private app: App;
	private plugin: { settings: any; registerEvent: (e: any) => void; registerMarkdownPostProcessor: (p: any) => any };
	private isProcessing = false;
	private lastProcessedTime = 0;
	private readonly PROCESS_COOLDOWN = 80;
	private scheduleTimeouts: number[] = [];
	private editorObserver: MutationObserver | null = null;
	private observedEditorEl: HTMLElement | null = null;
	private pollIntervalId: number | null = null;

	constructor(app: App, plugin: any) {
		this.app = app;
		this.plugin = plugin;
	}

	/** 多次延迟执行，应对 Obsidian 的异步渲染 */
	private scheduleProcessWithRetries(): void {
		this.cancelScheduledProcess();
		const delays = [30, 100, 250, 500, 900];
		delays.forEach((delay) => {
			const id = window.setTimeout(() => {
				this.scheduleTimeouts = this.scheduleTimeouts.filter((t) => t !== id);
				this.processActiveEditor();
			}, delay);
			this.scheduleTimeouts.push(id);
		});
	}

	private cancelScheduledProcess(): void {
		this.scheduleTimeouts.forEach((id) => window.clearTimeout(id));
		this.scheduleTimeouts = [];
	}

	initialize(): void {
		// 1. Markdown 后处理器
		this.plugin.registerMarkdownPostProcessor((element: HTMLElement, context: MarkdownPostProcessorContext) => {
			this.processMarkdownImages(element, context);
		});

		// 2. 定时轮询：每 200ms 检查并处理所有相关 Markdown 视图（保证实时）
		this.pollIntervalId = window.setInterval(() => {
			this.processAllRelevantViews();
		}, 200);

		// 3. 事件触发
		this.plugin.registerEvent(this.app.workspace.on('editor-change', () => this.scheduleProcessWithRetries()));
		this.plugin.registerEvent(this.app.workspace.on('file-open', () => this.scheduleProcessWithRetries()));
		this.plugin.registerEvent(this.app.workspace.on('layout-change', () => this.scheduleProcessWithRetries()));

		// 4. MutationObserver
		this.setupMutationObserver();
	}

	destroy(): void {
		this.cancelScheduledProcess();
		this.stopObservingEditor();
		if (this.pollIntervalId !== null) {
			window.clearInterval(this.pollIntervalId);
			this.pollIntervalId = null;
		}
	}

	private shouldProcessFile(filePath: string | null | undefined): boolean {
		const settings = this.plugin.settings;
		if (!settings?.defaultFolderPath) return false;
		if (!filePath) return false;

		const defaultFolderPath = settings.defaultFolderPath as string;
		const enableLayout = settings.enableEditorImageLayout !== false; // 默认开启

		if (!enableLayout) return false;

		return filePath === defaultFolderPath || filePath.startsWith(defaultFolderPath + '/');
	}

	private isValidImage(img: HTMLImageElement): boolean {
		if (!img.src) return false;
		if (img.src.startsWith('data:image/svg+xml') || img.src.startsWith('data:image/gif;base64,R0lGOD'))
			return false;
		if (img.src.trim() === '' || img.src === 'about:blank') return false;

		const isValid = img.src.startsWith('app://') || img.src.startsWith('http') || img.src.startsWith('file://');
		const hasExt = /\.(jpg|jpeg|png|gif|webp|svg|bmp|ico)$/i.test(img.src);
		const hasAlt = (img.getAttribute('alt') || '').trim() !== '';

		return isValid || hasExt || hasAlt;
	}

	private setupMutationObserver(): void {
		// 监听 active-leaf 变化，切换到当前编辑器的 DOM 进行观察
		this.plugin.registerEvent(
			this.app.workspace.on('active-leaf-change', () => {
				this.attachEditorObserver();
			})
		);
		// 初始化时 attaching
		this.attachEditorObserver();

		// 兜底：document.body 监听（当 editor 内部结构变化时，可能 observer 未覆盖到）
		let debounceId: number | null = null;
		const bodyObserver = new MutationObserver(() => {
			const view = this.app.workspace.getActiveViewOfType(MarkdownView);
			if (!view?.file || !this.shouldProcessFile(view.file.path)) return;

			if (debounceId) clearTimeout(debounceId);
			debounceId = window.setTimeout(() => {
				debounceId = null;
				this.scheduleProcessWithRetries();
			}, 30);
		});
		bodyObserver.observe(document.body, { childList: true, subtree: true });
	}

	/** 直接观察当前编辑器的 contentEl，DOM 变动时立即处理 */
	private attachEditorObserver(): void {
		const view = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (!view?.file) {
			this.stopObservingEditor();
			return;
		}
		if (!this.shouldProcessFile(view.file.path)) {
			this.stopObservingEditor();
			return;
		}

		const editorEl = view.contentEl;
		if (!editorEl || editorEl === this.observedEditorEl) return;

		this.stopObservingEditor();

		this.editorObserver = new MutationObserver(() => {
			// 下一帧处理，避免 DOM 尚未完全更新
			requestAnimationFrame(() => {
				setTimeout(() => this.processActiveEditor(), 0);
			});
		});

		this.editorObserver.observe(editorEl, {
			childList: true,
			subtree: true,
			attributes: true,
			attributeFilter: ['src', 'class'],
		});
		this.observedEditorEl = editorEl;
	}

	private stopObservingEditor(): void {
		if (this.editorObserver && this.observedEditorEl) {
			this.editorObserver.disconnect();
			this.editorObserver = null;
			this.observedEditorEl = null;
		}
	}

	/** 轮询：处理所有在默认文件夹内的 Markdown 视图（含 Live Preview、阅读模式） */
	private processAllRelevantViews(): void {
		if (this.isProcessing) return;

		this.app.workspace.iterateAllLeaves((leaf) => {
			const view = leaf.view;
			if (!(view instanceof MarkdownView) || !view.file) return;
			if (!this.shouldProcessFile(view.file.path)) return;

			const containerEl = view.contentEl;
			if (!containerEl) return;

			this.processElement(containerEl);
		});
	}

	/** 处理单个容器内的图片 */
	private processElement(containerEl: HTMLElement): void {
		if (this.isProcessing) return;

		this.updateExistingGalleries(containerEl);

		const images = Array.from(containerEl.querySelectorAll('img')).filter(
			(img) =>
				!img.classList.contains('journal-editor-processed') &&
				!img.closest('.journal-images') &&
				this.isValidImage(img as HTMLImageElement)
		);

		if (images.length === 0) return;

		const now = Date.now();
		if (now - this.lastProcessedTime < this.PROCESS_COOLDOWN) return;

		this.isProcessing = true;
		this.lastProcessedTime = Date.now();

		try {
			const groups = this.groupConsecutiveImages(images as HTMLImageElement[]);
			groups.forEach((group) => this.wrapImageGroup(group as HTMLImageElement[], containerEl));
		} finally {
			this.isProcessing = false;
		}
	}

	private processActiveEditor(): void {
		const view = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (!view?.file || !this.shouldProcessFile(view.file.path)) return;

		const containerEl = view.contentEl;
		if (!containerEl) return;

		this.processElement(containerEl);
	}

	private updateExistingGalleries(editorEl: HTMLElement): void {
		const galleries = Array.from(editorEl.querySelectorAll('.journal-images')) as HTMLElement[];

		// 1. 合并相邻的 gallery（如同一行两个 internal-embed 各自有 journal-images-single → 合并为 journal-images-double）
		this.mergeAdjacentGalleries(editorEl);

		// 2. 移除空 gallery
		const galleriesAfterMerge = Array.from(editorEl.querySelectorAll('.journal-images')) as HTMLElement[];
		galleriesAfterMerge.forEach((gallery) => {
			const imgs = gallery.querySelectorAll('img.journal-editor-processed');
			if (imgs.length === 0) {
				gallery.closest('.internal-embed')?.remove();
				gallery.remove();
			}
		});
	}

	/** 合并相邻的 journal-images（如两个 internal-embed 各自包了一个 single，应合并为一个 double） */
	private mergeAdjacentGalleries(scope: HTMLElement): void {
		const galleries = Array.from(scope.querySelectorAll('.journal-images')) as HTMLElement[];
		if (galleries.length < 2) return;

		// 按 DOM 顺序
		galleries.sort((a, b) => {
			const pos = a.compareDocumentPosition(b);
			return pos & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
		});

		for (let i = 0; i < galleries.length - 1; i++) {
			const g1 = galleries[i];
			const g2 = galleries[i + 1];
			if (!g1.isConnected || !g2.isConnected) continue;
			if (!this.areGalleriesAdjacent(g1, g2)) continue;

			// 合并到 g1
			const imgs1 = Array.from(g1.querySelectorAll('img.journal-editor-processed')) as HTMLImageElement[];
			const imgs2 = Array.from(g2.querySelectorAll('img.journal-editor-processed')) as HTMLImageElement[];
			const allImgs = [...imgs1, ...imgs2];

			g1.className = 'journal-images ' + this.getLayoutClass(allImgs.length);
			g1.innerHTML = '';
			this.organizeImagesInContainer(allImgs, g1);

			// 只移除空的 journal-images（g2），不移除 internal-embed，以保留 markdown 源码的显示
			g2.remove();
			galleries.splice(i + 1, 1);
			i--;
		}
	}

	/** 两个 gallery 是否相邻（中间无实质内容） */
	private areGalleriesAdjacent(g1: HTMLElement, g2: HTMLElement): boolean {
		const p1 = g1.closest('.internal-embed, .cm-line, p');
		const p2 = g2.closest('.internal-embed, .cm-line, p');
		if (!p1 || !p2) return false;
		if (p1 === p2) return true;

		// p1 和 p2 是兄弟，或 p2 在 p1 的 nextSibling 链上
		let cur: Element | null = p1.nextElementSibling;
		while (cur) {
			if (cur === p2) return true;
			if (!this.isImageOnlyBlock(cur as HTMLElement)) break;
			cur = cur.nextElementSibling;
		}
		return false;
	}

	/** 查找与给定图片相邻的现有 gallery（新图可合并到该 gallery） */
	private findAdjacentGallery(img: HTMLImageElement, scope: HTMLElement): HTMLElement | null {
		let el: Element | null = img.parentElement;
		while (el && scope.contains(el)) {
			let sibling: Element | null = el.previousElementSibling;
			while (sibling) {
				if (sibling.classList.contains('journal-images')) return sibling as HTMLElement;
				if (sibling.querySelector('.journal-images')) {
					return sibling.querySelector('.journal-images') as HTMLElement;
				}
				if (!this.isImageOnlyBlock(sibling as HTMLElement)) break;
				sibling = sibling.previousElementSibling;
			}
			el = el.parentElement;
			if (el?.classList.contains('cm-content')) break;
		}
		return null;
	}

	/** 将新图片合并到已有 gallery 并重建布局 */
	private addImagesToExistingGallery(newImages: HTMLImageElement[], gallery: HTMLElement): void {
		const existingImgs = Array.from(gallery.querySelectorAll('img.journal-editor-processed')) as HTMLImageElement[];
		const allImages = [...existingImgs, ...newImages];

		// 重建整个 gallery
		gallery.className = 'journal-images ' + this.getLayoutClass(allImages.length);
		gallery.innerHTML = '';
		this.organizeImagesInContainer(allImages, gallery);
	}

	private groupConsecutiveImages(images: HTMLImageElement[]): HTMLImageElement[][] {
		const groups: HTMLImageElement[][] = [];
		let current: HTMLImageElement[] = [];

		images.forEach((img) => {
			if (
				current.length === 0 ||
				this.areImagesConsecutive(current[current.length - 1], img)
			) {
				current.push(img);
			} else {
				if (current.length > 0) groups.push(current);
				current = [img];
			}
		});
		if (current.length > 0) groups.push(current);
		return groups;
	}

	private areImagesConsecutive(img1: HTMLImageElement, img2: HTMLImageElement): boolean {
		// 策略1：同一段落/块内（如 ![[a]] ![[b]] 在同一行）
		const p1 = img1.closest('p');
		const p2 = img2.closest('p');
		if (p1 && p2 && p1 === p2) return true;
		if (img1.parentElement === img2.parentElement) return true;

		// 策略2：相邻的块（如两行 ![[a]] 和 ![[b]]，每行单独成块）
		// Obsidian 中每行可能是 p、.cm-line、或 .internal-embed 的父级
		const block1 = img1.closest('p, .cm-line, .cm-block, .internal-embed');
		const block2 = img2.closest('p, .cm-line, .cm-block, .internal-embed');
		if (!block1 || !block2) return false;
		if (block1 === block2) return true;

		// 从 block1 向上查找，看 block2 是否在 block1 的「下一个兄弟」路径上
		let el: Element | null = block1;
		while (el) {
			let next: Element | null = el.nextElementSibling;
			while (next) {
				if (next === block2 || next.contains(block2) || block2.contains(next)) return true;
				// 中间只有空节点或仅含图片的容器则继续
				if (this.isImageOnlyBlock(next as HTMLElement)) {
					next = next.nextElementSibling;
					continue;
				}
				// 中间有非图片内容，不连续
				break;
			}
			el = el.parentElement;
		}
		return false;
	}

	/** 元素是否仅为图片/embed，无实质性文本 */
	private isImageOnlyBlock(el: HTMLElement): boolean {
		if (!el) return true;
		const text = (el.textContent || '').trim();
		if (text.length > 0) {
			// 排除仅 alt 等产生的小段文本，主要看是否有非 img 的实质内容
			const imgs = el.querySelectorAll('img');
			const imgTextLen = Array.from(imgs).reduce((s, i) => s + (i.alt?.length || 0), 0);
			if (text.length > imgTextLen + 2) return false;
		}
		return true;
	}

	private processMarkdownImages(element: HTMLElement, context: MarkdownPostProcessorContext): void {
		if (!this.shouldProcessFile(context.sourcePath)) return;
		const now = Date.now();
		if (now - this.lastProcessedTime < this.PROCESS_COOLDOWN) return;

		const images = Array.from(element.querySelectorAll('img:not(.journal-editor-processed)')).filter(
			(img) => !(img as HTMLElement).closest('.journal-images') && this.isValidImage(img as HTMLImageElement)
		) as HTMLImageElement[];

		if (images.length === 0) return;

		const groups = this.groupConsecutiveImages(images);
		groups.forEach((group) => this.wrapImageGroup(group, element));
		this.lastProcessedTime = Date.now();
	}

	private wrapImageGroup(images: HTMLImageElement[], editorEl?: HTMLElement): void {
		if (images.length === 0) return;
		for (const img of images) {
			if (img.closest('.journal-images') || img.classList.contains('journal-editor-processed')) return;
		}

		const firstImg = images[0];
		// 优先合并到相邻的已有 gallery
		if (editorEl) {
			const adjacentGallery = this.findAdjacentGallery(firstImg, editorEl);
			if (adjacentGallery) {
				this.addImagesToExistingGallery(images, adjacentGallery);
				return;
			}
		}

		const parent = firstImg.parentElement;
		if (!parent) return;

		const insertBefore = firstImg.nextSibling;

		const container = document.createElement('div');
		container.addClasses(['journal-images', this.getLayoutClass(images.length)]);

		// 插入空容器
		try {
			if (insertBefore && insertBefore.parentNode === parent) {
				parent.insertBefore(container, insertBefore);
			} else {
				parent.insertBefore(container, firstImg);
			}
		} catch {
			parent.insertBefore(container, firstImg);
		}

		this.organizeImagesInContainer(images, container);
	}

	private getLayoutClass(count: number): string {
		if (count === 1) return 'journal-images-single';
		if (count === 2) return 'journal-images-double';
		if (count === 3) return 'journal-images-triple';
		if (count === 4) return 'journal-images-quad';
		return 'journal-images-multiple';
	}

	/**
	 * 按首页 JournalImageContainer 的结构组织图片
	 */
	private organizeImagesInContainer(images: HTMLImageElement[], container: HTMLElement): void {
		const count = Math.min(images.length, 5);
		const moreCount = images.length > 5 ? images.length - 5 : 0;

		const createWrapper = (img: HTMLImageElement, className: string, showMore?: number): HTMLElement => {
			const wrap = document.createElement('div');
			wrap.addClass('journal-image-container');
			if (className) wrap.addClass(className);
			img.classList.add('journal-editor-processed');
			img.addClass('journal-image');
			img.style.width = '100%';
			img.style.height = '100%';
			img.style.objectFit = 'cover';
			wrap.appendChild(img);

			// 右上角删除按钮
			const deleteBtn = document.createElement('button');
			deleteBtn.addClass('journal-editor-image-delete');
			deleteBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
			deleteBtn.title = '删除图片';
			deleteBtn.onclick = (e) => {
				e.stopPropagation();
				e.preventDefault();
				this.deleteImageFromSource(img);
			};
			wrap.appendChild(deleteBtn);

			if (showMore !== undefined && showMore > 0) {
				const more = document.createElement('div');
				more.addClass('journal-image-more');
				more.textContent = '+' + showMore;
				wrap.appendChild(more);
			}
			return wrap;
		};

		if (count === 1) {
			container.appendChild(createWrapper(images[0], '', moreCount));
			return;
		}

		if (count === 2) {
			container.appendChild(createWrapper(images[0], ''));
			container.appendChild(createWrapper(images[1], '', moreCount));
			return;
		}

		if (count === 3) {
			container.appendChild(createWrapper(images[0], 'journal-image-container-large'));
			container.appendChild(createWrapper(images[1], 'journal-image-container-small'));
			container.appendChild(createWrapper(images[2], 'journal-image-container-small', moreCount));
			return;
		}

		if (count === 4) {
			container.appendChild(createWrapper(images[0], 'journal-image-container-quad-left'));
			container.appendChild(createWrapper(images[1], 'journal-image-container-quad-right-top'));
			const bottom = document.createElement('div');
			bottom.addClass('journal-images-quad-right-bottom');
			bottom.appendChild(createWrapper(images[2], 'journal-image-container-quad-right-bottom-left'));
			bottom.appendChild(createWrapper(images[3], 'journal-image-container-quad-right-bottom-right', moreCount));
			container.appendChild(bottom);
			return;
		}

		// 5+
		container.appendChild(createWrapper(images[0], 'journal-image-container-large'));
		const rightGrid = document.createElement('div');
		rightGrid.addClass('journal-images-multiple-right-grid');
		for (let i = 1; i < 5; i++) {
			rightGrid.appendChild(
				createWrapper(images[i], 'journal-image-container-small', i === 4 ? moreCount : undefined)
			);
		}
		container.appendChild(rightGrid);
	}

	/** 从 Markdown 源码中删除对应图片的引用行，并立即更新 DOM */
	private deleteImageFromSource(img: HTMLImageElement): void {
		const view = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (!view?.editor || !view.contentEl?.contains(img)) return;

		const editor = view.editor;
		const content = editor.getValue();
		const lines = content.split('\n');

		// 从 img 的 alt 或 src 提取文件名
		const alt = (img.getAttribute('alt') || '').trim();
		const src = img.getAttribute('src') || '';
		const fileName = alt || this.extractFileNameFromSrc(src);
		if (!fileName) return;

		const escapedName = fileName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
		const patterns = [
			new RegExp(`!\\[\\[${escapedName}(\\|[^\\]]*)?\\]\\]`),
			new RegExp(`!\\[([^\\]]*)\\]\\([^)]*${escapedName}[^)]*\\)`),
			new RegExp(`\\[([^\\]]*)\\]\\([^)]*${escapedName}[^)]*\\)`),
			new RegExp(`!?\\[\\[${escapedName}\\]\\]`),
		];

		let lineDeleted = false;
		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];
			if (patterns.some((p) => p.test(line))) {
				const newContent = lines.filter((_: string, idx: number) => idx !== i).join('\n');
				editor.setValue(newContent);
				lineDeleted = true;
				break;
			}
		}

		if (lineDeleted) {
			// 立即从 DOM 中移除该图片并重建布局，不等待 Obsidian 重渲染
			this.removeImageAndRebuildGallery(img, view.contentEl);
			// 再调度一次处理，确保与 Obsidian 渲染结果同步
			this.scheduleProcessWithRetries();
		}
	}

	/** 从 gallery 中移除指定图片并立即重建布局 */
	private removeImageAndRebuildGallery(img: HTMLImageElement, scope: HTMLElement): void {
		const gallery = img.closest('.journal-images') as HTMLElement | null;
		if (!gallery || !scope.contains(gallery)) return;

		const remainingImgs = Array.from(gallery.querySelectorAll('img.journal-editor-processed')).filter(
			(el) => el !== img
		) as HTMLImageElement[];

		if (remainingImgs.length === 0) {
			gallery.closest('.internal-embed')?.remove();
			gallery.remove();
			return;
		}

		// 清除 journal-editor-processed 以便 organizeImagesInContainer 重新处理
		remainingImgs.forEach((i) => i.classList.remove('journal-editor-processed'));

		gallery.className = 'journal-images ' + this.getLayoutClass(remainingImgs.length);
		gallery.innerHTML = '';
		this.organizeImagesInContainer(remainingImgs, gallery);
	}

	private extractFileNameFromSrc(src: string): string {
		try {
			const path = src.split('?')[0];
			const parts = path.split('/');
			return decodeURIComponent(parts[parts.length - 1] || '');
		} catch {
			return '';
		}
	}
}
