import { exec, spawn } from 'child_process';
import * as path from 'path';
import { v5 as uuidv5 } from 'uuid';

// GOOS=js GOARCH=wasm go build -o  ../assets/json.wasm
function build(src, out, onStdout, onStderr) {
  return new Promise((resolve, reject) => {
    const instance = exec(`GOOS=js GOARCH=wasm go build -o ${out} ${src}`);
    // const instance = spawn('go', ['build', '-o', './assets/json.wasm', src], { shell: true, cwd: src, env: { GOOS: 'js', GOARCH: 'wasm' } });

    instance.stdout.on('data', (data) => {
      console.log(`stdout: ${data}`);
    });

    instance.stderr.on('data', (data) => {
      console.error(`stderr: ${data}`);
    });

    instance.on('close', (code) => {
      console.log(`child process exited with code ${code}`);
      resolve(code);
    });
  });
}

const NAMESPACE = '1b671a64-40d5-491e-99b0-da01ff1f3351';
const WASM_OUTPUT_DIR = 'public/wasm';
const WASM_DIR = 'wasm';

function importTemplate({ base, dir, name }) {
  return `
import '/lib/wasm_exec.js';

const go = new Go();
export default async function init() {
    const result = await WebAssembly.instantiateStreaming(fetch("${base}${dir}/${name}"), go.importObject);
    go.run(result.instance);
}
`;
}

export function viteImportGoPlugin(options = { outdir: WASM_OUTPUT_DIR, wasmdir: WASM_DIR }) {
  let projectRoot = '';
  let base = '';
  return {
    name: "go-vite-import",
    configResolved(resolvedConfig) {
      projectRoot = resolvedConfig.root;
      console.log(resolvedConfig);
      base = resolvedConfig.base;
    },
    /**
     * @param {string} src
     * @param {string} id
     */
    async transform(src, id) {
      if (!/^.*\.go$/g.test(id)) {
        return;
      }

      const name = `${path.parse(id).name}-${uuidv5(id, NAMESPACE).slice(0, 8)}.wasm`;
      const dir = path.dirname(id);

      console.log(`building go application... (${id})`);
      await build(dir, path.join(projectRoot, options.outdir, name));

      const code = importTemplate({ base, dir: options.wasmdir, name });
      return { code };
    }
  };
}
