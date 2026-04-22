import { defineConfig } from "vite";

export default defineConfig({
  root: "web",
  server: { port: 5173, open: true },
  resolve: {
    extensions: [".ts", ".js"],
  },
});
