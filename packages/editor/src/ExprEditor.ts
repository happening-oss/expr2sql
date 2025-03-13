import { createChecker } from './checker';
import { EditorRoot as EditorRootCmp } from './components/EditorRoot';
import { Suggestions, SuggestionsState } from './components/Suggestions';
import { highlightTokens } from './highlight';
import { Tokenize } from './lexer/lexer';
import { Token, TokenKind } from './lexer/types';
import { AstError, Node, createParser } from './parser';
import { Suggestion, findSuggestionsAt } from "./suggestions";
import { Component, ComponentCreator, CustomInputs, Doc } from './types';
import { findTokenByPosition, isClosedBracket, isOpenBracket } from './utils';
import './ExprEditor.scss';

type Props = {
  /** Expressions are activated only after entering this string, eg. 'text:prop == value' */
  separator?: string;
  rawValue?: string;
  onInput?(value: string): void;
  onEnter?(value: string): void;
  doc: Doc;
  customInputs?: CustomInputs;
  onChange?(event: { search?: string; expression?: string; active?: boolean; }): void;
  placeholder?: string;
  class?: string;
  history?: { value: string }[];
}

export class ExprEditor {
  container: HTMLElement;

  private inputRef: HTMLInputElement;
  private overlayRef: HTMLElement;
  private popupContent: Component = null;

  private separator = '';

  private _ast: Node;
  private selectedToken: Token;
  private _parsedInput = {
    search: '',
    startsAt: 0,
    active: false,
    expression: ''
  };
  private _tokens: Token[] = [];
  private _tokenizerError: AstError = null;
  private _astError: AstError = null;
  private props: Props;

  root: EditorRootCmp;

  suggestionsState: SuggestionsState = new SuggestionsState();
  suggestions: Suggestions | undefined;

  private _onDocumentClick: (e: MouseEvent) => void;

  constructor(container: HTMLElement, props: Props) {
    if (!container) {
      throw new Error('[expr-editor] `container` is missing');
    }

    this.container = container;
    this.props = props;

    props.doc.operators ??= {
      '==': { kind: 'binary', description: 'Equals' },
      '!=': { kind: 'binary' },
      '<': { kind: 'binary' },
      '>': { kind: 'binary' },
      '<=': { kind: 'binary' },
      '>=': { kind: 'binary' },
      '&&': { kind: 'binary', allow: 'boolean' },
      'and': { kind: 'binary', allow: 'boolean' },
      '||': { kind: 'binary', allow: 'boolean' },
      'or': { kind: 'binary', allow: 'boolean' },
      'contains': { kind: 'binary', allow: 'string' },
      'startsWith': { kind: 'binary', allow: 'string' },
      'endsWith': { kind: 'binary', allow: 'string' },
      'matches': { kind: 'binary', allow: 'string' },
      '+': { kind: 'binary', allow: 'number' },
      '-': { kind: 'binary', allow: 'number' },
      '*': { kind: 'binary', allow: 'number' },
      '/': { kind: 'binary', allow: 'number' },
      '%': { kind: 'binary', allow: 'number' },
      '**': { kind: 'binary', allow: 'number' },
      '^': { kind: 'binary', allow: 'number' },
    };
    props.doc.variables ??= {};
    props.customInputs ??= {};
    props.class ??= '';
    props.placeholder ??= '';

    this.separator = props.separator ?? '';

    this.render();

    this.setValue(props.rawValue, false);
    this.tokenizeInput();

    document.addEventListener('click', this._onDocumentClick = this.onDocumentClick.bind(this));

    this.suggestionsState.subscribe((items, index) => {
      if (this.suggestions) {
        this.suggestions.selectedSuggestionIndex = index;
      }

      if (this.suggestions.suggestions !== items) {
        this.suggestions.suggestions = items;
      }
    });
  }

