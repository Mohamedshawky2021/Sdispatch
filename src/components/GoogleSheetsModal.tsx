import React, { useState, useEffect } from 'react';
import {
  FileSpreadsheet,
  ExternalLink,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Link,
  ShieldCheck,
  UserCheck,
  LogOut,
  Download,
  Database,
  Layers,
  Clock,
  X,
} from 'lucide-react';
import {
  initAuth,
  googleSignIn,
  googleLogout,
  getStoredSheetsConfig,
  saveStoredSheetsConfig,
  createMiningSpreadsheet,
  syncAllDataToGoogleSheet,
  GoogleSheetsConfig,
  getCurrentGoogleUser,
} from '../utils/googleSheets';
import { TripLog, Truck, Excavator, DumpLocation } from '../types/dispatch';
import {
  getStoredTrips,
  getStoredTrucks,
  getStoredExcavators,
  getStoredDumps,
  getFuelingLogs,
  getDriverSessions,
} from '../utils/storage';
import { playClickSound, playLoadConfirmedSound } from '../utils/audio';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  trips?: TripLog[];
  trucks?: Truck[];
  excavators?: Excavator[];
  dumps?: DumpLocation[];
}

export const GoogleSheetsModal: React.FC<Props> = ({
  isOpen,
  onClose,
  trips: propTrips,
  trucks: propTrucks,
  excavators: propExcavators,
  dumps: propDumps,
}) => {
  const [config, setConfig] = useState<GoogleSheetsConfig | null>(getStoredSheetsConfig());
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'SUCCESS' | 'ERROR' | 'INFO' } | null>(null);
  const [manualSheetId, setManualSheetId] = useState('');
  const [customSheetTitle, setCustomSheetTitle] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setConfig(getStoredSheetsConfig());

    const unsub = initAuth(
      (user) => {
        setUserEmail(user.email);
        setUserName(user.displayName);
      },
      () => {
        setUserEmail(null);
        setUserName(null);
      }
    );

    const currentUser = getCurrentGoogleUser();
    if (currentUser) {
      setUserEmail(currentUser.email);
      setUserName(currentUser.displayName);
    }

    return () => unsub();
  }, [isOpen]);

  if (!isOpen) return null;

  const showMsg = (text: string, type: 'SUCCESS' | 'ERROR' | 'INFO' = 'INFO') => {
    setStatusMessage({ text, type });
    setTimeout(() => setStatusMessage(null), 5000);
  };

  const handleSignIn = async () => {
    playClickSound();
    setIsSigningIn(true);
    try {
      const res = await googleSignIn();
      if (res) {
        setUserEmail(res.user.email);
        setUserName(res.user.displayName);
        showMsg(`تم تسجيل الدخول بنجاح بحساب ${res.user.email}`, 'SUCCESS');
      }
    } catch (err: any) {
      showMsg(err?.message || 'فشل تسجيل الدخول بحساب Google', 'ERROR');
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleLogout = async () => {
    playClickSound();
    await googleLogout();
    setUserEmail(null);
    setUserName(null);
    showMsg('تم تسجيل الخروج من Google بنجاح', 'INFO');
  };

  const handleCreateNewSheet = async () => {
    playClickSound();
    setIsCreating(true);
    try {
      const title =
        customSheetTitle.trim() ||
        `منجم السكري — سجلات الدسباتش والإنتاج (${new Date().toLocaleDateString('ar-EG')})`;
      const { spreadsheetId, spreadsheetUrl } = await createMiningSpreadsheet(title);

      // Now auto-sync all current data to initialize the sheets
      const trips = getStoredTrips();
      const trucks = getStoredTrucks();
      const excavators = getStoredExcavators();
      const dumps = getStoredDumps();
      const fuelings = getFuelingLogs();
      const sessions = getDriverSessions();

      await syncAllDataToGoogleSheet(spreadsheetId, trips, trucks, excavators, dumps, fuelings, sessions);

      const newConfig: GoogleSheetsConfig = {
        spreadsheetId,
        spreadsheetUrl,
        spreadsheetTitle: title,
        lastSyncedAt: new Date().toISOString(),
        syncedTripsCount: trips.length,
        autoSyncEnabled: true,
      };
      saveStoredSheetsConfig(newConfig);
      setConfig(newConfig);

      playLoadConfirmedSound();
      showMsg(`تم إنشاء جدول البيانات ورفع ${trips.length} نقلة وسجلات الحضور بنجاح!`, 'SUCCESS');
    } catch (err: any) {
      showMsg(err?.message || 'فشل إنشاء جدول البيانات', 'ERROR');
    } finally {
      setIsCreating(false);
    }
  };

  const handleSyncNow = async () => {
    if (!config?.spreadsheetId) {
      showMsg('يرجى إنشاء أو ربط ملف Google Sheet أولاً', 'ERROR');
      return;
    }

    playClickSound();
    setIsSyncing(true);
    try {
      const trips = getStoredTrips();
      const trucks = getStoredTrucks();
      const excavators = getStoredExcavators();
      const dumps = getStoredDumps();
      const fuelings = getFuelingLogs();
      const sessions = getDriverSessions();

      const res = await syncAllDataToGoogleSheet(
        config.spreadsheetId,
        trips,
        trucks,
        excavators,
        dumps,
        fuelings,
        sessions
      );

      if (res.success) {
        const updatedConfig = {
          ...config,
          lastSyncedAt: new Date().toISOString(),
          syncedTripsCount: trips.length,
        };
        saveStoredSheetsConfig(updatedConfig);
        setConfig(updatedConfig);
        playLoadConfirmedSound();
        showMsg(`تمت مزامنة وتصدير ${res.syncedTrips} نقلة وسجلات التفويل والأجهزة لـ Google Sheet بنجاح ✅`, 'SUCCESS');
      } else {
        showMsg(res.error || 'فشلت المزامنة', 'ERROR');
      }
    } catch (err: any) {
      showMsg(err?.message || 'فشل التصدير لجوجل شيت', 'ERROR');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleLinkExistingSheet = () => {
    if (!manualSheetId.trim()) return;
    playClickSound();

    let cleanId = manualSheetId.trim();
    // Support pasting full URL like https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit
    if (cleanId.includes('/spreadsheets/d/')) {
      const match = cleanId.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
      if (match && match[1]) {
        cleanId = match[1];
      }
    }

    const spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${cleanId}/edit`;
    const newConfig: GoogleSheetsConfig = {
      spreadsheetId: cleanId,
      spreadsheetUrl,
      spreadsheetTitle: `جدول دسباتش منجم السكري المرتبط (${cleanId.slice(0, 8)}...)`,
      lastSyncedAt: undefined,
      syncedTripsCount: 0,
      autoSyncEnabled: true,
    };
    saveStoredSheetsConfig(newConfig);
    setConfig(newConfig);
    setManualSheetId('');
    showMsg('تم ربط ملف Google Sheet بنجاح، يمكنك الآن الضغط على "تصدير وتحديث البيانات الآن"', 'SUCCESS');
  };

  const handleDisconnectSheet = () => {
    playClickSound();
    saveStoredSheetsConfig(null);
    setConfig(null);
    showMsg('تم إلغاء ربط ملف Google Sheet', 'INFO');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-slate-900 border-2 border-emerald-500/60 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="p-4 md:p-5 bg-gradient-to-r from-emerald-950/80 via-slate-900 to-slate-900 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border-2 border-emerald-400 flex items-center justify-center text-emerald-400 font-bold shadow-inner">
              <FileSpreadsheet className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg md:text-xl font-black text-slate-100">
                  ربط وتصدير Google Sheets 📊
                </h2>
                <span className="py-0.5 px-2 rounded-full bg-emerald-500 text-slate-950 text-[10px] font-black">
                  رسمي للمديرين والديسباتشر
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                تصدير ومزامنة حية لبيانات النقلات، الأطنان، ومحطة التفويل من جميع التابلتات لملف Google Sheet موحد
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Security & Access Restriction Notice */}
        <div className="px-4 py-2 bg-emerald-950/40 border-b border-emerald-500/30 flex items-center gap-2 text-[11px] text-emerald-300">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>
            <strong>خصوصية تامة:</strong> هذا الملف متاح حصرياً لحساب المسؤول والديسباتشر — لا يمكن لسائقي الشاحنات في الكابينة فتحه.
          </span>
        </div>

        {/* Status Message Banner */}
        {statusMessage && (
          <div
            className={`py-2 px-4 text-xs font-bold flex items-center gap-2 ${
              statusMessage.type === 'SUCCESS'
                ? 'bg-emerald-500 text-slate-950'
                : statusMessage.type === 'ERROR'
                ? 'bg-rose-500 text-white'
                : 'bg-sky-500 text-white'
            }`}
          >
            {statusMessage.type === 'SUCCESS' ? (
              <CheckCircle2 className="w-4 h-4" />
            ) : (
              <AlertTriangle className="w-4 h-4" />
            )}
            <span>{statusMessage.text}</span>
          </div>
        )}

        {/* Body Content */}
        <div className="p-4 md:p-6 overflow-y-auto space-y-5 text-right">
          {/* SECTION 1: Google Account Authentication */}
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400">1. حساب Google المعتمد للمزامنة</span>
              {userEmail && (
                <span className="py-0.5 px-2 rounded-full bg-emerald-950 border border-emerald-500/40 text-emerald-400 text-[11px] font-mono flex items-center gap-1">
                  <UserCheck className="w-3 h-3" />
                  متصل ومفعل
                </span>
              )}
            </div>

            {userEmail ? (
              <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-slate-900 border border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-400 font-black flex items-center justify-center font-mono">
                    {userName ? userName.slice(0, 1).toUpperCase() : 'G'}
                  </div>
                  <div>
                    <div className="font-bold text-sm text-slate-100">{userName || 'Google Workspace User'}</div>
                    <div className="text-xs text-slate-400 font-mono">{userEmail}</div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleLogout}
                  className="py-1.5 px-3 rounded-xl bg-slate-800 hover:bg-rose-950 hover:text-rose-300 text-slate-400 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  تسجيل خروج
                </button>
              </div>
            ) : (
              <div className="text-center py-4 space-y-3">
                <p className="text-xs text-slate-300 leading-relaxed">
                  قم بتسجيل الدخول بحساب Google المعتمد لتمكين إنشاء وتحديث جداول Google Sheets وتصدير بيانات المنجم إليها.
                </p>
                <button
                  type="button"
                  onClick={handleSignIn}
                  disabled={isSigningIn}
                  className="inline-flex items-center gap-3 py-3 px-6 rounded-2xl bg-white hover:bg-slate-100 text-slate-900 font-black text-sm shadow-xl transition-all cursor-pointer active:scale-98"
                >
                  <svg className="w-5 h-5" viewBox="0 0 48 48">
                    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                  </svg>
                  <span>{isSigningIn ? 'جاري الاتصال بـ Google...' : 'تسجيل الدخول بحساب Google (Sign in with Google)'}</span>
                </button>
              </div>
            )}
          </div>

          {/* SECTION 2: Connected Google Sheet Details & Actions */}
          {config ? (
            <div className="p-4 md:p-5 rounded-2xl bg-gradient-to-b from-slate-950 to-slate-900 border-2 border-emerald-500/50 shadow-lg space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-emerald-400 animate-ping" />
                  <span className="font-black text-sm text-emerald-400">ملف Google Sheet المرتبط حالياً:</span>
                </div>
                <button
                  type="button"
                  onClick={handleDisconnectSheet}
                  className="text-xs text-rose-400 hover:text-rose-300 font-bold"
                >
                  إلغاء الربط
                </button>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
                <h4 className="font-black text-base text-slate-100 flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
                  {config.spreadsheetTitle}
                </h4>
                <div className="text-xs text-slate-400 font-mono truncate">
                  المعرف (ID): <strong className="text-slate-300">{config.spreadsheetId}</strong>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400 pt-2 border-t border-slate-800">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-sky-400" />
                    آخر مزامنة:{' '}
                    <strong className="text-slate-300 font-mono">
                      {config.lastSyncedAt
                        ? new Date(config.lastSyncedAt).toLocaleTimeString('ar-EG', {
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                          })
                        : 'لم تتم مزامنة بعد'}
                    </strong>
                  </span>
                  <span>
                    إجمالي النقلات المرفوعة:{' '}
                    <strong className="text-emerald-400 font-mono font-bold">
                      {config.syncedTripsCount || 0} نقلة
                    </strong>
                  </span>
                </div>
              </div>

              {/* Action Buttons: Open Sheet & Sync Now */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <a
                  href={config.spreadsheetUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs md:text-sm flex items-center justify-center gap-2 shadow-lg transition-transform active:scale-98"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>فتح ملف Google Sheet مباشرة ↗️</span>
                </a>

                <button
                  type="button"
                  onClick={handleSyncNow}
                  disabled={isSyncing}
                  className="py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs md:text-sm flex items-center justify-center gap-2 shadow-lg transition-transform active:scale-98 cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                  <span>{isSyncing ? 'جاري رفع وتحديث الداتا...' : 'تصدير وتحديث البيانات الآن 🔄'}</span>
                </button>
              </div>

              {/* Data Tabs Included */}
              <div className="pt-2">
                <span className="text-[11px] font-bold text-slate-400 block mb-1.5">
                  الصفحات المدمجة داخل الجدول:
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-[10px] font-bold">
                  <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-emerald-300">
                    ملخص الإنتاج والوردية
                  </div>
                  <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-sky-300">
                    سجل النقلات (Trips)
                  </div>
                  <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-amber-300">
                    سجلات التفويل (Fueling)
                  </div>
                  <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-purple-300">
                    أسطول الدنابر والحفارات
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* SECTION 3: Create or Connect Options */
            <div className="space-y-4">
              {/* Option A: Create New Mining Spreadsheet */}
              <div className="p-4 md:p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
                    <Plus className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-slate-100">
                      الخيار أ: إنشاء ملف Google Sheet جديد لمنجم السكري
                    </h4>
                    <p className="text-[11px] text-slate-400">
                      يقوم بإنشاء جدول رسمي جديد باسم المنجم مع صفحات مجهزة تلقائياً ورفع كافة النقلات والتفويل
                    </p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={customSheetTitle}
                    onChange={(e) => setCustomSheetTitle(e.target.value)}
                    placeholder="اسم الملف (اختياري، مثلاً: منجم السكري - سجلات الدسباتش المعتمدة)"
                    className="flex-1 py-2 px-3 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={handleCreateNewSheet}
                    disabled={isCreating}
                    className="py-2 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer whitespace-nowrap disabled:opacity-50"
                  >
                    <Plus className="w-4 h-4" />
                    <span>{isCreating ? 'جاري الإنشاء والرفع...' : 'إنشاء وتصدير الداتا الآن 📑'}</span>
                  </button>
                </div>
              </div>

              {/* Option B: Link Existing Sheet by ID or URL */}
              <div className="p-4 md:p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-sky-500/20 text-sky-400 flex items-center justify-center font-bold">
                    <Link className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-slate-100">
                      الخيار ب: ربط ملف Google Sheet موجود مسبقاً
                    </h4>
                    <p className="text-[11px] text-slate-400">
                      ألصق رابط الملف كاملاً أو معرف الـ Spreadsheet ID إذا كان لديك ملف جاهز ترغب في التصدير إليه
                    </p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={manualSheetId}
                    onChange={(e) => setManualSheetId(e.target.value)}
                    placeholder="https://docs.google.com/spreadsheets/d/... أو المعرف ID"
                    className="flex-1 py-2 px-3 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-sky-500"
                  />
                  <button
                    type="button"
                    onClick={handleLinkExistingSheet}
                    className="py-2 px-4 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer whitespace-nowrap"
                  >
                    <Link className="w-4 h-4" />
                    <span>ربط الملف 🔗</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <span>البيانات مجمعة من جميع تابلتات الحفرة والكسارة والتفويل</span>
          <button
            type="button"
            onClick={onClose}
            className="py-2 px-5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold transition-colors cursor-pointer"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};
