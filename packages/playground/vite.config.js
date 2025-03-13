import { defineConfig } from 'vite';
import { viteImportGoPlugin } from './lib/vite-import-go-plugin';
import tailwindcss from "tailwindcss";
import tailwind from "tailwindcss";
import autoprefixer from "autoprefixer";

export default defineConfig({
	plugins: [viteImportGoPlugin()],
  css: {
    postcss: {
      plugins: [tailwindcss()],
    },
  }
});
