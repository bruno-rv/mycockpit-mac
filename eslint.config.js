// Flat ESLint config (PORT_PLAN 2.4). Deps already installed: `@typescript-eslint/*`,
// `eslint-plugin-import`, `@eslint/js`, `globals`. No React-specific plugin is a dependency
// (no `eslint-plugin-react`/`-react-hooks` in package.json) — ponytail: pragmatic rule set +
// upgrade path, add one if JSX-specific lint (hooks deps, jsx-key) is ever needed.
import js from "@eslint/js";
import tseslint from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import importPlugin from "eslint-plugin-import";
import globals from "globals";

export default [
  {
    ignores: ["out/**", "dist/**", "node_modules/**", "*.icns", "*.png", ".remember/**"],
  },
  js.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
      globals: { ...globals.browser, ...globals.node, ...globals.es2022 },
    },
    plugins: {
      "@typescript-eslint": tseslint,
      import: importPlugin,
    },
    settings: importPlugin.flatConfigs.typescript.settings,
    rules: {
      ...tseslint.configs.recommended.rules,
      ...importPlugin.flatConfigs.recommended.rules,
      // Standard typescript-eslint "eslint-recommended" overrides: these base-ESLint rules
      // don't understand TS-only constructs (a `const X` + `type X` merge for a namespaced
      // export, ambient `process`/`window` typings) and produce false positives on valid TS.
      "no-redeclare": "off",
      "no-undef": "off",
      // tsc (`npm run type-check`) already validates every import resolves — including the
      // `@renderer/*` / `@main/*` / `@shared/*` / `@glaze/core/*` path aliases. The import
      // plugin here has no TS-aware resolver installed, so it can't see those aliases and
      // would false-positive on every one of them.
      "import/no-unresolved": "off",
      "import/namespace": "off",
      // `class-variance-authority`'s `VariantProps` type export confuses the plugin's static
      // (non-type-aware) named-export detection; tsc already validates these imports.
      "import/named": "off",
      // Underscore-prefixed args/vars are an intentional "unused, but named for clarity"
      // convention already used throughout the vendored Glaze components (e.g. `_minSize`).
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "no-unused-vars": "off",
    },
  },
  {
    files: ["scripts/**/*.mjs"],
    languageOptions: {
      sourceType: "module",
      globals: { ...globals.node },
    },
  },
];
