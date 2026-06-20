import esbuild from "esbuild";
import esbuildSvelte from "esbuild-svelte";
import process from "process";

const prod = process.argv[2] === "production";

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
        // Inject component CSS into the JS bundle (a runtime <style> on mount)
        // rather than emitting a sidecar main.css. Obsidian only auto-loads a
        // file named styles.css, so an external main.css would never load and
        // our scoped layout styles would silently vanish.
        css: "injected",
        warningFilter: (warning) => {
          if (warning.code === "state_referenced_locally") return false;
          if (warning.code === "a11y_click_events_have_key_events") return false;
          return true;
        },
      },
    }),
  ],
});

if (prod) {
  await context.rebuild();
  process.exit(0);
} else {
  await context.watch();
}
