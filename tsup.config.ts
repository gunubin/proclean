import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/cli.tsx"],
  format: ["esm"],
  target: "node18",
  outDir: "dist",
  clean: true,
  banner: {
    js: "#!/usr/bin/env node",
  },
  // Ink/React must be external to avoid dual-instance issues
  external: ["react", "ink", "@inkjs/ui"],
  env: {
    NODE_ENV: "production",
  },
  esbuildOptions(options) {
    options.jsx = "automatic";
  },
});
