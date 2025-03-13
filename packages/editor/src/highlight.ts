import { Token, TokenKind } from "./lexer/types";

export function highlightTokens(tokens: Token[]): string {
  function visitToken(token: Token): string {
    switch (token.kind) {
      case TokenKind.Identifier:
        return elem(`ident`, token);
      case TokenKind.Number:
        return elem('number', token);
      case TokenKind.String:
        return elem('string', token);
      case TokenKind.Operator:
        return elem('operator', token);
      case TokenKind.Bracket:
        return elem('bracket', token);
      case TokenKind.Punctuation:
        return elem('punctuation', token);
      case TokenKind.Keyword:
        return elem('keyword', token);
      case TokenKind.Boolean:
        return elem('bool', token);
      case TokenKind.EOF:
        return elem('eof', token, '');
      case TokenKind.Unknown:
      case TokenKind.Comment:
        return '';
      case TokenKind.WhiteSpace:
        return token.value;
    }
  }

  return tokens.map(visitToken).join('');
}

function elem(classList: string, token: Token, content?: string) {
  return `<span class="token token-${classList}" data-invalid="${token.error ? true : false}" data-error="${token.error || ''}" data-column="${token.location.column}">${content ?? token.value}</span>`;
}