import { eof, stateFn, TokenKind } from "./types";
import type { Lexer } from "./lexer";


function unescape(str: string) {
  return decodeURIComponent(str);
}

export function root(l: Lexer): stateFn {
  const r = l.next();

  switch (true) {
    case r == eof:
      l.emitEOF()
      return null
    case r === ' ':
      // l.ignore();
      l.scanSpaces(r); //
      l.ignore();
      break;
    case r == '\'' || r == '"':
      l.scanString(r)
      let str: string;
      try {
        str = unescape(l.word());
      } catch (err) {
        l.error(`${err}`);
      }
      l.emitValue(TokenKind.String, str)
      break;
    case r == '`':
      l.scanRawString(r)
      break;
    case '0' <= r && r <= '9':
      l.backup()
      return number
    case r == '?':
      return questionMark
    case r == '/':
      return slash
    case r == '#':
      return pointer
    case r == '|':
      l.accept("|")
      l.emit(TokenKind.Operator)
      break;
    case r == ':':
      l.accept(":")
      l.emit(TokenKind.Operator)
      break;
    case "([{".includes(r):
      l.emit(TokenKind.Bracket)
      break;
    case ")]}".includes(r):
      l.emit(TokenKind.Bracket)
      break;
    case ",;%+-^".includes(r): // single rune operator
      l.emit(TokenKind.Operator)
      break;
    case "&!=*<>".includes(r): // possible double rune operator
      l.accept("&=*")
      l.emit(TokenKind.Operator)
      break;
    case r == '.':
      l.backup()
      return dot
    case r != null && /\w/.test(r):
      l.backup();
      return identifier;
    default:
      return l.error(`unrecognized character: ${r}`)
  }
  return root
}

function number(l: Lexer): stateFn {
  if (!scanNumber(l)) {
    return l.error(`bad number syntax: ${l.word()}`);
  }
  l.emit(TokenKind.Number)
  return root
}

function scanNumber(l: Lexer): boolean {
  let digits = "0123456789_"
  // Is it hex?
  if (l.accept("0")) {
    // Note: Leading 0 does not mean octal in floats.
    if (l.accept("xX")) {
      digits = "0123456789abcdefABCDEF_"
    } else if (l.accept("oO")) {
      digits = "01234567_"
    } else if (l.accept("bB")) {
      digits = "01_"
    }
  }
  l.acceptRun(digits)
  const { loc, prev, end } = l;
  if (l.accept(".")) {
    // Lookup for .. operator: if after dot there is another dot (1..2), it maybe a range operator.
    if (l.peek() == '.') {
      // We can't backup() here, as it would require two backups,
      // and backup() function supports only one for now. So, save and
      // restore it here.
      l.loc = loc
      l.prev = prev
      l.end = end
      return true
    }
    l.acceptRun(digits)
  }
  if (l.accept("eE")) {
    l.accept("+-")
    l.acceptRun(digits)
  }
  // Next thing mustn't be alphanumeric.
  if (l.peek() != eof && /\w/.test(l.peek())) {
    l.next()
    return false
  }
  return true
}

function dot(l: Lexer): stateFn {
  l.next()
  if (l.accept("0123456789")) {
    l.backup()
    return number
  }
  l.accept(".")
  l.emit(TokenKind.Operator)
  return root
}

function identifier(l: Lexer): stateFn {

  while (true) {
    const r = l.next();
    if (r != null && /\w/.test(r)) {

    } else {
      l.backup()
      switch (l.word()) {
        case "not":
          return not
        case "in":
        case "or":
        case "and":
        case "matches":
        case "contains":
        case "startsWith":
        case "endsWith":
          l.emit(TokenKind.Operator)
          break;
        case "let":
          l.emit(TokenKind.Operator)
          break;
        default:
          l.emit(TokenKind.Identifier)
          break;
      }
      break
    }
  }
  return root
}

function not(l: Lexer): stateFn {
  l.emit(TokenKind.Operator)

  // l.skipSpaces()
  l.scanSpaces(l.peek());
  // l.backup();

  const pos = l.end
  const loc = l.loc;
  const prev = l.prev

  // Get the next word.
  while (true) {
    const r = l.next() // excessive skip
    if (r != null && /\w/.test(r)) {
      // absorb
    } else {
      l.backup()
      break
    }
  }

  switch (l.word()) {
    case "in":
    case "matches":
    case "contains":
    case "startsWith":
    case "endsWith":
      l.emit(TokenKind.Operator)
      break;
    default:
      l.end = pos;
      l.loc = { ...loc };
      l.prev = { ...prev };
  }
  return root
}

function questionMark(l: Lexer): stateFn {
  l.accept(".?")
  l.emit(TokenKind.Operator)
  return root
}

function slash(l: Lexer): stateFn {
  if (l.accept("/")) {
    return singleLineComment
  }
  if (l.accept("*")) {
    return multiLineComment
  }
  l.emit(TokenKind.Operator)
  return root
}

function singleLineComment(l: Lexer): stateFn {
  while (true) {
    const r = l.next()
    if (r == eof || r == '\n') {
      break
    }
  }
  l.ignore()
  return root
}

function multiLineComment(l: Lexer): stateFn {
  while (true) {
    const r = l.next()
    if (r == eof) {
      return l.error("unclosed comment")
    }
    if (r == '*' && l.accept("/")) {
      break
    }
  }
  l.ignore()
  return root
}

function pointer(l: Lexer): stateFn {
  l.accept("#")
  l.emit(TokenKind.Operator)
  while (true) {
    const r = l.next();
    switch (true) {
      case r != null && /\w/.test(r): // absorb
        break;
      default:
        l.backup()
        if (l.word() != "") {
          l.emit(TokenKind.Identifier)
        }
        return root
    }
  }
}