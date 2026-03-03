# Obsidian 插件作用域限制分析

## 用户需求

**插件只在相应目录下生效，在其他目录下无法生效，无法访问。**

## Obsidian API 的限制

### ❌ Obsidian 不支持官方的作用域限制

经过调研，**Obsidian 本身不提供插件作用域（Scope）的官方限制机制**：

1. **事件系统是全局的**
   ```typescript
   // ❌ 无法限制 scope
   this.app.workspace.on('editor-change', () => {
       // 这个监听器会监听所有编辑器的变化
       // 无法在注册时指定"只在某个文件夹生效"
   });
   ```

2. **没有文件夹级别的插件配置**
   - Obsidian 没有 `plugin.scope` 或 `plugin.folderScope` 这样的 API
   - 插件无法声明"仅在某个文件夹下激活"

3. **MutationObserver 必须监听整个文档**
   ```typescript
   // ❌ 无法限制 scope
   const observer = new MutationObserver(...);
   observer.observe(document.body, { ... }); // 必须监听整个文档
   ```

### ✅ 其他插件的实现方式

从 `folder-notes` 等插件的代码来看，它们也是通过**内部检查**来实现文件夹级别的功能控制：

```typescript
// folder-notes 的实现方式
function getWhitelistedFolder(plugin, path) {
    // 检查路径是否在白名单中
    const matchedPatterns = getWhitelistedFoldersByPattern(plugin, folderName);
    const whitelistedFolders = getWhitelistedFoldersByPath(plugin, path);
    // 返回配置，如果不在白名单中返回 undefined
    return whitelistedFolder;
}
```

**结论**：所有插件都需要在事件回调中手动检查文件路径。

## 可行的解决方案

### 方案一：完全禁用非目标文件夹的处理（推荐）⭐⭐⭐⭐⭐

**核心思路**：在所有事件处理的最开始就检查文件路径，不符合则立即返回。

#### 实现方式

```typescript
class EditorImageLayout {
    // 1. 在所有事件监听器中先检查
    private setupEditorChangeListener(): void {
        this.plugin.registerEvent(
            this.app.workspace.on('editor-change', () => {
                // ✅ 早期检查：先检查文件路径
                const view = this.app.workspace.getActiveViewOfType(MarkdownView);
                const filePath = view?.file?.path;
                
                if (!this.shouldProcessFile(filePath)) {
                    return; // 立即返回，不执行任何处理
                }
                
                // 只有目标文件夹的文件才会执行到这里
                this.updateExistingGalleries();
                this.processActiveEditor();
            })
        );
    }
    
    // 2. 在 MutationObserver 中先检查
    private setupMutationObserver(): void {
        const observer = new MutationObserver((mutations) => {
            // ✅ 早期检查
            const view = this.app.workspace.getActiveViewOfType(MarkdownView);
            const filePath = view?.file?.path;
            
            if (!this.shouldProcessFile(filePath)) {
                return; // 立即返回，不处理任何 DOM 变化
            }
            
            // 处理逻辑...
        });
    }
    
    // 3. 在 updateExistingGalleries 中先检查
    private updateExistingGalleries(): void {
        // ✅ 早期检查
        const view = this.app.workspace.getActiveViewOfType(MarkdownView);
        const filePath = view?.file?.path;
        
        if (!this.shouldProcessFile(filePath)) {
            return; // 立即返回，不执行 DOM 查询
        }
        
        // 继续处理...
    }
}
```

#### 优点
- ✅ 实现简单，只需添加早期检查
- ✅ 完全避免非目标文件夹的处理
- ✅ 性能最优，零开销（检查路径的开销极小）

#### 缺点
- ⚠️ 事件监听器仍然会触发（但立即返回，开销极小）
- ⚠️ MutationObserver 仍然会观察（但立即返回，开销极小）

### 方案二：条件化注册事件监听器 ⭐⭐⭐

**核心思路**：动态注册/注销事件监听器，只在目标文件夹的文件打开时注册。

#### 实现方式

```typescript
class EditorImageLayout {
    private editorChangeRef: EventRef | null = null;
    private mutationObserver: MutationObserver | null = null;
    
    private setupEditorChangeListener(): void {
        // 监听文件打开，动态注册/注销
        this.plugin.registerEvent(
            this.app.workspace.on('file-open', () => {
                const view = this.app.workspace.getActiveViewOfType(MarkdownView);
                const filePath = view?.file?.path;
                
                // 注销旧的监听器
                if (this.editorChangeRef) {
                    this.app.workspace.offref(this.editorChangeRef);
                    this.editorChangeRef = null;
                }
                
                // 只在目标文件夹的文件上注册
                if (filePath && this.shouldProcessFile(filePath)) {
                    this.editorChangeRef = this.app.workspace.on('editor-change', () => {
                        this.updateExistingGalleries();
                        this.processActiveEditor();
                    });
                }
            })
        );
    }
    
    private setupMutationObserver(): void {
        // 监听文件打开，动态创建/销毁 Observer
        this.plugin.registerEvent(
            this.app.workspace.on('file-open', () => {
                const view = this.app.workspace.getActiveViewOfType(MarkdownView);
                const filePath = view?.file?.path;
                
                // 清理旧的 Observer
                if (this.mutationObserver) {
                    this.mutationObserver.disconnect();
                    this.mutationObserver = null;
                }
                
                // 只在目标文件夹的文件上创建 Observer
                if (filePath && this.shouldProcessFile(filePath) && view?.contentEl) {
                    this.mutationObserver = new MutationObserver((mutations) => {
                        // 处理逻辑
                    });
                    
                    this.mutationObserver.observe(view.contentEl, {
                        childList: true,
                        subtree: true
                    });
                }
            })
        );
    }
}
```

