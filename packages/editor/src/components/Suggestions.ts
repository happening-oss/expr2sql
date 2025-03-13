import { OperatorInfo, TypeInfo } from "../parser";
import { ce } from "./dom";

export type Suggestion = {
  type: TypeInfo | OperatorInfo;
  name: string;
  html: string;
}

export class Suggestions {
  private parent: HTMLElement;
  private root: HTMLElement;
  private titleRef: HTMLElement;
  private _suggestionRefs: { mount(): void; update(): void; destroy(): void; }[] = [];
  private _selectedSuggestionIndex: number;

  constructor(parent: HTMLElement) {
    this.parent = parent;
    this.render();
  }

  set suggestions(values: Suggestion[]) {
    this._suggestionRefs.forEach(e => e.destroy());
    this._suggestionRefs = values.map((item, i) => this.renderItem(item, i));
    this._suggestionRefs.forEach(e => e.mount());
  }

  set selectedSuggestionIndex(value: number) {
    this._selectedSuggestionIndex = value;
    this._suggestionRefs.forEach(e => e.update());
    this.scrollPopup();
  }

  set title(value: string) {
    this.titleRef.innerText = value;
  }

  get selectedSuggestionIndex() {
    return this._selectedSuggestionIndex;
  }

  onClickSuggestion(suggestion: Suggestion) {

  }

  scrollPopup() {
    const index = this.selectedSuggestionIndex;
    const target = this.root.querySelector(`.expreditor__suggestion[data-index="${index}"]`);
    if (target) {
      target.scrollIntoView({ block: 'nearest' });
    }
  }

  render() {
    this.root = ce('div', 'expreditor__suggestions');
    this.renderTitle();
    const divider = ce('hr', 'dropdown-divider');
    this.root.appendChild(divider);

    this.parent.appendChild(this.root);
  }

  renderTitle() {
    this.titleRef = ce('div', 'dropdown-item dropdown-heading');
    // this.titleRef.innerText = props.title;
    this.root.append(this.titleRef);
  }

  renderItem(suggestion: Suggestion, i: number) {
    const { type, name, html } = suggestion;
    const self = this;

    const item = ce('a', 'dropdown-item expreditor__suggestion');
    item.classList.toggle('expreditor__selected', this.selectedSuggestionIndex === i);

    item.dataset.value = name;
    item.dataset.kind = type.kind;
    item.dataset.index = i.toString();
    item.addEventListener('click', () => this.onClickSuggestion(suggestion));

    const value = ce('div', 'expreditor__suggestion-value');
    value.innerHTML = html;
    item.appendChild(value);
    const desc = ce('div', 'expreditor__suggestion-desc');
    desc.innerText = type.description ?? '';
    item.appendChild(desc);
    const kind = ce('div', 'expreditor__suggestion-kind');
    kind.innerText = type.kind || type.name;
    item.appendChild(kind);
    return {
      mount() {
        self.root.append(item);
      },
      update() {
        item.classList.toggle('expreditor__selected', self.selectedSuggestionIndex === i);
        item.dataset.index = i.toString();
      },
      destroy() {
        item.remove();
      }
    };
  }

  destroy() {
    this.root.remove();
  }
}

export class SuggestionsState {
  _items: Suggestion[] = [];
  _selectedIndex: number | null = null;
  onChange: (items: Suggestion[], index: number) => void;

  constructor() {
  }

  subscribe(onChange: (items: Suggestion[], index: number) => void) {
    this.onChange = onChange;
  }

  get items() {
    return this._items;
  }

  get selectedIndex() {
    return this._selectedIndex;
  }

  get selectedItem() {
    return this._items[this._selectedIndex];
  }

  private onUpdateItems(previous: Suggestion[]) {
    const current = this._items;
    const index = this._selectedIndex;
    if (index == null) {
      return;
    }

    if (!(index < current.length && index < previous.length && current[index].name === previous[index].name)) {
      this._selectedIndex = null;
    }
  }

  selectNext() {
    const index = this._selectedIndex;
    this._selectedIndex = ((index ?? -1) + 1) % this._items.length;
    this.onChange(this._items, this._selectedIndex);
  }

  selectPrev() {
    const index = this._selectedIndex;
    this._selectedIndex = index >= 1 ? (index - 1) % this._items.length : this._items.length - 1;
    this.onChange(this._items, this._selectedIndex);
  }

  setItems(items: Suggestion[]) {
    const prevItems = this._items;
    this._items = items;
    this.onUpdateItems(prevItems);
    this.onChange(this._items, this._selectedIndex);
  }
}