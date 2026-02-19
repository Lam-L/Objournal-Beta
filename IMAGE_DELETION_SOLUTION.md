# 编辑器图片删除问题解决方案

## 问题分析

### 当前实现的问题
1. **DOM 结构改变**：图片从原始的 `internal-embed` 容器被移动到 `.diary-gallery` 容器中
2. **CodeMirror 关联丢失**：虽然保留了 `data-pos` 属性，但图片的 DOM 位置改变可能导致 CodeMirror 无法正确识别和删除
3. **用户操作困难**：用户在预览模式下点击图片时，可能无法直接删除，需要切换到源代码模式

### 根本原因
- 图片被 `appendChild` 移动到新容器，失去了与原始 markdown 代码的直接关联
- CodeMirror 编辑器依赖 DOM 位置和 `data-pos` 属性来定位和操作元素
- 当图片在 gallery 容器中时，删除操作可能无法正确映射回源代码

## 解决方案

### 方案一：保持图片在原始位置，使用 CSS 布局（推荐）

**核心思路**：不移动图片 DOM，只通过 CSS 实现画廊布局

**优点**：
- 图片保持在原始 DOM 位置，CodeMirror 可以正常识别和删除
- 不影响编辑器的正常功能
- 实现相对简单

**实现方式**：
1. 不移动图片，只在图片的父容器上添加 `.diary-gallery` 类
2. 使用 CSS Grid/Flexbox 在父容器上实现布局
3. 图片保持在其原始的 `internal-embed` 容器中

**代码修改点**：
- `wrapImageGroup()`: 不移动图片，只包装父容器
- `organizeImagesInContainer()`: 改为在父容器上应用布局类
- CSS: 调整样式，让布局在父容器级别生效

### 方案二：添加删除按钮（备选）

**核心思路**：在每张图片上添加一个删除按钮，点击后删除对应的 markdown 代码

**优点**：
- 用户体验直观
- 不需要改变现有 DOM 结构

**缺点**：
- 需要访问编辑器 API 来删除源代码
- 实现复杂度较高
- 可能与 Obsidian 的 UI 风格不一致

**实现方式**：
1. 在每张图片上添加一个删除图标按钮
2. 点击按钮时，通过 `data-pos` 或其他标识找到对应的源代码位置
3. 使用 CodeMirror API 删除对应的 markdown 代码

### 方案三：监听删除事件，自动清理 gallery（当前已有，但需优化）

**核心思路**：当检测到图片被删除时，自动清理空的 gallery 容器

**当前状态**：
- ✅ 已有 `updateExistingGalleries()` 方法
- ✅ 已有删除检测逻辑
- ⚠️ 但可能响应不够及时

**优化方向**：
1. 提高删除检测的响应速度
2. 确保 gallery 容器在图片删除后立即更新
3. 当 gallery 中只剩一张图片时，可以考虑解除包装

## 推荐方案：方案一（保持图片在原始位置）

### 实现步骤

1. **修改 `wrapImageGroup()` 方法**
   - 不移动图片，而是找到图片的共同父容器
   - 在父容器上添加 `.diary-gallery` 类
   - 保持图片在其原始的 `internal-embed` 容器中

2. **修改 CSS 布局**
   - 让 `.diary-gallery` 作为 Grid 容器
   - 让内部的 `internal-embed` 作为 Grid 项目
   - 通过 CSS 控制布局，而不是移动 DOM

3. **处理边界情况**
   - 图片可能在不同的 `internal-embed` 中
   - 需要找到它们的共同父容器
   - 如果找不到共同父容器，可能需要创建一个包装器

### 技术细节

```typescript
// 伪代码示例
private wrapImageGroup(images: HTMLImageElement[]): void {
    // 1. 找到所有图片的共同父容器
    const commonParent = this.findCommonParent(images);
    
    // 2. 在共同父容器上添加 gallery 类
    commonParent.addClass('diary-gallery');
    commonParent.setAttribute('data-count', images.length.toString());
    
    // 3. 不移动图片，只标记为已处理
    images.forEach(img => {
        img.addClass('diary-processed');
    });
}
```

### CSS 调整

```css
/* 让 gallery 作为 Grid 容器 */
.diary-gallery {
    display: grid;
    /* 根据 data-count 设置不同的布局 */
}

/* 让内部的 internal-embed 作为 Grid 项目 */
.diary-gallery .internal-embed {
    /* Grid 项目样式 */
}
```

## 实施建议

1. **优先级**：方案一 > 方案三优化 > 方案二
2. **测试重点**：
   - 图片删除功能是否正常
   - 布局是否保持正确
   - 实时预览是否正常更新
3. **向后兼容**：确保现有功能不受影响
