import { Color, Mesh, MeshStandardMaterial, type Material, type Texture } from 'three';
import type { TextureTransform } from '../types';
import { loadTextureFromSource } from '../utils/texture';

function asStandardMaterial(material: Material | Material[]): MeshStandardMaterial | null {
  const target = Array.isArray(material) ? material[0] : material;
  if (target instanceof MeshStandardMaterial) return target;
  return null;
}

export class MaterialManager {
  private readonly textureByPart = new Map<string, Texture>();

  /**
   * 设置部件底色
   */
  setPartColor(partId: string, meshes: Mesh[], color: string): void {
    for (const mesh of meshes) {
      let standard = asStandardMaterial(mesh.material);
      if (!standard) {
        standard = new MeshStandardMaterial({ color: '#ffffff' });
        mesh.material = standard;
      }
      standard.color = new Color(color);
      standard.needsUpdate = true;
    }
  }

  async setPartTexture(
    partId: string,
    meshes: Mesh[],
    source: string,
    transform: TextureTransform = {}
  ): Promise<void> {
    const nextTexture = await loadTextureFromSource(source);
    this.applyTextureTransform(nextTexture, transform);

    const prevTexture = this.textureByPart.get(partId);
    if (prevTexture) {
      prevTexture.dispose();
    }
    this.textureByPart.set(partId, nextTexture);

    for (const mesh of meshes) {
      let standard = asStandardMaterial(mesh.material);
      if (!standard) {
        standard = new MeshStandardMaterial({ color: '#ffffff' });
        mesh.material = standard;
      }
      standard.map = nextTexture;
      standard.needsUpdate = true;
    }
  }

  /**
   * 释放所有缓存资源
   */
  dispose(): void {
    for (const texture of this.textureByPart.values()) {
      texture.dispose();
    }
    this.textureByPart.clear();
  }

  private applyTextureTransform(texture: Texture, transform: TextureTransform): void {
    const offsetX = transform.offsetX ?? 0;
    const offsetY = transform.offsetY ?? 0;
    const scale = transform.scale ?? 1;
    const rotationDeg = transform.rotationDeg ?? 0;

    texture.center.set(0.5, 0.5);
    texture.offset.set(offsetX, offsetY);
    texture.repeat.set(scale, scale);
    texture.rotation = (rotationDeg * Math.PI) / 180;
  }
}
