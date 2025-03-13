<p align="center">
  <img src="./logo.png" height="128" width="128"/>
</p>

<h1 align="center">
  @happening-oss/expr2sql-editor
</h1>

<p align="center">
    <a href="https://github.com/happening-oss/expr2sql-editor/releases">
      <img src="https://img.shields.io/github/v/release/happening-oss/expr2sql-editor" alt="Latest Release"/>
    </a>
    <a href="https://www.npmjs.com/package/@happening-oss/expr2sql-editor">
        <img src="https://img.shields.io/npm/v/@happening-oss/expr2sql-editor" alt="npm">
    </a>
    <a href="https://www.npmjs.com/package/@happening-oss/expr2sql-editor">
        <img src="https://img.shields.io/npm/dm/@happening-oss/expr2sql-editor" alt="npm downloads">
    </a>
    <a href="https://github.com/happening-oss/expr2sql-editor/blob/editor/packages/editor/LICENSE">
        <img src="https://img.shields.io/github/license/happening-oss/expr2sql-editor" alt="MIT">
    </a>
<p>

An auto-complete query builder for `expr-lang` expressions, designed for intuitive filtering and search. Compatible with [expr2sql](/README.md). 🚀 Try the live demo: [Click here](https://happening-oss.github.io/expr2sql)!

# Features

- 📝 Auto-complete with field and operator suggestions
- 🔍 Syntax validation for expressions
- 🎛️ Custom input components for specific data types

# Getting Started

Install from `npm`:

```bash
npm i @happening-oss/expr2sql-editor
```

Define the target element: 

```html
<div id="editor"></div>
```

Initialize the `ExprEditor` component:

```js
import { ExprEditor } from '@happening-oss/expr2sql-editor';

// define the doc
const doc = {
  variables: {
    intField: {
      name: 'intField',
      kind: 'int',
    },
    stringField: {
      name: 'stringField',
      kind: 'string',
    },
  },
};

// initialize the editor
const editorRef = document.querySelector('#editor');
const editor = new ExprEditor(editorRef, {
  rawValue: 'intField > 1234',
  doc,
  onInput: (value) => {
    console.log('value changed', value);
  },
});
```

# Configuration

`ExprEditor` accepts two parameters, one is the target element which the editor loads in. The other is the configuration object.

```ts
const editor = new ExprEditor(target, options);
```

### Raw input vs expression

The editor supports both free-text search and structured expressions. A separator (eg. `:`) defines where the structured expression begins. The whole input value is the "raw value" and its form is `<search><separator><expression>`. Examples when the separator is `:`:

| Raw value |  | Search | Expression
|--|--|--|--|
|`test123:field1 == "Foo"`| Search + expression | `test123` | `field1 == "Foo"` |
|`some string`|Just search| `some string` |  |
|`:timestamp < '2025-01-01'`|Just expression| | `timestamp < '2025-01-01'` |

```ts
type Props = {
  /** Separates search and expression, eg. with ':', 'text:prop == value' is possible */
  separator?: string;
  /** The raw input value */
  rawValue?: string;
  /** Triggers whenever input changes */
  onInput?(value: string): void;
  /** Same as above but with the parsed input */
  onChange?(event: { search?: string; expression?: string; active?: boolean; }): void;
  /** Triggers when 'Enter' key is pressed */
  onEnter?(value: string): void;
  /** See: Field information */
  doc: Doc;
  /** See: Custom inputs */
  customInputs?: CustomInputs;
  /** Input placeholder */
  placeholder?: string;
  /** Element classes */
  class?: string;
}
```

## Field information

Autocomplete and suggestions require the `doc` option to be set. It contains all of the available fields and optionally the operators. Example:

```ts
const doc: Doc = {
  variables: {
    stringField: {
      name: 'stringField',
      kind: 'string',
    },
    /** String field but suggests a predefined list of values */
    selectField: {
      name: 'selectField',
      kind: 'string',
      values: [
        'started',
        'inprogress',
        'finished',
        'failed',
      ],
    },
    /** Field with a custom format defined, which is used for custom inputs */
    timestampField: {
      name: 'timestampField',
      kind: 'string',
      format: 'date',
    },
    boolField: {
      name: 'boolField',
      kind: 'bool',
    },
    intField: {
      name: 'intField',
      kind: 'int',
    },
    jsonField: {
      name: 'jsonField',
      kind: 'struct',
      fields: {
        stringProp: {
          name: 'stringProp',
          kind: 'string',
        },
        boolProp: {
          name: 'boolProp',
          kind: 'bool',
        }
      },
    },
  },
};
```

## Custom fields

Custom components to input values can be rendered to easier input values for fields. Custom components can be defined with the `customInputs` option which contains the following object:

```ts
{ [format: string]: ComponentCreator; }
```

```ts
export type ComponentCreator = (root: HTMLElement, args: ComponentParams) => Component;

export type ComponentParams = {
  value: Token | null | undefined;
  onInput(value: string, kind: string, close?: boolean): void;
  onKeyDown(e: KeyboardEvent): void;
}

export type Component = {
  update(value: Token): void;
  destroy(): void;
  focus(): void;
}
```

When a field doc contains a format field (eg. `myField: { format: 'date' }`), when entering this field (`myField == ...`) the exitor will then show this custom input in the dropdown.

Example:

```ts
import AirDatepicker from 'air-datepicker';
import 'air-datepicker/air-datepicker.css';
import localeEn from 'air-datepicker/locale/en';

const customInputs = {
  date: (node, { value, onInput }) => {
    const date = value ? value.value.replaceAll('"', '') : null;
    const picker = new AirDatepicker(node, {
      inline: true,
      selectedDates: [date],
      locale: localeEn,
      onSelect({ date }) {
        if (Array.isArray(date)) {
          return;
        }
        onInput(`"${date.toISOString()}"`, '', false);
      },
    });
  
    return {
      update(selectedToken) {
        const date = selectedToken ? selectedToken.value.replaceAll('"', '') : null;
        picker.selectDate(date, { silent: true });
      },
      focus() {

      },
      destroy() {
        picker.destroy();
      }
    }
  }
}
```
