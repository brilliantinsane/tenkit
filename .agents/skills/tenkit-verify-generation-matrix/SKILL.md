---
name: tenkit-verify-generation-matrix
description: Verify the complete Tenkit generated-project matrix.
---

# Verify Tenkit Generation Matrix

Run the deterministic repository verifier from the Tenkit workspace root:

```bash
pnpm verify:matrix
```

The command owns `/tmp/tenkit-test`. It regenerates the matrix from scratch, compares every generated file with the pure generator tree, exercises package-manager/Git/install policy, and verifies installed projects.

## Green

Require all cases to pass and `/tmp/tenkit-test` to be absent after the command exits.

Report the case count and checks performed. The run is complete only when both conditions hold.

## Red

Read `/tmp/tenkit-test/verification-report.json`, then inspect every failed case directory and its exact file or command discrepancy.

Report the failures and your diagnosis. Ask the user for input before editing repository files or rerunning the matrix. Preserve `/tmp/tenkit-test` while waiting.

After the user directs the fix, apply Tenkit local context and the Template Work Guard where relevant, implement the approved change, and rerun `pnpm verify:matrix`. Repeat the red branch until green. The verifier deletes `/tmp/tenkit-test` only on green.
