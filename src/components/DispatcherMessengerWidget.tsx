import React, { useState, useEffect } from 'react';
import {
  MessageSquare,
  Radio,
  Send,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Truck as TruckIcon,
  HardHat,
  CheckSquare,
  Square,
  Search,
  ShieldCheck,
} from 'lucide-react';
import { Truck, Driver, DispatcherDirectMessage } from '../types/dispatch';
import {
  getDispatcherMessages,
  sendDispatcherMessage,
  subscribeToDataChanges,
} from '../utils/storage';
import { subscribeToCloudDispatcherMessages } from '../utils/firebaseSync';
import { playClickSound } from '../utils/audio';

interface Props {
  trucks: Truck[];
  drivers: Driver[];
  preselectedTruckId?: string | null;
  onClearPreselectedTruck?: () => void;
}

const QUICK_INSTRUCTIONS = [
  'توجه فوراً لحفار EX08 - قطاع North Pit RL +140m لتحميل خام هاي جريد',
  'خفف السرعة عند منحدر الرامب الرئيسي لوجود أعمال تسوية طرق وجريدر',
  'انتقل لتفريغ الخام بالكسارة الأولية 01 لتغذية خط الإنتاج',
  'توجه لمحطة الوقود لتفويل السولار وإنهاء عملية التموين سريعاً',
  'توقف مؤقتاً في أقرب مكان آمن - جاري تجهيز أعمال تفجير بالمنجم',
  'يرجى الالتزام بالمسار الأيمن وتجنب التجاوز في المنحنيات الضيقة',
];