  render() {
    const root = this.root = new EditorRootCmp(this.container);
    root.render();
    this.inputRef = root.input;
    this.overlayRef = root.overlay;
    root.class = this.props.class;
    root.placeholder = this.props.placeholder;
    root.onKeyDown = this.onKeyDown.bind(this);
    root.onClick = this.onInputClick.bind(this);
    root.onInput = this.onInput.bind(this);
    root.onKeyUp = this.onKeyUp.bind(this);
    root.onBlur = this.onBlur.bind(this);
  }

  destroy() {
    this.root.destroy();
    document.removeEventListener('click', this._onDocumentClick);
  }

  get rawValue() {
    return this.root.value;
  }

  set rawValue(value: string) {
    this.setValue(value);
  }

  get value() {
    return this._parsedInput.expression;
  }

  set value(value: string) {
    this.setValue(this._parsedInput.search + (this._parsedInput.active ? this.separator : '') + value);
  }

  setValue(value: string, emit = true) {
    this.root.value = value;
    // popupContent?.update(value);
    this._parsedInput = this.parseInput(value);
    this.tokenizeInput();
    if (emit) {
      this.props.onInput?.(value);
      this.props.onChange?.(this._parsedInput);
    }
  }

  setPopupContentValue() {
    this.popupContent?.update?.(this.selectedToken);
  }

  onSuggestionPopupRendererChange(renderer: ComponentCreator) {
    this.root.dropdown.fullWidth = !!renderer;

    if (this.popupContent) {
      this.popupContent.destroy?.();
    }

    if (!renderer) {
      this.suggestions = new Suggestions(this.root.dropdown.contentRef);
      this.suggestions.title = 'dont have';
      this.suggestions.suggestions = this.suggestionsState.items;
      this.popupContent = this.suggestions;
      this.suggestions.onClickSuggestion = item => this.onEnterSuggestion(item.name, item.type.kind);
    } else {
      const component = renderer(this.root.dropdown.contentRef, {
        value: this.selectedToken,
        onInput: (value, kind, close) => {
          this.onEnterSuggestion(value, kind, '', close);
        },
        onKeyDown: (e) => {
          if (e.key === 'Escape') {
            this.hideSuggestions();
            this.inputRef.focus();
          }
        },
      });

      this.popupContent = component;
    }
  }

  updateToken() {
    this.setValue(this._parsedInput.search + (this._parsedInput.active ? this.separator : '') + this._tokens.map(token => token.value || '').join(''));
    this._tokens = this._tokens;
    this.updateOverlay();
  }

  parseInput(rawValue: string) {
    if (this.separator === '') {
      return {
        search: '',
        startsAt: 0,
        active: true,
        expression: rawValue,
      };
    }

    // const separatorCharEscaped = this.separatorChar.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`([^${this.separator}]*)(${this.separator}(.*))?`);
    const matches = rawValue.match(regex);
    return {
      search: matches[1],
      startsAt: matches[1].length + 1,
      active: !!matches[2],
      expression: matches[3]
    };
  }

  tokenizeInput() {
    if (!this._parsedInput.active) {
      this._tokens = [];
      this._tokenizerError = null;
      this._astError = null;
    } else {
      const [tokens, tokenizer] = Tokenize(this.value);
      this._tokens = tokens;

      const parser = createParser();
      const astNode = parser.parse(tokens);

      const checker = createChecker(this.props.doc, { expected: 'bool' });
      checker.check(astNode);

      validateTokens(tokens, this.props.doc, parser.err ?? checker.err, tokenizer.err);
      this._ast = astNode;
      this._tokenizerError = tokenizer.err;
      this._astError = parser.err;
    }
    this.updateOverlay();
  }

  updateOverlay() {
    const html = highlightTokens(this._tokens);
    const overlayHtml = `<span class="token-search">${this._parsedInput.search}</span>${this._parsedInput.active ? this.separator : ''}${html ? `<span class="token-expression">${html}</span>` : ''}`;
    this.root.overlayContent = overlayHtml;
  }

