import js from "@eslint/js";
import nextVitals from "eslint-config-next/core-web-vitals";
import prettier from "eslint-config-prettier";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";

const webFiles = [
  "apps/web/**/*.{js,jsx,mjs,ts,tsx,mts,cts}",
  "app/**/*.{js,jsx,mjs,ts,tsx,mts,cts}",
];

const ignores = [
  "**/node_modules/**",
  "**/.next/**",
  "**/dist/**",
  "**/out/**",
  "**/coverage/**",
  "**/.turbo/**",
  "**/.cache/**",
  "**/*.tsbuildinfo",
  "apps/docs/**",
];

export default [
  { ignores },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.es2024,
        ...globals.node,
      },
    },
    rules: {
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { fixStyle: "inline-type-imports", prefer: "type-imports" },
      ],
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],
      "no-empty": ["error", { allowEmptyCatch: true }],
      "no-console": ["warn", { allow: ["warn", "error"] }],
      "no-undef": "off",
    },
  },
  ...nextVitals.map((config) => {
    const scoped = { ...config };
    delete scoped.ignores;
    return {
      ...scoped,
      files: webFiles,
      languageOptions: {
        ...scoped.languageOptions,
        globals: {
          ...scoped.languageOptions?.globals,
          ...globals.browser,
        },
      },
      settings: {
        ...scoped.settings,
        next: {
          ...scoped.settings?.next,
          rootDir: "apps/web/",
        },
      },
      rules: {
        ...scoped.rules,
        "@next/next/no-html-link-for-pages": "off",
      },
    };
  }),
  {
    files: ["apps/cli/**/*.{ts,tsx}", "packages/terminal/**/*.{ts,tsx}"],
    plugins: {
      "react-hooks": reactHooks,
    },
    rules: {
      "react-hooks/exhaustive-deps": "warn",
      "react-hooks/rules-of-hooks": "error",
    },
  },
  {
    files: ["**/*.{js,mjs,cjs}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.es2024,
        ...globals.node,
      },
    },
  },
  prettier,
];
