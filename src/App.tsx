import React, { useState, useEffect, useCallback } from 'react';
import { HeaderNav } from './components/HeaderNav';
import { DriverInCab } from './components/DriverInCab';
import { DispatcherControlRoom } from './components/DispatcherControlRoom';
import { MobileInstallModal } from './components/MobileInstallModal';
import { AdminDatabaseModal } from './components/AdminDatabaseModal';
import { HourlyReportsArchiveModal } from './components/HourlyReportsArchiveModal';
import { EquipmentStatusModal } from './components/EquipmentStatusModal';
import { PerformanceDashboard } from './components/PerformanceDashboard';
import {
  Driver,
  Truck,
  Excavator,
  DumpLocation,
  TripLog,
  DispatchAlert,
  EquipmentAlert,
} from './types/dispatch';
import {
  getStoredDrivers,
  getStoredTrucks,
  getStoredExcavators,
  getStoredDumps,
  getStoredTrips,
  getStoredHourlyExports,
  getStoredDispatchAlerts,
  getStoredEquipmentAlerts,
  getPendingSyncCount,
  syncPendingOfflineData,
  subscribeToDataChanges,
  HourlyExportSnapshot,
  openWhatsAppShare,
  shareExcelReportToWhatsApp,
  OFFICIAL_SUKARI_WHATSAPP_GROUP,
  getAssignedTabletTruck,
  pullCloudMasterData,
} from './utils/storage';
import {
  getTimeUntilNextHour,
  checkAndTriggerHourlyExport,
} from './utils/hourlySyncEngine';
import { triggerBackgroundSheetsSync } from './utils/googleSheets';
import { playDispatchAlertSound } from './utils/audio';

