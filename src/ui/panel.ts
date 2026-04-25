import type { DesignState, PartConfig } from '../types';

/**
 * 面板事件回调集合
 */
type PanelHandlers = {
  onSelectPart: (partId: string) => void;
  onColorChange: (partId: string, color: string) => void;
  onUploadTexture: (partId: string, file: File) => void;
};

/**
 * 右侧设计面板
 */
export class Panel {
  private readonly root: HTMLElement;
  private readonly partSectionById = new Map<string, HTMLElement>();

  /**
   * 初始化面板结构
   */
  constructor(mountEl: HTMLElement, parts: PartConfig[], handlers: PanelHandlers) {
    this.root = document.createElement('div');
    this.root.className = 'tsd-panel';

    for (const part of parts) {
      const section = document.createElement('section');
      section.className = 'tsd-part';
      section.dataset.partId = part.partId;

      const title = document.createElement('h3');
      title.className = 'tsd-part-title';
      title.textContent = part.name;
      title.addEventListener('click', () => handlers.onSelectPart(part.partId));

      const colorInput = document.createElement('input');
      colorInput.type = 'color';
      colorInput.value = part.defaultColor ?? '#ffffff';
      colorInput.addEventListener('input', () => {
        handlers.onColorChange(part.partId, colorInput.value);
      });

      const fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.accept = 'image/*';
      fileInput.addEventListener('change', () => {
        const file = fileInput.files?.[0];
        if (!file) return;
        handlers.onUploadTexture(part.partId, file);
      });

      section.append(title, colorInput, fileInput);
      this.root.appendChild(section);
      this.partSectionById.set(part.partId, section);
    }

    mountEl.appendChild(this.root);
  }

  /**
   * 高亮选中部件
   */
  highlightPart(partId: string): void {
    for (const [id, section] of this.partSectionById.entries()) {
      section.classList.toggle('is-active', id === partId);
    }
    this.partSectionById.get(partId)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  /**
   * 根据状态同步面板
   */
  sync(state: DesignState): void {
    for (const [partId, style] of Object.entries(state.partStyles)) {
      const section = this.partSectionById.get(partId);
      if (!section) {
        continue;
      }

      const colorInput = section.querySelector('input[type="color"]') as HTMLInputElement | null;
      if (colorInput) {
        colorInput.value = style.color;
      }
    }

    if (state.selectedPartId) {
      this.highlightPart(state.selectedPartId);
    }
  }

  /**
   * 销毁面板
   */
  destroy(): void {
    this.root.remove();
    this.partSectionById.clear();
  }
}
