import {
  getAuth,
  onAuthStateChanged,
  signInAnonymously,
  linkWithCredential,
  EmailAuthProvider,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  GithubAuthProvider,
  User
} from 'firebase/auth';
import { app } from './firebaseCore';

export const auth = getAuth(app);

// Auto-ensure a user (anonymous allowed)
export function ensureUser(): Promise<User> {
  return new Promise((resolve, reject) => {
    onAuthStateChanged(auth, async (u) => {
      if (u) return resolve(u);
      try {
        const cred = await signInAnonymously(auth);
        resolve(cred.user);
      } catch (e) {
        reject(e);
      }
    });
  });
}

export async function upgradeAnonymous(email: string, password: string) {
  const user = auth.currentUser;
  if (!user) throw new Error('No user session.');
  if (!user.isAnonymous) throw new Error('Already upgraded.');
  const credential = EmailAuthProvider.credential(email, password);
  return linkWithCredential(user, credential);
}

export async function register(email: string, password: string) {
  const current = auth.currentUser;
  if (current && current.isAnonymous) {
    return upgradeAnonymous(email, password);
  }
  return createUserWithEmailAndPassword(auth, email, password);
}

export async function signIn(email: string, password: string) {
  return signInWithEmailAndPassword(auth, email, password);
}

// OAuth helpers
export async function signInWithGoogle() {
  const provider = new GoogleAuthProvider();
  return signInWithPopup(auth, provider);
}

export async function signInWithGitHub() {
  const provider = new GithubAuthProvider();
  return signInWithPopup(auth, provider);
}

// Dev-only helpers exposed on window to make it easy to fetch an ID token from the browser console
if (import.meta.env.DEV) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).auth = auth;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).ensureUser = ensureUser;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).getIdToken = async (force = true) => {
    const u = auth.currentUser || (await ensureUser());
    return u?.getIdToken(force);
  };
}