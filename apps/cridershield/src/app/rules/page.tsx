'use client';

import React, { useState, useEffect } from 'react';

type Rule = {
  id: number;
  priority?: number;
  type?: string;
  target?: string;
  domain?: string;
  category?: string;
  action?: string;
  enabled?: boolean;
};

export default function RulesPage() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [editing, setEditing] = useState<Rule | null>(null);

  const loadRules = async () => {
    const response = await fetch('/api/v1/rules');
    const data = await response.json();
    setRules(data);
  };

  useEffect(() => {
    loadRules();
  }, []);

  const save = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const form = e.currentTarget;

    const formData = Object.fromEntries(new FormData(form));

    const data = {
      ...formData,
      enabled: formData.enabled === 'on',
    };

    await fetch(
      editing ? `/api/v1/rules/${editing.id}` : '/api/v1/rules',
      {
        method: editing ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      }
    );

    setEditing(null);
    form.reset();
    loadRules();
  };

  const deleteRule = async (id: number) => {
    await fetch(`/api/v1/rules/${id}`, {
      method: 'DELETE',
    });

    loadRules();
  };

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold">Rules</h1>

      <form onSubmit={save} className="my-4 grid grid-cols-2 gap-4 border p-4">
        <select name="type" className="border p-2">
          <option value="global">Global</option>
          <option value="device">Device</option>
        </select>

        <input
          name="target"
          className="border p-2"
          placeholder="Target MAC"
        />

        <select name="action" className="border p-2">
          <option value="BLOCK">Block</option>
          <option value="ALLOW">Allow</option>
        </select>

        <input
          name="domain"
          className="border p-2"
          placeholder="domain.com"
        />

        <select name="category" className="border p-2">
          <option value="">Category</option>
          <option value="Ads">Ads</option>
        </select>

        <select name="schedule" className="border p-2">
          <option value="">Schedule</option>
          <option value="school-hours">School Hours</option>
        </select>

        <input
          name="priority"
          type="number"
          className="border p-2"
          placeholder="Priority"
        />

        <label className="flex items-center gap-2">
          <input name="enabled" type="checkbox" defaultChecked />
          Enabled
        </label>

        <button
          type="submit"
          className="bg-blue-600 text-white p-2 rounded"
        >
          Save Rule
        </button>
      </form>

      <table className="w-full border mt-4 text-left">
        <thead className="bg-gray-100">
          <tr>
            <th>Priority</th>
            <th>Type</th>
            <th>Rule</th>
            <th>Action</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>

        <tbody>
          {rules.map((rule) => (
            <tr key={rule.id} className="border-b">
              <td>{rule.priority}</td>
              <td>{rule.type}</td>
              <td>{rule.target || rule.domain || rule.category}</td>
              <td>{rule.action}</td>
              <td>{rule.enabled ? 'Enabled' : 'Disabled'}</td>
              <td>
                <button
                  onClick={() => setEditing(rule)}
                  className="mr-2 text-blue-600"
                >
                  Edit
                </button>

                <button
                  onClick={() => deleteRule(rule.id)}
                  className="text-red-600"
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
