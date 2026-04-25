import type { Object3D } from 'three';

/**
 * 设计状态版本号常量
 */
export const DESIGN_SCHEMA_VERSION = 1 as const;

/**
 * 贴图基础结构
 */
export interface DecalBase {
  id: string;
  type: 'image' | 'text';
  x: number;
  y: number;
  scale: number;
  rotationDeg: number;
  opacity: number;
}

/**
 * 图片贴图结构
 */
export interface ImageDecal extends DecalBase {
  type: 'image';
  source: string;
  width: number;
  height: number;
}

/**
 * 文字贴图结构
 */
export interface TextDecal extends DecalBase {
  type: 'text';
  text: string;
  color: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: string;
}

/**
 * 贴图联合类型
 */
export type DecalState = ImageDecal | TextDecal;

/**
 * 部件样式状态
 */
export interface PartStyle {
  color: string;
  decals: DecalState[];
}

/**
 * 全量设计状态
 */
export interface DesignState {
  schemaVersion: typeof DESIGN_SCHEMA_VERSION;
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

/**
 * 贴图变换参数
 */
export interface DecalTransform {
  x?: number;
  y?: number;
  scale?: number;
  rotationDeg?: number;
  opacity?: number;
}

/**
 * 新增图片贴图输入
 */
export interface AddImageDecalInput extends DecalTransform {
  width?: number;
  height?: number;
}

/**
 * 新增文字贴图输入
 */
export interface AddTextDecalInput extends DecalTransform {
  text: string;
  color?: string;
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: string;
}

/**
 * 设计器事件映射
 */
export interface DesignerEvents {
  ready: void;
  partSelected: { partId: string };
  styleChanged: { state: DesignState };
  'update:modelValue': { modelValue: DesignState };
  error: { message: string; cause?: unknown };
}
