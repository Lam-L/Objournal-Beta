# 手记视图图片渲染优化调研

> 参考 notebook-navigator-source-code，对比当前实现并提出可优化点。

---

## 一、notebook-navigator 图片处理概览

### 1.1 架构与数据流

| 环节 | 实现 |
|------|------|
| **图片来源** | `FeatureImageContentProvider` 从正文提取第一张图（wiki/md/外部） |
| **缩略图生成** | 256×144 WebP/PNG，存入 IndexedDB |
| **渲染** | 优先从 IndexedDB 取 blob → `URL.createObjectURL` → `<img src={blob}>` |
| **回退** | blob 缺失时异步 regenerate，或直接 `vault.getResourcePath`（图片文件） |

### 1.2 关键常量（`limits.ts`）

```ts
thumbnails: {
  featureImage: {
    maxWidth: 256,
    maxHeight: 144,
    output: { mimeType: 'image/webp', quality: 0.75 }
  }
}
```

### 1.3 渲染与样式（`FileItem.tsx` + `list-feature-images.css`）

- **两种模式**：
  - **square**：`object-fit: cover`，固定尺寸（--nn-feature-image-min-size / max-size）
  - **natural**：`object-fit: contain`，`aspect-ratio` 在 `onLoad` 时根据 `naturalWidth/naturalHeight` 计算
- **加载失败**：`onError` → `setIsFeatureImageHidden(true)` → 容器添加 `nn-feature-image--hidden`，不再占位
- **防拖拽**：`draggable={false}`、`onDragStart={e => e.preventDefault()}`
- **动态尺寸**：`clamp(min, calc(item-height - padding), max)` 随虚拟列表高度适配

### 1.4 CSS 变量（`core-variables.css`）

```css
--nn-feature-image-min-size: 42px;
--nn-feature-image-max-size: 64px;
```

---

## 二、当前手记视图图片实现

### 2.1 数据来源与尺寸

| 环节 | 实现 |
|------|------|
| **提取** | `extractImagesFromContent()`：wiki/md 图片 → `app.vault.getResourcePath()` |
| **URL** | 直接使用 Obsidian resource URL（原图，无缩略图） |
| **展示数量** | `CONTENT.MAX_IMAGES_PER_CARD = 5`，多张时 1 大 + 4 小网格 |

### 2.2 懒加载与占位（`JournalImageContainer`）

- **视口检测**：`IntersectionObserver`（rootMargin: 100px）判断是否进入视口
- **渲染策略**：未进入视口时只渲染 `journal-image-placeholder`，不挂 `<img>`
- **进入视口后**：渲染 `<img src={url}>`，`loading="lazy"`、`decoding="async"`
- **占位样式**：使用 `.journal-image-placeholder`，**当前无独立 CSS**，可能未正确填满容器

### 2.3 样式与布局（`styles.css`）

- **object-fit**：统一 `object-fit: cover` + `object-position: center`
- **容器**：`--journal-image-height`、`--journal-image-gap`、`aspect-ratio` 控制 1/2/3/4/5+ 布局
- **错误处理**：`onError` 时仅 `console.error`，仍 `setIsLoaded(true)`，占位消失但无替代 UI

---

## 三、可优化点（按优先级）

### P0：必做

#### 3.1 补充占位符样式

**问题**：`.journal-image-placeholder` 无 CSS，可能未填满容器，导致布局闪烁或不一致。

**做法**：参考 notebook-navigator 的透明/灰色占位思路：

```css
.journal-image-placeholder {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  background: #e8e8e8; /* 与 .journal-image-container 背景一致 */
}
.theme-dark .journal-image-placeholder {
  background: #2d2d2d;
}
```

#### 3.2 加载失败时的 UI 行为

**问题**：图片加载失败后仅记录日志，视觉上仍像加载成功，用户体验差。

**做法**：参考 notebook-navigator：

