import fs from 'fs-extra';
import { generateProject, preflightWriteProject, writeProject } from '@tenkit/template-generator';

import { defaultRunCommand } from '../adapters/command-runner';
import { prepareInitialGitSetup } from '../adapters/git';
import { logFinalOutput } from './create-messages';
import { resolveCreateOptions } from './resolve-create-options';
import type { CreateCommandOptions, CreateFlowEnvironment, CreateFlowResult } from './types';

export async function runCreateFlow(
  options: CreateCommandOptions,
  env: CreateFlowEnvironment,
): Promise<CreateFlowResult> {
  const resolvedOptions = await resolveCreateOptions(options, env);
  const runCommand = env.runCommand ?? defaultRunCommand;
  const generate = env.generate ?? generateProject;
  const write =
    env.write ??
    ((writeOptions) =>
      writeProject({
        ...writeOptions,
        overwrite: 'never',
      }));

  const tree = generate({
    setupType: resolvedOptions.setupType,
    stylingChoice: resolvedOptions.stylingChoice,
    accent: resolvedOptions.accent,
    projectName: resolvedOptions.projectName,
    packageName: resolvedOptions.packageName,
    packageManager: resolvedOptions.packageManager,
  });

  if (resolvedOptions.dryRun) {
    await preflightWriteProject({
      targetDir: resolvedOptions.targetDir,
      tree,
      overwrite: 'never',
      forbiddenTargetRoots: env.workspaceRoot ? [env.workspaceRoot] : [],
    });

    const result: CreateFlowResult = {
      status: 'dry-run',
      targetDir: resolvedOptions.targetDir,
      projectName: resolvedOptions.projectName,
      packageName: resolvedOptions.packageName,
      setupType: resolvedOptions.setupType,
      stylingChoice: resolvedOptions.stylingChoice,
      accent: resolvedOptions.accent,
      packageManager: resolvedOptions.packageManager,
      installed: false,
      installFailed: false,
      gitInitialized: false,
      gitCommitted: false,
      gitSkippedReason: 'dry-run',
      gitFailed: false,
    };

    logFinalOutput(result, env.output);
    return result;
  }

  const gitProbeCwd = (await fs.pathExists(resolvedOptions.targetDir))
    ? resolvedOptions.targetDir
    : env.cwd;
  const gitSetup = await prepareInitialGitSetup({
    explicitGitMode: resolvedOptions.git,
    env,
    runCommand,
    probeDir: gitProbeCwd,
  });
  const writeResult = await write({
    targetDir: resolvedOptions.targetDir,
    tree,
    forbiddenTargetRoots: env.workspaceRoot ? [env.workspaceRoot] : [],
  });
  let installed = false;
  let installFailed = false;

  if (resolvedOptions.install) {
    env.output.log(`Installing dependencies with ${resolvedOptions.packageManager}...`);
    const installResult = await runCommand(
      resolvedOptions.packageManager,
      ['install'],
      writeResult.targetDir,
      { stdio: 'ignore' },
    );
    installed = installResult.ok;
    installFailed = !installResult.ok;
  }

  const gitResult = await gitSetup.run(writeResult.targetDir);

  const result: CreateFlowResult = {
    status: 'created',
    targetDir: writeResult.targetDir,
    projectName: resolvedOptions.projectName,
    packageName: resolvedOptions.packageName,
    setupType: resolvedOptions.setupType,
    stylingChoice: resolvedOptions.stylingChoice,
    accent: resolvedOptions.accent,
    packageManager: resolvedOptions.packageManager,
    installed,
    installFailed,
    gitInitialized: gitResult.gitInitialized,
    gitCommitted: gitResult.gitCommitted,
    gitSkippedReason: gitResult.gitSkippedReason,
    gitFailed: gitResult.gitFailed,
  };

  logFinalOutput(result, env.output);
  return result;
}
