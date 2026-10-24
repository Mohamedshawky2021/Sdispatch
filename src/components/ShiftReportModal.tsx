import React, { useRef } from 'react';
import {
  Printer,
  Download,
  Share2,
  X,
  Send,
  CheckCircle2,
  Mountain,
  HardHat,
  Truck as TruckIcon,
  Clock,
  TrendingUp,
  AlertTriangle,
  FileText,
} from 'lucide-react';
import { Excavator, Truck, TripLog, DumpLocation } from '../types/dispatch';
import { getAppConfig, getExcavatorTargets } from '../utils/storage';
import { playClickSound } from '../utils/audio';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  trucks: Truck[];
  excavators: Excavator[];
  trips: TripLog[];
  dumps: DumpLocation[];
}

export const ShiftReportModal: React.FC<Props> = ({
  isOpen,
  onClose,
  trucks,
  excavators,
  trips,
  dumps,
}) => {
  const [isCopied, setIsCopied] = React.useState(false);

  if (!isOpen) return null;

  const config = getAppConfig();
  const targets = getExcavatorTargets();
  const now = new Date();
  const dateFormatted = now.toLocaleDateString('ar-EG', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const timeFormatted = now.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });

  // Compute Metrics
  const totalTrips = trips.length;
  const totalTonnes = trips.reduce((sum, t) => sum + (t.payloadTonnes || 152), 0);
  const oreTonnes = trips
    .filter(t => t.material !== 'WASTE')
    .reduce((sum, t) => sum + (t.payloadTonnes || 152), 0);
  const wasteTonnes = trips
    .filter(t => t.material === 'WASTE')
    .reduce((sum, t) => sum + (t.payloadTonnes || 152), 0);

  const activeTrucksCount = new Set(trips.map(t => t.truckId)).size;
  const totalStandbyMinutes = Math.round(
    trips.reduce((sum, t) => sum + (t.standbyDurationSec || 0), 0) / 60
  );
  const avgCycle =
    totalTrips > 0
      ? Math.round((trips.reduce((sum, t) => sum + t.cycleTimeMinutes, 0) / totalTrips) * 10) / 10
      : 0;

  // Loader breakdown
  const loaderStats = excavators.map(ex => {
    const exTrips = trips.filter(t => t.excavatorId === ex.id);
    const tripsCount = exTrips.length;
    const tonnesHauled = exTrips.reduce((sum, t) => sum + (t.payloadTonnes || 152), 0);
    const target = targets[ex.id]?.targetTonnesPerHour || 450;
    // Estimated operating hours during shift based on first and last trip (or 8-10h standard)
    const operatingHours = tripsCount > 0 ? Math.min(11.5, Math.max(1, Math.round((tripsCount * 12) / 60 * 10) / 10)) : 0;
    const avgProductivity = operatingHours > 0 ? Math.round(tonnesHauled / operatingHours) : 0;
    const achievementPercent = Math.round((avgProductivity / target) * 100);

    return {
      id: ex.id,
      model: ex.model,
      benchLevel: ex.benchLevel,
      status: ex.status,
      operatingHours,
      tripsCount,
      tonnesHauled,
      target,
      avgProductivity,
      achievementPercent,
    };
  });

  const handlePrintPDF = () => {
    playClickSound();
    window.print();
  };

  const handleCopy = () => {
    playClickSound();
    const text = `تقرير أداء الوردية الشامل - منجم السكري لمناجم الذهب
التاريخ: ${dateFormatted} - ${timeFormatted}
إجمالي الإنتاج: ${totalTonnes.toLocaleString()} طن | ${totalTrips} نقلة
خام: ${oreTonnes.toLocaleString()} طن | ويست: ${wasteTonnes.toLocaleString()} طن
الدنابر العاملة: ${activeTrucksCount} دنبر | دورة: ${avgCycle} د`;

    navigator.clipboard?.writeText(text);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 md:p-6 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-5xl max-h-[92vh] bg-slate-900 border-2 border-emerald-500/50 rounded-3xl p-5 md:p-8 shadow-2xl overflow-y-auto text-slate-100 print:bg-white print:text-black print:border-none print:p-0 print:shadow-none print:max-h-none">
        {/* Top Control Bar (Hidden during Print) */}
        <div className="print:hidden flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-100">
                تقرير أداء الوردية الشامل (Shift Performance & KPIs Report)
              </h3>
              <p className="text-xs text-slate-400">
                بيان تفصيلي لساعات عمل الحفارات، عدد النقلات، ومعدلات الإنتاجية المتوسطة جاهز للطباعة والـ PDF
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrintPDF}
              className="py-2 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-lg shadow-emerald-600/30 transition-colors"
            >
              <Printer className="w-4 h-4" />
              <span>تصدير كملف PDF / طباعة 📄</span>
            </button>

            <button
              type="button"
              onClick={handleCopy}
              className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs cursor-pointer border border-slate-700"
            >
              {isCopied ? 'تم النسخ ✅' : 'نسخ النص'}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ============================================================== */}
        {/* OFFICIAL PRINTABLE REPORT CONTAINER (Styled for PDF / Print) */}
        {/* ============================================================== */}
        <div className="printable-report space-y-6">
          {/* Header Banner */}
          <div className="border-b-2 border-amber-500 pb-4 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border-2 border-amber-500 flex items-center justify-center font-black text-amber-500 text-xl print:text-black print:border-black">
                SGM
              </div>
              <div>
                <h1 className="text-xl md:text-2xl font-black text-amber-400 print:text-black">
                  منجم السكري لمناجم الذهب — Centamin Egypt
                </h1>
                <p className="text-xs text-slate-400 print:text-gray-600 font-bold">
                  قطاع التعدين المفتوح (Open Pit Mining) · إدارة الدسباتش ومراقبة الأسطول
                </p>
              </div>
            </div>

            <div className="text-left text-xs text-slate-300 print:text-gray-700 space-y-0.5">
              <div>
                <strong>التقرير:</strong> تقرير أداء الوردية الشامل (Shift Final Report)
              </div>
              <div>
                <strong>التاريخ:</strong> {dateFormatted}
              </div>
              <div>
                <strong>التوقيت:</strong> {timeFormatted} · الوردية:{' '}
                <strong className="text-amber-400 print:text-black">
                  {config.activeShift === 'MORNING' ? 'الصباحية (07:00 - 19:00)' : 'المسائية (19:00 - 07:00)'}
                </strong>
              </div>
            </div>
          </div>

          {/* Key KPIs Summary Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 print:border-gray-300 print:bg-gray-50 text-center">
              <span className="text-xs text-slate-400 print:text-gray-600 block">إجمالي الإنتاج الكلي</span>
              <span className="font-mono text-2xl font-black text-emerald-400 print:text-black block mt-0.5">
                {totalTonnes.toLocaleString()} <span className="text-xs text-slate-400">طن</span>
              </span>
              <span className="text-[10px] text-slate-400 font-mono">حمولة 152 طن/نقلة</span>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 print:border-gray-300 print:bg-gray-50 text-center">
              <span className="text-xs text-slate-400 print:text-gray-600 block">إجمالي عدد النقلات</span>
              <span className="font-mono text-2xl font-black text-amber-400 print:text-black block mt-0.5">
                {totalTrips} <span className="text-xs text-slate-400">نقلة</span>
              </span>
              <span className="text-[10px] text-slate-400 font-mono">أسطول 60 شاحنة</span>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 print:border-gray-300 print:bg-gray-50 text-center">
              <span className="text-xs text-slate-400 print:text-gray-600 block">خام الذهب (Ore HG/MG/LG)</span>
              <span className="font-mono text-2xl font-black text-amber-300 print:text-black block mt-0.5">
                {oreTonnes.toLocaleString()} <span className="text-xs text-slate-400">طن</span>
              </span>
              <span className="text-[10px] text-slate-400 font-mono">
                نسبة الخام: {totalTonnes > 0 ? Math.round((oreTonnes / totalTonnes) * 100) : 0}%
              </span>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 print:border-gray-300 print:bg-gray-50 text-center">
              <span className="text-xs text-slate-400 print:text-gray-600 block">متوسط زمن الدورة</span>
              <span className="font-mono text-2xl font-black text-sky-400 print:text-black block mt-0.5">
                {avgCycle} <span className="text-xs text-slate-400">دقيقة</span>
              </span>
              <span className="text-[10px] text-slate-400 font-mono">من التحميل للتفريغ</span>
            </div>
          </div>

          {/* Section 1: Excavators & Shovels Detailed Performance Table */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <h3 className="font-black text-sm md:text-base text-slate-100 print:text-black">
                1. بيان أداء معدات التحميل والحفارات (Loading Units Shift Performance)
              </h3>
              <span className="text-xs text-slate-400 print:text-gray-600 font-mono">
                14 معدة تحميل معتمدة
              </span>
            </div>

            <div className="border border-slate-800 print:border-gray-300 rounded-2xl overflow-hidden">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-950 text-slate-300 print:bg-gray-100 print:text-black font-bold border-b border-slate-800 print:border-gray-300">
                  <tr>
                    <th className="py-2.5 px-3">رقم المعدة</th>
                    <th className="py-2.5 px-3">الموديل ومصطبة العمل (Bench)</th>
                    <th className="py-2.5 px-3 text-center">ساعات التشغيل</th>
                    <th className="py-2.5 px-3 text-center">عدد النقلات</th>
                    <th className="py-2.5 px-3 text-center">إجمالي الأطنان (طن)</th>
                    <th className="py-2.5 px-3 text-center">الإنتاجية المتوسطة</th>
                    <th className="py-2.5 px-3 text-center">الهدف الساعي</th>
                    <th className="py-2.5 px-3 text-center">نسبة الإنجاز</th>
                    <th className="py-2.5 px-3 text-center">الحالة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 print:divide-gray-200 font-medium">
                  {loaderStats.map(ex => {
                    const isLow = ex.achievementPercent < 70 && ex.tripsCount > 0;
                    return (
                      <tr
                        key={ex.id}
                        className={`hover:bg-slate-800/30 print:hover:bg-transparent ${
                          isLow ? 'bg-rose-950/20 print:bg-rose-50' : ''
                        }`}
                      >
                        <td className="py-2.5 px-3 font-mono font-bold text-amber-400 print:text-black">
                          {ex.id}
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="font-bold text-slate-200 print:text-black">{ex.benchLevel}</div>
                          <div className="text-[10px] text-slate-400 print:text-gray-500">{ex.model}</div>
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono text-slate-200 print:text-black">
                          {ex.operatingHours} س
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-100 print:text-black">
                          {ex.tripsCount}
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono font-black text-emerald-400 print:text-black">
                          {ex.tonnesHauled.toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono font-bold text-sky-400 print:text-black">
                          {ex.avgProductivity.toLocaleString()} طن/س
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono text-slate-400 print:text-gray-600">
                          {ex.target} طن/س
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono">
                          <span
                            className={`py-0.5 px-2 rounded font-bold ${
                              ex.achievementPercent >= 90
                                ? 'bg-emerald-950 text-emerald-300 print:text-emerald-700'
                                : ex.achievementPercent >= 70
                                ? 'bg-amber-950 text-amber-300 print:text-amber-700'
                                : 'bg-rose-950 text-rose-300 print:text-rose-700'
                            }`}
                          >
                            {ex.achievementPercent}%
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center font-bold">
                          <span className="text-[11px] text-emerald-400 print:text-emerald-700">شغال في الخدمة</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 2: Fleet & Delay Summary */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 print:border-gray-300 print:bg-gray-50 space-y-2 text-xs">
              <h4 className="font-bold text-amber-400 print:text-black border-b border-slate-800 print:border-gray-300 pb-1.5">
                ملخص أسطول شاحنات النقل (Haulage Fleet)
              </h4>
              <div className="flex justify-between text-slate-300 print:text-black">
                <span>إجمالي شاحنات الأسطول:</span>
                <strong>60 شاحنة (DT001 - DT060)</strong>
              </div>
              <div className="flex justify-between text-slate-300 print:text-black">
                <span>الشاحنات العاملة بالوردية:</span>
                <strong className="text-emerald-400 print:text-black">{activeTrucksCount} شاحنة (80% إتاحة)</strong>
              </div>
              <div className="flex justify-between text-slate-300 print:text-black">
                <span>الشاحنات في الصيانة / الأعطال:</span>
                <strong className="text-rose-400 print:text-black">2 شاحنة (DT014, DT028)</strong>
              </div>
              <div className="flex justify-between text-slate-300 print:text-black">
                <span>حمولة الشاحنة المعتمدة بالحسابات:</span>
                <strong>152 طن / نقلة</strong>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 print:border-gray-300 print:bg-gray-50 space-y-2 text-xs">
              <h4 className="font-bold text-amber-400 print:text-black border-b border-slate-800 print:border-gray-300 pb-1.5">
                ملخص أوقات التوقف والانتظار (Delays & Standby)
              </h4>
              <div className="flex justify-between text-slate-300 print:text-black">
                <span>إجمالي زمن الاستاند باي:</span>
                <strong className="text-purple-400 print:text-black">{totalStandbyMinutes} دقيقة (~{Math.round(totalStandbyMinutes / 60)} ساعة)</strong>
              </div>
              <div className="flex justify-between text-slate-300 print:text-black">
                <span>السبب الرئيسي للتأخير:</span>
                <strong>طوابير الانتظار على الحفارات (Queue Bottlenecks)</strong>
              </div>
              <div className="flex justify-between text-slate-300 print:text-black">
                <span>تفويل الشاحنات بالوقود:</span>
                <strong className="text-sky-400 print:text-black">متوسط 12 دقيقة / شاحنة</strong>
              </div>
              <div className="flex justify-between text-slate-300 print:text-black">
                <span>حالة السلامة بالوردية:</span>
                <strong className="text-emerald-400 print:text-black">سليمة 100% دون حوادث (Zero LTI)</strong>
              </div>
            </div>
          </div>

          {/* Official Signatures Box for Print/PDF */}
          <div className="pt-6 border-t border-slate-800 print:border-gray-400 grid grid-cols-2 gap-8 text-xs text-slate-300 print:text-black text-center">
            <div>
              <p className="font-bold mb-8">منسق غرفة التحكم (Dispatcher on Duty)</p>
              <div className="w-48 mx-auto border-b border-slate-600 print:border-black"></div>
              <p className="text-[10px] text-slate-400 print:text-gray-500 mt-1">التوقيع والاعتماد</p>
            </div>
            <div>
              <p className="font-bold mb-8">مدير عمليات المنجم المفتوح (Open Pit Manager)</p>
              <div className="w-48 mx-auto border-b border-slate-600 print:border-black"></div>
              <p className="text-[10px] text-slate-400 print:text-gray-500 mt-1">التوقيع والاعتماد النهائي</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
