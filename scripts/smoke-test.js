const { spawn } = require('node:child_process');
const { join } = require('node:path');

const baseUrl = 'http://127.0.0.1:8080';
const projectRoot = join(__dirname, '..');
let ownedServer = null;

const checks = [
  { path: '/', status: 200, type: 'text/html', contains: 'src/app/app.js' },
  { path: '/index.html', status: 200, type: 'text/html', contains: 'WorkTree X' },
  { path: '/css/style.css', status: 200, type: 'text/css', contains: '--primary:' },
  { path: '/js/core.js', status: 200, type: 'text/javascript' },
  { path: '/js/access.js', status: 200, type: 'text/javascript' },
  { path: '/js/mobile.js', status: 200, type: 'text/javascript' },
  { path: '/src/app/app.js', status: 200, type: 'text/javascript', contains: 'bootstrapApp' },
  { path: '/manifest.webmanifest', status: 200, type: 'application/manifest+json' },
  { path: '/assets/icon-192.png', status: 200, type: 'image/png' },
  { path: '/assets/og-image.png', status: 200, type: 'image/png' },
  { path: '/robots.txt', status: 200, type: 'text/plain', contains: 'Sitemap:' },
  { path: '/sitemap.xml', status: 200, type: 'application/xml', contains: '<urlset' },
  { path: '/does-not-exist', status: 404, type: 'text/plain' }
];

async function serverIsReady() {
  try {
    const response = await fetch(`${baseUrl}/index.html`);
    return response.status === 200;
  } catch {
    return false;
  }
}

async function ensureServer() {
  if (await serverIsReady()) {
    return 'existing';
  }

  ownedServer = spawn(process.execPath, ['server.js'], {
    cwd: projectRoot,
    stdio: ['ignore', 'pipe', 'pipe']
  });

  let startupError = '';
  ownedServer.stderr.on('data', chunk => {
    startupError += chunk.toString();
  });

  for (let attempt = 0; attempt < 30; attempt += 1) {
    if (await serverIsReady()) {
      return 'temporary';
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  throw new Error(`Local server did not become ready. ${startupError}`.trim());
}

async function runChecks() {
  const failures = [];

  for (const check of checks) {
    try {
      const response = await fetch(`${baseUrl}${check.path}`);
      const contentType = response.headers.get('content-type') || '';
      const body = check.contains ? await response.text() : null;

      if (response.status !== check.status) {
        failures.push(`${check.path}: expected status ${check.status}, received ${response.status}`);
      }
      if (!contentType.toLowerCase().includes(check.type.toLowerCase())) {
        failures.push(`${check.path}: expected content-type ${check.type}, received ${contentType || '(missing)'}`);
      }
      if (check.contains && !body.includes(check.contains)) {
        failures.push(`${check.path}: response did not contain ${JSON.stringify(check.contains)}`);
      }
    } catch (error) {
      failures.push(`${check.path}: ${error.message}`);
    }
  }

  if (failures.length > 0) {
    throw new Error(`Smoke test failed:\n- ${failures.join('\n- ')}`);
  }
}

async function main() {
  const serverMode = await ensureServer();
  await runChecks();
  console.log(`HTTP smoke test passed for ${checks.length} routes (${serverMode} server).`);
}

main()
  .catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => {
    if (ownedServer && !ownedServer.killed) {
      ownedServer.kill();
    }
  });
