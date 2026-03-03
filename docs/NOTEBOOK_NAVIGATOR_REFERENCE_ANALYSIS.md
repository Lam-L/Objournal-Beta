# notebook-navigator 参考分析

> 对比 notebook-navigator-source-code 实现，提炼可借鉴技术与已落地/待落地优化点。

---

## 一、虚拟化与滚动

### 1.1 已借鉴 / 已实现

| 技术 | notebook-navigator | 手记视图 | 状态 |
|------|--------------------|----------|------|
| **@tanstack/react-virtual** | useListPaneScroll / useNavigationPaneScroll | useJournalScroll | ✅ 已用 |
| **overscan** | 10 (`types.ts`) | 20 | ✅ 已增大（我们更激进） |
| **ResizeObserver 可见性检测** | 检测 `width>0 && height>0`，控制 `containerVisible` | 检测尺寸变化后 `virtualizer.measure()` | ✅ 已实现 |
| **视图激活事件** | `notebook-navigator-visible`（onResize 时 dispatch） | `journal-view-react:active`（active-leaf-change 时 dispatch） | ✅ 已实现 |
| **estimateSize 动态高度** | 基于内容（标题行、预览、图、标签）计算 | 基于 entry 内容、图片、preview 估算 | ✅ 已实现 |

### 1.2 可进一步借鉴

| 技术 | notebook-navigator 实现 | 建议 |
|------|---------------------------|------|
| **isScrollContainerReady 门控** | `isVisible && containerVisible` 为真时才执行 scrollToIndex，避免容器隐藏时虚拟器报错 | 可引入：在 JournalList 中只有当 `.journal-view-container` 可见时才执行 measure/scroll |
| **indexVersion 版本门控** | 列表 rebuild 时 `indexVersion++`，scroll 操作需 `minIndexVersion` 满足才执行 | 若我们有 scrollToIndex/reveal 需求时可引入，避免「滚动在列表未就绪时执行」 |
| **scrollMargin / scrollPadding** | `scrollMargin`、`scrollPaddingStart`、`scrollPaddingEnd` 与 overlay（如底部 toolbar）对齐 | 若有固定 header/footer 遮挡，可配置 padding 使虚拟器计算与 UI 一致 |
| **列表结构变化时 measure** | `filePathToIndex` 变化时 `rowVirtualizer.measure()` | 已部分实现（entries.length 变化时 measure），可考虑更细粒度：仅当 listItems 结构变化时 |

---

## 二、数据与更新策略

### 2.1 已借鉴 / 已实现

| 技术 | notebook-navigator | 手记视图 | 状态 |
|------|--------------------|----------|------|
| **updateKey 驱动重算** | `setUpdateKey(k=>k+1)` 触发 useMemo | 通过 entries/loadEntries 状态驱动 | ✅ 等价实现 |
| **防抖刷新** | debounce 200–500ms | useFileSystemWatchers 500ms debounce | ✅ 已实现 |
| **增量更新** | updateSingleEntry / updateEntryAfterRename | 同 | ✅ 已实现 |
| **filePathToIndex** | Map 做 O(1) 查找 | 未单独建 map，用 listItems 索引 | ⚪ 可选 |

### 2.2 可进一步借鉴

| 技术 | notebook-navigator 实现 | 建议 |
|------|---------------------------|------|
| **操作状态管理** | `operationActiveRef` + `pendingRefreshRef`：批量操作期间不刷新，结束后统一 flush | 若有批量删除/移动等操作，可引入，减少中间态闪烁 |
| **shouldRefreshOnFileModify** | 根据排序选项判断 modify 是否影响顺序，不影响的跳过 | 若排序依赖 mtime 等，可加类似逻辑，减少无效 refresh |
| **组件级订阅** | FileItem 订阅 `db.onFileContentChange(file.path)`，只更新单文件 preview/tags | 我们已是全量 entries 刷新；若单条目更新频繁，可考虑细粒度订阅 |

---

## 三、高度估算与测量

### 3.1 notebook-navigator 的做法

