const { execSync } = require('child_process');

function parsePort(raw) {
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 65535) return 3001;
  return parsed;
}

function getPidsUnix(port) {
  try {
    const out = execSync(`lsof -ti tcp:${port} -sTCP:LISTEN`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    return out
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .filter((pid) => /^\d+$/.test(pid));
  } catch {
    return [];
  }
}

function getPidsWindows(port) {
  try {
    const out = execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    const lines = out.split('\n').map((line) => line.trim()).filter(Boolean);
    const pids = new Set();
    for (const line of lines) {
      const parts = line.split(/\s+/);
      const pid = parts[parts.length - 1];
      const localAddress = parts[1] || '';
      if (localAddress.endsWith(`:${port}`) && /^\d+$/.test(pid)) {
        pids.add(pid);
      }
    }
    return [...pids];
  } catch {
    return [];
  }
}

function killPidsUnix(pids) {
  if (!pids.length) return;
  execSync(`kill -9 ${pids.join(' ')}`, { stdio: 'ignore' });
}

function killPidsWindows(pids) {
  for (const pid of pids) {
    execSync(`taskkill /PID ${pid} /F`, { stdio: 'ignore' });
  }
}

function main() {
  const port = parsePort(process.argv[2] || process.env.PORT || '3001');
  const isWindows = process.platform === 'win32';
  const pids = isWindows ? getPidsWindows(port) : getPidsUnix(port);

  if (!pids.length) {
    console.log(`[port-guard] Port ${port} is free.`);
    return;
  }

  try {
    if (isWindows) killPidsWindows(pids);
    else killPidsUnix(pids);
    console.log(`[port-guard] Freed port ${port} by stopping PID(s): ${pids.join(', ')}`);
  } catch (error) {
    console.error(`[port-guard] Failed to free port ${port}: ${error.message}`);
    process.exit(1);
  }
}

main();
