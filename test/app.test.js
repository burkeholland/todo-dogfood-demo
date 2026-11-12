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

function loadApp(fetch) {
  const elements = new Map();
  function element() {
    return {
      children: [],
      append(...children) { this.children.push(...children); },
      setAttribute() {},
    };
  }
  const document = {
    getElementById(id) {
      if (!elements.has(id)) elements.set(id, element());
      return elements.get(id);
    },
    createElement: element,
  };
  document.getElementById('login-form').hidden = false;
  document.getElementById('app').hidden = true;
  const source = fs.readFileSync(path.join(__dirname, '../public/app.js'), 'utf8');
  vm.runInNewContext(source, { document, fetch });
  return elements;
}

test('restores the signed-in view and todos on reload', async () => {
  const requests = [];
  const elements = loadApp(async (url, options) => {
    requests.push([url, options.method]);
    return {
      status: 200,
      ok: true,
      json: async () => [{ id: 1, text: 'Buy milk', done: false }],
    };
  });
  await new Promise(setImmediate);

  assert.deepStrictEqual(requests, [['/api/todos', 'GET']]);
  assert.strictEqual(elements.get('login-form').hidden, true);
  assert.strictEqual(elements.get('app').hidden, false);
  assert.strictEqual(elements.get('list').children[0].children[1].textContent, 'Buy milk');
  assert.strictEqual(elements.get('count').textContent, '1 item left');
});

test('keeps the sign-in form visible without a valid session', async () => {
  const elements = loadApp(async () => ({
    status: 401,
    ok: false,
    json: async () => ({ error: 'Sign in first' }),
  }));
  await new Promise(setImmediate);

  assert.strictEqual(elements.get('login-form').hidden, false);
  assert.strictEqual(elements.get('app').hidden, true);
  assert.strictEqual(elements.get('list').children.length, 0);
});

test('keeps the sign-in form visible if the session check fails', async () => {
  const elements = loadApp(async () => { throw new Error('Network error'); });
  await new Promise(setImmediate);

  assert.strictEqual(elements.get('login-form').hidden, false);
  assert.strictEqual(elements.get('app').hidden, true);
});