- **listPaneMeasurements**：把 CSS 变量（行高、padding、featureImage 高度）抽成 `ListPaneMeasurements` 对象，与虚拟器 `estimateSize` 一致
- **多平台**：DESKTOP_MEASUREMENTS / MOBILE_MEASUREMENTS 分别提供不同行高
- **内容感知**：根据 `hasPreview`、`showFeatureImageArea`、`propertyRowCount`、`hasTagRow` 等逐项累加高度

### 3.2 可借鉴

| 项目 | 建议 |
|------|------|
| **统一测量常量** | 将 journal 卡片高度相关值（标题行高、预览行高、图片高度、padding）集中到类似 `journalListMeasurements.ts`，与 estimateSize 和 CSS 共用 |
| **内容变化 remeasure** | 订阅「影响高度的内容变化」（如 preview、图片、标签）后调用 `virtualizer.measure()`；notebook-navigator 通过 `db.onContentChange` 判断 `needsRemeasure` | 我们已有 entries 变化时 measure；若单条目内容变化多，可加类似订阅 |

---

## 四、滚动位置与 reveal

### 4.1 notebook-navigator 的机制

- **PendingScroll 队列**：`type: 'file'|'top'`，`minIndexVersion`，`reason`（folder-navigation / visibility-change / reveal / list-structure-change）
- **优先级**：`rankListPending` 决定高优先级 scroll 覆盖低优先级
- **执行条件**：`isScrollContainerReady && indexVersion >= minIndexVersion`

### 4.2 可借鉴场景

若手记视图需要：

- 切换文件夹后滚动到某条
- 执行「定位到当前日期」类命令
- 从其他视图切回时保持/恢复滚动位置

可引入简化版 PendingScroll：只保留 `scrollToIndex` + `minIndexVersion`，在列表就绪后执行。

---

## 五、可见性 / 视图生命周期

### 5.1 notebook-navigator

- **onResize**：Obsidian 调用 `view.onResize()`，mobile 上当 `rect.width>0 && height>0` 时 dispatch `notebook-navigator-visible`
- **ListPane** 监听该事件，设置 `pendingScroll`（visibility-change reason），在容器就绪后 scroll 到选中文件

### 5.2 手记视图

- 已用 `active-leaf-change` 在「当前 leaf 为本视图」时 dispatch `journal-view-react:active`
- JournalList 监听后调用 `virtualizer.measure()`
- **差异**：notebook-navigator 通过 `onResize` 感知「从隐藏变为可见」；我们通过 `active-leaf-change` 感知「切换回本标签」。两者互补，可考虑同时支持 `onResize`（若 Obsidian ItemView 支持）。

---

## 六、图片与占位

### 6.1 notebook-navigator

- IndexedDB 存 256×144 WebP 缩略图
- square / natural 两种显示模式
- 加载失败时 `setIsFeatureImageHidden(true)`，隐藏占位
- 防拖拽：`draggable={false}`、`onDragStart` 阻止

### 6.2 可借鉴（见 IMAGE_RENDER_OPTIMIZATION.md）

- 占位符样式（灰色/透明背景）
- 加载失败时隐藏或显示失败占位
- 防拖拽（已部分实现）
- 可选 natural 比例模式

---

## 七、实施优先级建议

| 优先级 | 项目 | 说明 |
|--------|------|------|
| P0 | isScrollContainerReady 门控 | 避免容器隐藏时虚拟器报错/白屏 |
| P1 | 统一 listPaneMeasurements | 高度估算与 CSS 保持一致，减少布局跳动 |
| P1 | 操作状态管理（若有批量操作） | 减少批量操作期间的中间态刷新 |
| P2 | PendingScroll + indexVersion | 仅在有 scrollToIndex/reveal 需求时 |
| P2 | 图片占位/失败处理 | 见 IMAGE_RENDER_OPTIMIZATION.md |

---

## 八、总结

- 我们已在虚拟化、overscan、ResizeObserver、视图激活事件、动态高度估算、防抖、增量更新等方面与 notebook-navigator 对齐或更进一层。
- 可重点借鉴：**可见性门控**、**统一测量常量**、**滚动队列与版本门控**（若需 scrollToIndex/reveal）。
- 图片与占位优化可单独按 IMAGE_RENDER_OPTIMIZATION.md 推进。
