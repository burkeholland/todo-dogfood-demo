const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const TEST_USER = { email: 'test@example.com', password: 'password123' };

function createApp() {
  const sessions = new Set();
  const todos = [];
  let nextId = 1;

  function send(res, status, body, headers = {}) {
    res.writeHead(status, { 'Content-Type': 'application/json', ...headers });
    res.end(JSON.stringify(body));
  }

  function readBody(req) {
    return new Promise((resolve) => {
      let data = '';
      req.on('data', (chunk) => (data += chunk));
      req.on('end', () => {
        try {
          resolve(data ? JSON.parse(data) : {});
        } catch {
          resolve({});
        }
      });
    });
  }

  function isSignedIn(req) {
    const match = /(?:^|;\s*)sid=([^;]+)/.exec(req.headers.cookie || '');
    return Boolean(match && sessions.has(match[1]));
  }

  function serveStatic(req, res) {
    const urlPath = req.url === '/' ? '/index.html' : req.url.split('?')[0];
    const file = path.join(__dirname, 'public', path.normalize(urlPath));
    if (!file.startsWith(path.join(__dirname, 'public'))) return send(res, 404, { error: 'Not found' });
    fs.readFile(file, (err, content) => {
      if (err) return send(res, 404, { error: 'Not found' });
      const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
      res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'text/plain' });
      res.end(content);
    });
  }

  return http.createServer(async (req, res) => {
    if (req.method === 'POST' && req.url === '/api/login') {
      const { email, password } = await readBody(req);
      if (email === TEST_USER.email && password === TEST_USER.password) {
        const sid = crypto.randomUUID();
        sessions.add(sid);
        return send(res, 200, { ok: true }, { 'Set-Cookie': `sid=${sid}; HttpOnly; Path=/` });
      }
      return send(res, 401, { error: 'Wrong email or password' });
    }

    if (req.url.startsWith('/api/todos')) {
      if (!isSignedIn(req)) return send(res, 401, { error: 'Sign in first' });
      if (req.method === 'GET') return send(res, 200, todos);
      if (req.method === 'POST') {
        const { text } = await readBody(req);
        if (!text || !String(text).trim()) return send(res, 400, { error: 'Text is required' });
        const todo = { id: nextId++, text: String(text).trim(), done: false };
        todos.push(todo);
        return send(res, 201, todo);
      }
      const id = Number(req.url.split('/')[3]);
      const index = todos.findIndex((t) => t.id === id);
      if (index === -1) return send(res, 404, { error: 'Not found' });
      if (req.method === 'PATCH') {
        todos[index].done = !todos[index].done;
        return send(res, 200, todos[index]);
      }
      if (req.method === 'DELETE') {
        todos.splice(index, 1);
        return send(res, 204, {});
      }
    }

    if (req.method === 'GET') return serveStatic(req, res);
    send(res, 404, { error: 'Not found' });
  });
}

if (require.main === module) {
  const port = Number(process.env.PORT) || 3000;
  createApp().listen(port, () => console.log(`Todo app running at http://localhost:${port}`));
}

module.exports = { createApp, TEST_USER };
