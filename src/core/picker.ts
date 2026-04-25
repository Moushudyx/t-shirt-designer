import { Mesh, Raycaster, Vector2, type Camera, type Object3D } from 'three';

/**
 * 拾取器
 */
export class Picker {
  private readonly raycaster = new Raycaster();
  private readonly pointer = new Vector2();
  private readonly canvas: HTMLCanvasElement;
  private readonly camera: Camera;
  private readonly root: Object3D;
  private readonly onPick: (mesh: Mesh) => void;

  /**
   * 初始化拾取监听
   */
  constructor(
    canvas: HTMLCanvasElement,
    camera: Camera,
    root: Object3D,
    onPick: (mesh: Mesh) => void
  ) {
    this.canvas = canvas;
    this.camera = camera;
    this.root = root;
    this.onPick = onPick;
    this.canvas.addEventListener('pointerup', this.handlePointerUp);
  }

  /**
   * 销毁拾取器
   */
  destroy(): void {
    this.canvas.removeEventListener('pointerup', this.handlePointerUp);
  }

  /**
   * 处理点击并执行射线拾取
   */
  private handlePointerUp = (event: PointerEvent): void => {
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.pointer, this.camera);
    const intersections = this.raycaster.intersectObject(this.root, true);
    const firstMesh = intersections.find((item) => item.object instanceof Mesh)?.object;
    if (firstMesh instanceof Mesh) {
      this.onPick(firstMesh);
    }
  };
}
