import { Mesh } from 'three';
import { RendererCore } from './core/renderer';
import { ModelManager } from './core/model-manager';
import { MaterialManager } from './core/material-manager';
import { Picker } from './core/picker';
import { Panel } from './ui/panel';
import { Emitter } from './events/emitter';
import { Store } from './state/store';
import { getImageSize, toDataUrl } from './utils/texture';
import {
  DESIGN_SCHEMA_VERSION,
  type AddImageDecalInput,
  type AddTextDecalInput,
  type DecalState,
  type DesignState,
  type DesignerConfig,
  type DesignerEvents,
  type ImageDecal,
  type PartConfig
} from './types';
import './styles/index.css';

/**
 * 默认文字颜色常量
 */
const DEFAULT_TEXT_COLOR = '#111111';

/**
 * 默认文字字体常量
 */
const DEFAULT_FONT_FAMILY = 'Arial';

/**
 * 默认文字大小常量
 */
const DEFAULT_FONT_SIZE = 64;

/**
 * 默认文字字重常量
 */
const DEFAULT_FONT_WEIGHT = '700';

/**
 * 默认贴图透明度常量
 */
const DEFAULT_OPACITY = 1;

/**
 * 默认贴图缩放常量
 */
const DEFAULT_SCALE = 1;

/**
 * 默认贴图旋转角常量
 */
const DEFAULT_ROTATION = 0;

/**
 * 默认贴图位置 X 常量
 */
const DEFAULT_X = 0.5;

/**
 * 默认贴图位置 Y 常量
 */
const DEFAULT_Y = 0.5;

/**
 * 默认图片贴图宽度常量
 */
const DEFAULT_IMAGE_WIDTH = 220;

/**
 * 默认图片贴图高度常量
 */
const DEFAULT_IMAGE_HEIGHT = 220;

/**
 * 创建贴图唯一ID
 */
