const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

test('counts only incomplete todos as items left', () => {
  const elements = new Map();
  const context = {
    document: {
      getElementById(id) {
        if (!elements.has(id)) elements.set(id, {});
        return elements.get(id);
      },
    },
    module: { exports: {} },
    fetch: async () => ({ status: 401, ok: false, json: async () => ({ error: 'Sign in first' }) }),
  };
  const source = fs.readFileSync(path.join(__dirname, '../public/app.js'), 'utf8');
  vm.runInNewContext(source, context);

  assert.strictEqual(context.module.exports.itemsLeft([{ done: true }]), 0);
  assert.strictEqual(context.module.exports.itemsLeft([{ done: false }, { done: true }]), 1);
});

async function loadApp(response) {
  let requests = 0;
  const elements = new Map([
    ['login-form', { hidden: false }],
    ['app', { hidden: true }],
  ]);
  function element() {
    return {
      children: [],
      append(...children) { this.children.push(...children); },
      setAttribute() {},
    };
  }
  const context = {
    document: {
      getElementById(id) {
        if (!elements.has(id)) elements.set(id, element());
        return elements.get(id);
      },
      createElement: element,
    },
    fetch: async (url, options) => {
      requests++;
      assert.strictEqual(url, '/api/todos');
      assert.strictEqual(options.method, 'GET');
      if (response instanceof Error) throw response;
      return response;
    },
  };
  const source = fs.readFileSync(path.join(__dirname, '../public/app.js'), 'utf8');
  vm.runInNewContext(source, context);
  await new Promise((resolve) => setImmediate(resolve));
  assert.strictEqual(requests, 1);
  return elements;
}

test('restores a signed-in session and its todos on load', async () => {
  const elements = await loadApp({
    status: 200,
    ok: true,
    json: async () => [{ id: 1, text: 'Buy milk', done: false }],
  });

  assert.strictEqual(elements.get('login-form').hidden, true);
  assert.strictEqual(elements.get('app').hidden, false);
  assert.strictEqual(elements.get('list').children[0].children[1].textContent, 'Buy milk');
  assert.strictEqual(elements.get('count').textContent, '1 item left');
});

test('keeps the sign-in form visible without a session', async () => {
  const elements = await loadApp({
    status: 401,
    ok: false,
    json: async () => ({ error: 'Sign in first' }),
  });

  assert.strictEqual(elements.get('login-form').hidden, false);
  assert.strictEqual(elements.get('app').hidden, true);
});

test('keeps the sign-in form visible if the session check fails', async () => {
  const elements = await loadApp(new Error('Network unavailable'));

  assert.strictEqual(elements.get('login-form').hidden, false);
  assert.strictEqual(elements.get('app').hidden, true);
});
