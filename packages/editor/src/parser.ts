import { Location, Token, TokenKind } from './lexer/types';

export type Node = UnaryNode | BinaryNode | StringNode | MemberNode | CallNode | PointerNode | BoolNode | NilNode | IdentifierNode | IntegerNode | WhitespaceNode;

type BaseNode = {
  loc: Location;
}

type UnaryNode = BaseNode & {
  kind: 'unary';
  operator: string;
  node: Node;
}

type BinaryNode = BaseNode & {
  kind: 'binary';
  operator: string;
  left: Node;
  right: Node;
}

type StringNode = BaseNode & {
  kind: 'string';
  value: string;
}

type MemberNode = BaseNode & {
  kind: 'member';
  property: Node;
  node: Node;
  method?: boolean;
}

type CallNode = BaseNode & {
  kind: 'call';
  callee: Node;
}

type PointerNode = BaseNode & {
  kind: 'pointer';
  name: string;
}

type BoolNode = BaseNode & {
  kind: 'bool';
  value: boolean;
}

type NilNode = BaseNode & {
  kind: 'nil';
}

export type IdentifierNode = BaseNode & {
  kind: 'identifier';
  value: string;
}

type IntegerNode = BaseNode & {
  kind: 'integer';
  value: number;
}

type WhitespaceNode = BaseNode & {
  kind: 'whitespace';
  value: string;
}

export type TypeInfo = {
  name?: string;
  kind: 'struct' | 'func' | 'string' | 'bool' | 'int' | 'array' | 'any'; // | 'time.Duration' | 'map' | 'operator';
  type?: TypeInfo;
  arguments?: TypeInfo[];
  return?: TypeInfo;
  fields?: { [field: string]: TypeInfo; };
  key_type?: TypeInfo;
  format?: 'date'; // dates
  values?: string[]; // enums
  description?: string;
}

export type OperatorInfo = {
  kind: string;
  allow?: string;
  description?: string;
} & Omit<TypeInfo, 'kind'>; // TODO:: temp

export type AstError = {
  loc: Location;
  message: string;
}

enum Associativity {
  Left = 'left',
  RIght = 'right'
}

const unary: { [op: string]: [number, Associativity]; } = {
  'not': [50, Associativity.Left],
  '!': [50, Associativity.Left],
  '-': [90, Associativity.Left],
  '+': [90, Associativity.Left],
}

const binary: { [op: string]: [number, Associativity]; } = {
  '|': [0, Associativity.Left],
  'or': [10, Associativity.Left],
  '||': [10, Associativity.Left],
  'and': [15, Associativity.Left],
  '&&': [15, Associativity.Left],
  '==': [20, Associativity.Left],
  '!=': [20, Associativity.Left],
  '<': [20, Associativity.Left],
  '>': [20, Associativity.Left],
  '>=': [20, Associativity.Left],
  '<=': [20, Associativity.Left],
  'in': [20, Associativity.Left],
  'matches': [20, Associativity.Left],
  'contains': [20, Associativity.Left],
  'startsWith': [20, Associativity.Left],
  'endsWith': [20, Associativity.Left],
  '..': [25, Associativity.Left],
  '+': [30, Associativity.Left],
  '-': [30, Associativity.Left],
  '*': [60, Associativity.Left],
  '/': [60, Associativity.Left],
  '%': [60, Associativity.Left],
  '**': [100, Associativity.Left],
  '^': [100, Associativity.Left],
  '??': [500, Associativity.Left],
}

function isComparison(op: string): boolean {
  return op == '<' || op == '>' || op == '>=' || op == '<='
}

type Options = {
  error: 'throw' | 'log' | 'none';
}

