// SPDX-License-Identifier: Apache-2.0
import next from "eslint-config-next";
import nextTypeScript from "eslint-config-next/typescript";

export default [
  ...next,
  ...nextTypeScript,
  {
    ignores: [
      ".next/**",
      "coverage/**",
      "dist/**",
      "node_modules/**",
      "out/**",
      "public/**",
      "drizzle/migrations/**",
      "src/version.ts",
      "next-env.d.ts",
    ],
  },
];
