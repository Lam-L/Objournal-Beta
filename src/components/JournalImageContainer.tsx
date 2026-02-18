import React, { useState, useEffect, useRef, memo } from 'react';
import { ImageInfo } from '../utils/utils';

interface JournalImageContainerProps {
	images: ImageInfo[];
	totalImages: number;
	allImages: ImageInfo[];
}

interface ImageItemProps {
	image: ImageInfo;
	index: number;
	className?: string;
	showMoreCount?: number;
}

const ImageItem: React.FC<ImageItemProps> = ({ image, index, className, showMoreCount }) => {
	const [isLoaded, setIsLoaded] = useState(false);
	const containerRef = useRef<HTMLDivElement>(null);
	const imgRef = useRef<HTMLImageElement>(null);

	useEffect(() => {
		if (!containerRef.current) {
			return;
		}

		// 检查元素是否已经在视口中
		const rect = containerRef.current.getBoundingClientRect();
		const isInViewport = rect.top < window.innerHeight + 100 && rect.bottom > -100;
		
		if (isInViewport) {
			setIsLoaded(true);
			return;
		}

		// 如果不在视口中，使用 IntersectionObserver
		const observer = new IntersectionObserver(
			(entries) => {
				entries.forEach((entry) => {
					if (entry.isIntersecting && !isLoaded) {
						setIsLoaded(true);
						observer.unobserve(entry.target);
					}
				});
			},
			{ rootMargin: '100px' }
		);

		observer.observe(containerRef.current);

		return () => {
			observer.disconnect();
		};
	}, [isLoaded]);

	const handleClick = (e: React.MouseEvent) => {
		// 阻止事件冒泡，避免触发卡片的点击事件
		e.stopPropagation();
		// TODO: 实现图片查看器
		console.log('Open image viewer', image);
	};

	const handleImageLoad = () => {
		setIsLoaded(true);
	};

	const handleImageError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
		const img = e.currentTarget;
		console.error('Failed to load image:', image.url, 'Image element:', img);
		
		// 尝试使用备用方法加载图片
		// 某些 Obsidian 资源路径可能需要特殊处理
		if (image.url && !image.url.startsWith('http')) {
			// 如果是 Obsidian 资源路径，尝试直接使用文件路径
			// 但这里我们只能记录错误，因为 React 组件无法直接访问 app.vault
			console.warn('Image load failed, this may be a non-standard image format or path issue');
		}
		
		setIsLoaded(true); // 即使加载失败也设置为 true，避免一直显示占位符
	};

	return (
		<div
			ref={containerRef}
			className={`journal-image-container ${className || ''}`}
			onClick={handleClick}
		>
			{isLoaded ? (
				<img
					ref={imgRef}
					src={image.url}
					alt={image.altText || image.name}
					className="journal-image"
					loading="lazy"
					decoding="async"
					onLoad={handleImageLoad}
					onError={handleImageError}
				/>
			) : (
				<div className="journal-image-placeholder" />
			)}
			{showMoreCount !== undefined && showMoreCount > 0 && (
				<div className="journal-image-more">
					+{showMoreCount}
				</div>
			)}
		</div>
	);
};

export const JournalImageContainer: React.FC<JournalImageContainerProps> = memo(({
	images,
	totalImages,
	allImages,
}) => {
	const imageCount = images.length;
	// 5+ 张图使用 multiple 类名，而不是 five
	const containerClass = `journal-images journal-images-${imageCount === 1 ? 'single' : imageCount === 2 ? 'double' : imageCount === 3 ? 'triple' : imageCount === 4 ? 'quad' : 'multiple'}`;
	const moreCount = totalImages > images.length ? totalImages - images.length : undefined;

	if (imageCount === 1) {
		return (
			<div className={containerClass}>
				<ImageItem image={images[0]} index={0} showMoreCount={moreCount} />
			</div>
		);
	}

	if (imageCount === 2) {
		return (
			<div className={containerClass}>
				<ImageItem image={images[0]} index={0} />
				<ImageItem image={images[1]} index={1} showMoreCount={moreCount} />
			</div>
		);
	}

	if (imageCount === 3) {
		return (
			<div className={containerClass}>
				<ImageItem image={images[0]} index={0} className="journal-image-container-large" />
				<ImageItem image={images[1]} index={1} className="journal-image-container-small" />
				<ImageItem image={images[2]} index={2} className="journal-image-container-small" showMoreCount={moreCount} />
			</div>
		);
	}

	if (imageCount === 4) {
		return (
			<div className={containerClass}>
				{/* 左图：h = Height, w = Height */}
				<ImageItem image={images[0]} index={0} className="journal-image-container-quad-left" />
				{/* 右上图：h = (Height - Gap)/2, w = Height */}
				<ImageItem image={images[1]} index={1} className="journal-image-container-quad-right-top" />
				{/* 右下图包装器：包含两个小图 */}
				<div className="journal-images-quad-right-bottom">
					{/* 右下图1：h = (Height - Gap)/2, w = (Height - Gap)/2 */}
					<ImageItem image={images[2]} index={2} className="journal-image-container-quad-right-bottom-left" />
					{/* 右下图2：h = (Height - Gap)/2, w = (Height - Gap)/2 */}
					<ImageItem image={images[3]} index={3} className="journal-image-container-quad-right-bottom-right" showMoreCount={moreCount} />
				</div>
			</div>
		);
	}

	// 5+ images
	return (
		<div className={containerClass}>
			{/* 左图：h = Height, w = Height */}
			<ImageItem image={images[0]} index={0} className="journal-image-container-large" />
			{/* 右侧2x2网格包装器 */}
			<div className="journal-images-multiple-right-grid">
				{/* 右侧4个小图：每个都是 h = (Height - Gap)/2, w = (Height - Gap)/2 */}
				{images.slice(1, 5).map((image, index) => (
					<ImageItem
						key={index + 1}
						image={image}
						index={index + 1}
						className="journal-image-container-small"
						showMoreCount={index === 3 ? moreCount : undefined}
					/>
				))}
			</div>
		</div>
	);
}, (prevProps, nextProps) => {
	// 自定义比较：只有当图片数组变化时才重新渲染
	return (
		prevProps.images.length === nextProps.images.length &&
		prevProps.totalImages === nextProps.totalImages &&
		prevProps.images.every((img, index) => img.path === nextProps.images[index]?.path)
	);
});
