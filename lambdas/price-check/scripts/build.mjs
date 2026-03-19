import { execSync } from "node:child_process";

// Build single-file bundle for AWS Lambda (no node_modules in zip).
// Output: dist/index.cjs (CommonJS) so handler can be index.handler

execSync(
  [
    "npx",
    "esbuild",
    "src/index.ts",
    "--bundle",
    "--platform=node",
    "--target=node20",
    "--format=cjs",
    "--outfile=dist/index.cjs",
  ].join(" "),
  { stdio: "inherit" },
);