export function createParser(options?: Options) {
  options = Object.assign({ error: 'none' }, options);
  const p = {
    tokens: null as Token[],
    current: null as Token,
    pos: null as number,
    err: null as AstError,
    contextStack: [] as Context[],

    error(msg: string) {
      if (p.err == null) {
        p.err = {
          loc: p.current.location,
          message: msg,
        }
      }
      if (options.error === 'throw') {
        throw new Error(p.err.message);
      }
    },

    next() {
      do {
        p.pos++;
        if (p.pos >= p.tokens.length) {
          p.error(`unexpected end of expression`);
          return;
        }
        p.current = p.tokens[p.pos];
      } while (p.current.kind === TokenKind.WhiteSpace);
    },

    expect(kind: TokenKind, value: string) {
      if (p.current.kind === kind && p.current.value === value) {
        p.next();
        return;
      }
      p.error(`unexpected token ${asString(p.current)}`);
    },

    enter(stack: Context) {
      p.contextStack.push(stack);
    },

    exit() {
      const stack = p.contextStack.pop();
      return stack;
    },

    parse(tokens: Token[]) {
      const pos = tokens.findIndex(token => token.kind !== TokenKind.WhiteSpace);
      p.tokens = tokens;
      p.current = tokens[pos];
      p.pos = pos;
      p.err = null;
      p.contextStack = [];

      const node = parseExpression(p, 0);
      if (![TokenKind.EOF, TokenKind.Caret].includes(p.current.kind)) {
        p.error(`unexpected token ${asString(p.current)}`);
      }
      return node;
    }
  };
  return p;
}

type Context = {
  key: 'binary';
  left: Node;
  operator: string;
  negate: boolean;
} | {
  key: 'secondary'
} | {
  key: 'brackets'
} | {
  key: 'unary',
  operator: string;
}

type Parser = ReturnType<typeof createParser>;

function asString(token: Token) {
  return `${token.value} (${token.kind})`;
}

function parseExpression(p: Parser, precedence: number): Node {
  let nodeLeft = parsePrimary(p);

  let prevOperator = '';
  let opToken = p.current;

  function gotoNext() {
    prevOperator = opToken.value;
    opToken = p.current;
  }

  while (opToken.kind === TokenKind.Operator && p.err == null) {
    const negate = opToken.value === 'not';
    let notToken: Token;

    if (negate) {
      const currentPos = p.pos;
      p.next();
      // TODO:: expect an operator that allows negate suffix
      if (allowedNegateSuffix(p.current.value)) { // precedence
        if (binary[p.current.value] && binary[p.current.value][0] >= precedence) {
          notToken = p.current;
          opToken = p.current;
        } else {
          p.pos = currentPos;
          p.current = opToken;
          break;
        }
      } else {
        p.error(`unexpected token ${asString(p.current)}`);
        break;
      }
    }

    const op = binary[opToken.value];
    if (op && op[0] >= precedence) {
      p.enter({ key: 'binary', operator: opToken.value, left: nodeLeft, negate });
      p.next();

      if (isComparison(opToken.value)) {
        // '<', '>', '>=', '<='
        nodeLeft = parseComparison(p, nodeLeft, opToken, op[0]);
        // goto next
        p.exit();
        gotoNext();
        continue;
      }

      let nodeRight: Node;
      if (op[1] === Associativity.Left) {
        nodeRight = parseExpression(p, op[0] + 1);
      } else {
        nodeRight = parseExpression(p, op[0]);
      }

      nodeLeft = {
        kind: 'binary',
        operator: opToken.value,
        left: nodeLeft,
        right: nodeRight,
        loc: opToken.location,
      } as BinaryNode;

      if (negate) {
        nodeLeft = {
          kind: 'unary',
          operator: 'not',
          node: nodeLeft,
          loc: notToken.location,
        } as UnaryNode;
      }
      // goto next
      p.exit();
      gotoNext();
      continue;
    }
    break;
  }

  return nodeLeft;
}

/**
 * unary | (expression) | primary
 */
function parsePrimary(p: Parser) {
  const token = p.current;

  if (token.kind === TokenKind.Operator) {
    const op = unary[token.value];
    if (op) {
      p.enter({ key: 'unary', operator: token.value });
      p.next();
      const expr = parseExpression(p, op[0]);
      const unary: UnaryNode = {
        kind: 'unary',
        operator: token.value,
        node: expr,
        loc: token.location,
      };
      const node = parsePostfixExpression(p, unary);
      p.exit();
      return node;
    }
  }

  if (token.kind === TokenKind.Bracket && token.value === '(') {
    p.enter({ key: 'brackets' });
    p.next();
    const expr = parseExpression(p, 0);
    p.expect(TokenKind.Bracket, ')');
    p.exit();
    const node = parsePostfixExpression(p, expr); // TODO::
    return node;
  }
  const node = parseSecondary(p);
  return node;
}

