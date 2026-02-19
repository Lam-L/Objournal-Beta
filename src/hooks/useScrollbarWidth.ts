import { useEffect, useState } from 'react';

/**
 * 计算滚动条宽度的 Hook
 * 用于补偿滚动条对 padding 的影响
 */
export const useScrollbarWidth = (): number => {
	const [scrollbarWidth, setScrollbarWidth] = useState(0);

	useEffect(() => {
		// 创建一个临时的外层容器
		const outer = document.createElement('div');
		outer.style.visibility = 'hidden';
		outer.style.overflow = 'scroll';
		// @ts-ignore - msOverflowStyle 是 IE 特有的属性
		outer.style.msOverflowStyle = 'scrollbar'; // 用于 IE
		document.body.appendChild(outer);

		// 创建一个内层容器
		const inner = document.createElement('div');
		outer.appendChild(inner);

		// 计算滚动条宽度
		const width = outer.offsetWidth - inner.offsetWidth;

		// 清理
		document.body.removeChild(outer);

		setScrollbarWidth(width);

		// 监听窗口大小变化，重新计算（某些情况下滚动条宽度可能变化）
		const handleResize = () => {
			const outer = document.createElement('div');
			outer.style.visibility = 'hidden';
			outer.style.overflow = 'scroll';
			// @ts-ignore - msOverflowStyle 是 IE 特有的属性
			outer.style.msOverflowStyle = 'scrollbar';
			document.body.appendChild(outer);

			const inner = document.createElement('div');
			outer.appendChild(inner);

			const newWidth = outer.offsetWidth - inner.offsetWidth;
			document.body.removeChild(outer);

			if (newWidth !== scrollbarWidth) {
				setScrollbarWidth(newWidth);
			}
		};

		window.addEventListener('resize', handleResize);
		return () => {
			window.removeEventListener('resize', handleResize);
		};
	}, [scrollbarWidth]);

	return scrollbarWidth;
};
