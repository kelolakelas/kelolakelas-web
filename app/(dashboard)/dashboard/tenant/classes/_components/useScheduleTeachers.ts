'use client';

import { createContext, createElement, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { getScheduleTeachers } from '../_actions/classActions';
import type { ScheduleTeachersRead } from '../_lib/teachers';

/** Retry only the read; callers own their drafts and selected membership IDs. */
function useTeacherRead(enabled = true) {
  const [read, setRead] = useState<ScheduleTeachersRead | null>(null);
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const busy = useRef(true);
  useEffect(() => {
    if (!enabled) return;
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
  }, [attempt, enabled]);
  const retry = useCallback(() => {
    if (busy.current) return;
    busy.current = true;
    setLoading(true);
    setAttempt((value) => value + 1);
  }, []);
  return { read, loading, retry };
}

type TeacherRead = ReturnType<typeof useTeacherRead>;
const TeacherContext = createContext<TeacherRead | null>(null);

/** One loader per open editor. Nothing is cached across editors or tenants. */
export function ScheduleTeachersProvider({ children }: { children: ReactNode }) {
  const value = useTeacherRead();
  return createElement(TeacherContext.Provider, { value }, children);
}

export function useScheduleTeachers() {
  const shared = useContext(TeacherContext);
  const standalone = useTeacherRead(shared === null);
  return shared ?? standalone;
}
