import { createElement, getElementPosition } from "../utils";
import { ce } from "./dom";

/** unused */
export class EditorPopup {
  parent = document.body;
  root: HTMLElement;
  offscreenDiv: any;

  constructor() {
    this.offscreenDiv = createElement('div', document.body);
    this.offscreenDiv.style.position = 'absolute';
    this.offscreenDiv.style.top = '-2310px';
    this.offscreenDiv.style.left = '-2411px';
    this.render();
  }

  set show(value: boolean) {
    this.root.style.display =  value ? 'block' : 'none';
  }

  set children(value: HTMLElement) {
    this.root.innerHTML = '';
    this.root.appendChild(value);
  }

  render() {
    this.root = ce('div', 'expreditor__popup');
  }

  positionPopup(props: { position: number; parent: HTMLElement; }) {
    const startIndex = props.position;
    const parent = props.parent;
    const rect = props.parent.getBoundingClientRect();

    const { top, left, height } = getElementPosition(this.offscreenDiv, parent, startIndex);
    this.root.style.top = window.scrollY + rect.top - parent.scrollTop + top - height - 5 + 'px';
    this.root.style.left = window.scrollX + rect.left - parent.scrollLeft - 10 + left + 0 + 'px';
  }

  remove() {
    this.offscreenDiv.remove();
  }
}
