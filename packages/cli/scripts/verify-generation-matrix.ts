/// <reference types="node" />

import { resolve } from 'pathe';

import { GENERATION_MATRIX_ROOT, runGenerationMatrix } from '../src/verification/generation-matrix';

async function main(): Promise<void> {
  const workspaceRoot = resolve(import.meta.dirname, '..', '..', '..');
  const report = await runGenerationMatrix({ workspaceRoot });
  const failures = report.cases.filter(({ status }) => status === 'failed');

  if (report.status === 'failed') {
    console.error(`Generation matrix failed with ${failures.length} issue(s).`);

    for (const failure of failures) {
      console.error(`- ${failure.id}: ${failure.error ?? 'Unknown failure'}`);
    }

    console.error(`Evidence preserved at ${GENERATION_MATRIX_ROOT}.`);
    console.error(`Report: ${GENERATION_MATRIX_ROOT}/verification-report.json`);
    process.exitCode = 1;
    return;
  }

  console.log(`Generation matrix passed ${report.cases.length} cases.`);
  console.log(`Removed ${GENERATION_MATRIX_ROOT}.`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
