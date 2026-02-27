import { useMemo, useState, useCallback } from 'react';
import { JournalEntry } from '../utils/utils';
import { dateToIso, getMonthGrid, type CalendarDay } from '../utils/calendarUtils';

export interface UseCalendarMonthResult {
	/** 当前显示的月份（用于切换） */
	cursorMonth: Date;
	setCursorMonth: (d: Date) => void;
	/** 上月 */
	prevMonth: () => void;
	/** 下月 */
	nextMonth: () => void;
	/** 回到今天所在月 */
	goToToday: () => void;
	/** 当前选中的日期 iso */
	selectedIso: string | null;
	setSelectedIso: (iso: string | null) => void;
	/** 6×7 的日期网格 */
	days: CalendarDay[];
	/** iso -> entry 映射 */
	entriesByIso: Map<string, JournalEntry>;
	/** iso -> 第一张图 URL */
	firstImageUrlByIso: Map<string, string>;
}

/**
 * 月历数据 hook：根据 entries 和 cursorMonth 生成月历网格及映射
 * entries 已由 useJournalEntries 按 targetFolderPath 过滤
 */
export function useCalendarMonth(entries: JournalEntry[]): UseCalendarMonthResult {
	const [cursorMonth, setCursorMonth] = useState(() => {
		const d = new Date();
		d.setDate(1);
		return d;
	});
	const [selectedIso, setSelectedIso] = useState<string | null>(null);

	const prevMonth = useCallback(() => {
		setCursorMonth((prev) => {
			const d = new Date(prev.getFullYear(), prev.getMonth() - 1, 1);
			return d;
		});
	}, []);

	const nextMonth = useCallback(() => {
		setCursorMonth((prev) => {
			const d = new Date(prev.getFullYear(), prev.getMonth() + 1, 1);
			return d;
		});
	}, []);

	const goToToday = useCallback(() => {
		const d = new Date();
		d.setDate(1);
		setCursorMonth(d);
	}, []);

	const { days, entriesByIso, firstImageUrlByIso } = useMemo(() => {
		const days = getMonthGrid(cursorMonth);
		const entriesByIso = new Map<string, JournalEntry>();
		const firstImageUrlByIso = new Map<string, string>();

		for (const entry of entries) {
			const iso = dateToIso(entry.date);
			// 同一天可能有多条，取第一条（按日期倒序，即最新的一条）
			if (!entriesByIso.has(iso)) {
				entriesByIso.set(iso, entry);
				if (entry.images.length > 0 && entry.images[0].url) {
					firstImageUrlByIso.set(iso, entry.images[0].url);
				}
			}
		}

		return { days, entriesByIso, firstImageUrlByIso };
	}, [entries, cursorMonth]);

	return {
		cursorMonth,
		setCursorMonth,
		prevMonth,
		nextMonth,
		goToToday,
		selectedIso,
		setSelectedIso,
		days,
		entriesByIso,
		firstImageUrlByIso,
	};
}
