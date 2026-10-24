import React, { useState, useEffect } from 'react';
import {
  Fuel,
  Clock,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Radio,
  History,
  TrendingDown,
  Send,
  Zap,
} from 'lucide-react';
import { FuelingLog } from '../types/dispatch';
import {
  getFuelingLogs,
  getActiveFuelingTrucks,
  advanceTruckFuelingStartLoading,
  subscribeToDataChanges,
} from '../utils/storage';
import { playClickSound } from '../utils/audio';

interface Props {
  onSelectTruckForMessage?: (truckId: string) => void;
}

export const FuelingMonitoringPanel: React.FC<Props> = ({ onSelectTruckForMessage }) => {
  const [fuelingLogs, setFuelingLogs] = useState<FuelingLog[]>(getFuelingLogs());
  const [activeFuelings, setActiveFuelings] = useState<FuelingLog[]>(getActiveFuelingTrucks());
  const [isExpanded, setIsExpanded] = useState(true);
  const [viewHistoryTab, setViewHistoryTab] = useState(false);
  const [currentTime, setCurrentTime] = useState(Date.now());

  // Real-time second ticker to ensure live stopwatches update smoothly
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Subscribe to storage changes
  useEffect(() => {
    const refresh = () => {
      const logs = getFuelingLogs();
      setFuelingLogs(logs);
      setActiveFuelings(logs.filter(f => f.status !== 'COMPLETED'));
    };
    refresh();
    const unsub = subscribeToDataChanges(event => {
      if (event.type === 'FUELING_LOGS_UPDATED') {
        refresh();
      }
    });
    return () => unsub();
  }, []);

  const completedFuelings = fuelingLogs.filter(f => f.status === 'COMPLETED');
  const avgDuration =
    completedFuelings.length > 0
      ? Math.round(
          (completedFuelings.reduce((sum, f) => sum + (f.durationMinutes || 12), 0) /
            completedFuelings.length) *
            10
        ) / 10
      : 12;

  // Delayed trucks (> 15 mins)
  const delayedTrucksCount = activeFuelings.filter(f => {
    const startMs = new Date(f.startTime).getTime();
    return Math.floor((currentTime - startMs) / 60000) >= 15;
  }).length;

  const handleForceEndFueling = (fuel: FuelingLog) => {
    playClickSound();
    advanceTruckFuelingStartLoading(fuel.truckId);
  };

  const formatElapsed = (startIso: string) => {
    const startMs = new Date(startIso).getTime();
    const totalSecs = Math.max(0, Math.floor((currentTime - startMs) / 1000));
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins} دقيقة و ${secs} ثانية`;
  };

  const getElapsedMinutes = (startIso: string) => {
    const startMs = new Date(startIso).getTime();
    return Math.floor((currentTime - startMs) / 60000);
  };

  return (
    <div className="mb-5 rounded-2xl border-2 border-sky-500/40 bg-slate-900 shadow-xl overflow-hidden">
      {/* Header Bar */}
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className="p-4 bg-gradient-to-r from-sky-950/70 via-slate-900 to-slate-900 flex flex-wrap items-center justify-between gap-3 cursor-pointer select-none"
      >
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-sky-500/20 border-2 border-sky-400 flex items-center justify-center text-sky-400 font-bold shrink-0">
            <Fuel className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-black text-base md:text-lg text-slate-100">
                لوحة مراقبة تفويل الشاحنات (Fueling Monitoring Bay)
              </h3>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-sky-950 text-sky-300 border border-sky-500/30">
                محطة الوقود
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              متابعة آنية للشاحنات في محطة الوقود لضمان عدم توقف العمل وسرعة العودة لدورة التحميل
            </p>
          </div>
        </div>

        {/* Counter Badges & Toggles */}
        <div className="flex items-center gap-2.5 mr-auto md:mr-0">
          <span
            className={`py-1 px-3 rounded-xl font-black text-xs flex items-center gap-1.5 ${
              activeFuelings.length > 0
                ? 'bg-sky-500 text-slate-950 shadow-md animate-pulse'
                : 'bg-slate-800 text-slate-400'
            }`}
          >
            <Fuel className="w-3.5 h-3.5" />
            {activeFuelings.length} شاحنة قيد التفويل حالياً
          </span>

          {delayedTrucksCount > 0 && (
            <span className="py-1 px-2.5 rounded-xl bg-rose-500 text-white font-black text-xs animate-bounce flex items-center gap-1 shadow-md">
              <AlertTriangle className="w-3.5 h-3.5" />
              {delayedTrucksCount} متأخرة (+15د)
            </span>
          )}

          <span className="py-1 px-2.5 rounded-xl bg-slate-800/80 border border-slate-700 text-slate-300 font-bold text-xs flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-sky-400" />
            متوسط التفويل: {avgDuration} د
          </span>

          <button
            type="button"
            className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Expanded Body */}
      {isExpanded && (
        <div className="p-4 md:p-5 border-t border-slate-800 bg-slate-950/60">
          {/* Tabs: Active vs History */}
          <div className="flex items-center justify-between gap-3 mb-4 border-b border-slate-800 pb-2.5">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setViewHistoryTab(false)}
                className={`py-1.5 px-3 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                  !viewHistoryTab
                    ? 'bg-sky-600 text-white shadow-sm'
                    : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                الشاحنات في المحطة الآن ({activeFuelings.length})
              </button>
              <button
                type="button"
                onClick={() => setViewHistoryTab(true)}
                className={`py-1.5 px-3 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1 ${
                  viewHistoryTab
                    ? 'bg-sky-600 text-white shadow-sm'
                    : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <History className="w-3.5 h-3.5" />
                سجل التفويل للوردية ({completedFuelings.length})
              </button>
            </div>

            <div className="text-xs text-slate-400">
              المعيار المعتمد لتفويل الشاحنة 152t: <strong className="text-amber-400">8 - 15 دقيقة كحد أقصى</strong>
            </div>
          </div>

          {/* ACTIVE FUELING TRUCKS VIEW */}
          {!viewHistoryTab && (
            <div>
              {activeFuelings.length === 0 ? (
                <div className="text-center py-6 text-slate-400">
                  <CheckCircle2 className="w-9 h-9 text-emerald-400 mx-auto mb-2 opacity-80" />
                  <p className="text-sm font-bold text-slate-200">
                    لا توجد شاحنات متوقفة بمحطة الوقود حالياً
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    كافة الشاحنات العاملة مستمرة في دورة التحميل والتفريغ.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {activeFuelings.map(fuel => {
                    const elapsedMins = getElapsedMinutes(fuel.startTime);
                    const isOverdue = elapsedMins >= 15;
                    const isCritical = elapsedMins >= 25;

                    return (
                      <div
                        key={fuel.id}
                        className={`rounded-2xl p-4 border-2 transition-all shadow-md ${
                          isCritical
                            ? 'bg-rose-950/50 border-rose-500 shadow-rose-950/30'
                            : isOverdue
                            ? 'bg-amber-950/40 border-amber-500/80 shadow-amber-950/20'
                            : 'bg-sky-950/30 border-sky-500/60'
                        }`}
                      >
                        {/* Truck Header */}
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-black text-base text-amber-400">
                              {fuel.truckId}
                            </span>
                            <span className="text-[10px] py-0.5 px-2 rounded-full bg-slate-800 text-slate-300 font-bold border border-slate-700">
                              152 طن
                            </span>
                          </div>

                          <span
                            className={`py-0.5 px-2 rounded-lg text-xs font-mono font-bold flex items-center gap-1 ${
                              isCritical
                                ? 'bg-rose-600 text-white animate-pulse'
                                : isOverdue
                                ? 'bg-amber-500 text-slate-950 font-black'
                                : 'bg-sky-500 text-slate-950 font-black'
                            }`}
                          >
                            <Clock className="w-3 h-3" />
                            {elapsedMins} دقيقة
                          </span>
                        </div>

                        {/* Driver & Details */}
                        <div className="text-xs text-slate-200 font-bold mb-1.5">
                          السائق: {fuel.driverName}{' '}
                          <span className="text-slate-400 font-mono text-[11px]">
                            ({fuel.driverCode})
                          </span>
                        </div>

                        {/* Stage Badge */}
                        <div className="mb-2">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold ${
                            fuel.status === 'EN_ROUTE'
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                              : fuel.status === 'AT_STATION'
                              ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                              : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                          }`}>
                            <Fuel className="w-3 h-3" />
                            <span>
                              {fuel.status === 'EN_ROUTE' && '1. رايح أفول ⛽ (في الطريق للبنزينة)'}
                              {fuel.status === 'AT_STATION' && '2. وصلت البنزينة ⛽ (جاري التفويل)'}
                              {fuel.status === 'RETURNING' && '3. طلعت من البنزينة 🚚 (عائد للحفرة)'}
                              {!fuel.status && 'جاري التفويل'}
                            </span>
                          </span>
                        </div>

                        <div className="p-2 rounded-xl bg-slate-950/80 border border-slate-800 text-[11px] space-y-1 mb-3">
                          <div className="flex justify-between text-slate-400">
                            <span>وقت بدء التفويل:</span>
                            <strong className="font-mono text-slate-200">
                              {new Date(fuel.startTime).toLocaleTimeString('ar-EG', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </strong>
                          </div>
                          <div className="flex justify-between text-slate-400">
                            <span>العداد الحي (Stopwatch):</span>
                            <strong className="font-mono text-sky-400 font-bold">
                              {formatElapsed(fuel.startTime)}
                            </strong>
                          </div>
                          {isOverdue && (
                            <div className="text-[10px] text-rose-300 font-bold pt-1 border-t border-slate-800">
                              ⚠️ تنبيه: تجاوزت الشاحنة زمن التفويل المعياري (15 دقيقة)
                            </div>
                          )}
                        </div>

                        {/* Action Buttons */}
                        <div className="grid grid-cols-2 gap-2">
                          {onSelectTruckForMessage && (
                            <button
                              type="button"
                              onClick={() => {
                                playClickSound();
                                onSelectTruckForMessage(fuel.truckId);
                              }}
                              className="py-1.5 px-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs flex items-center justify-center gap-1 cursor-pointer transition-colors"
                            >
                              <Radio className="w-3.5 h-3.5" />
                              <span>توجيه للسائق</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => handleForceEndFueling(fuel)}
                            className="py-1.5 px-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1 cursor-pointer transition-colors"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>إنهاء التفويل ✅</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* COMPLETED FUELINGS HISTORY VIEW */}
          {viewHistoryTab && (
            <div className="border border-slate-800 rounded-xl overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 font-bold">
                  <tr>
                    <th className="py-2.5 px-3">رقم الشاحنة</th>
                    <th className="py-2.5 px-3">السائق</th>
                    <th className="py-2.5 px-3 text-center">وقت البدء</th>
                    <th className="py-2.5 px-3 text-center">وقت الانتهاء</th>
                    <th className="py-2.5 px-3 text-center">المدة المستغرقة</th>
                    <th className="py-2.5 px-3">ملاحظات الوقود</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-medium">
                  {completedFuelings.slice(0, 15).map(log => (
                    <tr key={log.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-2 px-3 font-mono text-amber-400 font-bold">{log.truckId}</td>
                      <td className="py-2 px-3 text-slate-200">
                        {log.driverName}{' '}
                        <span className="text-[10px] text-slate-400 font-mono">({log.driverCode})</span>
                      </td>
                      <td className="py-2 px-3 text-center font-mono text-slate-300">
                        {new Date(log.startTime).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="py-2 px-3 text-center font-mono text-slate-300">
                        {log.endTime
                          ? new Date(log.endTime).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })
                          : '-'}
                      </td>
                      <td className="py-2 px-3 text-center">
                        <span
                          className={`font-mono font-bold py-0.5 px-2 rounded ${
                            (log.durationMinutes || 0) > 15
                              ? 'bg-rose-950 text-rose-300 border border-rose-500/40'
                              : 'bg-emerald-950 text-emerald-300 border border-emerald-500/40'
                          }`}
                        >
                          {log.durationMinutes || 12} دقيقة
                        </span>
                      </td>
                      <td className="py-2 px-3 text-slate-400">{log.notes || 'تفويل ديزل دوري'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
