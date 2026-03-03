# 缩略图加载体验对比：nn vs 手记视图

## 现象

- **nn**：打开 Obsidian 时，列表中的图片已渲染完成
- **手记视图**：有明显的「加载中」感觉，图片逐个出现

---

## 一、nn 的加载策略

### 1.1 显示门控：isStorageReady

```ts
// NotebookNavigatorContainer.tsx
if (!isStorageReady) {
    return <SkeletonView ... />;  // 骨架屏，不显示列表
}
return <NotebookNavigatorComponent />;  // 列表
```

- 列表**不显示**，直到 `isStorageReady === true`
- 用户看到的是 SkeletonView，而不是空列表或半加载列表

### 1.2 Storage 就绪前在做什么

`useStorageVaultSync` 中：

1. `calculateFileDiff`：对比 vault 与数据库
2. `recordFileChanges`：更新 IndexedDB
3. `rebuildTagTree` / `rebuildPropertyTree`
4. **然后** `setIsStorageReady(true)`
5. 接着 `queueMetadataContentWhenReady`、`queueFilesForAllProviders`（含 fileThumbnails）

缩略图在队列中异步生成，但列表此时已经显示。

### 1.3 为何 nn 的图片看起来已经渲染好

1. **跨会话持久化**：缩略图在 IndexedDB 中持久化，下次启动可直接用
2. **Content Provider 预生成**：vault 同步时对 pdf/图片等文件预生成缩略图
3. **内存 blob 缓存**：`FeatureImageBlobStore` 有 LRU，命中时 `getFeatureImageBlob` 几乎同步
4. **FileItem 初始 imageUrl**：对图片文件，先用 `getResourcePath`，再异步用 blob 替换，多数命中缓存

---

## 二、手记视图的加载策略

### 2.1 显示逻辑

- 无「storage ready」门控
- `useJournalEntries` 一开始 `isLoading=true`
- 有 entries 后立刻渲染列表（含「loading 且已有 entries」时仍显示内容）
- 图片由 `useThumbnailUrl` 按需解析

### 2.2 单个图片的加载流程

1. `thumbUrl = null` 时，先用 `image.url`（原图 URL）
2. 并行异步：`storage.getThumbnailBlob(key)`、未命中则 `generateAndStoreThumbnail`
3. 有 blob 后，设置 `thumbUrl`，改用缩略图

### 2.3 产生「强加载感」的原因

| 因素 | 说明 |
|------|------|
| **无预取** | 每张图在 mount 时才请求 blob，没有批量预取 |
| **原图先行** | 优先展示 `image.url`（原图），大图解码慢 |
| **无持久化预热** | 首次打开无缩略图，全部走生成链路 |
| **无显示门控** | 列表立刻显示，图片逐个加载，视觉上很「逐帧出现」 |

---

## 三、差异一览

| 项目 | nn | 手记视图 |
|------|-----|----------|
| **列表显示** | `isStorageReady` 后才显示 | 有 entries 就显示 |
| **缩略图来源** | 上一会话持久化 + Content Provider 预生成 | 按需生成，首次无缓存 |
| **内存缓存** | blob LRU，命中率高 | blob LRU，但初次几乎全未命中 |
| **初始 src** | 先用 `getResourcePath` 或已有 blob URL | 先用 `image.url`（原图） |
| **预取** | 通过 Content Provider 队列批量处理 | 无预取，逐项请求 |

---

## 四、优化方向

1. **批量预取**：entries 加载后，立刻 batch `getThumbnailBlob`，优先填满内存缓存
2. **延迟展示原图**：在确认没有缩略图前，优先用占位或缩略图，避免一开始就加载大图
3. **可选显示门控**：类似 nn，在「首屏数据+缩略图预取」完成前显示骨架屏（需权衡首屏时间）
4. **启动时预生成**：插件 onload 后，对默认文件夹内笔记的图片发起缩略图生成队列
