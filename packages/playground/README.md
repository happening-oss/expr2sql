# vite-import-go

Import go files in Vite applications. Have them typed with Typescript.

## Summary

`vite.config.js`

```js
import { defineConfig } from 'vite';
import { viteImportGoPlugin } from './lib/vite-import-go-plugin';

export default defineConfig({
	plugins: [viteImportGoPlugin()],
});
```

`src/main.go`

```go
package main

import (
	"syscall/js"
)

var count int = 0

func add() int {
	count++
	return count
}

func main() {
	js.Global().Set("add", js.FuncOf(func(t js.Value, args []js.Value) any {
		return add()
	}))

	<-make(chan struct{})
}
```

`src/main.go.d.ts`

```ts
declare function add(): number;
```

`main.js`

```js
import load from './main.go';

load().then(() => {
    add(); // now available as window.add
});
```

## Project

- `lib/` - library code and plugin
- `src/` - client code
- `.wasm/` - built go applications

## Setup

Javascript glue

```
cp "$(go env GOROOT)/misc/wasm/wasm_exec.js" ./assets/wasm_exec.js
```

Building

```
GOOS=js GOARCH=wasm go build -o  ../assets/json.wasm
```