import React, { useState } from 'react';
import {
  Target,
  Check,
  X,
  AlertTriangle,
  Send,
  TrendingDown,
  TrendingUp,
  HardHat,
  Sparkles,
  CheckCircle2,
} from 'lucide-react';
import { Excavator, TripLog, ExcavatorTarget } from '../types/dispatch';
import { getExcavatorTargets, saveExcavatorTarget } from '../utils/storage';
import { playClickSound } from '../utils/audio';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  excavators: Excavator[];
  trips: TripLog[];
}

export const ExcavatorTargetsModal: React.FC<Props> = ({
  isOpen,
  onClose,
  excavators,
  trips,
}) => {
  const [targets, setTargets] = useState<Record<string, ExcavatorTarget>>(getExcavatorTargets());
  const [savedSuccess, setSavedSuccess] = useState(false);

  if (!isOpen) return null;

  // Compute past hour tonnage for each excavator
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const hourTrips = trips.filter(t => new Date(t.dumpTime) >= oneHourAgo);

  const handleUpdateTarget = (excavatorId: string, tonnes: number) => {
    const safeTonnes = Math.max(50, tonnes);
    const tripsCount = Math.max(1, Math.round(safeTonnes / 152));
    const newTarget: ExcavatorTarget = {
      excavatorId,
      targetTonnesPerHour: safeTonnes,
      targetTripsPerHour: tripsCount,
    };
    saveExcavatorTarget(newTarget);
    setTargets(prev => ({ ...prev, [excavatorId]: newTarget }));
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-slate-900 border-2 border-amber-500/40 rounded-3xl p-5 md:p-7 shadow-2xl overflow-y-auto text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
              <Target className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-100">
                تحديد ومتابعة الأهداف الإنتاجية لمعدات التحميل (Excavator Targets)
              </h3>
              <p className="text-xs text-slate-400">
                تحديد المستهدف الساعي (طن/ساعة) لكل حفار وتفعيل تنبيهات انخفاض الأداء الآلية
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {savedSuccess && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4" />
            <span>تم حفظ الأهداف الإنتاجية المحدثة بنجاح وتطبيقها على حسابات الأداء!</span>
          </div>
        )}

        {/* Loaders Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 mb-6">
          {excavators.map(ex => {
            const target = targets[ex.id]?.targetTonnesPerHour || 450;
            const loaderHourTrips = hourTrips.filter(t => t.excavatorId === ex.id);
            const currentHourTonnes = loaderHourTrips.reduce((sum, t) => sum + (t.payloadTonnes || 152), 0);
            const currentHourTrips = loaderHourTrips.length;

            const percentage = Math.round((currentHourTonnes / target) * 100);
            const isBelowTarget = percentage < 70;
            const gapPercent = Math.max(0, 100 - percentage);

            return (
              <div
                key={ex.id}
                className={`p-4 rounded-2xl border-2 transition-all ${
                  isBelowTarget
                    ? 'bg-rose-950/30 border-rose-500/70 shadow-rose-950/20'
                    : 'bg-slate-950/80 border-slate-800'
                }`}
              >
                {/* Top Row: Unit info & status */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-black text-base text-amber-400">
                      {ex.id}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {ex.model.split(' ')[0]} {ex.model.split(' ')[1]}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {ex.benchLevel.split('(')[0]}
                  </span>
                </div>

                {/* Performance Progress Bar */}
                <div className="mb-3">
                  <div className="flex justify-between items-center text-xs mb-1">
                    <span className="text-slate-400">
                      الإنتاج الساعي الفعلي: <strong className="font-mono text-white">{currentHourTonnes.toLocaleString()} طن</strong> ({currentHourTrips} نقلة)
                    </span>
                    <span className={`font-mono font-bold ${isBelowTarget ? 'text-rose-400' : 'text-emerald-400'}`}>
                      {percentage}% من الهدف
                    </span>
                  </div>

                  <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        isBelowTarget ? 'bg-rose-500' : 'bg-emerald-500'
                      }`}
                      style={{ width: `${Math.min(100, percentage)}%` }}
                    />
                  </div>
                </div>

                {/* Target Inputs & Actions */}
                <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-800/80 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400 text-[11px]">المستهدف الساعي:</span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleUpdateTarget(ex.id, target - 50)}
                        className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold flex items-center justify-center cursor-pointer"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        step="50"
                        value={target}
                        onChange={(e) => handleUpdateTarget(ex.id, parseInt(e.target.value) || 300)}
                        className="w-20 py-1 px-1.5 rounded-lg bg-slate-900 border border-slate-700 text-center font-mono font-bold text-amber-400 text-xs focus:outline-none focus:border-amber-500"
                      />
                      <button
                        type="button"
                        onClick={() => handleUpdateTarget(ex.id, target + 50)}
                        className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold flex items-center justify-center cursor-pointer"
                      >
                        +
                      </button>
                      <span className="text-[10px] text-slate-400">طن/س</span>
                    </div>
                  </div>

                  {isBelowTarget && (
                    <span className="py-1 px-2.5 rounded-xl font-bold text-[11px] bg-rose-950 text-rose-300 border border-rose-500/40 flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                      <span>عجز بالإنتاجية ({gapPercent}%)</span>
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-3 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="py-2.5 px-6 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm cursor-pointer shadow-lg"
          >
            إغلاق وحفظ
          </button>
        </div>
      </div>
    </div>
  );
};
