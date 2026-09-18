'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { apiRequest } from '../lib/api';

type Session = { user: { name: string; email: string }; organizations: { id: string; name: string; role: string }[] };

export default function AppShell({ children, title, eyebrow }: { children: React.ReactNode; title: string; eyebrow?: string }) {
  const router = useRouter(); const pathname = usePathname(); const [session, setSession] = useState<Session | null>(null);
  useEffect(() => { void apiRequest<Session>('/auth/me').then(setSession).catch(() => router.replace('/login')); }, [router]);
  const logout = async () => { await apiRequest('/auth/logout', { method: 'POST' }); router.replace('/login'); };
  if (!session) return <main className="loading-screen">Loading workspace...</main>;
  return <div className="app-frame"><aside className="sidebar"><Link href="/dashboard" className="brand"><span className="brand-mark">O</span><span>OpsPilot</span></Link><p className="nav-label">Workspace</p><nav className="nav-list"><Link className={pathname === '/dashboard' ? 'nav-link active' : 'nav-link'} href="/dashboard">Dashboard</Link><Link className={pathname.startsWith('/projects') || pathname.startsWith('/project') ? 'nav-link active' : 'nav-link'} href="/projects">Projects</Link><Link className={pathname.startsWith('/incidents') || pathname.startsWith('/incident') ? 'nav-link active' : 'nav-link'} href="/incidents">Incidents</Link></nav><div className="sidebar-footer"><strong>{session.user.name}</strong><span>{session.user.email}</span><button className="text-button" onClick={() => void logout()}>Log out</button></div></aside><main className="content"><header className="content-header"><div><p className="eyebrow">{eyebrow || session.organizations[0]?.name || 'Workspace'}</p><h1>{title}</h1></div><span className="role-chip">{session.organizations[0]?.role || 'MEMBER'}</span></header>{children}</main></div>;
}