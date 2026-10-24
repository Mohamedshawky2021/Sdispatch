import React, { useState } from 'react';
import {
  AlertTriangle,
  Clock,
  TrendingDown,
  Send,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Radio,
  Flame,
  Truck as TruckIcon,
  HardHat,
  Fuel,
  RefreshCw,
} from 'lucide-react';
import { TripLog, Truck, Excavator, FuelingLog, ProductionGapAlert } from '../types/dispatch';
import { detectProductionGaps } from '../utils/storage';
import { playClickSound } from '../utils/audio';

interface Props {
  trips: TripLog[];
  trucks: Truck[];
  excavators: Excavator[];
  activeFuelings: FuelingLog[];
  onSelectTruckForMessage?: (truckId: string) => void;
}

export const ProductionGapAlertsPanel: React.FC<Props> = ({
  trips,
  trucks,
  excavators,
  activeFuelings,
  onSelectTruckForMessage,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [dismissedAlertIds, setDismissedAlertIds] = useState<Record<string, boolean>>({});

  // Compute live production gaps (> 15 mins delay)
  const allGaps = detectProductionGaps(trips, trucks, excavators, activeFuelings);
  const visibleGaps = allGaps.filter(g => !dismissedAlertIds[g.id]);

  const criticalCount = visibleGaps.filter(g => g.severity === 'CRITICAL').length;
  const warningCount = visibleGaps.filter(g => g.severity === 'WARNING').length;
  const totalEstimatedLostTonnes = visibleGaps.reduce((sum, g) => sum + g.estimatedTonsLost, 0);

  const handleDismiss = (id: string) => {
    playClickSound();
    setDismissedAlertIds(prev => ({ ...prev, [id]: true }));
  };

  return (
    <div className="mb-5 rounded-2xl border-2 transition-all duration-300 shadow-xl overflow-hidden bg-slate-900 border-amber-500/50">
      {/* Header Bar */}
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className={`p-4 flex flex-wrap items-center justify-between gap-3 cursor-pointer select-none transition-colors ${
          criticalCount > 0
            ? 'bg-gradient-to-r from-rose-950/80 via-slate-900 to-slate-900'
            : 'bg-gradient-to-r from-amber-950/60 via-slate-900 to-slate-900'
        }`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`w-11 h-11 rounded-xl flex items-center justify-center font-bold shrink-0 ${
              criticalCount > 0
                ? 'bg-rose-500/20 border-2 border-rose-500 text-rose-400 animate-pulse'
                : 'bg-amber-500/20 border-2 border-amber-500 text-amber-400'
            }`}
          >
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-black text-base md:text-lg text-slate-100">
                لوحة تنبيهات الفجوات الإنتاجية (Production Gap Alerts)
              </h3>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                +15 دقيقة انحراف
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              رصد ذكي آني لأي وحدة ميدانية تتأخر عن دورة العمل المعيارية لأكثر من 15 دقيقة
            </p>
          </div>
        </div>

        {/* Metric Badges & Expand Toggle */}
        <div className="flex items-center gap-2.5 mr-auto md:mr-0">
          {criticalCount > 0 && (
            <span className="py-1 px-3 rounded-xl bg-rose-500 text-slate-950 font-black text-xs animate-bounce flex items-center gap-1 shadow-md">
              <Flame className="w-3.5 h-3.5" />
              {criticalCount} إنذار حرج (+25د)
            </span>
          )}

          {warningCount > 0 && (
            <span className="py-1 px-2.5 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 font-bold text-xs flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              {warningCount} تحذير (15-25د)
            </span>
          )}

          {totalEstimatedLostTonnes > 0 && (
            <span className="py-1 px-2.5 rounded-xl bg-purple-950/80 border border-purple-500/40 text-purple-300 font-bold text-xs flex items-center gap-1">
              <TrendingDown className="w-3.5 h-3.5" />
              ~{totalEstimatedLostTonnes.toLocaleString()} طن فاقد تقديري
            </span>
          )}

          {visibleGaps.length === 0 && (
            <span className="py-1 px-3 rounded-xl bg-emerald-950 border border-emerald-500/40 text-emerald-400 font-bold text-xs flex items-center gap-1">
              <CheckCircle2 className="w-4 h-4" />
              لا توجد فجوات تشغيلية حالياً (كافة الوحدات منتظمة)
            </span>
          )}

          <button
            type="button"
            className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="p-4 md:p-5 border-t border-slate-800 space-y-3 bg-slate-950/60">
          {visibleGaps.length === 0 ? (
            <div className="text-center py-6 text-slate-400">
              <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-2 opacity-80" />
              <p className="text-sm font-bold text-slate-200">
                تدفق الإنتاج يسير بمعدله الطبيعي دون أي فجوة تتجاوز 15 دقيقة
              </p>
              <p className="text-xs text-slate-500 mt-1">
                يتم فحص دورة كل شاحنة، طوابير الحفارات، ومحطة الوقود تلقائياً كل ثانية.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {visibleGaps.map(gap => {
                const isCritical = gap.severity === 'CRITICAL';

                return (
                  <div
                    key={gap.id}
                    className={`relative rounded-2xl p-4 border-2 transition-all shadow-md ${
                      isCritical
                        ? 'bg-rose-950/40 border-rose-500/80 shadow-rose-950/30'
                        : 'bg-amber-950/30 border-amber-500/70 shadow-amber-950/20'
                    }`}
                  >
                    {/* Top Row: Unit ID & Severity Badge */}
                    <div className="flex items-center justify-between mb-2.5">
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center font-mono font-bold text-xs ${
                            gap.unitType === 'TRUCK'
                              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                              : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                          }`}
                        >
                          {gap.unitType === 'TRUCK' ? <TruckIcon className="w-4 h-4" /> : <HardHat className="w-4 h-4" />}
                        </div>
                        <div>
                          <span className="font-mono font-black text-sm text-slate-100">
                            {gap.unitId}
                          </span>
                          <span className="text-[10px] text-slate-400 block leading-none mt-0.5">
                            {gap.unitType === 'TRUCK' ? 'دنبر نقل 152t' : 'معدة تحميل/حفار'}
                          </span>
                        </div>
                      </div>

                      <span
                        className={`py-1 px-2 rounded-lg text-[11px] font-black font-mono flex items-center gap-1 ${
                          isCritical
                            ? 'bg-rose-600 text-white animate-pulse'
                            : 'bg-amber-500 text-slate-950'
                        }`}
                      >
                        <Clock className="w-3 h-3" />
                        تأخير {gap.durationMinutes} دقيقة
                      </span>
                    </div>

                    {/* Gap Description */}
                    <p className="text-xs font-bold text-slate-200 mb-2 leading-relaxed">
                      {gap.descriptionAr}
                    </p>

                    {/* Impact & Loss Box */}
                    <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 mb-3 space-y-1 text-[11px]">
                      <div className="flex justify-between items-center text-slate-400">
                        <span>الفاقد التقديري في الإنتاج:</span>
                        <strong className="font-mono text-purple-400 font-bold">~{gap.estimatedTonsLost} طن</strong>
                      </div>
                      <div className="flex justify-between items-center text-slate-400">
                        <span>وقت بدء رصد الانحراف:</span>
                        <strong className="font-mono text-slate-300">{gap.detectedAt}</strong>
                      </div>
                      <div className="text-[10px] text-amber-300/90 pt-1 border-t border-slate-800/80">
                        💡 <strong className="text-slate-300">الإجراء المقترح:</strong> {gap.correctiveAction}
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2 pt-1 border-t border-slate-800/60">
                      {gap.unitType === 'TRUCK' && onSelectTruckForMessage && (
                        <button
                          type="button"
                          onClick={() => {
                            playClickSound();
                            onSelectTruckForMessage(gap.unitId);
                          }}
                          className="flex-1 py-1.5 px-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs flex items-center justify-center gap-1 cursor-pointer transition-colors"
                        >
                          <Radio className="w-3.5 h-3.5" />
                          <span>توجيه رسالة خاصة للسائق 🔒</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => handleDismiss(gap.id)}
                        className="flex-1 py-1.5 px-2 rounded-xl bg-slate-800 hover:bg-emerald-950 hover:text-emerald-300 hover:border-emerald-500/40 border border-slate-700 text-slate-200 font-bold text-xs flex items-center justify-center gap-1 transition-colors cursor-pointer"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span>معالجة وتأكيد الحل</span>
                      </button>
                    </div>

                    {/* Dismiss Button */}
                    <button
                      type="button"
                      onClick={() => handleDismiss(gap.id)}
                      className="absolute top-2 left-2 text-[10px] text-slate-500 hover:text-slate-300 p-1"
                      title="معالجة وتجاهل هذا البلاغ مؤقتاً"
                    >
                      ✕
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
