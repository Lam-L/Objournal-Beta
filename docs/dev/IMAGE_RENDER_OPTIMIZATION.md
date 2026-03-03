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

## 四（续）、IndexedDB 缩略图实现对比（详细）

引入 IndexedDB 缩略图后，与 notebook-navigator 的详细对比如下。

### 4.1 缩略图尺寸与格式

| 项目 | notebook-navigator | 手记视图 | 说明 |
|------|--------------------|----------|------|
| **最大尺寸** | 256×144 | 256×144 | 一致 |
| **输出格式** | `image/webp`（默认） | `image/webp` | 一致 |
| **质量** | 0.75 | 0.75 | 一致 |
| **iOS 回退** | `iosMimeType: 'image/png'`，Safari WebP 编码有问题时用 PNG | 未实现 | nn 针对 iOS 做了格式回退 |
| **尺寸约束** | `createImageBitmap` 的 `maxWidth`/`maxHeight` 即可缩放 | 同左 | 一致 |

**差异**：手记视图在 iOS 上若 WebP 有问题，可能需增加 `Platform.isIOS` 时改用 PNG。

---

### 4.2 缓存 key 设计

| 项目 | notebook-navigator | 手记视图 | 说明 |
|------|--------------------|----------|------|
| **key 格式** | `featureImageKey`，本地为 `f:${file.path}@${mtime}` | `path@mtime` | nn 多一个 `f:` 前缀 |
| **索引维度** | 以**文件 path** 为主键，blob 中存 `{ featureImageKey, blob }` | 以 `path@mtime` 为 IndexedDB 主键 | 手记视图 key 即主键 |
| **key 校验** | get 时校验 `record.featureImageKey === expectedKey`，否则视为过期 | 主键已含 mtime，无需再校验 | nn 多一层防过期 |
| **引用类型** | 支持 local / external / youtube / excalidraw / pdf，key 格式不同 | 仅 local 图片，`path@mtime` 一种 | nn 多类型、多 key 逻辑 |

**差异**：nn 的 key 与主键分离，便于同一 path 多种图片来源；手记视图逻辑简单，仅本地图片。

---

### 4.3 内存缓存

| 项目 | notebook-navigator | 手记视图 | 说明 |
|------|--------------------|----------|------|
| **缓存内容** | **Blob**（`FeatureImageBlobCache`） | **blob URL**（`URL.createObjectURL` 结果） | nn 存 blob，手记存 url |
| **key 结构** | `path` → `{ featureImageKey, blob }` | `path@mtime` → `string` | 不同 |
| **驱逐策略** | 标准 LRU：`get` 时重插到末尾，满时删首项 | FIFO：满时删首个 key，并 `revokeObjectURL` | nn 是 LRU，手记是 FIFO |
| **容量** | `featureImageCacheMaxEntriesDefault: 1000` | `CACHE_MAX: 200` | nn 容量更大 |
| **key 变更** | key 变化时 `delete` 旧项，防止过期 blob | key 含 mtime，path 不变、mtime 变则新 key，旧 key 自然失效 | 行为等价，实现不同 |

**差异**：nn 的 LRU 更利于热点访问；手记的 blob URL 缓存可减少重复 `createObjectURL`，但驱逐为 FIFO，热点可能被挤出。

---

### 4.4 IndexedDB 存储结构

| 项目 | notebook-navigator | 手记视图 | 说明 |
|------|--------------------|----------|------|
| **主 store** | `featureImageBlobs`，key = file path | `journal-thumbnails`，key = `path@mtime` | nn 按文件，手记按图片 |
| **value 结构** | `{ featureImageKey, blob }` | `{ blob }` | nn 多 key 字段 |
| **主数据关联** | 主 store（fileData）存 `featureImageKey`、`featureImageStatus` | 无主数据，完全由 `path@mtime` 决定 | nn 与文件元数据强耦合 |

**差异**：nn 是完整文件元数据系统的一部分；手记视图是独立的图片缩略图缓存。

---

### 4.5 图片来源与数量

| 项目 | notebook-navigator | 手记视图 | 说明 |
|------|--------------------|----------|------|
| **每条目图片数** | 1 张（feature image） | 最多 5 张 | 手记多图展示 |
| **图片来源** | md 正文首图 / 外部 URL / YouTube / PDF 封面 / Excalidraw | 仅 vault 本地图片（wiki、md） | nn 来源更多 |
| **外部图片** | `requestUrl` + 超时与并发控制 | 不支持 | nn 支持外链缩略图 |

---

### 4.6 生成与触发

