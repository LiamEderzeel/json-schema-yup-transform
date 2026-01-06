import { defineConfig } from "tsdown";

export default defineConfig({
  format: ["esm"],
  define: {
    "import.meta.env.DEV": "false"
  },
  noExternal: ["debug"],
  plugins: [
    {
      name: "kill-debug",
      setup(build) {
        // 2. Intercept the import and return a "dead" version
        build.onResolve({ filter: /^debug$/ }, () => ({
          path: "debug-stub",
          namespace: "stub"
        }));

        build.onLoad({ filter: /.*/, namespace: "stub" }, () => ({
          contents: "export default () => () => {};",
          loader: "js"
        }));
      }
    }
  ]
});
