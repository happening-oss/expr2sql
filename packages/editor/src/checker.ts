import { AstError, IdentifierNode, Node, TypeInfo } from './parser';
import { Doc } from './types';

export type NodeNature = Node & { nature?: Nature; }

type Type = 'struct' | 'func' | 'string' | 'bool' | 'int' | 'array' | 'any' | 'map' | 'nil';

export type Nature = {
  type: Type;
  format?: string;
  info?: TypeInfo;
}

export function createChecker(doc: Doc, opts: { expected?: Type } = {}) {

  let err: AstError = null;

  function error(msg: string, node: Node) {
    // maybe support multiple errors
    if (err == null) {
      err = {
        loc: node.loc,
        message: msg,
      };
    }
  }

  function check(node: NodeNature): NodeNature {
    const nt = checkNode(node);

    if (opts.expected && nt && opts.expected !== nt.type) {
      error(`Expected type ${opts.expected}`, node);
    }

    return node;
  }

  function checkProperty(node: NodeNature, target: TypeInfo): Nature {
    if (target?.fields) {
      if (node.kind === 'identifier' || node.kind === 'string') { // TODO:: see if we want to use property as identifier
        const field = target?.fields[node.value];
        if (!field) {
          error(`Field not found`, node);
        } else {
          return { type: field.kind };
        }
      }
    }
    // TODO:: for some dynamic types allow any field name
    error(`Target has no fields`, node);
    return null;
  }

  function checkIdentifier(node: IdentifierNode): Nature {
    const info = doc.variables[node.value];
    if (info) {
      return {
        type: info.kind as any,
        format: info.format,
        info: info,
      }
    }
    error('Variable not found', node);
  }

  function checkNode(node: NodeNature): Nature {
    if (!node) {
      return null;
    }

    switch (node.kind) {
      case 'unary':
        const nt = checkNode(node.node);
        if (['!', 'not'].includes(node.operator) && nt?.type === 'bool') {
          node.nature = { type: 'bool' };
        } else if (['+', '-'].includes(node.operator) && nt?.type === 'int') {
          node.nature = { type: 'int' };
        } else {
          error('Invalid type', node);
        }
        break;
      case 'binary':
        const left = checkNode(node.left);
        const right = checkNode(node.right);

        if (left?.type === 'string' && right?.type === 'string') {
          right.info = left.info;
        }
        // add more complex comparison logic

        const boolOp = [
          '|',
          'or',
          '||',
          'and',
          '&&',
          '==',
          '!=',
          '<',
          '>',
          '>=',
          '<=',
          'in',
          'matches',
          'contains',
          'startsWith',
          'endsWith',
        ];
        const intOp = ['+', '-', '*', '/',];
        const stringOp = ['+',];

        if (boolOp.includes(node.operator)) {
          node.nature = { type: 'bool' };
        } else if (intOp.includes(node.operator)) {
          node.nature = { type: 'int' };
        } else {
          error(`Unsupported operator ${node.operator}`, node);
        }
        break;
      case 'member':
        const n = checkNode(node.node);
        if (!n) {
          break;
        }
        const m = checkProperty(node.property, n.info);
        if (n.type !== 'struct' && n.type !== 'map') {
          error('Type of node must be struct', node);
          break;
        }
        node.nature = m;
        break;
      case 'call':
        error('Not supported by checker', node);
        break;
      case 'identifier':
        const id = checkIdentifier(node);
        node.nature = id;
        break;
      case 'string':
        node.nature = { type: 'string' };
        break;
      case 'integer':
        node.nature = { type: 'int' };
        break;
      case 'bool':
        node.nature = { type: 'bool' };
        break;
      case 'pointer':
        error('Not supported by checker', node);
        break;
      case 'nil':
        node.nature = { type: 'nil' };
        break;
    }

    return node.nature;
  }

  return {
    get err() {
      return err;
    },
    check,
  }
}
