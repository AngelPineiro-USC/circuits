import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { execSync } from "node:child_process";

function gitSha(): string {
  try {
    return execSync("git rev-parse --short HEAD").toString().trim();
  } catch {
    return "dev";
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // GitHub Pages for project site: https://<user>.github.io/<repo>/
  base: "/circuits/",
  define: {
    "import.meta.env.VITE_BUILD_ID": JSON.stringify(gitSha()),
  },
});
