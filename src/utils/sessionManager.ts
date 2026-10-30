import { collection, addDoc, getDocs, query, where, orderBy, limit, deleteDoc, doc, Timestamp, writeBatch } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { format } from 'date-fns';

const SESSION_STORAGE_KEY = 'gym_lift_track_session_id';
const SESSION_START_KEY = 'gym_lift_track_session_start';

export interface FirebaseErrorRecord {
  id?: string;
  sessionId: string;
  sessionStartTime: number;
  sessionFormattedDate?: string;
  type: 'error' | 'warn' | 'exception' | 'rejection' | 'audit_failure' | 'bug_report';
  source: 'runtime' | 'console' | 'audit_app' | 'bug_report' | 'exception' | 'rejection';
  message: string;
  stack?: string;
  userId?: string | null;
  userEmail?: string | null;
  metadata?: Record<string, any>;
  createdAt: any;
  expiresAt: any;
}

export interface SessionSummary {
  sessionId: string;
  sessionStartTime: number;
  formattedDate: string;
  errorCount: number;
  userEmail?: string;
  isActive: boolean;
}

// 1. Get or create active session in sessionStorage
export function getActiveSessionId(): string {
  if (typeof window === 'undefined') return 'server_session';
  try {
    let sessId = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!sessId) {
      const now = Date.now();
      const rand = Math.random().toString(36).substring(2, 8);
      sessId = `sess_${now}_${rand}`;
      sessionStorage.setItem(SESSION_STORAGE_KEY, sessId);
      sessionStorage.setItem(SESSION_START_KEY, String(now));
    }
    return sessId;
  } catch {
    return 'fallback_session_' + Date.now();
  }
}

export function getActiveSessionStartTime(): number {
  if (typeof window === 'undefined') return Date.now();
  try {
    const raw = sessionStorage.getItem(SESSION_START_KEY);
    if (raw && !isNaN(Number(raw))) {
      return Number(raw);
    }
    const now = Date.now();
    sessionStorage.setItem(SESSION_START_KEY, String(now));
    return now;
  } catch {
    return Date.now();
  }
}

export function formatSessionDate(timestampMs: number): string {
  try {
    return format(new Date(timestampMs), 'dd/MM/yyyy HH:mm:ss');
  } catch {
    return new Date(timestampMs).toLocaleString();
  }
}

// 2. Register an error into Firebase for the session with 7-day TTL
let isLoggingError = false; // Prevent recursive error loops
export async function logErrorToFirebase(params: {
  type: FirebaseErrorRecord['type'];
  source: FirebaseErrorRecord['source'];
  message: string;
  stack?: string;
  metadata?: Record<string, any>;
  sessionId?: string;
}): Promise<string | null> {
  if (isLoggingError) return null;
  
  try {
    isLoggingError = true;
    const activeSessionId = params.sessionId || getActiveSessionId();
    const sessionStartTime = getActiveSessionStartTime();
    const now = Date.now();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    const expiresTimestamp = Timestamp.fromMillis(now + sevenDaysMs);
    const createdTimestamp = Timestamp.fromMillis(now);

    const currentUser = auth.currentUser;

    const payload: Omit<FirebaseErrorRecord, 'id'> = {
      sessionId: activeSessionId,
      sessionStartTime,
      sessionFormattedDate: formatSessionDate(sessionStartTime),
      type: params.type,
      source: params.source,
      message: params.message.slice(0, 2000), // Protect against wallet exhaustion / huge messages
      stack: params.stack ? params.stack.slice(0, 4000) : undefined,
      userId: currentUser?.uid || null,
      userEmail: currentUser?.email || null,
      metadata: params.metadata || {},
      createdAt: createdTimestamp,
      expiresAt: expiresTimestamp,
    };

    const docRef = await addDoc(collection(db, 'system_error_logs'), payload);
    return docRef.id;
  } catch (err) {
    // Silent fail in console to prevent runaway error loop
    return null;
  } finally {
    isLoggingError = false;
  }
}

// 3. Purge errors older than 7 days automatically from database
let lastPurgeTime = 0;
export async function purgeExpiredErrorLogs(): Promise<number> {
  // Only purge once every 5 minutes max to avoid excessive operations
  const now = Date.now();
  if (now - lastPurgeTime < 5 * 60 * 1000) {
    return 0;
  }
  lastPurgeTime = now;

  try {
    const sevenDaysAgo = Timestamp.fromMillis(now - 7 * 24 * 60 * 60 * 1000);
    const q = query(
      collection(db, 'system_error_logs'),
      where('createdAt', '<', sevenDaysAgo),
      limit(100)
    );

    const snapshot = await getDocs(q);
    if (snapshot.empty) return 0;

    const batch = writeBatch(db);
    snapshot.docs.forEach((docSnap) => {
      batch.delete(docSnap.ref);
    });

    await batch.commit();
    return snapshot.size;
  } catch {
    // If user is not admin or rules prevent bulk delete, fail gracefully
    return 0;
  }
}

// 4. Fetch all sessions sorted by Date/Hours descending
export async function fetchSessionsFromFirebase(): Promise<SessionSummary[]> {
  const activeId = getActiveSessionId();
  const activeStart = getActiveSessionStartTime();

  const sessionsMap = new Map<string, SessionSummary>();

  // Initialize active session
  sessionsMap.set(activeId, {
    sessionId: activeId,
    sessionStartTime: activeStart,
    formattedDate: formatSessionDate(activeStart),
    errorCount: 0,
    userEmail: auth.currentUser?.email || undefined,
    isActive: true,
  });

  try {
    // Fetch recent error logs up to 300 to aggregate sessions
    const q = query(
      collection(db, 'system_error_logs'),
      orderBy('createdAt', 'desc'),
      limit(300)
    );
    const snapshot = await getDocs(q);

    snapshot.docs.forEach((docSnap) => {
      const data = docSnap.data() as FirebaseErrorRecord;
      const sId = data.sessionId || 'unknown_session';
      const sStart = data.sessionStartTime || (data.createdAt?.toMillis ? data.createdAt.toMillis() : Date.now());

      const existing = sessionsMap.get(sId);
      if (existing) {
        existing.errorCount += 1;
        if (!existing.userEmail && data.userEmail) {
          existing.userEmail = data.userEmail;
        }
      } else {
        sessionsMap.set(sId, {
          sessionId: sId,
          sessionStartTime: sStart,
          formattedDate: formatSessionDate(sStart),
          errorCount: 1,
          userEmail: data.userEmail || undefined,
          isActive: sId === activeId,
        });
      }
    });
  } catch (err) {
    // If fetching fails, fallback to active session
  }

  // Sort by date/hours descending (most recent first)
  return Array.from(sessionsMap.values()).sort((a, b) => b.sessionStartTime - a.sessionStartTime);
}

// 5. Fetch errors for a specific session (or all)
export async function fetchErrorsForSession(sessionId: string): Promise<FirebaseErrorRecord[]> {
  try {
    let q;
    if (sessionId === 'all') {
      q = query(
        collection(db, 'system_error_logs'),
        orderBy('createdAt', 'desc'),
        limit(200)
      );
    } else {
      q = query(
        collection(db, 'system_error_logs'),
        where('sessionId', '==', sessionId),
        orderBy('createdAt', 'desc'),
        limit(150)
      );
    }

    const snapshot = await getDocs(q);
    return snapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...(docSnap.data() as Omit<FirebaseErrorRecord, 'id'>),
    }));
  } catch (err) {
    return [];
  }
}
