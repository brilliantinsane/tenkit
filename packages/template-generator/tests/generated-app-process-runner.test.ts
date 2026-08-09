/// <reference types="node" />

import { createServer } from 'node:net';

import { afterEach, assert, test } from 'vitest';

import {
  startGeneratedAppProcess,
  type GeneratedAppProcess,
} from '../src/generated-app-process-runner';

const processes: GeneratedAppProcess[] = [];

afterEach(async () => {
  await Promise.all(processes.splice(0).map((process) => process.shutdown()));
});

async function reservePort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  const port = address.port;
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
  return port;
}

test('generated server readiness and graceful shutdown return structured evidence', async () => {
  const port = await reservePort();
  const generatedProcess = await startGeneratedAppProcess(
    process.cwd(),
    process.execPath,
    [
      '-e',
      'const http=require("node:http");const server=http.createServer((_,res)=>{res.statusCode=200;res.end("ok")});server.listen(Number(process.env.PORT),"127.0.0.1");process.on("SIGTERM",()=>server.close(()=>process.exit(0)))',
    ],
    {
      env: { PORT: String(port) },
      readinessUrl: `http://127.0.0.1:${port}`,
      readinessTimeoutMs: 2_000,
      shutdownTimeoutMs: 2_000,
    },
  );
  processes.push(generatedProcess);

  assert.equal(generatedProcess.startEvidence.status, 'passed');
  const shutdownEvidence = await generatedProcess.shutdown();
  assert.equal(shutdownEvidence.status, 'passed');
  assert.equal(shutdownEvidence.forced, false);
});

test('generated server readiness timeout still permits reliable shutdown', async () => {
  const port = await reservePort();
  const generatedProcess = await startGeneratedAppProcess(
    process.cwd(),
    process.execPath,
    ['-e', 'setInterval(() => {}, 1_000)'],
    {
      env: {},
      readinessUrl: `http://127.0.0.1:${port}`,
      readinessTimeoutMs: 50,
      shutdownTimeoutMs: 2_000,
    },
  );
  processes.push(generatedProcess);

  assert.equal(generatedProcess.startEvidence.status, 'timed-out');
  const shutdownEvidence = await generatedProcess.shutdown();
  assert.equal(shutdownEvidence.status, 'passed');
});

test('generated server premature exit owns the start failure', async () => {
  const port = await reservePort();
  const generatedProcess = await startGeneratedAppProcess(
    process.cwd(),
    process.execPath,
    ['-e', 'process.exit(9)'],
    {
      env: {},
      readinessUrl: `http://127.0.0.1:${port}`,
      readinessTimeoutMs: 2_000,
      shutdownTimeoutMs: 100,
    },
  );
  processes.push(generatedProcess);

  assert.equal(generatedProcess.startEvidence.status, 'failed');
  assert.equal(generatedProcess.startEvidence.exitCode, 9);
  const shutdownEvidence = await generatedProcess.shutdown();
  assert.equal(shutdownEvidence.status, 'passed');
});

test('forced shutdown is cleanup but fails lifecycle proof', async () => {
  const port = await reservePort();
  const generatedProcess = await startGeneratedAppProcess(
    process.cwd(),
    process.execPath,
    [
      '-e',
      'const http=require("node:http");http.createServer((_,res)=>res.end("ok")).listen(Number(process.env.PORT),"127.0.0.1");process.on("SIGTERM",()=>{})',
    ],
    {
      env: { PORT: String(port) },
      readinessUrl: `http://127.0.0.1:${port}`,
      readinessTimeoutMs: 2_000,
      shutdownTimeoutMs: 25,
    },
  );
  processes.push(generatedProcess);

  assert.equal(generatedProcess.startEvidence.status, 'passed');
  const shutdownEvidence = await generatedProcess.shutdown();
  assert.equal(shutdownEvidence.status, 'failed');
  assert.equal(shutdownEvidence.forced, true);
});
