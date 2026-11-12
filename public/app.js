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

async function refresh() {
  const { data: todos } = await api('GET', '/api/todos');
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
  loginForm.hidden = true;
  app.hidden = false;
  refresh();
};

document.getElementById('add-form').onsubmit = async (event) => {
  event.preventDefault();
  const input = document.getElementById('new-todo');
  const error = document.getElementById('add-error');
  const { ok, data } = await api('POST', '/api/todos', { text: input.value });
  if (!ok) {
    error.textContent = data.error;
    return;
  }
  error.textContent = '';
  input.value = '';
  refresh();
};

if (typeof module !== 'undefined') module.exports = { itemsLeft };