- `onError` 时设置 `hasError`，渲染失败占位（如灰块 + 小图标）或直接隐藏该格
- 可选：支持「重试」按钮

#### 3.3 防拖拽

**问题**：图片可被拖拽，可能影响 Obsidian 内拖拽编辑体验。

**做法**：为 `<img>` 添加 `draggable={false}` 和 `onDragStart={e => e.preventDefault()}`。

---

### P1：推荐

#### 3.4 可选「自然比例」模式

**现状**：所有图片统一 `object-fit: cover`，竖向图会被裁剪。

**做法**：参考 notebook-navigator 的 square/natural 模式：

- 配置项：`forceSquareFeatureImage`（或 `useNaturalImageRatio`）
- natural 时：`object-fit: contain`，`aspect-ratio` 由 `onLoad` 的 `naturalWidth/naturalHeight` 计算
- 保持容器尺寸不变，避免布局跳动（可用预留最大比例）

#### 3.5 使用 CSS 变量控制尺寸

**现状**：尺寸写在固定 CSS 中。

**做法**：引入类似 `--journal-feature-image-min-size`、`--journal-feature-image-max-size`，便于主题/设置覆盖。

#### 3.6 错误时隐藏而非留白

**问题**：当前 `onError` 后仍 `setIsLoaded(true)`，若未做失败占位，会显示破图或空白。

**做法**：与 3.2 联合：失败时隐藏该图片格，或收缩布局，避免空白块。

---

### P2：中长期

#### 3.7 缩略图与 IndexedDB（参考 CALENDAR_VIEW_IMPLEMENTATION_PLAN）

**现状**：直接使用 `getResourcePath` 原图，大图多时内存与解码压力大。

**做法**：

- 后台任务生成 256×144（或类似）WebP 缩略图
- 存入 IndexedDB，列表/日历优先用缩略图 URL
- 点击查看再用原图
- 需权衡：实现复杂度 vs 大库性能收益

#### 3.8 优化 IntersectionObserver 的 root

**现状**：使用默认 root（viewport），列表在自定义滚动容器内时，可能不够精准。

**做法**：`root: document.querySelector('.journal-list-container')`（若存在），提升懒加载准确性。

#### 3.9 图片资源路径缓存

**现状**：每次渲染都依赖 `entry.images[].url`，`getResourcePath` 在提取阶段已调用。

**做法**：notebook-navigator 会缓存 resource path；我们已在 `extractImagesFromContent` 中生成 url，一般无需额外缓存，可确认是否有重复 `getResourcePath` 调用。

---

## 四、与 notebook-navigator 差异小结

| 项目 | notebook-navigator | 手记视图 | 建议 |
|------|--------------------|----------|------|
| 图片来源 | 首图 + IndexedDB 缩略图 | 多图 + 原图 URL | 中长期可考虑缩略图 |
| 加载失败 | 隐藏容器 | 仅 log，无 UI | 失败时隐藏或占位 |
| 占位符 | - | 无样式 | 补全样式 |
| 防拖拽 | 有 | 无 | 添加 |
| 比例模式 | square / natural 可选 | 仅 cover | 可选 natural |
| 懒加载 | 虚拟列表 + 原生 | IntersectionObserver + 条件渲染 | 可优化 root |
| 尺寸控制 | CSS 变量 clamp | 固定 CSS | 引入变量 |

---

## 五、建议实施顺序

1. **立刻**：占位符样式、防拖拽、加载失败 UI
2. **短期**：可选 natural 模式、CSS 变量
3. **中长期**：IndexedDB 缩略图（若有性能痛点再投入）

---

## 六、相关文件

| 模块 | 路径 |
|------|------|
| 图片容器 | `src/components/JournalImageContainer.tsx` |
| 图片样式 | `styles.css`（journal-image*） |
| 常量 | `src/constants.ts` |
| 日历实现说明 | `docs/CALENDAR_VIEW_IMPLEMENTATION_PLAN.md` |
