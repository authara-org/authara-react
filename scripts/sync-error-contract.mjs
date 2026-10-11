#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import prettier from "prettier";
import YAML from "yaml";

function argument(name, fallback) {
  const index = process.argv.indexOf(name);
  return index === -1 ? fallback : process.argv[index + 1];
}

const openapiPath = path.resolve(
  process.cwd(),
  argument("--openapi", "../../../authara-core/contract/openapi.yaml"),
);
const outputPath = path.resolve(
  process.cwd(),
  argument("--out", "src/generated-error-codes.ts"),
);
const checkOnly = process.argv.includes("--check");

const document = YAML.parse(await readFile(openapiPath, "utf8"));
const operations = new Map();

for (const item of Object.values(document.paths ?? {})) {
  for (const method of ["get", "post", "put", "patch", "delete"]) {
    const operation = item?.[method];
    if (operation?.operationId)
      operations.set(operation.operationId, operation);
  }
}

const providers = [...operations.keys()]
  .map((operationId) => /^get(.+)LoginOptions$/.exec(operationId)?.[1])
  .filter(Boolean)
  .sort();
if (providers.length === 0) {
  throw new Error("The OpenAPI contract declares no provider login options");
}

const optionsOperations = providers.map(
  (provider) => `get${provider}LoginOptions`,
);
const actionOperations = {
  login: [
    ...optionsOperations,
    ...providers.map((provider) => `loginWith${provider}`),
  ],
  link: [
    ...optionsOperations,
    ...providers.map((provider) => `linkCurrentUser${provider}`),
  ],
  reauthenticate: [
    ...optionsOperations,
    ...providers.map((provider) => `reauthenticateWith${provider}`),
  ],
  recover: [
    ...optionsOperations,
    ...providers.map(
      (provider) => `completeAccountRecoveryLinkWith${provider}`,
    ),
  ],
};

function errorCodesFor(operationId) {
  const operation = operations.get(operationId);
  if (!operation)
    throw new Error(`OpenAPI operation ${operationId} is missing`);

  const declared = operation["x-authara-error-codes"];
  if (!declared || typeof declared !== "object") {
    throw new Error(`${operationId} has no x-authara-error-codes`);
  }

  const codes = Object.values(declared).flat();
  if (!codes.every((code) => typeof code === "string" && code.length > 0)) {
    throw new Error(`${operationId} contains an invalid Authara error code`);
  }
  return codes;
}

const actionErrorCodes = Object.fromEntries(
  Object.entries(actionOperations).map(([action, operationIds]) => [
    action,
    [...new Set(operationIds.flatMap(errorCodesFor))].sort(),
  ]),
);

const source = await prettier.format(
  `// Code generated from authara-core/contract/openapi.yaml; DO NOT EDIT.

export const autharaActionErrorCodes = ${JSON.stringify(actionErrorCodes, null, 2)} as const;

export type AutharaContractAction = keyof typeof autharaActionErrorCodes;

export type AutharaContractErrorCode<
  Action extends AutharaContractAction,
> = (typeof autharaActionErrorCodes)[Action][number];
`,
  { parser: "typescript" },
);

if (checkOnly) {
  const existing = await readFile(outputPath, "utf8");
  if (existing !== source) {
    console.error(
      `${path.relative(process.cwd(), outputPath)} is out of date; run npm run sync:error-contract.`,
    );
    process.exit(1);
  }
} else {
  await writeFile(outputPath, source);
}
