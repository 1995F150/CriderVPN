'use client';

import { useEffect, useState } from 'react';

type DomainRule = {
  id: string | number;
  domain: string;
  action: 'ALLOW' | 'BLOCK';
  kind: 'exact' | 'regex';
  enabled: boolean;
  comment: string;
};

export default function RulesPage() {
  const [rules, setRules] = useState<DomainRule[]>([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const response = await fetch('/api/v1/rules');
    const body = await response.json();
    if (!response.ok) {
      setError(body.details || body.error || 'Unable to load Pi-hole domains');
      setRules([]);
      return;
    }
    setRules(body);
    setError('');
  };

  useEffect(() => { load(); }, []);

  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    const form = event.currentTarget;
    const formData = new FormData(form);
    const response = await fetch('/api/v1/rules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        domain: formData.get('domain'),
        action: formData.get('action'),
        kind: formData.get('kind'),
        comment: formData.get('comment')
      })
    });
    const body = await response.json().catch(() => ({}));
    setSaving(false);
    if (!response.ok) {
      setError(body.details || body.error || 'Unable to save Pi-hole domain rule');
      return;
    }
    form.reset();
    await load();
  };

  const remove = async (rule: DomainRule) => {
    const response = await fetch('/api/v1/rules', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rule)
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(body.details || body.error || 'Unable to delete Pi-hole domain rule');
      return;
    }
    await load();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Pi-hole Allow & Block Rules</h1>
        <p className="text-sm text-slate-400">These changes are written directly to Pi-hole—not a disconnected local rules database.</p>
      </div>

      {error && <div className="rounded border border-amber-700 bg-amber-950/30 p-4 text-amber-200">{error}</div>}

      <form onSubmit={save} className="grid gap-3 rounded-xl border border-slate-800 bg-slate-900 p-5 md:grid-cols-2 xl:grid-cols-5">
        <input name="domain" required aria-label="Domain" className="rounded border border-slate-700 bg-slate-950 p-2" placeholder="example.com" />
        <select name="action" className="rounded border border-slate-700 bg-slate-950 p-2">
          <option value="BLOCK">Block</option>
          <option value="ALLOW">Allow</option>
        </select>
        <select name="kind" className="rounded border border-slate-700 bg-slate-950 p-2">
          <option value="exact">Exact domain</option>
          <option value="regex">Regular expression</option>
        </select>
        <input name="comment" aria-label="Comment" className="rounded border border-slate-700 bg-slate-950 p-2" placeholder="Optional note" />
        <button disabled={saving} className="rounded bg-blue-600 px-4 py-2 font-medium disabled:opacity-50">{saving ? 'Saving…' : 'Add to Pi-hole'}</button>
      </form>

      <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900">
        <table className="min-w-full divide-y divide-slate-800">
          <thead><tr>{['Domain', 'List', 'Match', 'Status', ''].map(label => <th key={label} className="px-5 py-3 text-left text-xs uppercase text-slate-400">{label}</th>)}</tr></thead>
          <tbody className="divide-y divide-slate-800">
            {rules.map(rule => (
              <tr key={rule.id}>
                <td className="px-5 py-3 font-mono text-sm">{rule.domain}</td>
                <td className={`px-5 py-3 text-sm font-medium ${rule.action === 'BLOCK' ? 'text-red-400' : 'text-emerald-400'}`}>{rule.action}</td>
                <td className="px-5 py-3 text-sm text-slate-400">{rule.kind}</td>
                <td className="px-5 py-3 text-sm">{rule.enabled ? 'Enabled' : 'Disabled'}</td>
                <td className="px-5 py-3 text-right"><button onClick={() => remove(rule)} className="text-sm text-red-400 hover:text-red-300">Delete</button></td>
              </tr>
            ))}
            {!rules.length && <tr><td colSpan={5} className="px-5 py-10 text-center text-slate-500">No Pi-hole domain rules returned.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
