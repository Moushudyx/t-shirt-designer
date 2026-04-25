import type { DesignState, PartConfig, TextureState } from '../types';

function buildInitialState(parts: PartConfig[]): DesignState {
  const partStyles: DesignState['partStyles'] = {};

  for (const part of parts) {
    partStyles[part.partId] = {
      color: part.defaultColor ?? '#ffffff'
    };
  }

  return {
    schemaVersion: 1,
    selectedPartId: parts[0]?.partId ?? null,
    partStyles
  };
}

/**
 * 设计器状态容器
 */
export class Store {
  private state: DesignState;

  /**
   * 初始化状态容器
   */
  constructor(parts: PartConfig[], initial?: DesignState) {
    this.state = initial ?? buildInitialState(parts);
  }

  /**
   * 获取状态快照
   */
  getState(): DesignState {
    return structuredClone(this.state);
  }

  /**
   * 全量替换状态
   */
  setState(next: DesignState): DesignState {
    this.state = structuredClone(next);
    return this.getState();
  }

  /**
   * 设置当前选中部件
   */
  setSelectedPart(partId: string): DesignState {
    this.state.selectedPartId = partId;
    return this.getState();
  }

  /**
   * 设置部件底色
   */
  setPartColor(partId: string, color: string): DesignState {
    const part = this.state.partStyles[partId] ?? { color: '#ffffff' };
    part.color = color;
    this.state.partStyles[partId] = part;
    return this.getState();
  }

  setPartTexture(partId: string, texture: TextureState): DesignState {
    const part = this.state.partStyles[partId] ?? { color: '#ffffff' };
    part.texture = texture;
    this.state.partStyles[partId] = part;
    return this.getState();
  }
}
