# t-shirt-designer

通用的 T 恤设计器组件，使用原生 TypeScript + three.js 开发，支持多部件配色、多图层贴图、文字贴图、设计状态保存与恢复

## 安装

```bash
pnpm add t-shirt-designer three
```

## GLB 使用示例

```ts
import {
  TshirtDesigner,
  loadGlbModel,
  inspectModelMeshes,
  type PartConfig
} from 't-shirt-designer';
import 't-shirt-designer/style.css'; // 可以自己制定样式

const mountEl = document.getElementById('app');
if (!mountEl) throw new Error('Missing #app');

const model = await loadGlbModel('https://example.com/models/t-shirt.glb');

// 打印 mesh 命名，帮助填写 meshTargets
console.table(inspectModelMeshes(model));

const parts: PartConfig[] = [
  {
    partId: 'front',
    name: '前片',
    meshTargets: ['front_panel'],
    defaultColor: '#ffffff'
  },
  {
    partId: 'back',
    name: '后片',
    meshTargets: ['back_panel'],
    defaultColor: '#ffffff'
  }
];

const designer = new TshirtDesigner({
  mountEl,
  modelData: model,
  parts
});

// 可选
// designer.resetView();
```

说明

1. 线上 GLB 需要目标服务器允许 CORS
2. 若模型命名未知，先用 `inspectModelMeshes` 输出命名清单，再配置 `meshTargets`

## 配置参数

`new TshirtDesigner(config)`

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| mountEl | HTMLElement | 是 | 组件挂载容器 |
| modelData | Object3D | 是 | three.js 模型对象 |
| parts | PartConfig[] | 是 | 部件配置数组 |
| throwOnError | boolean | 否 | 出错时是否抛异常，默认 false |
| zoom | { min:number; max:number; initial:number } | 否 | 缩放范围与初始距离 |
| controls | { rotate:boolean; pan:boolean } | 否 | 控制器能力开关 |
| modelValue | DesignState | 否 | 初始设计状态 |

## PartConfig

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| partId | string | 部件唯一 ID |
| name | string | 部件显示名 |
| meshTargets | string[] | 匹配模型中的 mesh 名称 |
| defaultColor | string | 默认颜色 |
| palette | string[] | 限定可选颜色 |
| allowTexture | boolean | 是否允许贴图与文字 |

## 常用 API

| 方法 | 说明 |
| --- | --- |
| setPartColor(partId, color) | 设置部件底色 |
| addImageDecals(partId, filesOrUrls, options?) | 批量追加图片贴图 |
| addTextDecal(partId, options) | 追加文字贴图 |
| updateDecal(partId, decalId, patch) | 更新贴图参数 |
| moveDecal(partId, decalId, direction) | 调整贴图顺序 |
| removeDecal(partId, decalId) | 删除贴图 |
| setPartDecals(partId, decals) | 全量替换部件贴图数组 |
| getDesignState() | 获取当前设计状态 |
| setDesignState(state) | 覆盖设置设计状态 |
| resetView() | 重置模型视角 |
| destroy() | 销毁实例并释放资源 |

## 事件

| 事件名 | 说明 |
| --- | --- |
| ready | 初始化完成 |
| partSelected | 部件被选中 |
| styleChanged | 样式变化 |
| update:modelValue | 设计状态变化 |
| runtimeError | 运行时错误通知，含 willThrow 字段 |
| error | 兼容错误事件 |

```ts
designer.on('runtimeError', ({ message, willThrow }) => {
  console.warn(message, { willThrow });
});
```

## 开发

项目构建命令

```bash
pnpm run build
```
