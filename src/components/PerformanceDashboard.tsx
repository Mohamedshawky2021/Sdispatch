import React, { useState, useMemo } from 'react';
import {
  BarChart3,
  TrendingUp,
  Truck as TruckIcon,
  HardHat,
  Clock,
  Download,
  Share2,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  Layers,
  Flame,
  ArrowUpRight,
  ChevronDown,
  Calendar,
  Grid,
  List,
  ChevronRight,
  ChevronLeft,
  Info,
  FileText,
  Target,
  Send,
  LogOut,
  User,
} from 'lucide-react';
import { Truck, Excavator, DumpLocation, TripLog, MaterialType, EquipmentAlert, DispatcherUser } from '../types/dispatch';
import {
  computeHourlyProductivity,
  computeTruckCumulativeStats,
  computeLoaderCumulativeStats,
  computeDailySummary,
  generatePerformanceWhatsAppSummary,
  generateEquipmentPerformanceCSV,
  filterTripsByDateAndShift,
  EquipmentCumulativeStat,
  HourlyProductivityStat,
} from '../utils/dashboardMetrics';
import { downloadCSV, openWhatsAppShare, getAppConfig, getExcavatorTargets } from '../utils/storage';
import { playClickSound } from '../utils/audio';
import { ShiftReportModal } from './ShiftReportModal';

interface Props {
  trucks: Truck[];
  excavators: Excavator[];
  dumps: DumpLocation[];
  trips: TripLog[];
  alerts?: EquipmentAlert[];
  onRefreshData?: () => void;
  nextHourFormatted?: string;
  onOpenEquipmentAlerts?: () => void;
  activeBreakdownsCount?: number;
  onBackToControl?: () => void;
  activeDispatcher?: DispatcherUser | null;
  onDispatcherLogout?: () => void;
}

