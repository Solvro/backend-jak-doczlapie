import { solvro } from "@solvro/config/eslint";

export default solvro({
  rules: {
    "import/no-default-export": "off",
    "@typescript-eslint/no-floating-promises": "off",
  },
});
