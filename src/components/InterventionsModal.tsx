import React, { useState, useEffect } from 'react';
import {
  X,
  Wrench,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Plus,
  ShieldCheck,
  User,
  Send,
  Flame,
  Truck as TruckIcon,
  HardHat,
  Filter,
  Check,
  FileSpreadsheet,
} from 'lucide-react';
import {
  EquipmentIntervention,
  Truck,
  Excavator,
  DispatcherUser,
  ProductionGapAlert,
} from '../types/dispatch';
import {
  getEquipmentInterventions,
  addEquipmentIntervention,
  approveEquipmentIntervention,
  resolveEquipmentIntervention,
  getActiveDispatcher,
  subscribeToDataChanges,
} from '../utils/storage';
import { playClickSound, playLoadConfirmedSound } from '../utils/audio';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  trucks: Truck[];
  excavators: Excavator[];
  activeDispatcher?: DispatcherUser | null;
  preselectedUnitId?: string | null;
  onInterventionsChanged?: () => void;
}

export const InterventionsModal: React.FC<Props> = ({
  isOpen,
  onClose,
  trucks,
  excavators,
  activeDispatcher,
  preselectedUnitId,
  onInterventionsChanged,
}) => {
  const [interventions, setInterventions] = useState<EquipmentIntervention[]>(getEquipmentInterventions());
  const [activeTab, setActiveTab] = useState<'LIST' | 'NEW'>('LIST');

  // Form states
  const [equipmentId, setEquipmentId] = useState<string>(preselectedUnitId || trucks[0]?.id || 'DT001');
  const [equipmentType, setEquipmentType] = useState<'TRUCK' | 'EXCAVATOR'>('TRUCK');
  const [problemDescription, setProblemDescription] = useState<string>('');
  const [proposedAction, setProposedAction] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [estimatedTons, setEstimatedTons] = useState<number>(152);
  const [autoApprove, setAutoApprove] = useState<boolean>(true);
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'PROPOSED' | 'APPROVED' | 'RESOLVED'>('ALL');

  useEffect(() => {
    if (isOpen) {
      setInterventions(getEquipmentInterventions());
      if (preselectedUnitId) {
        setEquipmentId(preselectedUnitId);
        const isTruck = trucks.some(t => t.id === preselectedUnitId);
        setEquipmentType(isTruck ? 'TRUCK' : 'EXCAVATOR');
        setActiveTab('NEW');
        setProblemDescription(`تأخر في دورة التشغيل / تراكم فجوة إنتاجية على المعدة ${preselectedUnitId}`);
        setProposedAction('توجيه للمسار البديل وتعديل أولوية التحميل لإنعاش التدفق');
      }
    }
  }, [isOpen, preselectedUnitId, trucks]);

  useEffect(() => {
    const unsub = subscribeToDataChanges(event => {
      if (event.type === 'EQUIPMENT_INTERVENTIONS_UPDATED') {
        setInterventions(getEquipmentInterventions());
      }
    });
    return () => unsub();
  }, []);

  if (!isOpen) return null;

  const currentDisp = activeDispatcher || getActiveDispatcher() || {
    name: 'م. أحمد فؤاد',
    code: 'DSP01',
    role: 'CHIEF_DISPATCHER',
  };

  const handleSubmitNewIntervention = (e: React.FormEvent) => {
    e.preventDefault();
    if (!problemDescription.trim() || !proposedAction.trim()) return;

    playLoadConfirmedSound();
    addEquipmentIntervention({
      equipmentId,
      equipmentType,
      problemDescription: problemDescription.trim(),
      proposedAction: proposedAction.trim(),
      proposedByDispatcherName: currentDisp.name,
      proposedByDispatcherCode: currentDisp.code,
      notes: notes.trim() || undefined,
      estimatedTonsRecovered: Number(estimatedTons) || 152,
      autoApprove,
    });

    setInterventions(getEquipmentInterventions());
    setProblemDescription('');
    setProposedAction('');
    setNotes('');
    setActiveTab('LIST');
    if (onInterventionsChanged) onInterventionsChanged();
  };

  const handleApprove = (id: string) => {
    playLoadConfirmedSound();
    approveEquipmentIntervention(id, currentDisp.name, currentDisp.code);
    setInterventions(getEquipmentInterventions());
    if (onInterventionsChanged) onInterventionsChanged();
  };

  const handleResolve = (id: string) => {
    playClickSound();
    resolveEquipmentIntervention(id);
    setInterventions(getEquipmentInterventions());
    if (onInterventionsChanged) onInterventionsChanged();
  };

  const filteredList = interventions.filter(item => {
    if (filterStatus === 'ALL') return true;
    return item.status === filterStatus;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-5 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl max-h-[92vh] bg-slate-900 border-2 border-amber-500/50 rounded-3xl shadow-2xl flex flex-col overflow-hidden text-slate-100">
        {/* Header Bar */}
        <div className="p-4 md:p-5 bg-gradient-to-r from-amber-950/80 via-slate-900 to-slate-900 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border-2 border-amber-500 flex items-center justify-center text-amber-400 font-bold shrink-0">
              <Wrench className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg md:text-xl font-black text-white">
                  سجل الإجراءات التصحيحية وحلول التأخيرات الميدانية
                </h3>
                <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-amber-950 text-amber-300 border border-amber-500/40">
                  معتمد وموثق
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                إضافة حلول يدوية للدنابر والمعدات المتأخرة، وتوثيق من اقترح الحل ومن اعتمده ومزامنتها لحظياً للتقارير وجوجل شيت
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher & Active Dispatcher Badge */}
        <div className="p-3 bg-slate-950/70 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={() => { playClickSound(); setActiveTab('LIST'); }}
              className={`py-2 px-4 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'LIST'
                  ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              <span>📋 قائمة الحلول والإجراءات ({interventions.length})</span>
            </button>

            <button
              onClick={() => { playClickSound(); setActiveTab('NEW'); }}
              className={`py-2 px-4 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'NEW'
                  ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              <Plus className="w-4 h-4" />
              <span>إضافة حل / إجراء يدوي جديد</span>
            </button>
          </div>

          <div className="flex items-center gap-2 text-xs bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-800">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span className="text-slate-400">الديسباتشر المسجل:</span>
            <strong className="text-amber-400 font-bold">{currentDisp.name}</strong>
            <span className="font-mono text-slate-400">({currentDisp.code})</span>
          </div>
        </div>

        {/* Modal Content */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-slate-900/60">
          {activeTab === 'NEW' ? (
            /* NEW INTERVENTION FORM */
            <form onSubmit={handleSubmitNewIntervention} className="max-w-2xl mx-auto space-y-4">
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200 leading-relaxed">
                💡 <strong>توثيق الحل الميداني:</strong> سيتم تسجيل هذا الإجراء باسمك ({currentDisp.name}) وإتاحته فوراً لكامل طقم الديسباتش وإدراجه بتقرير الساعة الرسمي وجوجل شيت.
              </div>

              {/* Row 1: Equipment Selection */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">نوع المعدة:</label>
                  <select
                    value={equipmentType}
                    onChange={(e) => {
                      const type = e.target.value as 'TRUCK' | 'EXCAVATOR';
                      setEquipmentType(type);
                      setEquipmentId(type === 'TRUCK' ? trucks[0]?.id || 'DT001' : excavators[0]?.id || 'EX08');
                    }}
                    className="w-full py-2.5 px-3 rounded-xl bg-slate-950 border border-slate-700 text-xs font-bold text-slate-200"
                  >
                    <option value="TRUCK">🚛 شاحنة نقل / دنبر (Dump Truck)</option>
                    <option value="EXCAVATOR">🏗️ معدة تحميل / حفار (Excavator / Shovel)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">كود المعدة:</label>
                  <select
                    value={equipmentId}
                    onChange={(e) => setEquipmentId(e.target.value)}
                    className="w-full py-2.5 px-3 rounded-xl bg-slate-950 border border-slate-700 text-xs font-mono font-bold text-amber-300"
                  >
                    {equipmentType === 'TRUCK'
                      ? trucks.map(t => <option key={t.id} value={t.id}>{t.id} (دنبر 152t {t.statusNote ? `· ${t.statusNote}` : ''})</option>)
                      : excavators.map(e => <option key={e.id} value={e.id}>{e.id} ({e.model} · {e.benchLevel})</option>)}
                  </select>
                </div>
              </div>

              {/* Problem Description */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  المشكلة أو سبب التأخير المرصود:
                </label>
                <input
                  type="text"
                  value={problemDescription}
                  onChange={(e) => setProblemDescription(e.target.value)}
                  placeholder="مثال: تأخر دورة الدنبر عن 25 دقيقة لوجود أعمال تسوية على الرامب"
                  className="w-full py-2.5 px-3.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-400"
                  required
                />
              </div>

              {/* Proposed Solution */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  الحل المعتمد / الإجراء التصحيحي المقترح:
                </label>
                <textarea
                  value={proposedAction}
                  onChange={(e) => setProposedAction(e.target.value)}
                  placeholder="مثال: تحويل الدنبر فوراً لتحميل من الشوڤل SH02 بمصطبة North Pit +140 لتفادي الانتظار وتغذية الكسارة"
                  rows={3}
                  className="w-full py-2.5 px-3.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-400"
                  required
                />
              </div>

              {/* Quick Preset Solutions Chips */}
              <div className="space-y-1">
                <span className="text-[11px] text-slate-400 font-bold block">نماذج حلول سريعة شائعة:</span>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    'توجيه الشاحنة للمسار الشرقي البديل لتفادي زحام الرامب',
                    'تحويل الدنبر للشحن من أقرب حفار متاح لتقليل مسافة التحميل',
                    'إرسال فني صيانة هيدروليك وإطارات فوري بالموقع',
                    'تعديل خطة التفريغ إلى الكسارة رقم 02 لإنعاش تغذية الخام',
                    'إعادة توزيع دنابر إضافية على الحفار لإنهاء حالة التوقف',
                  ].map((chip, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setProposedAction(chip)}
                      className="text-[10px] py-1 px-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              </div>

              {/* Estimated Tons & Auto-Approve Checkbox */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    الفاقد المتوقع استعادته (طن تقريبي):
                  </label>
                  <input
                    type="number"
                    value={estimatedTons}
                    onChange={(e) => setEstimatedTons(Number(e.target.value))}
                    min={0}
                    step={10}
                    className="w-full py-2 px-3 rounded-xl bg-slate-950 border border-slate-700 text-xs font-mono text-center text-emerald-400"
                  />
                </div>

                <div className="flex items-center gap-2 pt-6">
                  <label className="flex items-center gap-2 text-xs font-bold text-slate-200 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={autoApprove}
                      onChange={(e) => setAutoApprove(e.target.checked)}
                      className="w-4 h-4 rounded text-amber-500 focus:ring-amber-400 cursor-pointer"
                    />
                    <span>اعتماد الحل وتطبيقه فوراً باسمي ({currentDisp.name})</span>
                  </label>
                </div>
              </div>

              {/* Submit Button */}
              <div className="flex justify-end gap-2 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setActiveTab('LIST')}
                  className="py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="py-2.5 px-5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-md cursor-pointer active:scale-98 transition-all"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>حفظ واعتماد الإجراء التصحيحي 🛠️</span>
                </button>
              </div>
            </form>
          ) : (
            /* LIST OF INTERVENTIONS */
            <div className="space-y-4">
              {/* Filter Strip */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-1 p-1 bg-slate-950 border border-slate-800 rounded-xl text-xs">
                  <button
                    onClick={() => setFilterStatus('ALL')}
                    className={`py-1 px-3 rounded-lg font-bold transition-colors ${
                      filterStatus === 'ALL' ? 'bg-amber-500 text-slate-950 font-black' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    الكل ({interventions.length})
                  </button>
                  <button
                    onClick={() => setFilterStatus('APPROVED')}
                    className={`py-1 px-3 rounded-lg font-bold transition-colors ${
                      filterStatus === 'APPROVED' ? 'bg-emerald-600 text-white font-black' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    معتمد ومطبق 🟢 ({interventions.filter(i => i.status === 'APPROVED').length})
                  </button>
                  <button
                    onClick={() => setFilterStatus('PROPOSED')}
                    className={`py-1 px-3 rounded-lg font-bold transition-colors ${
                      filterStatus === 'PROPOSED' ? 'bg-amber-600 text-white font-black' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    قيد الاعتماد 🟡 ({interventions.filter(i => i.status === 'PROPOSED').length})
                  </button>
                  <button
                    onClick={() => setFilterStatus('RESOLVED')}
                    className={`py-1 px-3 rounded-lg font-bold transition-colors ${
                      filterStatus === 'RESOLVED' ? 'bg-slate-800 text-slate-300' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    مكتمل ومغلق ({interventions.filter(i => i.status === 'RESOLVED').length})
                  </button>
                </div>

                <div className="text-xs text-slate-400 font-mono">
                  يتم مزامنة هذه الحلول مع تقرير إكسيل الساعي وشيت جوجل تلقائياً 📊
                </div>
              </div>

              {/* Cards Feed */}
              {filteredList.length === 0 ? (
                <div className="text-center py-12 bg-slate-950/40 rounded-2xl border border-slate-800">
                  <Wrench className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                  <h4 className="text-sm font-bold text-slate-300">لا توجد إجراءات مسجلة بهذا التصنيف</h4>
                  <p className="text-xs text-slate-500 mt-1">اضغط على زر "إضافة حل / إجراء يدوي جديد" بالأعلى لتوثيق حل جديد للمعدات</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {filteredList.map((item) => {
                    const isApproved = item.status === 'APPROVED' || item.status === 'RESOLVED';

                    return (
                      <div
                        key={item.id}
                        className={`p-4 rounded-2xl border transition-all flex flex-col justify-between ${
                          item.status === 'APPROVED'
                            ? 'bg-slate-900 border-emerald-500/50 shadow-emerald-950/20 shadow-md'
                            : item.status === 'PROPOSED'
                            ? 'bg-slate-900 border-amber-500/50 shadow-amber-950/20'
                            : 'bg-slate-950 border-slate-800 opacity-80'
                        }`}
                      >
                        <div>
                          {/* Card Top Strip */}
                          <div className="flex items-center justify-between mb-2 pb-2 border-b border-slate-800">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-black text-sm text-amber-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                                {item.equipmentId}
                              </span>
                              <span className="text-[11px] text-slate-400">
                                {item.equipmentType === 'TRUCK' ? 'دنبر 152t' : 'حفار تحميل'}
                              </span>
                            </div>

                            <span
                              className={`py-0.5 px-2.5 rounded-full text-[10px] font-black ${
                                item.status === 'APPROVED'
                                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                                  : item.status === 'PROPOSED'
                                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                  : 'bg-slate-800 text-slate-400'
                              }`}
                            >
                              {item.status === 'APPROVED'
                                ? 'معتمد ومطبق 🟢'
                                : item.status === 'PROPOSED'
                                ? 'قيد الاعتماد 🟡'
                                : 'مكتمل ✅'}
                            </span>
                          </div>

                          {/* Problem Title */}
                          <div className="text-xs font-bold text-slate-300 mb-1.5 flex items-start gap-1.5">
                            <span className="text-amber-400">⚠️</span>
                            <span>{item.problemDescription}</span>
                          </div>

                          {/* Proposed Action Box */}
                          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 mb-3 text-xs leading-relaxed">
                            <span className="text-emerald-400 font-bold block mb-0.5">🛠️ الحل والإجراء المعتمد:</span>
                            <span className="text-slate-100 font-medium">{item.proposedAction}</span>
                          </div>

                          {/* Attribution Details: مين اقترح ومين اعتمد */}
                          <div className="space-y-1 text-[11px] text-slate-400 bg-slate-950/50 p-2.5 rounded-xl border border-slate-800/50 mb-3">
                            <div className="flex items-center justify-between">
                              <span>مقترح الحل:</span>
                              <strong className="text-slate-200 font-bold">
                                {item.proposedByDispatcherName} ({item.proposedByDispatcherCode})
                              </strong>
                            </div>

                            {item.approvedByDispatcherName ? (
                              <div className="flex items-center justify-between text-emerald-400">
                                <span>تم الاعتماد بواسطة:</span>
                                <strong>
                                  {item.approvedByDispatcherName} ({item.approvedByDispatcherCode})
                                </strong>
                              </div>
                            ) : (
                              <div className="flex items-center justify-between text-amber-400">
                                <span>حالة الاعتماد:</span>
                                <span>في انتظار موافقة المشرف</span>
                              </div>
                            )}

                            <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-800/50">
                              <span>التاريخ والوقت:</span>
                              <span className="font-mono">{new Date(item.proposedAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                          </div>
                        </div>

                        {/* Actions Strip */}
                        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                          {item.status === 'PROPOSED' && (
                            <button
                              onClick={() => handleApprove(item.id)}
                              className="py-1.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                              title="اعتماد وتعميم هذا الإجراء"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>اعتماد الإجراء رسمياً</span>
                            </button>
                          )}

                          {item.status === 'APPROVED' && (
                            <button
                              onClick={() => handleResolve(item.id)}
                              className="py-1.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors cursor-pointer"
                            >
                              تعليم كمكتمل ✅
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
