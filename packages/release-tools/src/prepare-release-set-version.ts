import { injectReleaseSetVersion } from './inject-release-set-version';
import { planReleaseSetFromRepository } from './plan-release-set-from-repository';
import type { ReleaseSetPlan } from './release-plan';

type PrepareReleaseSetVersionInput = {
  workspaceRoot: string;
  isolatedWorkspaceRoot: string;
  sourceRevision: string;
  isPackageVersionOccupied(packageName: string, version: string): Promise<boolean>;
};

type PlannedReleaseSet = Extract<ReleaseSetPlan, { kind: 'release' }>;

export async function prepareReleaseSetVersion(
  input: PrepareReleaseSetVersionInput,
): Promise<PlannedReleaseSet> {
  const plan = await planReleaseSetFromRepository(input);

  if (plan.kind === 'no-release') {
    throw new Error(
      `Source ${plan.sourceSha} has no release-relevant changes after ${plan.previousStableTag.name}.`,
    );
  }

  await injectReleaseSetVersion({
    isolatedWorkspaceRoot: input.isolatedWorkspaceRoot,
    plan,
  });

  return plan;
}
