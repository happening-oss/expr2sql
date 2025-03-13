import fuzzysort from "fuzzysort";

import { Token, TokenKind } from "./lexer/types";
import { Node, OperatorInfo, TypeInfo } from './parser';
import { Suggestion } from "./suggestions";

const CSS_PROPS = [
  'direction',
  'boxSizing',
  'width',
  'height',
  'overflowX',
  'overflowY',
  'borderTopWidth',
  'borderRightWidth',
  'borderBottomWidth',
  'borderLeftWidth',
  'borderStyle',
  'paddingTop',
  'paddingRight',
  'paddingBottom',
  'paddingLeft',
  'fontStyle',
  'fontVariant',
  'fontWeight',
  'fontStretch',
  'fontSize',
  'fontSizeAdjust',
  'lineHeight',
  'fontFamily',
  'textAlign',
  'textTransform',
  'textIndent',
  'textDecoration',
  'letterSpacing',
  'wordSpacing',
  'whiteSpace',
  'overflowWrap',
  'tabSize',
  'MozTabSize'
];

export function getElementPosition(target: HTMLElement, source: HTMLElement, startIndex: number, show = false) {
  const style = window.getComputedStyle(source);
  target.style.position = 'absolute';
  if (!show) {
    target.style.visibility = 'hidden';
  }
  for (const prop of CSS_PROPS) {
    (target.style as any)[prop] = (style as any)[prop];
  }
  const innerText = source.innerText;
  target.style.overflow = 'hidden';
  target.innerText = innerText.substring(0, startIndex);
  const span = document.createElement('span');
  if (!innerText.substring(startIndex)) {
    span.innerText = '​';
  }
  target.appendChild(span);
  const position = {
    top: span.offsetTop + parseInt(style.borderTopWidth),
    left: span.offsetLeft + parseInt(style.borderLeftWidth),
    height: parseInt(style.lineHeight)
  };
  if (show) {
    span.style.backgroundColor = '#aaa'
  }
  return position;
}

export function createElement(tag: string, target?: HTMLElement, classList?: string[]) {
  const elem = document.createElement(tag);
  if (target) {
    target.appendChild(elem);
  }
  if (classList) {
    elem.classList.add(...classList);
  }
  return elem;
}


export function px(value: number) {
  return isFinite(value) ? value + 'px' : value.toString();
}

export function isOpenBracket(char: string | null | undefined) {
  return '[' === char || '{' === char || '(' === char;
}

export function isClosedBracket(char: string) {
  return ']' === char || '}' === char || ')' === char;
}

export function findTokenByPosition(tokens: Token[], col: number) {
  let found: Token = null;

  for (const token of tokens) {
    if (col >= token.location.column && col <= token.location.column + (token.value || '').length) {
      // when tokens ar next to eachother, we prioritize
      if (!found || isBracketOrWhiteSpace(token)) {
        found = token;
      }
      // break;
    }
  }

  return found;
}

export function findBoundingTokens(tokens: Token[], col: number): [Token, Token] {
  let lo: Token = null;
  let hi: Token = null;

  for (const token of tokens) {
    const start = token.location.column;
    const end = token.location.column + (token.value || '').length;

    if (start < col && col <= end) {
      lo = token;
    }

    if (start === col) {
      hi = token;
      break;
    }
  }

  return [lo, hi];
}

export function findTokensUntil(tokens: Token[], col: number): Token[] {
  let result: Token[] = [];

  for (const token of tokens) {
    if ((token.kind === TokenKind.Bracket || isMemberOp(token)) && token.location.column + (token.value || '').length <= col) {
      result.push(token);
    } else if (token.location.column + (token.value || '').length < col) {
      result.push(token);
    } else {
      break;
    }
  }

  return result;
}

function isMemberOp(token: Token) {
  return token.kind === TokenKind.Operator && token.value === '.';
}

function isBracketOrWhiteSpace(token: Token) {
  return token.kind !== TokenKind.EOF && token.kind !== TokenKind.WhiteSpace && token.kind !== TokenKind.Bracket;
}

export function queryItems<T extends OperatorInfo | TypeInfo>(query: string, items: { [key: string]: T }, sort?: (a: string, b: string) => number, filter?: (i: string) => boolean): Suggestion[] {
  let keys = Object.keys(items);
  if (filter) {
    keys = keys.filter(filter);
  }
  if (query === '') {
    keys.sort(sort);
    return keys.sort(sort).map(e => ({ name: e, html: e, type: items[e] }));
  } else {
    return fuzzysort.go(query, keys)
      // .filter((e => e.target !== query))
      .map((e => ({ name: e.target, type: items[e.target], ...e, html: e.highlight('<em>', '</em>') })));
  }
}