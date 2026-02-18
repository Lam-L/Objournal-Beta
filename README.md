# Obsidian Journal View - React 版本

这是手记视图插件的 React 重构版本，使用 React + @tanstack/react-virtual 实现虚拟化列表。

## 📋 重构计划

详细的重构计划请查看 [REFACTOR_PLAN.md](./REFACTOR_PLAN.md)

## 🚀 快速开始

### 1. 安装依赖

```bash
cd .obsidian/plugins/obsidian-journal-react
npm install
```

### 2. 开发模式

```bash
npm run dev
```

### 3. 构建生产版本

```bash
npm run build
```

## 📁 项目结构

```
obsidian-journal-react/
├── src/
│   ├── components/      # React 组件
│   ├── hooks/          # React Hooks
│   ├── context/        # React Context
│   ├── view/           # Obsidian View
│   ├── utils/          # 工具函数
│   └── main.ts         # 插件入口
├── styles.css          # 样式文件
└── REFACTOR_PLAN.md    # 详细重构计划
```

## 📝 重构步骤概览

1. **项目初始化** (0.5 天)
   - 创建项目结构
   - 配置 TypeScript 和 esbuild
   - 安装依赖

2. **基础架构搭建** (1 天)
   - 创建 Context Providers
   - 重构 JournalView 为 React 容器

3. **核心组件开发** (2-3 天)
   - JournalHeader
   - JournalStats
   - JournalEmptyState
   - JournalList
   - JournalCard

4. **Hooks 和状态管理** (2-3 天)
   - useJournalEntries
   - useJournalPagination
   - useJournalScroll (虚拟化)
   - useFileSystemWatchers

5. **图片布局组件** (1-2 天)
   - JournalImageContainer

6. **虚拟化实现** (1-2 天)
   - 集成 @tanstack/react-virtual

7. **实时更新** (1 天)
   - 文件系统事件监听

8. **测试和优化** (3-5 天)
   - 功能测试
   - 性能优化

**总计**: 12-18 天

## 🔧 技术栈

- **React 18**: UI 框架
- **@tanstack/react-virtual**: 虚拟化列表
- **TypeScript**: 类型安全
- **esbuild**: 构建工具

## 📚 参考

- 原项目: `obsidian-journal-view`
- 参考实现: `notebook-navigator-source-code`

## ⚠️ 注意事项

1. 每个步骤完成后都要测试
2. 保持与原项目功能一致
3. 样式可以直接复用原项目的 styles.css
4. 确保所有 TypeScript 类型正确

## 🎯 下一步

查看 [REFACTOR_PLAN.md](./REFACTOR_PLAN.md) 开始第一步：项目初始化
