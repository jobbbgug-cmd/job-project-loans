'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

interface Todo {
  id: number;
  title: string;
  completed: boolean;
  created_at: string;
}

interface User {
  userId: number;
  email: string;
  name: string;
}

type Filter = 'all' | 'active' | 'completed';

function TodoItem({
  todo,
  onToggle,
  onDelete,
  onEdit,
}: {
  todo: Todo;
  onToggle: (id: number, completed: boolean) => void;
  onDelete: (id: number) => void;
  onEdit: (id: number, title: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(todo.title);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  function startEdit() {
    setDraft(todo.title);
    setEditing(true);
  }

  async function commitEdit() {
    const trimmed = draft.trim();
    if (!trimmed) {
      setDraft(todo.title);
      setEditing(false);
      return;
    }
    if (trimmed !== todo.title) {
      await onEdit(todo.id, trimmed);
    }
    setEditing(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') commitEdit();
    if (e.key === 'Escape') {
      setDraft(todo.title);
      setEditing(false);
    }
  }

  return (
    <li className="flex items-center gap-3 px-5 py-3.5 group hover:bg-gray-50 transition-colors">
      <input
        type="checkbox"
        checked={todo.completed}
        onChange={() => onToggle(todo.id, todo.completed)}
        className="w-4 h-4 rounded accent-indigo-600 cursor-pointer flex-shrink-0"
      />

      {editing ? (
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={handleKeyDown}
          className="flex-1 text-sm border border-indigo-300 rounded px-2 py-0.5 focus:outline-none focus:ring-2 focus:ring-indigo-400"
        />
      ) : (
        <span
          onDoubleClick={startEdit}
          title="Double-click to edit"
          className={`flex-1 text-sm cursor-text select-none ${
            todo.completed ? 'line-through text-gray-400' : 'text-gray-700'
          }`}
        >
          {todo.title}
        </span>
      )}

      <button
        onClick={() => onDelete(todo.id)}
        className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 transition-all text-base leading-none flex-shrink-0"
        aria-label="Delete"
      >
        ✕
      </button>
    </li>
  );
}

export default function TodosPage() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [input, setInput] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    Promise.all([
      fetch('/api/auth/me').then((r) => r.json()).then(setUser),
      fetch('/api/todos').then((r) => r.json()).then(setTodos),
    ]).finally(() => setLoading(false));
  }, []);

  async function addTodo(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim()) return;
    const res = await fetch('/api/todos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: input.trim() }),
    });
    if (res.ok) {
      const todo = await res.json();
      setTodos((prev) => [todo, ...prev]);
      setInput('');
    }
  }

  async function toggleTodo(id: number, completed: boolean) {
    const res = await fetch(`/api/todos/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ completed: !completed }),
    });
    if (res.ok) {
      setTodos((prev) => prev.map((t) => (t.id === id ? { ...t, completed: !completed } : t)));
    }
  }

  async function editTodo(id: number, title: string) {
    const res = await fetch(`/api/todos/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title }),
    });
    if (res.ok) {
      setTodos((prev) => prev.map((t) => (t.id === id ? { ...t, title } : t)));
    }
  }

  async function deleteTodo(id: number) {
    const res = await fetch(`/api/todos/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setTodos((prev) => prev.filter((t) => t.id !== id));
    }
  }

  async function clearCompleted() {
    const completed = todos.filter((t) => t.completed);
    await Promise.all(completed.map((t) => fetch(`/api/todos/${t.id}`, { method: 'DELETE' })));
    setTodos((prev) => prev.filter((t) => !t.completed));
  }

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  }

  const filtered = todos.filter((t) => {
    if (filter === 'active') return !t.completed;
    if (filter === 'completed') return t.completed;
    return true;
  });

  const activeCount = todos.filter((t) => !t.completed).length;
  const completedCount = todos.filter((t) => t.completed).length;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-400 text-sm">Loading…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-indigo-600">TodoApp</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-500">
              Hello, <span className="font-medium text-gray-700">{user?.name}</span>
            </span>
            <button
              onClick={logout}
              className="text-sm text-gray-400 hover:text-red-500 transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8">
        <form onSubmit={addTodo} className="flex gap-3 mb-8">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="What needs to be done?"
            className="flex-1 rounded-xl border border-gray-200 px-4 py-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent bg-white"
          />
          <button
            type="submit"
            className="bg-indigo-600 text-white px-6 py-3 rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors shadow-sm"
          >
            Add
          </button>
        </form>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="flex border-b border-gray-100">
            {(['all', 'active', 'completed'] as Filter[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`flex-1 py-3 text-sm font-medium capitalize transition-colors ${
                  filter === f
                    ? 'text-indigo-600 border-b-2 border-indigo-600 -mb-px'
                    : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                {f}
                {f === 'active' && activeCount > 0 && (
                  <span className="ml-1.5 bg-indigo-100 text-indigo-600 text-xs rounded-full px-1.5 py-0.5 font-semibold">
                    {activeCount}
                  </span>
                )}
              </button>
            ))}
          </div>

          {filtered.length === 0 ? (
            <div className="py-16 text-center text-gray-400 text-sm">
              {filter === 'all' ? 'No todos yet — add one above!' : `No ${filter} todos.`}
            </div>
          ) : (
            <ul className="divide-y divide-gray-50">
              {filtered.map((todo) => (
                <TodoItem
                  key={todo.id}
                  todo={todo}
                  onToggle={toggleTodo}
                  onDelete={deleteTodo}
                  onEdit={editTodo}
                />
              ))}
            </ul>
          )}

          {todos.length > 0 && (
            <div className="px-5 py-3 border-t border-gray-50 flex items-center justify-between">
              <span className="text-xs text-gray-400">
                {activeCount} item{activeCount !== 1 ? 's' : ''} left
              </span>
              {completedCount > 0 && (
                <button
                  onClick={clearCompleted}
                  className="text-xs text-gray-400 hover:text-red-400 transition-colors"
                >
                  Clear completed
                </button>
              )}
            </div>
          )}
        </div>

        <p className="text-center text-xs text-gray-300 mt-6">Double-click a todo to edit its title</p>
      </main>
    </div>
  );
}
