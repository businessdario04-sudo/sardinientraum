'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, Eye, EyeOff, Loader2, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('dispatcher@meridian.io');
  const [password, setPassword] = useState('demo1234');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!email || !password) { setError('Please enter email and password.'); return; }
    setLoading(true);
    setTimeout(() => {
      sessionStorage.setItem('ops_auth', JSON.stringify({ email, name: 'Alex (Dispatcher)' }));
      router.push('/dashboard');
    }, 800);
  }

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4">
      {/* Card */}
      <div className="w-full max-w-sm">
        {/* Brand */}
        <div className="flex flex-col items-center mb-8">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500 mb-4">
            <Building2 className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-xl font-bold text-white">Ops Co-Pilot</h1>
          <p className="text-sm text-slate-400 mt-1">Facility Management Platform</p>
        </div>

        <div className="rounded-xl bg-white p-8 shadow-2xl">
          <h2 className="text-lg font-semibold text-slate-900 mb-1">Sign in</h2>
          <p className="text-sm text-slate-500 mb-6">Access your operations dashboard</p>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <Label htmlFor="email" className="mb-1.5 block">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                autoComplete="email"
              />
            </div>
            <div>
              <Label htmlFor="password" className="mb-1.5 block">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="pr-9"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error && <p className="text-xs text-red-600">{error}</p>}

            <Button type="submit" variant="primary" className="w-full" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Sign in'}
            </Button>
          </form>

          {/* Demo hint */}
          <div className="mt-5 rounded-lg bg-slate-50 border border-slate-200 p-3">
            <div className="flex items-center gap-2 mb-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-slate-400" />
              <span className="text-xs font-medium text-slate-500">Demo credentials</span>
            </div>
            <p className="text-xs text-slate-500">Email: <code className="text-slate-700">dispatcher@meridian.io</code></p>
            <p className="text-xs text-slate-500">Password: <code className="text-slate-700">demo1234</code></p>
          </div>
        </div>

        <p className="text-center text-xs text-slate-500 mt-6">
          Ops Co-Pilot MVP — AI-assisted Facility Management
        </p>
      </div>
    </div>
  );
}
