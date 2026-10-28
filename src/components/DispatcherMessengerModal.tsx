import React from 'react';
import { X, Radio, MessageSquare } from 'lucide-react';
import { Truck, Driver } from '../types/dispatch';
import { DispatcherMessengerWidget } from './DispatcherMessengerWidget';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  trucks: Truck[];
  drivers: Driver[];
  preselectedTruckId?: string | null;
  onClearPreselectedTruck?: () => void;
}

export const DispatcherMessengerModal: React.FC<Props> = ({
  isOpen,
  onClose,
  trucks,
  drivers,
  preselectedTruckId,
  onClearPreselectedTruck,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-5 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl max-h-[92vh] bg-slate-900 border-2 border-indigo-500/50 rounded-3xl shadow-2xl flex flex-col overflow-hidden text-slate-100">
        {/* Header Bar */}
        <div className="p-4 md:p-5 bg-gradient-to-r from-indigo-950/80 via-slate-900 to-slate-900 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 border-2 border-indigo-500 flex items-center justify-center text-indigo-400 font-bold shrink-0">
              <MessageSquare className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg md:text-xl font-black text-white">
                  إرسال تعليمات ورسائل للدنابر والأسطول (Direct Truck Messenger)
                </h3>
                <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-indigo-950 text-indigo-300 border border-indigo-500/40">
                  إشعار منبثق صوتي في كابينة السائق
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                توجيه تعليمات نصية سريعة وموجهة لشاحنة معينة أو لعدة شاحنات أو للأسطول بالكامل مع فك تشفير وتلاوة صوتية فورية
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

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-3 md:p-5 bg-slate-950/60">
          <DispatcherMessengerWidget
            trucks={trucks}
            drivers={drivers}
            preselectedTruckId={preselectedTruckId}
            onClearPreselectedTruck={onClearPreselectedTruck}
          />
        </div>
      </div>
    </div>
  );
};