function createDecalId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `decal-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

/**
 * 构造图片贴图对象
 */
function createImageDecal(
  source: string,
  size: { width: number; height: number },
  options: AddImageDecalInput = {}
): ImageDecal {
  return {
    id: createDecalId(),
    type: 'image',
    source,
    width: options.width ?? size.width ?? DEFAULT_IMAGE_WIDTH,
    height: options.height ?? size.height ?? DEFAULT_IMAGE_HEIGHT,
    x: options.x ?? DEFAULT_X,
    y: options.y ?? DEFAULT_Y,
    scale: options.scale ?? DEFAULT_SCALE,
    rotationDeg: options.rotationDeg ?? DEFAULT_ROTATION,
    opacity: options.opacity ?? DEFAULT_OPACITY
  };
}

/**
 * T 恤设计器入口类
 */
export class TshirtDesigner {
  private readonly config: DesignerConfig;
  private readonly rootEl: HTMLDivElement;
  private readonly viewportEl: HTMLDivElement;
  private readonly sideEl: HTMLDivElement;
  private readonly renderer: RendererCore;
  private readonly modelManager: ModelManager;
  private readonly materialManager = new MaterialManager();
  private readonly picker: Picker;
  private readonly panel: Panel;
  private readonly store: Store;
  private readonly emitter = new Emitter<DesignerEvents>();
  private readonly partConfigById = new Map<string, PartConfig>();
  private stateRevision = 0;
  private readyEmitted = false;

  /**
   * 初始化设计器实例
   */
  constructor(config: DesignerConfig) {
    this.config = config;

    for (const part of config.parts) {
      this.partConfigById.set(part.partId, part);
    }

    this.rootEl = document.createElement('div');
    this.rootEl.className = 'tsd-root';

    this.viewportEl = document.createElement('div');
    this.viewportEl.className = 'tsd-viewport';

    this.sideEl = document.createElement('div');
    this.sideEl.className = 'tsd-side';

    this.rootEl.append(this.viewportEl, this.sideEl);
    this.config.mountEl.appendChild(this.rootEl);

    this.store = new Store(this.config.parts, this.config.modelValue);
    this.renderer = new RendererCore({ ...this.config, mountEl: this.viewportEl });
    this.modelManager = new ModelManager(this.config.modelData, this.config.parts);
    this.renderer.addModel(this.modelManager.getRoot());

    this.panel = new Panel(this.sideEl, this.config.parts, {
      onSelectPart: (partId) => this.selectPart(partId),
      onColorChange: (partId, color) => this.setPartColor(partId, color),
      onUploadTextures: (partId, files) => {
        void this.addImageDecals(partId, files);
      },
      onAddTextDecal: (partId, text) => {
        this.addTextDecal(partId, { text });
      },
      onUpdateDecal: (partId, decalId, patch) => {
        this.updateDecal(partId, decalId, patch);
      },
      onRemoveDecal: (partId, decalId) => {
        this.removeDecal(partId, decalId);
      },
      onMoveDecal: (partId, decalId, direction) => {
        this.moveDecal(partId, decalId, direction);
      }
    });

    this.picker = new Picker(
      this.renderer.getCanvas(),
      this.renderer.getCamera(),
      this.modelManager.getRoot(),
      (mesh: Mesh) => {
        const partId = this.modelManager.resolvePartByMesh(mesh);
        if (!partId) {
          return;
        }

        this.selectPart(partId);
      }
    );

    const initialState = this.store.getState();
    this.panel.sync(initialState);
    this.renderer.renderOnce();
    void this.applyWholeState(initialState, this.stateRevision, true);
  }

  /**
   * 设置部件底色
   */
  setPartColor(partId: string, color: string): void {
    const partConfig = this.partConfigById.get(partId);
    if (partConfig?.palette && partConfig.palette.length > 0 && !partConfig.palette.includes(color)) {
      this.emitter.emit('error', {
        message: `Color ${color} is not allowed for part ${partId}`
      });
      return;
    }

    this.materialManager.setPartColor(partId, this.modelManager.getPartMeshes(partId), color);
    const state = this.store.setPartColor(partId, color);
    this.publishState(state);
    this.renderer.renderOnce();
  }

  /**
   * 兼容旧接口
   */
  async setPartTexture(
    partId: string,
    fileOrUrl: File | string,
    options: AddImageDecalInput = {}
  ): Promise<void> {
    if (!this.checkTextureEnabled(partId)) {
      return;
    }

    try {
      const source = typeof fileOrUrl === 'string' ? fileOrUrl : await toDataUrl(fileOrUrl);
      const imageSize = await getImageSize(source);
      const imageDecal = createImageDecal(source, imageSize, options);
      const state = this.store.setPartDecals(partId, [imageDecal]);
      this.publishState(state);
      await this.applyPartDecals(partId, state, ++this.stateRevision);
    } catch (error) {
      this.emitError('Failed to set part texture', error);
    }
  }

  /**
   * 批量新增图片贴图
   */
  async addImageDecals(
    partId: string,
    filesOrUrls: Array<File | string>,
    options: AddImageDecalInput = {}
  ): Promise<void> {
    if (!this.checkTextureEnabled(partId)) {
      return;
    }

    try {
      for (const item of filesOrUrls) {
        const source = typeof item === 'string' ? item : await toDataUrl(item);
        const imageSize = await getImageSize(source);
        const imageDecal = createImageDecal(source, imageSize, options);
        this.store.addPartDecal(partId, imageDecal);
      }

      const state = this.store.getState();
      this.publishState(state);
      await this.applyPartDecals(partId, state, ++this.stateRevision);
    } catch (error) {
      this.emitError('Failed to add image decals', error);
    }
  }

  /**
   * 新增文字贴图
   */
  addTextDecal(partId: string, options: AddTextDecalInput): void {
    if (!this.checkTextureEnabled(partId)) {
      return;
    }

    const decal: DecalState = {
      id: createDecalId(),
      type: 'text',
      text: options.text,
      color: options.color ?? DEFAULT_TEXT_COLOR,
      fontFamily: options.fontFamily ?? DEFAULT_FONT_FAMILY,
      fontSize: options.fontSize ?? DEFAULT_FONT_SIZE,
      fontWeight: options.fontWeight ?? DEFAULT_FONT_WEIGHT,
      x: options.x ?? DEFAULT_X,
      y: options.y ?? DEFAULT_Y,
      scale: options.scale ?? DEFAULT_SCALE,
      rotationDeg: options.rotationDeg ?? DEFAULT_ROTATION,
      opacity: options.opacity ?? DEFAULT_OPACITY
    };

    const state = this.store.addPartDecal(partId, decal);
    this.publishState(state);
    void this.applyPartDecals(partId, state, ++this.stateRevision);
  }

  /**
   * 更新指定贴图
   */
  updateDecal(partId: string, decalId: string, patch: Partial<DecalState>): void {
    const state = this.store.updatePartDecal(partId, decalId, patch);
    this.publishState(state);
    void this.applyPartDecals(partId, state, ++this.stateRevision);
  }

  /**
   * 删除指定贴图
   */
  removeDecal(partId: string, decalId: string): void {
    const state = this.store.removePartDecal(partId, decalId);
    this.publishState(state);
    void this.applyPartDecals(partId, state, ++this.stateRevision);
  }

  /**
   * 移动贴图顺序
   */
  moveDecal(partId: string, decalId: string, direction: 'up' | 'down'): void {
    const state = this.store.movePartDecal(partId, decalId, direction);
    this.publishState(state);
    void this.applyPartDecals(partId, state, ++this.stateRevision);
  }

  /**
   * 全量设置部件贴图数组
   */
  setPartDecals(partId: string, decals: DecalState[]): void {
    const state = this.store.setPartDecals(partId, decals);
    this.publishState(state);
    void this.applyPartDecals(partId, state, ++this.stateRevision);
  }

  /**
   * 设置当前选中部件
   */
  selectPart(partId: string): void {
    const state = this.store.setSelectedPart(partId);
    this.panel.highlightPart(partId);
    this.renderer.renderOnce();
    this.emitter.emit('partSelected', { partId });
    this.emitModelValue(state);
  }

  /**
   * 获取 modelValue 快照
   */
  getModelValue(): DesignState {
    return this.getDesignState();
  }

  /**
   * 设置 modelValue
   */
  setModelValue(modelValue: DesignState): void {
    this.setDesignState(modelValue);
  }

  /**
   * 获取完整设计状态
   */
  getDesignState(): DesignState {
    return this.store.getState();
  }

  /**
   * 全量设置设计状态
   */
  setDesignState(state: DesignState): void {
    if (state.schemaVersion !== DESIGN_SCHEMA_VERSION) {
      throw new Error(`Unsupported schemaVersion ${state.schemaVersion}`);
    }

    const next = this.store.setState(state);
    this.publishState(next);
    void this.applyWholeState(next, ++this.stateRevision, false);
  }

  /**
   * 订阅事件
   */
  on<K extends keyof DesignerEvents>(
    eventName: K,
    handler: (payload: DesignerEvents[K]) => void
  ): void {
    this.emitter.on(eventName, handler);
  }

  /**
   * 取消订阅事件
   */
  off<K extends keyof DesignerEvents>(
    eventName: K,
    handler: (payload: DesignerEvents[K]) => void
  ): void {
    this.emitter.off(eventName, handler);
  }

  /**
   * 销毁设计器
   */
  destroy(): void {
    this.picker.destroy();
    this.panel.destroy();
    this.materialManager.dispose();
    this.renderer.removeModel(this.modelManager.getRoot());
    this.renderer.destroy();
    this.emitter.clear();
    this.partConfigById.clear();
    this.rootEl.remove();
  }

  /**
   * 广播状态快照
   */
  private publishState(state: DesignState): void {
    this.panel.sync(state);
    this.emitter.emit('styleChanged', { state });
    this.emitModelValue(state);
  }

  /**
   * 对外同步 Vue modelValue 事件
   */
  private emitModelValue(state: DesignState): void {
    this.emitter.emit('update:modelValue', { modelValue: state });
  }

  /**
   * 检查部件是否允许贴图
   */
  private checkTextureEnabled(partId: string): boolean {
    const partConfig = this.partConfigById.get(partId);
    const allowTexture = partConfig?.allowTexture ?? true;
    if (allowTexture) {
      return true;
    }

    this.emitter.emit('error', {
      message: `Part ${partId} does not allow texture decals`
    });
    return false;
  }

  /**
   * 应用整个状态到渲染层
   */
  private async applyWholeState(
    state: DesignState,
    expectedRevision: number,
    emitReady: boolean
  ): Promise<void> {
    try {
      for (const [partId, style] of Object.entries(state.partStyles)) {
        if (expectedRevision !== this.stateRevision) {
          return;
        }

        this.materialManager.setPartColor(partId, this.modelManager.getPartMeshes(partId), style.color);
        await this.materialManager.setPartDecals(
          partId,
          this.modelManager.getPartMeshes(partId),
          style.decals
        );
      }

      if (expectedRevision !== this.stateRevision) {
        return;
      }

      this.renderer.renderOnce();
      if (emitReady && !this.readyEmitted) {
        this.readyEmitted = true;
        this.emitter.emit('ready', undefined);
      }
    } catch (error) {
      this.emitError('Failed to apply whole state', error);
    }
  }

  /**
   * 应用单个部件贴图数组
   */
  private async applyPartDecals(
    partId: string,
    state: DesignState,
    expectedRevision: number
  ): Promise<void> {
    const partStyle = state.partStyles[partId];
    if (!partStyle) {
      return;
    }

    if (expectedRevision !== this.stateRevision) {
      return;
    }

    try {
      this.materialManager.setPartColor(partId, this.modelManager.getPartMeshes(partId), partStyle.color);
      await this.materialManager.setPartDecals(
        partId,
        this.modelManager.getPartMeshes(partId),
        partStyle.decals
      );

      if (expectedRevision !== this.stateRevision) {
        return;
      }

      this.renderer.renderOnce();
    } catch (error) {
      this.emitError('Failed to apply part decals', error);
    }
  }

  /**
   * 触发统一错误事件
   */
  private emitError(message: string, cause: unknown): void {
    this.emitter.emit('error', {
      message,
      cause
    });
  }
}

export type {
  AddImageDecalInput,
  AddTextDecalInput,
  DecalState,
  DesignState,
  DesignerConfig,
  DesignerEvents,
  PartConfig
} from './types';
