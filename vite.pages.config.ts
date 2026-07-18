import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  root: resolve(__dirname, "static"),
  base: "/ielts-speaking-studio/",
  publicDir: resolve(__dirname, "public"),
  plugins: [react()],
  resolve: {
    alias: {
      "@": resolve(__dirname),
      "next/image": resolve(__dirname, "static/NextImage.tsx"),
    },
  },
  build: {
    outDir: resolve(__dirname, "gh-pages-dist"),
    emptyOutDir: true,
  },
});
