import { readReleaseHistory } from './git-release-history';
import { planReleaseSet, type ReleaseChannel, type ReleaseSetPlan } from './release-plan';

type PlanReleaseSetFromRepositoryInput = {
  channel: ReleaseChannel;
  workspaceRoot: string;
  sourceRevision: string;
};

export function planReleaseSetFromRepository(
  input: PlanReleaseSetFromRepositoryInput,
): ReleaseSetPlan {
  return planReleaseSet({
    channel: input.channel,
    ...readReleaseHistory({
      ...input,
      channel: input.channel,
    }),
  });
}
