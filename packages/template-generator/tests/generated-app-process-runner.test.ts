/// <reference types="node" />

import { createServer } from 'node:net';

import { afterEach, assert, expect, test } from 'vitest';

import {
  startGeneratedAppProcess,
  type GeneratedAppProcess,
} from '../src/generated-app-process-runner';

const processes: GeneratedAppProcess[] = [];

test.runIf(process.platform === 'win32')(
  'Windows fails explicitly before claiming descendant cleanup support',
  async () => {
    await expect(
      startGeneratedAppProcess(process.cwd(), process.execPath, ['-e', ''], {
        env: {},
        readinessUrl: 'http://127.0.0.1:1',
        readinessTimeoutMs: 1,
        shutdownTimeoutMs: 1,
      }),
    ).rejects.toThrow(/unsupported on Windows/);
  },
);

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

function isRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function waitForStopped(pid: number): Promise<boolean> {
  const deadline = performance.now() + 2_000;
  while (performance.now() < deadline) {
    if (!isRunning(pid)) {
      return true;
    }
    await new Promise<void>((resolve) => setTimeout(resolve, 25));
  }
  return !isRunning(pid);
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
  assert.equal(shutdownEvidence.leaked, false);
  assert.equal(shutdownEvidence.descendantsTerminated, true);
});

test.runIf(process.platform !== 'win32')(
  'shutdown cleans a child process after its launcher exits prematurely',
  async () => {
    const port = await reservePort();
    const generatedProcess = await startGeneratedAppProcess(
      process.cwd(),
      process.execPath,
      [
        '-e',
        'const {spawn}=require("node:child_process");const child=spawn(process.execPath,["-e","setInterval(()=>{},1000)"],{stdio:"ignore"});process.stdout.write(String(child.pid));setTimeout(()=>process.exit(9),50)',
      ],
      {
        env: {},
        readinessUrl: `http://127.0.0.1:${port}`,
        readinessTimeoutMs: 2_000,
        shutdownTimeoutMs: 500,
      },
    );
    processes.push(generatedProcess);
    const childPid = Number(generatedProcess.startEvidence.diagnostics);

    assert.equal(generatedProcess.startEvidence.status, 'failed');
    assert.ok(Number.isInteger(childPid));
    assert.equal(isRunning(childPid), true);

    try {
      const shutdownEvidence = await generatedProcess.shutdown();
      assert.equal(shutdownEvidence.status, 'passed');
      assert.equal(shutdownEvidence.forced, false);
      assert.equal(shutdownEvidence.leaked, false);
      assert.equal(shutdownEvidence.descendantsTerminated, true);
      assert.equal(await waitForStopped(childPid), true);
    } finally {
      if (isRunning(childPid)) {
        process.kill(childPid, 'SIGKILL');
      }
    }
  },
);

test.runIf(process.platform !== 'win32')(
  'a child that ignores graceful shutdown is forcibly cleaned and fails lifecycle proof',
  async () => {
    const port = await reservePort();
    const childScript =
      'process.on("SIGTERM",()=>{});process.send("ready");setInterval(()=>{},1000)';
    const parentScript = `const {spawn}=require("node:child_process");const http=require("node:http");const child=spawn(process.execPath,["-e",${JSON.stringify(childScript)}],{stdio:["ignore","ignore","ignore","ipc"]});process.stdout.write(String(child.pid));const server=http.createServer((_,res)=>res.end("ok"));child.on("message",()=>server.listen(Number(process.env.PORT),"127.0.0.1"));process.on("SIGTERM",()=>server.close(()=>process.exit(0)))`;
    const generatedProcess = await startGeneratedAppProcess(
      process.cwd(),
      process.execPath,
      ['-e', parentScript],
      {
        env: { PORT: String(port) },
        readinessUrl: `http://127.0.0.1:${port}`,
        readinessTimeoutMs: 2_000,
        shutdownTimeoutMs: 100,
      },
    );
    processes.push(generatedProcess);
    const childPid = Number(generatedProcess.startEvidence.diagnostics);

    assert.equal(generatedProcess.startEvidence.status, 'passed');
    assert.ok(Number.isInteger(childPid));

    try {
      const shutdownEvidence = await generatedProcess.shutdown();
      assert.equal(shutdownEvidence.status, 'failed');
      assert.equal(shutdownEvidence.forced, true);
      assert.equal(shutdownEvidence.leaked, false);
      assert.equal(shutdownEvidence.descendantsTerminated, true);
      assert.equal(await waitForStopped(childPid), true);
    } finally {
      if (isRunning(childPid)) {
        process.kill(childPid, 'SIGKILL');
      }
    }
  },
);
