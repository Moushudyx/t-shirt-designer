import { Mesh } from 'three';
import { RendererCore } from './core/renderer';
import { ModelManager } from './core/model-manager';
import { MaterialManager } from './core/material-manager';
import { Picker } from './core/picker';
import { Panel } from './ui/panel';
import { Emitter } from './events/emitter';
import { Store } from './state/store';
import { toDataUrl } from './utils/texture';
import type {
  DesignState,
  DesignerConfig,
  DesignerEvents,
  TextureState,
  TextureTransform
} from './types';
import './styles/index.css';

export type {
  DesignState,
  DesignerConfig,
  DesignerEvents,
  PartConfig,
  TextureState,
  TextureTransform
} from './types';

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

  /**
   * 初始化设计器实例
   */
  constructor(config: DesignerConfig) {
    this.config = config;

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

    const currentState = this.store.getState();
    for (const [partId, style] of Object.entries(currentState.partStyles)) {
      this.materialManager.setPartColor(partId, this.modelManager.getPartMeshes(partId), style.color);
    }

    this.panel = new Panel(this.sideEl, this.config.parts, {
      onSelectPart: (partId) => this.selectPart(partId),
      onColorChange: (partId, color) => this.setPartColor(partId, color),
      onUploadTexture: async (partId, file) => {
        const source = await toDataUrl(file);
        await this.setPartTexture(partId, source);
      }
    });

    this.picker = new Picker(
      this.renderer.getCanvas(),
      this.renderer.getCamera(),
      this.modelManager.getRoot(),
      (mesh: Mesh) => {
        const partId = this.modelManager.resolvePartByMesh(mesh);
        if (!partId) return;
        this.selectPart(partId);
      }
    );

    this.panel.sync(currentState);
    this.renderer.renderOnce();
    this.emitter.emit('ready', undefined);
  }

  /**
   * 设置部件底色
   */
  setPartColor(partId: string, color: string): void {
    this.materialManager.setPartColor(partId, this.modelManager.getPartMeshes(partId), color);
    const state = this.store.setPartColor(partId, color);
    this.afterStyleUpdate(state);
  }

  async setPartTexture(
    partId: string,
    fileOrUrl: File | string,
    transform: TextureTransform = {}
  ): Promise<void> {
    const source = typeof fileOrUrl === 'string' ? fileOrUrl : await toDataUrl(fileOrUrl);
    await this.materialManager.setPartTexture(
      partId,
      this.modelManager.getPartMeshes(partId),
      source,
      transform
    );

    const textureState: TextureState = {
      source,
      offsetX: transform.offsetX ?? 0,
      offsetY: transform.offsetY ?? 0,
      scale: transform.scale ?? 1,
      rotationDeg: transform.rotationDeg ?? 0
    };

    const state = this.store.setPartTexture(partId, textureState);
    this.afterStyleUpdate(state);
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
    const next = this.store.setState(state);
    for (const [partId, style] of Object.entries(next.partStyles)) {
      this.materialManager.setPartColor(partId, this.modelManager.getPartMeshes(partId), style.color);
      if (style.texture?.source) {
        void this.materialManager.setPartTexture(
          partId,
          this.modelManager.getPartMeshes(partId),
          style.texture.source,
          style.texture
        );
      }
    }
    this.panel.sync(next);
    this.renderer.renderOnce();
    this.emitModelValue(next);
  }

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
    this.rootEl.remove();
  }

  /**
   * 将状态更新后的公共处理集中在一起
   */
  private afterStyleUpdate(state: DesignState): void {
    this.panel.sync(state);
    this.renderer.renderOnce();
    this.emitter.emit('styleChanged', { state });
    this.emitModelValue(state);
  }

  /**
   * 对外同步 Vue modelValue 事件
   */
  private emitModelValue(state: DesignState): void {
    this.emitter.emit('update:modelValue', { modelValue: state });
  }
}
