# 滚动渲染对比：nn vs 手记视图

## 现象

- **nn**：快速滑动时列表渲染流畅，卡片及时出现
- **手记视图**：滑动时渲染偏慢，卡片/图片出现有延迟感

---

## 一、核心差异

| 维度 | nn | 手记视图 | 影响 |
|------|-----|----------|------|
| **每卡片图片数** | 1 张（feature image） | 最多 5 张 | 滚动时我们 mount 的 img 数量是 nn 的约 5 倍 |
| **缩略图命中率** | 高（IndexedDB 持久化 + 预取） | 偏低（预取仅前 150 个 key，超出则逐张查） | 未命中时使用原图，加载/解码更重 |
| **无缩略图时 src** | `getResourcePath`（同原图） | `image.url`（原图） | 逻辑类似，但 nn 命中 blob 比例高，很少走到这里 |
| **overscan** | 10 | 20 | 我们预渲染更多项，但每项更重（5 图 vs 1 图） |
| **measureElement** | 每项 mount 时 | 每项 mount 时 | 相同，但我们每项 DOM 更重 |

---

## 二、滚动时发生什么

### 2.1 nn

- 滚动 → 新进入 overscan 的项约 10 个
- 每项 1 张图，约 10 个 `<img>` mount
- 多数命中 blob 缓存 → `src` 为 blob URL，几乎同步
- 每个 FileItem 结构相对固定：标题 + 预览 + 1 图

### 2.2 手记视图

- 滚动 → 新进入 overscan 的项约 20 个（overscan 更大）
- 每卡片最多 5 张图，约 20–100 个 `<img>` mount
- `useThumbnailUrl` 返回 `thumbUrl` 前先用 `image.url`（原图）
- 未命中缓存 → 大量原图同时加载、解码

---

## 三、主要瓶颈

### 3.1 原图先行

```ts
// useThumbnailUrl.ts
if (thumbUrl) return thumbUrl;
return image.url;  // ← 无缩略图时直接回退到原图
```

- 新进入视口的图片若不在 blob 缓存 → 立刻用原图 URL
- 原图体积大、解码慢，滚动时多张同时加载，主线程和网络压力都更大

### 3.2 每卡片图片数量

- nn：1 图/项
- 我们：最多 5 图/项
- overscan 20 时，理论上最多约 100 张图同时开始加载

### 3.3 measureElement 与布局

- 每次虚拟项 mount 都调用 `virtualizer.measureElement(element)` → `element.getBoundingClientRect()`
- 卡片越高、内容越多，layout 越重
- 我们卡片含 5 图 + 标题 + 预览，布局比 nn 更复杂

---

## 四、优化方向（按优先级）

### P0：无缩略图时优先占位，避免原图

- 在 `useThumbnailUrl` 中：`thumbUrl === null` 时返回占位 data URL 或空，而不是 `image.url`
- 仅当确认无缩略图且需要兜底时再使用原图
- 效果：避免滚动时大量原图同时加载

### P1：扩大预取范围 / 按视口预取

- 当前预取前 150 个 key，快速滚动到底部时命中率低
- 可按当前滚动位置，对「即将进入视口」的 entries 做定向预取

### P2：减少每卡片图片数（可选）

- 例如仅展示首图，其余用「+N」提示，可显著减少 DOM 和网络负载

### P3：CSS content-visibility

```css
.journal-card {
  content-visibility: auto;
  contain-intrinsic-size: 0 200px; /* 估算高度 */
}
```

- 让浏览器跳过离屏卡片的布局/绘制
- 需与虚拟化配合测试，避免与 `measureElement` 冲突

---

## 五、nn 使用而我们未用到的技术

以下来自 notebook-navigator 源码，可直接参考借鉴：

### 5.1 CSS `contain: layout style`

nn 在列表项和虚拟项上使用：

```css
/* 每个文件项 */
.nn-file {
    contain: layout style;
}
/* 每个虚拟项包装器 */
.nn-virtual-file-item {
    contain: layout style;
}
```

- **作用**：告诉浏览器该元素的布局/样式不影响外界，可隔离重排、支持并行渲染
- **效果**：滚动时单个项的变化不会触发整列表 reflow，减轻主线程压力

### 5.2 滚动层 GPU 加速（不透明背景）

nn 对滚动容器：

```css
.nn-list-pane-scroller {
    background-color: var(--nn-theme-list-bg); /* Opaque background for GPU scroll layer optimization */
}
```

- **作用**：不透明背景使浏览器更容易将滚动层提升到 GPU 合成
- **我们**：若 `.journal-view-container` 或 `.journal-list-container` 背景透明，可能无法享受该优化

### 5.3 imageDecodeBudgetPixels（图片解码预算）

nn 在 `FeatureImageContentProvider` 中用 `createRenderBudgetLimiter`：

- **移动端**：100M 像素，限制并发解码总量
- **桌面**：无限制
- **效果**：防止大量图片同时 decode 造成「解码风暴」，保证滚动流畅

我们目前没有像素级预算，大图多时易卡顿。

### 5.4 isScrollContainerReady 门控

nn 逻辑：`isScrollContainerReady = isVisible && containerVisible`

- `containerVisible`：ResizeObserver 检测到 `width>0 && height>0` 才为真
- scrollToIndex、measure 等操作在门控通过后才执行
- **效果**：容器隐藏或尺寸为 0 时不执行虚拟器操作，避免白屏或布局错误

我们的 ResizeObserver 仅用于 `virtualizer.measure()`，没有类似的「就绪门控」。

### 5.5 统一 listPaneMeasurements

nn 将标题行高、预览行高、图片区高度、padding 等抽成 `ListPaneMeasurements`，与 `estimateSize` 和 CSS 共用：

- 更准的 `estimateSize` → 减少 measure 后布局跳动
- 减少 `measureElement` 触发次数，间接减轻滚动时的 layout 成本

### 5.6 heightOptimization（高度优化）

nn 的 `settings.optimizeNoteHeight`：

- 空预览时折叠预留空间
- 置顶项可使用紧凑布局
- **效果**：降低单卡高度和 DOM 复杂度，提高滚动与测量效率

---

## 六、相关文件

| 模块 | 路径 |
|------|------|
| 缩略图 URL | `src/hooks/useThumbnailUrl.ts` |
| 虚拟化滚动 | `src/hooks/useJournalScroll.ts` |
| 图片容器 | `src/components/JournalImageContainer.tsx` |
| 卡片 | `src/components/JournalCard.tsx` |
| 预取 | `src/hooks/useThumbnailPrewarm.ts` |
