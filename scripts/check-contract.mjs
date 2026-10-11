import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const manifest = JSON.parse(
  await readFile(
    new URL("../.contract/manifest.json", import.meta.url),
    "utf8",
  ),
);

if (manifest.browser?.version === "unreleased") {
  console.log(
    "Skipping browser compatibility check until the first released browser SDK is recorded.",
  );
  process.exit(0);
}

const executable = fileURLToPath(
  new URL("../node_modules/typescript/bin/tsc", import.meta.url),
);
const result = spawnSync(
  process.execPath,
  [executable, "-p", "tsconfig.contract.json"],
  {
    cwd: new URL("..", import.meta.url),
    stdio: "inherit",
    shell: false,
  },
);

process.exit(result.status ?? 1);
