import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // DECISIONS D-11: localStorage·navigator 값은 하이드레이션 뒤(마운트 effect)에서만 읽어야 해서
    // "effect 안 setState" 패턴을 의도적으로 쓴다. 오류 대신 경고로 둔다.
    rules: { "react-hooks/set-state-in-effect": "warn" },
  },
  globalIgnores(["scripts/**", ".local-blob/**"]),
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
