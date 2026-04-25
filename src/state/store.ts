import {
  DESIGN_SCHEMA_VERSION,
  type DecalState,
  type DesignState,
  type PartConfig,
  type PartStyle
} from '../types';

/**
 * 构建默认部件样式
 */
function createInitialPartStyle(defaultColor?: string): PartStyle {
  return {
    color: defaultColor ?? '#ffffff',
    decals: []
  };
}

/**
 * 根据部件配置构建初始状态
 */
function buildInitialState(parts: PartConfig[]): DesignState {
  const partStyles: DesignState['partStyles'] = {};

  for (const part of parts) {
    partStyles[part.partId] = createInitialPartStyle(part.defaultColor);
  }

  return {
    schemaVersion: DESIGN_SCHEMA_VERSION,
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
    const part = this.ensurePart(partId);
    part.color = color;
    return this.getState();
  }

  /**
   * 全量设置部件贴图数组
   */
  setPartDecals(partId: string, decals: DecalState[]): DesignState {
    const part = this.ensurePart(partId);
    part.decals = structuredClone(decals);
    return this.getState();
  }

  /**
   * 追加一个贴图
   */
  addPartDecal(partId: string, decal: DecalState): DesignState {
    const part = this.ensurePart(partId);
    part.decals.push(structuredClone(decal));
    return this.getState();
  }

  /**
   * 更新某个贴图
   */
  updatePartDecal(partId: string, decalId: string, patch: Partial<DecalState>): DesignState {
    const part = this.ensurePart(partId);
    const index = part.decals.findIndex((item) => item.id === decalId);
    if (index === -1) {
      return this.getState();
    }

    const current = part.decals[index];
    part.decals[index] = {
      ...current,
      ...patch,
      id: current.id,
      type: current.type
    } as DecalState;
    return this.getState();
  }

  /**
   * 删除某个贴图
   */
  removePartDecal(partId: string, decalId: string): DesignState {
    const part = this.ensurePart(partId);
    part.decals = part.decals.filter((item) => item.id !== decalId);
    return this.getState();
  }

  /**
   * 调整贴图顺序
   */
  movePartDecal(partId: string, decalId: string, direction: 'up' | 'down'): DesignState {
    const part = this.ensurePart(partId);
    const index = part.decals.findIndex((item) => item.id === decalId);
    if (index === -1) {
      return this.getState();
    }

    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= part.decals.length) {
      return this.getState();
    }

    const next = [...part.decals];
    const [item] = next.splice(index, 1);
    next.splice(targetIndex, 0, item);
    part.decals = next;
    return this.getState();
  }

  /**
   * 确保部件样式存在
   */
  private ensurePart(partId: string): PartStyle {
    const part = this.state.partStyles[partId];
    if (part) {
      return part;
    }

    const created = createInitialPartStyle();
    this.state.partStyles[partId] = created;
    return created;
  }
}
