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
  };
  const source = fs.readFileSync(path.join(__dirname, '../public/app.js'), 'utf8');
  vm.runInNewContext(source, context);

  assert.strictEqual(context.module.exports.itemsLeft([{ done: true }]), 0);
  assert.strictEqual(context.module.exports.itemsLeft([{ done: false }, { done: true }]), 1);
});

test('shows todo submission errors and preserves input until a successful submission', async () => {
  const elements = new Map();
  const requests = [];
  let response = { ok: false, data: { error: 'Text is required' } };
  const context = {
    document: {
      getElementById(id) {
        if (!elements.has(id)) elements.set(id, { value: '', textContent: '' });
        return elements.get(id);
      },
    },
    fetch: async (url, options) => {
      requests.push({ url, ...options });
      if (options.method === 'GET') return { status: 200, ok: true, json: async () => [] };
      return { status: 200, ok: response.ok, json: async () => response.data };
    },
  };
  const source = fs.readFileSync(path.join(__dirname, '../public/app.js'), 'utf8');
  vm.runInNewContext(source, context);

  const input = elements.get('new-todo') || context.document.getElementById('new-todo');
  const error = context.document.getElementById('add-error');
  const submit = elements.get('add-form').onsubmit;
  for (const value of ['', '   ']) {
    input.value = value;
    await submit({ preventDefault() {} });
    assert.strictEqual(error.textContent, 'Text is required');
    assert.strictEqual(input.value, value);
  }
  assert.strictEqual(requests.length, 2);

  response = { ok: true, data: { text: 'Buy milk' } };
  input.value = 'Buy milk';
  await submit({ preventDefault() {} });
  assert.strictEqual(error.textContent, '');
  assert.strictEqual(input.value, '');
  assert.strictEqual(requests[2].method, 'POST');
  assert.strictEqual(JSON.parse(requests[2].body).text, 'Buy milk');
  assert.strictEqual(requests[3].method, 'GET');
});

test('todo submission errors are announced', () => {
  const html = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');
  assert.match(html, /<[^>]+id="add-error"[^>]+role="alert"/);
});
