import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Smartphone, Download, Share2, Check, Copy, X, WifiOff, ShieldCheck } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const MobileInstallModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();

  const currentUrl = typeof window !== 'undefined' ? window.location.href : '';

  useEffect(() => {
    if (isOpen && currentUrl) {
      QRCode.toDataURL(currentUrl, {
        width: 240,
        margin: 2,
        color: {
          dark: '#0f172a',
          light: '#f8fafc',
        },
      })
        .then(url => setQrDataUrl(url))
        .catch(err => console.error('QR Gen error:', err));
    }
  }, [isOpen, currentUrl]);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(currentUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleInstallClick = async () => {
    await install();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-slate-900 border border-amber-500/30 rounded-2xl p-6 shadow-2xl text-slate-100 max-h-[92vh] overflow-y-auto">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 left-4 p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          title="إغلاق"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="text-center mb-6 pt-1">
          <div className="inline-flex p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 mb-3">
            <Smartphone className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-slate-100">تشغيل وتثبيت التطبيق على التليفون والتابلت</h2>
          <p className="text-sm text-slate-400 mt-1">
            امسح الكود بكاميرا الموبايل لفتح واستخدام دسباتش منجم السكري مباشرة
          </p>
        </div>

        {/* QR Code Container */}
        <div className="flex flex-col items-center justify-center p-4 bg-slate-950 border border-slate-800 rounded-xl mb-5">
          {qrDataUrl ? (
            <div className="p-2 bg-white rounded-xl shadow-md">
              <img src={qrDataUrl} alt="QR Code لفتح النظام على الهاتف" className="w-48 h-48 block" />
            </div>
          ) : (
            <div className="w-48 h-48 flex items-center justify-center text-slate-500">جاري إنشاء QR Code...</div>
          )}

          <span className="text-xs text-amber-400 font-medium mt-3 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            رابط مباشر للمعاينة والاستخدام الميداني الكامل
          </span>
        </div>

        {/* One-click install prompt if on mobile browser */}
        {isInstallable && !isInstalled && (
          <div className="mb-5 p-3.5 bg-amber-500/10 border border-amber-500/40 rounded-xl text-center">
            <p className="text-sm font-semibold text-amber-300 mb-2">متصفحك يدعم تثبيت التطبيق بضغطة زر واحدة:</p>
            <button
              onClick={handleInstallClick}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 transition-colors shadow-lg shadow-amber-500/20 active:scale-98"
            >
              <Download className="w-5 h-5" />
              تثبيت التطبيق على الجهاز الآن (Install PWA)
            </button>
          </div>
        )}

        {/* Guided Steps for Android & iPhone */}
        <div className="space-y-3 mb-5">
          <div className="p-3 bg-slate-800/60 border border-slate-700/60 rounded-xl text-sm">
            <div className="font-bold text-amber-400 flex items-center gap-2 mb-1">
              <span>📱</span> هواتف أندرويد وتابلت كابينة المعدات (Google Chrome):
            </div>
            <p className="text-slate-300 text-xs leading-relaxed">
              افتح الرابط في كروم، اضغط على زر القائمة <span className="text-amber-300 font-bold">⋮</span> بأعلى الشاشة، ثم اختر <span className="text-emerald-400 font-bold">"تثبيت التطبيق" (Install App)</span> أو <span className="text-emerald-400 font-bold">"إضافة إلى الشاشة الرئيسية"</span>.
            </p>
          </div>

          <div className="p-3 bg-slate-800/60 border border-slate-700/60 rounded-xl text-sm">
            <div className="font-bold text-amber-400 flex items-center gap-2 mb-1">
              <span>🍏</span> هواتف آيفون وأجهزة آيباد (Apple Safari):
            </div>
            <p className="text-slate-300 text-xs leading-relaxed">
              افتح الرابط في سفاري، اضغط على زر المشاركة <Share2 className="w-3.5 h-3.5 inline mx-1 text-sky-400" /> بأسفل الشاشة، ثم مرر لأسفل واختر <span className="text-emerald-400 font-bold">"إضافة إلى الصفحة الرئيسية" (Add to Home Screen)</span>.
            </p>
          </div>

          <div className="p-3 bg-emerald-950/40 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 flex items-start gap-2">
            <WifiOff className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
            <div>
              <strong>يعمل بدون إنترنت (Offline Ready):</strong> بعد التثبيت، يحفظ التطبيق البيانات محلياً حتى في أعماق حفرة المنجم التي ينقطع بها إرسال الشبكة.
            </div>
          </div>
        </div>

        {/* Share & Copy Link */}
        <div className="flex items-center gap-2">
          <input
            type="text"
            readOnly
            value={currentUrl}
            className="flex-1 bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-xs text-slate-300 font-mono truncate text-left"
            dir="ltr"
          />
          <button
            onClick={handleCopy}
            className="shrink-0 flex items-center gap-1.5 py-2 px-4 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors border border-slate-700"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            {copied ? 'تم النسخ!' : 'نسخ الرابط'}
          </button>
        </div>
      </div>
    </div>
  );
};
