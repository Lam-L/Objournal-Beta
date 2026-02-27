import type { JournalEntry } from './utils';
import { strings } from '../i18n';

/** 判断是否为「那年今日」（同月同日，往年） */
export function isOnThisDay(entry: JournalEntry): boolean {
	const today = new Date();
	const d = new Date(entry.date);
	return (
		d.getMonth() === today.getMonth() &&
		d.getDate() === today.getDate() &&
		d.getFullYear() < today.getFullYear()
	);
}

/** 从所有条目中筛选那年今日，按年份倒序（最近的在前） */
export function getOnThisDayEntries(entries: JournalEntry[]): JournalEntry[] {
	return entries
		.filter(isOnThisDay)
		.sort((a, b) => b.date.getTime() - a.date.getTime());
}

/** 获取最近1年的那条那年今日（用于首页展示） */
export function getLatestOnThisDayWithinYear(entries: JournalEntry[]): JournalEntry | null {
	const onThisDay = getOnThisDayEntries(entries);
	if (onThisDay.length === 0) return null;
	// 最近1年 = 去年同日的条目（取第一个，即年份最大的）
	return onThisDay[0];
}

/** 格式化「X年前」 */
export function formatYearsAgo(entry: JournalEntry): string {
	const years = new Date().getFullYear() - new Date(entry.date).getFullYear();
	return strings.onThisDay.yearsAgo(years);
}
