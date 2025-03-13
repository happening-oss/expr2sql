import { ce } from "./dom";

export class EditorDropdown {
  menuRef: HTMLElement;
  root: HTMLElement;
  contentRef: HTMLElement;
  
  constructor() {
    
  }

  set show(show: boolean) {
    this.root.style.display = show ? 'block' : 'none';
  }

  get show() {
    return this.root.style.display !== 'none';
  }

  set fullWidth(fullWidth: boolean) {
    // this.root.classList.toggle('w-100', fullWidth);
    // this.menuRef.classList.toggle('w-100', fullWidth);
  }

  render() {
    this.root = ce('div', 'dropdown');
    this.menuRef = ce('div', 'dropdown-menu');
    this.menuRef.role = 'menu';
    this.contentRef = ce('div', 'dropdown-content');
    this.show = false;
    this.root.appendChild(this.contentRef);
  }
}
