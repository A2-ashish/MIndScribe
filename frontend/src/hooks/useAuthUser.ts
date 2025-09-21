import { useEffect, useState } from 'react';
import { auth } from '../auth';
import type { User } from 'firebase/auth';

export function useAuthUser() {
  const [user, setUser] = useState<User | null>(() => auth.currentUser);

  useEffect(() => {
    const unsub = auth.onAuthStateChanged((u) => {
      setUser(u);
    });
    return () => unsub();
  }, []);

    return user;
}
