'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function SetupWizard() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setMessage("Passwords do not match");
      return;
    }
    const response = await fetch('/api/auth/setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const data = await response.json();
    if (response.ok) {
      setMessage("Setup successful! Redirecting to login...");
      setTimeout(() => router.push('/login'), 2000);
    } else {
      setMessage(data.message || "Setup failed");
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen py-2">
      <h1 className="text-4xl font-bold mb-8">CriderShield Setup Wizard</h1>
      <form onSubmit={handleSubmit} className="w-full max-w-xs">
        <div className="mb-4">
          <label className="block text-gray-700 text-sm font-bold mb-2">Admin Username</label>
          <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} className="shadow border rounded w-full py-2 px-3 text-gray-700 focus:outline-none focus:shadow-outline" required />
        </div>
        <div className="mb-4">
          <label className="block text-gray-700 text-sm font-bold mb-2">Admin Password</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="shadow border rounded w-full py-2 px-3 text-gray-700 focus:outline-none focus:shadow-outline" required />
        </div>
        <div className="mb-6">
          <label className="block text-gray-700 text-sm font-bold mb-2">Confirm Password</label>
          <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="shadow border rounded w-full py-2 px-3 text-gray-700 focus:outline-none focus:shadow-outline" required />
        </div>
        <button type="submit" className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline w-full">Initialize System</button>
      </form>
      {message && <p className="mt-4 text-red-500">{message}</p>}
    </div>
  );
}
