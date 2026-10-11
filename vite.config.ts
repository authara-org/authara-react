import { fileURLToPath } from "node:url";

import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "");
  const useBuiltPackage = mode === "package";
  return {
    root: "playground",
    resolve: {
      alias: useBuiltPackage
        ? {}
        : {
            "@authara/react": fileURLToPath(
              new URL("./src/index.ts", import.meta.url),
            ),
          },
    },
    server: {
      proxy: {
        "^/auth(?:/|$)": {
          target:
            env.AUTHARA_PLAYGROUND_PROXY_TARGET || "http://localhost:3001",
          changeOrigin: true,
        },
      },
    },
    build: {
      outDir: "../playground-dist",
      emptyOutDir: true,
    },
  };
});
