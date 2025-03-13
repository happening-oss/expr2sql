import { AstError } from "../parser";
import { root } from "./state"
import { eof, stateFn, TokenKind, Token } from "./types"

function createLexer(source: string) {
  const l = {
    start: 0,
    end: 0,
    width: 0,
    startLoc: { line: 1, column: 0 },
    prev: { line: 1, column: 0 },
    loc: { line: 1, column: 0 },
    input: source,
    tokens: [] as Token[],
    err: null as AstError,

    ignore() {
      l.start = l.end;
      l.startLoc = { ...l.loc };
    },

    error(msg: string): stateFn {
      if (l.err == null) { // show first error
        l.err = {
          loc: l.loc,
          message: msg,
        };
      }
      return null;
    },

    peek(): string {
      const r = l.next();
      l.backup();
      return r;
    },

    backup() {
      l.end -= l.width;
      l.loc = { ...l.prev };
    },

    emit(t: TokenKind) {
      l.emitValue(t, l.word());
    },

    emitValue(t: TokenKind, value: string) {
      l.tokens.push({
        location: l.startLoc,
        kind: t,
        value: value,
      });
      l.start = l.end;
      l.startLoc = { ...l.loc };
    },

    next(): string {
      if (l.end >= l.input.length + 1) {
        l.width = 0;
        return eof;
      }
      const r = l.input[l.end];
      const w = r != null ? 1 : 1; // 0

      l.width = w;
      l.end += w;

      l.prev = { ...l.loc };
      if (r == '\n') {
        l.loc.line++;
        l.loc.column = 0;
      } else {
        l.loc.column++;
      }

      return r;
    },

    emitEOF() {
      l.tokens.push({
        location: { ...l.prev }, // Point to previous position for better error messages.
        kind: TokenKind.EOF,
        value: null,
      });
      l.start = l.end;
      l.startLoc = { ...l.loc };
    },

    skip() {
      l.start = l.end;
      l.startLoc = { ...l.loc };
    },

    word(): string {
      return l.input.substring(l.start, l.end);
    },

    accept(valid: string): boolean {
      if (valid.includes(l.next())) {
        return true;
      }
      l.backup();
      return false;
    },

    acceptRun(valid: string) {
      while (valid.includes(l.next())) {
      }
      l.backup();
    },

    acceptWord(word: string): boolean {
      const { end: pos, loc, prev } = l;
      l.skipSpaces();
      for (const ch of word) {
        if (l.next() != ch) {
          l.end = pos;
          l.loc = loc;
          l.prev = prev;
          return false;
        }
      }
      const r = l.peek()
      if (r != ' ' && r != eof) {
        l.end = pos;
        l.loc = loc;
        l.prev = prev;
        return false;
      }
      return true;
    },

    scanDigits(ch: string, base: number, n: number) {
      while (n > 0 && digitVal(ch) < base) {
        ch = l.next();
        n--;
      }
      if (n > 0) {
        l.error("invalid char escape");
      }
      return ch;
    },

    scanEscape(quote: string) {
      let ch = l.next() // read character after '/'
      switch (ch) {
        case 'a':
        case 'b':
        case 'f':
        case 'n':
        case 'r':
        case 't':
        case 'v':
        case '\\':
        case quote:
          // nothing to do
          ch = l.next();
          break;
        case '0':
        case '1':
        case '2':
        case '3':
        case '4':
        case '5':
        case '6':
        case '7':
          ch = l.scanDigits(ch, 8, 3);
          break;
        case 'x':
          ch = l.scanDigits(l.next(), 16, 2);
          break;
        case 'u':
          ch = l.scanDigits(l.next(), 16, 4);
          break;
        case 'U':
          ch = l.scanDigits(l.next(), 16, 8);
          break;
        default:
          l.error("invalid char escape");
      }
      return ch;
    },

    scanString(quote: string) {
      let ch = l.next(); // read character after quote
      let n = 0;
      while (ch != quote) {
        if (ch == '\n' || ch == eof) {
          l.error("literal not terminated");
          return;
        }
        if (ch == '\\') {
          ch = l.scanEscape(quote);
        } else {
          ch = l.next();
        }
        n++;
      }
      return n;
    },

    scanRawString(quote: string) {
      let ch = l.next();  // read character after back tick
      let n = 0;
      while (ch != quote) {
        if (ch == eof) {
          l.error("literal not terminated");
          return;
        }
        ch = l.next();
        n++;
      }
      l.emitValue(TokenKind.String, l.input.slice(l.start + 1, l.end - 1));
      return n
    },

    skipSpaces() {
      let r = l.peek()
      while (r == ' ') {
        l.next();
        r = l.peek();
      }
      l.skip();
    },

    scanSpaces(ch: string) {
      if (ch == null) {
        return;
      }
      while (/\s/.test(ch)) {
        ch = l.next();
      }
      l.backup();
      l.emitValue(TokenKind.WhiteSpace, l.input.slice(l.start, l.end));
    },
  };
  return l;
}

export type Lexer = ReturnType<typeof createLexer>;

export function Tokenize(source: string) {
  const l = createLexer(source);

  let state: stateFn = root;
  do {
    state = state(l);
  } while (state != null)

  // if (l.err != null) {
  //     return null // throw error
  // }

  if (l.err) {
    console.error(l.err);
  }

  return [l.tokens, l] as const;
}

function digitVal(ch: string) {
  if ('0' <= ch && ch <= '9') {
    return parseInt(ch, 10);
  }
  if ('a' <= ch.toLowerCase() && ch.toLowerCase() <= 'f') {
    return parseInt(ch, 16);
  }
  return 16;
}
