import { readReleaseHistory } from './git-release-history';
import { planReleaseSet, type ReleaseSetPlan } from './release-plan';

type PlanReleaseSetFromRepositoryInput = {
  workspaceRoot: string;
  sourceRevision: string;
};

export function planReleaseSetFromRepository(
  input: PlanReleaseSetFromRepositoryInput,
): ReleaseSetPlan {
  return planReleaseSet(readReleaseHistory(input));
}
