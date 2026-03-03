# 手记视图 (React)

> 将 Markdown 文件按日历组织，生成类似手记应用的视图

[Obsidian](https://obsidian.md) 插件，使用 React + TypeScript 构建，提供月历视图、列表视图、那年今日、手记式图片布局等能力。

### Read in your language

| [English](#readme-en) | [简体中文](#readme-zh_cn) | [日本語](#readme-ja) | [繁體中文](#readme-zh_tw) |
|----------------------|--------------------------|---------------------|---------------------------|

<a id="readme-en"></a>
<a id="readme-zh_cn"></a>
<a id="readme-ja"></a>
<a id="readme-zh_tw"></a>

---

## ✨ 功能特性

### 首页视图

- **月历视图**：按月份展示手记，点击日期查看当天条目
- **列表视图**：时间线式列表，按日期分组（今天、昨天、往年）
- **那年今日**：展示往年同月同日的所有手记，横向卡片布局
- **手记卡片**：标题、日期、正文摘要、图片（支持 1~5+ 张多种布局）
- **统计栏**（可选）：连续纪录天数、总字数、写手记天数

### 编辑页

- **手记式图片布局**：默认文件夹内的笔记，在 Live Preview 模式下，图片按首页卡片样式排列（1/2/3/4/5+ 张多种布局）
- **超 5 张自动拆分**：同一段连续图片超过 5 张时，自动拆成多个画廊，保证每张图都可见
- **实时更新**：添加/删除图片时自动重新渲染
- **图片删除**：每张图支持右上角删除按钮

### 其他

- **多语言**：简体中文、English
- **虚拟化列表**：基于 @tanstack/react-virtual，长列表性能优化
- **文件系统监听**：新建、修改、删除、重命名时自动刷新
- **可配置日期字段**：支持 frontmatter 中 `date`、`Date`、`created`、`created_time` 等，或自定义字段

---

## 📸 截图展示

| 月历视图 | 列表视图 | 编辑页画廊 |
|----------|----------|------------|
| ![月历视图](showcaseimages/e24c0350cb6e08962aded61c8e4722f7.png) | ![列表视图](showcaseimages/7bd2abb4b582a8e8e5293561d35a39c8.png) | ![编辑页画廊](showcaseimages/f8ab7b261496c728d4ff90369ca53b75.png) |

- **月历视图**：按月展示，日期格内显示缩略图，下方展示那年今日与当日条目
- **列表视图**：时间线式列表，按今天/昨天/往年分组，手记卡片支持多图布局
- **编辑页画廊**：Live Preview 下手记式图片布局，多图自动排版

---

## 📦 安装

### 从社区插件安装（若已发布）

1. 打开 Obsidian → 设置 → 社区插件 → 浏览
2. 搜索「手记视图」并安装

### 手动安装

1. 下载 `main.js`、`manifest.json`、`styles.css`
2. 放入 `{vault}/.obsidian/plugins/obsidian-journal-react/`
3. 在 Obsidian 中启用插件

### 自行构建

```bash
cd .obsidian/plugins/obsidian-journal-react
npm install
npm run build
```

构建产物会输出到插件目录。

---

## 🚀 使用

### 打开视图

- **命令**：`Ctrl/Cmd + P` → 输入「打开手记视图」→ 回车
- 或通过命令面板执行「打开手记视图」

### 新建笔记

- 在视图右上角点击 **+** 按钮
- 使用配置的默认模板创建当日笔记

### 切换视图模式

- 点击月历/列表图标，在月历视图与列表视图间切换

---

## ⚙️ 设置

| 设置项 | 说明 |
|--------|------|
| **默认文件夹** | 手记视图默认打开该文件夹，编辑页图片布局仅在此文件夹内的笔记生效 |
| **日期字段** | 指定 frontmatter 中的日期字段，如 `date`、`created`；若无则使用文件创建时间 |
| **默认模板** | 新建笔记时使用的模板，支持 `{{date}}`、`{{year}}`、`{{month}}`、`{{day}}`、`{{title}}` |
| **编辑页手记式图片布局** | 在 Live Preview 中，默认文件夹内笔记是否启用图片布局 |
| **图片间距** | 图片容器之间的间距（0–30px） |
| **图片显示限制** | 每个卡片最多显示的图片数量（默认 3，首页实际以 5 张布局展示） |
| **打开笔记方式** | 新标签页 / 当前标签页 |
| **显示统计栏** | 是否在顶部展示连续天数、字数等统计 |

---

## 📐 日期提取规则

1. **优先级 1**：从 frontmatter 读取日期（支持自定义字段或默认 `date`、`Date`、`created`、`created_time`）
2. **优先级 2**：使用文件创建时间 `ctime`

---

## 🖼️ 图片布局

### 首页卡片

支持 1~5+ 张图片的多种布局：

- 1 张：单列 2:1
- 2 张：左右各 2:1
- 3 张：左大 + 右 2 小
- 4 张：左大 + 右 3 小（左上、左下左、左下右）
- 5+ 张：左大 + 右 4 小，超出 5 张拆成多个画廊

### 编辑页

- 与首页布局一致
- 超过 5 张连续图片自动拆成多个画廊
- 每张图支持右上角删除

---

## 📁 项目结构

```
obsidian-journal-react/
├── src/
│   ├── main.ts                 # 插件入口
│   ├── settings.ts             # 设置类型与默认值
│   ├── settings/
│   │   └── JournalSettingTab.ts
│   ├── view/
│   │   └── JournalView.tsx     # Obsidian 视图容器
│   ├── components/             # React 组件
│   │   ├── JournalViewContainer.tsx
│   │   ├── JournalHeader.tsx
│   │   ├── JournalStats.tsx
│   │   ├── JournalList.tsx
│   │   ├── JournalCard.tsx
│   │   ├── JournalImageContainer.tsx
│   │   ├── JournalCalendar.tsx
│   │   ├── CalendarHeader.tsx
│   │   ├── CalendarDayCell.tsx
│   │   ├── OnThisDaySection.tsx
│   │   ├── OnThisDayTile.tsx
│   │   ├── JournalEmptyState.tsx
│   │   └── JournalCardMenu.tsx
│   ├── context/                # React Context
│   │   ├── JournalViewContext.tsx
│   │   ├── JournalDataContext.tsx
│   │   └── JournalViewModeContext.tsx
│   ├── hooks/
│   │   ├── useJournalEntries.ts
│   │   ├── useJournalPagination.ts
│   │   ├── useJournalScroll.ts
│   │   ├── useFileSystemWatchers.ts
│   │   ├── useCalendarMonth.ts
│   │   └── useScrollbarWidth.ts
│   ├── editor/
│   │   └── EditorImageLayout.ts  # Live Preview 图片布局
│   ├── utils/
│   │   ├── utils.ts
│   │   ├── onThisDay.ts
│   │   ├── calendarUtils.ts
│   │   └── StatisticsCalculator.ts
│   ├── i18n/
│   │   ├── index.ts
│   │   └── locales/
│   │       ├── zh_cn.ts
│   │       └── en.ts
│   └── constants.ts
├── styles.css
├── manifest.json
├── package.json
└── esbuild.config.mjs
```

---

## 🛠️ 开发

### 命令

```bash
# 安装依赖
npm install

# 开发模式（监听文件变化并构建）
npm run dev

# 生产构建
npm run build
```

### 技术栈

- **React 18**：UI 框架
- **@tanstack/react-virtual**：虚拟化列表
- **TypeScript**：类型安全
- **esbuild**：构建

### 构建产物

- `main.js`：插件主入口
- `manifest.json`：插件元信息
- `styles.css`：样式

---

## 📄 许可证

MIT
