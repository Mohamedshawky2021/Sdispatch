import React, { useState, useRef } from 'react';
import {
  AlertTriangle,
  Wrench,
  CheckCircle2,
  Clock,
  X,
  Plus,
  Send,
  MessageSquare,
  Truck as TruckIcon,
  HardHat,
  Share2,
  Camera,
  Image as ImageIcon,
  Trash2,
  Maximize2,
} from 'lucide-react';
import { Truck, Excavator, EquipmentAlert, EquipmentStatusCode } from '../types/dispatch';
import { addEquipmentAlert, resolveEquipmentAlert, openWhatsAppShare } from '../utils/storage';
import { playClickSound, playLoadConfirmedSound, playDispatchAlertSound } from '../utils/audio';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  trucks: Truck[];
  excavators: Excavator[];
  alerts: EquipmentAlert[];
  onDataChanged: () => void;
  defaultTruckId?: string;
}

export const EquipmentStatusModal: React.FC<Props> = ({
  isOpen,
  onClose,
  trucks,
  excavators,
  alerts,
  onDataChanged,
  defaultTruckId,
}) => {
  const [targetType, setTargetType] = useState<'TRUCK' | 'LOADER'>('TRUCK');
  const [selectedId, setSelectedId] = useState<string>(defaultTruckId || trucks[0]?.id || 'DT001');
  const [status, setStatus] = useState<EquipmentStatusCode>('BREAKDOWN');
  const [reasonAr, setReasonAr] = useState('');
  const [reportedBy, setReportedBy] = useState('');
  const [severity, setSeverity] = useState<'INFO' | 'WARNING' | 'CRITICAL'>('CRITICAL');

  // Photo Attachment State
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  const [previewModalImage, setPreviewModalImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleImageFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const rawUrl = event.target?.result as string;
      const img = new Image();
      img.src = rawUrl;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_DIM = 960;
        let { width, height } = img;
        if (width > height) {
          if (width > MAX_DIM) {
            height = Math.round((height * MAX_DIM) / width);
            width = MAX_DIM;
          }
        } else {
          if (height > MAX_DIM) {
            width = Math.round((width * MAX_DIM) / height);
            height = MAX_DIM;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          setAttachedImage(canvas.toDataURL('image/jpeg', 0.75));
        } else {
          setAttachedImage(rawUrl);
        }
      };
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reasonAr.trim()) return;

    const newAlert: EquipmentAlert = {
      id: `EQ-ALT-${Date.now().toString().slice(-6)}`,
      equipmentId: selectedId,
      equipmentType: targetType,
      status,
      reasonAr: reasonAr.trim(),
      severity,
      reportedAt: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
      reportedBy: reportedBy.trim() || 'كابينة المعدة',
      resolved: false,
      imageUrl: attachedImage || undefined,
    };

    addEquipmentAlert(newAlert);
    playDispatchAlertSound();
    setReasonAr('');
    setAttachedImage(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    onDataChanged();
  };

  const handleResolve = (alertId: string) => {
    resolveEquipmentAlert(alertId);
    playLoadConfirmedSound();
    onDataChanged();
  };

  const handleShareAlertWhatsApp = (alert: EquipmentAlert) => {
    const text = `🚨 *تنبيه حالة معدة وبلاغ عطل — منجم السكري*
━━━━━━━━━━━━━━━━━━━━
🚜 *المعدة:* ${alert.equipmentId} (${alert.equipmentType === 'TRUCK' ? 'دنبر نقل' : 'معدة تحميل'})
⚠️ *الحالة:* ${alert.status === 'BREAKDOWN' ? 'عطل ميكانيكي متوقف' : alert.status === 'MAINTENANCE' ? 'صيانة دورية / كاوتش' : 'انتظار'}
📝 *السبب والبيان:* ${alert.reasonAr}
⏰ *وقت البلاغ:* ${alert.reportedAt}
👤 *المبلغ:* ${alert.reportedBy}
${alert.imageUrl ? '📸 *مرفق صورة توثيقية للعطل بالموقع*\n' : ''}━━━━━━━━━━━━━━━━━━━━
📡 _نظام دسباتش أسطول منجم السكري للذهب_`;
    openWhatsAppShare(text);
  };

  const activeAlerts = alerts.filter(a => !a.resolved);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl bg-slate-900 border border-amber-500/30 rounded-3xl p-5 md:p-6 shadow-2xl text-slate-100 max-h-[92vh] flex flex-col">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 left-4 p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          title="إغلاق"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 border-b border-slate-800 pb-4 mb-4 pl-8">
          <div className="p-2.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg md:text-xl font-black text-slate-100">
              تنبيهات وحالات المعدات والأعطال (Equipment Status & Delays)
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              تسجيل أعطال الدنابر (DT001-DT060) والحفارات، والإرسال المباشر لجروب الواتساب وتيمز
            </p>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto space-y-6">
          {/* Form to Report an Issue */}
          <form onSubmit={handleSubmit} className="p-4 bg-slate-950/70 border border-slate-800 rounded-2xl space-y-3">
            <h3 className="text-sm font-bold text-amber-400 flex items-center gap-2">
              <Plus className="w-4 h-4" /> تسجيل بلاغ عطل أو تغيير حالة معدة
            </h3>

            {/* Target Selection: Dump Truck or Loading Shovel */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-slate-400 block mb-1">نوع المعدة:</label>
                <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-900 border border-slate-800 rounded-xl">
                  <button
                    type="button"
                    onClick={() => {
                      setTargetType('TRUCK');
                      setSelectedId(trucks[0]?.id || 'DT001');
                      playClickSound();
                    }}
                    className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-1 ${
                      targetType === 'TRUCK'
                        ? 'bg-amber-500 text-slate-950 shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <TruckIcon className="w-3.5 h-3.5" />
                    <span>دنبر</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTargetType('LOADER');
                      setSelectedId(excavators[0]?.id || 'EX08');
                      playClickSound();
                    }}
                    className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-1 ${
                      targetType === 'LOADER'
                        ? 'bg-amber-500 text-slate-950 shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <HardHat className="w-3.5 h-3.5" />
                    <span>حفار/شوڤل</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">اختر كود المعدة:</label>
                <select
                  value={selectedId}
                  onChange={(e) => setSelectedId(e.target.value)}
                  className="w-full py-2 px-3 rounded-xl bg-slate-900 border border-slate-700 text-sm font-mono font-bold text-amber-400"
                >
                  {targetType === 'TRUCK'
                    ? trucks.map(t => (
                        <option key={t.id} value={t.id}>
                          {t.id} {t.status === 'BREAKDOWN' ? '⚠️ (معطل حالياً)' : ''}
                        </option>
                      ))
                    : excavators.map(ex => (
                        <option key={ex.id} value={ex.id}>
                          {ex.id} — {ex.model}
                        </option>
                      ))}
                </select>
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">الحالة الجديدة:</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as EquipmentStatusCode)}
                  className="w-full py-2 px-3 rounded-xl bg-slate-900 border border-slate-700 text-sm font-bold text-slate-100"
                >
                  <option value="BREAKDOWN">⚠️ عطل ميكانيكي / هيدروليك</option>
                  <option value="MAINTENANCE">🔧 صيانة دورية / فحص كاوتش</option>
                  <option value="STANDBY_QUEUE">⏳ طابور انتظار / زحمة</option>
                  <option value="BLASTING_WAIT">💥 متوقف لأعمال التفجير</option>
                  <option value="ACTIVE">✅ سليم وجاهز للخدمة</option>
                </select>
              </div>
            </div>

            {/* Reason Text & Reporter */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="text-xs text-slate-400 block mb-1">وصف العطل أو سبب التوقف بالتفصيل:</label>
                <input
                  type="text"
                  value={reasonAr}
                  onChange={(e) => setReasonAr(e.target.value)}
                  placeholder="مثال: تسريب زيت في بستم الرفع الأيمن / ارتفاع حرارة المحرك..."
                  className="w-full py-2 px-3 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-100 placeholder:text-slate-500"
                  required
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">اسم السائق / المبلغ:</label>
                <input
                  type="text"
                  value={reportedBy}
                  onChange={(e) => setReportedBy(e.target.value)}
                  placeholder="سائق المعدة أو مشرف الصيانة"
                  className="w-full py-2 px-3 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-100"
                />
              </div>
            </div>

            {/* Photo Attachment (Camera / Gallery) */}
            <div className="p-3 bg-slate-900/90 border border-slate-800 rounded-2xl flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  capture="environment"
                  onChange={handleImageFileSelect}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="py-2 px-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 hover:text-amber-200 border border-amber-500/30 text-xs font-bold flex items-center gap-2 cursor-pointer transition-colors shadow-sm"
                >
                  <Camera className="w-4 h-4 text-amber-400" />
                  <span>{attachedImage ? 'تغيير صورة العطل' : '📷 إرفاق صورة العطل (كاميرا / ألبوم)'}</span>
                </button>

                {attachedImage ? (
                  <div className="flex items-center gap-2 bg-slate-950 py-1 px-2.5 rounded-xl border border-emerald-500/40">
                    <img
                      src={attachedImage}
                      alt="معاينة الصورة"
                      onClick={() => setPreviewModalImage(attachedImage)}
                      className="w-8 h-8 rounded-lg object-cover border border-slate-700 cursor-pointer hover:scale-105 transition-transform"
                    />
                    <span className="text-[11px] text-emerald-400 font-bold">تم إرفاق الصورة بنجاح</span>
                    <button
                      type="button"
                      onClick={() => {
                        setAttachedImage(null);
                        if (fileInputRef.current) fileInputRef.current.value = '';
                      }}
                      className="p-1 text-slate-400 hover:text-rose-400 transition-colors"
                      title="إزالة الصورة"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <span className="text-[11px] text-slate-500">
                    يمكن تصوير الكاوتش أو البستم أو مكان العطل مباشرة بالتابلت
                  </span>
                )}
              </div>

              <button
                type="submit"
                className="py-2.5 px-5 rounded-xl font-bold bg-rose-600 hover:bg-rose-500 text-white text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-md"
              >
                <AlertTriangle className="w-4 h-4" />
                تسجيل البلاغ وتحديث حالة المعدة
              </button>
            </div>
          </form>

          {/* Active Equipment Issues List */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                <span>المعدات المتوقفة والأعطال النشطة حالياً</span>
                <span className="text-xs py-0.5 px-2 rounded-full bg-rose-950 text-rose-300 border border-rose-500/40 font-mono">
                  {activeAlerts.length} معدة
                </span>
              </h3>
            </div>

            {activeAlerts.length === 0 ? (
              <div className="p-8 text-center bg-slate-950/40 border border-slate-800 rounded-2xl text-slate-400">
                <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2 opacity-80" />
                <p className="font-bold text-sm text-slate-300">جميع المعدات والدنابر في حالة تشغيل ممتازة</p>
                <p className="text-xs text-slate-500 mt-1">لا توجد بلاغات أعطال أو توقفات مسجلة حالياً</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {activeAlerts.map((alert) => (
                  <div
                    key={alert.id}
                    className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 hover:border-slate-700 transition-colors flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                  >
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-xl shrink-0 mt-0.5 ${
                        alert.status === 'BREAKDOWN'
                          ? 'bg-rose-950/80 text-rose-400 border border-rose-500/40'
                          : alert.status === 'MAINTENANCE'
                          ? 'bg-amber-950/80 text-amber-400 border border-amber-500/40'
                          : 'bg-purple-950/80 text-purple-400 border border-purple-500/40'
                      }`}>
                        {alert.status === 'MAINTENANCE' ? <Wrench className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
                      </div>

                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-black text-sm text-amber-400 font-mono">{alert.equipmentId}</span>
                          <span className="text-[10px] font-bold py-0.5 px-2 rounded-md bg-slate-800 text-slate-300">
                            {alert.status === 'BREAKDOWN' ? 'عطل ميكانيكي' : alert.status === 'MAINTENANCE' ? 'صيانة دورية' : 'توقف مؤقت'}
                          </span>
                          <span className="text-[11px] text-slate-500 font-mono">الساعة: {alert.reportedAt}</span>

                          {alert.imageUrl && (
                            <span className="text-[10px] py-0.5 px-2 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-500/40 flex items-center gap-1 font-bold">
                              <Camera className="w-3 h-3 text-emerald-400" />
                              <span>مرفق صورة</span>
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-200 mt-1 font-medium">{alert.reasonAr}</p>
                        <span className="text-[11px] text-slate-400 block mt-0.5">المبلغ: {alert.reportedBy}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
                      {alert.imageUrl && (
                        <button
                          type="button"
                          onClick={() => setPreviewModalImage(alert.imageUrl!)}
                          className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 transition-colors cursor-pointer"
                          title="عرض الصورة المرفقة بالحجم الكامل"
                        >
                          <img
                            src={alert.imageUrl}
                            alt="صورة العطل"
                            className="w-8 h-8 rounded-lg object-cover"
                          />
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => handleShareAlertWhatsApp(alert)}
                        className="flex-1 sm:flex-none py-1.5 px-3 rounded-xl bg-emerald-950/60 hover:bg-emerald-900 text-emerald-300 border border-emerald-500/30 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                        title="إرسال إلى واتساب"
                      >
                        <Share2 className="w-3.5 h-3.5" />
                        <span>واتساب</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleResolve(alert.id)}
                        className="flex-1 sm:flex-none py-1.5 px-3.5 rounded-xl bg-slate-800 hover:bg-emerald-700 text-slate-200 hover:text-white border border-slate-700 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span>إصلاح وجاهز</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* High-Resolution Image Lightbox Modal */}
      {previewModalImage && (
        <div className="fixed inset-0 z-60 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="relative max-w-2xl w-full bg-slate-900 border border-slate-700 rounded-3xl p-4 shadow-2xl flex flex-col items-center">
            <div className="w-full flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-200">
                <Camera className="w-4 h-4 text-amber-400" />
                <span>صورة توثيق العطل المرفقة بالبلاغ</span>
              </div>
              <button
                type="button"
                onClick={() => setPreviewModalImage(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <img
              src={previewModalImage}
              alt="صورة العطل بحجم كامل"
              className="max-h-[75vh] w-auto max-w-full rounded-2xl object-contain border border-slate-800"
            />
          </div>
        </div>
      )}
    </div>
  );
};
