import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:net';
import { promisify } from 'node:util';

import type { GeneratedVerificationResourceFactory } from './generated-verification-matrix';
import type { Pr1GeneratedVerificationPlanCell } from './pr1-generated-verification-plan';

const execFileAsync = promisify(execFile);
const DATABASE_READINESS_ATTEMPTS = 120;
const DATABASE_READINESS_INTERVAL_MS = 500;

type DockerCommand = (args: readonly string[]) => Promise<string>;

async function defaultDockerCommand(args: readonly string[]): Promise<string> {
  const { stdout } = await execFileAsync('docker', [...args], {
    encoding: 'utf8',
    maxBuffer: 1024 * 1024,
  });
  return stdout.trim();
}

function acquireAvailablePort(): Promise<number> {
  return new Promise((resolvePort, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        server.close();
        reject(new Error('Could not allocate a local PR1 verification port.'));
        return;
      }
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolvePort(address.port);
      });
    });
  });
}

async function waitForHealthyContainer(
  containerName: string,
  runDockerCommand: DockerCommand,
): Promise<void> {
  for (let attempt = 0; attempt < DATABASE_READINESS_ATTEMPTS; attempt += 1) {
    const status = await runDockerCommand([
      'inspect',
      '--format',
      '{{.State.Health.Status}}',
      containerName,
    ]).catch(() => 'missing');
    if (status === 'healthy') {
      return;
    }
    if (status === 'unhealthy' || status === 'missing') {
      throw new Error('Disposable verification Database failed before readiness.');
    }
    await new Promise<void>((resolve) => setTimeout(resolve, DATABASE_READINESS_INTERVAL_MS));
  }
  throw new Error('Disposable verification Database did not become ready in time.');
}

async function removeContainer(
  containerName: string,
  runDockerCommand: DockerCommand,
): Promise<{ leaked: boolean }> {
  const removed = await runDockerCommand(['rm', '--force', containerName])
    .then(() => true)
    .catch(() => false);
  if (!removed) {
    return { leaked: true };
  }
  const remains = await runDockerCommand(['inspect', containerName])
    .then(() => true)
    .catch(() => false);
  return { leaked: remains };
}

function nodeEnvironment(
  plan: Pr1GeneratedVerificationPlanCell,
  port: number,
): Readonly<Record<string, string>> {
  const environment: Record<string, string> = {
    CLIENT_ORIGIN: 'http://localhost:8081',
    PORT: String(port),
  };
  if (plan.selection.generatedAppOptions.auth === 'better-auth') {
    environment.BETTER_AUTH_SECRET = 'tenkit-pr1-local-verification-secret';
    environment.BETTER_AUTH_URL = `http://127.0.0.1:${port}`;
  } else if (plan.selection.generatedAppOptions.auth === 'clerk') {
    environment.CLERK_PUBLISHABLE_KEY = 'pk_test_Y2xlcmsuZXhhbXBsZS5jb20k';
    environment.CLERK_SECRET_KEY = 'sk_test_tenkit-local-verification';
    environment.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY = 'pk_test_Y2xlcmsuZXhhbXBsZS5jb20k';
  }
  return environment;
}

async function acquirePostgresql(
  runDockerCommand: DockerCommand,
): Promise<Awaited<ReturnType<GeneratedVerificationResourceFactory['acquire']>>> {
  const port = await acquireAvailablePort();
  const containerName = `tenkit-pr1-postgresql-${randomUUID()}`;
  try {
    await runDockerCommand([
      'run',
      '--detach',
      '--rm',
      '--name',
      containerName,
      '--publish',
      `127.0.0.1:${port}:5432`,
      '--env',
      'POSTGRES_DB=tenkit',
      '--env',
      'POSTGRES_PASSWORD=tenkit',
      '--env',
      'POSTGRES_USER=tenkit',
      '--health-cmd',
      'pg_isready -U tenkit -d tenkit',
      '--health-interval',
      '500ms',
      '--health-timeout',
      '5s',
      '--health-retries',
      '120',
      'postgres:17-alpine',
    ]);
    await waitForHealthyContainer(containerName, runDockerCommand);
  } catch {
    await removeContainer(containerName, runDockerCommand);
    throw new Error('Disposable PostgreSQL acquisition failed.');
  }

  return {
    cleanup: () => removeContainer(containerName, runDockerCommand),
    environment: {
      DATABASE_URL: `postgresql://tenkit:tenkit@127.0.0.1:${port}/tenkit`,
    },
  };
}

async function acquireMysql(
  runDockerCommand: DockerCommand,
): Promise<Awaited<ReturnType<GeneratedVerificationResourceFactory['acquire']>>> {
  const port = await acquireAvailablePort();
  const containerName = `tenkit-pr1-mysql-${randomUUID()}`;
  try {
    await runDockerCommand([
      'run',
      '--detach',
      '--rm',
      '--name',
      containerName,
      '--publish',
      `127.0.0.1:${port}:3306`,
      '--env',
      'MYSQL_DATABASE=tenkit',
      '--env',
      'MYSQL_PASSWORD=tenkit',
      '--env',
      'MYSQL_ROOT_PASSWORD=tenkit-root',
      '--env',
      'MYSQL_USER=tenkit',
      '--health-cmd',
      'mysqladmin ping -h 127.0.0.1 -utenkit -ptenkit --silent',
      '--health-interval',
      '500ms',
      '--health-timeout',
      '5s',
      '--health-retries',
      '120',
      'mysql:8.4',
    ]);
    await waitForHealthyContainer(containerName, runDockerCommand);
  } catch {
    await removeContainer(containerName, runDockerCommand);
    throw new Error('Disposable MySQL acquisition failed.');
  }

  return {
    cleanup: () => removeContainer(containerName, runDockerCommand),
    environment: {
      DATABASE_URL: `mysql://tenkit:tenkit@127.0.0.1:${port}/tenkit`,
    },
  };
}

export function createPr1VerificationResourceResolver(
  runDockerCommand: DockerCommand = defaultDockerCommand,
): (
  plan: Pr1GeneratedVerificationPlanCell,
  resourceClass: string,
) => GeneratedVerificationResourceFactory {
  return (plan, resourceClass) => {
    if (resourceClass === 'local-node-port') {
      return {
        resourceClass,
        acquire: async () => {
          const port = await acquireAvailablePort();
          return {
            cleanup: async () => ({ leaked: false }),
            environment: nodeEnvironment(plan, port),
          };
        },
      };
    }
    if (resourceClass === 'disposable-postgresql') {
      return { resourceClass, acquire: () => acquirePostgresql(runDockerCommand) };
    }
    if (resourceClass === 'disposable-mysql-8-4') {
      return { resourceClass, acquire: () => acquireMysql(runDockerCommand) };
    }
    throw new Error(`Unknown PR1 verification resource class: ${resourceClass}.`);
  };
}
