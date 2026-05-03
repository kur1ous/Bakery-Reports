import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const config = [
  { ignores: ["apps-script/**"] },
  ...nextVitals,
  ...nextTs
];

export default config;
