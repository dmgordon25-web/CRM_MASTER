import { spawn } from 'node:child_process';
import { once } from 'node:events';
import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';
import process from 'node:process';
import { finished } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';

const RUN_ID = '1761900557524-9292';
const REPORT_DIR = path.resolve(process.cwd(), 'reports', RUN_ID);
const SUMMARY_PATH = path.join(REPORT_DIR, 'summary.json');
const DEVSERVER_PID_PATH = path.join(REPORT_DIR, 'devserver.pid');
const BACKOFF_SCHEDULE = [500, 1500, 3000];
const DEFAULT_TIMEOUT_MS = 6 * 60 * 1000;
const BASE_PORT = 8080 + (Number(RUN_ID.slice(-2)) % 50);

function logLine(stream, message) {
  const text = typeof message === 'string' ? message : JSON.stringify(message);
  stream.write(`[${new Date().toISOString()}] ${text}\n`);
}

function createContext(logStream, trackedChildren) {
  const spawnWithLogging = (command, args = [], options = {}) => {
    const spawnOptions = { ...options };
    if (!spawnOptions.stdio) {
      spawnOptions.stdio = ['ignore', 'pipe', 'pipe'];
    }
    if (!spawnOptions.env) {
      spawnOptions.env = process.env;
    }
    const child = spawn(command, args, spawnOptions);
    trackedChildren.add(child);
    const remove = () => {
      trackedChildren.delete(child);
    };
    child.once('exit', remove);
    child.once('close', remove);
    if (child.stdout) {
      child.stdout.setEncoding('utf8');
      child.stdout.on('data', (chunk) => {
        logStream.write(chunk);
      });
    }
    if (child.stderr) {
      child.stderr.setEncoding('utf8');
      child.stderr.on('data', (chunk) => {
        logStream.write(chunk);
      });
    }
    logLine(logStream, `[spawn] ${command} ${args.join(' ')} (pid=${child.pid ?? 'unknown'})`);
    return child;
  };

  const exec = (command, args = [], options = {}) => {
    return new Promise((resolve, reject) => {
      const child = spawnWithLogging(command, args, options);
      child.on('error', (error) => {
        reject(error);
      });
      child.on('close', (code, signal) => {
        resolve({ code, signal, pid: child.pid ?? null });
      });
    });
  };

  const log = (message) => {
    if (message === undefined || message === null) {
      return;
    }
    logStream.write(`${message}\n`);
  };

  return { spawn: spawnWithLogging, exec, log };
}

async function killChildren(children, logStream) {
  if (!children || children.size === 0) {
    return;
  }
  const pending = Array.from(children);
  for (const child of pending) {
    if (!child || typeof child.kill !== 'function') {
      continue;
    }
    try {
      logLine(logStream, `Killing child pid=${child.pid ?? 'unknown'}`);
      child.kill('SIGTERM');
    } catch (error) {
      logLine(logStream, `Failed to send SIGTERM to pid=${child.pid ?? 'unknown'}: ${error}`);
    }
  }
  const killDeadline = Date.now() + 2000;
  for (const child of pending) {
    if (!child) continue;
    try {
      const remaining = killDeadline - Date.now();
      if (remaining > 0) {
        await Promise.race([
          once(child, 'exit'),
          delay(remaining)
        ]).catch(() => {});
      }
    } catch (error) {
      logLine(logStream, `Error waiting for pid=${child.pid ?? 'unknown'} exit: ${error}`);
    }
    if (child.exitCode === null && child.signalCode === null) {
      try {
        logLine(logStream, `Force killing child pid=${child.pid ?? 'unknown'}`);
        child.kill('SIGKILL');
      } catch (error) {
        logLine(logStream, `Failed to SIGKILL pid=${child.pid ?? 'unknown'}: ${error}`);
      }
    }
  }
}

