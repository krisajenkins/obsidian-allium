import esbuild from "esbuild";
import esbuildSvelte from "esbuild-svelte";
import { renameSync, existsSync } from "fs";
import process from "process";

const prod = process.argv[2] === "production";

// Obsidian auto-loads `<plugin>/styles.css`. esbuild names the emitted CSS after
// the JS outfile (main.css), so rename it after every build. External CSS keeps
// Svelte's scope hashes in a real stylesheet — far more reliable than the
// `injected` runtime <style>, which mis-applied scoped rules across hot-reloads.
const renameCssPlugin = {
  name: "rename-css-to-styles",
  setup(build) {
    build.onEnd(() => {
      if (existsSync("main.css")) renameSync("main.css", "styles.css");
    });
  },
};

const context = await esbuild.context({
  entryPoints: ["src/main.ts"],
  bundle: true,
  external: [
    "obsidian",
    "electron",
    "@codemirror/autocomplete",
    "@codemirror/collab",
    "@codemirror/commands",
    "@codemirror/language",
    "@codemirror/lint",
    "@codemirror/search",
    "@codemirror/state",
    "@codemirror/view",
    "@lezer/common",
    "@lezer/highlight",
    "@lezer/lr",
  ],
  outfile: "main.js",
  format: "cjs",
  target: "es2018",
  logLevel: "info",
  sourcemap: prod ? false : "inline",
  treeShaking: true,
  // Inline the vendored allium parser: `import bytes from "./x.wasm"` yields a
  // Uint8Array baked into main.js — no sidecar files, works on mobile.
  loader: { ".wasm": "binary" },
  plugins: [
    esbuildSvelte({
      compilerOptions: {
        // External CSS (the default): esbuild bundles it to main.css, which the
        // plugin below renames to styles.css for Obsidian to load.
        warningFilter: (warning) => {
          if (warning.code === "state_referenced_locally") return false;
          if (warning.code === "a11y_click_events_have_key_events") return false;
          return true;
        },
      },
    }),
    renameCssPlugin,
  ],
});

if (prod) {
  await context.rebuild();
  process.exit(0);
} else {
  await context.watch();
}
