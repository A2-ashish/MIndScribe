import { useState } from 'react';
import { auth, upgradeAnonymous, signIn, register } from '../auth';

export function AccountUpgrade() {
  const user = auth.currentUser;
  const [mode, setMode] = useState<'upgrade' | 'login' | 'register'>('upgrade');
  const [email,setEmail] = useState('');
  const [pw,setPw] = useState('');
  const [msg,setMsg] = useState<string | null>(null);
  const [loading,setLoading] = useState(false);

  if (!user) return null;

  const isAnon = user.isAnonymous;

  async function act() {
    setLoading(true);
    setMsg(null);
    try {
      if (mode === 'upgrade') {
        await upgradeAnonymous(email, pw);
        setMsg('Upgraded successfully.');
      } else if (mode === 'login') {
        await signIn(email, pw);
        setMsg('Signed in.');
      } else {
        await register(email, pw);
        setMsg(isAnon ? 'Upgraded anonymously.' : 'Registered.');
      }
    } catch (e:any) {
      setMsg(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="panel">
      <h3>{isAnon ? 'Save Your Progress' : 'Account'}</h3>
      {isAnon && (
        <p>Create an account to keep entries across devices.</p>
      )}
      {!isAnon && <p>Signed in as {user.email}</p>}
      <div style={{display:'flex', gap:'0.5rem', marginBottom:'0.5rem'}}>
        <button
          className={mode==='upgrade' ? 'secondary-active':'secondary'}
          onClick={() => setMode('upgrade')}
          disabled={!isAnon}
        >Upgrade</button>
        <button
          className={mode==='login' ? 'secondary-active':'secondary'}
          onClick={() => setMode('login')}
        >Login</button>
        <button
          className={mode==='register' ? 'secondary-active':'secondary'}
          onClick={() => setMode('register')}
        >Register</button>
      </div>
      <input
        placeholder="Email"
        type="email"
        value={email}
        onChange={e=>setEmail(e.target.value)}
      />
      <input
        placeholder="Password (min 6)"
        type="password"
        value={pw}
        onChange={e=>setPw(e.target.value)}
      />
      <button
        disabled={loading || email.length<3 || pw.length<6 || (!isAnon && mode==='upgrade')}
        onClick={act}
      >
        {loading ? 'Working...' : mode === 'upgrade' ? 'Upgrade' : mode === 'login' ? 'Login' : 'Register'}
      </button>
      {msg && <p style={{fontSize:'0.8rem', marginTop:'0.5rem'}}>{msg}</p>}
    </div>
  );
}