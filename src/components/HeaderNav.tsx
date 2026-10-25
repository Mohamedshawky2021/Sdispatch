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
} from 'lucide-react';
import { useBatteryStatus } from '../hooks/useBatteryStatus';

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
}) => {
  const battery = useBatteryStatus();

  return (
    <header className="sticky top-0 z-40 bg-slate-950/90 backdrop-blur-md border-b border-slate-800 px-4 md:px-6 py-3">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 md:gap-8">
        {/* Zone 1: Brand Wordmark */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center text-slate-950 font-black shadow-md">
            ⛏️
          </div>
          <span className="text-base md:text-lg font-black tracking-tight text-slate-100 whitespace-nowrap">
            دسباتش منجم السكري
          </span>
        </div>

        {/* Zone 2: Navigation Modes */}
        <nav className="flex items-center gap-1 p-1 bg-slate-900 border border-slate-800 rounded-xl overflow-x-auto">
          <button
            onClick={() => onViewChange('DASHBOARD')}
            className={`py-1.5 px-3 md:px-4 rounded-lg text-xs md:text-sm font-bold flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeView === 'DASHBOARD'
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>لوحة تحكم الأداء</span>
          </button>

          <button
            onClick={() => onViewChange('CONTROL')}
            className={`py-1.5 px-3 md:px-4 rounded-lg text-xs md:text-sm font-bold flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeView === 'CONTROL'
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Radio className="w-4 h-4" />
            <span>غرفة الدسباتش والمراقبة</span>
          </button>

          <button
            onClick={() => onViewChange('CAB')}
            className={`py-1.5 px-3 md:px-4 rounded-lg text-xs md:text-sm font-bold flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeView === 'CAB'
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Truck className="w-4 h-4" />
            <span>كابينة الشاحنة (السائق)</span>
          </button>
        </nav>

        {/* Zone 3: Actions & Mobile Access */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onOpenEquipmentAlerts}
            className={`flex items-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
              activeBreakdownsCount > 0
                ? 'bg-rose-950 text-rose-300 border border-rose-500/40 animate-pulse'
                : 'text-slate-300 bg-slate-900 hover:bg-slate-800 border border-slate-800'
            }`}
            title="حالات المعدات والأعطال"
          >
            <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
            <span className="hidden lg:inline">حالات المعدات</span>
            {activeBreakdownsCount > 0 && (
              <span className="py-0.2 px-1.5 rounded-full bg-rose-600 text-white font-mono text-[10px]">
                {activeBreakdownsCount}
              </span>
            )}
          </button>

          {/* Network Status & Offline Queue Indicator */}
          <div
            className={`hidden md:flex items-center gap-1.5 py-1.5 px-2.5 rounded-lg text-[11px] font-bold border transition-colors ${
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
            className="hidden xl:flex items-center gap-1.5 py-1.5 px-2.5 rounded-lg text-[11px] font-bold bg-teal-950/80 text-teal-300 border border-teal-500/40 shadow-sm"
            title="نظام التشفير السيبراني المتقدم: مسارات البيانات والرسائل وحالات الأسطول مشفرة طرفياً بالكامل (E2EE) باستخدام خوارزمية AES-256-GCM"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-teal-400" />
            <span className="font-mono">E2EE مشفر</span>
          </div>

          {/* Tablet Battery Widget in Top Nav */}
          <div
            className={`hidden sm:flex items-center gap-1.5 py-1.5 px-2.5 rounded-lg text-[11px] font-bold border transition-colors ${
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
            {battery.charging && <span className="text-[10px] text-emerald-400 font-bold">⚡</span>}
          </div>

          {/* External Direct Google Account & Spreadsheet Connect Button */}
          {onDirectGoogleConnect && (
            <button
              type="button"
              onClick={onDirectGoogleConnect}
              className={`flex items-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                isGoogleConnected
                  ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/50 hover:bg-emerald-900/60'
                  : 'bg-indigo-950/90 text-indigo-300 border border-indigo-500/60 hover:bg-indigo-900/60 ring-1 ring-indigo-400/40 animate-pulse'
              }`}
              title={
                isGoogleConnected
                  ? `حساب جوجل متصل: ${googleUserEmail || 'sukaridispatch@gmail.com'}`
                  : 'ربط مباشر بحساب جوجل (sukaridispatch@gmail.com) والمزامنة الفورية'
              }
            >
              <FileSpreadsheet className={`w-3.5 h-3.5 ${isGoogleConnected ? 'text-emerald-400' : 'text-indigo-400'}`} />
              <span className="hidden md:inline">
                {isGoogleConnected ? 'جوجل متصل' : 'ربط جوجل مباشر'}
              </span>
              <span className={`w-2 h-2 rounded-full ${isGoogleConnected ? 'bg-emerald-400' : 'bg-amber-400 animate-ping'}`} />
            </button>
          )}

          <button
            onClick={onOpenHourlyArchive}
            className="hidden sm:flex items-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-bold text-slate-300 bg-slate-900 hover:bg-slate-800 border border-slate-800 transition-colors cursor-pointer"
            title="تقارير الساعات التلقائية"
          >
            <Clock className="w-3.5 h-3.5 text-sky-400" />
            <span className="font-mono tabular-nums text-sky-400">{nextHourFormatted}</span>
          </button>

          <button
            onClick={onOpenMobileModal}
            className="flex items-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-bold text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 transition-colors cursor-pointer"
            title="تثبيت واستخدام التطبيق على الهاتف"
          >
            <Smartphone className="w-4 h-4" />
            <span className="hidden md:inline">على الموبايل</span>
          </button>

          <button
            onClick={onOpenAdmin}
            className="flex items-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-bold text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors cursor-pointer"
            title="إدارة قاعدة البيانات والمعدات"
          >
            <KeyRound className="w-4 h-4 text-amber-400" />
            <span className="hidden sm:inline">الأدمن</span>
          </button>
        </div>
      </div>
    </header>
  );
};
