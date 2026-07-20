import { readReleaseHistory } from './git-release-history';
import { planReleaseSet, type ReleaseSetPlan } from './release-plan';
import { RELEASE_SET_PACKAGES } from './release-set';

type PlanReleaseSetFromRepositoryInput = {
  workspaceRoot: string;
  sourceRevision: string;
  isPackageVersionOccupied(packageName: string, version: string): Promise<boolean>;
};

export async function planReleaseSetFromRepository(
  input: PlanReleaseSetFromRepositoryInput,
): Promise<ReleaseSetPlan> {
  const history = readReleaseHistory(input);
  const occupiedVersions: string[] = [];

  while (true) {
    const plan = planReleaseSet({
      ...history,
      occupiedVersions,
    });

    if (plan.kind === 'no-release') {
      return plan;
    }

    let versionIsOccupied = false;

    for (const releasePackage of RELEASE_SET_PACKAGES) {
      if (await input.isPackageVersionOccupied(releasePackage.name, plan.version)) {
        versionIsOccupied = true;
        break;
      }
    }

    if (!versionIsOccupied) {
      return plan;
    }

    occupiedVersions.push(plan.version);
  }
}
