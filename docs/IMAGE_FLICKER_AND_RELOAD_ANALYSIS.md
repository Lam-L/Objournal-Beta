# 图片闪烁与重复加载问题分析

## 一、现象描述

1. **闪烁明显**：滚动时图片区域有可见的闪烁
2. **区间内滑动需重新加载**：在同一区间上下滑动时，图片每次都先显示灰色，再重新加载

---

## 二、代码层面根因分析

### 2.1 问题 2 根因：虚拟化 + 自定义懒加载叠加

**数据流**：

```
虚拟化 (useJournalScroll)
  → 只渲染 getVirtualItems() 中的项
  → 滚动出视口 → 组件被 unmount（DOM 销毁）
  → 滚回视口 → 重新 mount（全新实例）

ImageItem 每次 mount 时：
  → isLoaded 初始为 false
  → 渲染灰色 placeholder
  → useEffect：getBoundingClientRect 或 IntersectionObserver
  → setIsLoaded(true)
  → 渲染 <img src={url} />
  → 浏览器加载/解码图片
  → 图片显示
```

**结论**：

- 虚拟化会 unmount 离开视口的卡片；再次进入视口时是全新 mount
- 每次 mount 都会经历：placeholder → 判断是否在视口 → 挂 img → 加载 → 显示
- 即使浏览器已缓存图片，仍会重复上述流程，因为组件实例是新建的

### 2.2 自定义懒加载在虚拟化场景下是多余的

虚拟化已经按视口决定哪些项被渲染。卡片被挂到 DOM，就意味着虚拟器认为它在可见区域内。ImageItem 再做一次「视口内才加载」的意义不大，反而带来：

1. 至少一帧的 placeholder 显示
2. `useEffect` 延迟执行带来的闪烁
3. 条件渲染 `{isLoaded ? <img /> : <div className="placeholder" />}` 带来的元素切换

### 2.3 问题 1 根因：闪烁来源

| 来源 | 说明 |
|------|------|
| placeholder 切换 | placeholder → img 的 DOM 切换，布局和样式都可能突变 |
| 占位符样式缺失 | `.journal-image-placeholder` 无专门样式，尺寸可能未填满容器，易造成布局抖动 |
| estimateSize 偏差 | 卡片高度估算不准时，measureElement 会触发 virtualizer 重新计算，导致位置跳动 |
| 图片加载完成瞬间 | 从空白/占位到图片出现，对比强，易产生闪烁感 |

### 2.4 IntersectionObserver 的 root 可能不匹配

```javascript
// JournalImageContainer.tsx 当前逻辑
const isInViewport = rect.top < window.innerHeight + 100 && rect.bottom > -100;
// 以及
new IntersectionObserver(..., { rootMargin: '100px' })  // 默认 root = viewport
```

滚动容器是 `.journal-view-container`，不是 `window`。在分栏、嵌入等布局下，用 window 判断视口会有偏差。

---

## 三、技术方案

### 方案 A：虚拟化场景下取消图片懒加载（推荐）

**思路**：虚拟化已限制可见项，被渲染的卡片应直接加载图片，不再做自定义懒加载。

**改动**：

1. 在 `JournalImageContainer` 中增加 `skipLazyLoad?: boolean`（或通过 context 判断是否在虚拟化列表内）
2. 当 `skipLazyLoad === true` 时：
   - 不再使用 `isLoaded` 和 placeholder
   - 直接渲染 `<img src={...} loading="lazy" decoding="async" />`
   - 原生 `loading="lazy"` 由浏览器处理

3. `JournalList` 使用虚拟化，传入 `skipLazyLoad={true}`；非虚拟化场景（如那年今日）仍使用原有懒加载逻辑

**预期效果**：

- 不再每次 mount 都先显示 placeholder
- 图片从缓存加载时几乎无额外延迟
- 闪烁显著减少

### 方案 B：图片淡入 + 占位符样式（配合方案 A）

**思路**：在直接挂 img 的基础上，让图片加载完成后以淡入方式出现，减少突兀感。

**改动**：

1. 为 `.journal-image-placeholder` 增加样式，保证其填满容器、避免布局抖动：

```css
.journal-image-placeholder {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  background: #e8e8e8;
}
.theme-dark .journal-image-placeholder {
  background: #2d2d2d;
}
```

2. 使用 `onLoad` 实现图片淡入：

```jsx
// 始终渲染 img，用 opacity 控制显示
<img
  src={image.url}
  style={{ opacity: imageLoaded ? 1 : 0 }}
  onLoad={() => setImageLoaded(true)}
/>
```

配合 `.journal-image-container { background: #e8e8e8 }`，加载前为灰色背景，加载后淡入，过渡更平滑。

### 方案 C：提高 overscan，降低 remount 频率

**改动**：在 `useJournalScroll.ts` 中将 `overscan` 从 5 调高到 8–10。

**效果**：上下小幅滚动时，卡片更可能保持在 overscan 中不被 unmount，减少重新加载。但对大幅快速滚动帮助有限，且会略微增加 DOM 数量。

### 方案 D：修正 IntersectionObserver 的 root（非虚拟化场景）

在非虚拟化列表（如那年今日）中保留懒加载时，应使用实际滚动容器作为 root：

```javascript
const scrollRoot = containerRef.current?.closest('.journal-view-container') ?? null;
new IntersectionObserver(callback, { root: scrollRoot, rootMargin: '100px' });
```

---

## 四、推荐实施顺序

| 优先级 | 内容 | 预期改善 |
|--------|------|----------|
| P0 | 方案 A：虚拟化场景下 skipLazyLoad，直接渲染 img | 解决重复加载、灰块闪烁 |
| P1 | 方案 B：补全 placeholder 样式 + 图片淡入（可选，做过渡更平滑） | 进一步降低闪烁 |
| P2 | 方案 C：overscan 调为 8 | 减少小幅滚动时的 remount |
| P3 | 方案 D：修正 IntersectionObserver root | 非虚拟化场景下更精确 |

---

## 五、涉及文件

| 文件 | 改动 |
|------|------|
| `src/components/JournalImageContainer.tsx` | 增加 skipLazyLoad，虚拟化时直接挂 img |
| `src/components/JournalList.tsx` | 传给 JournalCard/JournalImageContainer 的 skipLazyLoad 等参数 |
| `src/components/JournalCard.tsx` | 透传 skipLazyLoad 到 JournalImageContainer |
| `src/hooks/useJournalScroll.ts` | 可选：overscan 从 5 调整为 8 |
| `styles.css` | 可选：补全 `.journal-image-placeholder` 样式 |

---

## 六、与 notebook-navigator 的差异

notebook-navigator 使用 IndexedDB 缩略图 blob，且每个列表项通常在虚拟列表可见范围内会保持较长时间挂载；我们的实现是直接使用原图 URL，并在虚拟化之上又做了自定义懒加载，两者叠加导致了更明显的闪烁和重复加载。
