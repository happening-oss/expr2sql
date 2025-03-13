/// <reference types="vitest" />
import { defineConfig } from 'vite'
import solid from 'vite-plugin-solid'

export default defineConfig({
  plugins: [solid()],
  test: {
    coverage: {
      provider: 'istanbul' // or 'v8'
    },
  },
})
