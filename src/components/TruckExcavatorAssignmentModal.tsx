import React, { useState, useEffect } from 'react';
import {
  X,
  HardHat,
  Truck as TruckIcon,
  Check,
  CheckSquare,
  Square,
  Search,
  Filter,
  RotateCcw,
  AlertTriangle,
  Send,
  BellRing,
  Info,
  Layers,
  Sparkles,
} from 'lucide-react';
import { Excavator, Truck, TruckExcavatorAssignment, DispatcherUser } from '../types/dispatch';
import {
  getTruckExcavatorAssignments,
  assignTrucksToExcavator,
  getActiveDispatcher,
  sendDispatcherMessage,
} from '../utils/storage';
import { playClickSound, playLoadConfirmedSound, playDispatchAlertSound } from '../utils/audio';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  excavators: Excavator[];
  trucks: Truck[];
  initialExcavatorId?: string | null;
  activeDispatcher?: DispatcherUser | null;
  onAssignmentsUpdated?: () => void;
}

export const TruckExcavatorAssignmentModal: React.FC<Props> = ({
  isOpen,
  onClose,
  excavators,
  trucks,
  initialExcavatorId,
  activeDispatcher,
  onAssignmentsUpdated,
}) => {
  const [assignments, setAssignments] = useState<Record<string, TruckExcavatorAssignment>>(getTruckExcavatorAssignments());
  const [selectedExcavatorId, setSelectedExcavatorId] = useState<string>(initialExcavatorId || excavators[0]?.id || 'EX08');
  const [selectedTruckIds, setSelectedTruckIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'SELECTED' | 'AVAILABLE' | 'OTHER' | 'OUT_OF_SERVICE'>('ALL');
  const [notes, setNotes] = useState('');
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null);
  const [warningTooltip, setWarningTooltip] = useState<string | null>(null);

  // Sync initialExcavatorId when modal opens or prop changes
  useEffect(() => {
    if (isOpen && initialExcavatorId) {
      setSelectedExcavatorId(initialExcavatorId);
    }
  }, [isOpen, initialExcavatorId]);

  // Reload assignments when opened or selected excavator changes
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
      setNoticeMessage(null);
      setWarningTooltip(null);
    }
  }, [isOpen, selectedExcavatorId]);

  if (!isOpen) return null;

  const currentExcavator = excavators.find(e => e.id === selectedExcavatorId) || excavators[0];

  // Helper to switch excavator
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
    setNoticeMessage(null);
    setWarningTooltip(null);
  };

  // Toggle selection for a specific truck
  const handleToggleTruck = (truck: Truck) => {
    const isOutOfService = truck.status === 'BREAKDOWN' || truck.status === 'MAINTENANCE';

    // Rule: "واللي عطل يبقي متسجل خارج الخدمة مختارهوش"
    if (isOutOfService) {
      playDispatchAlertSound();
      setWarningTooltip(`⛔ الدنبر ${truck.id} مسجل في حالة (عطل / صيانة خارج الخدمة) ولا يمكن تخصيصه للتحميل.`);
      setTimeout(() => setWarningTooltip(null), 4000);
      return;
    }

    playClickSound();
    setWarningTooltip(null);

    setSelectedTruckIds(prev => {
      const next = new Set(prev);
      if (next.has(truck.id)) {
        next.delete(truck.id);
      } else {
        next.add(truck.id);
      }
      return next;
    });
  };

  // Quick batch buttons
  const handleAddFreeTrucks = (count: number) => {
    playClickSound();
    const freeAndActiveTrucks = trucks.filter(t => {
      const isOutOfService = t.status === 'BREAKDOWN' || t.status === 'MAINTENANCE';
      const isFree = !assignments[t.id]?.excavatorId;
      return isFree && !isOutOfService && !selectedTruckIds.has(t.id);
    });

    const toAdd = freeAndActiveTrucks.slice(0, count).map(t => t.id);
    if (toAdd.length === 0) {
      setWarningTooltip('لا توجد دنابر حرة ونشطة متاحة للإضافة حالياً.');
      setTimeout(() => setWarningTooltip(null), 3500);
      return;
    }

    setSelectedTruckIds(prev => {
      const next = new Set(prev);
      toAdd.forEach(id => next.add(id));
      return next;
    });
  };

  const handleClearCurrentExcavator = () => {
    playClickSound();
    setSelectedTruckIds(new Set());
    setNoticeMessage(null);
  };

  const handleSelectAllFiltered = () => {
    playClickSound();
    setSelectedTruckIds(prev => {
      const next = new Set(prev);
      filteredTrucks.forEach(t => {
        const isOutOfService = t.status === 'BREAKDOWN' || t.status === 'MAINTENANCE';
        if (!isOutOfService) {
          next.add(t.id);
        }
      });
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

  // Rule: "ويوصل رسالة بعد زرار التأكيد بالدنابر اللي مكانتش مع المعدة واضافت جديد انهم يروحوا للمعدة دي"
  const handleSaveAssignments = () => {
    playLoadConfirmedSound();
    const dispatcher = activeDispatcher || getActiveDispatcher();

    // 1. Identify trucks previously assigned to this excavator
    const previouslyAssignedToThis = Object.values(assignments)
      .filter(a => a.excavatorId === selectedExcavatorId)
      .map(a => a.truckId);

    // 2. Identify trucks to remove (were previously assigned to this excavator, now unselected)
    const trucksToRemove = previouslyAssignedToThis.filter(id => !selectedTruckIds.has(id));
    if (trucksToRemove.length > 0) {
      assignTrucksToExcavator(trucksToRemove, 'UNASSIGNED');
    }

    // 3. Assign all selected trucks to this excavator
    const trucksToAdd = Array.from(selectedTruckIds);
    if (trucksToAdd.length > 0) {
      assignTrucksToExcavator(
        trucksToAdd,
        selectedExcavatorId,
        dispatcher?.name || 'غرفة العمليات المركزية',
        dispatcher?.code || 'DSP',
        currentExcavator?.benchLevel,
        undefined,
        notes.trim() || undefined
      );
    }

    // 4. Identify newly added trucks (those that weren't with this excavator previously)
    const newlyAddedTrucks = trucksToAdd.filter(id => !previouslyAssignedToThis.includes(id));

    // 5. Send automated urgent instructions to every newly added truck
    if (newlyAddedTrucks.length > 0) {
      const excavatorLabel = currentExcavator?.id || selectedExcavatorId;
      const benchDesc = currentExcavator?.benchLevel ? `بموقع (${currentExcavator.benchLevel})` : 'في الحفرة المفتوحة';
      const modelDesc = currentExcavator?.model ? `طراز ${currentExcavator.model}` : 'معدة التحميل';

      newlyAddedTrucks.forEach(truckId => {
        const truckObj = trucks.find(t => t.id === truckId);
        const driverName = truckObj?.assignedDriver;
        const msgText = `🚨 أمر تحرك فوري: تم تعيينك للعمل مع معدة التحميل [${excavatorLabel}] (${modelDesc}) ${benchDesc}. توجه فوراً إلى موقع المعدة للبدء في التحميل.`;

        sendDispatcherMessage(
          truckId,
          msgText,
          'URGENT',
          dispatcher?.name ? `الديسباتشر: ${dispatcher.name}` : 'غرفة الدسباتش المركزي',
          driverName
        );
      });

      setNoticeMessage(`✅ تم اعتماد التوزيع وإرسال أمر التحميل الفوري إلى (${newlyAddedTrucks.length}) دنبر جديد: ${newlyAddedTrucks.join('، ')} 📢`);
    }

    const updated = getTruckExcavatorAssignments();
    setAssignments(updated);
    if (onAssignmentsUpdated) onAssignmentsUpdated();

    // Close after short delay if notifications sent, or immediately
    if (newlyAddedTrucks.length > 0) {
      setTimeout(() => {
        onClose();
      }, 1500);
    } else {
      onClose();
    }
  };

  // Filter trucks for selection grid
  const filteredTrucks = trucks.filter(truck => {
    const isOutOfService = truck.status === 'BREAKDOWN' || truck.status === 'MAINTENANCE';
    const isSelected = selectedTruckIds.has(truck.id);
    const existing = assignments[truck.id];
    const isAssignedToOther = existing && existing.excavatorId && existing.excavatorId !== selectedExcavatorId;
    const isFree = !existing?.excavatorId;

    if (statusFilter === 'SELECTED' && !isSelected) return false;
    if (statusFilter === 'AVAILABLE' && (!isFree || isOutOfService || isSelected)) return false;
    if (statusFilter === 'OTHER' && (!isAssignedToOther || isOutOfService || isSelected)) return false;
    if (statusFilter === 'OUT_OF_SERVICE' && !isOutOfService) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        truck.id.toLowerCase().includes(q) ||
        (truck.assignedDriver && truck.assignedDriver.toLowerCase().includes(q))
      );
    }
    return true;
  });

  // Calculate counts for legend/filters
  const selectedCount = selectedTruckIds.size;
  const previouslyAssignedCount = Object.values(assignments).filter(a => a.excavatorId === selectedExcavatorId).length;
  const newlyAddedCount = Array.from(selectedTruckIds).filter(
    id => assignments[id]?.excavatorId !== selectedExcavatorId
  ).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-6xl max-h-[94vh] bg-slate-900 border-2 border-emerald-500/60 rounded-3xl shadow-2xl flex flex-col overflow-hidden text-slate-100">
        
        {/* Header Bar */}
        <div className="p-4 md:p-5 bg-gradient-to-r from-emerald-950/90 via-slate-900 to-slate-900 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border-2 border-emerald-500 flex items-center justify-center text-emerald-400 font-bold shrink-0">
              <HardHat className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base md:text-xl font-black text-white">
                  تخصيص أسطول الدنابر للمعدة: <span className="font-mono text-emerald-400 font-black">{currentExcavator?.id}</span>
                </h3>
                <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-500/40">
                  {currentExcavator?.model}
                </span>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                  الموقع: {currentExcavator?.benchLevel}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                اختر الدنابر المطلوبة بالضغط عليها مباشرة، وسيتم إرسال أمر تشغيل فوري وتوجيه كابينة السائق للدنابر المضافة حديثاً.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
            title="إغلاق النافذة"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Warning & Success Notice Banners */}
        {noticeMessage && (
          <div className="bg-emerald-950 border-b border-emerald-500/50 p-2.5 px-4 text-xs font-bold text-emerald-200 flex items-center gap-2 animate-in fade-in">
            <BellRing className="w-4 h-4 text-emerald-400 shrink-0 animate-bounce" />
            <span>{noticeMessage}</span>
          </div>
        )}

        {warningTooltip && (
          <div className="bg-rose-950/90 border-b border-rose-500/50 p-2.5 px-4 text-xs font-bold text-rose-200 flex items-center gap-2 animate-in fade-in">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{warningTooltip}</span>
          </div>
        )}

        {/* Modal Body: 2 Columns */}
        <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-12 gap-0 divide-y lg:divide-y-0 lg:divide-x lg:divide-x-reverse divide-slate-800">
          
          {/* Left Column: 14 Loading Units List (3.5 cols) */}
          <div className="lg:col-span-3 p-3.5 overflow-y-auto bg-slate-950/60 space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-slate-400 mb-2 px-1">
              <span>اختر المعدة للتحكم:</span>
              <span className="text-emerald-400 font-mono">{excavators.length} معدة</span>
            </div>

            <div className="space-y-1.5">
              {excavators.map(ex => {
                const isSelected = ex.id === selectedExcavatorId;
                const assignedTrucksCount = Object.values(assignments).filter(a => a.excavatorId === ex.id).length;
                const isShovel = ex.id.startsWith('SH');
                const isLoader = ex.id.startsWith('WL');
                const emoji = isShovel ? '🏗️' : isLoader ? '🚜' : '🚜';

                return (
                  <div
                    key={ex.id}
                    onClick={() => handleSelectExcavator(ex.id)}
                    className={`p-2.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                      isSelected
                        ? 'bg-emerald-500/20 border-emerald-500 shadow-md ring-2 ring-emerald-500/40 text-emerald-100'
                        : 'bg-slate-900 border-slate-800 hover:border-slate-700 hover:bg-slate-850 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs ${
                        isSelected ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-300'
                      }`}>
                        {emoji}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-black text-xs text-white">{ex.id}</span>
                          <span className="text-[10px] text-slate-400">{ex.model}</span>
                        </div>
                        <div className="text-[10px] text-slate-400 truncate max-w-[130px]">
                          {ex.benchLevel?.split('(')[0] || ex.benchLevel}
                        </div>
                      </div>
                    </div>

                    <div className="text-left shrink-0">
                      <span className={`py-0.5 px-2 rounded-lg text-xs font-mono font-bold ${
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

          {/* Right Column: 60 Dump Trucks Interactive Color-Coded Grid (8.5 cols) */}
          <div className="lg:col-span-9 p-3.5 md:p-5 overflow-y-auto flex flex-col bg-slate-900/60">
            
            {/* Color Guide / Legend Bar (صريح كما طلب المستخدم تماماً) */}
            <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 mb-3 shadow-sm">
              <div className="text-xs font-bold text-slate-300 mb-2 flex items-center gap-2">
                <Info className="w-3.5 h-3.5 text-amber-400" />
                <span>دليل ألوان الدنابر (اضغط على أي دنبر لتحديده أو إلغائه):</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                {/* 🔴 RED: Selected with this excavator */}
                <div className="p-2 rounded-xl bg-red-950/70 border-2 border-red-500 text-red-200 flex items-center gap-2 font-bold shadow-sm">
                  <span className="w-3 h-3 rounded-full bg-red-500 shadow-md shadow-red-500/80 animate-pulse" />
                  <div>
                    <span className="block text-red-100">أحمر (محدد هنا)</span>
                    <span className="text-[10px] text-red-300 font-normal">يعمل مع هذا الحفار</span>
                  </div>
                </div>

                {/* 🟢 GREEN: Free / Available */}
                <div className="p-2 rounded-xl bg-emerald-950/60 border-2 border-emerald-500/80 text-emerald-200 flex items-center gap-2 font-bold shadow-sm">
                  <span className="w-3 h-3 rounded-full bg-emerald-400 shadow-md shadow-emerald-500/80" />
                  <div>
                    <span className="block text-emerald-100">أخضر (متاح وحر)</span>
                    <span className="text-[10px] text-emerald-300 font-normal">جاهز للتخصيص فوراً</span>
                  </div>
                </div>

                {/* 🟡 YELLOW: Working with another excavator (can still be clicked!) */}
                <div className="p-2 rounded-xl bg-amber-950/50 border-2 border-amber-500/80 text-amber-200 flex items-center gap-2 font-bold shadow-sm">
                  <span className="w-3 h-3 rounded-full bg-amber-400 shadow-md shadow-amber-500/80" />
                  <div>
                    <span className="block text-amber-100">أصفر (مع معدة أخرى)</span>
                    <span className="text-[10px] text-amber-300 font-normal">انقر لنقله إلى هنا</span>
                  </div>
                </div>

                {/* ⛔ GREY / DISABLED: Broken down / Maintenance */}
                <div className="p-2 rounded-xl bg-slate-900 border border-slate-700/60 text-slate-400 flex items-center gap-2 font-bold opacity-80">
                  <span className="w-3 h-3 rounded-full bg-slate-600" />
                  <div>
                    <span className="block text-slate-300">خارج الخدمة (عطل)</span>
                    <span className="text-[10px] text-slate-500 font-normal">معطل لا يمكن اختياره</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Filter and Search Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2.5 mb-3">
              <div className="relative flex-1 min-w-[170px]">
                <Search className="w-4 h-4 text-slate-500 absolute right-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="بحث برقم الدنبر (مثال: DT012) أو السائق..."
                  className="w-full py-2 pr-9 pl-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Status Filter Tabs */}
              <div className="flex items-center gap-1 p-1 bg-slate-950 border border-slate-800 rounded-xl text-xs overflow-x-auto">
                <button
                  type="button"
                  onClick={() => setStatusFilter('ALL')}
                  className={`py-1 px-2.5 rounded-lg font-bold transition-colors shrink-0 ${
                    statusFilter === 'ALL' ? 'bg-slate-800 text-slate-100' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  الكل ({trucks.length})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('SELECTED')}
                  className={`py-1 px-2.5 rounded-lg font-bold transition-colors shrink-0 ${
                    statusFilter === 'SELECTED' ? 'bg-red-600 text-white' : 'text-slate-400 hover:text-red-300'
                  }`}
                >
                  🔴 محدد هنا ({selectedCount})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('AVAILABLE')}
                  className={`py-1 px-2.5 rounded-lg font-bold transition-colors shrink-0 ${
                    statusFilter === 'AVAILABLE' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-emerald-300'
                  }`}
                >
                  🟢 متاح وحر
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('OTHER')}
                  className={`py-1 px-2.5 rounded-lg font-bold transition-colors shrink-0 ${
                    statusFilter === 'OTHER' ? 'bg-amber-600 text-slate-950' : 'text-slate-400 hover:text-amber-300'
                  }`}
                >
                  🟡 مع معدات أخرى
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('OUT_OF_SERVICE')}
                  className={`py-1 px-2.5 rounded-lg font-bold transition-colors shrink-0 ${
                    statusFilter === 'OUT_OF_SERVICE' ? 'bg-slate-800 text-slate-300' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  ⛔ خارج الخدمة
                </button>
              </div>

              {/* Quick Batch Controls */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => handleAddFreeTrucks(3)}
                  className="py-1.5 px-2.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer"
                  title="إضافة 3 دنابر خضراء حرة فوراً لهذا الحفار"
                >
                  <span>+3 حرة 🟢</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleAddFreeTrucks(5)}
                  className="py-1.5 px-2.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer"
                  title="إضافة 5 دنابر خضراء حرة فوراً لهذا الحفار"
                >
                  <span>+5 حرة 🟢</span>
                </button>
                <button
                  type="button"
                  onClick={handleClearCurrentExcavator}
                  className="py-1.5 px-2.5 rounded-xl bg-rose-950/60 hover:bg-rose-900 text-rose-300 border border-rose-500/40 text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer"
                  title="تفريغ جميع الدنابر المحددة لهذا الحفار"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>تفريغ (0)</span>
                </button>
                <button
                  type="button"
                  onClick={handleSelectAllFiltered}
                  className="py-1.5 px-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <CheckSquare className="w-3.5 h-3.5 text-emerald-400" />
                  <span>تحديد المعروض</span>
                </button>
              </div>
            </div>

            {/* Trucks Grid (DT001-DT060) */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5 flex-1 max-h-[380px] overflow-y-auto pr-1">
              {filteredTrucks.map(truck => {
                const isOutOfService = truck.status === 'BREAKDOWN' || truck.status === 'MAINTENANCE';
                const isSelected = selectedTruckIds.has(truck.id);
                const existing = assignments[truck.id];
                const isAssignedToOther = existing && existing.excavatorId && existing.excavatorId !== selectedExcavatorId;
                const isFree = !existing?.excavatorId;

                // Color Themes strictly according to user's specification:
                // 1. OUT OF SERVICE (عطلان خارج الخدمة - مختارهوش)
                if (isOutOfService) {
                  return (
                    <div
                      key={truck.id}
                      onClick={() => handleToggleTruck(truck)}
                      className="p-2.5 rounded-2xl border border-slate-700/60 bg-slate-900/80 text-slate-500 opacity-60 cursor-not-allowed select-none transition-all flex flex-col justify-between min-h-[92px]"
                      title={`الدنبر ${truck.id} في حالة عطل أو صيانة خارج الخدمة`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-mono font-black text-xs text-slate-400">{truck.id}</span>
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-800 text-rose-400 border border-rose-900/40">
                          {truck.status === 'BREAKDOWN' ? 'عطل 🚨' : 'صيانة 🔧'}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-500 truncate">
                        {truck.assignedDriver || `${truck.capacityTonnes}t · CAT 785`}
                      </div>
                      <div className="mt-1 pt-1 border-t border-slate-800 text-[9px] font-bold text-rose-400/80 flex items-center gap-1">
                        <span>⛔ خارج الخدمة</span>
                      </div>
                    </div>
                  );
                }

                // 2. SELECTED FOR THIS EXCAVATOR (أحمر - منور بالأحمر)
                if (isSelected) {
                  return (
                    <div
                      key={truck.id}
                      onClick={() => handleToggleTruck(truck)}
                      className="p-2.5 rounded-2xl border-2 border-red-500 bg-gradient-to-b from-red-950/90 via-red-900/70 to-red-950/90 text-red-100 shadow-xl shadow-red-950/60 ring-2 ring-red-500/80 cursor-pointer select-none transition-all scale-[1.02] flex flex-col justify-between min-h-[92px]"
                      title={`الدنبر ${truck.id} محدد للعمل مع الحفار ${selectedExcavatorId}. اضغط لإلغاء التحديد.`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-mono font-black text-xs text-white flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-red-400 animate-ping inline-block" />
                          {truck.id}
                        </span>
                        <div className="w-5 h-5 rounded-lg bg-red-600 text-white flex items-center justify-center shadow-md">
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                        </div>
                      </div>
                      <div className="text-[10px] text-red-200 truncate font-medium">
                        {truck.assignedDriver ? `سائق: ${truck.assignedDriver}` : `${truck.capacityTonnes}t · CAT 785`}
                      </div>
                      <div className="mt-1 pt-1 border-t border-red-500/30 flex items-center justify-between text-[9px]">
                        <span className="font-bold text-red-200 flex items-center gap-1">
                          <span>🔴 محدد مع {selectedExcavatorId}</span>
                        </span>
                        <span className="text-red-300 text-[8px] underline">إلغاء ✕</span>
                      </div>
                    </div>
                  );
                }

                // 3. ASSIGNED TO ANOTHER EXCAVATOR (أصفر - شغال مع معدة تانية وممكن اختياره عادي)
                if (isAssignedToOther) {
                  return (
                    <div
                      key={truck.id}
                      onClick={() => handleToggleTruck(truck)}
                      className="p-2.5 rounded-2xl border-2 border-amber-500/80 bg-amber-950/40 hover:bg-amber-900/60 text-amber-200 hover:border-amber-400 shadow-sm cursor-pointer select-none transition-all flex flex-col justify-between min-h-[92px] group"
                      title={`الدنبر ${truck.id} يعمل حالياً مع ${existing.excavatorId}. اضغط لنقله فوراً إلى ${selectedExcavatorId}.`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-mono font-black text-xs text-amber-300">{truck.id}</span>
                        <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-amber-900/80 text-amber-200 border border-amber-500/40">
                          مع {existing.excavatorId}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-300 truncate font-medium">
                        {truck.assignedDriver || `${truck.capacityTonnes}t · CAT 785`}
                      </div>
                      <div className="mt-1 pt-1 border-t border-amber-500/30 flex items-center justify-between text-[9px]">
                        <span className="font-bold text-amber-400 flex items-center gap-1">
                          <span>🟡 شغال هناك</span>
                        </span>
                        <span className="text-amber-300 group-hover:text-white font-bold text-[8px] bg-amber-950 px-1 py-0.2 rounded border border-amber-500/40">
                          نقل لهنا ➕
                        </span>
                      </div>
                    </div>
                  );
                }

                // 4. AVAILABLE / FREE (أخضر - متاح وحر)
                return (
                  <div
                    key={truck.id}
                    onClick={() => handleToggleTruck(truck)}
                    className="p-2.5 rounded-2xl border-2 border-emerald-500/80 bg-emerald-950/40 hover:bg-emerald-900/60 text-emerald-200 hover:border-emerald-400 shadow-sm cursor-pointer select-none transition-all flex flex-col justify-between min-h-[92px] group"
                    title={`الدنبر ${truck.id} متاح وحر. اضغط لاختياره مع ${selectedExcavatorId}.`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-mono font-black text-xs text-emerald-300">{truck.id}</span>
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-md shadow-emerald-500/60" />
                    </div>
                    <div className="text-[10px] text-slate-300 truncate font-medium">
                      {truck.assignedDriver || `${truck.capacityTonnes}t · CAT 785`}
                    </div>
                    <div className="mt-1 pt-1 border-t border-emerald-500/30 flex items-center justify-between text-[9px]">
                      <span className="font-bold text-emerald-400 flex items-center gap-1">
                        <span>🟢 متاح / حر</span>
                      </span>
                      <span className="text-emerald-300 group-hover:text-white font-bold text-[8px] bg-emerald-950 px-1 py-0.2 rounded border border-emerald-500/40">
                        اختيار ➕
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Bottom Actions & Confirmation */}
            <div className="mt-3 pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold text-slate-300">
                  المحدد للحفار <strong className="font-mono text-emerald-400 text-sm">{selectedExcavatorId}</strong>:
                </span>
                <span className="py-1 px-3 rounded-xl bg-red-950/80 border-2 border-red-500 font-mono font-black text-sm text-red-200">
                  🔴 {selectedCount} دنابر
                </span>

                {newlyAddedCount > 0 && (
                  <span className="py-1 px-3 rounded-xl bg-amber-500/20 border border-amber-500/50 font-bold text-xs text-amber-300 flex items-center gap-1">
                    <Send className="w-3.5 h-3.5" />
                    <span>سيتم إرسال أمر تشغيل فوري إلى {newlyAddedCount} دنبر جديد</span>
                  </span>
                )}
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
                  className="py-2.5 px-6 rounded-xl bg-gradient-to-r from-emerald-500 via-emerald-600 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-black text-xs md:text-sm flex items-center gap-2 shadow-xl shadow-emerald-500/25 cursor-pointer active:scale-95 transition-all border-2 border-emerald-300"
                >
                  <Check className="w-4 h-4 stroke-[3]" />
                  <span>تأكيد التوزيع وإرسال أمر التحميل للدنابر الجديدة 📢</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
