import React, { useRef, useEffect } from 'react';
import { useJournalData } from '../context/JournalDataContext';
import { useJournalScroll } from '../hooks/useJournalScroll';
import { JournalCard } from './JournalCard';

export const JournalList: React.FC = () => {
    const { entries } = useJournalData();
    const { parentRef, virtualizer, listItems } = useJournalScroll(entries);
    const itemRefs = useRef<Map<number, HTMLDivElement>>(new Map());
    const scrollPositionRef = useRef<number>(0);

    // 保存滚动位置
    useEffect(() => {
        const scrollElement = parentRef.current;
        if (!scrollElement) return;

        const handleScroll = () => {
            scrollPositionRef.current = scrollElement.scrollTop;
        };

        scrollElement.addEventListener('scroll', handleScroll, { passive: true });
        return () => {
            scrollElement.removeEventListener('scroll', handleScroll);
        };
    }, [parentRef]);

    // 恢复滚动位置（当 entries 变化时）
    useEffect(() => {
        const scrollElement = parentRef.current;
        if (!scrollElement || scrollPositionRef.current === 0) return;

        // 使用 requestAnimationFrame 确保在渲染后恢复
        requestAnimationFrame(() => {
            if (scrollElement) {
                scrollElement.scrollTop = scrollPositionRef.current;
            }
        });
    }, [entries.length, parentRef]);

    // 当虚拟项变化时，更新测量
    useEffect(() => {
        virtualizer.measure();
    }, [entries.length, virtualizer]);

    return (
        <div
            ref={parentRef}
            className="journal-list-container"
        >
            <div
                style={{
                    height: `${virtualizer.getTotalSize()}px`,
                    width: '100%',
                    position: 'relative',
                }}
            >
                {virtualizer.getVirtualItems().map((virtualItem) => {
                    const item = listItems[virtualItem.index];

                    if (!item) {
                        return null;
                    }

                    const setRef = (element: HTMLDivElement | null) => {
                        if (element) {
                            itemRefs.current.set(virtualItem.index, element);
                            virtualizer.measureElement(element);
                        } else {
                            itemRefs.current.delete(virtualItem.index);
                        }
                    };

                    if (item.type === 'month-header') {
                        // 使用 monthKey 作为稳定的 key
                        return (
                            <div
                                key={`month-${item.monthKey}`}
                                ref={setRef}
                                data-index={virtualItem.index}
                                style={{
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    width: '100%',
                                    transform: `translateY(${virtualItem.start}px)`,
                                }}
                            >
                                <h2 className="journal-month-title">{item.monthKey}</h2>
                            </div>
                        );
                    }

                    if (item.type === 'card' && item.entry) {
                        // 使用 file.path 作为稳定的 key，而不是 virtualItem.key
                        return (
                            <div
                                key={item.entry.file.path}
                                ref={setRef}
                                data-index={virtualItem.index}
                                style={{
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    width: '100%',
                                    transform: `translateY(${virtualItem.start}px)`,
                                }}
                            >
                                <JournalCard entry={item.entry} skipLazyLoad />
                            </div>
                        );
                    }

                    return null;
                })}
            </div>
        </div>
    );
};
