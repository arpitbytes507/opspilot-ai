'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

import { apiRequest } from '../../lib/api';

type CurrentUser = {
  user: { name: string; email: string };
  organizations: { id: string; name: string; role: string }[];
};

export default function DashboardPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    void apiRequest<CurrentUser>('/auth/me')
      .then(setCurrentUser)
      .catch((requestError: unknown) => {
        setError(requestError instanceof Error ? requestError.message : 'Authentication required');
        router.replace('/login');
      });
  }, [router]);

  const logout = async () => {
    await apiRequest('/auth/logout', { method: 'POST' });
    router.replace('/login');
  };

  if (error || !currentUser) {
    return <main className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-300">Loading workspace...</main>;
  }

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-12 text-slate-100">
      <div className="mx-auto max-w-5xl">
        <header className="flex items-start justify-between border-b border-slate-800 pb-8">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-sky-300">OpsPilot AI</p>
            <h1 className="mt-3 text-4xl font-bold text-white">Welcome, {currentUser.user.name}</h1>
            <p className="mt-2 text-slate-400">{currentUser.user.email}</p>
          </div>
          <button onClick={() => void logout()} className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-sky-400 hover:text-white">Log out</button>
        </header>
        <section className="mt-10">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Organizations</p>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {currentUser.organizations.map((organization) => (
              <article key={organization.id} className="rounded-xl border border-slate-800 bg-slate-900 p-5">
                <h2 className="text-lg font-semibold text-white">{organization.name}</h2>
                <p className="mt-2 text-sm text-sky-300">{organization.role}</p>
              </article>
            ))}
          </div>
          <Link href="/projects" className="mt-6 inline-block rounded-lg bg-sky-400 px-4 py-3 font-semibold text-slate-950">Manage projects</Link>
        </section>
      </div>
    </main>
  );
}
