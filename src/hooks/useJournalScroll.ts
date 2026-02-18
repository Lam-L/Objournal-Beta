import { useRef, useMemo, useCallback } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { JournalEntry } from '../utils/utils';
import { groupByMonth } from '../utils/utils';

interface VirtualListItem {
	type: 'month-header' | 'card';
	monthKey?: string;
	entry?: JournalEntry;
	index: number;
}

// 缓存已测量的高度
const sizeCache = new Map<number, number>();

export const useJournalScroll = (entries: JournalEntry[]) => {
	const parentRef = useRef<HTMLDivElement>(null);

	// 构建虚拟化列表项
	const listItems = useMemo<VirtualListItem[]>(() => {
		const items: VirtualListItem[] = [];
		const grouped = groupByMonth(entries);
		const sortedMonths = Object.keys(grouped).sort((a, b) => {
			const parseMonthKey = (monthKey: string): Date => {
				const match = monthKey.match(/(\d{4})年(\d{1,2})月/);
				if (match) {
					return new Date(parseInt(match[1]), parseInt(match[2]) - 1, 1);
				}
				return new Date();
			};

			const dateA = parseMonthKey(a);
			const dateB = parseMonthKey(b);
			return dateB.getTime() - dateA.getTime();
		});

		let index = 0;
		for (const monthKey of sortedMonths) {
			items.push({
				type: 'month-header',
				monthKey,
				index: index++,
			});

			for (const entry of grouped[monthKey]) {
				items.push({
					type: 'card',
					entry,
					index: index++,
				});
			}
		}

		return items;
	}, [entries]);

	const estimateSize = useCallback((index: number): number => {
		// 如果缓存中有，使用缓存
		if (sizeCache.has(index)) {
			return sizeCache.get(index)!;
		}

		const item = listItems[index];
		if (!item) {
			return 50;
		}

		if (item.type === 'month-header') {
			return 50; // 月份标题高度
		}

		// 根据卡片内容估算高度
		// 基础高度：标题 + 日期 + padding = 80px
		// 内容预览：每行约 20px，最多 3 行 = 60px
		// 图片：如果有图片，约 200px
		let estimatedHeight = 80; // 基础高度
		
		if (item.entry) {
			// 如果有图片，增加图片高度
			if (item.entry.images.length > 0) {
				estimatedHeight += 200;
			}
			// 如果有内容预览，增加内容高度
			if (item.entry.preview) {
				const previewLines = Math.ceil(item.entry.preview.length / 50);
				estimatedHeight += Math.min(previewLines * 20, 60);
			}
		}

		return estimatedHeight;
	}, [listItems]);

	const virtualizer = useVirtualizer({
		count: listItems.length,
		getScrollElement: () => parentRef.current,
		estimateSize,
		overscan: 5,
		// 启用动态高度测量
		measureElement: (element) => {
			if (!element) {
				return 0;
			}
			return element.getBoundingClientRect().height;
		},
	});

	return {
		parentRef,
		virtualizer,
		listItems,
	};
};
