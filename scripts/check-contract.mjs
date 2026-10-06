import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";

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

const executable = process.platform === "win32" ? "tsc.cmd" : "tsc";
const result = spawnSync(executable, ["-p", "tsconfig.contract.json"], {
  cwd: new URL("..", import.meta.url),
  stdio: "inherit",
  shell: false,
});

process.exit(result.status ?? 1);
