import type { DecalState, DesignState, PartConfig } from '../types';

/**
 * 面板事件回调集合
 */
type PanelHandlers = {
  onSelectPart: (partId: string) => void;
  onColorChange: (partId: string, color: string) => void;
  onUploadTextures: (partId: string, files: File[]) => void;
  onAddTextDecal: (partId: string, text: string) => void;
  onUpdateDecal: (partId: string, decalId: string, patch: Partial<DecalState>) => void;
  onRemoveDecal: (partId: string, decalId: string) => void;
  onMoveDecal: (partId: string, decalId: string, direction: 'up' | 'down') => void;
};

/**
 * 输入焦点快照
 */
type FocusSnapshot = {
  decalId: string;
  field: string;
  selectionStart: number | null;
  selectionEnd: number | null;
};

/**
 * 右侧设计面板
 */
export class Panel {
  private readonly root: HTMLElement;
  private readonly partSectionById = new Map<string, HTMLElement>();
  private readonly handlers: PanelHandlers;
  private readonly partById = new Map<string, PartConfig>();

  /**
   * 初始化面板结构
   */
  constructor(mountEl: HTMLElement, parts: PartConfig[], handlers: PanelHandlers) {
    this.handlers = handlers;

    this.root = document.createElement('div');
    this.root.className = 'tsd-panel';

    for (const part of parts) {
      this.partById.set(part.partId, part);

      const section = document.createElement('section');
      section.className = 'tsd-part';
      section.dataset.partId = part.partId;

      const title = document.createElement('h3');
      title.className = 'tsd-part-title';
      title.textContent = part.name;
      title.addEventListener('click', () => this.handlers.onSelectPart(part.partId));

      section.appendChild(title);
      section.appendChild(this.createColorControl(part));

      const allowTexture = part.allowTexture ?? true;
      section.appendChild(this.createFileControl(part, allowTexture));
      section.appendChild(this.createTextAddControl(part, allowTexture));

      const decalsContainer = document.createElement('div');
      decalsContainer.className = 'tsd-decals';
      decalsContainer.dataset.role = 'decals';
      section.appendChild(decalsContainer);

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

    const target = this.partSectionById.get(partId);
    if (!target) {
      return;
    }

    const targetTop = target.offsetTop;
    const targetBottom = targetTop + target.offsetHeight;
    const viewTop = this.root.scrollTop;
    const viewBottom = viewTop + this.root.clientHeight;

    if (targetTop < viewTop) {
      this.root.scrollTo({ top: targetTop, behavior: 'smooth' });
      return;
    }

    if (targetBottom > viewBottom) {
      this.root.scrollTo({ top: targetBottom - this.root.clientHeight, behavior: 'smooth' });
    }
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

      const colorInput = section.querySelector('[data-role="part-color"]') as HTMLInputElement | HTMLSelectElement | null;
      if (colorInput) {
        colorInput.value = style.color;
      }

      const decalsContainer = section.querySelector('[data-role="decals"]') as HTMLElement | null;
      if (!decalsContainer) {
        continue;
      }

      this.renderDecals(partId, style.decals, decalsContainer);
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
    this.partById.clear();
  }

  /**
   * 创建颜色选择控件
   */
  private createColorControl(part: PartConfig): HTMLElement {
    const row = document.createElement('label');
    row.className = 'tsd-control-row';

    const label = document.createElement('span');
    label.textContent = '颜色';

    if (part.palette && part.palette.length > 0) {
      const select = document.createElement('select');
      select.dataset.role = 'part-color';
      part.palette.forEach((color) => {
        const option = document.createElement('option');
        option.value = color;
        option.textContent = color;
        select.appendChild(option);
      });
      select.value = part.defaultColor ?? part.palette[0];
      select.addEventListener('change', () => {
        this.handlers.onColorChange(part.partId, select.value);
      });

      row.append(label, select);
      return row;
    }

    const colorInput = document.createElement('input');
    colorInput.dataset.role = 'part-color';
    colorInput.type = 'color';
    colorInput.value = part.defaultColor ?? '#ffffff';
    colorInput.addEventListener('input', () => {
      this.handlers.onColorChange(part.partId, colorInput.value);
    });

    row.append(label, colorInput);
    return row;
  }

  /**
   * 创建图片上传控件
   */
  private createFileControl(part: PartConfig, enabled: boolean): HTMLElement {
    const row = document.createElement('label');
    row.className = 'tsd-control-row';

    const label = document.createElement('span');
    label.textContent = '图片';

    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.multiple = true;
    fileInput.disabled = !enabled;
    fileInput.addEventListener('change', () => {
      const files = fileInput.files ? Array.from(fileInput.files) : [];
      if (files.length === 0) {
        return;
      }

      this.handlers.onUploadTextures(part.partId, files);
      fileInput.value = '';
    });

    row.append(label, fileInput);
    return row;
  }

  /**
   * 创建文字添加控件
   */
  private createTextAddControl(part: PartConfig, enabled: boolean): HTMLElement {
    const textRow = document.createElement('div');
    textRow.className = 'tsd-text-row';

    const textInput = document.createElement('input');
    textInput.type = 'text';
    textInput.placeholder = enabled ? '输入文字贴图' : '该部件不支持贴图';
    textInput.disabled = !enabled;

    const addTextButton = document.createElement('button');
    addTextButton.type = 'button';
    addTextButton.textContent = '添加文字';
    addTextButton.disabled = !enabled;
    addTextButton.addEventListener('click', () => {
      const text = textInput.value.trim();
      if (!text) {
        return;
      }

      this.handlers.onAddTextDecal(part.partId, text);
      textInput.value = '';
    });

    textRow.append(textInput, addTextButton);
    return textRow;
  }

  /**
   * 渲染部件的贴图列表
   */
  private renderDecals(partId: string, decals: DecalState[], container: HTMLElement): void {
    const focusSnapshot = this.captureFocusSnapshot(container);
    container.innerHTML = '';

    if (decals.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'tsd-decal-empty';
      empty.textContent = '暂无贴图';
      container.appendChild(empty);
      return;
    }

    decals.forEach((decal, index) => {
      const item = document.createElement('article');
      item.className = 'tsd-decal-item';

      const header = document.createElement('div');
      header.className = 'tsd-decal-header';

      const title = document.createElement('strong');
      title.textContent = `${decal.type === 'image' ? '图片' : '文字'} ${index + 1}`;

      const buttonGroup = document.createElement('div');
      buttonGroup.className = 'tsd-decal-actions';

      const upButton = document.createElement('button');
      upButton.type = 'button';
      upButton.textContent = '上移';
      upButton.disabled = index === 0;
      upButton.addEventListener('click', () => {
        this.handlers.onMoveDecal(partId, decal.id, 'up');
      });

      const downButton = document.createElement('button');
      downButton.type = 'button';
      downButton.textContent = '下移';
      downButton.disabled = index === decals.length - 1;
      downButton.addEventListener('click', () => {
        this.handlers.onMoveDecal(partId, decal.id, 'down');
      });

      const removeButton = document.createElement('button');
      removeButton.type = 'button';
      removeButton.textContent = '删除';
      removeButton.addEventListener('click', () => {
        this.handlers.onRemoveDecal(partId, decal.id);
      });

      buttonGroup.append(upButton, downButton, removeButton);
      header.append(title, buttonGroup);
      item.appendChild(header);

      item.appendChild(this.createNumberControl('X', decal.id, 'x', decal.x, 0, 1, 0.01, (value) => {
        this.handlers.onUpdateDecal(partId, decal.id, { x: value });
      }));

      item.appendChild(this.createNumberControl('Y', decal.id, 'y', decal.y, 0, 1, 0.01, (value) => {
        this.handlers.onUpdateDecal(partId, decal.id, { y: value });
      }));

      item.appendChild(this.createNumberControl('缩放', decal.id, 'scale', decal.scale, 0.1, 6, 0.1, (value) => {
        this.handlers.onUpdateDecal(partId, decal.id, { scale: value });
      }));

      item.appendChild(this.createNumberControl('旋转', decal.id, 'rotationDeg', decal.rotationDeg, -180, 180, 1, (value) => {
        this.handlers.onUpdateDecal(partId, decal.id, { rotationDeg: value });
      }));

      item.appendChild(this.createNumberControl('透明度', decal.id, 'opacity', decal.opacity, 0, 1, 0.05, (value) => {
        this.handlers.onUpdateDecal(partId, decal.id, { opacity: value });
      }));

      if (decal.type === 'text') {
        item.appendChild(this.createTextControl('文本', decal.id, 'text', decal.text, (value) => {
          this.handlers.onUpdateDecal(partId, decal.id, { text: value });
        }));

        item.appendChild(this.createDecalColorControl('颜色', decal.id, 'color', decal.color, (value) => {
          this.handlers.onUpdateDecal(partId, decal.id, { color: value });
        }));

        item.appendChild(this.createTextControl('字体', decal.id, 'fontFamily', decal.fontFamily, (value) => {
          this.handlers.onUpdateDecal(partId, decal.id, { fontFamily: value });
        }));

        item.appendChild(this.createNumberControl('字号', decal.id, 'fontSize', decal.fontSize, 8, 300, 1, (value) => {
          this.handlers.onUpdateDecal(partId, decal.id, { fontSize: value });
        }));

        item.appendChild(this.createTextControl('字重', decal.id, 'fontWeight', decal.fontWeight, (value) => {
          this.handlers.onUpdateDecal(partId, decal.id, { fontWeight: value });
        }));
      }

      container.appendChild(item);
    });

    this.restoreFocusSnapshot(container, focusSnapshot);
  }

  /**
   * 创建数字输入控件
   */
  private createNumberControl(
    label: string,
    decalId: string,
    field: string,
    value: number,
    min: number,
    max: number,
    step: number,
    onChange: (value: number) => void
  ): HTMLElement {
    const row = document.createElement('label');
    row.className = 'tsd-control-row';

    const text = document.createElement('span');
    text.textContent = label;

    const input = document.createElement('input');
    input.type = 'number';
    input.dataset.role = 'decal-editor';
    input.dataset.decalId = decalId;
    input.dataset.field = field;
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);
    input.value = String(value);
    input.addEventListener('input', () => {
      const next = Number(input.value);
      if (!Number.isFinite(next)) {
        return;
      }

      onChange(next);
    });

    row.append(text, input);
    return row;
  }

