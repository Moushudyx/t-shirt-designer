import {
  AmbientLight,
  Color,
  DirectionalLight,
  PerspectiveCamera,
  Scene,
  WebGLRenderer,
  type Object3D
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { DesignerConfig } from '../types';

/**
 * 渲染层核心
 */
export class RendererCore {
  private readonly scene = new Scene();
  private readonly camera: PerspectiveCamera;
  private readonly renderer: WebGLRenderer;
  private readonly controls: OrbitControls;
  private readonly mountEl: HTMLElement;
  private readonly resizeObserver: ResizeObserver;

  /**
   * 初始化 three.js 场景
   */
  constructor(config: DesignerConfig) {
    this.mountEl = config.mountEl;

    this.scene.background = new Color('#f8f8f8');

    this.camera = new PerspectiveCamera(45, 1, 0.1, 1000);
    this.camera.position.set(0, 0.8, 2.2);

    this.renderer = new WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enablePan = config.controls?.pan ?? true;
    this.controls.enableRotate = config.controls?.rotate ?? true;
    this.controls.enableDamping = true;
    this.controls.minDistance = config.zoom?.min ?? 1;
    this.controls.maxDistance = config.zoom?.max ?? 6;

    // 仅在初始化时同步一次控制器状态，避免 change 事件递归触发
    if (config.zoom?.initial) {
      this.camera.position.setLength(config.zoom.initial);
    }
    this.controls.update();
    this.controls.addEventListener('change', () => this.renderOnce());

    const ambient = new AmbientLight('#ffffff', 0.9);
    const keyLight = new DirectionalLight('#ffffff', 0.8);
    keyLight.position.set(3, 4, 3);
    this.scene.add(ambient, keyLight);

    this.mountEl.appendChild(this.renderer.domElement);

    this.resizeObserver = new ResizeObserver(() => {
      this.resize();
      this.renderOnce();
    });
    this.resizeObserver.observe(this.mountEl);

    this.resize();
    this.renderOnce();
  }

  /**
   * 添加模型到场景
   */
  addModel(model: Object3D): void {
    this.scene.add(model);
    this.renderOnce();
  }

  /**
   * 从场景移除模型
   */
  removeModel(model: Object3D): void {
    this.scene.remove(model);
    this.renderOnce();
  }

  /**
   * 获取场景实例
   */
  getScene(): Scene {
    return this.scene;
  }

  /**
   * 获取相机实例
   */
  getCamera(): PerspectiveCamera {
    return this.camera;
  }

  /**
   * 获取渲染画布
   */
  getCanvas(): HTMLCanvasElement {
    return this.renderer.domElement;
  }

  /**
   * 执行单帧渲染
   */
  renderOnce(): void {
    this.renderer.render(this.scene, this.camera);
  }

  /**
   * 释放渲染资源
   */
  destroy(): void {
    this.resizeObserver.disconnect();
    this.controls.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  /**
   * 处理容器尺寸变化
   */
  private resize(): void {
    const width = this.mountEl.clientWidth || 1;
    const height = this.mountEl.clientHeight || 1;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }
}
