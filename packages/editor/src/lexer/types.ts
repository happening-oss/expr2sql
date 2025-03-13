import type { Lexer } from "./lexer";

export type stateFn = (l: Lexer) => stateFn;

export type Location = {
  line: number; // The 1-based line of the location.
  column: number; // The 0-based column number of the location.
}

export type Token = {
  location: Location;
  kind: TokenKind;
  value: string;

  error?: string;
}

export enum TokenKind {
  Identifier = "ident",
  Number = "number",
  String = "string",
  Operator = "operator",
  Bracket = "bracket",
  EOF = "EOF", // only one not used

  Unknown = "",
  Punctuation = "punctuation",
  Keyword = "keyword",
  Boolean = "boolean",
  Comment = "comment",
  WhiteSpace = 'whitespace', // my custom one
  Caret = 'caret', // to suggest next token
}

export const eof: string = undefined; // "ß" // character