  relativeToStart = (selectionStart: number) => selectionStart - this._parsedInput.startsAt;

  onInput(e: InputEvent) {
    e.preventDefault();
    this.setValue((e.target as HTMLInputElement).value);
  }

  onInputClick(e: MouseEvent) {
    const start = this.relativeToStart(this.inputRef.selectionStart);
    this.selectedToken = findTokenByPosition(this._tokens, start);
    this.hideSuggestions();
    this.onSuggestionPopupRendererChange(null);
    if (start >= 0) {
      const replacements = findSuggestionsAt(start, this._tokens, this.value, this.props.doc, '');
      if (replacements) {
        if (replacements.title === 'date' && this.props.customInputs['date']) {
          this.onSuggestionPopupRendererChange(this.props.customInputs['date']);
        }
        this.showSuggestions({
          title: 'Suggestions',
          items: [],
          ...replacements,
        });
      }
    } else {
      this.showHistory();
    }
    this.highlightMatchingBracket();
  }

  onKeyDown(event: KeyboardEvent) {
    if (this.root.dropdown.show) {
      switch (event.key) {
        case 'Escape':
          event.preventDefault();
          this.hideSuggestions();
          break;
        case 'ArrowUp':
          event.preventDefault();
          this.suggestionsState.selectPrev();
          this.popupContent?.focus?.();
          break;
        case 'ArrowDown':
          event.preventDefault();
          this.suggestionsState.selectNext();
          this.popupContent?.focus?.();
          break;
        case 'Enter':
          event.preventDefault();
          const suggestion = this.suggestionsState.selectedItem;
          if (suggestion && this.popupContent) {
            this.onEnterSuggestion(suggestion.name, suggestion.type.kind, suggestion.type.kind === 'struct' ? '' : ' ');
          } else {
            this.props.onEnter?.(this.value);
            this.hideSuggestions();
            this.disablePopup();
          }
      }
    } else if (!this.root.dropdown.show && event.key === 'Enter') {
      this.props.onEnter?.(this.value);
      this.hideSuggestions();
      this.disablePopup();
    }
  }


  disableSuggestions = false;

  disablePopup() {
    this.disableSuggestions = true;
    setTimeout(() => {
      this.disableSuggestions = false;
    }, 200);
  }

  onKeyUp(event: KeyboardEvent) {
    this.highlightMatchingBracket();

    if ('Escape' === event.key) {
      return;
    }

    if ('ArrowUp' === event.key || 'ArrowDown' === event.key) {
      return true;
    }

    if (!this.disableSuggestions) {
      this.hideSuggestions();
      this.onSuggestionPopupRendererChange(null);
      const suggestions = findSuggestionsAt(this.relativeToStart(this.inputRef.selectionStart), this._tokens, this.value, this.props.doc);
      if (suggestions) {
        if (suggestions.title === 'date') {
          this.onSuggestionPopupRendererChange(this.props.customInputs['date']);
        }
        this.showSuggestions({
          title: 'Suggestions',
          items: [],
          ...suggestions,
        });
      }
    }

    if ('ArrowUp' === event.key || 'ArrowDown' === event.key || 'ArrowLeft' === event.key) {
      return true;
    } else {
      return event.key;
    }
  }

  onBlur() {
    this.overlayRef.querySelectorAll('.expreditor__mark').forEach(markNode => markNode.classList.remove('expreditor__mark'));
  }

