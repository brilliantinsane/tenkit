import { spawn, type ChildProcess } from 'node:child_process';
import nodeProcess from 'node:process';

import { basename } from 'pathe';

import { sanitizeGeneratedAppCommandText } from './generated-app-command-runner';

const MAX_CAPTURED_OUTPUT_CHARACTERS = 16_000;

type ProcessExit = {
  exitCode?: number;
  signal?: string;
};

export type GeneratedAppProcessStartEvidence = ProcessExit & {
  command: string;
  args: readonly string[];
  durationMs: number;
  status: 'passed' | 'failed' | 'timed-out';
  diagnostics?: string;
};

export type GeneratedAppProcessShutdownEvidence = {
  durationMs: number;
  status: 'passed' | 'failed';
  forced: boolean;
  leaked: boolean;
  descendantsTerminated: boolean;
};

export type GeneratedAppProcess = {
  startEvidence: GeneratedAppProcessStartEvidence;
  shutdown: () => Promise<GeneratedAppProcessShutdownEvidence>;
};

export type StartGeneratedAppProcessOptions = {
  env: Readonly<Record<string, string>>;
  readinessUrl: string;
  readinessTimeoutMs: number;
  shutdownTimeoutMs: number;
};

function delay(durationMs: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, durationMs));
}

function sendSignalToProcessTree(child: ChildProcess, signal: NodeJS.Signals): void {
  if (child.pid === undefined) {
    return;
  }

  try {
    if (nodeProcess.platform !== 'win32') {
      nodeProcess.kill(-child.pid, signal);
      return;
    }
  } catch {
    // The process may have exited between the state check and signal delivery.
  }

  try {
    child.kill(signal);
  } catch {
    // The process is already gone.
  }
}

function isProcessTreeRunning(child: ChildProcess): boolean {
  if (child.pid === undefined) {
    return false;
  }

  if (nodeProcess.platform === 'win32') {
    return child.exitCode === null && child.signalCode === null;
  }

  try {
    nodeProcess.kill(-child.pid, 0);
    return true;
  } catch (error) {
    return !(
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'ESRCH'
    );
  }
}

async function waitForProcessTreeExit(child: ChildProcess, timeoutMs: number): Promise<boolean> {
  const deadline = performance.now() + timeoutMs;

  while (performance.now() < deadline) {
    if (!isProcessTreeRunning(child)) {
      return true;
    }
    await delay(25);
  }

  return !isProcessTreeRunning(child);
}

async function waitForReadiness(
  readinessUrl: string,
  timeoutMs: number,
  readExit: () => ProcessExit | undefined,
): Promise<'ready' | 'exited' | 'timed-out'> {
  const deadline = performance.now() + timeoutMs;

  while (performance.now() < deadline) {
    if (readExit() !== undefined) {
      return 'exited';
    }

    try {
      const response = await fetch(readinessUrl, {
        signal: AbortSignal.timeout(Math.min(250, Math.max(1, deadline - performance.now()))),
      });

      if (response.ok) {
        return 'ready';
      }
    } catch {
      // Readiness is expected to refuse connections until startup completes.
    }

    await delay(25);
  }

  return readExit() === undefined ? 'timed-out' : 'exited';
}

export async function startGeneratedAppProcess(
  cwd: string,
  command: string,
  args: string[],
  options: StartGeneratedAppProcessOptions,
): Promise<GeneratedAppProcess> {
  if (nodeProcess.platform === 'win32') {
    throw new Error(
      'Generated server process-tree verification is unsupported on Windows because descendant cleanup cannot be proven.',
    );
  }
  const startedAt = performance.now();
  const output: string[] = [];
  let capturedOutputCharacters = 0;
  let exit: ProcessExit | undefined;
  let resolveExit: (exit: ProcessExit) => void = () => undefined;
  const exitPromise = new Promise<ProcessExit>((resolve) => {
    resolveExit = resolve;
  });
  const child = spawn(command, args, {
    cwd,
    detached: true,
    env: { ...options.env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const captureOutput = (chunk: Buffer | string): void => {
    const text = String(chunk);
    output.push(text);
    capturedOutputCharacters += text.length;
    while (capturedOutputCharacters > MAX_CAPTURED_OUTPUT_CHARACTERS && output.length > 1) {
      capturedOutputCharacters -= output.shift()?.length ?? 0;
    }
  };
  child.stdout?.on('data', captureOutput);
  child.stderr?.on('data', captureOutput);
  child.once('error', () => {
    if (exit === undefined) {
      exit = {};
      resolveExit(exit);
    }
  });
  child.once('exit', (exitCode, signal) => {
    if (exit === undefined) {
      exit = {
        ...(exitCode === null ? {} : { exitCode }),
        ...(signal === null ? {} : { signal }),
      };
      resolveExit(exit);
    }
  });

  const readiness = await waitForReadiness(
    options.readinessUrl,
    options.readinessTimeoutMs,
    () => exit,
  );
  const safeCommand = sanitizeGeneratedAppCommandText(basename(command), cwd, options.env);
  const safeArgs = args.map((arg) => sanitizeGeneratedAppCommandText(arg, cwd, options.env));
  const diagnostics = sanitizeGeneratedAppCommandText(output.join(''), cwd, options.env).trim();
  const startEvidence: GeneratedAppProcessStartEvidence = {
    command: safeCommand,
    args: safeArgs,
    durationMs: Math.max(0, Math.round(performance.now() - startedAt)),
    status: readiness === 'ready' ? 'passed' : readiness === 'timed-out' ? 'timed-out' : 'failed',
    ...(exit?.exitCode === undefined ? {} : { exitCode: exit.exitCode }),
    ...(exit?.signal === undefined ? {} : { signal: exit.signal }),
    ...(diagnostics.length === 0 ? {} : { diagnostics }),
  };
  let shutdownPromise: Promise<GeneratedAppProcessShutdownEvidence> | undefined;

  const shutdown = (): Promise<GeneratedAppProcessShutdownEvidence> => {
    if (shutdownPromise !== undefined) {
      return shutdownPromise;
    }

    shutdownPromise = (async () => {
      const shutdownStartedAt = performance.now();

      if (!isProcessTreeRunning(child)) {
        return {
          durationMs: Math.max(0, Math.round(performance.now() - shutdownStartedAt)),
          status: 'passed' as const,
          forced: false,
          leaked: false,
          descendantsTerminated: true,
        };
      }

      sendSignalToProcessTree(child, 'SIGTERM');
      const gracefulExit = await waitForProcessTreeExit(child, options.shutdownTimeoutMs);

      if (gracefulExit) {
        return {
          durationMs: Math.max(0, Math.round(performance.now() - shutdownStartedAt)),
          status: 'passed' as const,
          forced: false,
          leaked: false,
          descendantsTerminated: true,
        };
      }

      sendSignalToProcessTree(child, 'SIGKILL');
      await Promise.race([exitPromise, delay(1_000)]);
      const forcedExit = await waitForProcessTreeExit(child, 1_000);

      return {
        durationMs: Math.max(0, Math.round(performance.now() - shutdownStartedAt)),
        status: 'failed' as const,
        forced: true,
        leaked: !forcedExit,
        descendantsTerminated: forcedExit,
      };
    })();

    return shutdownPromise;
  };

  return { startEvidence, shutdown };
}
