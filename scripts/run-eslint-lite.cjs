#!/usr/bin/env node
const path = require("node:path");
const process = require("node:process");

async function run() {
  process.env.ESLINT_USE_FLAT_CONFIG = "false";

  let configPath = null;
  const targets = [];
  const args = process.argv.slice(2);

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "-c" || arg === "--config") {
      configPath = args[i + 1];
      i += 1;
    } else {
      targets.push(arg);
    }
  }

  if (!configPath) {
    throw new Error("Missing -c/--config option");
  }
  if (targets.length === 0) {
    throw new Error("No files provided to lint");
  }

  const { LegacyESLint } = require("eslint/use-at-your-own-risk");
  const eslint = new LegacyESLint({
    overrideConfigFile: path.resolve(configPath),
  });

  const results = await eslint.lintFiles(targets);
  const formatter = await eslint.loadFormatter("stylish");
  const output = formatter.format(results);
  if (output) process.stdout.write(output);

  const hasError = results.some((result) => result.errorCount > 0 || result.fatalErrorCount > 0);
  process.exit(hasError ? 1 : 0);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
