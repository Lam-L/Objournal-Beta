# 日历视图功能 - 实现方案

## 一、需求概要

1. **月维度日历视图**：以月为单位展示日历
2. **图片作为日封面**：若某日手记含图片，用第一张作为该日封面
3. **参考设计**：类似 Day One 风格，支持有图/无图/选中日期的差异化展示
4. **性能优先**：流畅、低内存、无卡顿

---

## 二、notebook-navigator 参考分析

### 架构概览

| 模块 | 作用 | 我们的取舍 |
|------|------|-----------|
| **IndexedDB + Blob 存储** | 预存缩略图，按需加载 | ❌ 不采用。我们已有 entries 和 image URL，无需额外存储 |
| **useCalendarFeatureImages** | 并发加载 blob → object URL | ❌ 不需。直接使用 `entry.images[0].url` |
| **dayNoteFileLookupCache** | 按日期查文件缓存 | ✅ 借鉴。用 `useMemo` 建 `Map<isoDate, JournalEntry>` |
| **vault 变更防抖 (120ms)** | 避免频繁刷新 | ✅ 借鉴。可复用现有 `scheduleProcessWithRetries` |
| **CalendarGrid React.memo** | 减少重渲染 | ✅ 必须。日单元格用 memo |
| **CalendarDayButton** | 日单元格组件 | ✅ 借鉴结构，简化实现 |

### notebook-navigator 的复杂点（我们可省略）

- 依赖 moment.js、IndexedDB、FileCache
- 周/月/年笔记、任务指示等
- 复杂 tooltip 与 hover 预览

我们仅需：月视图 + 日封面图 + 点击跳转，逻辑更轻量。

---

## 三、数据流设计（零额外 I/O）

```
useJournalEntries (已有)
    ↓ entries: JournalEntry[]
    ↓ 每个 entry 含: date, images[].url, file
    ↓
useCalendarData(entries)  ← 纯计算，无 I/O
    ↓
{
  entriesByIso: Map<string, JournalEntry>,  // YYYY-MM-DD → entry
  firstImageUrlByIso: Map<string, string>,   // 有图日的封面 URL
}
```

- `entriesByIso`：由 `entries` 经 `useMemo` 计算，按 `extractDate` 的日期做 key
- `firstImageUrlByIso`：从 `entriesByIso` 推导，`entry.images[0]?.url`
- 不新增任何 `vault.read` 或 `metadataCache` 调用

---

## 四、性能策略

### 1. 数据层

- 使用 `entries` 作为单一数据源，不做二次加载
- `Map` 查找 O(1)，月份内约 28–42 次查找可忽略
- `useMemo` 依赖 `entries`，仅在 entries 变化时重算

### 2. 图片加载

- 直接使用 `app.vault.getResourcePath` 的 URL（已在 `JournalEntry.images[0].url`）
- 使用 `loading="lazy"` 做原生懒加载
- 单元格固定尺寸（约 40×40px），`object-fit: cover` 限制解码区域
- 不做 Blob、不做 object URL，避免 notebook-navigator 式的 blob 管理

### 3. 渲染层

- `CalendarDayCell` 用 `React.memo`，仅当该日数据变化时重渲染
- 月内约 42 个单元格，无需虚拟化
- 使用 `content-visibility: auto` 降低离屏格子的渲染成本（可选）

### 4. 月份切换

- 仅切换 `cursorMonth` state，无需重新拉数据
- 月历网格纯计算：根据 cursorMonth 生成 6×7 日期数组

---

## 五、组件结构

```
JournalViewContainer
  └── JournalViewContent
        └── [新增] CalendarViewToggle? 或入口
        └── JournalViewWithWatchers
              ├── JournalHeader
              │     └── [新增] 日历/列表 切换入口
              ├── ...
              └── [新增] JournalCalendarSection  ← 与 JournalList 互斥或并存
                    ├── CalendarHeader (月切换、今天)
                    └── CalendarGrid
                          └── CalendarDayCell × 42 (memo)
                                ├── 有图: <img src={url} loading="lazy" />
                                ├── 有文无图: 背景色
                                └── 空: 默认样式
```

---

## 六、实现步骤建议

### Phase 1：基础月历（无图）

1. 新增 `useCalendarMonth(entries)`：生成当月 6×7 网格
2. 新增 `CalendarGrid`、`CalendarDayCell`
3. 新增 `CalendarHeader`（上月/下月、今天、年月展示）
4. 日期 → 条目的映射：`entriesByIso.get(iso)`，点击打开对应文件

### Phase 2：日封面图

1. 在 `useCalendarMonth` 中产出 `firstImageUrlByIso`
2. `CalendarDayCell` 接收 `imageUrl`，有则渲染 `<img loading="lazy" />`
3. 单元格尺寸固定，`object-fit: cover`，避免布局抖动

### Phase 3：接入与交互

1. 在 JournalHeader 增加「月历 / 列表」切换（或 tab）
2. 根据 `targetFolderPath` 过滤日历数据，逻辑与现有列表一致
3. 可选：从日历点击日期 → 打开当日笔记或滚动到对应卡片

### Phase 4：性能验证

1. 大库测试：数百条手记时的首屏与切换月速度
2. 如有卡顿，再考虑：`content-visibility`、进一步 memo、或按需加载图片

---

## 七、与现有代码的集成点

| 现有模块 | 集成方式 |
|----------|----------|
| `useJournalEntries` | 作为 Calendar 的 `entries` 来源 |
| `JournalDataContext` | Calendar 内部用 `useJournalData()` 取 entries |
| `targetFolderPath` | 与列表相同，只展示默认文件夹内的数据 |
| `extractDate` | 继续用于从 entry 得到日期并生成 iso key |
| `app.workspace.openLinkText` | 点击日期时打开对应笔记 |

---

## 八、文件清单（预估）

```
src/
  components/
    JournalCalendar.tsx       # 主入口
    CalendarHeader.tsx        # 月切换、今天
    CalendarGrid.tsx          # 6×7 网格
    CalendarDayCell.tsx       # 日单元格（memo）
  hooks/
    useCalendarMonth.ts      # 月网格 + entriesByIso + firstImageUrlByIso
  utils/
    calendarUtils.ts         # 日期、iso 等工具
```

---

## 九、风险与应对

| 风险 | 应对 |
|------|------|
| 图片多时内存/加载慢 | 使用 `loading="lazy"`，小尺寸显示，后续可加缩略图 |
| 月份切换卡顿 | 仅更新 state，不做新请求；memo 降低重渲染 |
| 与 notebook-navigator 的差异 | 我们不做 IndexedDB，直接用内存数据和 Obsidian 的 resource URL |

---

## 十、总结

- **数据**：完全复用 `entries`，零额外 I/O
- **图片**：用现有 `entry.images[0].url`，`loading="lazy"` + 小尺寸展示
- **结构**：参考 notebook-navigator 的 CalendarGrid/CalendarDayButton，但去掉 IndexedDB、moment、复杂 tooltip
- **性能**：memo、固定尺寸、懒加载，42 格无需虚拟化

若认可此方案，可以从 Phase 1 的 `useCalendarMonth` + `CalendarGrid` 开始实现。
