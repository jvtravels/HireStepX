import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import path from "path";

const tempoRoot = __dirname;
const projectRoot = path.resolve(tempoRoot, "..");

export default defineConfig(async () => {
  const { tempoAnnotate } = await import("tempo-sdk");

  return {
    root: tempoRoot,
    plugins: [
      tempoAnnotate(),
      react(),
      tsconfigPaths({ projectDiscovery: "lazy" }),
    ],
    resolve: {
      alias: {
        react: path.resolve(tempoRoot, "node_modules/react"),
        "react-dom": path.resolve(tempoRoot, "node_modules/react-dom"),
      },
    },
    publicDir: path.resolve(projectRoot, "public"),
    envDir: projectRoot,
    server: {
      fs: {
        allow: [".."],
      },
    },
  };
});
