import {
  CanvasTexture,
  Color,
  Mesh,
  MeshStandardMaterial,
  SRGBColorSpace,
  type Material,
  type Texture
} from 'three';
import type { DecalState, ImageDecal, TextDecal } from '../types';

/**
 * 离屏贴图分辨率常量
 */
const DECAL_CANVAS_SIZE = 1024;

/**
 * 默认图片贴图宽度常量
 */
const DEFAULT_IMAGE_WIDTH = 220;

/**
 * 默认图片贴图高度常量
 */
const DEFAULT_IMAGE_HEIGHT = 220;

/**
 * 获取标准材质实例
 */
function asStandardMaterial(material: Material | Material[]): MeshStandardMaterial | null {
  const target = Array.isArray(material) ? material[0] : material;
  if (target instanceof MeshStandardMaterial) {
    return target;
  }
  return null;
}

/**
 * 材质管理器
 */
export class MaterialManager {
  private readonly textureByPart = new Map<string, Texture>();
  private readonly imageCache = new Map<string, Promise<HTMLImageElement>>();

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

  /**
   * 应用部件多贴图数组
   */
  async setPartDecals(partId: string, meshes: Mesh[], decals: DecalState[]): Promise<void> {
    if (decals.length === 0) {
      this.clearPartTexture(partId, meshes);
      return;
    }

    const canvas = document.createElement('canvas');
    canvas.width = DECAL_CANVAS_SIZE;
    canvas.height = DECAL_CANVAS_SIZE;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to create canvas 2D context for decals');
    }

    // 先铺白底，避免透明区域在 map 乘色后显示为黑色
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 贴图按数组顺序绘制，后面的元素覆盖前面的元素
    for (const decal of decals) {
      if (decal.type === 'image') {
        await this.drawImageDecal(ctx, decal);
      } else {
        this.drawTextDecal(ctx, decal);
      }
    }

    const nextTexture = new CanvasTexture(canvas);
    nextTexture.colorSpace = SRGBColorSpace;
    nextTexture.needsUpdate = true;

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
    this.imageCache.clear();
  }

  /**
   * 清理指定部件贴图
   */
  private clearPartTexture(partId: string, meshes: Mesh[]): void {
    const prevTexture = this.textureByPart.get(partId);
    if (prevTexture) {
      prevTexture.dispose();
      this.textureByPart.delete(partId);
    }

    for (const mesh of meshes) {
      const standard = asStandardMaterial(mesh.material);
      if (!standard) {
        continue;
      }
      standard.map = null;
      standard.needsUpdate = true;
    }
  }

  /**
   * 绘制图片贴图
   */
  private async drawImageDecal(ctx: CanvasRenderingContext2D, decal: ImageDecal): Promise<void> {
    const image = await this.loadImage(decal.source);
    const drawWidth = (decal.width || DEFAULT_IMAGE_WIDTH) * decal.scale;
    const drawHeight = (decal.height || DEFAULT_IMAGE_HEIGHT) * decal.scale;

    const centerX = decal.x * DECAL_CANVAS_SIZE;
    const centerY = decal.y * DECAL_CANVAS_SIZE;

    ctx.save();
    ctx.globalAlpha = clampOpacity(decal.opacity);
    ctx.translate(centerX, centerY);
    ctx.rotate((decal.rotationDeg * Math.PI) / 180);
    ctx.drawImage(image, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
    ctx.restore();
  }

  /**
   * 绘制文字贴图
   */
  private drawTextDecal(ctx: CanvasRenderingContext2D, decal: TextDecal): void {
    const centerX = decal.x * DECAL_CANVAS_SIZE;
    const centerY = decal.y * DECAL_CANVAS_SIZE;
    const fontSize = Math.max(1, decal.fontSize * decal.scale);

    ctx.save();
    ctx.globalAlpha = clampOpacity(decal.opacity);
    ctx.translate(centerX, centerY);
    ctx.rotate((decal.rotationDeg * Math.PI) / 180);
    ctx.fillStyle = decal.color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `${decal.fontWeight} ${fontSize}px ${decal.fontFamily}`;
    ctx.fillText(decal.text, 0, 0);
    ctx.restore();
  }

  /**
   * 加载图片并使用缓存避免重复请求
   */
  private loadImage(source: string): Promise<HTMLImageElement> {
    const cached = this.imageCache.get(source);
    if (cached) {
      return cached;
    }

    const promise = new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.crossOrigin = 'anonymous';
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error(`Failed to load image source ${source}`));
      image.src = source;
    });

    this.imageCache.set(source, promise);
    return promise;
  }
}

/**
 * 约束透明度到有效范围
 */
function clampOpacity(opacity: number): number {
  return Math.min(1, Math.max(0, opacity));
}
