import type { Object3D } from 'three';

export interface TextureState {
  source: string;
  offsetX: number;
  offsetY: number;
  scale: number;
  rotationDeg: number;
}

export interface PartStyle {
  color: string;
  texture?: TextureState;
}

/**
 * 全量设计状态
 */
export interface DesignState {
  schemaVersion: 1;
  selectedPartId: string | null;
  partStyles: Record<string, PartStyle>;
}

/**
 * 部件配置
 */
export interface PartConfig {
  partId: string;
  name: string;
  meshTargets: string[];
  defaultColor?: string;
  palette?: string[];
  allowTexture?: boolean;
}

/**
 * 设计器初始化配置
 */
export interface DesignerConfig {
  mountEl: HTMLElement;
  modelData: Object3D;
  parts: PartConfig[];
  zoom?: {
    min: number;
    max: number;
    initial: number;
  };
  controls?: {
    rotate: boolean;
    pan: boolean;
  };
  modelValue?: DesignState;
}

export interface TextureTransform {
  offsetX?: number;
  offsetY?: number;
  scale?: number;
  rotationDeg?: number;
}

export interface DesignerEvents {
  ready: void;
  partSelected: { partId: string };
  styleChanged: { state: DesignState };
  'update:modelValue': { modelValue: DesignState };
  error: { message: string; cause?: unknown };
}