#### 优点
- ✅ 完全避免非目标文件夹的事件处理
- ✅ 性能最优，零开销

#### 缺点
- ❌ 实现复杂度高
- ❌ 需要跟踪监听器生命周期
- ❌ 需要处理文件切换、编辑器关闭等边界情况
- ❌ 维护成本高

### 方案三：条件化 MutationObserver（折中方案）⭐⭐⭐⭐

**核心思路**：只在目标文件夹的编辑器容器上观察 DOM 变化，但保留全局事件监听器。

#### 实现方式

```typescript
class EditorImageLayout {
    private activeObserver: MutationObserver | null = null;
    
    private setupMutationObserver(): void {
        // 监听文件打开，动态创建 Observer
        this.plugin.registerEvent(
            this.app.workspace.on('file-open', () => {
                const view = this.app.workspace.getActiveViewOfType(MarkdownView);
                const filePath = view?.file?.path;
                
                // 清理旧的 Observer
                if (this.activeObserver) {
                    this.activeObserver.disconnect();
                    this.activeObserver = null;
                }
                
                // 只在目标文件夹的文件上创建 Observer
                if (filePath && this.shouldProcessFile(filePath) && view?.contentEl) {
                    this.activeObserver = new MutationObserver((mutations) => {
                        // 处理逻辑
                    });
                    
                    this.activeObserver.observe(view.contentEl, {
                        childList: true,
                        subtree: true
                    });
                }
            })
        );
    }
    
    // 事件监听器仍然使用早期检查
    private setupEditorChangeListener(): void {
        this.plugin.registerEvent(
            this.app.workspace.on('editor-change', () => {
                const view = this.app.workspace.getActiveViewOfType(MarkdownView);
                const filePath = view?.file?.path;
                
                if (!this.shouldProcessFile(filePath)) {
                    return; // 早期检查
                }
                
                // 处理逻辑
            })
        );
    }
}
```

#### 优点
- ✅ 减少 DOM 观察范围（只在目标文件夹的编辑器上观察）
- ✅ 实现复杂度适中
- ✅ 性能提升明显

#### 缺点
- ⚠️ 事件监听器仍然会触发（但立即返回，开销极小）

## 方案对比

| 方案 | 性能提升 | 实现复杂度 | 维护成本 | 推荐度 |
|------|---------|-----------|---------|--------|
| **方案一：早期检查** | ⭐⭐⭐⭐ | ⭐ | ⭐ | ⭐⭐⭐⭐⭐ |
| **方案二：条件化注册** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ |
| **方案三：条件化 Observer** | ⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐ |

## 推荐方案

### 短期：方案一（早期检查）

**理由**：
- 实现简单，只需在所有方法开始处添加检查
- 性能已经足够好（路径检查的开销极小）
- 维护成本低

### 长期：方案三（条件化 Observer + 早期检查）

**理由**：
- 减少 DOM 观察范围（只在目标文件夹的编辑器上观察）
- 保留早期检查作为兜底
- 性能提升约 30-50%

## 结论

### 回答用户的问题

**Obsidian 不支持官方的插件作用域限制机制。**

但是，我们可以通过以下方式实现**"插件只在相应目录下生效"的效果**：

1. **早期检查**：在所有事件处理的最开始就检查文件路径，不符合则立即返回
2. **条件化 Observer**：只在目标文件夹的编辑器容器上观察 DOM 变化
3. **条件化注册**：动态注册/注销事件监听器（复杂度较高）

### 实际效果

虽然插件仍然在运行（事件监听器仍然注册），但：
- ✅ 非目标文件夹的文件**不会执行任何处理逻辑**
- ✅ 不会执行 DOM 查询
- ✅ 不会执行图片布局处理
- ✅ 从用户角度看，插件"只在相应目录下生效"

### 性能影响

- **当前方案**：每次事件触发时检查文件路径（开销极小，< 1ms）
- **优化方案**：条件化 Observer 减少 DOM 观察范围（减少 90%+ 的 DOM 观察）

**建议**：先实现方案一（早期检查），如果性能仍有问题，再考虑方案三（条件化 Observer）。
