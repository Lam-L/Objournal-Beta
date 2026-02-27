/**
 * 日历相关工具函数
 */

/**
 * 将 Date 转为 ISO 日期字符串 (YYYY-MM-DD)
 */
export function dateToIso(date: Date): string {
	const y = date.getFullYear();
	const m = String(date.getMonth() + 1).padStart(2, '0');
	const d = String(date.getDate()).padStart(2, '0');
	return `${y}-${m}-${d}`;
}

/**
 * 判断两个日期是否是同一天
 */
export function isSameDay(date1: Date, date2: Date): boolean {
	return (
		date1.getFullYear() === date2.getFullYear() &&
		date1.getMonth() === date2.getMonth() &&
		date1.getDate() === date2.getDate()
	);
}

/** 月历中单格的类型：当月日期 | 上月尾 | 下月头 */
export type DayCellType = 'current' | 'prev' | 'next';

export interface CalendarDay {
	date: Date;
	iso: string;
	type: DayCellType;
	/** 是否为今天 */
	isToday: boolean;
}

/**
 * 生成某月的日历网格（周日为第一天）
 * 行数随月份变化（4~6 行），紧贴内容无多余空白
 * 包含上月尾和下月头以填充空白
 */
export function getMonthGrid(cursorMonth: Date): CalendarDay[] {
	const year = cursorMonth.getFullYear();
	const month = cursorMonth.getMonth();
	const today = new Date();
	today.setHours(0, 0, 0, 0);

	// 当月第一天
	const firstDay = new Date(year, month, 1);
	const firstDayOfWeek = firstDay.getDay(); // 0=周日, 1=周一, ...

	// 上月最后几天
	const prevMonthLastDate = new Date(year, month, 0).getDate();
	const prevMonthDays: CalendarDay[] = [];
	for (let i = firstDayOfWeek - 1; i >= 0; i--) {
		const d = prevMonthLastDate - i;
		const date = new Date(year, month - 1, d);
		prevMonthDays.push({
			date,
			iso: dateToIso(date),
			type: 'prev',
			isToday: isSameDay(date, today),
		});
	}

	// 当月所有天
	const currentMonthDays = new Date(year, month + 1, 0).getDate();
	const currentDays: CalendarDay[] = [];
	for (let d = 1; d <= currentMonthDays; d++) {
		const date = new Date(year, month, d);
		currentDays.push({
			date,
			iso: dateToIso(date),
			type: 'current',
			isToday: isSameDay(date, today),
		});
	}

	// 下月头几天（补满最小行数，使日历紧贴内容：4~6 行随月份变化）
	const totalSoFar = prevMonthDays.length + currentDays.length;
	const minRowsNeeded = Math.ceil(totalSoFar / 7);
	const cellsNeeded = minRowsNeeded * 7;
	const nextMonthDaysNeeded = Math.max(0, cellsNeeded - totalSoFar);
	const nextDays: CalendarDay[] = [];
	for (let d = 1; d <= nextMonthDaysNeeded; d++) {
		const date = new Date(year, month + 1, d);
		nextDays.push({
			date,
			iso: dateToIso(date),
			type: 'next',
			isToday: isSameDay(date, today),
		});
	}

	return [...prevMonthDays, ...currentDays, ...nextDays];
}
