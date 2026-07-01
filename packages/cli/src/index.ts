#!/usr/bin/env node
import { isDirectCliRun } from './adapters/workspace';
import { main } from './cli';

if (isDirectCliRun(import.meta.url, process.argv[1])) {
  const exitCode = await main();
  process.exitCode = exitCode;
}

export { main } from './cli';
