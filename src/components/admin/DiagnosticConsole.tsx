import React, { useState, useEffect } from 'react';
import { 
  Terminal, ChevronDown, ChevronUp, Copy, CheckCircle, Trash2, 
  Play, AlertCircle, RefreshCw, Filter, ShieldAlert, Sparkles, Bug, 
  Database, Clock, Calendar, Check, Search, Activity
} from 'lucide-react';
import { consoleLogger, LogEntry } from '../../utils/consoleLogger';
import { 
  getActiveSessionId, 
  getActiveSessionStartTime, 
  formatSessionDate, 
  fetchSessionsFromFirebase, 
  fetchErrorsForSession, 
  purgeExpiredErrorLogs, 
  SessionSummary,
  FirebaseErrorRecord 
} from '../../utils/sessionManager';

interface UnifiedLog {
  id: string;
  timestamp: Date | string;
  type: string;
  source: string;
  message: string;
  stack?: string;
  sessionId?: string;
  userEmail?: string | null;
}

export default function DiagnosticConsole() {
  const [isOpen, setIsOpen] = useState(false);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string>(getActiveSessionId());
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  
  // Logs
  const [liveLogs, setLiveLogs] = useState<LogEntry[]>([]);
  const [cloudLogs, setCloudLogs] = useState<FirebaseErrorRecord[]>([]);
  const [copied, setCopied] = useState(false);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [searchFilter, setSearchFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [purgedCount, setPurgedCount] = useState<number | null>(null);

  // 1. Subscribe to live logger
  useEffect(() => {
    const unsubscribe = consoleLogger.subscribe((currentLogs) => {
      setLiveLogs(currentLogs);
    });
    return unsubscribe;
  }, []);

  // 2. Load sessions list & run automatic 7-day TTL cleanup
  useEffect(() => {
    loadSessions();
    runAutoPurge();
  }, []);

  // 3. When selectedSessionId changes, load logs for that session
  useEffect(() => {
    loadSessionLogs(selectedSessionId);
  }, [selectedSessionId]);

  const runAutoPurge = async () => {
    try {
      const count = await purgeExpiredErrorLogs();
      if (count > 0) setPurgedCount(count);
    } catch {
      // ignore
    }
  };

  const loadSessions = async () => {
    setIsLoadingSessions(true);
    try {
      const list = await fetchSessionsFromFirebase();
      setSessions(list);
    } catch (err) {
      console.error('Error loading sessions for console:', err);
    } finally {
      setIsLoadingSessions(false);
    }
  };

  const loadSessionLogs = async (sessionId: string) => {
    setIsLoadingLogs(true);
    try {
      const records = await fetchErrorsForSession(sessionId);
      setCloudLogs(records);
    } catch (err) {
      console.error('Error loading session logs:', err);
    } finally {
      setIsLoadingLogs(false);
    }
  };

  // Merge live and cloud logs if active session, otherwise show cloud logs
  const isActiveSession = selectedSessionId === getActiveSessionId();

  const unifiedLogs: UnifiedLog[] = React.useMemo(() => {
    const list: UnifiedLog[] = [];
    const seenMessages = new Set<string>();

    // Add cloud records
    cloudLogs.forEach((rec) => {
      const key = `${rec.sessionId}_${rec.message}_${rec.type}`;
      seenMessages.add(key);
      list.push({
        id: rec.id || Math.random().toString(36),
        timestamp: rec.createdAt?.toMillis ? new Date(rec.createdAt.toMillis()) : new Date(),
        type: rec.type,
        source: rec.source || 'runtime',
        message: rec.message,
        stack: rec.stack,
        sessionId: rec.sessionId,
        userEmail: rec.userEmail,
      });
    });

    // If active session, also include in-memory live logs that might not have committed yet
    if (isActiveSession) {
      liveLogs.forEach((log) => {
        const key = `${log.sessionId || getActiveSessionId()}_${log.message}_${log.type}`;
        if (!seenMessages.has(key)) {
          seenMessages.add(key);
          list.push({
            id: log.id,
            timestamp: log.timestamp,
            type: log.type,
            source: log.source || 'runtime',
            message: log.message,
            stack: log.stack,
            sessionId: log.sessionId || getActiveSessionId(),
          });
        }
      });
    }

    // Sort newest first
    return list.sort((a, b) => {
      const tA = a.timestamp instanceof Date ? a.timestamp.getTime() : new Date(a.timestamp).getTime();
      const tB = b.timestamp instanceof Date ? b.timestamp.getTime() : new Date(b.timestamp).getTime();
      return tB - tA;
    });
  }, [cloudLogs, liveLogs, isActiveSession]);

  // Filter logs by search and type
  const filteredLogs = unifiedLogs.filter((log) => {
    const matchesType =
      typeFilter === 'all' ||
      (typeFilter === 'audit' && (log.source === 'audit_app' || log.type === 'audit_failure')) ||
      (typeFilter === 'bug_report' && (log.source === 'bug_report' || log.type === 'bug_report')) ||
      (typeFilter === 'error' && log.type === 'error') ||
      (typeFilter === 'exception' && log.type === 'exception') ||
      (typeFilter === 'rejection' && log.type === 'rejection') ||
      (typeFilter === 'warn' && log.type === 'warn');

    const matchesSearch =
      log.message.toLowerCase().includes(searchFilter.toLowerCase()) ||
      (log.stack && log.stack.toLowerCase().includes(searchFilter.toLowerCase())) ||
      (log.source && log.source.toLowerCase().includes(searchFilter.toLowerCase()));

    return matchesType && matchesSearch;
  });

  const handleCopyLogs = () => {
    if (filteredLogs.length === 0) return;

    const sessionObj = sessions.find((s) => s.sessionId === selectedSessionId);
    const sessionLabel = sessionObj ? `${sessionObj.formattedDate} (${sessionObj.sessionId})` : selectedSessionId;

    const headerText = `=== GYM LIFT TRACK DIAGNOSTIC & ERROR CONSOLE ===\nSession: ${sessionLabel}\nExported At: ${new Date().toISOString()}\nTotal Logs: ${filteredLogs.length}\nAuto-Retention: 7 Days TTL Active\n===============================================\n\n`;

    const body = filteredLogs
      .map((log) => {
        const timeStr = log.timestamp instanceof Date ? log.timestamp.toLocaleTimeString() : new Date(log.timestamp).toLocaleTimeString();
        const header = `[${log.type.toUpperCase()}] [SRC: ${log.source?.toUpperCase() || 'RUNTIME'}] [${timeStr}]`;
        const stackStr = log.stack ? `\nStack Trace:\n${log.stack}` : '';
        return `${header}\n${log.message}${stackStr}\n-----------------------------------\n`;
      })
      .join('\n');

    navigator.clipboard
      .writeText(headerText + body)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      })
      .catch((err) => {
        console.error('Failed to copy text: ', err);
      });
  };

  // Test Triggers
  const handleTestError = () => {
    console.error(`Diagnostic console.error test event triggered at ${new Date().toLocaleTimeString()}!`);
  };

  const handleTriggerException = () => {
    setTimeout(() => {
      const someObj: any = null;
      try {
        someObj.nonExistentMethod();
      } catch (err: any) {
        console.error(err);
      }
    }, 40);
  };

  const handleTriggerRejection = () => {
    Promise.reject(new Error(`Async unhandled rejection test event at ${new Date().toLocaleTimeString()}`));
  };

  const handleTestAuditError = () => {
    consoleLogger.addAuditError(
      'Workout Engine Audit',
      `Simulated audit fault: 1RM calculation deviation exceeded tolerance limit at ${new Date().toLocaleTimeString()}`
    );
  };

  const handleTestBugReportError = () => {
    consoleLogger.addBugReportError(
      'User Bug Report: Rotary Torso Angle Desync',
      `Simulated user condition fault: Angle degrees out of range [-180, 180] at ${new Date().toLocaleTimeString()}`
    );
  };

  const handleClear = () => {
    consoleLogger.clearLogs();
    setCloudLogs([]);
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
      {/* Header Bar */}
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-800/50 transition select-none"
      >
        <div className="flex items-center gap-2.5 text-gray-900 dark:text-white">
          <div className="p-2 rounded-xl bg-red-50 dark:bg-red-950/20 text-red-500">
            <Terminal size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-sm leading-none">Diagnostic & Error Console</span>
              {unifiedLogs.length > 0 && (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-black bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400">
                  {unifiedLogs.length}
                </span>
              )}
            </div>
            <p className="text-[10px] text-gray-500 dark:text-slate-400 mt-0.5 font-medium">
              Captures session runtime errors, exceptions, Audit App faults & Bug Report logs (7-Day TTL)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 px-2 py-0.5 rounded-md border border-emerald-200/40 dark:border-emerald-800/40">
            <Clock size={11} /> 7-Day Auto Purge
          </span>
          {isOpen ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
        </div>
      </div>

      {/* Console Drawer Content */}
      {isOpen && (
        <div className="p-5 border-t border-gray-100 dark:border-slate-800 space-y-4 animate-in slide-in-from-top-2 duration-200">
          {/* Top Session Selector Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-gray-50/90 dark:bg-slate-950/80 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-xs">
            <div className="flex items-center gap-2.5 flex-1 min-w-0">
              <div className="p-2 rounded-xl bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 border border-red-100 dark:border-red-900/40 shrink-0">
                <Calendar size={15} />
              </div>
              <div className="space-y-1 flex-1 min-w-0">
                <label className="text-[10.5px] font-bold text-gray-600 dark:text-slate-400 uppercase font-mono tracking-wider block">
                  Select Session (Sorted by Date / Hours)
                </label>
                <div className="relative w-full">
                  <select
                    value={selectedSessionId}
                    onChange={(e) => setSelectedSessionId(e.target.value)}
                    className="w-full text-xs font-bold py-2 pl-3 pr-8 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl text-gray-900 dark:text-white truncate focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 dark:focus:border-red-500 appearance-none cursor-pointer transition shadow-2xs"
                  >
                    <option value={getActiveSessionId()} className="bg-white dark:bg-slate-900 text-gray-900 dark:text-white">
                      ● Active Session (Current) • {formatSessionDate(getActiveSessionStartTime())}
                    </option>
                    <option value="all" className="bg-white dark:bg-slate-900 text-gray-900 dark:text-white">
                      ⎘ Consolidated (All Historical Sessions)
                    </option>
                    {sessions
                      .filter((s) => s.sessionId !== getActiveSessionId())
                      .map((s) => (
                        <option key={s.sessionId} value={s.sessionId} className="bg-white dark:bg-slate-900 text-gray-900 dark:text-white">
                          {s.formattedDate} • {s.errorCount} error{s.errorCount !== 1 ? 's' : ''} ({s.sessionId})
                        </option>
                      ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2.5 text-gray-400 dark:text-slate-400">
                    <ChevronDown size={14} />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 pt-1 sm:pt-0">
              <button
                onClick={() => {
                  loadSessions();
                  loadSessionLogs(selectedSessionId);
                }}
                className="p-2 text-gray-700 dark:text-slate-300 bg-white dark:bg-slate-900 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 transition shadow-2xs active:scale-95"
                title="Refresh Session Telemetry"
              >
                <RefreshCw size={13} className={isLoadingLogs || isLoadingSessions ? 'animate-spin' : ''} />
              </button>

              <button
                onClick={handleCopyLogs}
                disabled={filteredLogs.length === 0}
                className={`px-3 py-2 rounded-xl text-xs font-extrabold transition flex items-center gap-1.5 shadow-2xs active:scale-95 ${
                  filteredLogs.length === 0
                    ? 'bg-gray-200 dark:bg-slate-800 text-gray-400 dark:text-slate-500 cursor-not-allowed'
                    : copied
                    ? 'bg-emerald-500 text-white'
                    : 'bg-black dark:bg-white text-white dark:text-black hover:opacity-90'
                }`}
              >
                {copied ? <Check size={12} strokeWidth={3} /> : <Copy size={12} />}
                {copied ? 'Copied!' : 'Copy Logs'}
              </button>

              <button
                onClick={handleClear}
                disabled={filteredLogs.length === 0}
                className="p-2 text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/50 rounded-xl border border-rose-200 dark:border-rose-900/50 transition shadow-2xs active:scale-95 disabled:opacity-40"
                title="Clear View"
              >
                <Trash2 size={13} />
              </button>
            </div>
          </div>

          {/* Test Buttons Toolbar */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] font-bold text-gray-500 dark:text-slate-400 uppercase font-mono mr-1">Inject Faults:</span>
            <button
              onClick={handleTestError}
              className="py-1 px-2.5 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-300 rounded-lg text-2xs font-bold transition flex items-center gap-1"
            >
              <Play size={9} /> Test console.error
            </button>
            <button
              onClick={handleTriggerException}
              className="py-1 px-2.5 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-300 rounded-lg text-2xs font-bold transition flex items-center gap-1"
            >
              <AlertCircle size={9} /> Test Exception
            </button>
            <button
              onClick={handleTriggerRejection}
              className="py-1 px-2.5 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-300 rounded-lg text-2xs font-bold transition flex items-center gap-1"
            >
              <AlertCircle size={9} /> Test Promise
            </button>
            <button
              onClick={handleTestAuditError}
              className="py-1 px-2.5 bg-purple-50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-900/40 rounded-lg text-2xs font-bold transition flex items-center gap-1 border border-purple-200/40 dark:border-purple-800/40"
            >
              <ShieldAlert size={9} /> Test Audit Fault
            </button>
            <button
              onClick={handleTestBugReportError}
              className="py-1 px-2.5 bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/40 rounded-lg text-2xs font-bold transition flex items-center gap-1 border border-rose-200/40 dark:border-rose-800/40"
            >
              <Bug size={9} /> Test Bug Report Log
            </button>
          </div>

          {/* Search & Source/Type Filter */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-gray-400" />
              <input
                type="text"
                placeholder="Filter logs by keyword, stack trace or error source..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="w-full text-xs font-semibold py-2 pl-8 pr-3 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500/20"
              />
            </div>

            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="text-xs font-bold py-2 px-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-gray-800 dark:text-white shrink-0 cursor-pointer"
            >
              <option value="all">All Sources</option>
              <option value="audit">Audit App Faults</option>
              <option value="bug_report">Bug Report Logs</option>
              <option value="error">Runtime Errors</option>
              <option value="exception">Exceptions</option>
              <option value="rejection">Promise Rejections</option>
            </select>
          </div>

          {/* Logs Feed Screen */}
          <div className="bg-slate-950 dark:bg-slate-950 rounded-2xl p-4 border border-slate-800 font-mono text-2xs text-gray-300 max-h-72 overflow-y-auto space-y-2.5 shadow-inner">
            {isLoadingLogs ? (
              <div className="py-8 text-center text-slate-500 italic">
                <RefreshCw size={18} className="animate-spin mx-auto mb-2 opacity-60" />
                Retrieving telemetry logs for session...
              </div>
            ) : filteredLogs.length === 0 ? (
              <div className="py-8 text-center text-slate-500 italic select-none">
                ~ Diagnostic stream is listening. No errors caught for this session ~
              </div>
            ) : (
              filteredLogs.map((log) => {
                const isExpanded = expandedLogId === log.id;
                const timeStr =
                  log.timestamp instanceof Date
                    ? log.timestamp.toLocaleTimeString()
                    : new Date(log.timestamp).toLocaleTimeString();

                let badgeColor = 'text-red-400 bg-red-950/30 border-red-900/30';
                if (log.source === 'audit_app' || log.type === 'audit_failure') {
                  badgeColor = 'text-purple-400 bg-purple-950/40 border-purple-800/40';
                } else if (log.source === 'bug_report' || log.type === 'bug_report') {
                  badgeColor = 'text-amber-400 bg-amber-950/40 border-amber-800/40';
                } else if (log.type === 'rejection') {
                  badgeColor = 'text-fuchsia-400 bg-fuchsia-950/30 border-fuchsia-900/30';
                } else if (log.type === 'warn') {
                  badgeColor = 'text-yellow-400 bg-yellow-950/30 border-yellow-900/30';
                }

                return (
                  <div key={log.id} className="border-b border-slate-900/50 last:border-0 pb-2 last:pb-0 space-y-1">
                    <div className="flex items-start justify-between gap-3 flex-wrap sm:flex-nowrap">
                      <div className="flex items-start gap-1.5 min-w-0 flex-1">
                        <span
                          className={`inline-block px-1 py-0.5 rounded text-[8px] font-black uppercase border leading-none shrink-0 tracking-wide ${badgeColor}`}
                        >
                          {log.source === 'audit_app'
                            ? 'AUDIT'
                            : log.source === 'bug_report'
                            ? 'BUG REPORT'
                            : log.type}
                        </span>
                        <span className="text-slate-500 text-[10px] leading-none shrink-0 pt-0.5 font-medium">
                          {timeStr}
                        </span>
                        <span className="text-red-300 dark:text-red-400 font-medium break-all whitespace-pre-wrap leading-tight pt-0.5">
                          {log.message}
                        </span>
                      </div>

                      {log.stack && (
                        <button
                          onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                          className="text-[9px] font-semibold text-slate-500 hover:text-slate-300 flex items-center gap-0.5 transition shrink-0 ml-auto"
                        >
                          {isExpanded ? 'Hide stack' : 'Stack trace'}
                          {isExpanded ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                        </button>
                      )}
                    </div>

                    {isExpanded && log.stack && (
                      <pre className="mt-1.5 p-2 bg-slate-900 text-slate-400 rounded-lg text-[9px] overflow-x-auto whitespace-pre leading-relaxed select-all border border-slate-800 scrollbar-thin">
                        {log.stack}
                      </pre>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
