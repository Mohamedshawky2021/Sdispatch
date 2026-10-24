import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  AreaChart,
  Area,
} from 'recharts';
import {
  TrendingUp,
  BarChart3,
  HardHat,
  Truck as TruckIcon,
  Clock,
  Layers,
  Filter,
  RefreshCw,
  Zap,
} from 'lucide-react';
import { TripLog, Truck, Excavator, DumpLocation } from '../types/dispatch';

interface Props {
  trips: TripLog[];
  trucks: Truck[];
  excavators: Excavator[];
  dumps?: DumpLocation[];
}

export const ProductivityChartsTab: React.FC<Props> = ({
  trips,
  trucks,
  excavators,
  dumps = [],
}) => {
  const [selectedEquipmentType, setSelectedEquipmentType] = useState<'ALL' | 'CAT785' | 'SHOVEL' | 'EXCAVATOR' | 'LOADER'>('ALL');
  const [timeScope, setTimeScope] = useState<'SHIFT' | 'ALL_24H'>('ALL_24H');

  // Compute 24-hour hourly stats
  const hourlyData = useMemo(() => {
    const hours = Array.from({ length: 24 }, (_, i) => {
      const hourStr = `${String(i).padStart(2, '0')}:00`;
      return {
        hour: hourStr,
        hourIndex: i,
        totalTonnes: 0,
        oreTonnes: 0,
        wasteTonnes: 0,
        tripsCount: 0,
        avgCycleTime: 0,
        cat785Tonnes: 0,
        shovelTonnes: 0,
        excavatorTonnes: 0,
        loaderTonnes: 0,
        cycleSum: 0,
      };
    });

    trips.forEach((trip) => {
      const d = new Date(trip.dumpTime);
      const h = d.getHours();
      if (h >= 0 && h < 24) {
        const payload = trip.payloadTonnes || 152;
        hours[h].totalTonnes += payload;
        hours[h].tripsCount += 1;
        hours[h].cycleSum += trip.cycleTimeMinutes || 0;

        if (trip.material === 'WASTE') {
          hours[h].wasteTonnes += payload;
        } else {
          hours[h].oreTonnes += payload;
        }

        // Equipment Type Categorization
        const ex = excavators.find((e) => e.id === trip.excavatorId);
        if (trip.truckId.startsWith('DT')) {
          hours[h].cat785Tonnes += payload;
        }

        if (ex) {
          if (ex.type === 'SHOVEL' || ex.id.startsWith('SH')) {
            hours[h].shovelTonnes += payload;
          } else if (ex.type === 'WHEEL_LOADER' || ex.id.startsWith('WL')) {
            hours[h].loaderTonnes += payload;
          } else {
            hours[h].excavatorTonnes += payload;
          }
        }
      }
    });

    return hours.map((h) => ({
      ...h,
      avgCycleTime: h.tripsCount > 0 ? Math.round((h.cycleSum / h.tripsCount) * 10) / 10 : 0,
    }));
  }, [trips, excavators]);

  const displayedData = useMemo(() => {
    if (timeScope === 'ALL_24H') return hourlyData;
    // Morning shift 06:00 to 18:00 or hours with production
    return hourlyData.filter((h) => (h.hourIndex >= 6 && h.hourIndex <= 18) || h.tripsCount > 0);
  }, [hourlyData, timeScope]);

  // Overall KPIs
  const totalTonnes = useMemo(() => trips.reduce((sum, t) => sum + (t.payloadTonnes || 152), 0), [trips]);
  const oreTonnes = useMemo(() => trips.filter((t) => t.material !== 'WASTE').reduce((sum, t) => sum + (t.payloadTonnes || 152), 0), [trips]);
  const wasteTonnes = useMemo(() => trips.filter((t) => t.material === 'WASTE').reduce((sum, t) => sum + (t.payloadTonnes || 152), 0), [trips]);

  const peakHour = useMemo(() => {
    let max = { hour: '00:00', totalTonnes: 0 };
    hourlyData.forEach((h) => {
      if (h.totalTonnes > max.totalTonnes) {
        max = { hour: h.hour, totalTonnes: h.totalTonnes };
      }
    });
    return max;
  }, [hourlyData]);

  // Excavator Comparison Data
  const excavatorComparisonData = useMemo(() => {
    return excavators.map((ex) => {
      const exTrips = trips.filter((t) => t.excavatorId === ex.id);
      const exTonnes = exTrips.reduce((sum, t) => sum + (t.payloadTonnes || 152), 0);
      const targetPerHour = 450;
      return {
        id: ex.id,
        name: `${ex.id} (${ex.type === 'SHOVEL' ? 'شاول' : ex.type === 'WHEEL_LOADER' ? 'لودر' : 'حفار'})`,
        tonnes: exTonnes,
        trips: exTrips.length,
        target: targetPerHour * 8, // shift target
      };
    });
  }, [trips, excavators]);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Banner & Filter Controls */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
            <BarChart3 className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg md:text-xl font-black text-slate-100 flex items-center gap-2">
              <span>الرسوم البيانية التفاعلية ومعدلات الإنتاجية بالساعة</span>
              <span className="text-[11px] font-bold py-0.5 px-2.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                Recharts Live 📊
              </span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              تحليل دقيق آني لمعدلات إنتاج الدنابر، شوافل الحفر، وحفارات الهيدروليك لكل ساعة
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Time Filter */}
          <div className="flex rounded-xl bg-slate-950 p-1 border border-slate-800 text-xs">
            <button
              onClick={() => setTimeScope('ALL_24H')}
              className={`py-1.5 px-3 rounded-lg font-bold transition-all cursor-pointer ${
                timeScope === 'ALL_24H' ? 'bg-amber-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'
              }`}
            >
              24 ساعة كاملة
            </button>
            <button
              onClick={() => setTimeScope('SHIFT')}
              className={`py-1.5 px-3 rounded-lg font-bold transition-all cursor-pointer ${
                timeScope === 'SHIFT' ? 'bg-amber-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'
              }`}
            >
              ساعات الوردية
            </button>
          </div>

          {/* Equipment Category Filter */}
          <select
            value={selectedEquipmentType}
            onChange={(e) => setSelectedEquipmentType(e.target.value as any)}
            className="py-2 px-3 rounded-xl bg-slate-950 border border-slate-700 text-xs font-bold text-slate-200 focus:border-amber-500 focus:outline-none"
          >
            <option value="ALL">جميع أسطول المعدات</option>
            <option value="CAT785">شاحنات CAT 785D (152t)</option>
            <option value="SHOVEL">شوافل الحفر والتحميل (SH)</option>
            <option value="EXCAVATOR">حفارات الهيدروليك (EX)</option>
            <option value="LOADER">لوادر العجل الكبيرة (WL)</option>
          </select>
        </div>
      </div>

      {/* Metric Cards Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-1">
          <span className="text-xs text-slate-400 font-bold block">إجمالي الإنتاج الكلي:</span>
          <div className="text-xl md:text-2xl font-black font-mono text-emerald-400">
            {totalTonnes.toLocaleString()} <span className="text-xs text-slate-400 font-normal">طن</span>
          </div>
          <span className="text-[10px] text-slate-500 block">إجمالي النقلات: {trips.length} نقلة</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-1">
          <span className="text-xs text-slate-400 font-bold block">خام الذهب المستخلص (Ore):</span>
          <div className="text-xl md:text-2xl font-black font-mono text-amber-400">
            {oreTonnes.toLocaleString()} <span className="text-xs text-slate-400 font-normal">طن</span>
          </div>
          <span className="text-[10px] text-amber-500/80 block">
            {totalTonnes > 0 ? Math.round((oreTonnes / totalTonnes) * 100) : 0}% من إجمالي الصخور
          </span>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-1">
          <span className="text-xs text-slate-400 font-bold block">الصخور العقيمة والردم:</span>
          <div className="text-xl md:text-2xl font-black font-mono text-rose-400">
            {wasteTonnes.toLocaleString()} <span className="text-xs text-slate-400 font-normal">طن</span>
          </div>
          <span className="text-[10px] text-slate-500 block">توجيه لمقالب الويست</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-1">
          <span className="text-xs text-slate-400 font-bold block">أعلى ساعة إنتاجية (Peak):</span>
          <div className="text-xl md:text-2xl font-black font-mono text-sky-400">
            {peakHour.totalTonnes.toLocaleString()} <span className="text-xs text-slate-400 font-normal">طن</span>
          </div>
          <span className="text-[10px] text-sky-400/80 block">عند الساعة {peakHour.hour}</span>
        </div>
      </div>

      {/* Chart 1: Hourly Production by Equipment Category */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-amber-400" />
            <h3 className="font-bold text-sm md:text-base text-slate-100">
              معدل الإنتاجية بالساعة لكل نوع من المعدات (طن صخري / ساعة)
            </h3>
          </div>
          <span className="text-xs text-slate-400">محسوبة تلقائياً من حمولات الـ 152 طن</span>
        </div>

        <div className="h-80 w-full pt-2" dir="ltr">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={displayedData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="hour" stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <YAxis stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0f172a',
                  borderColor: '#334155',
                  borderRadius: '12px',
                  color: '#fff',
                  fontSize: '12px',
                  direction: 'rtl',
                }}
              />
              <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }} />
              {selectedEquipmentType === 'ALL' || selectedEquipmentType === 'CAT785' ? (
                <Bar dataKey="cat785Tonnes" name="دنابر CAT 785 (طن)" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              ) : null}
              {selectedEquipmentType === 'ALL' || selectedEquipmentType === 'SHOVEL' ? (
                <Bar dataKey="shovelTonnes" name="شوافل الحفر والتحميل (طن)" fill="#10b981" radius={[4, 4, 0, 0]} />
              ) : null}
              {selectedEquipmentType === 'ALL' || selectedEquipmentType === 'EXCAVATOR' ? (
                <Bar dataKey="excavatorTonnes" name="حفارات الهيدروليك (طن)" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
              ) : null}
              {selectedEquipmentType === 'ALL' || selectedEquipmentType === 'LOADER' ? (
                <Bar dataKey="loaderTonnes" name="لوادر العجل (طن)" fill="#a855f7" radius={[4, 4, 0, 0]} />
              ) : null}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Grid of Two Secondary Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 2: Ore vs Waste Material Breakdown */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-emerald-400" />
              <h3 className="font-bold text-sm text-slate-100">
                توزيع نوع المادة المنقولة بالساعة (Ore vs. Waste)
              </h3>
            </div>
            <span className="text-[11px] text-slate-400">خام ذهب مقابل ردم</span>
          </div>

          <div className="h-64 w-full pt-2" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={displayedData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="hour" stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                <YAxis stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#334155',
                    borderRadius: '12px',
                    color: '#fff',
                    fontSize: '11px',
                    direction: 'rtl',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '6px' }} />
                <Area type="monotone" dataKey="oreTonnes" name="خام الذهب (طن)" stackId="1" stroke="#eab308" fill="#eab308" fillOpacity={0.6} />
                <Area type="monotone" dataKey="wasteTonnes" name="ردم صخري عقيم (طن)" stackId="1" stroke="#f43f5e" fill="#f43f5e" fillOpacity={0.4} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 3: Cycle Time Trend per Hour */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-sky-400" />
              <h3 className="font-bold text-sm text-slate-100">
                متوسط زمن دورة النقل بالساعة (Cycle Time)
              </h3>
            </div>
            <span className="text-[11px] text-slate-400">بالدقائق (تحميل + نقل + تفريغ)</span>
          </div>

          <div className="h-64 w-full pt-2" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={displayedData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="hour" stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                <YAxis stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#334155',
                    borderRadius: '12px',
                    color: '#fff',
                    fontSize: '11px',
                    direction: 'rtl',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '6px' }} />
                <Line
                  type="monotone"
                  dataKey="avgCycleTime"
                  name="متوسط زمن الدورة (دقيقة)"
                  stroke="#38bdf8"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: '#0284c7' }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Loader Productivity Leaderboard */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-3">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <HardHat className="w-5 h-5 text-amber-400" />
            <h3 className="font-bold text-sm md:text-base text-slate-100">
              إنتاجية وحدات ومعدات التحميل (الحفارات والشوافل الـ 14)
            </h3>
          </div>
          <span className="text-xs text-slate-400">مقارنة إجمالي التحميل بالطن</span>
        </div>

        <div className="h-64 w-full pt-2" dir="ltr">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={excavatorComparisonData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="id" stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <YAxis stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0f172a',
                  borderColor: '#334155',
                  borderRadius: '12px',
                  color: '#fff',
                  fontSize: '11px',
                  direction: 'rtl',
                }}
              />
              <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '6px' }} />
              <Bar dataKey="tonnes" name="الحمولة المنفذة (طن)" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};
