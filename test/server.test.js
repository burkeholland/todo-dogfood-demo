const { test } = require('node:test');
const assert = require('node:assert');
const { createApp, TEST_USER } = require('../server');

async function withServer(fn) {
  const server = createApp().listen(0);
  const base = `http://localhost:${server.address().port}`;
  try {
    await fn(base);
  } finally {
    server.close();
  }
}

async function signIn(base) {
  const res = await fetch(`${base}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(TEST_USER),
  });
  return res.headers.get('set-cookie').split(';')[0];
}

test('rejects a wrong password', async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/api/login`, {
      method: 'POST',
      body: JSON.stringify({ email: TEST_USER.email, password: 'nope' }),
    });
    assert.strictEqual(res.status, 401);
  });
});

test('adds, toggles and deletes a todo', async () => {
  await withServer(async (base) => {
    const cookie = await signIn(base);
    const headers = { cookie, 'Content-Type': 'application/json' };
    const created = await (await fetch(`${base}/api/todos`, { method: 'POST', headers, body: JSON.stringify({ text: 'Buy milk' }) })).json();
    assert.strictEqual(created.text, 'Buy milk');
    const toggled = await (await fetch(`${base}/api/todos/${created.id}`, { method: 'PATCH', headers })).json();
    assert.strictEqual(toggled.done, true);
    const del = await fetch(`${base}/api/todos/${created.id}`, { method: 'DELETE', headers });
    assert.strictEqual(del.status, 204);
    const list = await (await fetch(`${base}/api/todos`, { headers })).json();
    assert.deepStrictEqual(list, []);
  });
});

test('serves the home page', async () => {
  await withServer(async (base) => {
    const res = await fetch(base);
    assert.strictEqual(res.status, 200);
    assert.match(await res.text(), /<h1>Todos<\/h1>/);
  });
});
