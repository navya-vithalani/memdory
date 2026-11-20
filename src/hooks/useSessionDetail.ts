import { useEffect, useState } from 'react';
import { getSessionDetail, type SessionDetail } from '../data/repositories/cardRepository';

export function useSessionDetail(sessionId: string) {
  const [detail, setDetail] = useState<SessionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    getSessionDetail(sessionId)
      .then((loaded) => {
        if (!active) return;
        setDetail(loaded);
        setError(loaded ? '' : 'This session could not be found.');
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : 'Could not load this session.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [sessionId]);

  return { detail, loading, error };
}