export const DispatcherMessengerWidget: React.FC<Props> = ({
  trucks,
  drivers,
  preselectedTruckId,
  onClearPreselectedTruck,
}) => {
  const [messages, setMessages] = useState<DispatcherDirectMessage[]>(getDispatcherMessages());
  const [targetTruckId, setTargetTruckId] = useState<string>(preselectedTruckId || 'ALL');
  const [selectedTruckIds, setSelectedTruckIds] = useState<string[]>([]);
  const [truckSearchQuery, setTruckSearchQuery] = useState('');
  const [priority, setPriority] = useState<'NORMAL' | 'URGENT' | 'CRITICAL'>('NORMAL');
  const [messageText, setMessageText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);

  // Sync when preselected truck changes
  useEffect(() => {
    if (preselectedTruckId) {
      setTargetTruckId(preselectedTruckId);
      setSelectedTruckIds([preselectedTruckId]);
      setIsExpanded(true);
    }
  }, [preselectedTruckId]);

  // Subscribe to real-time cloud updates over the internet
  useEffect(() => {
    const unsubCloud = subscribeToCloudDispatcherMessages((cloudMsgs) => {
      if (cloudMsgs && cloudMsgs.length > 0) {
        setMessages(cloudMsgs);
      }
    });

    const unsubLocal = subscribeToDataChanges(event => {
      if (event.type === 'DIRECT_MESSAGES_UPDATED') {
        setMessages(getDispatcherMessages());
      }
    });

    return () => {
      unsubCloud();
      unsubLocal();
    };
  }, []);

  const handleToggleTruck = (truckId: string) => {
    setSelectedTruckIds(prev =>
      prev.includes(truckId) ? prev.filter(id => id !== truckId) : [...prev, truckId]
    );
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!messageText.trim()) return;

    playClickSound();
    setIsSending(true);

    if (targetTruckId === 'MULTI_SELECTED') {
      if (selectedTruckIds.length === 0) {
        setIsSending(false);
        return;
      }
      selectedTruckIds.forEach(truckId => {
        const targetDriver = drivers.find(
          d => trucks.find(t => t.id === truckId)?.assignedDriver === d.code
        )?.name;
        sendDispatcherMessage(
          truckId,
          messageText.trim(),
          priority,
          'منسق غرفة التحكم (Dispatcher)',
          targetDriver
        );
      });
    } else {
      const targetDriver =
        targetTruckId !== 'ALL' && targetTruckId !== 'TRUCKS_ALL' && targetTruckId !== 'EXCAVATORS_ALL'
          ? drivers.find(d => trucks.find(t => t.id === targetTruckId)?.assignedDriver === d.code)?.name
          : undefined;

      sendDispatcherMessage(
        targetTruckId,
        messageText.trim(),
        priority,
        'منسق غرفة التحكم (Dispatcher)',
        targetDriver
      );
    }

    setMessageText('');
    setIsSending(false);
    if (onClearPreselectedTruck) onClearPreselectedTruck();
  };

  const handleSelectChip = (text: string) => {
    setMessageText(text);
    playClickSound();
  };

  return (
    <div className="mb-5 rounded-2xl border-2 border-indigo-500/40 bg-slate-900 shadow-xl overflow-hidden">
      {/* Header Bar */}
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className="p-4 bg-gradient-to-r from-indigo-950/70 via-slate-900 to-slate-900 flex flex-wrap items-center justify-between gap-3 cursor-pointer select-none"
      >
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-indigo-500/20 border-2 border-indigo-400 flex items-center justify-center text-indigo-400 font-bold shrink-0">
            <Radio className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-black text-base md:text-lg text-slate-100">
                دردشة وتعليمات المنسق الفورية (Instant Dispatcher Messenger)
              </h3>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-indigo-950 text-indigo-300 border border-indigo-500/30">
                إشعار منبثق فوري بكابينة السائق
              </span>
              <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded-full bg-teal-950/80 text-teal-300 border border-teal-500/40" title="المسار مشفر تشفيراً تاماً بتقنية AES-256-GCM">
                <ShieldCheck className="w-3 h-3 text-teal-400" />
                <span>مسار مشفر AES-256</span>
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              إرسال تعليمات نصية سريعة وموجهة تظهر كإشعار منبثق صوتي في واجهة DriverInCab مع تأكيد الاستلام
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 mr-auto md:mr-0">
          <span className="py-1 px-2.5 rounded-xl bg-indigo-500/20 border border-indigo-500/40 text-indigo-300 font-bold text-xs">
            {messages.length} تعليمات سابقة
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
        <div className="p-4 md:p-5 border-t border-slate-800 bg-slate-950/60 grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left Form: Compose Message (7 cols) */}
          <div className="lg:col-span-7 space-y-4">
            <form onSubmit={handleSendMessage} className="space-y-3.5">
              {/* Row 1: Target Selector & Priority */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    الموجه إليه (Target Equipment):
                  </label>
                  <select
                    value={targetTruckId}
                    onChange={(e) => {
                      setTargetTruckId(e.target.value);
                      if (e.target.value === 'MULTI_SELECTED' && selectedTruckIds.length === 0) {
                        setSelectedTruckIds(['DT001', 'DT002', 'DT003']);
                      }
                    }}
                    className="w-full py-2.5 px-3 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 text-xs font-bold font-mono focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="ALL">📢 تعميم عام لكل المعدات (دنابر + حفارات)</option>
                    <option value="TRUCKS_ALL">🚛 إرسال لكل الدنابر دفعة واحدة (60 دنبر: DT001-DT060)</option>
                    <option value="MULTI_SELECTED">☑️ تحديد عدة دنابر مخصصة (اختيار متعدد)...</option>
                    <option value="EXCAVATORS_ALL">🏗️ إرسال لكل الحفارات والشوافل (14 معدة تحميل)</option>
                    <optgroup label="── أو تحديد دنبر بعينه (تابلت منفصل) ──">
                      {trucks.map(t => (
                        <option key={t.id} value={t.id}>
                          دنبر {t.id} {t.assignedDriver ? `(سائق: ${t.assignedDriver})` : ''}
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    درجة الأهمية (Priority):
                  </label>
                  <div className="grid grid-cols-3 gap-1.5">
                    <button
                      type="button"
                      onClick={() => setPriority('NORMAL')}
                      className={`py-2 px-1 rounded-xl text-xs font-bold transition-colors cursor-pointer text-center ${
                        priority === 'NORMAL'
                          ? 'bg-indigo-600 text-white font-black'
                          : 'bg-slate-900 text-slate-400 border border-slate-800'
                      }`}
                    >
                      اعتيادية
                    </button>
                    <button
                      type="button"
                      onClick={() => setPriority('URGENT')}
                      className={`py-2 px-1 rounded-xl text-xs font-bold transition-colors cursor-pointer text-center ${
                        priority === 'URGENT'
                          ? 'bg-amber-500 text-slate-950 font-black'
                          : 'bg-slate-900 text-slate-400 border border-slate-800'
                      }`}
                    >
                      عاجلة
                    </button>
                    <button
                      type="button"
                      onClick={() => setPriority('CRITICAL')}
                      className={`py-2 px-1 rounded-xl text-xs font-bold transition-colors cursor-pointer text-center ${
                        priority === 'CRITICAL'
                          ? 'bg-rose-600 text-white font-black animate-pulse'
                          : 'bg-slate-900 text-slate-400 border border-slate-800'
                      }`}
                    >
                      طارئة جداً
                    </button>
                  </div>
                </div>
              </div>

              {/* Multi-Select Dumpers Grid (When MULTI_SELECTED is chosen) */}
              {targetTruckId === 'MULTI_SELECTED' && (
                <div className="p-3 bg-slate-900/90 border border-indigo-500/40 rounded-xl space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-300">
                      <CheckSquare className="w-4 h-4 text-indigo-400" />
                      <span>اختر الدنابر المستهدفة:</span>
                      <span className="px-2 py-0.5 rounded-full bg-indigo-600/30 text-indigo-200 border border-indigo-500/40 text-[11px] font-mono">
                        {selectedTruckIds.length} من {trucks.length}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 text-[11px]">
                      <button
                        type="button"
                        onClick={() => setSelectedTruckIds(trucks.map(t => t.id))}
                        className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold transition-colors"
                      >
                        الكل (60)
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedTruckIds(trucks.filter(t => t.status === 'ACTIVE').map(t => t.id))
                        }
                        className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-emerald-400 font-bold transition-colors"
                      >
                        النشطة فقط
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedTruckIds([])}
                        className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-rose-400 font-bold transition-colors"
                      >
                        مسح
                      </button>
                    </div>
                  </div>

                  {/* Search Bar */}
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute right-2.5 top-2.5 text-slate-500" />
                    <input
                      type="text"
                      value={truckSearchQuery}
                      onChange={(e) => setTruckSearchQuery(e.target.value)}
                      placeholder="بحث برقم الدنبر (مثال: DT014 أو 14)..."
                      className="w-full pr-8 pl-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  {/* Chips Grid */}
                  <div className="max-h-36 overflow-y-auto grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-1.5 p-1">
                    {trucks
                      .filter(t => !truckSearchQuery || t.id.toLowerCase().includes(truckSearchQuery.toLowerCase()))
                      .map(t => {
                        const isSelected = selectedTruckIds.includes(t.id);
                        return (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => handleToggleTruck(t.id)}
                            className={`py-1 px-1.5 rounded-lg text-xs font-mono font-bold flex items-center justify-between border transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-indigo-600 text-white border-indigo-400 shadow-sm'
                                : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-slate-200'
                            }`}
                          >
                            <span>{t.id}</span>
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                t.status === 'ACTIVE'
                                  ? 'bg-emerald-400'
                                  : t.status === 'BREAKDOWN'
                                  ? 'bg-rose-500'
                                  : 'bg-amber-400'
                              }`}
                            />
                          </button>
                        );
                      })}
                  </div>
                </div>
              )}

              {/* Quick Canned Instruction Chips */}
              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-1.5 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  تعليمات سريعة جاهزة (اضغط للإدراج المباشر):
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_INSTRUCTIONS.map((chip, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSelectChip(chip)}
                      className="py-1 px-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-indigo-500/50 text-[11px] text-slate-300 transition-colors text-right cursor-pointer"
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Text Area */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  نص التعليمات الموجهة:
                </label>
                <textarea
                  rows={3}
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  placeholder="اكتب التوجيهات هنا... ستظهر فوراً في تابلت الكابينة كإشعار منبثق عاجل مع صوت تنبيهي..."
                  className="w-full py-2.5 px-3 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 text-xs focus:border-indigo-500 focus:outline-none resize-none placeholder:text-slate-500"
                />
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={!messageText.trim() || isSending || (targetTruckId === 'MULTI_SELECTED' && selectedTruckIds.length === 0)}
                className="w-full py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-black text-xs md:text-sm flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/30 cursor-pointer active:scale-98 transition-transform"
              >
                <Send className="w-4 h-4" />
                <span>
                  {targetTruckId === 'MULTI_SELECTED'
                    ? `إرسال التعليمات المنبثقة إلى (${selectedTruckIds.length}) دنبر محدد 📡`
                    : targetTruckId === 'ALL'
                    ? 'إرسال لجميع المعدات (دنابر + حفارات) 📡'
                    : targetTruckId === 'TRUCKS_ALL'
                    ? 'إرسال لكل الدنابر الـ 60 دفعة واحدة 🚛'
                    : targetTruckId === 'EXCAVATORS_ALL'
                    ? 'إرسال لجميع الحفارات والشوافل 🏗️'
                    : `إرسال التعليمات الموجهة إلى دنبر ${targetTruckId} 📡`}
                </span>
              </button>
            </form>
          </div>

          {/* Right Stream: Recent Sent Instructions & Acknowledgment Status (5 cols) */}
          <div className="lg:col-span-5 border-t lg:border-t-0 lg:border-r border-slate-800 lg:pr-5">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-bold text-xs text-slate-200">
                سجل التعليمات المرسلة وحالة الاستلام:
              </h4>
              <span className="text-[10px] text-slate-500 font-mono">آخر 15 إشعار</span>
            </div>

            <div className="space-y-2.5 max-h-[340px] overflow-y-auto pr-1">
              {messages.length === 0 ? (
                <div className="text-center py-8 text-slate-500 text-xs">
                  لا توجد تعليمات مرسلة حتى الآن
                </div>
              ) : (
                messages.slice(0, 15).map(msg => (
                  <div
                    key={msg.id}
                    className={`p-3 rounded-xl border transition-all text-xs ${
                      msg.acknowledged
                        ? 'bg-slate-900/90 border-slate-800'
                        : 'bg-amber-950/20 border-amber-500/40'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-mono font-bold text-[11px] text-indigo-400 flex items-center gap-1">
                        <TruckIcon className="w-3.5 h-3.5" />
                        {msg.targetTruckId === 'ALL' ? 'تعميم عام' : msg.targetTruckId}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">
                        {new Date(msg.timestamp).toLocaleTimeString('ar-EG', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>

                    <p className="text-slate-200 font-medium leading-relaxed mb-2">
                      "{msg.messageText}"
                    </p>

                    <div className="flex items-center justify-between pt-1.5 border-t border-slate-800/80 text-[10px]">
                      <span className="text-slate-500">الأولوية: {msg.priority}</span>
                      {msg.acknowledged ? (
                        <span className="text-emerald-400 font-bold flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          تم الاستلام والتنفيذ بالتابلت ✅
                        </span>
                      ) : (
                        <span className="text-amber-400 font-bold flex items-center gap-1 animate-pulse">
                          <Clock className="w-3 h-3" />
                          بانتظار تأكيد السائق ⏳
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
