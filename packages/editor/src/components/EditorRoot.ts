import { EditorDropdown } from './EditorDropdown';
import { ce } from "./dom";

export class EditorRoot {
  parent: HTMLElement;
  root: HTMLElement;
  overlay: HTMLElement;
  input: HTMLInputElement;

  dropdown: EditorDropdown;

  constructor(parent: HTMLElement) {
    this.parent = parent;
  }

  set value(value: string) {
    this.input.value = value;
  }

  set placeholder(value: string) {
    this.input.placeholder = value;
  }

  set overlayContent(value: string) {
    this.overlay.innerHTML = value;
  }

  set class(value: string) {
    if (value) {
      this.root.classList.add(...value.split(' '));
    }
  }

  render() {
    this.root = ce('div', 'expreditor');
    const a1 = ce('div', 'expreditor__control');

    this.overlay = ce('div', 'expreditor__overlay syntax');

    a1.appendChild(this.overlay);

    this.input = ce('input', 'expreditor__input') as HTMLInputElement;
    this.input.value = this.value;
    this.input.placeholder = this.placeholder;

    this.input.addEventListener('keydown', e => this.onKeyDown(e));
    this.input.addEventListener('click', e => this.onClick(e));
    this.input.addEventListener('input', e => this.onInput(e));
    this.input.addEventListener('keyup', e => this.onKeyUp(e));
    this.input.addEventListener('blur', e => this.onBlur(e));

    a1.appendChild(this.input);

    this.root.append(a1);

    this.dropdown = new EditorDropdown();
    this.dropdown.render();
    this.root.append(this.dropdown.root);
    this.parent.append(this.root);
  }

  onClick(e: MouseEvent) {

  }

  onKeyDown(e: KeyboardEvent) {

  }

  onInput(e: Event) {

  }

  onKeyUp(e: KeyboardEvent) {

  }

  onBlur(e: FocusEvent) {

  }

  destroy() {
    this.root.remove();
  }
}