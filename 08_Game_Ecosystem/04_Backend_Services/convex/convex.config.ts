import { defineConfig } from "convex/server";

export default defineConfig({
  functions: {
    http: {
      maxRequestBodySize: 1024 * 1024, // 1MB
    },
  },
});
