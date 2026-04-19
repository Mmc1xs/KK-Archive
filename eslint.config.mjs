import nextVitals from "eslint-config-next/core-web-vitals";

export default [
  {
    ignores: [
      "**/node_modules/**",
      "**/.next/**",
      "**/dist/**",
      "**/out/**",
      "archive/**",
      "db image/**",
      "generated/**",
      "public/tool-static/**",
      "scripts/reports/**",
      "eslint.config.mjs",
      "tmp-*.js",
      "*.log"
    ]
  },
  ...nextVitals,
  {
    rules: {
      "react-hooks/set-state-in-effect": "off"
    }
  }
];
