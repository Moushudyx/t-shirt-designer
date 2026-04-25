import {
  Box3,
  BoxGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  SphereGeometry,
  Vector3
} from 'three';
import {
  TshirtDesigner,
  inspectModelMeshes,
  loadGlbModel,
  type DesignState,
  type PartConfig
} from '../src/index';

/**
 * 默认色板常量
 */
const DEFAULT_PALETTE = ['#ffffff', '#f4d03f', '#5dade2', '#58d68d', '#ec7063'];

/**
 * toast 展示时长常量
 */
const TOAST_DURATION_MS = 2200;

/**
 * 设计器实例引用
 */
let designer: TshirtDesigner | null = null;

/**
 * 获取挂载节点
 */
function getMountElement(): HTMLElement {
  const mountEl = document.getElementById('app');
  if (!mountEl) {
    throw new Error('Missing #app mount element');
  }

  return mountEl;
}

/**
 * 挂载节点常量
 */
const mountEl = getMountElement();

/**
 * 展示错误提示
 */
function showToast(message: string): void {
  const toastEl = document.getElementById('toast');
  if (!toastEl) {
    return;
  }

  toastEl.textContent = message;
  toastEl.classList.add('is-visible');
  window.setTimeout(() => {
    toastEl.classList.remove('is-visible');
  }, TOAST_DURATION_MS);
}

/**
 * 更新模型命名检查信息
 */
function updateMeshInfo(model: Object3D): PartConfig[] {
  const infoEl = document.getElementById('mesh-info');
  const meshItems = inspectModelMeshes(model);
  const modelBounds = new Box3().setFromObject(model);

  console.log('mesh-inspection', meshItems);

  const uniqueNames = Array.from(
    new Set(meshItems.map((item) => item.name).filter((name) => name && name !== '(empty-name)'))
  );

  if (infoEl) {
    if (meshItems.length === 0) {
      infoEl.textContent = '未发现 Mesh 节点';
    } else {
      const lines = meshItems
        .slice(0, 60)
        .map((item, index) => `${index + 1}. ${item.name}  [${item.uuid.slice(0, 8)}]`);
      infoEl.textContent = lines.join('\n');
    }
  }

  // 线上模型命名未知时，按网格名自动生成部件映射
  if (!modelBounds.isEmpty()) {
    const size = modelBounds.getSize(new Vector3());
    console.log('model-bounds-size', { x: size.x, y: size.y, z: size.z });
  }

  return uniqueNames.map((name, index) => ({
    partId: `part_${index + 1}`,
    name,
    meshTargets: [name],
    defaultColor: '#ffffff',
    palette: DEFAULT_PALETTE
  }));
}

/**
 * 构建演示模型
 */
function buildMockModel(): Object3D {
  const root = new Group();

  const front = new Mesh(
    new BoxGeometry(1.2, 1.4, 0.12),
    new MeshStandardMaterial({ color: '#f5f5f5' })
  );
  front.name = 'front_panel';

  const back = new Mesh(
    new BoxGeometry(1.2, 1.4, 0.12),
    new MeshStandardMaterial({ color: '#f5f5f5' })
  );
  back.position.z = -0.2;
  back.name = 'back_panel';

  const collar = new Mesh(
    new SphereGeometry(0.2, 24, 16),
    new MeshStandardMaterial({ color: '#f5f5f5' })
  );
  collar.position.y = 0.85;
  collar.scale.set(1, 0.35, 1);
  collar.name = 'collar';

  root.add(front, back, collar);
  return root;
}

/**
 * 创建并挂载设计器
 */
function mountDesigner(modelData: Object3D, parts: PartConfig[]): void {
  designer?.destroy();

  designer = new TshirtDesigner({
    mountEl,
    modelData,
    parts,
    throwOnError: false,
    zoom: {
      min: 1,
      max: 5,
      initial: 2.2
    },
    controls: {
      rotate: true,
      pan: true
    }
  });

  if (parts.length > 0) {
    designer.addTextDecal(parts[0].partId, {
      text: 'T-SHIRT',
      y: 0.75
    });
  }

  designer.on('update:modelValue', ({ modelValue }: { modelValue: DesignState }) => {
    console.log('design-state', modelValue);
  });

  designer.on('error', ({ message }) => {
    console.error('designer-error', message);
    showToast(message);
  });

  designer.on('runtimeError', ({ message, willThrow }) => {
    console.warn('designer-runtime-error', message, { willThrow });
  });
}

/**
 * 加载并挂载 glb 模型
 */
async function loadGlbAndMount(source: string | File): Promise<void> {
  try {
    showToast('开始加载 GLB 模型');
    const model = await loadGlbModel(source);
    const parts = updateMeshInfo(model);

    if (parts.length === 0) {
      showToast('模型缺少可用命名，无法自动映射部件');
      return;
    }

    console.table(parts.map((item) => ({ partId: item.partId, mesh: item.meshTargets[0] })));
    mountDesigner(model, parts);
    showToast(`模型加载完成，已识别 ${parts.length} 个部件`);
  } catch (error) {
    console.error(error);
    showToast('模型加载失败，请检查 URL、CORS 或文件有效性');
  }
}

/**
 * 初始化工具栏交互
 */
function initToolbar(): void {
  const remoteInput = document.getElementById('glb-url') as HTMLInputElement | null;
  const loadRemoteButton = document.getElementById('load-remote') as HTMLButtonElement | null;
  const loadLocalButton = document.getElementById('load-local') as HTMLButtonElement | null;
  const resetViewButton = document.getElementById('reset-view') as HTMLButtonElement | null;

  if (remoteInput && loadRemoteButton) {
    loadRemoteButton.addEventListener('click', () => {
      const url = remoteInput.value.trim();
      if (!url) {
        showToast('请先输入线上 glb/gltf URL');
        return;
      }

      void loadGlbAndMount(url);
    });
  }

  if (loadLocalButton) {
    loadLocalButton.addEventListener('click', () => {
      void loadGlbAndMount('t-shirt.glb');
    });
  }

  if (resetViewButton) {
    resetViewButton.addEventListener('click', () => {
      if (!designer) {
        return;
      }

      designer.resetView();
      showToast('视角已重置');
    });
  }
}

/**
 * 初始化默认演示
 */
function bootstrap(): void {
  initToolbar();

  const model = buildMockModel();
  const defaultParts = [
    {
      partId: 'front',
      name: 'front_panel',
      meshTargets: ['front_panel'],
      defaultColor: '#ffffff',
      palette: DEFAULT_PALETTE
    },
    {
      partId: 'back',
      name: 'back_panel',
      meshTargets: ['back_panel'],
      defaultColor: '#ffffff',
      palette: DEFAULT_PALETTE
    },
    {
      partId: 'collar',
      name: 'collar',
      meshTargets: ['collar'],
      defaultColor: '#ffffff',
      palette: ['#ffffff', '#2c3e50', '#1f2d3a']
    }
  ] satisfies PartConfig[];

  updateMeshInfo(model);
  mountDesigner(model, defaultParts);
}

bootstrap();
