import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Clock,
  CheckCircle2,
  AlertTriangle,
  UserCheck,
  Truck as TruckIcon,
  HardHat,
  X,
  Plus,
  ArrowRight,
  ShieldCheck,
  Fuel,
  Gauge,
  FileSpreadsheet,
  Download,
  Search,
} from 'lucide-react';
import { Driver, Truck, Excavator } from '../types/dispatch';
import {
  ShiftHandoverRecord,
  getLocalShiftRecords,
  logStartShift,
  logCompleteShiftHandover,
  subscribeToShiftLogs,
} from '../utils/firebaseSync';
import { playClickSound, playLoadConfirmedSound } from '../utils/audio';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  trucks: Truck[];
  excavators: Excavator[];
  drivers: Driver[];
}

export const ShiftManagementModal: React.FC<Props> = ({
  isOpen,
  onClose,
  trucks,
  excavators,
  drivers,
}) => {
  const [activeTab, setActiveTab] = useState<'HISTORY' | 'NEW_SHIFT' | 'HANDOVER'>('HISTORY');
  const [shiftRecords, setShiftRecords] = useState<ShiftHandoverRecord[]>(getLocalShiftRecords());
  const [searchFilter, setSearchFilter] = useState('');
  const [equipmentTypeFilter, setEquipmentTypeFilter] = useState<'ALL' | 'TRUCK' | 'EXCAVATOR'>('ALL');

  // Form: Start New Shift
  const [selectedEqId, setSelectedEqId] = useState<string>('DT001');
  const [selectedEqType, setSelectedEqType] = useState<'TRUCK' | 'EXCAVATOR'>('TRUCK');
  const [operatorCode, setOperatorCode] = useState<string>('');
  const [shiftType, setShiftType] = useState<'DAY' | 'NIGHT'>('DAY');
  const [startEngineHours, setStartEngineHours] = useState<string>('12450');
  const [startFuel, setStartFuel] = useState<string>('85');
  const [safetyChecked, setSafetyChecked] = useState<boolean>(true);
  const [startNotes, setStartNotes] = useState<string>('');

  // Form: Handover Shift
  const [handoverShiftId, setHandoverShiftId] = useState<string>('');
  const [nextOperatorCode, setNextOperatorCode] = useState<string>('');
  const [endEngineHours, setEndEngineHours] = useState<string>('12462');
  const [endFuel, setEndFuel] = useState<string>('40');
  const [tripsCompleted, setTripsCompleted] = useState<string>('14');
  const [tonnesCompleted, setTonnesCompleted] = useState<string>('2128');
  const [handoverNotes, setHandoverNotes] = useState<string>('');

  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  };

  useEffect(() => {
    if (!isOpen) return;
    const unsub = subscribeToShiftLogs((records) => {
      setShiftRecords(records);
    });
    return () => unsub();
  }, [isOpen]);

  if (!isOpen) return null;

  const handleStartShiftSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    playClickSound();

    const drv = drivers.find((d) => d.code === operatorCode);
    if (!drv) {
      showToast('يرجى اختيار سائق أو مشغل مسجل بالنظام');
      return;
    }

    await logStartShift({
      equipmentId: selectedEqId,
      equipmentType: selectedEqType,
      driverCode: drv.code,
      driverName: drv.name,
      shiftType,
      startTime: new Date().toISOString(),
      engineHoursStart: Number(startEngineHours) || undefined,
      fuelLevelPercent: Number(startFuel) || undefined,
      safetyInspectionPassed: safetyChecked,
      notes: startNotes.trim() || undefined,
    });

    playLoadConfirmedSound();
    showToast(`تم بدء وتسجيل وردية ${drv.name} على المعدة ${selectedEqId} بنجاح ومزامنتها سحابياً ✅`);
    setActiveTab('HISTORY');
    setOperatorCode('');
    setStartNotes('');
  };

  const handleCompleteHandoverSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!handoverShiftId) {
      showToast('يرجى تحديد الوردية المراد تسليمها');
      return;
    }
    playClickSound();

    const nextDrv = drivers.find((d) => d.code === nextOperatorCode);

    await logCompleteShiftHandover(handoverShiftId, {
      handoverToCode: nextDrv?.code,
      handoverToName: nextDrv?.name,
      engineHoursEnd: Number(endEngineHours) || undefined,
      fuelLevelPercent: Number(endFuel) || undefined,
      tripsCount: Number(tripsCompleted) || 0,
      tonnesCount: Number(tonnesCompleted) || 0,
      notes: handoverNotes.trim() || undefined,
    });

    playLoadConfirmedSound();
    showToast('تم حفظ عملية تسليم وتسلم الوردية بنجاح وتسجيل السجل الزمني 📋');
    setActiveTab('HISTORY');
    setHandoverShiftId('');
    setNextOperatorCode('');
    setHandoverNotes('');
  };

  const filteredRecords = shiftRecords.filter((r) => {
    const matchesSearch =
      r.equipmentId.toLowerCase().includes(searchFilter.toLowerCase()) ||
      r.driverName.toLowerCase().includes(searchFilter.toLowerCase()) ||
      r.driverCode.includes(searchFilter);
    const matchesType =
      equipmentTypeFilter === 'ALL' || r.equipmentType === equipmentTypeFilter;
    return matchesSearch && matchesType;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-5xl bg-slate-900 border-2 border-emerald-500/40 rounded-3xl p-5 md:p-6 shadow-2xl text-slate-100 max-h-[94vh] flex flex-col">
        {/* Close Button */}
        <button
          onClick={onClose}
          type="button"
          className="absolute top-4 left-4 p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4 pl-10">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
              <Calendar className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg md:text-xl font-black text-slate-100">
                  إدارة ورديات المشغلين والتسليم والتسلم (Shift Management)
                </h2>
                <span className="text-[10px] py-0.5 px-2 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold">
                  سجل زمني حي
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                توثيق بداية ونهاية ورديات كل معدة، ساعات المحرك، مستوى السولار، وفحص السلامة
              </p>
            </div>
          </div>
        </div>

        {/* Toast */}
        {toastMsg && (
          <div className="mb-3 p-3 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center gap-2 animate-in fade-in duration-150">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{toastMsg}</span>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-slate-800 pb-3 mb-4 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('HISTORY')}
            className={`py-2 px-4 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'HISTORY'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>السجل الزمني للتسليم والتسلم ({shiftRecords.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('NEW_SHIFT')}
            className={`py-2 px-4 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'NEW_SHIFT'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <Plus className="w-4 h-4" />
            <span>تسجيل بدء وردية جديدة (Check-In)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('HANDOVER')}
            className={`py-2 px-4 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'HANDOVER'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <ArrowRight className="w-4 h-4" />
            <span>تسليم الوردية للمشغل التالي (Handover)</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto">
          {/* TAB 1: HISTORY TIMELINE */}
          {activeTab === 'HISTORY' && (
            <div className="space-y-4">
              {/* Filter Strip */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-2xl bg-slate-950 border border-slate-800">
                <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                  <Search className="w-4 h-4 text-slate-500" />
                  <input
                    type="text"
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    placeholder="بحث برقم المعدة (DT001...) أو اسم السائق أو الكود..."
                    className="w-full bg-transparent text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400 font-bold">نوع المعدة:</span>
                  <select
                    value={equipmentTypeFilter}
                    onChange={(e) => setEquipmentTypeFilter(e.target.value as any)}
                    className="py-1.5 px-3 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-200 font-bold focus:outline-none"
                  >
                    <option value="ALL">الكل</option>
                    <option value="TRUCK">شاحنات ودنابر (DT)</option>
                    <option value="EXCAVATOR">حفارات وشوافل (EX / SH / WL)</option>
                  </select>
                </div>
              </div>

              {/* Records Table */}
              <div className="border border-slate-800 rounded-2xl overflow-hidden bg-slate-950">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-900 text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="py-2.5 px-3">المعدة</th>
                      <th className="py-2.5 px-3">المشغل المستلم</th>
                      <th className="py-2.5 px-3">الوردية</th>
                      <th className="py-2.5 px-3">ساعة البدء</th>
                      <th className="py-2.5 px-3">ساعة التسليم</th>
                      <th className="py-2.5 px-3">المشغل المسلّم له</th>
                      <th className="py-2.5 px-3 text-center">النقلات / الأطنان</th>
                      <th className="py-2.5 px-3 text-center">الحالة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-medium">
                    {filteredRecords.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-slate-500">
                          لا توجد سجلات تسليم ورديات مطابقة حتى الآن. يمكنك تسجيل بدء وردية جديدة بالضغط على التبويب بالأعلى.
                        </td>
                      </tr>
                    ) : (
                      filteredRecords.map((rec) => (
                        <tr key={rec.id} className="hover:bg-slate-900/40 transition-colors">
                          <td className="py-2.5 px-3 font-mono font-bold text-amber-400">
                            {rec.equipmentId}
                          </td>
                          <td className="py-2.5 px-3 font-bold text-slate-200">
                            {rec.driverName} <span className="text-[10px] font-mono text-slate-400 font-normal">({rec.driverCode})</span>
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="py-0.5 px-2 rounded-full bg-slate-800 text-slate-300 text-[10px] font-bold">
                              {rec.shiftType === 'DAY' ? 'صباحية ☀️' : 'مسائية 🌙'}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-slate-400 font-mono text-[11px]">
                            {new Date(rec.startTime).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="py-2.5 px-3 text-slate-400 font-mono text-[11px]">
                            {rec.endTime ? new Date(rec.endTime).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) : '-'}
                          </td>
                          <td className="py-2.5 px-3 text-slate-300">
                            {rec.handoverToName ? (
                              <span className="text-emerald-400 font-bold">{rec.handoverToName}</span>
                            ) : (
                              <span className="text-slate-500">في الخدمة حالياً</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono">
                            <span className="text-sky-400 font-bold">{rec.tripsCount || 0}</span> نقلة
                            {rec.tonnesCount ? ` (~${rec.tonnesCount}t)` : ''}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            {rec.status === 'ACTIVE' ? (
                              <span className="py-0.5 px-2 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-500/40 text-[10px] font-bold">
                                نشط حالياً 🟢
                              </span>
                            ) : (
                              <span className="py-0.5 px-2 rounded-full bg-slate-800 text-slate-300 border border-slate-700 text-[10px] font-bold">
                                تم التسليم ✓
                              </span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 2: START NEW SHIFT FORM */}
          {activeTab === 'NEW_SHIFT' && (
            <form onSubmit={handleStartShiftSubmit} className="p-5 bg-slate-950/60 border border-slate-800 rounded-3xl space-y-4 max-w-2xl mx-auto">
              <h3 className="font-bold text-sm text-emerald-400 flex items-center gap-2">
                <Plus className="w-4 h-4" /> تسجيل بدء وردية جديدة لمعدة
              </h3>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-300 font-bold block mb-1">نوع المعدة:</label>
                  <select
                    value={selectedEqType}
                    onChange={(e) => {
                      const t = e.target.value as 'TRUCK' | 'EXCAVATOR';
                      setSelectedEqType(t);
                      setSelectedEqId(t === 'TRUCK' ? 'DT001' : 'EX08');
                    }}
                    className="w-full py-2 px-3 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-100 font-bold focus:border-emerald-500 focus:outline-none"
                  >
                    <option value="TRUCK">شاحنة نقل / دنبر (Truck)</option>
                    <option value="EXCAVATOR">معدة تحميل / شاول / حفار</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs text-slate-300 font-bold block mb-1">رقم المعدة:</label>
                  <select
                    value={selectedEqId}
                    onChange={(e) => setSelectedEqId(e.target.value)}
                    className="w-full py-2 px-3 rounded-xl bg-slate-900 border border-slate-700 text-xs font-mono font-bold text-amber-400 focus:border-emerald-500 focus:outline-none"
                  >
                    {selectedEqType === 'TRUCK'
                      ? trucks.map((t) => (
                          <option key={t.id} value={t.id}>
                            دنبر {t.id}
                          </option>
                        ))
                      : excavators.map((e) => (
                          <option key={e.id} value={e.id}>
                            {e.id} - {e.model}
                          </option>
                        ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-300 font-bold block mb-1">السائق أو المشغل المستلم للوردية:</label>
                <select
                  value={operatorCode}
                  onChange={(e) => setOperatorCode(e.target.value)}
                  className="w-full py-2 px-3 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-100 font-bold focus:border-emerald-500 focus:outline-none"
                  required
                >
                  <option value="">اختر السائق من القائمة المعتمدة...</option>
                  {drivers.map((d) => (
                    <option key={d.code} value={d.code}>
                      {d.name} (كود: {d.code}) — {d.role}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-slate-300 font-bold block mb-1">فترة الوردية:</label>
                  <select
                    value={shiftType}
                    onChange={(e) => setShiftType(e.target.value as any)}
                    className="w-full py-2 px-3 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-100 focus:border-emerald-500 focus:outline-none"
                  >
                    <option value="DAY">وردية صباحية ☀️</option>
                    <option value="NIGHT">وردية مسائية 🌙</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs text-slate-300 font-bold block mb-1">ساعات المحرك (Start Hours):</label>
                  <input
                    type="number"
                    value={startEngineHours}
                    onChange={(e) => setStartEngineHours(e.target.value)}
                    className="w-full py-2 px-3 rounded-xl bg-slate-900 border border-slate-700 text-xs font-mono text-center text-slate-100 focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-300 font-bold block mb-1">مستوى الوقود (%):</label>
                  <input
                    type="number"
                    value={startFuel}
                    onChange={(e) => setStartFuel(e.target.value)}
                    className="w-full py-2 px-3 rounded-xl bg-slate-900 border border-slate-700 text-xs font-mono text-center text-slate-100 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex items-center gap-3">
                <input
                  type="checkbox"
                  id="safetyCheck"
                  checked={safetyChecked}
                  onChange={(e) => setSafetyChecked(e.target.checked)}
                  className="w-4 h-4 text-emerald-600 rounded focus:ring-0 cursor-pointer"
                />
                <label htmlFor="safetyCheck" className="text-xs text-slate-200 font-bold cursor-pointer">
                  تم إجراء فحص السلامة الميداني (Walkaround Inspection) والإطارات والفرامل بنجاح
                </label>
              </div>

              <div>
                <label className="text-xs text-slate-300 font-bold block mb-1">ملاحظات الفحص والاستلام (اختياري):</label>
                <input
                  type="text"
                  value={startNotes}
                  onChange={(e) => setStartNotes(e.target.value)}
                  placeholder="مثال: ضغط الإطارات سليم، المروحة تعمل بشكل طبيعي"
                  className="w-full py-2 px-3 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-100 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  className="py-2.5 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs flex items-center gap-2 cursor-pointer shadow-lg shadow-emerald-950 transition-transform active:scale-98"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>تأكيد تسجيل وبدء الوردية</span>
                </button>
              </div>
            </form>
          )}

          {/* TAB 3: COMPLETE / HANDOVER SHIFT FORM */}
          {activeTab === 'HANDOVER' && (
            <form onSubmit={handleCompleteHandoverSubmit} className="p-5 bg-slate-950/60 border border-slate-800 rounded-3xl space-y-4 max-w-2xl mx-auto">
              <h3 className="font-bold text-sm text-sky-400 flex items-center gap-2">
                <ArrowRight className="w-4 h-4" /> تسليم الوردية وتسجيل المشغل التالي
              </h3>

              <div>
                <label className="text-xs text-slate-300 font-bold block mb-1">حدد الوردية النشطة لتسليمها:</label>
                <select
                  value={handoverShiftId}
                  onChange={(e) => setHandoverShiftId(e.target.value)}
                  className="w-full py-2 px-3 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-100 font-bold focus:border-sky-500 focus:outline-none"
                  required
                >
                  <option value="">اختر الوردية المراد إنهاؤها أو تسليمها...</option>
                  {shiftRecords
                    .filter((r) => r.status === 'ACTIVE')
                    .map((r) => (
                      <option key={r.id} value={r.id}>
                        معدة {r.equipmentId} — المشغل: {r.driverName} (بدأت: {new Date(r.startTime).toLocaleTimeString('ar-EG')})
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="text-xs text-slate-300 font-bold block mb-1">المشغل التالي المستلم للمعدة (اختياري):</label>
                <select
                  value={nextOperatorCode}
                  onChange={(e) => setNextOperatorCode(e.target.value)}
                  className="w-full py-2 px-3 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-100 font-bold focus:border-sky-500 focus:outline-none"
                >
                  <option value="">اتركه فارغاً إذا كانت المعدة ستتوقف بنهاية الوردية</option>
                  {drivers.map((d) => (
                    <option key={d.code} value={d.code}>
                      {d.name} (كود: {d.code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-300 font-bold block mb-1">ساعات المحرك عند التسليم (End Hours):</label>
                  <input
                    type="number"
                    value={endEngineHours}
                    onChange={(e) => setEndEngineHours(e.target.value)}
                    className="w-full py-2 px-3 rounded-xl bg-slate-900 border border-slate-700 text-xs font-mono text-center text-slate-100 focus:border-sky-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-300 font-bold block mb-1">مستوى الوقود النهائي (%):</label>
                  <input
                    type="number"
                    value={endFuel}
                    onChange={(e) => setEndFuel(e.target.value)}
                    className="w-full py-2 px-3 rounded-xl bg-slate-900 border border-slate-700 text-xs font-mono text-center text-slate-100 focus:border-sky-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-300 font-bold block mb-1">عدد النقلات المنجزة:</label>
                  <input
                    type="number"
                    value={tripsCompleted}
                    onChange={(e) => setTripsCompleted(e.target.value)}
                    className="w-full py-2 px-3 rounded-xl bg-slate-900 border border-slate-700 text-xs font-mono text-center text-slate-100 focus:border-sky-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-300 font-bold block mb-1">إجمالي الأطنان المنقولة (طن):</label>
                  <input
                    type="number"
                    value={tonnesCompleted}
                    onChange={(e) => setTonnesCompleted(e.target.value)}
                    className="w-full py-2 px-3 rounded-xl bg-slate-900 border border-slate-700 text-xs font-mono text-center text-slate-100 focus:border-sky-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-300 font-bold block mb-1">ملاحظات التسليم والتسلم للمشغل القادم:</label>
                <textarea
                  rows={2}
                  value={handoverNotes}
                  onChange={(e) => setHandoverNotes(e.target.value)}
                  placeholder="مثال: تم إبلاغ الورشة بصوت تزييت خفيف في الباكت، استمر التحميل من منسوب +140m"
                  className="w-full py-2 px-3 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-100 focus:border-sky-500 focus:outline-none resize-none"
                />
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  className="py-2.5 px-6 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-black text-xs flex items-center gap-2 cursor-pointer shadow-lg shadow-sky-950 transition-transform active:scale-98"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>تأكيد تسليم الوردية وإغلاق السجل</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