/**
 * identifier, number, string | member
 */
function parseSecondary(p: Parser) {
  const token = p.current;
  let node: Node = null;

  switch (token.kind) {
    case TokenKind.Identifier:
      p.next()
      switch (token.value) {
        case 'true':
        case 'false':
          node = {
            kind: 'bool',
            value: token.value === 'true',
            loc: token.location,
          } as BoolNode;
          p.exit();
          return node;
        case 'nil':
          node = {
            kind: 'nil',
            loc: token.location,
          } as NilNode;
          p.exit();
          return node;
        default:
          node = {
            kind: 'identifier',
            value: token.value,
            loc: token.location,
          } as IdentifierNode;
      }
      break;
    case TokenKind.Number:
      p.next();
      const value = token.value.replace('_', '');
      const valueLower = value.toLowerCase();
      let num: number;
      // might not be integer
      try {
        num = parseInt(value, 10);
      } catch (err) {
        p.error(`invalid integer literal: ${err}`);
      }
      node = {
        kind: 'integer',
        value: num,
        loc: token.location,
      } as IntegerNode;
      p.exit();
      return node;
    case TokenKind.String:
      p.next()
      node = {
        kind: 'string',
        value: token.value,
        loc: token.location,
      } as StringNode;
      break;
    default:
      // p.expected = [TokenKind.Identifier, TokenKind.Number, TokenKind.String];
      p.error(`unexpected token ${asString(token)}`);
  }

  node = parsePostfixExpression(p, node);
  return node;
}

function parsePostfixExpression(p: Parser, node: Node): Node {
  let postfixToken = p.current;
  while ((postfixToken.kind === TokenKind.Operator || postfixToken.kind === TokenKind.Bracket) && !p.err) {
    if (postfixToken.value == '.' /** TokenKind.Punctuation */) {
      p.enter({ key: 'binary', operator: postfixToken.value, left: node, negate: false });
      p.next();

      const propertyToken = p.current;

      p.next();

      if (propertyToken.kind != TokenKind.Identifier && (propertyToken.kind !== TokenKind.Operator /** !isValidIdentifier(propertyToken.value) */)) {
        // p.expected = [TokenKind.Identifier, TokenKind.Operator];
        p.error('expected name')
      }

      const property: IdentifierNode = {
        kind: 'identifier',
        value: propertyToken.value,
        loc: propertyToken.location,
      };

      const memberNode: MemberNode = {
        kind: 'member',
        node: node,
        property: property,
        loc: propertyToken.location,
      }

      node = memberNode;
      p.exit();
    } else {
      break;
    }
    postfixToken = p.current;
  }
  return node;
}

function parseComparison(p: Parser, left: Node, token: Token, precedence: number): Node {
  let rootNode: Node;
  while (true) {
    const comparator = parseExpression(p, precedence + 1);
    const cmpNode: BinaryNode = {
      kind: 'binary',
      operator: token.value,
      left: left,
      right: comparator,
      loc: token.location,
    }
    if (rootNode == null) {
      rootNode = cmpNode;
    } else {
      rootNode = {
        kind: 'binary',
        operator: '&&', // this default might be dangerous to render
        left: rootNode,
        right: cmpNode,
        loc: token.location,
      } as BinaryNode;
    }

    left = comparator;
    token = p.current;

    if (!(token.kind === TokenKind.Operator && isComparison(token.value) && p.err == null)) {
      break;
    }
    p.next();
  }
  return rootNode;
}


function allowedNegateSuffix(op: string): boolean {
  switch (op) {
    case 'contains':
    case 'matches':
    case 'startsWith':
    case 'endsWith':
    case 'in':
      return true
    default:
      return false
  }
}