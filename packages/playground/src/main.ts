import { sql } from "@codemirror/lang-sql";
import { EditorState } from '@codemirror/state';
import { Doc, ExprEditor } from "@happening-oss/expr2sql-editor";
import AirDatepicker from 'air-datepicker';
import 'air-datepicker/air-datepicker.css';
import localeEn from 'air-datepicker/locale/en';
import { EditorView, basicSetup } from "codemirror";

import './index.css';
import load from './main.go';
import mainHtml from './main.html?raw';

document.querySelector('#app').innerHTML = mainHtml;

const outputEditor = new EditorView({
  doc: "",
  extensions: [basicSetup, sql()],
  parent: document.querySelector('#output'),
});

const examples = [
  `intField > 42 and stringField == 'stringValue'`,
  `floatField > 2.71828 or timestampField > '2024-12-01T00:00:00Z'`,
  `intField > intField2 * 2 and boolField1 or boolField2`,
  `jsonField.stringProp == "stringValue" or jsonField.boolProp`,
];

const exampleSelectRef = document.querySelector('#example-select');
exampleSelectRef.innerHTML = `<option value="">Select an example</option>` + examples.map((e, i) => `<option value="${i}">Example #${i}</option>`).join('\n');
exampleSelectRef.addEventListener('change', (e) => {
  const selected = examples[(e.target as HTMLSelectElement).value];
  if (selected) {
    editor.rawValue = selected;
  }
});

const doc: Doc = {
  variables: {
    intField: {
      name: 'intField',
      kind: 'int',
    },
    intField2: {
      name: 'intField2',
      kind: 'int',
    },
    stringField: {
      name: 'stringField',
      kind: 'string',
      values: [
        'initializing',
        'initialized',
        'provisioning',
        'provisioned',
        'active',
        'maintenance',
        'offline',
        'reinstalling',
        'deleting',
        'deleted',
      ]
    },
    floatField: {
      name: 'floatField',
      kind: 'int',
    },
    timestampField: {
      name: 'timestampField',
      kind: 'string',
      format: 'date',
    },
    boolField1: {
      name: 'boolField1',
      kind: 'bool',
    },
    boolField2: {
      name: 'boolField2',
      kind: 'bool',
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
      }
    },
  },
};

const editorRef = document.querySelector('#editor') as HTMLElement;
const editor = new ExprEditor(editorRef, {
  rawValue: 'timestampField > "2024-12-01T00:00:00Z"',
  doc,
  onInput: onInputValue,
  customInputs: {
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
});

const errorRef = document.querySelector('#error');

function onInputValue(value: string) {
  const [output, err] = translate(value);
  outputEditor.setState(EditorState.create({
    doc: output,
    extensions: [basicSetup, sql()],
  }));

  errorRef.innerHTML = err ? `${err}` : '<span class="text-slate-300">None</span>';
}

load().then(() => {
  console.log('[wasm] expr2sql loaded.');
  const [output, err] = translate(`floatField > 2.71828 or timestampField > '2024-12-01T00:00:00Z'`);
  console.log('output', output, err);

  onInputValue('timestampField > "2024-12-01T00:00:00Z"');
});