export async function runStep(name, fn, { timeoutMs = DEFAULT_TIMEOUT_MS, retries = 0, shouldRetry } = {}) {
  await fsPromises.mkdir(REPORT_DIR, { recursive: true });
  const logPath = path.join(REPORT_DIR, `${name}.log`);
  const logStream = fs.createWriteStream(logPath, { flags: 'w' });
  const result = { name, success: false, attempts: 0, value: undefined };
  let lastError = null;
  const maxAttempts = 1 + Math.max(0, retries);

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    result.attempts = attempt;
    const attemptStart = new Date();
    logLine(logStream, `--- Attempt ${attempt} started at ${attemptStart.toISOString()} ---`);
    const trackedChildren = new Set();
    const ctx = createContext(logStream, trackedChildren);
    let timeoutId;
    let timedOut = false;
    let streamClosed = false;
    try {
      const attemptPromise = Promise.resolve(fn(ctx));
      const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
          timedOut = true;
          reject(new Error(`Step \"${name}\" timed out after ${timeoutMs}ms`));
        }, timeoutMs);
      });
      const value = await Promise.race([attemptPromise, timeoutPromise]);
      clearTimeout(timeoutId);
      result.success = true;
      result.value = value;
      logLine(logStream, `--- Attempt ${attempt} succeeded in ${Date.now() - attemptStart.getTime()}ms ---`);
      logLine(logStream, `Step ${name} completed successfully.`);
      logStream.end();
      streamClosed = true;
      await finished(logStream);
      return result;
    } catch (error) {
      clearTimeout(timeoutId);
      lastError = error;
      logLine(logStream, `Attempt ${attempt} failed${timedOut ? ' (timeout)' : ''}: ${error?.stack || error}`);
      await killChildren(trackedChildren, logStream);
      const hasMoreAttempts = attempt < maxAttempts;
      const retryAllowed = hasMoreAttempts && (typeof shouldRetry === 'function' ? shouldRetry(error, attempt) : true);
      if (retryAllowed) {
        const delayMs = BACKOFF_SCHEDULE[Math.min(attempt - 1, BACKOFF_SCHEDULE.length - 1)];
        logLine(logStream, `Retrying step ${name} after ${delayMs}ms backoff`);
        await delay(delayMs);
      } else {
        if (hasMoreAttempts) {
          logLine(logStream, 'Retries remaining but policy declined retry for this error.');
        } else {
          logLine(logStream, 'No retries remaining for this step.');
        }
        break;
      }
    } finally {
      if (!streamClosed) {
        logLine(logStream, `--- Attempt ${attempt} ended at ${new Date().toISOString()} ---`);
      }
    }
  }

  result.success = false;
  result.error = lastError ? String(lastError?.stack || lastError) : null;
  logLine(logStream, `Step ${name} failed.`);
  logStream.end();
  const closedPromise = finished(logStream).catch(() => {});
  await closedPromise;
  return result;
}

async function loadSummary() {
  try {
    const raw = await fsPromises.readFile(SUMMARY_PATH, 'utf8');
    return JSON.parse(raw);
  } catch {
    return {
      runId: RUN_ID,
      startedAt: new Date().toISOString(),
      steps: {}
    };
  }
}

async function saveSummary(summary) {
  summary.lastUpdated = new Date().toISOString();
  const serialized = `${JSON.stringify(summary, null, 2)}\n`;
  await fsPromises.writeFile(SUMMARY_PATH, serialized, 'utf8');
}

async function git(args) {
  return new Promise((resolve, reject) => {
    const child = spawn('git', args, { stdio: 'inherit' });
    child.on('error', (error) => reject(error));
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`git ${args.join(' ')} exited with code ${code}`));
      }
    });
  });
}

async function stageReports() {
  await git(['add', path.posix.join('reports', RUN_ID)]);
}

async function commitReports(stepName, status) {
  try {
    await git(['diff', '--cached', '--quiet']);
    // No staged changes
    return;
  } catch {
    // there are staged changes
  }
  const message = `chore: record ${stepName} step (${status})`;
  try {
    await git(['commit', '-m', message]);
  } catch (error) {
    if (/nothing to commit, working tree clean/i.test(String(error))) {
      return;
    }
    throw error;
  }
}

async function ensurePortAvailable(startPort) {
  let port = startPort;
  while (true) {
    const available = await new Promise((resolve) => {
      const server = net.createServer();
      server.once('error', () => {
        server.close(() => resolve(false));
      });
      server.listen(port, '127.0.0.1', () => {
        server.close(() => resolve(true));
      });
    });
    if (available) {
      return port;
    }
    port += 1;
  }
}

async function waitForServer(url, timeoutMs, log) {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    try {
      const response = await fetch(url, { redirect: 'manual' });
      if (response.ok) {
        return;
      }
      const text = await response.text();
      if (text.includes('BOOT_STAMP: crm-app-index')) {
        return;
      }
      if (log) {
        log(`[waitForServer] Received status ${response.status}`);
      }
    } catch (error) {
      if (log) {
        log(`[waitForServer] Fetch failed: ${error}`);
      }
    }
    await delay(500);
  }
  throw new Error(`Dev server did not become ready within ${timeoutMs}ms (${url})`);
}

async function shutdownDevServer(child) {
  if (child && child.exitCode == null) {
    try {
      child.kill('SIGTERM');
    } catch {}
    await once(child, 'exit').catch(() => {});
  } else {
    try {
      const rawPid = await fsPromises.readFile(DEVSERVER_PID_PATH, 'utf8');
      const pid = Number(rawPid.trim());
      if (Number.isFinite(pid) && pid > 0) {
        try {
          process.kill(pid, 'SIGTERM');
        } catch {}
      }
    } catch {}
  }
}

