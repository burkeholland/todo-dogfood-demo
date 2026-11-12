const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFile, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { promisify } = require('node:util');

const browser = ['chromium', 'chromium-browser', 'google-chrome'].find((name) =>
  spawnSync(name, ['--version']).status === 0);

test('long todo text and controls fit a narrow viewport', { skip: !browser && 'Chrome or Chromium is not installed' }, async () => {
  const css = fs.readFileSync(path.join(__dirname, '../public/style.css'), 'utf8');
  const text = 'Checkwhetheraverylongunbrokentodowordwilloverflowthelayoutonasmallmobileviewportbecausepeoplemaypastealongidentifierorword';
  const fixture = `<!doctype html><meta name="viewport" content="width=device-width, initial-scale=1">
    <style>${css}</style><main><section><ul id="list"><li>
    <input type="checkbox"><span>${text}</span><button>Delete</button>
    </li></ul></section></main>`;
  const page = `<!doctype html><body><script>
    const frame = document.createElement('iframe');
    frame.style.cssText = 'width:320px;height:700px;border:0';
    document.body.append(frame);
    const doc = frame.contentDocument;
    doc.open(); doc.write(${JSON.stringify(fixture)}); doc.close();
    const span = doc.querySelector('span');
    const checkbox = doc.querySelector('input');
    const button = doc.querySelector('button');
    document.body.textContent = JSON.stringify({
      viewport: doc.documentElement.clientWidth,
      pageWidth: doc.documentElement.scrollWidth,
      textWidth: span.scrollWidth,
      textBoxWidth: span.clientWidth,
      textHeight: span.getBoundingClientRect().height,
      checkboxLeft: checkbox.getBoundingClientRect().left,
      buttonRight: button.getBoundingClientRect().right
    });
  </script></body>`;
  const { stdout } = await promisify(execFile)(browser, [
    '--headless', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
    '--dump-dom', `data:text/html,${encodeURIComponent(page)}`,
  ], { timeout: 30000 });
  const result = JSON.parse(stdout.match(/<body>(.*?)<\/body>/s)[1]);

  assert.equal(result.viewport, 320);
  assert.ok(result.pageWidth <= result.viewport, 'page must not overflow');
  assert.ok(result.textWidth <= result.textBoxWidth, 'text must wrap within its box');
  assert.ok(result.textHeight > 30, 'long text must wrap onto multiple lines');
  assert.ok(result.checkboxLeft >= 0 && result.buttonRight <= result.viewport, 'controls must remain visible');
});
