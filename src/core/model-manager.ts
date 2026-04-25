import { Mesh, type Object3D } from 'three';
import type { PartConfig } from '../types';

/**
 * 模型与部件映射管理器
 */
export class ModelManager {
  private readonly root: Object3D;
  private readonly meshesByName = new Map<string, Mesh>();
  private readonly partToMeshes = new Map<string, Mesh[]>();
  private readonly meshUuidToPart = new Map<string, string>();

  /**
   * 初始化模型映射
   */
  constructor(root: Object3D, parts: PartConfig[]) {
    this.root = root;
    this.indexMeshes();
    this.buildPartMapping(parts);
  }

  /**
   * 获取模型根节点
   */
  getRoot(): Object3D {
    return this.root;
  }

  /**
   * 获取部件对应网格列表
   */
  getPartMeshes(partId: string): Mesh[] {
    return this.partToMeshes.get(partId) ?? [];
  }

  /**
   * 根据命中网格反查部件
   */
  resolvePartByMesh(mesh: Mesh): string | null {
    return this.meshUuidToPart.get(mesh.uuid) ?? null;
  }

  /**
   * 建立名称到网格实例索引
   */
  private indexMeshes(): void {
    this.root.traverse((node) => {
      if (node instanceof Mesh) {
        this.meshesByName.set(node.name, node);
      }
    });
  }

  /**
   * 根据配置建立部件映射表
   */
  private buildPartMapping(parts: PartConfig[]): void {
    for (const part of parts) {
      const targets: Mesh[] = [];

      // 仅做配置驱动查表，不做语义推断
      for (const targetName of part.meshTargets) {
        const mesh = this.meshesByName.get(targetName);
        if (!mesh) {
          continue;
        }

        targets.push(mesh);
        this.meshUuidToPart.set(mesh.uuid, part.partId);
      }

      this.partToMeshes.set(part.partId, targets);
    }
  }
}
