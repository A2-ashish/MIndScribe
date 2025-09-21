import React, { useState } from 'react';
import { auth, signInWithGoogle, signInWithGitHub, signIn, register, upgradeAnonymous } from '../auth';
import { connectBackend } from '../services/connectBackend';
import { Button } from './ui/button';
import { useToast } from './ui/toast';
import { useAuthUser } from '../hooks/useAuthUser';

export function LoginPanel() {
  const user = useAuthUser();
  const isAnon = !user || user.isAnonymous;
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [loading, setLoading] = useState<'none' | 'google' | 'github' | 'login' | 'register' | 'upgrade'>('none');
  const [msg, setMsg] = useState<string | null>(null);
  const { show } = useToast();

  function mapAuthError(kind: typeof loading, e: any): string {
    const code = e?.code || '';
    if (kind === 'login') {
      if (code === 'auth/wrong-password' || code === 'auth/user-not-found' || code === 'auth/invalid-credential') {
        return 'Incorrect email or password.';
      }
    }
    if (code === 'auth/too-many-requests') return 'Too many attempts. Please try again later.';
    if (code === 'auth/network-request-failed') return 'Network error. Check your connection and try again.';
    if (code === 'auth/email-already-in-use') return 'Email already in use.';
    if (code === 'auth/weak-password') return 'Password is too weak (min 6 characters).';
    if (code === 'auth/popup-closed-by-user') return 'Sign-in was cancelled.';
    return e?.message || 'Authentication failed.';
  }

  async function run(kind: typeof loading) {
    setLoading(kind);
    setMsg(null);
    try {
  if (kind === 'google') await signInWithGoogle();
  else if (kind === 'github') await signInWithGitHub();
  else if (kind === 'login') await signIn(email, pw);
  else if (kind === 'register') await register(email, pw);
  else if (kind === 'upgrade') await upgradeAnonymous(email, pw);
  // After any successful auth action, connect to backend (best-effort)
  await connectBackend();
      const successText = kind === 'upgrade' ? 'Progress saved to your email.' : 'Signed in successfully.';
      setMsg(successText);
      show({ variant: 'success', title: 'Success', description: successText, duration: 3000 });
    } catch (e: any) {
      const err = mapAuthError(kind, e);
      setMsg(err);
      show({ variant: 'error', title: 'Auth error', description: err, duration: 4000 });
    } finally {
      setLoading('none');
    }
  }

  return (
    <div className="panel" id="save-progress">
      <h3 style={{ marginTop: 0 }}>{isAnon ? 'Save your progress' : 'Sign in'}</h3>
      {isAnon && (
        <p style={{ marginTop: -6, marginBottom: 10, opacity: 0.8 }}>
          You’re playing as a guest. Link your email to keep your entries, stats, and achievements across devices.
        </p>
      )}
      <div style={{ display: 'grid', gap: 8, gridTemplateColumns: '1fr 1fr' }}>
        <Button variant="secondary" onClick={() => run('google')} disabled={loading !== 'none'}>
          {loading === 'google' ? '…' : 'Continue with Google'}
        </Button>
        <Button variant="secondary" onClick={() => run('github')} disabled={loading !== 'none'}>
          {loading === 'github' ? '…' : 'Continue with GitHub'}
        </Button>
      </div>
      <div style={{ opacity: 0.75, margin: '8px 0' }}>or</div>
      <div style={{ display: 'grid', gap: 8 }}>
        <input placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input placeholder="Password (min 6)" type="password" value={pw} onChange={(e) => setPw(e.target.value)} />
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {isAnon ? (
            <>
              <Button onClick={() => run('upgrade')} disabled={loading !== 'none' || email.length < 3 || pw.length < 6}>
                {loading === 'upgrade' ? 'Saving…' : 'Save progress to email'}
              </Button>
              <Button variant="outline" onClick={() => run('register')} disabled={loading !== 'none' || email.length < 3 || pw.length < 6}>Register new account</Button>
              <Button variant="ghost" onClick={() => run('login')} disabled={loading !== 'none' || email.length < 3 || pw.length < 6}>Login to existing</Button>
            </>
          ) : (
            <>
              <Button onClick={() => run('login')} disabled={loading !== 'none' || email.length < 3 || pw.length < 6}>Login</Button>
              <Button variant="outline" onClick={() => run('register')} disabled={loading !== 'none' || email.length < 3 || pw.length < 6}>Register</Button>
            </>
          )}
        </div>
      </div>
      {msg && <div style={{ marginTop: 8, fontSize: '0.9rem' }}>{msg}</div>}
    </div>
  );
}
