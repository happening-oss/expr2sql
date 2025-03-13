import { OperatorInfo, TypeInfo, createParser } from "./parser";
import { Doc, Operators, Variables } from "./types";
import { Token, TokenKind } from "./lexer/types";
import { findTokenByPosition, findTokensUntil, queryItems } from "./utils";
import { createChecker } from "./checker";

export type Suggestion = {
  type: TypeInfo | OperatorInfo;
  name: string;
  html: string;
}

export function findReplacementsAt(col: number, tokens: Token[], input: string, doc: Doc) {
  if (col < 0) {
    return;
  }
  const selectedToken = findTokenByPosition(tokens, col);
  // setError(selectedToken && selectedToken.error);

  if (selectedToken.kind === TokenKind.Identifier) {
    return {
      title: 'fields',
      items: queryItems('', doc.variables),
      position: selectedToken.location.column,
    };
  }

  if (selectedToken.kind === TokenKind.Operator) {
    if (selectedToken.value !== 'not') {
      return {
        title: 'operators',
        items: queryItems('', doc.operators),
        position: selectedToken.location.column,
      };
    }
    return;
  }

  return findSuggestionsAt(col, tokens, input, doc);
}

export function findSuggestionsAt(col: number, tokens: Token[], input: string, doc: Doc, query?: string) {
  if (col < 0) {
    return;
  }

  const selectedToken = findTokenByPosition(tokens, col);
  // setError(selectedToken && selectedToken.error);

  const inputBeforeCursor = input.slice(0, col);
  const previousTokenMatch = /(((^|\()\s*)|([^\s]\s+)|\.)(?<query>[^\s().]*)$/.exec(inputBeforeCursor);
  query ??= previousTokenMatch?.groups.query ?? '';
  const index = previousTokenMatch?.index ?? col;
  const result = getSuggestions(tokens, col, query, doc);
  if (result) {
    return {
      position: selectedToken ? selectedToken.location.column : (index + 1),
      ...result,
    };
  }
}

function getSuggestions(input: Token[], col: number, query: string = '', doc: Doc): { title?: string; items?: Suggestion[]; } {
  const tokens = findTokensUntil(input, col).filter(t => t.kind !== TokenKind.WhiteSpace);
  tokens.push({
    location: { line: 1, column: 1 },
    kind: TokenKind.Caret,
    value: ''
  });
  const prev = tokens[tokens.length - 2];

  const parser = createParser({ error: 'throw' });

  try {
    parser.parse(tokens);
    if (!prev) {
      return {
        title: 'fields',
        items: queryItems(query, doc.variables),
      };
    } else {
      let filter: (a: string) => boolean;
      if (isIdTokenDate(prev, doc.variables)) {
        filter = (a: string) => !doc.operators[a].allow;
      }
      if (isIdentifierNumber(prev, doc.variables)) {
        filter = (a: string) => !doc.operators[a].allow || doc.operators[a].allow === 'number'
      }

      return {
        title: 'operators',
        items: queryItems(query, doc.operators, operatorSortFn(doc.operators), filter),
      };
    }
  } catch {
    const context = parser.contextStack[parser.contextStack.length - 1];
    if (context && context.key === 'binary') {
      const checker = createChecker(doc, { expected: 'bool' });
      const { nature: nt } = checker.check(context.left);
      if (nt && nt.info) {
        if (nt.info.format === 'date') {
          return {
            title: 'date',
          };
        }

        if (nt.info.values) {
          return {
            title: 'values',
            items: nt.info.values.sort().map(e => ({ name: `"${e}"`, html: `"${e}"`, type: nt.info })),
          };
        }

        if (nt.info.fields) {
          return {
            title: 'json fields',
            items: queryItems(query, nt.info.fields), // Object.values(nt.info.fields).map(e => ({ name: `${e.name}`, html: `${e.name}`, type: e })),
          };
        }
      } else if (['and', 'or', '&&', '||'].includes(context.operator)) {
        return {
          title: 'fields',
          items: queryItems(query, doc.variables),
        };
      }

      // suggest strings
      return null;
    }

    if (!prev || prev.kind === TokenKind.Bracket) {
      return {
        title: 'fields',
        items: queryItems(query, doc.variables),
      };
    } else {
      let filter: (a: string) => boolean;
      if (isIdTokenDate(prev, doc.variables)) {
        filter = (a: string) => !doc.operators[a].allow;
      }
      if (isIdentifierNumber(prev, doc.variables)) {
        filter = (a: string) => !doc.operators[a].allow || doc.operators[a].allow === 'number'
      }

      return {
        title: 'operators',
        items: queryItems(query, doc.operators, operatorSortFn(doc.operators), filter),
      };
    }
  }
}

function isIdTokenDate(token: Token, variables: Variables) {
  if (token.kind === TokenKind.Identifier) {
    const variable = variables[token.value];
    return variable && variable.format === 'date';
  }
  return false;
}

function isIdentifierNumber(token: Token, variables: Variables) {
  if (token.kind === TokenKind.Identifier) {
    const variable = variables[token.value];
    return variable && ['int'].includes(variable.kind);
  }
  return false;
}

function operatorSortFn(operators: Operators) {
  return (t: string, u: string) => {
    const a = operators[t]?.allow;
    const b = operators[u]?.allow;
    return (b === 'string' ? 1 : 0) - (a === 'string' ? 1 : 0);
  }
}
