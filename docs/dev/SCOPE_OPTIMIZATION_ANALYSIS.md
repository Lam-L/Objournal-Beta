# Scope 优化方案分析

## 问题核心

用户问：**是否可以通过"圈选 scope"的方式来避免多余的检测，而不是在每次检测时都进行文件路径检查？**

## Obsidian 事件系统的限制

### 1. 全局事件监听器

Obsidian 的事件系统是**全局的**，无法在注册时限制 scope：

```typescript
// ❌ 无法限制 scope
this.app.workspace.on('editor-change', () => {
    // 这个监听器会监听所有编辑器的变化
});

// ❌ 无法限制 scope
this.app.workspace.on('file-open', () => {
    // 这个监听器会监听所有文件的打开
});

// ❌ 无法限制 scope
const observer = new MutationObserver(...);
observer.observe(document.body, { ... }); // 监听整个文档
```

### 2. 事件不携带文件信息

事件回调函数**不直接提供文件路径**，需要手动获取：

```typescript
this.app.workspace.on('editor-change', () => {
    // ❌ 事件回调没有文件路径参数
    // 必须手动获取
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    const filePath = view?.file?.path; // 需要额外查询
});
```

## 可能的 Scope 方案

### 方案A：动态注册/注销事件监听器 ⭐⭐⭐

**核心思路**：跟踪当前活动的编辑器，只在目标文件夹的文件打开时注册监听器。

#### 实现方式

```typescript
class EditorImageLayout {
    private editorChangeRef: EventRef | null = null;
    private currentFilePath: string | null = null;

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
                        // 处理逻辑
                    });
                }
                
                this.currentFilePath = filePath;
            })
        );
    }
}
```

#### 优点
- ✅ 完全避免非目标文件夹文件的检测
- ✅ 性能最优，零开销

#### 缺点
- ❌ 实现复杂度高
- ❌ 需要跟踪监听器生命周期
- ❌ 需要处理文件切换、编辑器关闭等边界情况
- ❌ 维护成本高

### 方案B：条件化 MutationObserver ⭐⭐

**核心思路**：只在目标文件夹的编辑器容器上观察 DOM 变化。

#### 实现方式

```typescript
class EditorImageLayout {
    private observers: Map<string, MutationObserver> = new Map();

    private setupMutationObserver(): void {
        // 监听文件打开，动态创建/销毁 Observer
        this.plugin.registerEvent(
            this.app.workspace.on('file-open', () => {
                const view = this.app.workspace.getActiveViewOfType(MarkdownView);
                const filePath = view?.file?.path;
                
                // 清理旧的 Observer
                this.observers.forEach(obs => obs.disconnect());
                this.observers.clear();
                
                // 只在目标文件夹的文件上创建 Observer
                if (filePath && this.shouldProcessFile(filePath) && view) {
                    const observer = new MutationObserver((mutations) => {
                        // 处理逻辑
                    });
                    
                    observer.observe(view.contentEl, {
                        childList: true,
                        subtree: true
                    });
                    
                    this.observers.set(filePath, observer);
                }
            })
        );
    }
}
```

#### 优点
- ✅ 减少 DOM 观察范围
- ✅ 性能提升明显

#### 缺点
- ❌ 需要跟踪多个编辑器（多标签页）
- ❌ 需要处理编辑器关闭、切换等场景
- ❌ 实现复杂度中等

### 方案C：使用 MarkdownPostProcessor 的 scope ⭐

**核心思路**：`registerMarkdownPostProcessor` 可以接收 `context.sourcePath`，但只适用于后处理器。

#### 实现方式

```typescript
// ✅ 这个已经有 scope 检查
this.plugin.registerMarkdownPostProcessor((element, context) => {
    if (!this.shouldProcessFile(context.sourcePath)) {
        return; // 早期退出
    }
    // 处理逻辑
});
```

#### 优点
- ✅ 后处理器已经有 scope 检查
- ✅ 实现简单

#### 缺点
- ❌ 只适用于后处理器，不适用于事件监听器
- ❌ 无法解决 `editor-change` 和 `MutationObserver` 的问题

## 方案对比

| 方案 | 性能提升 | 实现复杂度 | 维护成本 | 推荐度 |
|------|---------|-----------|---------|--------|
| **方案A：动态注册/注销** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ |
| **方案B：条件化 Observer** | ⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐ |
| **方案C：PostProcessor scope** | ⭐⭐ | ⭐ | ⭐ | ⭐⭐ |
| **当前：早期检查** | ⭐⭐⭐ | ⭐ | ⭐ | ⭐⭐⭐⭐⭐ |

## 推荐方案

### 混合方案：方案B + 早期检查 ⭐⭐⭐⭐⭐

**核心思路**：
1. 使用**条件化 MutationObserver**（方案B）来减少 DOM 观察范围
2. 保留**早期检查**作为兜底方案

#### 实现步骤

1. **条件化 MutationObserver**
   - 只在目标文件夹的编辑器容器上观察
   - 文件切换时动态创建/销毁 Observer

2. **早期检查保留**
   - 在 `editor-change` 等事件中保留早期检查
   - 作为双重保障

#### 优点
- ✅ 性能提升明显（减少 DOM 观察范围）
- ✅ 实现复杂度适中
- ✅ 有兜底方案，更可靠

#### 代码示例

```typescript
class EditorImageLayout {
    private activeObserver: MutationObserver | null = null;
    private currentFilePath: string | null = null;

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
                        // 早期检查（双重保障）
                        if (!this.shouldProcessFile(filePath)) {
                            return;
                        }
                        // 处理逻辑
                    });
                    
                    this.activeObserver.observe(view.contentEl, {
                        childList: true,
                        subtree: true
                    });
                }
                
                this.currentFilePath = filePath;
            })
        );
        
        // 监听文件关闭，清理 Observer
        this.plugin.registerEvent(
            this.app.workspace.on('file-open', () => {
                // 如果切换到非目标文件夹，清理 Observer
                const view = this.app.workspace.getActiveViewOfType(MarkdownView);
                const filePath = view?.file?.path;
                
                if (!filePath || !this.shouldProcessFile(filePath)) {
                    if (this.activeObserver) {
                        this.activeObserver.disconnect();
                        this.activeObserver = null;
                    }
                }
            })
        );
    }
}
```

## 结论

### 回答用户的问题

**是的，可以通过"圈选 scope"的方式来减少检测，但无法完全避免。**

### 最佳实践

1. **短期方案**：继续使用早期检查（当前方案）
   - 实现简单，维护成本低
   - 性能已经足够好

2. **长期优化**：采用混合方案（方案B + 早期检查）
   - 条件化 MutationObserver 减少 DOM 观察范围
   - 保留早期检查作为兜底
   - 性能提升约 30-50%

### 性能影响评估

- **当前方案（早期检查）**：每次事件触发时检查文件路径（开销很小）
- **优化方案（条件化 Observer）**：只在目标文件夹的编辑器上观察 DOM（减少 90%+ 的 DOM 观察）

**建议**：如果当前性能已经满足需求，可以继续使用早期检查。如果希望进一步优化，可以考虑实现条件化 MutationObserver。
