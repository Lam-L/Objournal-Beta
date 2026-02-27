import { App, Modal } from 'obsidian';

export interface DeleteConfirmModalOptions {
	message: string;
	confirmText?: string;
	cancelText?: string;
	onConfirm: () => void | Promise<void>;
}

/**
 * Obsidian 原生风格的确认对话框，替代 window.confirm()
 * 使用原生 Modal 可避免焦点丢失问题（如删除后编辑器无法获得光标）
 */
export class DeleteConfirmModal extends Modal {
	private options: DeleteConfirmModalOptions;

	constructor(app: App, options: DeleteConfirmModalOptions) {
		super(app);
		this.options = options;
	}

	onOpen(): void {
		this.setTitle('');
		this.contentEl.createEl('p', { text: this.options.message });
		const btnContainer = this.contentEl.createDiv({ cls: 'modal-button-container' });
		btnContainer
			.createEl('button', { text: this.options.cancelText ?? 'Cancel', cls: 'mod-cta' })
			.addEventListener('click', () => this.close());
		const confirmBtn = btnContainer.createEl('button', {
			text: this.options.confirmText ?? 'Confirm',
			cls: 'mod-warning',
		});
		confirmBtn.addEventListener('click', async () => {
			await this.options.onConfirm();
			this.close();
		});
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