export const PerformanceDashboard: React.FC<Props> = ({
  trucks,
  excavators,
  dumps,
  trips,
  alerts,
  onRefreshData,
  nextHourFormatted = '60:00',
  onOpenEquipmentAlerts,
  activeBreakdownsCount = 0,
  onBackToControl,
  activeDispatcher,
  onDispatcherLogout,
}) => {
  // Filters & State
  const [shiftFilter, setShiftFilter] = useState<'ALL' | 'MORNING' | 'NIGHT'>('ALL');
  const [equipmentTab, setEquipmentTab] = useState<'TRUCKS' | 'LOADERS'>('TRUCKS');
  const [searchQuery, setSearchQuery] = useState('');
  const [materialFilter, setMaterialFilter] = useState<string>('ALL');
  const [activityFilter, setActivityFilter] = useState<'ALL' | 'ACTIVE_ONLY' | 'IDLE_ONLY'>('ALL');
  const [sortBy, setSortBy] = useState<'TONNES' | 'TRIPS' | 'CYCLE' | 'ID'>('TONNES');
  const [viewMode, setViewMode] = useState<'CARDS' | 'TABLE'>('CARDS');
  const [selectedHour, setSelectedHour] = useState<number | null>(null);
  const [chartScope, setChartScope] = useState<'SHIFT_HOURS' | 'ALL_24_HOURS'>('SHIFT_HOURS');
  const [copiedNotification, setCopiedNotification] = useState(false);
  const [showShiftReportModal, setShowShiftReportModal] = useState(false);

  // Filtered Trips based on shift
  const filteredTrips = useMemo(() => {
    return filterTripsByDateAndShift(trips, undefined, shiftFilter);
  }, [trips, shiftFilter]);

  // Excavator Shift Productivity Metrics & Target Benchmarking
  const excavatorProductivityMetrics = useMemo(() => {
    const targets = getExcavatorTargets();
    return excavators.map(ex => {
      const exTrips = filteredTrips.filter(t => t.excavatorId === ex.id);
      const totalTripsLoaded = exTrips.length;
      const totalTonnesLoaded = exTrips.reduce((sum, t) => sum + (t.payloadTonnes || 152), 0);
      const target = targets[ex.id]?.targetTonnesPerHour || 450;

      // Estimated operating hours during shift based on trip count (~12 min per cycle)
      const operatingHours = totalTripsLoaded > 0 ? Math.min(12, Math.max(1, Math.round((totalTripsLoaded * 12) / 60 * 10) / 10)) : 0;
      const hourlyProductivity = operatingHours > 0 ? Math.round(totalTonnesLoaded / operatingHours) : 0;
      const achievementPercent = target > 0 ? Math.round((hourlyProductivity / target) * 100) : 0;
      const isUnderperforming = achievementPercent < 70 && totalTripsLoaded > 0;
      const isIdle = totalTripsLoaded === 0;

      return {
        id: ex.id,
        model: ex.model,
        benchLevel: ex.benchLevel,
        type: ex.type,
        totalTripsLoaded,
        totalTonnesLoaded,
        targetHourlyTonnes: target,
        hourlyProductivity,
        achievementPercent,
        isUnderperforming,
        isIdle,
        operatingHours,
      };
    }).sort((a, b) => b.totalTonnesLoaded - a.totalTonnesLoaded);
  }, [excavators, filteredTrips]);

  const underperformingExcavators = useMemo(() => {
    return excavatorProductivityMetrics.filter(e => e.isUnderperforming || (e.isIdle && e.id !== 'Others'));
  }, [excavatorProductivityMetrics]);

  // Daily Summary Metrics
  const summary = useMemo(() => {
    const config = getAppConfig();
    return computeDailySummary(filteredTrips, config.targetShiftTonnes || 30000);
  }, [filteredTrips]);

  // Hourly Productivity Breakdown (24h)
  const hourlyStats = useMemo(() => {
    return computeHourlyProductivity(filteredTrips);
  }, [filteredTrips]);

  // Cumulative Stats for Dump Trucks (DT001 - DT060)
  const truckStats = useMemo(() => {
    return computeTruckCumulativeStats(trucks, filteredTrips);
  }, [trucks, filteredTrips]);

  // Cumulative Stats for Loaders (EX08, EX09, SH02-06, WL01-05, EX11, EX12, Others)
  const loaderStats = useMemo(() => {
    return computeLoaderCumulativeStats(excavators, filteredTrips);
  }, [excavators, filteredTrips]);

  // Filter & Sort active equipment list
  const activeEquipmentList = useMemo(() => {
    const list = equipmentTab === 'TRUCKS' ? truckStats : loaderStats;

    return list
      .filter((eq) => {
        // Search query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const matchId = eq.id.toLowerCase().includes(q);
          const matchName = eq.name.toLowerCase().includes(q);
          const matchPartner = eq.topPartner.toLowerCase().includes(q);
          if (!matchId && !matchName && !matchPartner) return false;
        }

        // Activity filter
        if (activityFilter === 'ACTIVE_ONLY' && eq.totalTrips === 0) return false;
        if (activityFilter === 'IDLE_ONLY' && eq.totalTrips > 0) return false;

        // Material filter
        if (materialFilter !== 'ALL') {
          if (materialFilter === 'ORE_HIGH' && eq.materialsBreakdown.highGradeTonnes === 0) return false;
          if (materialFilter === 'ORE_MEDIUM' && eq.materialsBreakdown.mediumGradeTonnes === 0) return false;
          if (materialFilter === 'ORE_LOW' && eq.materialsBreakdown.lowGradeTonnes === 0) return false;
          if (materialFilter === 'SUB_GRADE' && eq.materialsBreakdown.subGradeTonnes === 0) return false;
          if (materialFilter === 'WASTE' && eq.materialsBreakdown.wasteTonnes === 0) return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'TONNES') return b.totalTonnes - a.totalTonnes;
        if (sortBy === 'TRIPS') return b.totalTrips - a.totalTrips;
        if (sortBy === 'CYCLE') {
          if (a.avgCycleMinutes === 0) return 1;
          if (b.avgCycleMinutes === 0) return -1;
          return a.avgCycleMinutes - b.avgCycleMinutes;
        }
        return a.id.localeCompare(b.id, undefined, { numeric: true });
      });
  }, [equipmentTab, truckStats, loaderStats, searchQuery, activityFilter, materialFilter, sortBy]);

  // Top performers
  const topTrucks = useMemo(() => {
    return [...truckStats].sort((a, b) => b.totalTonnes - a.totalTonnes);
  }, [truckStats]);

  const topLoaders = useMemo(() => {
    return [...loaderStats].sort((a, b) => b.totalTonnes - a.totalTonnes);
  }, [loaderStats]);

  // Displayed hours in the chart
  const displayedHourlyStats = useMemo(() => {
    if (chartScope === 'ALL_24_HOURS') return hourlyStats;
    // Shift hours: 06:00 to 19:00 (Day shift window) or active hours with trips
    return hourlyStats.filter((h) => (h.hourIndex >= 6 && h.hourIndex <= 19) || h.totalTrips > 0);
  }, [hourlyStats, chartScope]);

  // Chart Max Tonnes for SVG scaling
  const maxHourlyTonnes = useMemo(() => {
    const max = Math.max(...displayedHourlyStats.map((h) => h.totalTonnes), 2500);
    return Math.ceil(max / 500) * 500;
  }, [displayedHourlyStats]);

  // Selected hour details
  const activeSelectedHourData = useMemo(() => {
    if (selectedHour === null) return null;
    return hourlyStats.find((h) => h.hourIndex === selectedHour) || null;
  }, [hourlyStats, selectedHour]);

  // Actions
  const handleExportCSV = () => {
    playClickSound();
    const csv = generateEquipmentPerformanceCSV(truckStats, loaderStats, summary);
    const dateStr = new Date().toISOString().split('T')[0];
    downloadCSV(csv, `sukari_equipment_performance_${dateStr}.csv`);
  };

  const handleShareWhatsApp = () => {
    playClickSound();
    const text = generatePerformanceWhatsAppSummary(summary, topTrucks, topLoaders, hourlyStats);
    openWhatsAppShare(text);
  };

  return (
    <div className="flex-1 bg-slate-950 text-slate-100 p-4 md:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto w-full">
      {/* Active Dispatcher Strip & Prominent Logout */}
      {activeDispatcher && (
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 px-4 rounded-xl bg-slate-900 border border-amber-500/40 w-full shadow-inner">
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <div>
              <span className="text-xs text-slate-400">الديسباتشر المسؤول عن تقارير الوردية: </span>
              <strong className="text-sm font-black text-amber-400">{activeDispatcher.name}</strong>
              <span className="mr-2 font-mono text-xs bg-slate-800 px-2 py-0.5 rounded text-slate-300 border border-slate-700">
                كود: {activeDispatcher.code}
              </span>
              <span className="mr-2 text-[11px] text-emerald-400 font-bold">
                (تسجيل التقارير باسمه)
              </span>
            </div>
          </div>

          {onDispatcherLogout && (
            <button
              type="button"
              onClick={onDispatcherLogout}
              className="py-2 px-4 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white font-black text-xs md:text-sm flex items-center gap-2 shadow-lg shadow-rose-900/40 cursor-pointer active:scale-95 transition-all border border-rose-400"
              title="تسجيل خروج الديسباتشر والعودة لشاشة السائق"
            >
              <LogOut className="w-4 h-4" />
              <span>تسجيل خروج الديسباتشر 🚪</span>
            </button>
          )}
        </div>
      )}

      {/* Top Header & Control Strip */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 md:p-6 shadow-xl flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
              <BarChart3 className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-black tracking-tight text-white flex items-center gap-2">
                <span>لوحة تحكم الأداء التراكمي</span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 font-medium">
                  منجم السكري ⛏️
                </span>
              </h1>
              <p className="text-xs md:text-sm text-slate-400 mt-1 flex flex-wrap items-center gap-2">
                <span>{summary.dateStr}</span>
                <span aria-hidden="true">·</span>
                <span className="text-amber-400 font-medium">{summary.shiftName}</span>
                <span aria-hidden="true">·</span>
                <span>الحمولات القياسية 152 طن / دنبر</span>
                <span aria-hidden="true">·</span>
                <span className="text-emerald-400">التصدير الساعي القادم بعد: {nextHourFormatted}</span>
              </p>
            </div>
          </div>
        </div>

        {/* Global Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Shift Filter Segmented Control */}
          <div className="flex items-center p-1 bg-slate-950 border border-slate-800 rounded-xl">
            <button
              onClick={() => {
                playClickSound();
                setShiftFilter('ALL');
              }}
              className={`py-1.5 px-3 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                shiftFilter === 'ALL'
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              كامل اليوم
            </button>
            <button
              onClick={() => {
                playClickSound();
                setShiftFilter('MORNING');
              }}
              className={`py-1.5 px-3 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                shiftFilter === 'MORNING'
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              وردية صباحية
            </button>
            <button
              onClick={() => {
                playClickSound();
                setShiftFilter('NIGHT');
              }}
              className={`py-1.5 px-3 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                shiftFilter === 'NIGHT'
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              وردية ليلية
            </button>
          </div>

          {/* Comprehensive Shift Report & PDF Export */}
          <button
            onClick={() => {
              playClickSound();
              setShowShiftReportModal(true);
            }}
            className="flex items-center gap-2 py-2 px-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 text-xs font-black transition-all shadow-md cursor-pointer active:scale-95"
            title="توليد تقارير أداء شاملة للوردية تتضمن ساعات العمل والنقلات ومعدل الإنتاجية المتوسط وتصديرها كملف PDF"
          >
            <FileText className="w-4 h-4" />
            <span>تقرير الوردية الشامل (PDF) 📄</span>
          </button>

          {/* Export CSV */}
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 py-2 px-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 transition-colors shadow-sm cursor-pointer"
            title="تنزيل ملف إكسيل تفصيلي بالأداء اليومي للمعدات"
          >
            <Download className="w-4 h-4 text-emerald-400" />
            <span>تصدير إكسيل (CSV)</span>
          </button>

          {/* Refresh Data */}
          {onRefreshData && (
            <button
              onClick={() => {
                playClickSound();
                onRefreshData();
              }}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors cursor-pointer"
              title="تحديث البيانات الفورية"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards Strip */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
        {/* KPI 1: Total Weight */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>الوزن التراكمي اليومي</span>
            <span className="text-amber-400">⚖️</span>
          </div>
          <div className="my-2">
            <div className="text-2xl md:text-3xl font-black text-amber-400 tracking-tight">
              {summary.totalTonnesToday.toLocaleString('en-US')}
            </div>
            <div className="text-[11px] text-slate-400 font-medium">طن خام وصخور منقولة</div>
          </div>
          {/* Target Progress Bar */}
          <div>
            <div className="flex justify-between text-[10px] text-slate-400 mb-1">
              <span>المستهدف: {summary.shiftTargetTonnes.toLocaleString('en-US')} طن</span>
              <span className="text-amber-400 font-bold">{summary.shiftTargetPercent}%</span>
            </div>
            <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-amber-500 to-emerald-400 rounded-full transition-all duration-500"
                style={{ width: `${summary.shiftTargetPercent}%` }}
              />
            </div>
          </div>
        </div>

        {/* KPI 2: Total Trips */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>إجمالي النقلات</span>
            <span className="text-emerald-400">🚛</span>
          </div>
          <div className="my-2">
            <div className="text-2xl md:text-3xl font-black text-white tracking-tight">
              {summary.totalTripsToday}
            </div>
            <div className="text-[11px] text-slate-400 font-medium">نقلة مكتملة ومفرغة</div>
          </div>
          <div className="text-[11px] text-slate-400 flex items-center justify-between border-t border-slate-800/80 pt-1.5">
            <span>المعدل الساعي:</span>
            <span className="font-bold text-slate-200">{summary.avgTripsPerHour} نقلة/س</span>
          </div>
        </div>

        {/* KPI 3: High Grade & Gold Ore */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>خام الذهب (Ore)</span>
            <span className="text-amber-400">✨</span>
          </div>
          <div className="my-2">
            <div className="text-2xl md:text-3xl font-black text-emerald-400 tracking-tight">
              {summary.oreTonnes.toLocaleString('en-US')}
            </div>
            <div className="text-[11px] text-slate-400 font-medium">
              طن ({summary.orePercentage}% من الإجمالي)
            </div>
          </div>
          <div className="text-[10px] text-slate-400 flex items-center gap-1 border-t border-slate-800/80 pt-1.5 truncate">
            <span>هاي + ميديم + لو جريد</span>
          </div>
        </div>

        {/* KPI 4: Waste Rock */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>صخور عقيمة (Waste)</span>
            <span className="text-slate-400">⛰️</span>
          </div>
          <div className="my-2">
            <div className="text-2xl md:text-3xl font-black text-slate-300 tracking-tight">
              {summary.wasteTonnes.toLocaleString('en-US')}
            </div>
            <div className="text-[11px] text-slate-400 font-medium">
              طن ({summary.wastePercentage}% للمقالب)
            </div>
          </div>
          <div className="text-[10px] text-slate-400 flex items-center justify-between border-t border-slate-800/80 pt-1.5">
            <span>سب جريد:</span>
            <span className="text-cyan-400 font-bold">{summary.subGradeTonnes.toLocaleString('en-US')} طن</span>
          </div>
        </div>

        {/* KPI 5: Average Cycle Time */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>متوسط زمن الدورة</span>
            <span className="text-blue-400">⏱️</span>
          </div>
          <div className="my-2">
            <div className="text-2xl md:text-3xl font-black text-blue-400 tracking-tight">
              {summary.avgCycleMinutes}
            </div>
            <div className="text-[11px] text-slate-400 font-medium">دقيقة / نقلة كاملة</div>
          </div>
          <div className="text-[10px] text-slate-400 flex items-center justify-between border-t border-slate-800/80 pt-1.5">
            <span>المعدل الميداني:</span>
            <span className="text-emerald-400 font-bold">11-16 دقيقة</span>
          </div>
        </div>

        {/* KPI 6: Active Fleet in Pit */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>المعدات العاملة بالميدان</span>
            <span className="text-purple-400">🚜</span>
          </div>
          <div className="my-2 flex items-baseline gap-2">
            <div className="text-2xl md:text-3xl font-black text-purple-300 tracking-tight">
              {summary.activeTrucksCount}
            </div>
            <span className="text-xs text-slate-400">/ 60 دنبر</span>
          </div>
          <div className="text-[11px] text-slate-400 flex items-center justify-between border-t border-slate-800/80 pt-1.5">
            <span>معدات تحميل:</span>
            <span className="font-bold text-amber-400">{summary.activeLoadersCount} معدة</span>
          </div>
        </div>
      </div>

      {/* Hourly Productivity Section (الرسوم البيانية لمعدلات الإنتاجية لكل ساعة) */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 md:p-6 shadow-xl space-y-5">
        {/* Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div>
            <h2 className="text-lg md:text-xl font-black text-white flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-amber-400" />
              <span>معدل الإنتاجية الساعي (Hourly Productivity Rate)</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              توزيع الحمولات بالأطنان وعدد النقلات لكل ساعة خلال اليوم بناءً على بيانات الـ trips
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* View Scope Toggle */}
            <div className="flex items-center p-0.5 bg-slate-950 border border-slate-800 rounded-lg text-xs">
              <button
                onClick={() => {
                  playClickSound();
                  setChartScope('SHIFT_HOURS');
                }}
                className={`py-1 px-2.5 rounded-md font-bold transition-colors cursor-pointer ${
                  chartScope === 'SHIFT_HOURS'
                    ? 'bg-amber-500 text-slate-950'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                ساعات النشاط
              </button>
              <button
                onClick={() => {
                  playClickSound();
                  setChartScope('ALL_24_HOURS');
                }}
                className={`py-1 px-2.5 rounded-md font-bold transition-colors cursor-pointer ${
                  chartScope === 'ALL_24_HOURS'
                    ? 'bg-amber-500 text-slate-950'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                24 ساعة كاملة
              </button>
            </div>

            {/* Peak Hour Tag */}
            <div className="hidden md:flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-bold">
              <span>ساعة الذروة:</span>
              <span className="text-white">{summary.peakHourLabel}</span>
              <span>({summary.peakHourTonnes.toLocaleString('en-US')} طن)</span>
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400 bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm bg-amber-500 shadow-sm" />
              <span>خام ذهب (Ore HG/MG/LG)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm bg-cyan-500 shadow-sm" />
              <span>سب جريد (Sub Grade)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm bg-slate-600 shadow-sm" />
              <span>صخور عقيمة (Waste)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-0.5 bg-emerald-400" />
              <span>مؤشر عدد النقلات (Trips)</span>
            </div>
          </div>

          <div className="text-[11px] text-slate-400">
            * اضغط على أي عمود ساعي لعرض تفاصيل الشاحنات ومعدات التحميل النشطة في تلك الساعة
          </div>
        </div>

        {/* Interactive SVG Bar & Trend Chart */}
        <div className="relative w-full bg-slate-950 border border-slate-800 rounded-xl p-4 overflow-x-auto">
          {displayedHourlyStats.length === 0 ? (
            <div className="py-16 text-center text-slate-500">
              لا توجد نقلات مسجلة ضمن ساعات الفلتر المحددة
            </div>
          ) : (
            <div className="min-w-[680px]">
              {/* SVG Canvas */}
              <div className="h-64 w-full relative">
                <svg
                  className="w-full h-full overflow-visible"
                  viewBox={`0 0 ${displayedHourlyStats.length * 52} 240`}
                  preserveAspectRatio="none"
                >
                  <defs>
                    <linearGradient id="oreGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.95" />
                      <stop offset="100%" stopColor="#d97706" stopOpacity="0.75" />
                    </linearGradient>
                    <linearGradient id="subGradeGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.95" />
                      <stop offset="100%" stopColor="#0891b2" stopOpacity="0.75" />
                    </linearGradient>
                    <linearGradient id="wasteGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#64748b" stopOpacity="0.9" />
                      <stop offset="100%" stopColor="#475569" stopOpacity="0.6" />
                    </linearGradient>
                  </defs>

                  {/* Horizontal Grid Guidelines */}
                  {[0, 0.25, 0.5, 0.75, 1].map((pct, idx) => {
                    const y = 200 - pct * 180;
                    const value = Math.round(maxHourlyTonnes * pct);
                    return (
                      <g key={idx}>
                        <line
                          x1="0"
                          y1={y}
                          x2={displayedHourlyStats.length * 52}
                          y2={y}
                          stroke="#1e293b"
                          strokeDasharray="3 3"
                        />
                        <text
                          x="5"
                          y={y - 4}
                          fill="#64748b"
                          fontSize="9"
                          fontWeight="bold"
                        >
                          {value.toLocaleString('en-US')} طن
                        </text>
                      </g>
                    );
                  })}

                  {/* Shift Hourly Target Line (e.g. 2,500 tonnes / hour) */}
                  {(() => {
                    const targetTonnes = 2500;
                    const targetY = 200 - (targetTonnes / maxHourlyTonnes) * 180;
                    if (targetY >= 20 && targetY <= 200) {
                      return (
                        <g>
                          <line
                            x1="0"
                            y1={targetY}
                            x2={displayedHourlyStats.length * 52}
                            y2={targetY}
                            stroke="#10b981"
                            strokeWidth="1.5"
                            strokeDasharray="4 4"
                          />
                          <text
                            x={displayedHourlyStats.length * 52 - 110}
                            y={targetY - 4}
                            fill="#10b981"
                            fontSize="9"
                            fontWeight="bold"
                          >
                            مستهدف الساعة (2,500 طن)
                          </text>
                        </g>
                      );
                    }
                    return null;
                  })()}

                  {/* Bars per Hour */}
                  {displayedHourlyStats.map((stat, i) => {
                    const barWidth = 32;
                    const x = i * 52 + 10;
                    const totalH = (stat.totalTonnes / maxHourlyTonnes) * 180;
                    const oreH = (stat.oreTonnes / maxHourlyTonnes) * 180;
                    const subH = (stat.subGradeTonnes / maxHourlyTonnes) * 180;
                    const wasteH = (stat.wasteTonnes / maxHourlyTonnes) * 180;

                    const baseY = 200;
                    const isSelected = selectedHour === stat.hourIndex;

                    return (
                      <g
                        key={stat.hourIndex}
                        onClick={() => {
                          playClickSound();
                          setSelectedHour(isSelected ? null : stat.hourIndex);
                        }}
                        className="cursor-pointer transition-opacity group"
                        opacity={selectedHour !== null && !isSelected ? 0.45 : 1}
                      >
                        {/* Hover / Active Highlight Backdrop */}
                        {isSelected && (
                          <rect
                            x={x - 6}
                            y="15"
                            width={barWidth + 12}
                            height="205"
                            fill="#f59e0b"
                            fillOpacity="0.12"
                            rx="8"
                          />
                        )}

                        {/* Waste Bar (Bottom) */}
                        {wasteH > 0 && (
                          <rect
                            x={x}
                            y={baseY - wasteH}
                            width={barWidth}
                            height={wasteH}
                            fill="url(#wasteGradient)"
                            rx={oreH === 0 && subH === 0 ? '4' : '0'}
                          />
                        )}

                        {/* Sub Grade Bar (Middle) */}
                        {subH > 0 && (
                          <rect
                            x={x}
                            y={baseY - wasteH - subH}
                            width={barWidth}
                            height={subH}
                            fill="url(#subGradeGradient)"
                            rx={oreH === 0 ? '4' : '0'}
                          />
                        )}

                        {/* Ore Bar (Top) */}
                        {oreH > 0 && (
                          <rect
                            x={x}
                            y={baseY - totalH}
                            width={barWidth}
                            height={oreH}
                            fill="url(#oreGradient)"
                            rx="4"
                          />
                        )}

                        {/* Empty Hour Placeholder Line */}
                        {stat.totalTonnes === 0 && (
                          <line
                            x1={x}
                            y1={baseY}
                            x2={x + barWidth}
                            y2={baseY}
                            stroke="#334155"
                            strokeWidth="2"
                          />
                        )}

                        {/* Metric Label above bar */}
                        {stat.totalTonnes > 0 && (
                          <text
                            x={x + barWidth / 2}
                            y={Math.max(16, baseY - totalH - 6)}
                            textAnchor="middle"
                            fill={isSelected ? '#f59e0b' : '#ffffff'}
                            fontSize="9"
                            fontWeight="bold"
                          >
                            {stat.totalTonnes >= 1000 ? `${(stat.totalTonnes / 1000).toFixed(1)}k` : stat.totalTonnes}
                          </text>
                        )}

                        {/* Trip Count Badge / Dot */}
                        {stat.totalTrips > 0 && (
                          <circle
                            cx={x + barWidth / 2}
                            cy={baseY - totalH}
                            r="3"
                            fill="#10b981"
                            stroke="#0f172a"
                            strokeWidth="1.5"
                          />
                        )}

                        {/* Hour Axis Label */}
                        <text
                          x={x + barWidth / 2}
                          y={218}
                          textAnchor="middle"
                          fill={stat.isCurrentHour ? '#f59e0b' : '#94a3b8'}
                          fontSize="10"
                          fontWeight={stat.isCurrentHour || isSelected ? 'bold' : 'normal'}
                        >
                          {stat.hourLabel}
                        </text>

                        {/* Current Hour Indicator */}
                        {stat.isCurrentHour && (
                          <circle
                            cx={x + barWidth / 2}
                            cy="230"
                            r="2.5"
                            fill="#f59e0b"
                          />
                        )}
                      </g>
                    );
                  })}
                </svg>
              </div>
            </div>
          )}
        </div>

        {/* Selected Hour Insight Drawer / Card */}
        {activeSelectedHourData && (
          <div className="bg-slate-950 border-2 border-amber-500/60 rounded-xl p-4 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-amber-500/20 text-amber-400 font-black text-lg">
                {activeSelectedHourData.hourLabel}
              </div>
              <div>
                <div className="text-white font-bold text-sm flex items-center gap-2">
                  <span>تفاصيل إنتاجية الساعة {activeSelectedHourData.hourLabel}</span>
                  {activeSelectedHourData.isCurrentHour && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
                      الساعة الجارية الحالية ⏱️
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-400 mt-0.5 flex flex-wrap items-center gap-3">
                  <span>إجمالي الحمولات: <strong className="text-amber-400">{activeSelectedHourData.totalTonnes.toLocaleString('en-US')} طن</strong></span>
                  <span>·</span>
                  <span>عدد النقلات: <strong className="text-emerald-400">{activeSelectedHourData.totalTrips} نقلة</strong></span>
                  <span>·</span>
                  <span>خام الذهب: <strong className="text-amber-300">{activeSelectedHourData.oreTonnes.toLocaleString('en-US')} طن</strong></span>
                  <span>·</span>
                  <span>عقيم: <strong className="text-slate-300">{activeSelectedHourData.wasteTonnes.toLocaleString('en-US')} طن</strong></span>
                  <span>·</span>
                  <span>معدل الدقيقة: <strong className="text-cyan-400">{activeSelectedHourData.ratePerMinute} طن/د</strong></span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs">
              <div className="bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800">
                <span className="text-slate-400">أعلى معدة تحميل: </span>
                <span className="font-bold text-amber-400">{activeSelectedHourData.topLoader} ({activeSelectedHourData.topLoaderTrips} نقلة)</span>
              </div>
              <div className="bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800">
                <span className="text-slate-400">الدنابر النشطة ({activeSelectedHourData.activeTrucksCount}): </span>
                <span className="font-bold text-slate-200">
                  {activeSelectedHourData.activeTrucks.slice(0, 5).join(', ')}
                  {activeSelectedHourData.activeTrucks.length > 5 ? ` +${activeSelectedHourData.activeTrucks.length - 5}` : ''}
                </span>
              </div>
              <button
                onClick={() => setSelectedHour(null)}
                className="text-xs text-slate-400 hover:text-white px-2 py-1 rounded bg-slate-800 cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>
        )}
      </div>

      {/* EXCAVATOR SHIFT PRODUCTIVITY RATE CHART & UNDERPERFORMER IDENTIFICATION */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 md:p-6 shadow-xl space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg md:text-xl font-black text-white flex items-center gap-2">
                <HardHat className="w-5 h-5 text-amber-400" />
                <span>معدل الإنتاجية لكل حفارة ومقارنة الأداء (Excavator Productivity Benchmark)</span>
              </h2>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold border border-amber-500/40">
                14 معدة تحميل
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              رسم بياني مقارن لمعدل الإنتاجية الساعي المحقق لكل حفار مع المستهدف المعتمد لتحديد الحفارات ذات الأداء المنخفض
            </p>
          </div>

          {/* Underperforming Alert Badge */}
          {underperformingExcavators.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="py-1 px-3 rounded-xl bg-rose-500/20 border border-rose-500 text-rose-300 font-bold text-xs flex items-center gap-1.5 animate-pulse">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                <span>{underperformingExcavators.length} حفارات منخفضة الأداء (&lt;70%)</span>
              </span>
            </div>
          )}
        </div>

        {/* Visual Bar Comparison Chart */}
        <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {excavatorProductivityMetrics.map(ex => {
              const target = ex.targetHourlyTonnes;
              const actual = ex.hourlyProductivity;
              const percent = ex.achievementPercent;
              const isLow = ex.isUnderperforming || (ex.isIdle && ex.id !== 'Others');

              return (
                <div
                  key={ex.id}
                  className={`p-3.5 rounded-xl border transition-all ${
                    isLow
                      ? 'bg-rose-950/20 border-rose-500/60 shadow-md shadow-rose-950/20'
                      : percent >= 95
                      ? 'bg-slate-900 border-emerald-500/40'
                      : 'bg-slate-900 border-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-black text-sm text-amber-400">{ex.id}</span>
                      <span className="text-xs text-slate-300 font-bold truncate max-w-[150px]">{ex.benchLevel.split('(')[0]}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-mono text-slate-400">
                        {ex.totalTonnesLoaded.toLocaleString()} طن ({ex.totalTripsLoaded} نقلة)
                      </span>
                      <span
                        className={`text-xs font-mono font-bold py-0.5 px-2 rounded ${
                          percent >= 90
                            ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/30'
                            : percent >= 70
                            ? 'bg-amber-950 text-amber-400 border border-amber-500/30'
                            : 'bg-rose-950 text-rose-400 border border-rose-500/40'
                        }`}
                      >
                        {percent}%
                      </span>
                    </div>
                  </div>

                  {/* Progress Bar vs Target Line */}
                  <div className="relative w-full h-3 rounded-full bg-slate-800 overflow-hidden mb-1.5">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${
                        isLow ? 'bg-gradient-to-r from-rose-600 to-rose-400' : 'bg-gradient-to-r from-emerald-600 to-emerald-400'
                      }`}
                      style={{ width: `${Math.min(100, percent)}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span>الفعلي: <strong className="text-slate-200 font-mono">{actual} طن/س</strong></span>
                    <span>المستهدف: <strong className="text-amber-400 font-mono">{target} طن/س</strong></span>
                    {isLow ? (
                      <span className="text-rose-400 font-bold flex items-center gap-1">
                        ⚠️ أداء منخفض (-{100 - percent}%)
                      </span>
                    ) : (
                      <span className="text-emerald-400 font-bold">أداء متوافق ✅</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Equipment Performance Cumulative Section (إحصائيات تراكمية يومية للحمولات لكل معدة) */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 md:p-6 shadow-xl space-y-5">
        {/* Section Header & Equipment Switcher */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <h2 className="text-lg md:text-xl font-black text-white flex items-center gap-2">
              <TruckIcon className="w-5 h-5 text-amber-400" />
              <span>إحصائيات الحمولات التراكمية لكل معدة (Equipment Cumulative Loads)</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              إجمالي النقلات والوزن الكلي (حمولات 152 طن) وتوزيع الخامات ومعدل الدورات لكل شاحنة وحفار
            </p>
          </div>

          {/* Primary Equipment Switcher Tabs */}
          <div className="flex items-center p-1 bg-slate-950 border border-slate-800 rounded-xl">
            <button
              onClick={() => {
                playClickSound();
                setEquipmentTab('TRUCKS');
              }}
              className={`py-1.5 px-4 rounded-lg text-xs md:text-sm font-bold flex items-center gap-2 transition-colors cursor-pointer ${
                equipmentTab === 'TRUCKS'
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <TruckIcon className="w-4 h-4" />
              <span>دنابر النقل (DT001 - DT060) [{truckStats.length}]</span>
            </button>

            <button
              onClick={() => {
                playClickSound();
                setEquipmentTab('LOADERS');
              }}
              className={`py-1.5 px-4 rounded-lg text-xs md:text-sm font-bold flex items-center gap-2 transition-colors cursor-pointer ${
                equipmentTab === 'LOADERS'
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <HardHat className="w-4 h-4" />
              <span>معدات التحميل (الحفارات والشوڤلات) [{loaderStats.length}]</span>
            </button>
          </div>
        </div>

        {/* Filters & Search Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Search Box */}
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={equipmentTab === 'TRUCKS' ? 'ابحث برقم الدنبر (مثل DT012)...' : 'ابحث بكود الحفار (مثل EX08، SH03)...'}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pr-9 pl-4 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Activity Filter */}
            <select
              value={activityFilter}
              onChange={(e) => setActivityFilter(e.target.value as any)}
              className="bg-slate-950 border border-slate-800 text-slate-300 rounded-xl px-3 py-2 text-xs font-medium focus:outline-none focus:border-amber-500 cursor-pointer"
            >
              <option value="ALL">كل الحالات النشطة والواقفة</option>
              <option value="ACTIVE_ONLY">معدات نفذت نقلات اليوم فقط</option>
              <option value="IDLE_ONLY">معدات بدون نقلات / متوقفة</option>
            </select>

            {/* Material Filter */}
            <select
              value={materialFilter}
              onChange={(e) => setMaterialFilter(e.target.value)}
              className="bg-slate-950 border border-slate-800 text-slate-300 rounded-xl px-3 py-2 text-xs font-medium focus:outline-none focus:border-amber-500 cursor-pointer"
            >
              <option value="ALL">كل أنواع الخامات</option>
              <option value="ORE_HIGH">هاي جريد (HG +2.5g/t)</option>
              <option value="ORE_MEDIUM">ميديم جريد (MG)</option>
              <option value="ORE_LOW">لو جريد (LG)</option>
              <option value="SUB_GRADE">سب جريد (SG)</option>
              <option value="WASTE">صخور عقيمة (Waste)</option>
            </select>

            {/* Sort Filter */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-slate-950 border border-slate-800 text-slate-300 rounded-xl px-3 py-2 text-xs font-medium focus:outline-none focus:border-amber-500 cursor-pointer"
            >
              <option value="TONNES">الترتيب: الأكثر وزناً (الأعلى أطنان)</option>
              <option value="TRIPS">الترتيب: الأكثر نقلات</option>
              <option value="CYCLE">الترتيب: الأسرع في زمن الدورة</option>
              <option value="ID">الترتيب: حسب تسلسل رقم المعدة</option>
            </select>

            {/* View Mode Toggle */}
            <div className="flex items-center p-0.5 bg-slate-950 border border-slate-800 rounded-lg">
              <button
                onClick={() => setViewMode('CARDS')}
                className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                  viewMode === 'CARDS' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'
                }`}
                title="عرض البطاقات الذكية"
              >
                <Grid className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setViewMode('TABLE')}
                className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                  viewMode === 'TABLE' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'
                }`}
                title="عرض الجدول التفصيلي"
              >
                <List className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Results Counter */}
        <div className="text-xs text-slate-400 flex items-center justify-between">
          <span>
            يتم عرض <strong className="text-white">{activeEquipmentList.length}</strong> معدة من إجمالي{' '}
            {equipmentTab === 'TRUCKS' ? truckStats.length : loaderStats.length}
          </span>
          <span className="text-[11px] text-slate-500">
            * حمولة الدنبر المعتمدة في الحسابات: 152 طن / نقلة
          </span>
        </div>

        {/* Display: Cards Mode */}
        {viewMode === 'CARDS' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {activeEquipmentList.map((eq) => {
              const isTop = eq.totalTonnes > 0 && (equipmentTab === 'TRUCKS' ? eq.totalTonnes >= 1000 : eq.totalTonnes >= 3000);
              const isBreakdown = eq.status === 'BREAKDOWN';
              const isMaintenance = eq.status === 'MAINTENANCE';

              return (
                <div
                  key={eq.id}
                  className={`bg-slate-950 rounded-xl p-4 border transition-all duration-200 flex flex-col justify-between ${
                    isBreakdown
                      ? 'border-rose-500/50 bg-rose-950/10'
                      : isMaintenance
                      ? 'border-amber-500/50 bg-amber-950/10'
                      : isTop
                      ? 'border-amber-500/40 shadow-md shadow-amber-500/5'
                      : 'border-slate-800 hover:border-slate-700'
                  }`}
                >
                  {/* Card Header */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-base font-black text-white">{eq.id}</span>
                        {isTop && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
                            ⭐ متميز
                          </span>
                        )}
                      </div>

                      {/* Equipment Status Badge */}
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-md font-bold ${
                          isBreakdown
                            ? 'bg-rose-900/60 text-rose-300 border border-rose-600'
                            : isMaintenance
                            ? 'bg-amber-900/60 text-amber-300 border border-amber-600'
                            : eq.totalTrips > 0
                            ? 'bg-emerald-900/40 text-emerald-300 border border-emerald-600/40'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {isBreakdown
                          ? 'عطل ميكانيكي'
                          : isMaintenance
                          ? 'صيانة'
                          : eq.totalTrips > 0
                          ? 'بالخدمة نشط'
                          : 'جاهز / انتظار'}
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-400 truncate mb-3">
                      {eq.equipmentTypeStr}
                    </div>

                    {/* Big Metrics */}
                    <div className="grid grid-cols-2 gap-2 bg-slate-900/80 p-2.5 rounded-lg border border-slate-800/80 mb-3">
                      <div>
                        <div className="text-[10px] text-slate-400">إجمالي الحمولات</div>
                        <div className="text-lg font-black text-amber-400 tracking-tight">
                          {eq.totalTonnes.toLocaleString('en-US')}
                          <span className="text-[10px] font-normal text-slate-400 mr-1">طن</span>
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-400">عدد النقلات</div>
                        <div className="text-lg font-black text-white tracking-tight">
                          {eq.totalTrips}
                          <span className="text-[10px] font-normal text-slate-400 mr-1">نقلة</span>
                        </div>
                      </div>
                    </div>

                    {/* Progress to Target */}
                    <div className="space-y-1 mb-3">
                      <div className="flex justify-between text-[10px] text-slate-400">
                        <span>إنجاز المستهدف ({eq.targetTonnes.toLocaleString('en-US')} طن)</span>
                        <span className="font-bold text-amber-400">{eq.targetCompletionPercent}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            eq.targetCompletionPercent >= 80
                              ? 'bg-emerald-500'
                              : eq.targetCompletionPercent >= 40
                              ? 'bg-amber-500'
                              : 'bg-slate-700'
                          }`}
                          style={{ width: `${Math.min(100, eq.targetCompletionPercent)}%` }}
                        />
                      </div>
                    </div>

                    {/* Material Tonnage Stack */}
                    <div className="space-y-1 text-[10px] text-slate-400 border-t border-slate-800/80 pt-2 mb-2">
                      <div className="flex justify-between">
                        <span className="text-amber-400 font-medium">خام هاي جريد (HG):</span>
                        <span className="font-bold text-slate-200">
                          {eq.materialsBreakdown.highGradeTonnes.toLocaleString('en-US')} طن ({eq.materialsBreakdown.highGradeTrips} نقلة)
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-cyan-400 font-medium">سب جريد (SG):</span>
                        <span className="font-bold text-slate-200">
                          {eq.materialsBreakdown.subGradeTonnes.toLocaleString('en-US')} طن
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400 font-medium">صخور عقيمة (Waste):</span>
                        <span className="font-bold text-slate-200">
                          {eq.materialsBreakdown.wasteTonnes.toLocaleString('en-US')} طن
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Card Footer */}
                  <div className="text-[10px] text-slate-400 border-t border-slate-800/80 pt-2 flex items-center justify-between">
                    <div>
                      <span>متوسط الدورة: </span>
                      <strong className="text-white">{eq.avgCycleMinutes > 0 ? `${eq.avgCycleMinutes} د` : '-'}</strong>
                    </div>
                    <div>
                      <span>الشريك: </span>
                      <strong className="text-amber-400">{eq.topPartner}</strong>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Display: Detailed Table Mode */}
        {viewMode === 'TABLE' && (
          <div className="overflow-x-auto border border-slate-800 rounded-xl">
            <table className="w-full text-right text-xs text-slate-200">
              <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 text-[11px] font-bold">
                <tr>
                  <th className="py-3 px-3">كود المعدة</th>
                  <th className="py-3 px-3">الوصف</th>
                  <th className="py-3 px-3">الحالة</th>
                  <th className="py-3 px-3 text-amber-400">إجمالي النقلات</th>
                  <th className="py-3 px-3 text-amber-400">الوزن الكلي (طن)</th>
                  <th className="py-3 px-3 text-amber-300">هاي جريد</th>
                  <th className="py-3 px-3 text-orange-300">ميديم جريد</th>
                  <th className="py-3 px-3 text-cyan-300">سب جريد</th>
                  <th className="py-3 px-3 text-slate-400">صخور عقيمة</th>
                  <th className="py-3 px-3">متوسط الدورة</th>
                  <th className="py-3 px-3">المعدة الأكثر ارتباطاً</th>
                  <th className="py-3 px-3">المستهدف (%)</th>
                  <th className="py-3 px-3">آخر نقلة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 bg-slate-950/40">
                {activeEquipmentList.map((eq) => (
                  <tr key={eq.id} className="hover:bg-slate-900/60 transition-colors">
                    <td className="py-2.5 px-3 font-black text-white">{eq.id}</td>
                    <td className="py-2.5 px-3 text-slate-400 text-[11px]">{eq.equipmentTypeStr}</td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded ${
                          eq.status === 'BREAKDOWN'
                            ? 'bg-rose-950 text-rose-300 border border-rose-600'
                            : eq.status === 'MAINTENANCE'
                            ? 'bg-amber-950 text-amber-300 border border-amber-600'
                            : eq.totalTrips > 0
                            ? 'bg-emerald-950 text-emerald-300'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {eq.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-bold text-white">{eq.totalTrips}</td>
                    <td className="py-2.5 px-3 font-black text-amber-400">
                      {eq.totalTonnes.toLocaleString('en-US')}
                    </td>
                    <td className="py-2.5 px-3 text-amber-300 font-medium">
                      {eq.materialsBreakdown.highGradeTonnes.toLocaleString('en-US')}
                    </td>
                    <td className="py-2.5 px-3 text-orange-300 font-medium">
                      {eq.materialsBreakdown.mediumGradeTonnes.toLocaleString('en-US')}
                    </td>
                    <td className="py-2.5 px-3 text-cyan-300 font-medium">
                      {eq.materialsBreakdown.subGradeTonnes.toLocaleString('en-US')}
                    </td>
                    <td className="py-2.5 px-3 text-slate-400">
                      {eq.materialsBreakdown.wasteTonnes.toLocaleString('en-US')}
                    </td>
                    <td className="py-2.5 px-3 font-mono">
                      {eq.avgCycleMinutes > 0 ? `${eq.avgCycleMinutes} د` : '-'}
                    </td>
                    <td className="py-2.5 px-3 text-amber-400 font-bold">{eq.topPartner}</td>
                    <td className="py-2.5 px-3 font-bold text-emerald-400">
                      {eq.targetCompletionPercent}%
                    </td>
                    <td className="py-2.5 px-3 text-slate-400 text-[11px]">
                      {eq.lastTripTime || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Leaderboard & Highlights Strip */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Top 5 Dump Trucks */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 md:p-5 shadow-xl">
          <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <span className="text-amber-400">🏆</span>
              <span>أعلى 5 دنابر إنتاجية اليوم (حمولات 152 طن)</span>
            </h3>
            <span className="text-xs text-slate-400">الترتيب بالأطنان</span>
          </div>

          <div className="space-y-2.5">
            {topTrucks.slice(0, 5).map((t, idx) => (
              <div
                key={t.id}
                className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800/80 hover:border-amber-500/30 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-6 h-6 rounded-lg flex items-center justify-center font-black text-xs ${
                      idx === 0
                        ? 'bg-amber-500 text-slate-950'
                        : idx === 1
                        ? 'bg-slate-300 text-slate-950'
                        : idx === 2
                        ? 'bg-amber-700 text-white'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {idx + 1}
                  </div>
                  <div>
                    <div className="text-sm font-black text-white">{t.id}</div>
                    <div className="text-[11px] text-slate-400">
                      {t.totalTrips} نقلة · متوسط الدورة {t.avgCycleMinutes} دقيقة
                    </div>
                  </div>
                </div>

                <div className="text-left">
                  <div className="text-sm font-black text-amber-400">
                    {t.totalTonnes.toLocaleString('en-US')} طن
                  </div>
                  <div className="text-[10px] text-emerald-400 font-medium">
                    {t.targetCompletionPercent}% من المستهدف
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top 5 Loading Units */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 md:p-5 shadow-xl">
          <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <span className="text-amber-400">🚜</span>
              <span>أعلى 5 معدات تحميل وإنتاجية (حفارات وشوڤلات)</span>
            </h3>
            <span className="text-xs text-slate-400">الترتيب بالحمولات</span>
          </div>

          <div className="space-y-2.5">
            {topLoaders.slice(0, 5).map((l, idx) => (
              <div
                key={l.id}
                className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800/80 hover:border-amber-500/30 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-6 h-6 rounded-lg flex items-center justify-center font-black text-xs ${
                      idx === 0
                        ? 'bg-amber-500 text-slate-950'
                        : idx === 1
                        ? 'bg-slate-300 text-slate-950'
                        : idx === 2
                        ? 'bg-amber-700 text-white'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {idx + 1}
                  </div>
                  <div>
                    <div className="text-sm font-black text-white">{l.id}</div>
                    <div className="text-[11px] text-slate-400 truncate max-w-[180px]">
                      {l.equipmentTypeStr} · خدمت {l.partnerCount} دنبر
                    </div>
                  </div>
                </div>

                <div className="text-left">
                  <div className="text-sm font-black text-amber-400">
                    {l.totalTonnes.toLocaleString('en-US')} طن
                  </div>
                  <div className="text-[10px] text-slate-400">
                    {l.totalTrips} نقلة محملة
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Comprehensive Shift Report & PDF Export Modal */}
      <ShiftReportModal
        isOpen={showShiftReportModal}
        onClose={() => setShowShiftReportModal(false)}
        trucks={trucks}
        excavators={excavators}
        trips={filteredTrips}
        dumps={dumps}
      />
    </div>
  );
};