export default function App() {
  const [activeView, setActiveView] = useState<'CAB' | 'CONTROL' | 'DASHBOARD'>('CAB');

  // Operational Data States
  const [drivers, setDrivers] = useState<Driver[]>(getStoredDrivers());
  const [trucks, setTrucks] = useState<Truck[]>(getStoredTrucks());
  const [excavators, setExcavators] = useState<Excavator[]>(getStoredExcavators());
  const [dumps, setDumps] = useState<DumpLocation[]>(getStoredDumps());
  const [trips, setTrips] = useState<TripLog[]>(getStoredTrips());
  const [hourlyExports, setHourlyExports] = useState<HourlyExportSnapshot[]>(getStoredHourlyExports());
  const [alerts, setAlerts] = useState<DispatchAlert[]>(getStoredDispatchAlerts());
  const [equipmentAlerts, setEquipmentAlerts] = useState<EquipmentAlert[]>(getStoredEquipmentAlerts());

  // Modals
  const [isMobileModalOpen, setIsMobileModalOpen] = useState(false);
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [isHourlyArchiveOpen, setIsHourlyArchiveOpen] = useState(false);
  const [isEquipmentModalOpen, setIsEquipmentModalOpen] = useState(false);
  const [equipmentModalTruckId, setEquipmentModalTruckId] = useState<string | undefined>(undefined);

  // Hourly Countdown Timer State
  const [nextHourFormatted, setNextHourFormatted] = useState<string>('60:00');

  // Online / Offline & Auto-sync queue status
  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [pendingSyncCount, setPendingSyncCount] = useState<number>(getPendingSyncCount());

  // Success Toast for Hourly Sync
  const [syncToast, setSyncToast] = useState<{ title: string; subtitle: string; whatsappText?: string } | null>(null);

  // Reload all data from local storage
  const reloadData = useCallback(() => {
    setDrivers(getStoredDrivers());
    setTrucks(getStoredTrucks());
    setExcavators(getStoredExcavators());
    setDumps(getStoredDumps());
    setTrips(getStoredTrips());
    setHourlyExports(getStoredHourlyExports());
    setAlerts(getStoredDispatchAlerts());
    setEquipmentAlerts(getStoredEquipmentAlerts());
    setPendingSyncCount(getPendingSyncCount());
  }, []);

  // Listen to network online/offline events for auto-syncing queued data
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      const res = syncPendingOfflineData();
      reloadData();
      if (res.syncedTrips > 0 || res.syncedHandovers > 0) {
        setSyncToast({
          title: '📶 تم التقاط إشارة الإنترنت ومزامنة البيانات!',
          subtitle: `تم إرسال ${res.syncedTrips} حمولة و ${res.syncedHandovers} تقرير تسليم وردية بنجاح إلى النظام المركزي`,
        });
        setTimeout(() => setSyncToast(null), 8000);
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [reloadData]);

  // Subscribe to multi-tab / multi-device BroadcastChannel
  useEffect(() => {
    const unsubscribe = subscribeToDataChanges((event) => {
      reloadData();
      if (event.type === 'HOURLY_EXPORT_ADDED') {
        const snap = event.payload as HourlyExportSnapshot;
        setSyncToast({
          title: `تم إرسال وتصدير تقرير الساعة ${snap?.hourLabel || ''} بنجاح 📡`,
          subtitle: `إجمالي الحمولات: ${snap?.totalTonnesThisHour || 0} طن (${snap?.totalTripsThisHour || 0} نقلة)`,
          whatsappText: snap?.whatsappMessage,
        });
        setTimeout(() => setSyncToast(null), 8000);
      }
      if (event.type === 'OFFLINE_SYNC_COMPLETED') {
        const payload = event.payload as { syncedTrips: number; syncedHandovers: number };
        setSyncToast({
          title: '📶 تم التقاط النت ومزامنة بيانات الوردية!',
          subtitle: `تم إرسال ${payload?.syncedTrips || 0} حمولة و ${payload?.syncedHandovers || 0} تقرير تسليم وردية بنجاح`,
        });
        setTimeout(() => setSyncToast(null), 8000);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [reloadData]);

  // Hourly Timer and Auto-Export Check Engine
  useEffect(() => {
    const interval = setInterval(() => {
      const { minutes, seconds, formatted } = getTimeUntilNextHour();
      setNextHourFormatted(formatted);

      // Check if it's top of the hour (:00:00)
      if (minutes === 0 && seconds === 0) {
        const snap = checkAndTriggerHourlyExport(false);
        if (snap) {
          reloadData();
          setSyncToast({
            title: `تم التصدير الساعي التلقائي للساعة ${snap.hourLabel} 📡`,
            subtitle: `تم تصدير وتنزيل ملف Excel بحمولة ${snap.totalTonnesThisHour} طن`,
            whatsappText: snap.whatsappMessage,
          });
          setTimeout(() => setSyncToast(null), 8000);
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [reloadData]);

  // Screen Keep-Awake WakeLock: Keep tablet active and screen turned ON inside driver cab
  useEffect(() => {
    let wakeLockSentinel: any = null;

    const requestWakeLock = async () => {
      try {
        if ('wakeLock' in navigator && (navigator as any).wakeLock) {
          wakeLockSentinel = await (navigator as any).wakeLock.request('screen');
        }
      } catch {
        // WakeLock may not be permitted in non-HTTPS or non-focused tabs
      }
    };

    requestWakeLock();

    // Auto-resync when tablet wakes up or screen turns back on
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        requestWakeLock();
        // Immediately fetch latest master data and trigger background sync
        pullCloudMasterData().then((res) => {
          if (res.syncedItems.length > 0) reloadData();
        });
        triggerBackgroundSheetsSync().catch(() => {});
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (wakeLockSentinel && typeof wakeLockSentinel.release === 'function') {
        wakeLockSentinel.release();
      }
    };
  }, [reloadData]);

  // Periodic 60-second background sync for Admin master data and Google Sheets
  useEffect(() => {
    // Initial fetch on app start
    pullCloudMasterData().then((res) => {
      if (res.syncedItems.length > 0) reloadData();
    });

    const interval60s = setInterval(() => {
      pullCloudMasterData().then((res) => {
        if (res.syncedItems.length > 0) {
          reloadData();
        }
      });
      // Background sync to Google Sheets if spreadsheet is linked
      triggerBackgroundSheetsSync().catch(() => {});
    }, 60000);

    return () => clearInterval(interval60s);
  }, [reloadData]);

  // Force Manual Hourly Sync Trigger
  const handleForceHourlySync = () => {
    const snap = checkAndTriggerHourlyExport(true);
    if (snap) {
      reloadData();
      playDispatchAlertSound();
      setSyncToast({
        title: `تم التصدير الساعي الفوري للساعة ${snap.hourLabel} 🚀`,
        subtitle: `تم تنزيل ملف Excel يحتوي على ${snap.totalTripsThisHour} نقلة بإجمالي ${snap.totalTonnesThisHour} طن`,
        whatsappText: snap.whatsappMessage,
      });
      setTimeout(() => setSyncToast(null), 8000);
    }
  };

  const activeBreakdownsCount = equipmentAlerts.filter(a => !a.resolved && (a.status === 'BREAKDOWN' || a.status === 'MAINTENANCE')).length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-amber-500 selection:text-slate-950">
      {/* Top Navigation */}
      <HeaderNav
        activeView={activeView}
        onViewChange={setActiveView}
        onOpenMobileModal={() => setIsMobileModalOpen(true)}
        onOpenAdmin={() => setIsAdminModalOpen(true)}
        onOpenHourlyArchive={() => setIsHourlyArchiveOpen(true)}
        onOpenEquipmentAlerts={() => setIsEquipmentModalOpen(true)}
        activeBreakdownsCount={activeBreakdownsCount}
        nextHourFormatted={nextHourFormatted}
        isOnline={isOnline}
        pendingSyncCount={pendingSyncCount}
      />

      {/* Global Auto-Sync Toast Notification with Direct WhatsApp Share */}
      {syncToast && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-slate-900 border-2 border-emerald-500 text-slate-100 px-5 py-3.5 rounded-2xl font-bold shadow-2xl flex flex-wrap items-center justify-between gap-3 text-sm animate-in fade-in slide-in-from-top-4 duration-300 max-w-xl">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 shrink-0">
              📊
            </div>
            <div>
              <div className="text-emerald-400 font-bold">{syncToast.title}</div>
              <div className="text-xs text-slate-300 font-normal mt-0.5">{syncToast.subtitle}</div>
            </div>
          </div>

          {syncToast.whatsappText && (
            <button
              onClick={() => openWhatsAppShare(syncToast.whatsappText!)}
              className="py-1.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-colors cursor-pointer shadow-md shrink-0 flex items-center gap-1.5"
              title="إرسال التقرير الساعي لجروب واتساب العمل منجم السكري"
            >
              <span>إرسال لجروب واتساب 📲</span>
            </button>
          )}
        </div>
      )}

      {/* Main View Router */}
      <main className="flex-1 flex flex-col">
        {activeView === 'CAB' ? (
          <DriverInCab
            drivers={drivers}
            trucks={trucks}
            excavators={excavators}
            dumps={dumps}
            onForceSync={handleForceHourlySync}
            nextHourFormatted={nextHourFormatted}
            onOpenMobileModal={() => setIsMobileModalOpen(true)}
            onOpenHourlyArchive={() => setIsHourlyArchiveOpen(true)}
            onOpenAdmin={() => setIsAdminModalOpen(true)}
            onOpenEquipmentAlerts={() => setIsEquipmentModalOpen(true)}
          />
        ) : activeView === 'CONTROL' ? (
          <DispatcherControlRoom
            drivers={drivers}
            trucks={trucks}
            excavators={excavators}
            dumps={dumps}
            trips={trips}
            alerts={alerts}
            equipmentAlerts={equipmentAlerts}
            onAlertsChanged={setAlerts}
            nextHourFormatted={nextHourFormatted}
            onForceHourlySync={handleForceHourlySync}
            onOpenAdmin={() => setIsAdminModalOpen(true)}
            onOpenMobileModal={() => setIsMobileModalOpen(true)}
            onOpenHourlyArchive={() => setIsHourlyArchiveOpen(true)}
            onOpenEquipmentAlerts={() => setIsEquipmentModalOpen(true)}
            onNavigateToDashboard={() => setActiveView('DASHBOARD')}
          />
        ) : (
          <PerformanceDashboard
            trips={trips}
            trucks={trucks}
            excavators={excavators}
            dumps={dumps}
            alerts={equipmentAlerts}
            onBackToControl={() => setActiveView('CONTROL')}
          />
        )}
      </main>

      {/* Modals */}
      <MobileInstallModal
        isOpen={isMobileModalOpen}
        onClose={() => setIsMobileModalOpen(false)}
      />

      <AdminDatabaseModal
        isOpen={isAdminModalOpen}
        onClose={() => setIsAdminModalOpen(false)}
        onDataChanged={reloadData}
      />

      <HourlyReportsArchiveModal
        isOpen={isHourlyArchiveOpen}
        onClose={() => setIsHourlyArchiveOpen(false)}
        exports={hourlyExports}
        onTriggerNow={handleForceHourlySync}
      />

      <EquipmentStatusModal
        isOpen={isEquipmentModalOpen}
        onClose={() => {
          setIsEquipmentModalOpen(false);
          setEquipmentModalTruckId(undefined);
        }}
        trucks={trucks}
        excavators={excavators}
        alerts={equipmentAlerts}
        onDataChanged={reloadData}
        defaultTruckId={equipmentModalTruckId || getAssignedTabletTruck() || undefined}
      />
    </div>
  );
}