| 项目 | notebook-navigator | 手记视图 | 说明 |
|------|--------------------|----------|------|
| **触发** | Content Provider 队列，vault 扫描时批量生成 | 组件 mount 后，`getThumbnailBlob` 未命中时 fire-and-forget | nn 有队列，手记无队列 |
| **并发** | `thumbnailCanvasParallelLimit: 6`，`imageDecodeBudgetPixels` 限制 | 无显式限制 | nn 控制并发和像素预算 |
| **大图** | `maxImageBytes` 50MB（本地） | 50MB 硬编码 | 逻辑类似 |
| **regenerate** | blob 缺失时 `regenerateFeatureImageForFile`，带 throttle | 首次未命中即生成，无 throttle | nn 有防抖和重试控制 |

---

### 4.7 渲染与回退

| 项目 | notebook-navigator | 手记视图 | 说明 |
|------|--------------------|----------|------|
| **首选** | IndexedDB blob → `URL.createObjectURL` | 同左 | 一致 |
| **回退** | blob 缺失：图片文件用 `getResourcePath`；非图片文件可能无回退 | 始终用 `image.url`（`getResourcePath`） | 手记视图总有原图回退 |
| **blob 更新** | key 变化会删旧 blob，避免脏缓存 | mtime 变化产生新 key，旧 key 不再使用 | 都能正确失效 |
| **object URL 释放** | 组件 unmount 时 `revokeObjectURL` | 仅缓存驱逐时 revoke，组件 unmount 不 revoke | nn 更稳妥，避免泄漏 |

---

### 4.8 文件重命名 / 移动

| 项目 | notebook-navigator | 手记视图 | 说明 |
|------|--------------------|----------|------|
| **处理** | `FeatureImageBlobStore.moveBlob(oldPath, newPath)`，同步更新内存缓存 | **未实现**，重命名后 `path@mtime` 变化，会重新生成 | nn 保留旧缩略图，手记会重建 |

**差异**：nn 迁移 blob 可减少重复生成；手记视图依赖重新生成，有一定额外开销。

---

### 4.9 平台适配与限制

| 项目 | notebook-navigator | 手记视图 | 说明 |
|------|--------------------|----------|------|
| **移动端** | `imageDecodeBudgetPixels.mobile: 100M`，更严格 | 无区分 | nn 对移动端更保守 |
| **createImageBitmap** | 支持，且处理 `imageOrientation` | 支持，但不处理 `imageOrientation` | nn 对 EXIF 方向更完善 |
| **SVG** | 未在 SUPPORTED_EXTENSIONS 中 | 未支持 | 两者都不处理 SVG |

---

### 4.10 汇总表

| 维度 | notebook-navigator | 手记视图 |
|------|--------------------|----------|
| 缩略图尺寸 | 256×144 | 256×144 |
| 格式 | WebP / PNG(iOS) | WebP |
| 缓存 key | `featureImageKey`（含多种类型） | `path@mtime` |
| 内存缓存 | Blob LRU，1000 条 | blob URL FIFO，200 条 |
| 每卡片图片 | 1 张 | 最多 5 张 |
| 外部图片 | 支持 | 不支持 |
| 生成队列 | Content Provider 队列 | 无队列，按需生成 |
| 并发控制 | 有（canvas、decode、external） | 无 |
| 文件重命名 | 迁移 blob | 重新生成 |
| object URL 释放 | unmount 时 revoke | 仅驱逐时 revoke |

---

## 五、建议实施顺序

1. **立刻**：占位符样式、防拖拽、加载失败 UI
2. **短期**：可选 natural 模式、CSS 变量
3. **中长期**：IndexedDB 缩略图（若有性能痛点再投入）

---

## 六、缩略图预取（Prewarm）

为减少「加载感」，参考 nn 的 storage sync + Content Provider 预生成：

- **useThumbnailPrewarm**：entries 加载时，从 IndexedDB 批量拉取前 150 个缩略图 key 的 blob，填满 `thumbnailBlobCache`
- **getThumbnailBlobs**：storage 提供批量读接口，单事务减少 IDB 往返
- **触发时机**：`JournalViewContent` 在拥有 entries 时立即触发，先于/并行于首帧 ImageItem 渲染

详见 `docs/THUMBNAIL_LOADING_COMPARISON.md`。

---

## 七、相关文件

| 模块 | 路径 |
|------|------|
| 图片容器 | `src/components/JournalImageContainer.tsx` |
| 缩略图 URL | `src/hooks/useThumbnailUrl.ts` |
| 缩略图预取 | `src/hooks/useThumbnailPrewarm.ts` |
| 图片样式 | `styles.css`（journal-image*） |
| 常量 | `src/storage/constants.ts` |
| 加载对比分析 | `docs/THUMBNAIL_LOADING_COMPARISON.md` |
| 日历实现说明 | `docs/CALENDAR_VIEW_IMPLEMENTATION_PLAN.md` |
