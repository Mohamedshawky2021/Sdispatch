import React from 'react';
import {
  Truck,
  Radio,
  Smartphone,
  KeyRound,
  Clock,
  AlertTriangle,
  Wifi,
  WifiOff,
  BarChart3,
  Battery,
  BatteryWarning,
  Zap,
  FileSpreadsheet,
  ShieldCheck,
  Lock,
  Unlock,
  LogOut,
  User,
} from 'lucide-react';
import { useBatteryStatus } from '../hooks/useBatteryStatus';
import { DispatcherUser } from '../types/dispatch';

interface Props {
  activeView: 'CAB' | 'CONTROL' | 'DASHBOARD';
  onViewChange: (view: 'CAB' | 'CONTROL' | 'DASHBOARD') => void;
  onOpenMobileModal: () => void;
  onOpenAdmin: () => void;
  onOpenHourlyArchive: () => void;
  onOpenEquipmentAlerts: () => void;
  activeBreakdownsCount: number;
  nextHourFormatted: string;
  isOnline?: boolean;
  pendingSyncCount?: number;
  onDirectGoogleConnect?: () => void;
  isGoogleConnected?: boolean;
  googleUserEmail?: string | null;
  isSupervisorAuthorized?: boolean;
  onLockSupervisorSession?: () => void;
  activeDispatcher?: DispatcherUser | null;
  onDispatcherLogout?: () => void;
}

