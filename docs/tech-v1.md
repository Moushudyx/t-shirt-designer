# t-shirt-designer 技术设计文档 v1

对应需求文档: design/design-v1.md

## 1. 范围约束（v1）

1. v1 仅覆盖主流程能力: 模型渲染、部位选择、颜色编辑、单层贴图编辑、设计状态保存与恢复。
2. v1 暂不覆盖复杂边界场景: 异常模型命名自动修复、多层贴图混合、超大模型性能自适配等。
3. v1 不做模型语义解析，部位映射完全依赖外部配置。

## 2. 总体架构

采用“核心引擎 + UI 壳层 + 适配配置”三层结构:

1. Core（与 UI 解耦）
- 负责 three.js 场景初始化、模型挂载、材质更新、拾取与事件分发。

2. UI（DOM 面板）
- 负责部位列表、颜色选择、贴图上传、贴图变换控件。
- 通过事件调用 Core，不直接操作 three.js 细节。

3. Config（外部输入）
- 提供模型数据、部位配置、默认值与限制项。

事件流:

1. UI 修改颜色/贴图 -> Core 更新对应 part 材质 -> 渲染区实时刷新。
2. 渲染区点击 mesh -> Core 解析 partId -> UI 滚动并高亮对应项。

## 3. 目录与模块设计

建议目录:

- src/index.js: 对外入口，导出 Designer 类。
- src/core/renderer.js: 渲染器、相机、控制器初始化与渲染循环。
- src/core/model-manager.js: 模型加载/挂载、mesh 索引与 part 映射。
- src/core/material-manager.js: 颜色与贴图材质策略。
- src/core/picker.js: Raycaster 拾取与点击命中。
- src/ui/panel.js: 右侧设计区 DOM 渲染与交互绑定。
- src/state/store.js: 轻量状态容器（当前选中 part、每个 part 的颜色/贴图参数）。
- src/events/emitter.js: 事件发布订阅。
- src/utils/texture.js: 贴图加载、尺寸校验、释放逻辑。
- src/styles/index.css: 组件样式。

开发与构建:

- demo/index.html: 本地调试场景（不发布）。
- vite.config.js: 开发服务器与库模式打包（esm + umd）。

## 4. 配置与数据结构

建议对外配置接口（JSDoc 约定）:

```js
/** @typedef {{x:number,y:number,z:number}} Vec3 */

/**
 * @typedef {Object} TextureState
 * @property {string} source - 贴图来源，支持 http(s) URL 或 data URL
 * @property {number} offsetX
 * @property {number} offsetY
 * @property {number} scale
 * @property {number} rotationDeg
 */

/**
 * @typedef {Object} DesignState
 * @property {number} schemaVersion - 状态结构版本，v1 固定为 1
 * @property {string|null} selectedPartId
 * @property {Record<string, {color:string, texture?:TextureState}>} partStyles
 */

/**
 * @typedef {Object} PartConfig
 * @property {string} partId - 业务唯一 ID，如 sleeve_left
 * @property {string} name - UI 显示名
 * @property {string[]} meshTargets - 映射到模型中的 meshName/groupName
 * @property {string} [defaultColor] - 默认颜色，如 #ffffff
 * @property {string[]} [palette] - 限定可选颜色
 * @property {boolean} [allowTexture=true] - 是否允许贴图
 */

/**
 * @typedef {Object} DesignerConfig
 * @property {HTMLElement} mountEl
 * @property {Object} modelData - 直接提供给 three.js 的模型数据
 * @property {PartConfig[]} parts
 * @property {{min:number,max:number,initial:number}} [zoom]
 * @property {{rotate:boolean,pan:boolean}} [controls]
 * @property {DesignState} [modelValue] - 初始设计状态（用于 v-model 对齐）
 */
```

运行时状态（建议）:

```js
{
  schemaVersion: 1,
  selectedPartId: "front",
  partStyles: {
    front: {
      color: "#ffffff",
      texture: {
        source: "https://cdn.example.com/front-logo.png",
        offsetX: 0,
        offsetY: 0,
        scale: 1,
        rotationDeg: 0
      }
    }
  }
}
```

## 5. 关键技术方案

### 5.1 模型与部位映射

1. 初始化时遍历模型 mesh，建立 name -> mesh 引用表。
2. 根据 parts[].meshTargets 建立 partId -> mesh[] 映射。
3. 拾取命中 mesh 后，通过反向表 mesh.uuid -> partId 定位 UI。

失败兜底:

1. 配置中的 meshTargets 不存在时输出 warning。
2. 未映射 mesh 被点击时不抛错，仅忽略。

### 5.2 材质策略（颜色 + 贴图）

