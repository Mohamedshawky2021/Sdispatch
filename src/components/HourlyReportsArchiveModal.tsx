import React, { useState } from 'react';
import {
  FileSpreadsheet,
  Download,
  Clock,
  CheckCircle2,
  X,
  Share2,
  Copy,
  Check,
  Send,
  MessageSquare,
} from 'lucide-react';
import {
  HourlyExportSnapshot,
  downloadCSV,
  openWhatsAppShare,
  shareExcelReportToWhatsApp,
  sendTeamsWebhookMessage,
  getAppConfig,
  OFFICIAL_SUKARI_WHATSAPP_GROUP,
} from '../utils/storage';
import { playClickSound, playLoadConfirmedSound } from '../utils/audio';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  exports: HourlyExportSnapshot[];
  onTriggerNow: () => void;
}

export const HourlyReportsArchiveModal: React.FC<Props> = ({
  isOpen,
  onClose,
  exports,
  onTriggerNow,
}) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [sharingWhatsAppId, setSharingWhatsAppId] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleDownload = (item: HourlyExportSnapshot) => {
    const filename = `تقرير_ساعي_منجم_السكري_${item.hourLabel.replace(':', '_')}.csv`;
    downloadCSV(item.csvContent, filename);
  };

  const handleWhatsApp = async (item: HourlyExportSnapshot) => {
    playClickSound();
    setSharingWhatsAppId(item.id);
    await shareExcelReportToWhatsApp(item);
    setTimeout(() => setSharingWhatsAppId(null), 1500);
  };

  const handleCopy = (item: HourlyExportSnapshot) => {
    playClickSound();
    navigator.clipboard.writeText(item.whatsappMessage);
    setCopiedId(item.id);
    setTimeout(() => setCopiedId(null), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl bg-slate-900 border border-amber-500/30 rounded-3xl p-5 md:p-6 shadow-2xl text-slate-100 max-h-[92vh] flex flex-col">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 left-4 p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          title="إغلاق"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex flex-wrap items-center justify-between border-b border-slate-800 pb-4 mb-4 gap-3 pl-8">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg md:text-xl font-black text-slate-100">
                تقارير الساعات التلقائية والمشاركة الميدانية
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                تصدير ومشاركة فورية لتقارير الساعات عبر واتساب وMicrosoft Teams وExcel
              </p>
            </div>
          </div>

          <button
            onClick={onTriggerNow}
            className="py-2 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer"
          >
            <Clock className="w-4 h-4" />
            تصدير فوري لهذه الساعة
          </button>
        </div>

        {/* Official WhatsApp Group Banner */}
        <div className="mb-4 bg-emerald-950/40 border border-emerald-500/40 rounded-2xl p-3 px-4 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-600/30 border border-emerald-500/40 flex items-center justify-center text-emerald-400 font-bold shrink-0">
              💬
            </div>
            <div>
              <div className="font-bold text-emerald-300">
                جروب واتساب العمل المعتمد (منجم السكري):
              </div>
              <a
                href={OFFICIAL_SUKARI_WHATSAPP_GROUP}
                target="_blank"
                rel="noreferrer"
                className="text-[11px] font-mono text-emerald-400 hover:underline break-all"
              >
                {OFFICIAL_SUKARI_WHATSAPP_GROUP}
              </a>
            </div>
          </div>
          <a
            href={OFFICIAL_SUKARI_WHATSAPP_GROUP}
            target="_blank"
            rel="noreferrer"
            className="py-1.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1 transition-colors shadow-sm cursor-pointer shrink-0"
          >
            <span>فتح الجروب مباشرة 🚀</span>
          </a>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto space-y-3 pr-1">
          {exports.length === 0 ? (
            <div className="py-16 text-center text-slate-400">
              <Clock className="w-12 h-12 mx-auto mb-3 text-slate-600 animate-pulse" />
              <p className="text-base font-bold text-slate-300">لم يتم تصدير تقارير بعد في هذه الوردية</p>
              <p className="text-xs text-slate-500 mt-1">
                سيبدأ النظام بالتصدير التلقائي عند حلول تمام الساعة القادمة، أو يمكنك الضغط على "تصدير فوري" بالأعلى.
              </p>
            </div>
          ) : (
            exports.map((item) => (
              <div
                key={item.id}
                className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 hover:border-slate-700 transition-colors flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4"
              >
                <div className="flex items-start gap-3">
                  <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 shrink-0 mt-0.5">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-black text-base text-slate-100 font-mono text-amber-400">
                        تقرير الساعة {item.hourLabel}
                      </span>
                      <span className="text-[11px] py-0.5 px-2 rounded-md bg-slate-800 text-slate-300 border border-slate-700 font-mono">
                        {item.totalTripsThisHour} نقلات بالساعة
                      </span>
                      <span className="text-[11px] text-slate-500 font-mono">
                        {new Date(item.timestamp).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <div className="text-xs text-slate-300 mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
                      <span>إجمالي الحمولة بالساعة: <strong className="text-amber-400 font-mono">{item.totalTonnesThisHour.toLocaleString()} طن</strong> (152t/نقلة)</span>
                      <span>خام: <strong className="text-emerald-400 font-mono">{item.oreTonnesThisHour.toLocaleString()} طن</strong></span>
                      {item.subGradeTonnesThisHour ? (
                        <span>سب جريد: <strong className="text-teal-400 font-mono">{item.subGradeTonnesThisHour.toLocaleString()} طن</strong></span>
                      ) : null}
                      <span>صخور عقيمة: <strong className="text-slate-400 font-mono">{item.wasteTonnesThisHour.toLocaleString()} طن</strong></span>
                      <span>دنابر نشطة: <strong className="text-sky-400 font-mono">{item.activeTrucksCount}</strong></span>
                      <span>التراكمي: <strong className="text-amber-300 font-mono">{item.cumulativeShiftTonnes.toLocaleString()} طن</strong></span>
                    </div>
                  </div>
                </div>

                {/* Action Buttons: WhatsApp, Teams, Copy, Excel */}
                <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-800/80">
                  {/* WhatsApp */}
                  <button
                    onClick={() => handleWhatsApp(item)}
                    disabled={sharingWhatsAppId === item.id}
                    className="py-2 px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm disabled:opacity-50"
                    title="إرسال شيت الإكسيل والتقرير لجروب الواتساب المعتمد"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    <span>{sharingWhatsAppId === item.id ? 'جاري الإرسال...' : 'إرسال للجروب (إكسيل) 📲'}</span>
                  </button>

                  {/* Copy Text */}
                  <button
                    onClick={() => handleCopy(item)}
                    className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                    title="نسخ نص التقرير"
                  >
                    {copiedId === item.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedId === item.id ? 'تم النسخ!' : 'نسخ'}</span>
                  </button>

                  {/* Download CSV */}
                  <button
                    onClick={() => handleDownload(item)}
                    className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                    title="تنزيل ملف CSV"
                  >
                    <Download className="w-3.5 h-3.5 text-amber-400" />
                    <span>Excel</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
