import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    rules: {
      // Style
      "quotes": ["error", "double"],
      "semi": ["error", "always"],
      "indent": ["error", 2],
      "comma-dangle": ["error", "always-multiline"],
      "object-curly-spacing": ["error", "always"],
      "arrow-parens": ["error", "always"],

      // Quality
      "no-console": ["warn", { allow: ["warn", "error"] }],
      "no-unused-vars": "off", // use TS version below
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "prefer-const": "error",
      "eqeqeq": ["error", "always"],
      "no-var": "error",
    },
  },
]);

export default eslintConfig;