1. 每个 part 统一维护“基材质模板”，避免频繁 new 材质。
2. 颜色更新仅改 material.color。
3. 贴图更新使用 TextureLoader；设置 map、needsUpdate。
4. 贴图变换通过 texture.offset/repeat/rotation/center。
5. 替换贴图时调用旧贴图 dispose，避免显存泄漏。

### 5.3 交互控制

1. 旋转/缩放/平移采用 OrbitControls（限制极值与阻尼）。
2. 点击事件仅在 pointerup 且位移阈值内触发，避免拖拽误触。
3. UI 联动通过事件总线:
- part:select
- part:style-change
- panel:scroll-to

### 5.4 渲染性能

1. 只在状态变更时触发渲染（按需渲染），控制器交互期间再启用连续渲染。
2. 限制贴图最大尺寸（如 2048），超限压缩或拒绝。
3. 组件销毁时释放 geometry/material/texture/renderer。

### 5.5 设计状态保存与恢复

1. 状态序列化格式使用 DesignState，保证可 JSON.stringify/JSON.parse。
2. v1 贴图持久化仅约定 source 为可复用地址（http(s) 或 data URL）；blob URL 仅用于会话内预览，不作为长期存储格式。
3. 每次颜色、贴图、选中部位变更后触发统一状态变更事件，输出完整 DesignState 快照。
4. setDesignState(state) 执行全量覆盖更新，按 partId 逐项应用材质并刷新 UI。
5. 状态升级策略: 读取时先检查 schemaVersion；v1 仅支持 schemaVersion=1，不兼容时抛出可读错误。

### 5.6 Vue modelValue 兼容策略

1. 组件保持框架无关，不直接依赖 Vue。
2. 对外事件增加 update:modelValue，payload 为完整 DesignState。
3. Vue 封装层可将 modelValue 透传为初始化值，并在 update:modelValue 时向上 emit，实现 v-model 双向绑定。
4. 非 Vue 场景统一使用 styleChanged 事件，保持同一套状态快照。

## 6. API 设计（对外）

```js
class TshirtDesigner {
  constructor(config) {}
  setPartColor(partId, color) {}
  setPartTexture(partId, fileOrUrl, transform) {}
  selectPart(partId) {}
  getModelValue() {}
  setModelValue(modelValue) {}
  getDesignState() {}
  setDesignState(state) {}
  on(eventName, handler) {}
  off(eventName, handler) {}
  destroy() {}
}
```

事件建议:

1. ready
2. partSelected
3. styleChanged
4. update:modelValue
5. error

## 7. 构建与发布方案

依赖版本矩阵（查询时间: 2026-04-25，来源: npm view）:

| 分类 | 包名 | 建议版本 | Node 支持（包声明） | 备注 |
| --- | --- | --- | --- | --- |
| 运行时依赖 | three | 0.184.0 | 未声明 engines | 浏览器运行时核心依赖 |
| 构建依赖 | vite | 8.0.10 | ^20.19.0 \|\| >=22.12.0 | 开发与构建工具链 |
| 测试依赖（可选） | vitest | 4.1.5 | ^20.0.0 \|\| ^22.0.0 \|\| >=24.0.0 | 若启用自动化测试 |
| 类型依赖（可选） | @types/three | 0.184.0 | 未声明 engines | 仅在 TS/JSDoc 强类型增强时使用 |

package scripts 建议:

1. dev: 启动 demo 调试
2. build: 库模式打包
3. preview: 预览 demo
4. lint: 静态检查（可后置）

Vite 库模式目标:

1. 产物: dist/index.esm.js, dist/index.umd.js, dist/style.css
2. external: three
3. UMD global: THREE

Node 版本口径:

1. 组件开发与构建环境: Node >= 20（用于 Vite 与构建工具链）。
2. 组件使用方环境: 组件产物为 ESM/UMD，使用方项目可在 Node 16 体系中消费产物；若其工具链无法处理对应产物格式，需按 README 指引升级 Node 或调整构建配置。

## 8. 测试策略

1. 单元测试（后续可引入 vitest）
- 配置校验
- part 映射逻辑
- 状态读写与事件派发

2. 集成测试
- 颜色与贴图修改后的材质结果
- 点击拾取到 UI 联动链路

3. 手工回归清单
- 鼠标拖拽与点击不冲突
- 大图上传限制提示
- destroy 后无残留 canvas 与监听器

## 9. 扩展点（非 v1 实现范围）

1. mappingAdapter: 解决不同来源模型命名不一致问题。
2. 质量档位: 按设备能力切换阴影、抗锯齿、像素比。
3. 多层贴图: 通过离屏 canvas 合成后写入单张 map。