export const HeaderNav: React.FC<Props> = ({
  activeView,
  onViewChange,
  onOpenMobileModal,
  onOpenAdmin,
  onOpenHourlyArchive,
  onOpenEquipmentAlerts,
  activeBreakdownsCount,
  nextHourFormatted,
  isOnline = true,
  pendingSyncCount = 0,
  onDirectGoogleConnect,
  isGoogleConnected = false,
  googleUserEmail,
  isSupervisorAuthorized = false,
  onLockSupervisorSession,
  activeDispatcher,
  onDispatcherLogout,
}) => {
  const battery = useBatteryStatus();

  return (
    <header className="sticky top-0 z-40 bg-slate-950/95 backdrop-blur-md border-b border-slate-800 px-3 md:px-6 py-2.5">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 md:gap-6">
        {/* Zone 1: Brand Wordmark */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center text-slate-950 font-black shadow-md">
            ⛏️
          </div>
          <span className="text-sm sm:text-base md:text-lg font-black tracking-tight text-slate-100 whitespace-nowrap">
            دسباتش منجم السكري
          </span>
        </div>

        {/* Zone 2: Desktop & Tablet Navigation Modes (Always visible) */}
        <nav className="hidden lg:flex items-center gap-1.5 p-1 bg-slate-900/90 border border-slate-800 rounded-xl shadow-inner">
          <button
            onClick={() => onViewChange('DASHBOARD')}
            className={`py-1.5 px-3 md:px-4 rounded-lg text-xs md:text-sm font-bold flex items-center gap-2 transition-all whitespace-nowrap shrink-0 cursor-pointer ${
              activeView === 'DASHBOARD'
                ? 'bg-amber-500 text-slate-950 shadow-md scale-102'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
            }`}
            title="لوحة تحكم الأداء والتقارير والإنتاجية"
          >
            <BarChart3 className="w-4 h-4 shrink-0" />
            <span>لوحة تحكم الأداء والتقارير</span>
            {!isSupervisorAuthorized ? (
              <span className="py-0.5 px-1.5 rounded bg-slate-950/80 text-amber-400 font-mono text-[10px] border border-amber-500/30 flex items-center gap-0.5">
                <Lock className="w-2.5 h-2.5" />
                محمي
              </span>
            ) : (
              <span className="text-emerald-400 text-xs" title="جلسة معتمدة">
                <Unlock className="w-3 h-3 inline" />
              </span>
            )}
          </button>

          <button
            onClick={() => onViewChange('CONTROL')}
            className={`py-1.5 px-3 md:px-4 rounded-lg text-xs md:text-sm font-bold flex items-center gap-2 transition-all whitespace-nowrap shrink-0 cursor-pointer ${
              activeView === 'CONTROL'
                ? 'bg-amber-500 text-slate-950 shadow-md scale-102'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
            }`}
            title="غرفة الدسباتش والمراقبة المركزية"
          >
            <Radio className="w-4 h-4 shrink-0 animate-pulse" />
            <span>غرفة الدسباتش والمراقبة</span>
            {!isSupervisorAuthorized ? (
              <span className="py-0.5 px-1.5 rounded bg-slate-950/80 text-amber-400 font-mono text-[10px] border border-amber-500/30 flex items-center gap-0.5">
                <Lock className="w-2.5 h-2.5" />
                محمي
              </span>
            ) : (
              <span className="text-emerald-400 text-xs" title="جلسة معتمدة">
                <Unlock className="w-3 h-3 inline" />
              </span>
            )}
          </button>

          <button
            onClick={() => onViewChange('CAB')}
            className={`py-1.5 px-3 md:px-4 rounded-lg text-xs md:text-sm font-bold flex items-center gap-2 transition-all whitespace-nowrap shrink-0 cursor-pointer ${
              activeView === 'CAB'
                ? 'bg-amber-500 text-slate-950 shadow-md scale-102'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
            }`}
            title="شاشة كابينة الشاحنة لتسجيل النقلات"
          >
            <Truck className="w-4 h-4 shrink-0" />
            <span>كابينة الشاحنة (السائق)</span>
          </button>
        </nav>

        {/* Zone 3: Active Dispatcher Badge & Logout Button */}
        {activeDispatcher && (
          <div className="hidden md:flex items-center gap-2 shrink-0">
            <div className="flex items-center gap-1.5 py-1.5 px-3 rounded-xl bg-slate-900 border border-amber-500/40 text-xs shadow-inner">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <User className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-slate-200 font-bold">{activeDispatcher.name}</span>
              <span className="font-mono text-[10px] bg-slate-950 px-1.5 py-0.5 rounded text-amber-400 border border-amber-500/30">
                {activeDispatcher.code}
              </span>
            </div>

            {onDispatcherLogout && (
              <button
                type="button"
                onClick={onDispatcherLogout}
                className="py-1.5 px-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs flex items-center gap-1.5 shadow-md shadow-rose-900/30 cursor-pointer active:scale-95 transition-all border border-rose-400/50"
                title="تسجيل خروج الديسباتشر والعودة لشاشة السائق"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>تسجيل خروج 🚪</span>
              </button>
            )}
          </div>
        )}

        {/* Zone 4: Actions & Quick Status */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onOpenEquipmentAlerts}
            className={`flex items-center gap-1.5 py-1.5 px-2.5 sm:px-3 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
              activeBreakdownsCount > 0
                ? 'bg-rose-950 text-rose-300 border border-rose-500/40 animate-pulse'
                : 'text-slate-300 bg-slate-900 hover:bg-slate-800 border border-slate-800'
            }`}
            title="حالات المعدات والأعطال"
          >
            <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
            <span className="hidden xl:inline">المعدات</span>
            {activeBreakdownsCount > 0 && (
              <span className="py-0.2 px-1.5 rounded-full bg-rose-600 text-white font-mono text-[10px]">
                {activeBreakdownsCount}
              </span>
            )}
          </button>

          {/* Network Status & Offline Queue Indicator */}
          <div
            className={`hidden sm:flex items-center gap-1.5 py-1.5 px-2.5 rounded-lg text-[11px] font-bold border transition-colors ${
              isOnline
                ? 'bg-emerald-950/60 text-emerald-300 border-emerald-500/30'
                : 'bg-amber-950/80 text-amber-300 border-amber-500/50 animate-pulse'
            }`}
            title={isOnline ? 'التابلت متصل بالشبكة المركزية' : 'التابلت يعمل دون اتصال - جاري الحفظ محلياً'}
          >
            {isOnline ? <Wifi className="w-3.5 h-3.5 text-emerald-400" /> : <WifiOff className="w-3.5 h-3.5 text-amber-400" />}
            <span>{isOnline ? 'متصل' : 'أوفلاين'}</span>
            {pendingSyncCount > 0 && (
              <span className="py-0.2 px-1 rounded-full bg-amber-400 text-slate-950 font-mono text-[9px]">
                {pendingSyncCount}
              </span>
            )}
          </div>

          {/* E2EE Cybersecurity Badge */}
          <div
            className="hidden 2xl:flex items-center gap-1.5 py-1.5 px-2.5 rounded-lg text-[11px] font-bold bg-teal-950/80 text-teal-300 border border-teal-500/40 shadow-sm"
            title="مسارات البيانات مشفرة طرفياً بالكامل E2EE"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-teal-400" />
            <span className="font-mono">E2EE مشفر</span>
          </div>

          {/* Tablet Battery Widget in Top Nav */}
          <div
            className={`hidden md:flex items-center gap-1.5 py-1.5 px-2 rounded-lg text-[11px] font-bold border transition-colors ${
              battery.isLowBattery
                ? 'bg-rose-950/80 text-rose-300 border-rose-500/60 animate-pulse'
                : battery.charging
                ? 'bg-emerald-950/70 text-emerald-300 border-emerald-500/40'
                : battery.level > 50
                ? 'bg-slate-900 text-slate-200 border-slate-800'
                : 'bg-amber-950/60 text-amber-300 border-amber-500/40'
            }`}
            title={`شحن بطارية التابلت: ${battery.level}% ${battery.charging ? '(متصل بالشاحن ⚡)' : ''}`}
          >
            {battery.charging ? (
              <Zap className="w-3.5 h-3.5 text-emerald-400" />
            ) : battery.isLowBattery ? (
              <BatteryWarning className="w-3.5 h-3.5 text-rose-400 animate-bounce" />
            ) : (
              <Battery className="w-3.5 h-3.5 text-slate-400" />
            )}
            <span className="font-mono">{battery.level}%</span>
          </div>

          {/* External Direct Google Account Connect */}
          {onDirectGoogleConnect && (
            <button
              type="button"
              onClick={onDirectGoogleConnect}
              className={`flex items-center gap-1 py-1.5 px-2 sm:px-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                isGoogleConnected
                  ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/50 hover:bg-emerald-900/60'
                  : 'bg-indigo-950/90 text-indigo-300 border border-indigo-500/60 hover:bg-indigo-900/60 ring-1 ring-indigo-400/40'
              }`}
              title={
                isGoogleConnected
                  ? `حساب جوجل متصل: ${googleUserEmail || 'sukaridispatch@gmail.com'}`
                  : 'ربط مباشر بحساب جوجل والمزامنة الفورية'
              }
            >
              <FileSpreadsheet className={`w-3.5 h-3.5 ${isGoogleConnected ? 'text-emerald-400' : 'text-indigo-400'}`} />
              <span className="hidden sm:inline">
                {isGoogleConnected ? 'جوجل متصل' : 'ربط جوجل'}
              </span>
              <span className={`w-2 h-2 rounded-full ${isGoogleConnected ? 'bg-emerald-400' : 'bg-amber-400 animate-ping'}`} />
            </button>
          )}

          <button
            onClick={onOpenHourlyArchive}
            className="hidden sm:flex items-center gap-1.5 py-1.5 px-2.5 rounded-lg text-xs font-bold text-slate-300 bg-slate-900 hover:bg-slate-800 border border-slate-800 transition-colors cursor-pointer"
            title="تقارير الساعات التلقائية"
          >
            <Clock className="w-3.5 h-3.5 text-sky-400" />
            <span className="font-mono tabular-nums text-sky-400">{nextHourFormatted}</span>
          </button>

          <button
            onClick={onOpenMobileModal}
            className="flex items-center gap-1 py-1.5 px-2 rounded-lg text-xs font-bold text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 transition-colors cursor-pointer"
            title="تثبيت واستخدام التطبيق على الهاتف"
          >
            <Smartphone className="w-4 h-4" />
          </button>

          <button
            onClick={onOpenAdmin}
            className="flex items-center gap-1.5 py-1.5 px-2.5 rounded-lg text-xs font-bold text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors cursor-pointer"
            title="إدارة قاعدة البيانات والمعدات والأدمن"
          >
            <KeyRound className="w-4 h-4 text-amber-400" />
            <span className="text-xs font-bold">الأدمن</span>
          </button>
        </div>
      </div>

      {/* Responsive Secondary View Switcher Bar for Mobile & Tablet (Guarantees ALWAYS 100% visible) */}
      <div className="lg:hidden mt-2 pt-2 border-t border-slate-800/80 flex flex-col gap-1.5">
        <div className="grid grid-cols-3 gap-1.5">
          <button
            onClick={() => onViewChange('DASHBOARD')}
            className={`py-2 px-1.5 rounded-xl text-xs font-bold flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
              activeView === 'DASHBOARD'
                ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                : 'bg-slate-900/90 text-slate-300 border border-slate-800 hover:bg-slate-800'
            }`}
          >
            <div className="flex items-center gap-1">
              <BarChart3 className="w-3.5 h-3.5" />
              <span>التقارير والأداء</span>
            </div>
            {!isSupervisorAuthorized ? (
              <span className="text-[9px] px-1 py-0.2 rounded bg-slate-950/70 text-amber-400 font-mono border border-amber-500/30">
                🔒 محمي
              </span>
            ) : (
              <span className="text-[9px] text-emerald-400 font-mono">🔓 مفتوح</span>
            )}
          </button>

          <button
            onClick={() => onViewChange('CONTROL')}
            className={`py-2 px-1.5 rounded-xl text-xs font-bold flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
              activeView === 'CONTROL'
                ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                : 'bg-slate-900/90 text-slate-300 border border-slate-800 hover:bg-slate-800'
            }`}
          >
            <div className="flex items-center gap-1">
              <Radio className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
              <span>غرفة الدسباتش</span>
            </div>
            {!isSupervisorAuthorized ? (
              <span className="text-[9px] px-1 py-0.2 rounded bg-slate-950/70 text-amber-400 font-mono border border-amber-500/30">
                🔒 محمي
              </span>
            ) : (
              <span className="text-[9px] text-emerald-400 font-mono">🔓 مفتوح</span>
            )}
          </button>

          <button
            onClick={() => onViewChange('CAB')}
            className={`py-2 px-1.5 rounded-xl text-xs font-bold flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
              activeView === 'CAB'
                ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                : 'bg-slate-900/90 text-slate-300 border border-slate-800 hover:bg-slate-800'
            }`}
          >
            <div className="flex items-center gap-1">
              <Truck className="w-3.5 h-3.5" />
              <span>كابينة السائق</span>
            </div>
            <span className="text-[9px] text-slate-400">تسجيل نقلات</span>
          </button>
        </div>

        {/* Mobile Dispatcher Strip if active */}
        {activeDispatcher && (
          <div className="flex items-center justify-between gap-2 p-1.5 px-3 rounded-xl bg-slate-900/90 border border-slate-800 text-xs">
            <div className="flex items-center gap-1.5 truncate">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-slate-300">الديسباتشر:</span>
              <strong className="text-amber-400 truncate">{activeDispatcher.name}</strong>
              <span className="text-[10px] font-mono text-slate-400">({activeDispatcher.code})</span>
            </div>
            {onDispatcherLogout && (
              <button
                type="button"
                onClick={onDispatcherLogout}
                className="py-1 px-2.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-[11px] flex items-center gap-1 shrink-0 cursor-pointer shadow-sm"
              >
                <LogOut className="w-3 h-3" />
                <span>خروج 🚪</span>
              </button>
            )}
          </div>
        )}
      </div>
    </header>
  );
};