  onEnterSuggestion(value: string, kind: string, space: string = '', close = true) {
    if (kind === 'history') {
      this.setValue(value);
      this.inputRef.selectionStart = this._parsedInput.search.length + this.separator.length + value.length + space.length; // space
      this.props.onEnter?.(value);
    } else {
      const start = this.relativeToStart(this.inputRef.selectionStart);
      this.selectedToken = findTokenByPosition(this._tokens, start);

      if (this.selectedToken && !isSupporting(this.selectedToken)) {
        this.selectedToken.value = value + space;
        this.updateToken();
        this.inputRef.selectionStart = this._parsedInput.search.length + this.separator.length + this.selectedToken.location.column + value.length + space.length; // space
      } else {
        const origString = this.inputRef.value;
        const indexPosition = this.inputRef.selectionStart;
        this.setValue(`${origString.slice(0, indexPosition)}${value}${space}${origString.slice(indexPosition)}`); // fix
        this.inputRef.selectionStart = this.inputRef.selectionStart + value.length + space.length; // space
      }
      this.setPopupContentValue();
    }

    // put caret at end of token
    this.inputRef.selectionEnd = this.inputRef.selectionStart;
    this.inputRef.focus();

    if (close) {
      this.hideSuggestions();
    }
  }

  highlightMatchingBracket() {
    const bracketNodes = [...this.overlayRef.querySelectorAll('.token-bracket')];
    for (let ix = 0; ix < bracketNodes.length; ix++) {
      const bracket = bracketNodes[ix] as HTMLElement;
      bracket.classList.remove("expreditor__mark");
      const column = +bracket.dataset['column'];
      const start = this.relativeToStart(this.inputRef.selectionStart);
      const end = this.relativeToStart(this.inputRef.selectionEnd);
      if (start <= column && end >= column) {
        let count = 0;
        bracket.classList.add("expreditor__mark");
        if (isOpenBracket(bracket.textContent!)) {
          for (let i = ix; i < bracketNodes.length; i++) {
            const t = bracketNodes[i].textContent;
            if (isOpenBracket(t)) {
              count++;
            }
            if (isClosedBracket(t)) {
              count--;
            }
            if (count === 0) {
              bracketNodes[i].classList.add("expreditor__mark");
              return;
            }
          }
        }
        if (isClosedBracket(bracket.textContent!)) {
          for (let i = ix; i >= 0; i--) {
            const t = bracketNodes[i].textContent;
            if (isOpenBracket(t)) {
              count++;
            }
            if (isClosedBracket(t)) {
              count--;
            }
            if (count === 0) {
              bracketNodes[i].classList.add("expreditor__mark");
              return;
            }
          }
        }
      }
    }
  }

  showHistory() {
    if (!this.props.history) {
      return;
    }

    this.showSuggestions({
      title: 'History',
      items: this.props.history.map(entry => ({
        name: entry.value,
        type: { kind: 'history' },
        html: entry.value,
      }))
    });
  }

  hideSuggestions() {
    this.root.dropdown.show = false;
    this.popupContent?.destroy();
    this.popupContent = null;
  }

  showSuggestions({ title, items }: { title: string; items: Suggestion[]; }) {
    this.suggestionsState.setItems(items);
    this.suggestions.title = title;
    this.suggestions.suggestions = items;
    this.root.dropdown.show = true;
  }

  onDocumentClick(e: MouseEvent) {
    if (!(e.target as HTMLElement).closest('.expreditor')) {
      this.hideSuggestions();
    }
  }
}

function validateTokens(tokens: Token[], doc: Doc, astError: AstError, tokenError: AstError) {
  function trySetError(token: Token, err: AstError, strict = true) {
    if (err && (strict ? err.loc.column == token.location.column : err.loc.column >= token.location.column)) {
      token.error = err.message;
    }
  }

  for (const token of tokens) {
    // if (token.kind === TokenKind.Identifier && !doc.variables[token.value]) {
    //   token.error = 'Invalid identifier'; // check members
    // }

    trySetError(token, astError);
    trySetError(token, tokenError);
  }

  const last = tokens[tokens.length - 1];
  trySetError(last, astError, false);
  trySetError(last, tokenError, false);
}

function isSupporting(token: Token) {
  return [TokenKind.WhiteSpace, TokenKind.Bracket, TokenKind.EOF].includes(token.kind) || token.kind === TokenKind.Operator && token.value === '.';
}