export async function main() {
  await fsPromises.mkdir(REPORT_DIR, { recursive: true });
  const summary = await loadSummary();
  let devServerProcess = null;
  let devServerPort = null;

  const steps = [
    {
      name: 'verify_build',
      timeoutMs: DEFAULT_TIMEOUT_MS,
      retries: 2,
      run: async (ctx) => {
        const result = await ctx.exec('npm', ['run', 'verify:build']);
        if (result.code !== 0) {
          throw new Error(`npm run verify:build exited with code ${result.code}`);
        }
      }
    },
    {
      name: 'test_boot',
      timeoutMs: DEFAULT_TIMEOUT_MS,
      retries: 2,
      run: async (ctx) => {
        const result = await ctx.exec('npm', ['run', 'test:boot']);
        if (result.code !== 0) {
          throw new Error(`npm run test:boot exited with code ${result.code}`);
        }
      }
    },
    {
      name: 'features',
      timeoutMs: DEFAULT_TIMEOUT_MS,
      retries: 2,
      run: async (ctx) => {
        const result = await ctx.exec('npm', ['run', 'check:features']);
        if (result.code !== 0) {
          throw new Error(`npm run check:features exited with code ${result.code}`);
        }
      }
    },
    {
      name: 'sweep_s1',
      timeoutMs: DEFAULT_TIMEOUT_MS,
      retries: 2,
      run: async (ctx) => {
        const result = await ctx.exec('npm', ['run', 'sweep:s1']);
        if (result.code !== 0) {
          throw new Error(`npm run sweep:s1 exited with code ${result.code}`);
        }
      }
    },
    {
      name: 'sweep_s2',
      timeoutMs: DEFAULT_TIMEOUT_MS,
      retries: 2,
      run: async (ctx) => {
        const result = await ctx.exec('npm', ['run', 'sweep:s2']);
        if (result.code !== 0) {
          throw new Error(`npm run sweep:s2 exited with code ${result.code}`);
        }
      }
    },
    {
      name: 'dev_server',
      timeoutMs: DEFAULT_TIMEOUT_MS,
      retries: 2,
      run: async (ctx) => {
        const port = await ensurePortAvailable(BASE_PORT);
        const child = ctx.spawn(process.execPath, ['tools/dev_server.mjs', '--port', String(port)], {
          env: { ...process.env, CRM_SKIP_AUTO_OPEN: '1' }
        });
        devServerProcess = child;
        devServerPort = port;
        await fsPromises.writeFile(DEVSERVER_PID_PATH, `${child.pid}\n`, 'utf8');
        const origin = `http://127.0.0.1:${port}/`;
        await Promise.race([
          waitForServer(origin, 90_000, ctx.log),
          once(child, 'exit').then(([code, signal]) => {
            throw new Error(`Dev server exited prematurely (code=${code ?? 'null'}, signal=${signal ?? 'null'})`);
          })
        ]);
        ctx.log(`Dev server ready on ${origin}`);
        return { port, pid: child.pid, origin };
      }
    },
    {
      name: 'h01_proof',
      timeoutMs: 10 * 60 * 1000,
      retries: 1,
      shouldRetry: (error) => Boolean(error && error.retryable),
      run: async (ctx) => {
        if (!devServerPort) {
          throw new Error('Dev server port is not available for H01 proof');
        }
        const profileDir = path.resolve(process.cwd(), '.runs', RUN_ID, 'chrome-profile');
        await fsPromises.mkdir(profileDir, { recursive: true });
        const result = await ctx.exec(process.execPath, [
          'tools/e2e_quickadd.mjs',
          '--port',
          String(devServerPort),
          '--run-id',
          RUN_ID,
          '--profile',
          profileDir
        ], {
          env: { ...process.env, PUPPETEER_RUN_ID: RUN_ID }
        });
        if (result.code !== 0) {
          const error = new Error(`H01 proof script exited with code ${result.code}`);
          if (result.signal) {
            error.retryable = true;
          }
          throw error;
        }
        return { proof: true };
      }
    }
  ];

  for (const step of steps) {
    const { name, run, timeoutMs, retries, shouldRetry } = step;
    const result = await runStep(name, run, { timeoutMs, retries, shouldRetry });
    summary.steps[name] = {
      status: result.success ? 'PASS' : 'FAIL',
      attempts: result.attempts,
      finishedAt: new Date().toISOString(),
      details: result.value ?? null,
      error: result.success ? null : result.error || null
    };
    await saveSummary(summary);
    await stageReports();
    try {
      await commitReports(name, summary.steps[name].status);
    } catch (error) {
      process.stderr.write(`Failed to commit reports for step ${name}: ${error}\n`);
    }
    if (name === 'h01_proof') {
      await shutdownDevServer(devServerProcess);
    }
  }
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`${error?.stack || error}\n`);
    process.exitCode = 1;
  });
}
