import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "scripts/**",
    "*.js",
    "*.cjs",
    // Dev tooling (CJS bootstrap, not part of the application bundle)
    ".claude/**",
    // Vendored/minified third-party bundles — not source code
    "public/**",
  ]),
  // Relax rules for existing codebase
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "react/no-unescaped-entities": "off",
      "prefer-const": "warn",
      // React Compiler rules — too strict for existing code
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/purity": "off",
      "react-hooks/immutability": "off",
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/static-components": "warn",
      "react-hooks/preserve-manual-memoization": "warn",
      "react-hooks/unsupported-syntax": "warn",
      "react-hooks/globals": "warn",
      "react-hooks/component-hook-factories": "warn",
      "react-hooks/error-boundaries": "warn",
      "react-hooks/config": "warn",
      "react-hooks/gating": "warn",
      "react-hooks/incompatible-library": "warn",
      "react-hooks/use-memo": "warn",
    },
  },
]);

export default eslintConfig;
