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
