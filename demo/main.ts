import {
  BoxGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  SphereGeometry
} from 'three';
import { TshirtDesigner, type DesignState, type PartConfig } from '../src/index';

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
 * 演示部件配置
 */
const parts: PartConfig[] = [
  {
    partId: 'front',
    name: '前片',
    meshTargets: ['front_panel'],
    defaultColor: '#ffffff',
    palette: ['#ffffff', '#f4d03f', '#5dade2', '#58d68d', '#ec7063']
  },
  {
    partId: 'back',
    name: '后片',
    meshTargets: ['back_panel'],
    defaultColor: '#ffffff',
    palette: ['#ffffff', '#f4d03f', '#5dade2', '#58d68d', '#ec7063']
  },
  {
    partId: 'collar',
    name: '领口',
    meshTargets: ['collar'],
    defaultColor: '#ffffff',
    palette: ['#ffffff', '#2c3e50', '#1f2d3a']
  }
];

/**
 * 获取挂载节点
 */
const mountEl = document.getElementById('app');
if (!mountEl) {
  throw new Error('Missing #app mount element');
}

/**
 * 创建设计器实例
 */
const designer = new TshirtDesigner({
  mountEl,
  modelData: buildMockModel(),
  parts,
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

/**
 * 默认插入一条文字贴图用于演示
 */
designer.addTextDecal('front', {
  text: 'T-SHIRT',
  y: 0.75
});

/**
 * 观察状态快照变更
 */
designer.on('update:modelValue', ({ modelValue }: { modelValue: DesignState }) => {
  console.log('design-state', modelValue);
});
