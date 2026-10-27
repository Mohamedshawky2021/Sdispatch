import React, { useState, useEffect } from 'react';
import {
  Lock,
  Unlock,
  ShieldAlert,
  X,
  Check,
  Delete,
  KeyRound,
  Radio,
  BarChart3,
  UserCheck,
  Users,
  Eye,
  EyeOff,
  Edit3,
} from 'lucide-react';
import { DispatcherUser } from '../types/dispatch';
import { playClickSound, playLoadConfirmedSound, playDispatchAlertSound } from '../utils/audio';
import {
  getAppConfig,
  getStoredDispatchers,
  setActiveDispatcher,
  getActiveDispatcher,
  updateDispatcher,
} from '../utils/storage';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (targetView: 'CONTROL' | 'DASHBOARD' | 'ADMIN', user: DispatcherUser) => void;
  targetView: 'CONTROL' | 'DASHBOARD' | 'ADMIN' | null;
}

export const SupervisorPinModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onSuccess,
  targetView,
}) => {
  const [dispatchers, setDispatchers] = useState<DispatcherUser[]>(getStoredDispatchers());
  const [selectedDispatcherId, setSelectedDispatcherId] = useState<string>('');
  const [manualCodeInput, setManualCodeInput] = useState<string>('');
  const [isManualMode, setIsManualMode] = useState<boolean>(false);
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [error, setError] = useState('');
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [isLockedOut, setIsLockedOut] = useState(false);
  const [lockoutRemaining, setLockoutRemaining] = useState(0);

  // Change PIN mode
  const [isChangingPin, setIsChangingPin] = useState(false);
  const [oldPinInput, setOldPinInput] = useState('');
  const [newPinInput, setNewPinInput] = useState('');
  const [confirmPinInput, setConfirmPinInput] = useState('');
  const [pinChangeMessage, setPinChangeMessage] = useState<{ text: string; isError: boolean } | null>(null);

  useEffect(() => {
    if (isOpen) {
      const stored = getStoredDispatchers();
      setDispatchers(stored);
      const active = getActiveDispatcher();
      if (active) {
        setSelectedDispatcherId(active.id);
      } else if (stored.length > 0) {
        setSelectedDispatcherId(stored[0].id);
      }
      setPin('');
      setError('');
      setIsChangingPin(false);
      setPinChangeMessage(null);
    }
  }, [isOpen]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (lockoutRemaining > 0) {
      interval = setInterval(() => {
        setLockoutRemaining((prev) => {
          if (prev <= 1) {
            setIsLockedOut(false);
            setFailedAttempts(0);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [lockoutRemaining]);

  if (!isOpen) return null;

  const appConfig = getAppConfig();
  const masterPin = appConfig.adminPin || '1234';

  const selectedDispatcher = dispatchers.find((d) => d.id === selectedDispatcherId);

  const handleSubmit = (inputPin?: string) => {
    if (isLockedOut) return;
    const pinToCheck = (inputPin !== undefined ? inputPin : pin).trim();
    if (!pinToCheck) {
      setError('يرجى إدخال الرقم السري');
      return;
    }

    let authenticatedUser: DispatcherUser | null = null;

    if (isManualMode && manualCodeInput.trim()) {
      // Find by code
      const cleanCode = manualCodeInput.trim().toUpperCase();
      const targetUser = dispatchers.find(
        (d) => d.code.toUpperCase() === cleanCode && d.active !== false
      );
      if (targetUser && (targetUser.pin === pinToCheck || pinToCheck === masterPin)) {
        authenticatedUser = targetUser;
      } else if (pinToCheck === masterPin) {
        // Log in as master admin supervisor with manual code
        authenticatedUser = {
          id: `ADMIN-${Date.now()}`,
          code: cleanCode || 'ADMIN',
          name: 'المشرف الرئيسي (Master Admin)',
          pin: masterPin,
          role: 'CHIEF_DISPATCHER',
          active: true,
        };
      }
    } else if (selectedDispatcher) {
      // Authenticate with selected dispatcher's secret PIN or Master Admin PIN
      if (selectedDispatcher.pin === pinToCheck || pinToCheck === masterPin) {
        authenticatedUser = selectedDispatcher;
      }
    } else if (pinToCheck === masterPin) {
      // Master PIN without selection
      authenticatedUser = dispatchers[0] || {
        id: 'DSP-MASTER',
        code: 'DSP01',
        name: 'المشرف العام (Chief Dispatcher)',
        pin: masterPin,
        role: 'CHIEF_DISPATCHER',
        active: true,
      };
    }

    if (authenticatedUser) {
      playLoadConfirmedSound();
      setError('');
      setPin('');
      setFailedAttempts(0);
      setActiveDispatcher(authenticatedUser);
      onSuccess(targetView || 'CONTROL', authenticatedUser);
    } else {
      playDispatchAlertSound();
      const nextAttempts = failedAttempts + 1;
      setFailedAttempts(nextAttempts);
      setPin('');

      if (nextAttempts >= 5) {
        setIsLockedOut(true);
        setLockoutRemaining(30);
        setError('تم تجاوز الحد الأقصى للمحاولات (5). تم القفل المؤقت لمدة 30 ثانية لدواعي الأمان.');
      } else {
        setError(`الرقم السري أو كود الديسباتشر غير صحيح! (المحاولة ${nextAttempts} من 5).`);
      }
    }
  };

  const handleKeyPress = (num: string) => {
    if (isLockedOut || pin.length >= 8) return;
    playClickSound();
    const nextPin = pin + num;
    setPin(nextPin);
    setError('');

    // If matches selected dispatcher's PIN or master PIN on 4th or exact digit, auto-verify
    if (selectedDispatcher && selectedDispatcher.pin === nextPin) {
      handleSubmit(nextPin);
    } else if (nextPin === masterPin && nextPin.length >= 4) {
      handleSubmit(nextPin);
    }
  };

  const handleDelete = () => {
    playClickSound();
    setPin((prev) => prev.slice(0, -1));
    setError('');
  };

  const handleClear = () => {
    playClickSound();
    setPin('');
    setError('');
  };

  // Change PIN handler for the selected dispatcher
  const handleSaveNewPin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDispatcher) return;

    if (oldPinInput !== selectedDispatcher.pin && oldPinInput !== masterPin) {
      setPinChangeMessage({ text: 'الرقم السري الحالي غير صحيح!', isError: true });
      playDispatchAlertSound();
      return;
    }

    if (newPinInput.length < 4) {
      setPinChangeMessage({ text: 'الرقم السري الجديد يجب أن يكون 4 أرقام على الأقل', isError: true });
      return;
    }

    if (newPinInput !== confirmPinInput) {
      setPinChangeMessage({ text: 'الرقم السري وتأكيده غير متطابقين!', isError: true });
      return;
    }

    updateDispatcher(selectedDispatcher.id, { pin: newPinInput });
    setDispatchers(getStoredDispatchers());
    playLoadConfirmedSound();
    setPinChangeMessage({ text: '✅ تم تغيير الرقم السري بنجاح!', isError: false });
    setTimeout(() => {
      setIsChangingPin(false);
      setPinChangeMessage(null);
      setOldPinInput('');
      setNewPinInput('');
      setConfirmPinInput('');
    }, 1500);
  };

  const getTargetTitle = () => {
    if (targetView === 'CONTROL') return 'غرفة الدسباتش والمراقبة المركزية 📡';
    if (targetView === 'DASHBOARD') return 'لوحة تحكم الأداء والتقارير والإنتاجية 📊';
    if (targetView === 'ADMIN') return 'لوحة إدارة النظام وقاعدة البيانات ⚙️';
    return 'منطقة المشرفين والديسباتشر 🔒';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border-2 border-amber-500/60 rounded-3xl p-5 sm:p-6 w-full max-w-md shadow-2xl relative text-center max-h-[95vh] overflow-y-auto">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 left-4 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          aria-label="إغلاق"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header Icon & Title */}
        <div className="w-14 h-14 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center mx-auto mb-2 shadow-inner">
          {targetView === 'CONTROL' ? (
            <Radio className="w-7 h-7 text-amber-400 animate-pulse" />
          ) : targetView === 'DASHBOARD' ? (
            <BarChart3 className="w-7 h-7 text-amber-400" />
          ) : (
            <Lock className="w-7 h-7 text-amber-400" />
          )}
        </div>

        <h3 className="text-base sm:text-lg font-black text-slate-100 mb-0.5">
          {getTargetTitle()}
        </h3>
        <p className="text-xs text-slate-400 mb-4">
          تسجيل دخول حساب الديسباتشر المناوب لإصدار التقارير باسمه
        </p>

        {/* Mode Selector: Quick Dispatcher Select vs Manual Code */}
        {!isChangingPin && (
          <div className="mb-4">
            <div className="flex items-center justify-between text-xs font-bold text-slate-300 mb-2">
              <span className="flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-amber-400" />
                <span>اختر حساب الديسباتشر:</span>
              </span>
              <button
                type="button"
                onClick={() => {
                  setIsManualMode(!isManualMode);
                  setError('');
                }}
                className="text-[11px] text-amber-400 hover:text-amber-300 underline cursor-pointer"
              >
                {isManualMode ? 'اختر من القائمة' : 'كتابة الكود يدوياً'}
              </button>
            </div>

            {isManualMode ? (
              <div className="mb-3">
                <input
                  type="text"
                  value={manualCodeInput}
                  onChange={(e) => setManualCodeInput(e.target.value.toUpperCase())}
                  placeholder="مثال: DSP01"
                  className="w-full py-2.5 px-3.5 rounded-xl bg-slate-950 border border-slate-700 text-slate-100 text-center font-mono font-bold text-sm tracking-wider focus:border-amber-500 focus:outline-none"
                  autoFocus
                />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2 mb-3">
                {dispatchers.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => {
                      setSelectedDispatcherId(d.id);
                      setPin('');
                      setError('');
                    }}
                    className={`py-2 px-2.5 rounded-xl text-right transition-all cursor-pointer border ${
                      selectedDispatcherId === d.id
                        ? 'bg-amber-500/20 border-amber-500 text-slate-100 shadow-md ring-1 ring-amber-400'
                        : 'bg-slate-950/70 border-slate-800 text-slate-300 hover:bg-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="text-xs font-bold truncate flex items-center justify-between">
                      <span>{d.name}</span>
                      {selectedDispatcherId === d.id && (
                        <Check className="w-3.5 h-3.5 text-amber-400" />
                      )}
                    </div>
                    <div className="text-[10px] text-amber-400/90 font-mono mt-0.5">
                      كود: {d.code}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Selected User Info Banner */}
            {!isManualMode && selectedDispatcher && (
              <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs mb-3">
                <div className="flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-emerald-400" />
                  <span className="text-slate-200 font-bold">{selectedDispatcher.name}</span>
                  <span className="font-mono text-[10px] bg-slate-800 px-1.5 py-0.5 rounded text-amber-400">
                    {selectedDispatcher.code}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsChangingPin(true)}
                  className="text-[11px] text-sky-400 hover:text-sky-300 flex items-center gap-1 cursor-pointer"
                  title="تغيير الرقم السري لهذا الحساب"
                >
                  <Edit3 className="w-3 h-3" />
                  <span>تغيير سري</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Change PIN Mode Subform */}
        {isChangingPin && (
          <form onSubmit={handleSaveNewPin} className="mb-4 p-4 rounded-2xl bg-slate-950 border border-slate-800 text-right space-y-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-slate-200">
                تغيير الرقم السري لـ ({selectedDispatcher?.name}):
              </span>
              <button
                type="button"
                onClick={() => {
                  setIsChangingPin(false);
                  setPinChangeMessage(null);
                }}
                className="text-[11px] text-slate-400 hover:text-white cursor-pointer"
              >
                إلغاء ✖
              </button>
            </div>

            <div>
              <label className="text-[11px] text-slate-400 block mb-1">الرقم السري الحالي:</label>
              <input
                type="password"
                value={oldPinInput}
                onChange={(e) => setOldPinInput(e.target.value)}
                placeholder="أدخل الرقم السري الحالي"
                className="w-full py-2 px-3 rounded-lg bg-slate-900 border border-slate-700 text-slate-100 text-center font-mono text-xs focus:border-amber-500 focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="text-[11px] text-slate-400 block mb-1">الرقم السري الجديد (سري):</label>
              <input
                type="password"
                value={newPinInput}
                onChange={(e) => setNewPinInput(e.target.value)}
                placeholder="الرقم السري الجديد (4 أرقام فأكثر)"
                className="w-full py-2 px-3 rounded-lg bg-slate-900 border border-slate-700 text-slate-100 text-center font-mono text-xs focus:border-amber-500 focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="text-[11px] text-slate-400 block mb-1">تأكيد الرقم السري الجديد:</label>
              <input
                type="password"
                value={confirmPinInput}
                onChange={(e) => setConfirmPinInput(e.target.value)}
                placeholder="أعد إدخال الرقم السري الجديد"
                className="w-full py-2 px-3 rounded-lg bg-slate-900 border border-slate-700 text-slate-100 text-center font-mono text-xs focus:border-amber-500 focus:outline-none"
                required
              />
            </div>

            {pinChangeMessage && (
              <div className={`p-2 rounded-lg text-xs font-bold text-center ${
                pinChangeMessage.isError ? 'bg-rose-950 text-rose-300' : 'bg-emerald-950 text-emerald-300'
              }`}>
                {pinChangeMessage.text}
              </div>
            )}

            <button
              type="submit"
              className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs cursor-pointer shadow-md"
            >
              حفظ الرقم السري الجديد
            </button>
          </form>
        )}

        {/* Standard PIN Entry Keypad */}
        {!isChangingPin && (
          <>
            {/* PIN Dots Display with Show/Hide Toggle */}
            <div className="flex items-center justify-center gap-2 mb-3">
              <div className="flex justify-center gap-3">
                {[0, 1, 2, 3].map((idx) => (
                  <div
                    key={idx}
                    className={`w-3.5 h-3.5 rounded-full border-2 transition-all ${
                      pin.length > idx
                        ? 'bg-amber-400 border-amber-400 scale-110 shadow-sm shadow-amber-400/50'
                        : 'bg-slate-800 border-slate-600'
                    }`}
                  />
                ))}
              </div>
              <button
                type="button"
                onClick={() => setShowPin(!showPin)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-200 transition-colors"
                title={showPin ? 'إخفاء الرقم' : 'إظهار الرقم'}
              >
                {showPin ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>

            {showPin && pin && (
              <div className="text-center font-mono text-amber-400 text-xs mb-2">
                الرقم المدخل: <strong>{pin}</strong>
              </div>
            )}

            {/* Error message */}
            {error && (
              <div className="mb-3 p-2 rounded-xl bg-rose-950/80 border border-rose-500/50 text-rose-300 text-xs font-bold flex items-center justify-center gap-1.5 animate-shake">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {isLockedOut && (
              <div className="mb-3 p-2.5 rounded-xl bg-rose-950/90 border border-rose-500 text-rose-300 text-xs font-mono font-bold animate-pulse">
                ⏳ النظام مقفل مؤقتاً: متبقي {lockoutRemaining} ثانية
              </div>
            )}

            {/* On-Screen Touch Keypad */}
            <div className="grid grid-cols-3 gap-2 mb-3">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                <button
                  key={digit}
                  type="button"
                  disabled={isLockedOut}
                  onClick={() => handleKeyPress(digit)}
                  className="py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 active:bg-amber-500 active:text-slate-950 text-slate-100 text-lg font-bold font-mono transition-all border border-slate-700/80 cursor-pointer shadow-md active:scale-95 disabled:opacity-40"
                >
                  {digit}
                </button>
              ))}
              <button
                type="button"
                disabled={isLockedOut}
                onClick={handleClear}
                className="py-2.5 rounded-2xl bg-slate-800/60 hover:bg-slate-700/80 text-rose-400 text-xs font-bold transition-all border border-slate-700/60 cursor-pointer active:scale-95 disabled:opacity-40"
              >
                مسح C
              </button>
              <button
                type="button"
                disabled={isLockedOut}
                onClick={() => handleKeyPress('0')}
                className="py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 active:bg-amber-500 active:text-slate-950 text-slate-100 text-lg font-bold font-mono transition-all border border-slate-700/80 cursor-pointer shadow-md active:scale-95 disabled:opacity-40"
              >
                0
              </button>
              <button
                type="button"
                disabled={isLockedOut}
                onClick={handleDelete}
                className="py-2.5 rounded-2xl bg-slate-800/60 hover:bg-slate-700/80 text-amber-400 flex items-center justify-center transition-all border border-slate-700/60 cursor-pointer active:scale-95 disabled:opacity-40"
                aria-label="مسح رقم واحد"
              >
                <Delete className="w-4 h-4" />
              </button>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-colors cursor-pointer"
              >
                إلغاء والعودة
              </button>
              <button
                type="button"
                disabled={isLockedOut || pin.length === 0}
                onClick={() => handleSubmit()}
                className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-amber-500/20 transition-all cursor-pointer disabled:opacity-50 active:scale-98"
              >
                <Check className="w-4 h-4" />
                <span>دخول واعتماد الجلسة</span>
              </button>
            </div>
          </>
        )}

        {/* Security Note (Confidential PIN) */}
        <div className="mt-3 pt-2.5 border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-center gap-1.5">
          <KeyRound className="w-3 h-3 text-amber-400" />
          <span>الرقم السري محمي وخاص بكل ديسباتشر ويمكن تعديله من لوحة الأدمن</span>
        </div>
      </div>
    </div>
  );
};
