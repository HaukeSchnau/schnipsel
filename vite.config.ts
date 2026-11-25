import { defineConfig } from "vite-plus";

export default defineConfig({
  fmt: {
    ignorePatterns: [
      // Vendored as upstream wrote it, so the next re-vendor is a plain copy.
      "tools/oxlint/anti-slop/**",
    ],
    sortPackageJson: {},
  },
  lint: {
    ignorePatterns: [
      // Calder's own TypeScript project, with a tsconfig package the workspace doesn't install.
      ".calder",
      // Vendored as upstream wrote it; upstream lints and tests it.
      "tools/oxlint/anti-slop",
    ],
    plugins: ["eslint", "oxc", "react", "typescript", "unicorn"],
    jsPlugins: [
      { name: "vite-plus", specifier: "vite-plus/oxlint-plugin" },
      { name: "anti-slop", specifier: "./tools/oxlint/anti-slop/index.ts" },
    ],
    categories: {
      correctness: "error",
      perf: "error",
      suspicious: "error",
    },
    rules: {
      "vite-plus/prefer-vite-plus-imports": "error",

      "eslint/eqeqeq": "error",
      "react/rules-of-hooks": "error",
      "typescript/consistent-type-imports": "error",
      "typescript/no-explicit-any": "error",
      "typescript/no-non-null-assertion": "error",
      "unicorn/prefer-node-protocol": "error",

      "oxc/no-accumulating-spread": "error",
      "anti-slop/no-array-filter-map": "error",
      "anti-slop/no-chained-type-assertions": "error",
      "anti-slop/no-conditional-empty-object-spread": "error",
      "anti-slop/no-known-value-widening": "error",
      "anti-slop/no-module-mocking": "error",
      "anti-slop/no-object-parameters": "error",
      "anti-slop/no-reduce-accumulator-copy": "error",
      "anti-slop/no-reflect-apply": "error",
      "anti-slop/no-reflect-get": "error",
      "anti-slop/no-runtime-typeof": "error",
      "anti-slop/no-shape-in-symbol-names": "error",
      "anti-slop/no-unknown-parameters": "error",
      "anti-slop/no-unknown-returns": "error",
      "anti-slop/no-unknown-type-aliases": "error",
      "anti-slop/no-unsafe-dictionary-type": "error",
      "anti-slop/no-widen-then-assert": "error",
      "anti-slop/require-readable-spacing": "error",
      "anti-slop/require-safety-comment-for-type-assertion": "error",

      // It asks a function that returns a value on one path to return one on all, which React's
      // effect callbacks don't; `noImplicitReturns` covers missing returns. 2 findings.
      // https://oxc.rs/docs/guide/usage/linter/rules/typescript/consistent-return.html
      "typescript/consistent-return": "off",

      // Imports and swatches go one photo at a time, which keeps one decoded image in memory on
      // the phone. 4 findings.
      // https://oxc.rs/docs/guide/usage/linter/rules/eslint/no-await-in-loop.html
      "eslint/no-await-in-loop": "off",

      // It pushes toward `toSorted`, which Hermes lacks. 3 findings.
      // https://oxc.rs/docs/guide/usage/linter/rules/unicorn/no-array-sort.html
      "unicorn/no-array-sort": "off",

      // The editor restores the saved draft in an effect on mount, and the picker clears its list
      // when the range changes before it loads the next page. 2 findings.
      // https://oxc.rs/docs/guide/usage/linter/rules/react/set-state-in-effect.html
      "react/set-state-in-effect": "off",

      // Gesture Handler builds with capitalized factories (`Gesture.Pan()`), which it takes for a
      // component called as a function. 1 finding.
      // https://oxc.rs/docs/guide/usage/linter/rules/react/capitalized-calls.html
      "react/capitalized-calls": "off",

      // React Native styles are objects or arrays of them. 2 findings.
      // https://oxc.rs/docs/guide/usage/linter/rules/react/style-prop-object.html
      "react/style-prop-object": "off",

      // The automatic JSX runtime needs no React import. 107 findings.
      // https://oxc.rs/docs/guide/usage/linter/rules/react/react-in-jsx-scope.html
      "react/react-in-jsx-scope": "off",
    },
    options: {
      typeAware: true,
      typeCheck: true,
    },
  },
});
