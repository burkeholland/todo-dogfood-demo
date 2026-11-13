const loginForm = document.getElementById('login-form');
const app = document.getElementById('app');
const list = document.getElementById('list');
const count = document.getElementById('count');

async function api(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.status === 204 ? null : res.json().then((data) => ({ ok: res.ok, data }));
}

function itemsLeft(todos) {
  return todos.filter((t) => !t.done).length;
}

let refreshGeneration = 0;
let signedOut = false;

async function refresh() {
  const generation = ++refreshGeneration;
  const { ok, data: todos } = await api('GET', '/api/todos');
  if (signedOut || generation !== refreshGeneration || !ok) return;
  loginForm.hidden = true;
  app.hidden = false;
  list.innerHTML = '';
  for (const todo of todos) {
    const li = document.createElement('li');
    li.className = todo.done ? 'done' : '';
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.checked = todo.done;
    box.setAttribute('aria-label', `Mark "${todo.text}" done`);
    box.onchange = async () => {
      await api('PATCH', `/api/todos/${todo.id}`);
      refresh();
    };
    const text = document.createElement('span');
    text.textContent = todo.text;
    const del = document.createElement('button');
    del.textContent = 'Delete';
    del.onclick = async () => {
      await api('DELETE', `/api/todos/${todo.id}`);
      refresh();
    };
    li.append(box, text, del);
    list.append(li);
  }
  const left = itemsLeft(todos);
  count.textContent = `${left} ${left === 1 ? 'item' : 'items'} left`;
}

loginForm.onsubmit = async (event) => {
  event.preventDefault();
  const { ok, data } = await api('POST', '/api/login', {
    email: document.getElementById('email').value,
    password: document.getElementById('password').value,
  });
  if (!ok) {
    document.getElementById('login-error').textContent = data.error;
    return;
  }
  signedOut = false;
  loginForm.hidden = true;
  app.hidden = false;
  refresh();
};

document.getElementById('logout').onclick = async () => {
  signedOut = true;
  refreshGeneration++;
  try {
    await api('POST', '/api/logout');
  } catch {}
  app.hidden = true;
  loginForm.hidden = false;
};

document.getElementById('add-form').onsubmit = async (event) => {
  event.preventDefault();
  const input = document.getElementById('new-todo');
  const text = input.value;
  const { ok } = await api('POST', '/api/todos', { text });
  if (ok && input.value === text) input.value = '';
  refresh();
};

refresh().catch(() => {});

if (typeof module !== 'undefined') module.exports = { itemsLeft };
