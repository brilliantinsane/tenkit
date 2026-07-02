import type {
  GeneratedSetupType,
  PublicSetupSlug,
  VirtualFileTree,
  WriteProjectResult,
} from '@tenkit/template-generator';

import { PROMPT_CANCELLED, type PromptChoice } from '../constants';
import type { PublicCliPackageManager } from './package-manager';

export type PublicCliGitMode = false | 'init' | 'commit' | 'none';

export type CreateCommandOptions = {
  name?: string;
  packageName?: string;
  setup?: string;
  setupType?: string;
  packageManager?: string;
  yes?: boolean;
  install?: boolean;
  git?: PublicCliGitMode;
  dryRun?: boolean;
};

export type PromptAdapter = {
  text(options: {
    message: string;
    placeholder: string;
    defaultValue: string;
    validate(value: string | undefined): string | undefined;
  }): Promise<string | typeof PROMPT_CANCELLED>;
  select(options: {
    message: string;
    initialValue: PublicSetupSlug;
    options: readonly PromptChoice[];
  }): Promise<PublicSetupSlug | typeof PROMPT_CANCELLED>;
  confirm(options: {
    message: string;
    initialValue: boolean;
  }): Promise<boolean | typeof PROMPT_CANCELLED>;
};

export type CommandResult = {
  ok: boolean;
  code: number;
};

export type RunCommandOptions = {
  stdio?: 'inherit' | 'ignore';
};

export type RunCommand = (
  command: string,
  args: readonly string[],
  cwd: string,
  options?: RunCommandOptions,
) => Promise<CommandResult>;

export type CreateFlowOutput = {
  log(message?: string): void;
  error(message: string): void;
};

export type CreateFlowEnvironment = {
  cwd: string;
  workspaceRoot?: string;
  packageRoot?: string;
  isInteractive: boolean;
  isCi: boolean;
  packageManagerUserAgent?: string;
  output: CreateFlowOutput;
  prompts: PromptAdapter;
  runCommand?: RunCommand;
  generate?: (config: {
    setupType: GeneratedSetupType;
    projectName: string;
    packageName: string;
    packageManager?: PublicCliPackageManager;
  }) => VirtualFileTree;
  write?: (options: {
    targetDir: string;
    tree: VirtualFileTree;
    forbiddenTargetRoots: readonly string[];
  }) => Promise<WriteProjectResult>;
};

export type CreateFlowResult = {
  status: 'created' | 'dry-run' | 'cancelled';
  targetDir: string;
  projectName: string;
  packageName: string;
  setupType: GeneratedSetupType;
  packageManager: PublicCliPackageManager;
  installed: boolean;
  installFailed: boolean;
  gitInitialized: boolean;
  gitCommitted: boolean;
  gitSkippedReason?: string;
  gitFailed: boolean;
};

export type ResolvedCreateOptions = {
  projectName: string;
  packageName: string;
  setupType: GeneratedSetupType;
  targetDir: string;
  packageManager: PublicCliPackageManager;
  install: boolean;
  git: PublicCliGitMode | undefined;
  dryRun: boolean;
};
