const { strict: assert } = require('node:assert');
const http = require('node:http');
const { after, before, test } = require('node:test');
const { createServer } = require('../server.js');

let server;
let origin;

function request(rawPath) {
  return new Promise((resolve, reject) => {
    const url = new URL(origin);
    const req = http.request({
      hostname: url.hostname,
      port: url.port,
      method: 'GET',
      path: rawPath
    }, response => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', chunk => {
        body += chunk;
      });
      response.on('end', () => resolve({
        status: response.statusCode,
        type: response.headers['content-type'] || '',
        body
      }));
    });
    req.on('error', reject);
    req.end();
  });
}

before(async () => {
  server = createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  origin = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  if (!server) return;
  await new Promise((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve());
  });
});

test('serves the application entrypoint', async () => {
  const response = await request('/');
  assert.equal(response.status, 200);
  assert.match(response.type, /^text\/html/);
  assert.match(response.body, /src\/app\/app\.js/);
});

test('returns 404 for a missing resource', async () => {
  const response = await request('/missing-resource.js');
  assert.equal(response.status, 404);
});

test('rejects encoded path traversal outside the public directory', async () => {
  const response = await request('/%2e%2e/package.json');
  assert.equal(response.status, 403);
});

test('returns 400 for malformed URL encoding without crashing', async () => {
  const malformedResponse = await request('/%E0%A4%A');
  assert.equal(malformedResponse.status, 400);

  const healthyResponse = await request('/index.html');
  assert.equal(healthyResponse.status, 200);
});
