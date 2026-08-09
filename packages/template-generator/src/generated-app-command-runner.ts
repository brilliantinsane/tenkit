import { execFile } from 'node:child_process';

import { basename } from 'pathe';

const DEFAULT_TIMEOUT_MS = 2 * 60 * 1000;
const MAX_DIAGNOSTIC_CHARACTERS = 4_000;
const GENERATED_APP_COMMAND_HOST_ENVIRONMENT_ALLOWLIST = [
  'ComSpec',
  'HOME',
  'PATH',
  'PATHEXT',
  'SystemRoot',
  'TEMP',
  'TMP',
  'TMPDIR',
  'USERPROFILE',
] as const;

export type GeneratedAppCommandOptions = {
  env: Readonly<Record<string, string>>;
  timeoutMs?: number;
};

export type GeneratedAppCommandResult = {
  command: string;
  args: readonly string[];
  durationMs: number;
  status: 'passed' | 'failed' | 'timed-out';
  exitCode?: number;
  signal?: string;
  diagnostics?: string;
};

export function createGeneratedAppCommandEnvironment(
  additionalEnvironment: Readonly<Record<string, string>> = {},
): Record<string, string> {
  const environment: Record<string, string> = {};

  for (const key of GENERATED_APP_COMMAND_HOST_ENVIRONMENT_ALLOWLIST) {
    const value = process.env[key];

    if (value !== undefined) {
      environment[key] = value;
    }
  }

  return { ...environment, ...additionalEnvironment };
}

function replaceAllLiteral(source: string, value: string, replacement: string): string {
  return value.length > 0 ? source.split(value).join(replacement) : source;
}

export function sanitizeGeneratedAppCommandText(
  source: string,
  cwd: string,
  environment: Readonly<Record<string, string>>,
): string {
  let sanitized = replaceAllLiteral(source, cwd, '<generated-project>');

  for (const environmentValue of Object.values(environment).sort(
    (left, right) => right.length - left.length,
  )) {
    sanitized = replaceAllLiteral(sanitized, environmentValue, '<redacted>');
  }

  sanitized = sanitized
    .replace(/\bBearer\s+\S+/gi, 'Bearer <redacted>')
    .replace(
      /\b(authorization|cookie|password|secret|token|api[_-]?key)\s*[:=]\s*\S+/gi,
      '$1=<redacted>',
    )
    .replace(/\b[A-Za-z]:\\[^\s'"`]+/g, '<absolute-path>')
    .replace(/(?<![:/\w])\/(?:[^/\s:'"`]+\/)*[^/\s:'"`]+/g, '<absolute-path>');

  return sanitized.length > MAX_DIAGNOSTIC_CHARACTERS
    ? sanitized.slice(-MAX_DIAGNOSTIC_CHARACTERS)
    : sanitized;
}

export async function runGeneratedAppCommand(
  cwd: string,
  command: string,
  args: string[],
  options: GeneratedAppCommandOptions,
): Promise<GeneratedAppCommandResult> {
  const startedAt = performance.now();
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  return new Promise((resolve) => {
    execFile(
      command,
      args,
      {
        cwd,
        encoding: 'utf8',
        env: { ...options.env },
        maxBuffer: 10 * 1024 * 1024,
        timeout: timeoutMs,
      },
      (error, stdout, stderr) => {
        const durationMs = Math.max(0, Math.round(performance.now() - startedAt));
        const safeCommand = sanitizeGeneratedAppCommandText(basename(command), cwd, options.env);
        const safeArgs = args.map((arg) => sanitizeGeneratedAppCommandText(arg, cwd, options.env));

        if (!error) {
          resolve({
            args: safeArgs,
            command: safeCommand,
            durationMs,
            status: 'passed',
          });
          return;
        }

        const exitCode = typeof error.code === 'number' ? error.code : undefined;
        const signal = typeof error.signal === 'string' ? error.signal : undefined;
        const timedOut = error.killed === true && signal !== undefined;
        const diagnosticText = [stdout, stderr]
          .filter((entry): entry is string => typeof entry === 'string' && entry.length > 0)
          .join('\n');
        const diagnostics = sanitizeGeneratedAppCommandText(
          diagnosticText,
          cwd,
          options.env,
        ).trim();

        resolve({
          args: safeArgs,
          command: safeCommand,
          durationMs,
          status: timedOut ? 'timed-out' : 'failed',
          ...(exitCode === undefined ? {} : { exitCode }),
          ...(signal === undefined ? {} : { signal }),
          ...(diagnostics.length === 0 ? {} : { diagnostics }),
        });
      },
    );
  });
}
