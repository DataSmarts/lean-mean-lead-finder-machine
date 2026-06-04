import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier";
import simpleImportSort from "eslint-plugin-simple-import-sort";

/** @type {import("eslint").Linter.Config[]} */
const config = [
  {
    ignores: [".next/**", "coverage/**", "node_modules/**", "build/**", "out/**"],
  },
  ...nextVitals,
  ...nextTs,
  {
    plugins: { "simple-import-sort": simpleImportSort },
    rules: {
      "simple-import-sort/imports": [
        "error",
        {
          groups: [["^node:"], ["^@?\\w"], ["^@/"], ["^\\."]],
        },
      ],
      "simple-import-sort/exports": "error",
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  prettier,
];

export default config;
