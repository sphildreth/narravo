// SPDX-License-Identifier: Apache-2.0
// ESLint flat config for the narravo workspace (`pnpm lint`).
//
// Two ecosystem constraints worth knowing before editing this file:
//   * ESLint stays on the 9.x line. eslint-config-next pulls eslint-plugin-react
//     and eslint-plugin-jsx-a11y, whose peer ranges stop at ^9 (ESLint 10 removed
//     `context.getFilename`, which crashes eslint-plugin-react@7 on load).
//   * TypeScript stays on the 6.x line. typescript-eslint hard-errors on the
//     TypeScript 7 native API, so `eslint-config-next/typescript` cannot run
//     against TS 7 until typescript-eslint ships TS >=7.1 support.
//
// `pnpm lint` runs with --max-warnings=0 and is a gate in scripts/do-prechecks.py,
// so a warning is a build failure. Prefer fixing code over adding overrides; every
// override below states why the code is intentionally exempt.

import coreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";

const ignored = [
  ".next/**",
  "coverage/**",
  "dist/**",
  "node_modules/**",
  "out/**",
  "playwright-report/**",
  "public/**",
  // Generated or vendored: not authored here.
  "drizzle/migrations/**",
  "next-env.d.ts",
  "src/version.ts",
];

const config = [
  { ignores: ignored },
  ...coreWebVitals,
  ...nextTypeScript,
  {
    rules: {
      // The pre-existing code base has ~780 `any` usages (mostly Drizzle row casts
      // and test doubles). Retiring it is a cleanup of its own; new code should
      // still avoid `any`.
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          args: "after-used",
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrors: "all",
          caughtErrorsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
          ignoreRestSiblings: true,
        },
      ],
      // `let handle; ...; handle = create(...)` with reads from earlier closures
      // (timers, sockets) is deliberate; forcing `const` would move resource
      // creation earlier than the surrounding setup.
      "prefer-const": ["error", { ignoreReadBeforeAssign: true }],
    },
  },
  {
    // DOMPurify needs a jsdom window, but only on the server. A static import would
    // pull jsdom into the client bundle, so these modules keep a lazy require().
    files: ["src/lib/sanitize.ts", "tests/helpers/normalizeHtml.ts"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  {
    // STAGED ADOPTION (tech debt): these components render remote user-supplied or
    // Gravatar images (`<img>`). Moving them to next/image first requires an
    // `images.remotePatterns` policy, because the optimizer proxies those URLs.
    files: [
      "src/app/\\(public\\)/\\[slug\\]/page.tsx",
      "src/components/ArticleCard.tsx",
      "src/components/Banner.tsx",
      "src/components/ImageLightbox.tsx",
      "src/components/admin/appearance/AppearanceManager.tsx",
      "src/components/admin/posts/PostForm.tsx",
      "src/components/admin/users/UsersManager.tsx",
      "src/components/auth/UserMenu.tsx",
      "src/components/comments/CommentNode.tsx",
    ],
    rules: {
      "@next/next/no-img-element": "off",
    },
  },
  {
    // STAGED ADOPTION (tech debt): the post page measures its own server render cost
    // with performance.now(), which is impure by React's rules but runs on the server
    // only, before any component output exists.
    files: ["src/app/\\(public\\)/\\[slug\\]/page.tsx"],
    rules: {
      "react-hooks/purity": "off",
    },
  },
  {
    // STAGED ADOPTION (tech debt): components that sync external state (theme
    // attribute, portal mount, Server-Timing entries, upload preview) with setState
    // inside an effect. React's compiler rules want useSyncExternalStore or
    // event-driven resets here; each change alters rendering, so they are scheduled
    // separately from this dependency refresh.
    files: [
      "src/components/CodeBlock.tsx",
      "src/components/ImageLightbox.tsx",
      "src/components/RenderTimeBadge.tsx",
      "src/components/admin/posts/PostForm.tsx",
    ],
    rules: {
      "react-hooks/set-state-in-effect": "off",
    },
  },
  {
    // STAGED ADOPTION (tech debt): TiptapEditor declares EditorToolbar and
    // ImageBubbleMenu during render, reads/writes refs in the render body and builds
    // its upload session id with Date.now()/Math.random(). Hoisting those components
    // and moving id generation to useId() touches the editor's initialisation order,
    // which is covered by Playwright specs that are currently skipped; do it as its
    // own change with those specs enabled.
    files: ["src/components/editor/TiptapEditor.tsx"],
    rules: {
      "react-hooks/exhaustive-deps": "off",
      "react-hooks/immutability": "off",
      "react-hooks/purity": "off",
      "react-hooks/refs": "off",
      "react-hooks/rules-of-hooks": "off",
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/static-components": "off",
    },
  },
  {
    // Operational scripts run outside the browser and may log freely.
    files: ["scripts/**/*.ts"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
      "no-console": "off",
    },
  },
  {
    // Tests assert on thrown values, stub globals and use `any` for test doubles.
    files: ["tests/**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/ban-ts-comment": "off",
      "no-console": "off",
    },
  },
];

export default config;
