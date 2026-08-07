import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import AutoImport from "unplugin-auto-import/vite";
import IconsResolver from "unplugin-icons/resolver";
import Icons from "unplugin-icons/vite";
import { defineConfig } from "vite";
import viteCompression from "vite-plugin-compression";

export default defineConfig({
  plugins: [
    AutoImport({
      dts: "src/types/auto-imports.d.ts",
      imports: [
        "react",
        "react-router-dom",
        {
          "react-router-dom": ["BrowserRouter"],
          "motion/react": ["AnimatePresence", "motion", "useReducedMotion"]
        }
      ],
      resolvers: [
        IconsResolver({
          prefix: "Icon",
          enabledCollections: ["lucide"],
          extension: "jsx"
        })
      ]
    }),
    Icons({ compiler: "jsx", jsx: "react" }),
    react(),
    tailwindcss(),
    viteCompression({
      algorithm: "gzip",
      ext: ".gz",
      verbose: false,
      threshold: 10240,
      filter: /\.(js|mjs|css|html|svg|json|txt|wasm)$/i
    })
  ],
  server: {
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true
      }
    }
  },
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          const normalized = id.replace(/\\/g, "/");
          if (normalized.includes("/node_modules/@duckdb/")) return "vendor-duckdb";
          if (normalized.includes("/node_modules/echarts/")) return "vendor-echarts";
          if (normalized.includes("/node_modules/react") || normalized.includes("/node_modules/react-dom") || normalized.includes("/node_modules/react-router")) return "vendor-react";
          if (normalized.includes("/node_modules/radix-ui") || normalized.includes("/node_modules/@radix-ui")) return "vendor-radix";
          if (normalized.includes("/node_modules/motion")) return "vendor-motion";
          return undefined;
        }
      }
    }
  },
  resolve: {
    alias: {
      "@": new URL("./src", import.meta.url).pathname
    }
  }
});