  /**
   * 创建文本输入控件
   */
  private createTextControl(
    label: string,
    decalId: string,
    field: string,
    value: string,
    onChange: (value: string) => void
  ): HTMLElement {
    const row = document.createElement('label');
    row.className = 'tsd-control-row';

    const text = document.createElement('span');
    text.textContent = label;

    const input = document.createElement('input');
    input.type = 'text';
    input.dataset.role = 'decal-editor';
    input.dataset.decalId = decalId;
    input.dataset.field = field;
    input.value = value;
    input.addEventListener('input', () => {
      onChange(input.value);
    });

    row.append(text, input);
    return row;
  }

  /**
   * 创建颜色输入控件
   */
  private createDecalColorControl(
    label: string,
    decalId: string,
    field: string,
    value: string,
    onChange: (value: string) => void
  ): HTMLElement {
    const row = document.createElement('label');
    row.className = 'tsd-control-row';

    const text = document.createElement('span');
    text.textContent = label;

    const input = document.createElement('input');
    input.type = 'color';
    input.dataset.role = 'decal-editor';
    input.dataset.decalId = decalId;
    input.dataset.field = field;
    input.value = value;
    input.addEventListener('input', () => {
      onChange(input.value);
    });

    row.append(text, input);
    return row;
  }

  /**
   * 记录当前输入焦点
   */
  private captureFocusSnapshot(container: HTMLElement): FocusSnapshot | null {
    const active = document.activeElement;
    if (!(active instanceof HTMLInputElement)) {
      return null;
    }

    if (!container.contains(active)) {
      return null;
    }

    const decalId = active.dataset.decalId;
    const field = active.dataset.field;
    if (!decalId || !field) {
      return null;
    }

    return {
      decalId,
      field,
      selectionStart: active.selectionStart,
      selectionEnd: active.selectionEnd
    };
  }

  /**
   * 恢复输入焦点
   */
  private restoreFocusSnapshot(container: HTMLElement, snapshot: FocusSnapshot | null): void {
    if (!snapshot) {
      return;
    }

    const selector = `input[data-role="decal-editor"][data-decal-id="${snapshot.decalId}"][data-field="${snapshot.field}"]`;
    const target = container.querySelector(selector);
    if (!(target instanceof HTMLInputElement)) {
      return;
    }

    target.focus();
    if (snapshot.selectionStart !== null && snapshot.selectionEnd !== null) {
      target.setSelectionRange(snapshot.selectionStart, snapshot.selectionEnd);
    }
  }
}
