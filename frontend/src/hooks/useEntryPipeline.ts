import { useEffect, useRef, useState } from 'react';
import {
  doc,
  onSnapshot,
  query,
  collection,
  where,
  limit
} from 'firebase/firestore';
import { db } from '../firebaseCore';

interface Insight { insightId: string; entryId: string; userId: string; emotions?: any; enforcement?: 'off'|'soft'|'hard'; }
interface Capsule { capsuleId: string; insightId: string; userId: string; summary?: string; type?: string; content?: string; }
interface AlertDoc { alertId: string; insightId: string; userId: string; riskType: string; resources?: { label: string; url?: string }[] }

export function useEntryPipeline(entryId: string | null) {
  const [processed, setProcessed] = useState(false);
  const [insight, setInsight] = useState<Insight | null>(null);
  const [capsule, setCapsule] = useState<Capsule | null>(null);
  const [alert, setAlert] = useState<AlertDoc | null>(null);
  const [loading, setLoading] = useState(false);
  const subs = useRef<(() => void)[]>([]);

  useEffect(() => {
    subs.current.forEach(u => u());
    subs.current = [];
    setProcessed(false);
    setInsight(null);
    setCapsule(null);
    setAlert(null);
    setLoading(!!entryId);

    if (!entryId) return;

    const entryUnsub = onSnapshot(doc(db, 'entries', entryId), snap => {
      if (!snap.exists()) return;
      const data = snap.data() as any;
      const isProcessed = Boolean(data.processed);
      if (isProcessed && !processed) {
        setProcessed(true);
        // As soon as processed is true, stop showing analyzing; downstream listeners will populate shortly
        setLoading(false);
        // Watch insight
        const iq = query(collection(db, 'insights'), where('entryId', '==', entryId), limit(1));
        const iu = onSnapshot(iq, qs => {
          qs.forEach(d => {
            const ins = d.data() as Insight;
            setInsight(ins);
            // Stop loading as soon as we have an insight
            setLoading(false);
            // Capsule
            const cq = query(collection(db, 'capsules'), where('insightId', '==', ins.insightId), limit(1));
            const cu = onSnapshot(cq, cqs => {
              cqs.forEach(c => {
                setCapsule(c.data() as Capsule);
                // Definitely not loading once capsule arrives
                setLoading(false);
              });
            });
            subs.current.push(cu);
            // Alert
            const aq = query(collection(db, 'alerts'), where('insightId', '==', ins.insightId), limit(1));
            const au = onSnapshot(aq, aqs => {
              aqs.forEach(a => setAlert(a.data() as AlertDoc));
            });
            subs.current.push(au);
          });
        });
        subs.current.push(iu);
      }
    });

    subs.current.push(entryUnsub);
    return () => {
      subs.current.forEach(u => u());
      subs.current = [];
    };
  }, [entryId]);

  useEffect(() => {
    if (processed && (insight || capsule)) {
      setLoading(false);
    }
  }, [processed, insight, capsule]);

  return { processed, insight, capsule, alert, loading };
}