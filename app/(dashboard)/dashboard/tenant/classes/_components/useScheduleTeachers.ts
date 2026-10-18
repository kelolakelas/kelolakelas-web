'use client';

import { useEffect, useRef, useState } from 'react';
import { getScheduleTeachers } from '../_actions/classActions';
import type { ScheduleTeachersRead } from '../_lib/teachers';

/** Retry only the read; callers own their drafts and selected membership IDs. */
export function useScheduleTeachers() {
  const [read, setRead] = useState<ScheduleTeachersRead | null>(null);
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const busy = useRef(true);
  useEffect(() => {
    let active = true;
    busy.current = true;
    Promise.resolve()
      .then(getScheduleTeachers)
      .catch(() => ({ state: 'error' }) as const)
      .then((result) => {
        if (!active) return;
        setRead(result);
        setLoading(false);
        busy.current = false;
      });
    return () => {
      active = false;
    };
  }, [attempt]);
  const retry = () => {
    if (busy.current) return;
    busy.current = true;
    setLoading(true);
    setAttempt((value) => value + 1);
  };
  return { read, loading, retry };
}
