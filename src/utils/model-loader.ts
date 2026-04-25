import type { Object3D } from 'three';
import { Mesh } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

/**
 * GLB 加载输入类型
 */
export type GlbInput = string | File;

/**
 * 复用 GLTFLoader 实例
 */
const gltfLoader = new GLTFLoader();

/**
 * 模型网格检查项
 */
export type MeshInspectionItem = {
  name: string;
  uuid: string;
};

/**
 * 加载 glb/gltf 模型并返回根场景对象
 */
export async function loadGlbModel(input: GlbInput): Promise<Object3D> {
  const isFile = input instanceof File;
  const source = isFile ? URL.createObjectURL(input) : input;

  try {
    const gltf = await gltfLoader.loadAsync(source);
    return gltf.scene;
  } finally {
    if (isFile) {
      URL.revokeObjectURL(source);
    }
  }
}

/**
 * 提取模型中的网格命名信息
 */
export function inspectModelMeshes(model: Object3D): MeshInspectionItem[] {
  const result: MeshInspectionItem[] = [];

  model.traverse((node) => {
    if (!(node instanceof Mesh)) {
      return;
    }

    result.push({
      name: node.name || '(empty-name)',
      uuid: node.uuid
    });
  });

  return result;
}
