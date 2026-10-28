import React, { useState, useEffect } from 'react';
import {
  X,
  HardHat,
  Truck as TruckIcon,
  Check,
  CheckSquare,
  Square,
  Save,
  Radio,
  Search,
  Filter,
  Layers,
  Sparkles,
  ShieldCheck,
  RotateCcw,
  AlertCircle,
} from 'lucide-react';
import { Excavator, Truck, TruckExcavatorAssignment, DispatcherUser } from '../types/dispatch';
import {
  getTruckExcavatorAssignments,
  assignTrucksToExcavator,
  saveTruckExcavatorAssignments,
  getActiveDispatcher,
} from '../utils/storage';
import { playClickSound, playLoadConfirmedSound } from '../utils/audio';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  excavators: Excavator[];
  trucks: Truck[];
  activeDispatcher?: DispatcherUser | null;
  onAssignmentsUpdated?: () => void;
}

export const TruckExcavatorAssignmentModal: React.FC<Props> = ({
  isOpen,
  onClose,
  excavators,
  trucks,
  activeDispatcher,
  onAssignmentsUpdated,
}) => {
  const [assignments, setAssignments] = useState<Record<string, TruckExcavatorAssignment>>(getTruckExcavatorAssignments());
  const [selectedExcavatorId, setSelectedExcavatorId] = useState<string>(excavators[0]?.id || 'EX08');
  const [selectedTruckIds, setSelectedTruckIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ASSIGNED_TO_THIS' | 'UNASSIGNED' | 'ASSIGNED_OTHER'>('ALL');
  const [notes, setNotes] = useState('');

  // Reload assignments when opened
  useEffect(() => {
    if (isOpen) {
      const current = getTruckExcavatorAssignments();
      setAssignments(current);

      // Pre-select trucks already assigned to this excavator
      const initial = new Set<string>();
      Object.values(current).forEach(a => {
        if (a.excavatorId === selectedExcavatorId) {
          initial.add(a.truckId);
        }
      });
      setSelectedTruckIds(initial);
    }
  }, [isOpen, selectedExcavatorId]);

  if (!isOpen) return null;

  const currentExcavator = excavators.find(e => e.id === selectedExcavatorId) || excavators[0];

  const handleSelectExcavator = (exId: string) => {
    playClickSound();
    setSelectedExcavatorId(exId);
    const initial = new Set<string>();
    Object.values(assignments).forEach(a => {
      if (a.excavatorId === exId) {
        initial.add(a.truckId);
      }
    });
    setSelectedTruckIds(initial);
  };

  const handleToggleTruck = (truckId: string) => {
    playClickSound();
    setSelectedTruckIds(prev => {
      const next = new Set(prev);
      if (next.has(truckId)) {
        next.delete(truckId);
      } else {
        next.add(truckId);
      }
      return next;
    });
  };

  const handleSelectAllFiltered = () => {
    playClickSound();
    setSelectedTruckIds(prev => {
      const next = new Set(prev);
      filteredTrucks.forEach(t => next.add(t.id));
      return next;
    });
  };

  const handleDeselectAllFiltered = () => {
    playClickSound();
    setSelectedTruckIds(prev => {
      const next = new Set(prev);
      filteredTrucks.forEach(t => next.delete(t.id));
      return next;
    });
  };

  const handleSaveAssignments = () => {
    playLoadConfirmedSound();
    const dispatcher = activeDispatcher || getActiveDispatcher();

    // 1. Identify trucks that were previously assigned to this excavator but now unselected
    const trucksToRemove: string[] = [];
    Object.values(assignments).forEach(a => {
      if (a.excavatorId === selectedExcavatorId && !selectedTruckIds.has(a.truckId)) {
        trucksToRemove.push(a.truckId);
      }
    });

    if (trucksToRemove.length > 0) {
      assignTrucksToExcavator(trucksToRemove, 'UNASSIGNED');
    }

    // 2. Assign all selected trucks to this excavator
    const trucksToAdd = Array.from(selectedTruckIds);
    if (trucksToAdd.length > 0) {
      assignTrucksToExcavator(
        trucksToAdd,
        selectedExcavatorId,
        dispatcher?.name || 'غرفة الدسباتش',
        dispatcher?.code || 'DSP',
        currentExcavator?.benchLevel,
        undefined,
        notes.trim() || undefined
      );
    }

    const updated = getTruckExcavatorAssignments();
    setAssignments(updated);
    if (onAssignmentsUpdated) onAssignmentsUpdated();
    onClose();
  };

  // Filter trucks for selection grid
  const filteredTrucks = trucks.filter(truck => {
    const a = assignments[truck.id];
    if (statusFilter === 'ASSIGNED_TO_THIS' && a?.excavatorId !== selectedExcavatorId) return false;
    if (statusFilter === 'UNASSIGNED' && a?.excavatorId) return false;
    if (statusFilter === 'ASSIGNED_OTHER' && (!a?.excavatorId || a?.excavatorId === selectedExcavatorId)) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return truck.id.toLowerCase().includes(q) || (truck.assignedDriver && truck.assignedDriver.includes(q));
    }
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-5 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-5xl max-h-[92vh] bg-slate-900 border-2 border-emerald-500/50 rounded-3xl shadow-2xl flex flex-col overflow-hidden text-slate-100">
        {/* Header Bar */}
        <div className="p-4 md:p-5 bg-gradient-to-r from-emerald-950/80 via-slate-900 to-slate-900 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border-2 border-emerald-500 flex items-center justify-center text-emerald-400 font-bold shrink-0">
              <HardHat className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg md:text-xl font-black text-white">
                  توزيع وربط أسطول الدنابر على الحفارات (Fleet Circuit Assignment)
                </h3>
                <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-500/40">
                  مزامنة فورية لكل التابلتات
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                تخصيص مجموعة محددة من الدنابر للعمل مع كل معدة تحميل، وتظهر تلقائياً على شاشة كابينة السائق أعلى الواجهة
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

        {/* Modal Body: 2 Columns */}
        <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-12 gap-0 divide-y lg:divide-y-0 lg:divide-x lg:divide-x-reverse divide-slate-800">
          {/* Left / Excavators List (4 cols) */}
          <div className="lg:col-span-4 p-4 overflow-y-auto bg-slate-950/50 space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-slate-400 mb-2 px-1">
              <span>اختر الحفار / الشوڤل:</span>
              <span className="text-emerald-400 font-mono">{excavators.length} معدات تحميل</span>
            </div>

            <div className="space-y-1.5">
              {excavators.map(ex => {
                const isSelected = ex.id === selectedExcavatorId;
                const assignedTrucksCount = Object.values(assignments).filter(a => a.excavatorId === ex.id).length;

                return (
                  <div
                    key={ex.id}
                    onClick={() => handleSelectExcavator(ex.id)}
                    className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                      isSelected
                        ? 'bg-emerald-500/20 border-emerald-500 shadow-md ring-1 ring-emerald-500/40'
                        : 'bg-slate-900 border-slate-800 hover:border-slate-700 hover:bg-slate-850'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm ${
                        isSelected ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-300'
                      }`}>
                        {ex.id.slice(0, 2)}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-black text-sm text-slate-100">{ex.id}</span>
                          <span className="text-[10px] text-slate-400 font-medium">{ex.model}</span>
                        </div>
                        <div className="text-[11px] text-slate-400 truncate max-w-[160px]">
                          {ex.benchLevel}
                        </div>
                      </div>
                    </div>

                    <div className="text-left">
                      <span className={`py-1 px-2 rounded-xl text-xs font-mono font-bold ${
                        assignedTrucksCount > 0
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40'
                          : 'bg-slate-800 text-slate-500'
                      }`}>
                        {assignedTrucksCount} دنابر
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right / Truck Selection Grid (8 cols) */}
          <div className="lg:col-span-8 p-4 md:p-5 overflow-y-auto flex flex-col bg-slate-900/60">
            {/* Active Excavator Selected Banner */}
            <div className="p-3.5 rounded-2xl bg-gradient-to-r from-emerald-950/60 via-slate-900 to-slate-900 border border-emerald-500/30 mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="text-2xl">🚜</span>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400">تخصيص الدنابر للحفار:</span>
                    <strong className="text-base font-black font-mono text-emerald-400">{currentExcavator.id}</strong>
                    <span className="text-xs text-slate-300 font-medium">({currentExcavator.model})</span>
                  </div>
                  <div className="text-xs text-slate-400">
                    الموقع: <span className="text-slate-200 font-bold">{currentExcavator.benchLevel}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="py-1 px-3 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-mono font-black text-sm">
                  {selectedTruckIds.size} دنبر محدد
                </span>
              </div>
            </div>

            {/* Filter and Search Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2.5 mb-3">
              <div className="relative flex-1 min-w-[180px]">
                <Search className="w-4 h-4 text-slate-500 absolute right-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="بحث برقم الدنبر (مثال: DT005)..."
                  className="w-full py-2 pr-9 pl-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Status Filter */}
              <div className="flex items-center gap-1 p-1 bg-slate-950 border border-slate-800 rounded-xl text-xs">
                <button
                  type="button"
                  onClick={() => setStatusFilter('ALL')}
                  className={`py-1 px-2.5 rounded-lg font-bold transition-colors ${
                    statusFilter === 'ALL' ? 'bg-slate-800 text-emerald-400' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  الكل ({trucks.length})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('ASSIGNED_TO_THIS')}
                  className={`py-1 px-2.5 rounded-lg font-bold transition-colors ${
                    statusFilter === 'ASSIGNED_TO_THIS' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  مع هذا الحفار
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('UNASSIGNED')}
                  className={`py-1 px-2.5 rounded-lg font-bold transition-colors ${
                    statusFilter === 'UNASSIGNED' ? 'bg-slate-800 text-amber-400' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  غير مخصص
                </button>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleSelectAllFiltered}
                  className="py-1.5 px-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <CheckSquare className="w-3.5 h-3.5 text-emerald-400" />
                  <span>تحديد الكل</span>
                </button>
                <button
                  type="button"
                  onClick={handleDeselectAllFiltered}
                  className="py-1.5 px-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <Square className="w-3.5 h-3.5 text-slate-400" />
                  <span>إلغاء التحديد</span>
                </button>
              </div>
            </div>

            {/* Trucks Grid (60 Trucks) */}
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2 flex-1 max-h-[380px] overflow-y-auto pr-1">
              {filteredTrucks.map(truck => {
                const isSelected = selectedTruckIds.has(truck.id);
                const existing = assignments[truck.id];
                const isAssignedToOther = existing && existing.excavatorId !== selectedExcavatorId;

                return (
                  <div
                    key={truck.id}
                    onClick={() => handleToggleTruck(truck.id)}
                    className={`p-2.5 rounded-xl border transition-all cursor-pointer select-none relative ${
                      isSelected
                        ? 'bg-emerald-500/20 border-emerald-500 shadow-md ring-2 ring-emerald-500/40 text-emerald-200'
                        : isAssignedToOther
                        ? 'bg-slate-950/40 border-slate-800/80 text-slate-400 opacity-70'
                        : 'bg-slate-950 border-slate-800 hover:border-slate-700 text-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-mono font-black text-xs text-amber-400">{truck.id}</span>
                      {isSelected ? (
                        <Check className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <span className="w-3 h-3 rounded-full border border-slate-700" />
                      )}
                    </div>

                    <div className="text-[10px] truncate">
                      {isSelected ? (
                        <span className="font-bold text-emerald-400">مخصص هنا 🟢</span>
                      ) : isAssignedToOther ? (
                        <span className="text-slate-500 font-mono">مع: {existing.excavatorId}</span>
                      ) : (
                        <span className="text-slate-500">حر / متاح</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Dispatcher Instructions / Notes */}
            <div className="mt-4 pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <div className="flex-1 min-w-[200px]">
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="ملاحظات توجيه المسار أو نوع الخام (اختياري)..."
                  className="w-full py-2 px-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs cursor-pointer transition-colors"
                >
                  إلغاء
                </button>

                <button
                  type="button"
                  onClick={handleSaveAssignments}
                  className="py-2.5 px-5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-lg shadow-emerald-500/20 cursor-pointer active:scale-98 transition-all"
                >
                  <Save className="w-4 h-4" />
                  <span>اعتماد وتعميم التوزيع على التابلتات ({selectedTruckIds.size} دنبر) 📡</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
