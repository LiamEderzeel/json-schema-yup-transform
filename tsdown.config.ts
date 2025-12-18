import { defineConfig } from "tsdown";

export default defineConfig({
  format: ["esm"],
  define: {
    "import.meta.env.DEV": "false"
  }
});
