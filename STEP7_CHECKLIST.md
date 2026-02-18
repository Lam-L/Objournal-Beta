# Step 7: 实时更新 - 检查清单

## ✅ Step 7: 实时更新 - 已完成

### Step 7.1: useFileSystemWatchers Hook ✅
- [x] 创建 `src/hooks/useFileSystemWatchers.ts`
- [x] 实现文件系统事件监听（create, delete, rename, modify）
- [x] 实现元数据缓存变化监听（metadataCache.on('changed')）
- [x] 实现文件过滤逻辑（只处理 markdown 文件，在目标文件夹内）
- [x] 实现防抖刷新机制（200ms 延迟）
- [x] 实现事件监听器清理（组件卸载时）

### Step 7.2: JournalViewContainer 集成 ✅
- [x] 更新 `src/components/JournalViewContainer.tsx`
- [x] 创建 `JournalViewWithWatchers` 内部组件
- [x] 在 `JournalDataProvider` 内部调用 `useFileSystemWatchers`
- [x] 确保 Hook 调用顺序正确（在 Provider 内部）

## 📊 技术实现细节

### 事件监听器
```typescript
// Vault 事件监听器
app.vault.on('create', handleFileCreate);
app.vault.on('delete', handleFileDelete);
app.vault.on('rename', handleFileRename);
app.vault.on('modify', handleFileModify);

// Metadata Cache 事件监听器
app.metadataCache.on('changed', handleMetadataChange);
```

### 文件过滤逻辑
```typescript
const shouldRefreshForFile = (file: TAbstractFile): boolean => {
  // 1. 必须是 TFile 实例
  if (!(file instanceof TFile)) return false;
  
  // 2. 必须是 markdown 文件
  if (file.extension !== 'md') return false;
  
  // 3. 必须在目标文件夹内（如果指定了）
  if (targetFolderPath && !file.path.startsWith(targetFolderPath)) return false;
  
  return true;
};
```

### 防抖刷新机制
```typescript
const debouncedRefresh = useCallback(() => {
  if (refreshTimerRef.current) {
    clearTimeout(refreshTimerRef.current);
  }
  
  refreshTimerRef.current = window.setTimeout(() => {
    refresh();
    refreshTimerRef.current = null;
  }, 200);
}, [refresh]);
```

### 事件清理
```typescript
useEffect(() => {
  // 注册事件监听器
  const vaultEventRefs = [...];
  const metadataEventRef = ...;
  
  return () => {
    // 清理防抖定时器
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
    }
    
    // 清理所有事件监听器
    eventRefsRef.current.forEach((eventRef) => {
      app.vault.offref(eventRef);
    });
    app.metadataCache.offref(metadataEventRef);
  };
}, [app, targetFolderPath, shouldRefreshForFile, debouncedRefresh]);
```

## 🎯 功能特性

### 1. 实时更新触发场景
- ✅ **文件创建**：创建新的 markdown 文件时自动刷新
- ✅ **文件删除**：删除 markdown 文件时自动刷新
- ✅ **文件重命名**：重命名文件时自动刷新（检查旧路径和新路径）
- ✅ **文件修改**：修改文件内容时自动刷新
- ✅ **元数据变化**：frontmatter、标签等元数据变化时自动刷新

### 2. 性能优化
- ✅ **防抖机制**：200ms 延迟，避免频繁刷新
- ✅ **文件过滤**：只处理相关的 markdown 文件
- ✅ **路径过滤**：只处理目标文件夹内的文件（如果指定了）

### 3. 资源管理
- ✅ **自动清理**：组件卸载时自动清理所有事件监听器
- ✅ **定时器清理**：清理防抖定时器，避免内存泄漏

## 📊 验证结果

### 构建测试
```bash
npm run build
```
✅ **成功** - 无错误，生成了 `main.js`

### 文件结构
```
obsidian-journal-react/
├── src/
│   ├── hooks/
│   │   └── useFileSystemWatchers.ts  ✅
│   ├── components/
│   │   └── JournalViewContainer.tsx  ✅ (已更新)
│   └── ...
└── main.js                           ✅
```

## 🧪 测试建议

在 Obsidian 中测试：
1. 启用插件
2. 使用命令 "打开手记视图"
3. 测试实时更新：
   - **创建文件**：在目标文件夹创建新的 markdown 文件，应该自动出现在列表中
   - **删除文件**：删除一个文件，应该自动从列表中消失
   - **修改文件**：修改文件内容，应该自动更新预览和统计信息
   - **重命名文件**：重命名文件，应该自动更新列表
   - **修改元数据**：修改 frontmatter，应该自动更新

4. 测试性能：
   - 快速创建多个文件，应该合并为一次刷新（防抖）
   - 修改不相关的文件，不应该触发刷新（文件过滤）

## ⚠️ 注意事项

### 1. Hook 调用顺序
- `useFileSystemWatchers` 必须在 `JournalDataProvider` 内部调用
- 因为它需要使用 `useJournalData` Hook 来获取 `refresh` 函数

### 2. 防抖延迟
- 当前设置为 200ms，可以根据需要调整
- 太短可能导致频繁刷新，太长可能导致更新延迟

### 3. 文件过滤
- 只处理 markdown 文件（`.md` 扩展名）
- 如果指定了 `targetFolderPath`，只处理该文件夹内的文件
- 如果不指定 `targetFolderPath`，处理所有 markdown 文件

### 4. 事件清理
- 组件卸载时会自动清理所有事件监听器
- 确保不会造成内存泄漏

## ✨ 完成状态

**Step 7: 实时更新** - ✅ **已完成**

## 🎯 下一步

现在可以开始 **Step 8: 测试和优化** - 全面测试所有功能，优化性能和用户体验

## 📝 参考

- 参考了 `notebook-navigator` 的实时更新机制
- 参考了原 `obsidian-journal-view` 的实现
- 使用了 Obsidian API 的标准事件监听模式
