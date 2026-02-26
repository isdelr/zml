import { defineConfig, globalIgnores } from "eslint/config";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";

export default defineConfig([
  ...nextCoreWebVitals,
  ...nextTypeScript,
  {
    files: [
      "app/**/*.{ts,tsx}",
      "components/**/*.{ts,tsx}",
      "hooks/**/*.{ts,tsx}",
      "lib/**/*.{ts,tsx}",
      "proxy.ts",
    ],
    ignores: ["lib/convex-server/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@/convex/_generated/api",
              message:
                "Import Convex references from '@/lib/convex/api' to keep frontend contracts centralized.",
            },
          ],
          patterns: [
            {
              group: ["**/convex/_generated/api"],
              message:
                "Import Convex references from '@/lib/convex/api' to keep frontend contracts centralized.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["lib/convex/api.ts"],
    rules: {
      "no-restricted-imports": "off",
    },
  },
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
]);
