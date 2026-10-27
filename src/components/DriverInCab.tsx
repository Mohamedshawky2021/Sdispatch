import React, { useState, useEffect } from 'react';
import {
  Truck as TruckIcon,
  HardHat,
  Mountain,
  Clock,
  LogOut,
  Send,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  Layers,
  CheckCircle2,
  Wifi,
  WifiOff,
  ArrowRight,
  Check,
  X,
  Lock,
  Unlock,
  Battery,
  BatteryCharging,
  BatteryWarning,
  Zap,
  ZapOff,
  Fuel,
  Radio,
  FileSpreadsheet,
  MapPin,
  AlertOctagon,
  BarChart3,
} from 'lucide-react';
import {
  Driver,
  Truck,
  Excavator,
  DumpLocation,
  MaterialType,
  TripLog,
  StandbyReason,
  ShiftHandoverRecord,
  FuelingLog,
  DispatcherDirectMessage,
  ParkingLocation,
} from '../types/dispatch';
import {
  playClickSound,
  playLoadConfirmedSound,
  playDumpCompletedSound,
  playStandbyToggleSound,
  playDispatchAlertSound,
  startContinuousSosAlarm,
  stopContinuousSosAlarm,
  isSosAlarmActive,
} from '../utils/audio';
import {
  addTrip,
  saveShiftHandover,
  getPendingSyncCount,
  syncPendingOfflineData,
  subscribeToDataChanges,
  getAssignedTabletTruck,
  setAssignedTabletTruck,
  getRecentDriversForTruck,
  recordDriverForTruck,
  getActiveCabSession,
  saveActiveCabSession,
  clearActiveCabSession,
  startTruckFuelingEnRoute,
  advanceTruckFuelingAtStation,
  advanceTruckFuelingDepartStation,
  advanceTruckFuelingStartLoading,
  getActiveFuelingForTruck,
  getUnacknowledgedMessagesForTruck,
  acknowledgeDispatcherMessage,
  recordDriverLoginSession,
  recordDriverLogoutSession,
  getCustomStandbyReasons,
  recordStandbyStart,
  recordStandbyEnd,
  getActiveFuelingStationTrucks,
  ActiveStationTruck,
  getParkingLocations,
} from '../utils/storage';
import { useBatteryStatus } from '../hooks/useBatteryStatus';
import { triggerBackgroundSheetsSync } from '../utils/googleSheets';
import {
  claimEquipmentSession,
  subscribeToEquipmentSessionConflict,
  sendSessionHeartbeat,
  releaseEquipmentSession,
  updateEquipmentPresenceHeartbeat,
  subscribeToCloudDispatcherMessages,
  acknowledgeCloudMessage,
  listenForUnitMessages,
  CloudEquipmentSession,
  sendEmergencySos,
  cancelEmergencySos,
  subscribeToTruckActiveSos,
  EmergencySosAlert,
  subscribeToCloudFuelings,
  subscribeToFleetTrucks,
} from '../utils/firebaseSync';

interface Props {
  drivers: Driver[];
  trucks: Truck[];
  excavators: Excavator[];
  dumps: DumpLocation[];
  onForceSync: () => void;
  nextHourFormatted: string;
  onOpenMobileModal: () => void;
  onOpenHourlyArchive: () => void;
  onOpenAdmin: () => void;
  onOpenEquipmentAlerts: () => void;
  onRequestProtectedView?: (view: 'CONTROL' | 'DASHBOARD') => void;
}

// 5 Material Definitions for Step 2 (High Grade, Medium Grade, Low Grade, Sub Grade, Waste)
const MATERIAL_CARDS: {
  id: MaterialType;
  titleAr: string;
  code: string;
  gradeDesc: string;
  recommendation: string;
  colorTheme: {
    bg: string;
    border: string;
    badgeBg: string;
    badgeText: string;
    accent: string;
  };
}[] = [
  {
    id: 'ORE_HIGH',
    titleAr: 'هاي جريد (خام عالي الجودة)',
    code: 'High Grade (HG)',
    gradeDesc: 'نسبة الذهب أعلى من 2.5 جم/طن (+2.5 g/t Au)',
    recommendation: 'يوجه إلى الكسارة الأولية 01 أو ساحة التشوين ROM-PAD',
    colorTheme: {
      bg: 'bg-amber-950/40 hover:bg-amber-900/60',
      border: 'border-amber-500/80 hover:border-amber-400',
      badgeBg: 'bg-amber-500 text-slate-950',
      badgeText: 'text-amber-400',
      accent: 'text-amber-400',
    },
  },
  {
    id: 'ORE_MEDIUM',
    titleAr: 'ميديم جريد (خام متوسط الجودة)',
    code: 'Medium Grade (MG)',
    gradeDesc: 'نسبة الذهب بين 1.2 - 2.5 جم/طن (1.2 - 2.5 g/t Au)',
    recommendation: 'يوجه إلى الكسارة الثانوية 02 أو ساحات الخام',
    colorTheme: {
      bg: 'bg-orange-950/40 hover:bg-orange-900/60',
      border: 'border-orange-500/80 hover:border-orange-400',
      badgeBg: 'bg-orange-500 text-slate-950',
      badgeText: 'text-orange-400',
      accent: 'text-orange-400',
    },
  },
  {
    id: 'ORE_LOW',
    titleAr: 'لو جريد (خام منخفض الجودة)',
    code: 'Low Grade (LG)',
    gradeDesc: 'نسبة الذهب بين 0.5 - 1.2 جم/طن (0.5 - 1.2 g/t Au)',
    recommendation: 'يوجه لمكدس الغسيل والترشيح (Heap Leach Pad)',
    colorTheme: {
      bg: 'bg-cyan-950/40 hover:bg-cyan-900/60',
      border: 'border-cyan-500/80 hover:border-cyan-400',
      badgeBg: 'bg-cyan-500 text-slate-950',
      badgeText: 'text-cyan-400',
      accent: 'text-cyan-400',
    },
  },
  {
    id: 'SUB_GRADE',
    titleAr: 'سب جريد (خام تحت الجودة)',
    code: 'Sub Grade (SG)',
    gradeDesc: 'خام ذهب سب جريد تحت الجودة (Sub-Grade Ore)',
    recommendation: 'يوجه إلى مكدس المعالجة أو ساحات تشوين وتخزين السب جريد',
    colorTheme: {
      bg: 'bg-emerald-950/40 hover:bg-emerald-900/60',
      border: 'border-emerald-500/80 hover:border-emerald-400',
      badgeBg: 'bg-emerald-500 text-slate-950',
      badgeText: 'text-emerald-400',
      accent: 'text-emerald-400',
    },
  },
  {
    id: 'WASTE',
    titleAr: 'ويست (صخور عقيمة / ردم)',
    code: 'Waste Rock (عقيم)',
    gradeDesc: 'طبقات صخرية غير حاملة لمعدن الذهب (ردم سطحي وعقيم)',
    recommendation: 'يوجه إلى مقالب الصخور العقيمة A أو B (North/South Waste Dump)',
    colorTheme: {
      bg: 'bg-rose-950/40 hover:bg-rose-900/60',
      border: 'border-rose-500/80 hover:border-rose-400',
      badgeBg: 'bg-rose-600 text-white',
      badgeText: 'text-rose-400',
      accent: 'text-rose-400',
    },
  },
];

export const DriverInCab: React.FC<Props> = ({
  drivers,
  trucks,
  excavators,
  dumps,
  onForceSync,
  nextHourFormatted,
  onOpenMobileModal,
  onOpenHourlyArchive,
  onOpenAdmin,
  onOpenEquipmentAlerts,
  onRequestProtectedView,
}) => {
  // Active In-Cab Session Persistence (Guarantees tablet stays logged in across tab closes, refresh, and sleep)
  // The driver will NEVER be logged out unless they click the explicit Logout button!
  const savedSession = getActiveCabSession();

  // Authentication & Session
  const [currentDriver, setCurrentDriver] = useState<Driver | null>(savedSession?.driver || null);
  const [currentTruck, setCurrentTruck] = useState<Truck | null>(savedSession?.truck || null);
  const [driverCodeInput, setDriverCodeInput] = useState('');

  // Tablet Assigned Truck Lock (For the 60 dedicated tablets)
  const [assignedTabletTruck, setAssignedTabletTruckState] = useState<string | null>(getAssignedTabletTruck());
  const [selectedTruckId, setSelectedTruckId] = useState<string>(
    savedSession?.truck?.id || getAssignedTabletTruck() || trucks[0]?.id || 'DT001'
  );
  const [shiftStartTime, setShiftStartTime] = useState<Date | null>(
    savedSession?.shiftStartTime ? new Date(savedSession.shiftStartTime) : null
  );

  // Recent Drivers for the Selected Truck (Last 3-4 drivers who drove this truck)
  const [recentDrivers, setRecentDrivers] = useState<Driver[]>([]);

  // Workflow Screens:
  // 1. 'LOGIN': Driver login screen
  // 2. 'LOADER': Step 1 - Select Loading Equipment
  // 3. 'MATERIAL': Step 2 - Select Material Type
  // 4. 'DUMP': Step 3 - Select Dump / Crusher Destination
  // 5. 'HAULING_CONFIRM': Trip logged celebration & auto-reset
  const [currentScreen, setCurrentScreen] = useState<'LOGIN' | 'LOADER' | 'MATERIAL' | 'DUMP' | 'HAULING_CONFIRM'>(
    savedSession?.driver ? (savedSession.currentScreen || 'LOADER') : 'LOGIN'
  );

  // Multi-step Trip Draft State (Cleanly separated so nothing is remembered accidentally)
  const [activeTripDraft, setActiveTripDraft] = useState<{
    excavator: string;
    loadTime: Date;
    standbySec: number;
    standbyReason?: StandbyReason;
    material?: MaterialType;
    dumpLocation?: string;
    payloadTonnes?: number;
  } | null>(
    savedSession?.activeTripDraft
      ? {
          ...savedSession.activeTripDraft,
          loadTime: new Date(savedSession.activeTripDraft.loadTime),
        }
      : null
  );

  // In-session Driver Stats (Restored from persisted session)
  const [tripsCount, setTripsCount] = useState(savedSession?.tripsCount || 0);
  const [totalTonnesHauled, setTotalTonnesHauled] = useState(savedSession?.totalTonnesHauled || 0);

  // Standby / Queue Tracking
  const [isStandby, setIsStandby] = useState(savedSession?.isStandby || false);
  const [standbyStart, setStandbyStart] = useState<Date | null>(
    savedSession?.standbyStart ? new Date(savedSession.standbyStart) : null
  );
  const [standbyElapsedSeconds, setStandbyElapsedSeconds] = useState(0);
  const [accumulatedStandbySeconds, setAccumulatedStandbySeconds] = useState(
    savedSession?.accumulatedStandbySeconds || 0
  );
  const [standbyReason, setStandbyReason] = useState<StandbyReason>(savedSession?.standbyReason || 'QUEUE');
  const [showReasonPicker, setShowReasonPicker] = useState(false);

  // Fueling Tracking (تفويل جاز - مراحل التفويل الأربعة)
  const [isFueling, setIsFueling] = useState(false);
  const [activeFueling, setActiveFueling] = useState<FuelingLog | undefined>(undefined);
  const [fuelingStart, setFuelingStart] = useState<Date | null>(null);
  const [fuelingElapsedSeconds, setFuelingElapsedSeconds] = useState(0);

  // Custom Standby Reasons from Admin
  const [customStandbyReasonsList, setCustomStandbyReasonsList] = useState(getCustomStandbyReasons());

  // Dispatcher Direct Instructions Modal
  const [incomingDirectMessage, setIncomingDirectMessage] = useState<DispatcherDirectMessage | null>(null);
  const [showDirectMessageModal, setShowDirectMessageModal] = useState(false);

  // Online / Offline & Auto-sync Queue Status
  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [pendingSyncCount, setPendingSyncCount] = useState<number>(getPendingSyncCount());

  // Tablet Battery Monitoring System (< 20% warning)
  const battery = useBatteryStatus();
  const [showBatterySimModal, setShowBatterySimModal] = useState(false);

  // Logout Handover Modal State
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  // Alert & Toast System
  const [alertMessage, setAlertMessage] = useState<{ text: string; type: 'SUCCESS' | 'WARNING' | 'INFO' } | null>(null);

  // Google Sheets Driver Sync state
  const [isSyncingSheets, setIsSyncingSheets] = useState(false);

  // Multi-device Session Conflict (detects if another tablet logged into this equipment)
  const [sessionConflict, setSessionConflict] = useState<CloudEquipmentSession | null>(null);

  // Emergency SOS Beacon & Continuous Alarm State
  const [activeSosAlert, setActiveSosAlert] = useState<EmergencySosAlert | null>(null);
  const [isSendingSos, setIsSendingSos] = useState<boolean>(false);
  const [showSosConfirmModal, setShowSosConfirmModal] = useState<boolean>(false);

  // Distinct Standby Cloud Event Tracking ID
  const [currentStandbyId, setCurrentStandbyId] = useState<string | null>(null);

  // 1. Real-time Fueling Station Occupancy across all devices
  const [activeStationTrucks, setActiveStationTrucks] = useState<ActiveStationTruck[]>(getActiveFuelingStationTrucks());
  const [showStationTrucksModal, setShowStationTrucksModal] = useState(false);

  // 2. Equipment & Dump Inactive/Out-of-Service Warning Confirmation Modal
  const [warningTarget, setWarningTarget] = useState<{
    type: 'EXCAVATOR' | 'DUMP';
    id: string;
    nameAr: string;
    statusNote: string;
    isRecommended?: boolean;
  } | null>(null);

  // 3. Parking Locations for Driver Logout Handover
  const [parkingLocationsList, setParkingLocationsList] = useState<ParkingLocation[]>(getParkingLocations());
  const [selectedParkingId, setSelectedParkingId] = useState<string>('PARK-01');
  const [logoutParkingNotes, setLogoutParkingNotes] = useState<string>('');

  const showAlert = (text: string, type: 'SUCCESS' | 'WARNING' | 'INFO' = 'SUCCESS') => {
    setAlertMessage({ text, type });
    setTimeout(() => setAlertMessage(null), 4000);
  };

  // Automatically Persist In-Cab Driver Session to LocalStorage
  // Only explicitly clicking the logout button removes this session
  useEffect(() => {
    if (currentDriver && currentTruck) {
      saveActiveCabSession({
        driver: currentDriver,
        truck: currentTruck,
        shiftStartTime: shiftStartTime ? shiftStartTime.toISOString() : new Date().toISOString(),
        currentScreen: currentScreen === 'LOGIN' ? 'LOADER' : currentScreen,
        tripsCount,
        totalTonnesHauled,
        accumulatedStandbySeconds,
        isStandby,
        standbyStart: standbyStart ? standbyStart.toISOString() : null,
        standbyReason,
        activeTripDraft: activeTripDraft
          ? {
              ...activeTripDraft,
              loadTime: activeTripDraft.loadTime.toISOString(),
            }
          : null,
      });
    }
  }, [
    currentDriver,
    currentTruck,
    shiftStartTime,
    currentScreen,
    tripsCount,
    totalTonnesHauled,
    accumulatedStandbySeconds,
    isStandby,
    standbyStart,
    standbyReason,
    activeTripDraft,
  ]);

  // Update recent drivers whenever selected truck changes
  useEffect(() => {
    setRecentDrivers(getRecentDriversForTruck(selectedTruckId));
  }, [selectedTruckId]);

  // Standby Ticker
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    if (isStandby && standbyStart) {
      interval = setInterval(() => {
        const elapsed = Math.round((new Date().getTime() - standbyStart.getTime()) / 1000);
        setStandbyElapsedSeconds(elapsed);
      }, 1000);
    } else {
      setStandbyElapsedSeconds(0);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isStandby, standbyStart]);

  // Check active truck fueling status upon truck selection
  useEffect(() => {
    if (currentTruck) {
      const activeFuel = getActiveFuelingForTruck(currentTruck.id);
      setActiveFueling(activeFuel);
      if (activeFuel) {
        setIsFueling(true);
        setFuelingStart(new Date(activeFuel.startTime));
      } else {
        setIsFueling(false);
        setFuelingStart(null);
      }
    }
  }, [currentTruck]);

  // Fueling Ticker
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    if (isFueling && fuelingStart) {
      interval = setInterval(() => {
        const elapsed = Math.round((Date.now() - fuelingStart.getTime()) / 1000);
        setFuelingElapsedSeconds(elapsed);
      }, 1000);
    } else {
      setFuelingElapsedSeconds(0);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isFueling, fuelingStart]);

  // Listen for targeted dispatcher instructions
  useEffect(() => {
    if (!currentTruck) return;
    const checkIncomingMessages = () => {
      const unread = getUnacknowledgedMessagesForTruck(currentTruck.id);
      if (unread.length > 0 && (!incomingDirectMessage || incomingDirectMessage.id !== unread[0].id)) {
        setIncomingDirectMessage(unread[0]);
        setShowDirectMessageModal(true);
        playDispatchAlertSound();
      }
    };

    checkIncomingMessages();
    const unsub = subscribeToDataChanges((event) => {
      if (event.type === 'DIRECT_MESSAGES_UPDATED') {
        checkIncomingMessages();
      }
    });
    const interval = setInterval(checkIncomingMessages, 4000);
    return () => {
      unsub();
      clearInterval(interval);
    };
  }, [currentTruck, incomingDirectMessage]);

  // -------------------------------------------------------------
  // CLOUD DISPATCHER MESSAGES LISTENER (Real-time on ANY tablet in the mine via Firestore)
  // -------------------------------------------------------------
  useEffect(() => {
    if (!currentTruck) return;
    const unsubCloudMsg = listenForUnitMessages(currentTruck.id, (_msgText, fullMessage) => {
      if (fullMessage) {
        setIncomingDirectMessage(fullMessage);
        setShowDirectMessageModal(true);
        playDispatchAlertSound();
      }
    });

    return () => {
      unsubCloudMsg();
    };
  }, [currentTruck?.id]);

  // -------------------------------------------------------------
  // EQUIPMENT SESSION CLAIM & CONFLICT HEARTBEAT (Enforce single active device per equipment)
  // -------------------------------------------------------------
  useEffect(() => {
    if (!currentTruck || !currentDriver) return;

    // Claim session for this equipment on this device
    claimEquipmentSession(currentTruck.id, 'TRUCK', currentDriver.code, currentDriver.name).then((result) => {
      if (result.conflict && result.existingSession) {
        setSessionConflict(result.existingSession);
      }
    });

    // Send heartbeats every 25s
    const heartbeatTimer = setInterval(() => {
      sendSessionHeartbeat(currentTruck.id);
      updateEquipmentPresenceHeartbeat(currentTruck.id, 'TRUCK', currentDriver.name);
    }, 25000);

    // Initial presence heartbeat
    updateEquipmentPresenceHeartbeat(currentTruck.id, 'TRUCK', currentDriver.name);

    // Listen for conflict: if another device claims this truck
    const unsubConflict = subscribeToEquipmentSessionConflict(currentTruck.id, (claimedByOther) => {
      setSessionConflict(claimedByOther);
      playDispatchAlertSound();
    });

    return () => {
      clearInterval(heartbeatTimer);
      unsubConflict();
    };
  }, [currentTruck?.id, currentDriver?.code]);

  // -------------------------------------------------------------
  // EMERGENCY SOS REALTIME SUBSCRIBER & CONTINUOUS ALARM LOOP
  // -------------------------------------------------------------
  useEffect(() => {
    if (!currentTruck) {
      stopContinuousSosAlarm();
      setActiveSosAlert(null);
      return;
    }

    const unsubSos = subscribeToTruckActiveSos(currentTruck.id, (alert) => {
      if (alert && alert.status === 'ACTIVE' && !alert.acknowledged) {
        setActiveSosAlert(alert);
        startContinuousSosAlarm();
      } else if (alert && alert.acknowledged) {
        // Dispatcher / Admin acknowledged receipt in Control Room!
        setActiveSosAlert(alert);
        stopContinuousSosAlarm();
      } else {
        stopContinuousSosAlarm();
        setActiveSosAlert(null);
      }
    });

    return () => {
      unsubSos();
      stopContinuousSosAlarm();
    };
  }, [currentTruck?.id]);

  // -------------------------------------------------------------
  // REAL-TIME FLEET FUELING STATION & PARKING OCCUPANCY LISTENER (Across ALL Devices & Tablets)
  // -------------------------------------------------------------
  useEffect(() => {
    const refreshStation = () => {
      setActiveStationTrucks(getActiveFuelingStationTrucks());
    };
    const refreshParkings = () => {
      setParkingLocationsList(getParkingLocations());
    };

    refreshStation();
    refreshParkings();

    // 1. Direct Firestore cloud listener on fleet_fuelings for multi-device sync
    const unsubCloudFuel = subscribeToCloudFuelings((cloudFuelings) => {
      if (cloudFuelings) {
        refreshStation();
      }
    });

    // 2. Direct Firestore fleet trucks live state listener
    const unsubTrucks = subscribeToFleetTrucks((trucksMap) => {
      if (trucksMap) {
        refreshStation();
      }
    });

    // 3. Local storage & cross-tab events
    const unsubLocal = subscribeToDataChanges((event) => {
      if (event.type === 'FUELING_LOGS_UPDATED' || event.type === 'TRUCKS_UPDATED') {
        refreshStation();
      }
      if (event.type === 'PARKINGS_UPDATED') {
        refreshParkings();
      }
    });

    // 4. Polling ticker every 3s to keep elapsed minutes fresh
    const interval = setInterval(refreshStation, 3000);

    return () => {
      unsubCloudFuel();
      unsubTrucks();
      unsubLocal();
      clearInterval(interval);
    };
  }, []);

  const handleTriggerSosEmergency = async () => {
    if (!currentTruck || !currentDriver) {
      showAlert('يرجى تسجيل الدخول أولاً لتفعيل نداء الطوارئ', 'WARNING');
      return;
    }

    setIsSendingSos(true);
    setShowSosConfirmModal(false);

    try {
      startContinuousSosAlarm();
      const alert = await sendEmergencySos(
        currentTruck.id,
        currentDriver.code,
        currentDriver.name,
        'نداء استغاثة وطوارئ عاجل (SOS) من كابينة الشاحنة'
      );
      setActiveSosAlert(alert);
      showAlert('🚨 تم إرسال نداء الاستغاثة SOS فورياً إلى غرفة الدسباتش! سارينة الإنذار تعمل حتى تأكيد الاستلام', 'WARNING');
    } catch (err: any) {
      console.error('Failed to send SOS:', err);
      showAlert('⚠️ تم تشغيل الإنذار - جاري إعادة محاولة إرسال الإشارة', 'WARNING');
    } finally {
      setIsSendingSos(false);
    }
  };

  const handleCancelSosEmergency = async () => {
    if (!activeSosAlert) return;
    try {
      await cancelEmergencySos(activeSosAlert.id, currentTruck?.id);
      stopContinuousSosAlarm();
      setActiveSosAlert(null);
      showAlert('تم إلغاء نداء الاستغاثة وإيقاف السارينة بنجاح ✅', 'SUCCESS');
    } catch {
      stopContinuousSosAlarm();
      setActiveSosAlert(null);
    }
  };

  // -------------------------------------------------------------
  // 15-MINUTE AUTOMATIC GOOGLE SHEETS BACKGROUND SYNC
  // -------------------------------------------------------------
  useEffect(() => {
    const interval = setInterval(() => {
      triggerBackgroundSheetsSync().then((res) => {
        if (res.success) {
          console.log('[GoogleSheets] 15-min background sync completed');
        }
      });
    }, 15 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  const handleManualGoogleSheetsSync = async () => {
    setIsSyncingSheets(true);
    playClickSound();
    try {
      const res = await triggerBackgroundSheetsSync();
      if (res.success) {
        showAlert(`تمت مزامنة بيانات الإنتاج بنجاح مع Google Sheets (${res.syncedTrips} رحلة) 📊✅`, 'SUCCESS');
      } else {
        showAlert(`تعذر التحديث: ${res.error || 'يرجى التأكد من ربط الشيت وتوفر الإنترنت'}`, 'WARNING');
      }
    } catch (err) {
      showAlert('حدث خطأ أثناء الاتصال بجوجل شيت', 'WARNING');
    } finally {
      setIsSyncingSheets(false);
    }
  };

  // Network Online/Offline Listeners & Automatic Sync upon Reconnecting
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      const res = syncPendingOfflineData();
      setPendingSyncCount(getPendingSyncCount());
      if (res.syncedTrips > 0 || res.syncedHandovers > 0) {
        showAlert(
          `📶 تم التقاط إشارة الإنترنت بنجاح! تم مزامنة ${res.syncedTrips} حمولة و ${res.syncedHandovers} تقرير وردية أوتوماتيكياً.`,
          'SUCCESS'
        );
      }
      // Also trigger Google Sheets sync immediately on internet reconnection
      triggerBackgroundSheetsSync();
    };

    const handleOffline = () => {
      setIsOnline(false);
      showAlert('⚠️ انقطع الاتصال بالإنترنت - يتم حفظ كافة البيانات محلياً على التابلت', 'WARNING');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const unsubscribe = subscribeToDataChanges((event) => {
      if (
        event.type === 'PENDING_SYNC_UPDATED' ||
        event.type === 'PENDING_SYNC_CLEARED' ||
        event.type === 'OFFLINE_SYNC_COMPLETED'
      ) {
        setPendingSyncCount(getPendingSyncCount());
      }
      if (event.type === 'TABLET_TRUCK_CHANGED') {
        const locked = getAssignedTabletTruck();
        setAssignedTabletTruckState(locked);
        if (locked) setSelectedTruckId(locked);
      }
      if (event.type === 'CUSTOM_STANDBY_REASONS_UPDATED') {
        setCustomStandbyReasonsList(getCustomStandbyReasons());
      }
      if (event.type === 'FUELING_LOGS_UPDATED' && currentTruck) {
        const activeFuel = getActiveFuelingForTruck(currentTruck.id);
        setActiveFueling(activeFuel);
        setIsFueling(!!activeFuel);
        if (activeFuel) {
          setFuelingStart(new Date(activeFuel.startTime));
        } else {
          setFuelingStart(null);
        }
      }
    });

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      unsubscribe();
    };
  }, [currentTruck]);

  // Handle Driver Login
  const handleLogin = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const code = driverCodeInput.trim();
    const driver = drivers.find(d => d.code === code);

    if (!driver) {
      showAlert('برجاء إدخال كود سائق صحيح مسجل بالنظام!', 'WARNING');
      return;
    }

    const truck = trucks.find(t => t.id === selectedTruckId) || trucks[0];

    // Record driver for this truck's recent driver list
    recordDriverForTruck(truck.id, driver.code);

    // Record driver session for attendance & Google Sheets tracking
    recordDriverLoginSession(driver.code, driver.name, truck.id);
    triggerBackgroundSheetsSync();

    setCurrentDriver(driver);
    setCurrentTruck(truck);
    const start = new Date();
    setShiftStartTime(start);
    setCurrentScreen('LOADER');
    playClickSound();

    showAlert(`تم تسجيل الدخول: السائق ${driver.name} على الدنبر ${truck.id} بنجاح ✅`);
  };

  const handleQuickLogin = (driver: Driver) => {
    setDriverCodeInput(driver.code);
    const truck = trucks.find(t => t.id === selectedTruckId) || trucks[0];

    recordDriverForTruck(truck.id, driver.code);

    // Record driver session for attendance & Google Sheets tracking
    recordDriverLoginSession(driver.code, driver.name, truck.id);
    triggerBackgroundSheetsSync();

    setCurrentDriver(driver);
    setCurrentTruck(truck);
    const start = new Date();
    setShiftStartTime(start);
    setCurrentScreen('LOADER');
    playClickSound();

    showAlert(`مرحباً ${driver.name} - تم بدء الوردية بنجاح ✅`);
  };

  // Toggle Tablet Truck Lock
  const handleToggleTabletTruckLock = () => {
    if (assignedTabletTruck === selectedTruckId) {
      setAssignedTabletTruck(null);
      setAssignedTabletTruckState(null);
      showAlert('تم إلغاء تثبيت التابلت، يمكنك الآن تغيير الدنبر بحرية', 'INFO');
    } else {
      setAssignedTabletTruck(selectedTruckId);
      setAssignedTabletTruckState(selectedTruckId);
      showAlert(`تم تثبيت هذا التابلت رسمياً للدنبر ${selectedTruckId} 🔒`, 'SUCCESS');
    }
  };

  // Standby Toggle with Distinct Cloud Path Sync
  const toggleStandby = () => {
    if (!isStandby) {
      const now = new Date();
      setIsStandby(true);
      setStandbyStart(now);
      if (currentTruck && currentDriver) {
        const ev = recordStandbyStart(
          currentTruck.id,
          currentDriver.code,
          currentDriver.name,
          standbyReason
        );
        setCurrentStandbyId(ev.id);
      }
      playStandbyToggleSound(true);
      setShowReasonPicker(true);
      showAlert('تم بدء الاستاند باي وتحديث مسار الحالة سحابياً ⏱️', 'INFO');
    } else {
      stopStandby();
    }
  };

  const stopStandby = () => {
    if (isStandby && standbyStart) {
      const now = new Date();
      const elapsed = Math.round((now.getTime() - standbyStart.getTime()) / 1000);
      setAccumulatedStandbySeconds(prev => prev + elapsed);
      if (currentTruck) {
        recordStandbyEnd(currentStandbyId, currentTruck.id, elapsed);
        setCurrentStandbyId(null);
      }
      setIsStandby(false);
      setStandbyStart(null);
      setStandbyElapsedSeconds(0);
      playStandbyToggleSound(false);
      setShowReasonPicker(false);
      showAlert(`تم استئناف العمل (مدة التوقف: ${Math.round(elapsed / 60)} دقيقة) ✅`, 'INFO');
    }
  };

  // -------------------------------------------------------------
  // 4-STAGE PROGRESSIVE FUELING WORKFLOW:
  // 1. "رايح أفول ⛽" -> EN_ROUTE
  // 2. "وصلت البنزينة ⛽" -> AT_STATION
  // 3. "طلعت من البنزينة 🚚" -> RETURNING
  // 4. "بدأت التحميل 🏗️" -> COMPLETED & LOADING
  // -------------------------------------------------------------
  const handleStartFuelingEnRoute = () => {
    if (!currentDriver || !currentTruck) return;
    playClickSound();
    const f = startTruckFuelingEnRoute(currentTruck.id, currentDriver.code, currentDriver.name);
    setActiveFueling(f);
    setIsFueling(true);
    setFuelingStart(new Date(f.startTime));
    setFuelingElapsedSeconds(0);
    showAlert('⛽ المرحلة 1: رايح أفول - تم إشعار الدسباتش بتحرك الدنبر لمحطة الوقود', 'INFO');
  };

  const handleArrivedAtStation = () => {
    if (!currentTruck) return;
    playClickSound();
    const f = advanceTruckFuelingAtStation(currentTruck.id);
    if (f) {
      setActiveFueling(f);
      showAlert('⛽ المرحلة 2: وصلت البنزينة - تم تسجيل الوصول وبدء التفويل', 'SUCCESS');
    }
  };

  const handleDepartStation = () => {
    if (!currentTruck) return;
    playClickSound();
    const f = advanceTruckFuelingDepartStation(currentTruck.id);
    if (f) {
      setActiveFueling(f);
      showAlert('🚚 المرحلة 3: طلعت من البنزينة - جاري العودة إلى الحفرة', 'INFO');
    }
  };

  const handleStartLoadingAfterFueling = () => {
    if (!currentTruck) return;
    playClickSound();
    const completed = advanceTruckFuelingStartLoading(currentTruck.id);
    const duration = completed?.durationMinutes || Math.max(1, Math.round(fuelingElapsedSeconds / 60));
    setActiveFueling(undefined);
    setIsFueling(false);
    setFuelingStart(null);
    setFuelingElapsedSeconds(0);
    showAlert(`🏗️ المرحلة 4: بدأت التحميل - اكتمل التفويل (${duration} دقيقة) والعودة لدورة الإنتاج`, 'SUCCESS');
  };

  // -------------------------------------------------------------
  // EQUIPMENT & DUMP STATUS / AVAILABILITY HELPERS
  // -------------------------------------------------------------
  const isExcavatorInactive = (ex: Excavator) => {
    return ex.status !== 'ACTIVE' || ex.isAvailable === false;
  };

  const getExcavatorStatusLabel = (ex: Excavator) => {
    if (ex.statusNote) return ex.statusNote;
    switch (ex.status) {
      case 'BREAKDOWN': return 'عطل فني / هيدروليك 🚨';
      case 'MAINTENANCE': return 'صيانة دورية / تزييت 🔧';
      case 'STANDBY_QUEUE': return 'متوقف / استاند باي ⏳';
      case 'BLASTING_WAIT': return 'متوقف لأعمال التفجير 💥';
      default: return 'لا يعمل / غير متاح ⛔';
    }
  };

  const isDumpInactive = (dump: DumpLocation) => {
    return dump.activeStatus !== 'OPEN' || dump.isAvailable === false;
  };

  const getDumpStatusLabel = (dump: DumpLocation) => {
    if (dump.statusNote) return dump.statusNote;
    switch (dump.activeStatus) {
      case 'CLOSED': return 'مغلق تماماً ⛔';
      case 'INACTIVE': return 'لا يعمل / خارج الخدمة ⛔';
      case 'MAINTENANCE': return 'صيانة وتسوية بالجريدر 🚜';
      case 'FULL': return 'المقلب ممتلئ ⚠️';
      case 'CONGESTED': return 'تكدس وزحام شديد ⏳';
      default: return 'لا يعمل / غير متاح ⛔';
    }
  };

  // -------------------------------------------------------------
  // STEP 1: Select Excavator / Shovel / Loader / Others
  // -------------------------------------------------------------
  const handleSelectExcavator = (exId: string) => {
    const ex = excavators.find(e => e.id === exId);
    if (ex && isExcavatorInactive(ex)) {
      setWarningTarget({
        type: 'EXCAVATOR',
        id: ex.id,
        nameAr: ex.id,
        statusNote: getExcavatorStatusLabel(ex),
      });
      playDispatchAlertSound();
      return;
    }
    proceedWithExcavator(exId);
  };

  const proceedWithExcavator = (exId: string) => {
    setWarningTarget(null);
    if (isStandby) {
      stopStandby();
    }

    const totalStandby = accumulatedStandbySeconds;
    setActiveTripDraft({
      excavator: exId,
      loadTime: new Date(),
      standbySec: totalStandby,
      standbyReason: totalStandby > 0 ? standbyReason : undefined,
    });

    setAccumulatedStandbySeconds(0);
    playLoadConfirmedSound();

    // Directly transitions to Step 2: DEDICATED MATERIAL SELECTION SCREEN
    setCurrentScreen('MATERIAL');
  };

  // -------------------------------------------------------------
  // STEP 2: Select Material Type on its Own Screen
  // -------------------------------------------------------------
  const handleSelectMaterial = (material: MaterialType) => {
    if (!activeTripDraft) return;

    setActiveTripDraft(prev => prev ? { ...prev, material } : null);
    playClickSound();

    // Directly transitions to Step 3: DEDICATED DUMP LOCATION SELECTION SCREEN
    setCurrentScreen('DUMP');
  };

  // -------------------------------------------------------------
  // STEP 3: Select Dump Location & Finalize Trip (152 tonnes payload)
  // -------------------------------------------------------------
  const handleSelectDump = (dumpCode: string) => {
    const dump = dumps.find(d => d.id === dumpCode);
    if (dump && isDumpInactive(dump)) {
      setWarningTarget({
        type: 'DUMP',
        id: dump.id,
        nameAr: dump.nameAr,
        statusNote: getDumpStatusLabel(dump),
      });
      playDispatchAlertSound();
      return;
    }
    proceedWithDump(dumpCode);
  };

  const proceedWithDump = (dumpCode: string) => {
    setWarningTarget(null);
    if (!activeTripDraft || !activeTripDraft.material || !currentDriver || !currentTruck) return;

    const dumpTime = new Date();
    const cycleMins = Math.max(1, Math.round(((dumpTime.getTime() - activeTripDraft.loadTime.getTime()) / 60000) * 10) / 10);
    const payload = 152; // Exactly 152 tonnes as requested

    const tripRecord: TripLog = {
      id: `TRIP-${currentTruck.id}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      shiftDate: new Date().toISOString().split('T')[0],
      shiftType: 'MORNING',
      driverCode: currentDriver.code,
      driverName: currentDriver.name,
      truckId: currentTruck.id,
      truckModel: currentTruck.id, // Clean truck ID without cluttered model
      excavatorId: activeTripDraft.excavator,
      material: activeTripDraft.material,
      standbyDurationSec: activeTripDraft.standbySec,
      standbyReason: activeTripDraft.standbyReason,
      loadStartTime: activeTripDraft.loadTime.toISOString(),
      loadEndTime: new Date().toISOString(),
      dumpLocationId: dumpCode,
      dumpTime: dumpTime.toISOString(),
      payloadTonnes: payload,
      cycleTimeMinutes: cycleMins,
      synced: typeof navigator !== 'undefined' ? navigator.onLine : true,
      notes:
        activeTripDraft.material === 'WASTE'
          ? 'صخور عقيمة ردم'
          : activeTripDraft.material === 'SUB_GRADE'
          ? 'خام سب جريد SG'
          : 'خام ذهب للإنتاج',
    };

    // Save trip into local storage and sync queue if offline
    addTrip(tripRecord);
    playDumpCompletedSound();

    // Update in-cab counters
    setTripsCount(prev => prev + 1);
    setTotalTonnesHauled(prev => prev + payload);
    setPendingSyncCount(getPendingSyncCount());

    // Save full snapshot for celebration screen
    setActiveTripDraft({
      ...activeTripDraft,
      dumpLocation: dumpCode,
      payloadTonnes: payload,
    });

    setCurrentScreen('HAULING_CONFIRM');

    // Auto-transition back to Step 1 (LOADER) after 2 seconds
    setTimeout(() => {
      setActiveTripDraft(null);
      setCurrentScreen('LOADER');
    }, 2200);
  };

  // -------------------------------------------------------------
  // LOGOUT & SHIFT HANDOVER: Save locally on tablet, auto-sync when online
  // -------------------------------------------------------------
  const handleConfirmLogout = () => {
    if (!currentDriver || !currentTruck) {
      setShowLogoutModal(false);
      setCurrentScreen('LOGIN');
      return;
    }

    const endTime = new Date();
    const selectedParking =
      parkingLocationsList.find(p => p.id === selectedParkingId) || parkingLocationsList[0];
    const parkingName = selectedParking ? selectedParking.nameAr : 'موقف الورشة المركزية';

    const handoverRecord: ShiftHandoverRecord = {
      id: `HANDOVER-${Date.now().toString().slice(-6)}`,
      driverCode: currentDriver.code,
      driverName: currentDriver.name,
      truckId: currentTruck.id,
      truckModel: currentTruck.id,
      shiftStartTime: shiftStartTime ? shiftStartTime.toISOString() : new Date().toISOString(),
      shiftEndTime: endTime.toISOString(),
      tripsCount: tripsCount,
      totalTonnes: totalTonnesHauled,
      standbySeconds: accumulatedStandbySeconds,
      parkingLocationId: selectedParking?.id || 'PARK-01',
      parkingLocationName: parkingName,
      notes: logoutParkingNotes ? `ركن في ${parkingName}: ${logoutParkingNotes}` : `ركن في ${parkingName}`,
      synced: typeof navigator !== 'undefined' ? navigator.onLine : true,
    };

    // Save handover record in tablet storage & offline queue
    const saveResult = saveShiftHandover(handoverRecord);
    setPendingSyncCount(getPendingSyncCount());

    // Clear Persisted In-Cab Active Session ONLY on explicit logout confirmation
    clearActiveCabSession();

    // Release equipment session claim in Cloud Firestore so another tablet can open it cleanly
    if (currentTruck) {
      releaseEquipmentSession(currentTruck.id);
    }

    // Record driver logout in attendance session tracking with parking location
    recordDriverLogoutSession(currentTruck.id, tripsCount, totalTonnesHauled, parkingName);

    // Trigger Google Sheets sync upon shift logout
    triggerBackgroundSheetsSync();

    playClickSound();
    setShowLogoutModal(false);

    // Reset Driver Session
    setCurrentDriver(null);
    setCurrentTruck(null);
    setTripsCount(0);
    setTotalTonnesHauled(0);
    setAccumulatedStandbySeconds(0);
    setIsStandby(false);
    setActiveTripDraft(null);
    setLogoutParkingNotes('');
    setCurrentScreen('LOGIN');

    showAlert(
      `تم تسليم الوردية وتوثيق ركنة الدنبر في (${parkingName}) ومزامنة البيانات أوتوماتيكياً مع Google Sheets والأدمن ✅`,
      'SUCCESS'
    );
  };

  const formatSeconds = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(mins).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  // Manual Trigger to sync offline items right now
  const handleManualSyncNow = () => {
    const res = syncPendingOfflineData();
    setPendingSyncCount(getPendingSyncCount());
    if (res.syncedTrips > 0 || res.syncedHandovers > 0) {
      showAlert(`تم إرسال ${res.syncedTrips} حمولة و ${res.syncedHandovers} تقرير تسليم وردية بنجاح!`, 'SUCCESS');
    } else {
      onForceSync();
      showAlert('تم تحديث ومزامنة البيانات مع النظام المركزي بنجاح', 'SUCCESS');
    }
  };

  return (
    <div className="flex-1 flex flex-col p-2 md:p-4 max-w-5xl mx-auto w-full">
      {/* Toast Alert Message */}
      {alertMessage && (
        <div
          className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-5 py-3.5 rounded-2xl font-bold shadow-2xl flex items-center gap-3 text-sm border-2 animate-in fade-in slide-in-from-top duration-200 max-w-lg ${
            alertMessage.type === 'WARNING'
              ? 'bg-amber-500 text-slate-950 border-amber-300'
              : alertMessage.type === 'INFO'
              ? 'bg-sky-600 text-white border-sky-400'
              : 'bg-emerald-600 text-white border-emerald-400'
          }`}
        >
          <Sparkles className="w-5 h-5 shrink-0" />
          <span>{alertMessage.text}</span>
        </div>
      )}

      {/* CRITICAL LOW BATTERY VISUAL ALERT BANNER (< 20% & Discharging) */}
      {battery.isLowBattery && (
        <div className="mb-4 bg-gradient-to-r from-rose-950 via-rose-900 to-amber-950 border-2 border-rose-500 rounded-2xl p-3.5 md:p-4 shadow-2xl animate-pulse">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-rose-600/30 border border-rose-500/80 flex items-center justify-center text-rose-300 shrink-0 font-black">
                <BatteryWarning className="w-7 h-7 text-rose-400 animate-bounce" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm md:text-base font-black text-rose-100">
                    ⚠️ تحذير حرج: مستوى شحن بطارية التابلت منخفض ({battery.level}%)!
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-rose-600 text-white text-[11px] font-black">
                    أقل من 20%
                  </span>
                </div>
                <p className="text-xs text-rose-200 mt-1 leading-relaxed">
                  يرجى توصيل كابل الشاحن في كابينة الدنبر فوراً لتجنب انطفاء تابلت المعدة وتوقف إرسال التقرير الساعي إلى جروب الواتساب وغرفة الدسباتش.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 self-end md:self-auto">
              <button
                type="button"
                onClick={() => {
                  battery.setSimulatedCharging(true);
                  showAlert('تم تفعيل وضع الشحن ⚡ للتابلت', 'SUCCESS');
                }}
                className="py-2 px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-lg transition-transform active:scale-95"
              >
                <Zap className="w-4 h-4" />
                <span>تم توصيل الشاحن ⚡</span>
              </button>

              <button
                type="button"
                onClick={() => setShowBatterySimModal(true)}
                className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs cursor-pointer border border-slate-700"
              >
                فحص البطارية
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Persistent Offline Notification Strip */}
      {!isOnline && (
        <div className="mb-3 bg-amber-500/10 border-2 border-amber-500/50 rounded-xl p-2.5 px-4 flex items-center justify-between gap-2 text-xs text-amber-300 font-bold">
          <div className="flex items-center gap-2">
            <WifiOff className="w-4 h-4 text-amber-400 shrink-0 animate-pulse" />
            <span>التابلت يعمل دون اتصال (Offline) — البيانات تُحفظ محلياً وستُرسل أوتوماتيكياً فور عودة الشبكة</span>
          </div>
          {pendingSyncCount > 0 && (
            <span className="py-0.5 px-2 rounded-full bg-amber-500 text-slate-950 text-[11px] font-mono shrink-0">
              {pendingSyncCount} بانتظار النت
            </span>
          )}
        </div>
      )}

      {/* IN-CAB HEADER (Active Driver Info & Real-Time Counters) */}
      {currentScreen !== 'LOGIN' && currentDriver && currentTruck && (
        <header className="bg-slate-900 border-2 border-amber-500/40 rounded-2xl p-3 md:p-4 mb-4 shadow-xl flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0 font-bold">
              <TruckIcon className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base md:text-lg font-bold text-amber-400">
                  السائق: {currentDriver.name}
                </h2>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                  كود: {currentDriver.code}
                </span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1 ${
                  isOnline ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/30' : 'bg-rose-950 text-rose-300 border border-rose-500/30'
                }`}>
                  {isOnline ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                  {isOnline ? 'أونلاين' : 'أوفلاين محلي'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                الدنبر: <strong className="text-slate-100 font-mono text-sm">{currentTruck.id}</strong> (152 طن)
                {' · '}
                بدء الوردية: <span className="font-mono text-slate-300">{shiftStartTime?.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</span>
              </p>
            </div>
          </div>

          {/* Real-time Shift Stats & Battery Bar */}
          <div className="flex items-center gap-2 md:gap-3 mr-auto md:mr-0">
            <div className="bg-slate-950/80 border border-slate-800 py-1.5 px-3 rounded-xl text-center min-w-[70px]">
              <div className="text-lg md:text-xl font-bold font-mono text-amber-400 tabular-nums">
                {tripsCount}
              </div>
              <div className="text-[10px] text-slate-400 font-medium">الحمولات</div>
            </div>

            <div className="bg-slate-950/80 border border-slate-800 py-1.5 px-3 rounded-xl text-center min-w-[80px]">
              <div className="text-lg md:text-xl font-bold font-mono text-emerald-400 tabular-nums">
                {totalTonnesHauled}
              </div>
              <div className="text-[10px] text-slate-400 font-medium">الطن الكلي (152t)</div>
            </div>

            <div className="bg-slate-950/80 border border-slate-800 py-1.5 px-3 rounded-xl text-center min-w-[85px]">
              <div className="text-lg md:text-xl font-bold font-mono text-sky-400 tabular-nums flex items-center justify-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                {nextHourFormatted}
              </div>
              <div className="text-[10px] text-slate-400 font-medium">الإرسال القادم</div>
            </div>

            {/* Real-time Fuel Station Occupancy Card */}
            <button
              type="button"
              onClick={() => setShowStationTrucksModal(true)}
              className={`border py-1.5 px-2.5 rounded-xl text-center min-w-[75px] cursor-pointer transition-colors ${
                activeStationTrucks.length === 0
                  ? 'bg-slate-950/80 border-slate-800 hover:border-emerald-500/40 text-emerald-400'
                  : activeStationTrucks.length <= 2
                  ? 'bg-amber-950/60 border-amber-500/50 text-amber-300'
                  : 'bg-rose-950/80 border-rose-500/70 text-rose-300 animate-pulse'
              }`}
              title="عدد الدنابر المتواجدة حالياً في محطة الوقود (اضغط لعرض التفاصيل)"
            >
              <div className="text-base md:text-lg font-black font-mono tabular-nums flex items-center justify-center gap-1">
                <span>⛽</span>
                <span>{activeStationTrucks.length}</span>
              </div>
              <div className="text-[9px] text-slate-400 font-bold">
                {activeStationTrucks.length === 0 ? 'البنزينة فاضية' : 'في البنزينة'}
              </div>
            </button>

            {/* Driver Google Sheets Sync Button */}
            <button
              type="button"
              onClick={handleManualGoogleSheetsSync}
              disabled={isSyncingSheets}
              title="مزامنة وتحديث فوري لحمولاتك وساعات العمل إلى نسخة Google Sheets"
              className={`py-1.5 px-3 rounded-xl border flex items-center gap-1.5 cursor-pointer transition-colors ${
                isSyncingSheets
                  ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-400 animate-pulse'
                  : 'bg-slate-950/80 hover:bg-emerald-950/50 border-slate-800 hover:border-emerald-500/40 text-emerald-400'
              }`}
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
              <div className="text-right">
                <div className="font-bold text-xs leading-none">
                  {isSyncingSheets ? 'جاري التحديث...' : 'مزامنة الشيت'}
                </div>
                <div className="text-[9px] text-slate-400 leading-none mt-0.5">Google Sheets 📊</div>
              </div>
            </button>

            {/* Tablet Battery Widget Button */}
            <button
              type="button"
              onClick={() => setShowBatterySimModal(true)}
              title={`مستوى شحن بطارية التابلت: ${battery.level}% ${battery.charging ? '(متصل بالشاحن ⚡)' : ''}`}
              className={`py-1.5 px-3 rounded-xl border flex items-center gap-2 cursor-pointer transition-colors ${
                battery.isLowBattery
                  ? 'bg-rose-950/90 border-rose-500 text-rose-300 animate-pulse'
                  : battery.charging
                  ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-400'
                  : battery.level > 50
                  ? 'bg-slate-950/80 border-slate-800 text-emerald-400'
                  : 'bg-slate-950/80 border-slate-800 text-amber-400'
              }`}
            >
              <div className="relative">
                {battery.charging ? (
                  <Zap className="w-4 h-4 text-emerald-400 animate-bounce" />
                ) : battery.isLowBattery ? (
                  <BatteryWarning className="w-4 h-4 text-rose-400" />
                ) : (
                  <Battery className="w-4 h-4" />
                )}
              </div>
              <div className="text-right">
                <div className="flex items-center gap-1 font-mono font-bold text-xs leading-none">
                  <span>{battery.level}%</span>
                  {battery.charging && <span className="text-[10px] text-emerald-400">⚡</span>}
                </div>
                <div className="text-[9px] text-slate-400 leading-none mt-0.5">
                  {battery.charging ? 'جاري الشحن' : battery.isLowBattery ? 'بطارية منخفضة!' : 'بطارية'}
                </div>
              </div>
            </button>

            {/* Quick Supervisor / Dispatcher Room Access Button */}
            {onRequestProtectedView && (
              <button
                type="button"
                onClick={() => onRequestProtectedView('CONTROL')}
                className="py-1.5 px-2.5 sm:px-3 rounded-xl border border-amber-500/40 bg-slate-900 hover:bg-slate-800 text-amber-400 font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-md transition-colors"
                title="دخول المشرف أو الديسباتشر لغرفة التحكم والتقارير"
              >
                <Radio className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                <span className="hidden sm:inline">غرفة التحكم</span>
                <span className="font-mono text-[10px] bg-amber-500/15 text-amber-400 px-1.5 py-0.2 rounded border border-amber-500/30">دخول سري 🔒</span>
              </button>
            )}

            {/* In-Cab Emergency SOS Button */}
            <button
              type="button"
              onClick={() => setShowSosConfirmModal(true)}
              className={`py-1.5 px-3 rounded-xl border-2 font-black text-xs flex items-center gap-1.5 cursor-pointer shadow-lg transition-transform active:scale-95 ${
                activeSosAlert
                  ? 'bg-red-600 text-white border-white animate-pulse ring-2 ring-red-400'
                  : 'bg-red-950/80 hover:bg-red-900 text-red-200 border-red-500/60'
              }`}
              title="زر استغاثة وطوارئ عاجل SOS وتشغيل سارينة الإنذار"
            >
              <span className="text-sm">🆘</span>
              <span className="font-black">{activeSosAlert ? 'طوارئ نشطة 🚨' : 'طوارئ SOS'}</span>
            </button>
          </div>
        </header>
      )}

      {/* Persistent Emergency SOS Active / Acknowledged Banner */}
      {currentScreen !== 'LOGIN' && activeSosAlert && (
        <div className={`mb-4 border-4 rounded-2xl p-4 shadow-2xl animate-in fade-in ${
          activeSosAlert.acknowledged
            ? 'bg-slate-900 border-emerald-500 text-slate-100'
            : 'bg-gradient-to-r from-rose-950 via-red-900 to-rose-950 border-red-500 text-white animate-pulse'
        }`}>
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl font-black shrink-0 ${
                activeSosAlert.acknowledged ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-600 text-white animate-bounce'
              }`}>
                {activeSosAlert.acknowledged ? '✅' : '🆘'}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm md:text-base font-black">
                    {activeSosAlert.acknowledged
                      ? 'تم تأكيد استلام نداء الطوارئ من غرفة الدسباتش ✅'
                      : '🚨 نداء طوارئ واستغاثة (SOS) نشط — سارينة الإنذار تعمل مستمرة!'}
                  </span>
                  <span className={`px-2 py-0.5 rounded-full text-[11px] font-mono font-bold ${
                    activeSosAlert.acknowledged ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white animate-ping'
                  }`}>
                    {activeSosAlert.acknowledged ? 'ACKNOWLEDGED' : 'ACTIVE SOS'}
                  </span>
                </div>
                <p className="text-xs mt-1 text-slate-200">
                  {activeSosAlert.acknowledged
                    ? `تم تأكيد الاستلام بواسطة: ${activeSosAlert.acknowledgedBy || 'غرفة التحكم'} — تم إيقاف سارينة الإنذار. فرق الدعم في طريقها إليك.`
                    : 'جاري تشغيل سارينة الإنذار المستمرة في الكابينة وإشعار غرفة التحكم المركزية حتى يتم تأكيد الاستلام من المراقب.'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
              <button
                type="button"
                onClick={handleCancelSosEmergency}
                className="py-2 px-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold border border-slate-600 cursor-pointer shadow-md"
              >
                إلغاء نداء الاستغاثة والعودة للعمل 🟢
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Active Fueling 4-Stage Progressive Workflow Strip */}
      {currentScreen !== 'LOGIN' && isFueling && activeFueling && (
        <div className="mb-4 bg-gradient-to-r from-sky-950 via-sky-900 to-slate-900 border-2 border-sky-400 rounded-2xl p-4 shadow-xl flex flex-wrap items-center justify-between gap-3 animate-in fade-in">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-sky-500/20 border border-sky-400/50 flex items-center justify-center text-sky-400 font-bold animate-pulse">
              <Fuel className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-sm md:text-base text-sky-200">
                  {activeFueling.status === 'EN_ROUTE' && 'المرحلة 1: الدنبر في الطريق إلى محطة الوقود ⛽'}
                  {activeFueling.status === 'AT_STATION' && 'المرحلة 2: الدنبر متوقف حالياً بالبنزينة جاري التفويل ⛽'}
                  {activeFueling.status === 'RETURNING' && 'المرحلة 3: الدنبر خرج من البنزينة وفي طريق العودة للحفرة 🚚'}
                </span>
                <span className="py-0.5 px-2 rounded-full bg-sky-500 text-slate-950 font-mono font-bold text-xs animate-pulse">
                  {activeFueling.status}
                </span>
              </div>
              <div className="text-xs text-sky-300/80 mt-1 flex items-center gap-2 flex-wrap">
                <span>بدء الإجراء: <strong className="font-mono text-white">{fuelingStart?.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</strong></span>
                <span>·</span>
                <span>المدة المستغرقة: <strong className="font-mono text-amber-400 text-sm">{formatSeconds(fuelingElapsedSeconds)}</strong></span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {activeFueling.status === 'EN_ROUTE' && (
              <button
                type="button"
                onClick={handleArrivedAtStation}
                className="py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs md:text-sm flex items-center gap-1.5 shadow-lg shadow-amber-500/30 cursor-pointer active:scale-95 transition-transform"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>وصلت البنزينة ⛽ (المرحلة 2)</span>
              </button>
            )}

            {activeFueling.status === 'AT_STATION' && (
              <button
                type="button"
                onClick={handleDepartStation}
                className="py-2.5 px-4 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-black text-xs md:text-sm flex items-center gap-1.5 shadow-lg shadow-sky-500/30 cursor-pointer active:scale-95 transition-transform"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>طلعت من البنزينة 🚚 (المرحلة 3)</span>
              </button>
            )}

            {activeFueling.status === 'RETURNING' && (
              <button
                type="button"
                onClick={handleStartLoadingAfterFueling}
                className="py-2.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs md:text-sm flex items-center gap-1.5 shadow-lg shadow-emerald-500/30 cursor-pointer active:scale-95 transition-transform"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>بدأت التحميل 🏗️ (المرحلة 4 - إنهاء)</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* SCREEN 1: LOGIN (Driver Authentication & Dedicated Truck Setup) */}
      {/* ============================================================= */}
      {currentScreen === 'LOGIN' && (
        <div className="my-auto py-6 max-w-lg mx-auto w-full">
          <div className="bg-slate-900 border-2 border-amber-500/30 rounded-3xl p-6 md:p-8 shadow-2xl">
            <div className="text-center mb-6">
              <div className="inline-flex p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 mb-3">
                <TruckIcon className="w-10 h-10" />
              </div>
              <h2 className="text-2xl font-black text-amber-400 tracking-wide">
                دسباتش منجم السكري لمناجم الذهب
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                نظام تشغيل كابينة الشاحنات والدمبرات الميدانية (In-Cab Haulage Terminal)
              </p>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">كود السائق:</label>
                <input
                  type="text"
                  value={driverCodeInput}
                  onChange={(e) => setDriverCodeInput(e.target.value)}
                  placeholder="أدخل الكود (مثال: 1001)"
                  className="w-full py-3.5 px-4 rounded-xl bg-slate-950 border border-slate-700 text-slate-100 text-center text-lg font-mono tracking-wider focus:border-amber-500 focus:outline-none"
                  autoFocus
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-300">رقم الدنبر (المعدة):</label>
                  <button
                    type="button"
                    onClick={handleToggleTabletTruckLock}
                    className={`text-[11px] px-2.5 py-0.5 rounded-lg font-bold flex items-center gap-1 transition-colors cursor-pointer ${
                      assignedTabletTruck === selectedTruckId
                        ? 'bg-amber-500 text-slate-950 shadow-sm'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                    title="تثبيت هذا التابلت على هذا الدنبر لكي لا يضطر السائق لاختياره كل مرة"
                  >
                    {assignedTabletTruck === selectedTruckId ? (
                      <>
                        <Lock className="w-3 h-3" />
                        <span>مثبت لهذا التابلت 🔒</span>
                      </>
                    ) : (
                      <>
                        <Unlock className="w-3 h-3" />
                        <span>تثبيت التابلت لهذا الدنبر 📌</span>
                      </>
                    )}
                  </button>
                </div>

                <select
                  value={selectedTruckId}
                  onChange={(e) => setSelectedTruckId(e.target.value)}
                  className="w-full py-3.5 px-4 rounded-xl bg-slate-950 border border-slate-700 text-slate-100 text-center text-lg font-bold font-mono tracking-wider focus:border-amber-500 focus:outline-none"
                >
                  {trucks.map(truck => (
                    <option key={truck.id} value={truck.id}>
                      {truck.id}
                    </option>
                  ))}
                </select>
                <div className="text-[11px] text-slate-400 mt-1 text-center">
                  حمولة الدنبر المعتمدة بالحسابات: <strong className="text-slate-200 font-mono">152 طن</strong>
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-4 rounded-xl font-black text-base bg-amber-500 hover:bg-amber-400 text-slate-950 transition-colors shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 cursor-pointer active:scale-98"
              >
                <TruckIcon className="w-5 h-5" />
                تسجيل دخول وبدء الوردية
              </button>
            </form>

            {/* Quick Driver Selection: Last 3-4 drivers who operated this truck */}
            <div className="mt-6 pt-5 border-t border-slate-800">
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-xs font-bold text-slate-300">
                  آخر سائقين عملوا على الدنبر ({selectedTruckId}):
                </span>
                <span className="text-[10px] text-slate-400 font-mono">
                  (اضغط للدخول المباشر)
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {recentDrivers.map(d => (
                  <button
                    key={d.code}
                    type="button"
                    onClick={() => handleQuickLogin(d)}
                    className="py-2.5 px-3 rounded-lg bg-slate-950/80 hover:bg-slate-800 border border-slate-800 hover:border-amber-500/40 text-right transition-colors cursor-pointer"
                  >
                    <div className="font-bold text-xs text-slate-200">{d.name}</div>
                    <div className="text-[10px] text-amber-400 font-mono">كود: {d.code}</div>
                  </button>
                ))}
              </div>

              {/* Driver Google Sheets Sync Button on Login Screen */}
              <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between">
                <span className="text-[11px] text-slate-400">
                  مزامنة وتحديث نسخة جوجل شيت:
                </span>
                <button
                  type="button"
                  onClick={handleManualGoogleSheetsSync}
                  disabled={isSyncingSheets}
                  className="py-1.5 px-3 rounded-xl bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-300 border border-emerald-500/40 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="مزامنة وتحديث نسخة جوجل شيت أونلاين"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>{isSyncingSheets ? 'جاري التحديث...' : 'مزامنة Google Sheets 📊'}</span>
                </button>
              </div>

              {/* Real-time Fuel Station info on login */}
              <div className="mt-2.5 pt-2.5 border-t border-slate-800/80 flex items-center justify-between">
                <span className="text-[11px] text-slate-400 flex items-center gap-1.5">
                  <Fuel className="w-3.5 h-3.5 text-sky-400" />
                  <span>حالة محطة الوقود حالياً:</span>
                </span>
                <button
                  type="button"
                  onClick={() => setShowStationTrucksModal(true)}
                  className={`py-1 px-2.5 rounded-lg text-xs font-mono font-bold border transition-colors cursor-pointer ${
                    activeStationTrucks.length === 0
                      ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40'
                      : activeStationTrucks.length <= 2
                      ? 'bg-amber-950/80 text-amber-300 border-amber-500/40'
                      : 'bg-rose-950/80 text-rose-300 border-rose-500/50 animate-pulse'
                  }`}
                >
                  {activeStationTrucks.length === 0
                    ? 'خالية (0 دنابر) 🟢'
                    : `${activeStationTrucks.length} ${activeStationTrucks.length === 1 ? 'دنبر' : 'دنابر'} بالبنزينة ⛽`}
                </button>
              </div>
            </div>

            {/* Dedicated Supervisor, Control Room & Reports Hub (PIN 1234 Protection) */}
            <div className="mt-5 p-4 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900/90 to-amber-950/20 border-2 border-amber-500/50 shadow-xl text-right">
              <div className="flex items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center font-bold text-sm">
                    🛡️
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-slate-100 flex items-center gap-2">
                      <span>غرفة العمليات المركزية والتقارير</span>
                      <span className="py-0.5 px-2 rounded-full bg-amber-500 text-slate-950 font-mono text-[10px] font-bold">
                        حساب ديسباتشر 🔒
                      </span>
                    </h4>
                    <p className="text-[11px] text-slate-400">
                      دخول مخصص للديسباتشر ومشرفي الإنتاج برقم سري خاص
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => onRequestProtectedView ? onRequestProtectedView('CONTROL') : null}
                  className="py-3 px-4 rounded-xl bg-slate-800/90 hover:bg-slate-700/90 active:scale-98 border border-amber-500/40 hover:border-amber-400 text-slate-100 flex items-center justify-between gap-2 transition-all cursor-pointer shadow-md group"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
                      <Radio className="w-4 h-4 animate-pulse" />
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-black group-hover:text-amber-400 transition-colors">
                        غرفة الدسباتش والمراقبة 📡
                      </div>
                      <div className="text-[10px] text-slate-400">
                        متابعة فورية للحفرة والأساطيل
                      </div>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30">
                    دخول سري 🔒
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => onRequestProtectedView ? onRequestProtectedView('DASHBOARD') : null}
                  className="py-3 px-4 rounded-xl bg-slate-800/90 hover:bg-slate-700/90 active:scale-98 border border-sky-500/40 hover:border-sky-400 text-slate-100 flex items-center justify-between gap-2 transition-all cursor-pointer shadow-md group"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-sky-500/20 text-sky-400 flex items-center justify-center font-bold">
                      <BarChart3 className="w-4 h-4" />
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-black group-hover:text-sky-400 transition-colors">
                        لوحة تحكم الأداء والتقارير 📊
                      </div>
                      <div className="text-[10px] text-slate-400">
                        إنتاجية الساعات والطن والمعدات
                      </div>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/30">
                    دخول سري 🔒
                  </span>
                </button>
              </div>

              <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={onOpenHourlyArchive}
                  className="text-xs font-bold text-sky-400 hover:text-sky-300 flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>أرشيف تقارير الساعات والشيتات</span>
                </button>

                <button
                  type="button"
                  onClick={onOpenAdmin}
                  className="text-xs font-bold text-slate-300 hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Lock className="w-3.5 h-3.5 text-amber-400" />
                  <span>إدارة قاعدة البيانات (الأدمن)</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* STEP 1: EXCAVATOR SELECTION SCREEN */}
      {/* Big clear numbers, models and clutter removed as requested */}
      {/* ============================================================= */}
      {currentScreen === 'LOADER' && (
        <div className="flex-1 flex flex-col">
          {/* Progress Indicator */}
          <div className="mb-3 bg-slate-900 border border-slate-800 rounded-xl p-2.5 px-4 flex items-center justify-between">
            <span className="text-xs font-bold text-amber-400 flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-amber-500 text-slate-950 font-bold flex items-center justify-center text-xs">1</span>
              الخطوة 1 من 3: اختيار معدة التحميل
            </span>
            <span className="text-xs text-slate-400">
              اضغط على رقم المعدة المحمل منها
            </span>
          </div>

          {/* STANDBY, FUELING, STATUS & SOS BAR */}
          <div className="mb-4 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <button
              onClick={toggleStandby}
              className={`py-3 px-3 rounded-2xl font-black text-xs md:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg active:scale-98 ${
                isStandby
                  ? 'bg-rose-600 hover:bg-rose-500 text-white animate-pulse border-2 border-rose-400'
                  : 'bg-purple-800 hover:bg-purple-700 text-white border-2 border-purple-500/50'
              }`}
            >
              <Clock className="w-4 h-4 shrink-0" />
              {isStandby ? (
                <span>⏳ انتظار: {formatSeconds(standbyElapsedSeconds)} (إيقاف)</span>
              ) : (
                <span>⏱️ بدء الاستاند باي</span>
              )}
            </button>

            <button
              onClick={
                !isFueling || !activeFueling || activeFueling.status === 'COMPLETED'
                  ? handleStartFuelingEnRoute
                  : activeFueling.status === 'EN_ROUTE'
                  ? handleArrivedAtStation
                  : activeFueling.status === 'AT_STATION'
                  ? handleDepartStation
                  : handleStartLoadingAfterFueling
              }
              className={`py-3 px-3 rounded-2xl font-black text-xs md:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg active:scale-98 ${
                isFueling
                  ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 animate-pulse border-2 border-amber-300'
                  : 'bg-sky-700 hover:bg-sky-600 text-white border-2 border-sky-500/50'
              }`}
            >
              <Fuel className="w-4 h-4 shrink-0" />
              {!isFueling || !activeFueling || activeFueling.status === 'COMPLETED' ? (
                <span className="flex items-center gap-1.5 flex-wrap justify-center">
                  <span>⛽ رايح أفول</span>
                  <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                    activeStationTrucks.length > 0
                      ? 'bg-amber-400 text-slate-950 animate-pulse'
                      : 'bg-sky-900/80 text-sky-200 border border-sky-400/30'
                  }`}>
                    {activeStationTrucks.length} بالبنزينة
                  </span>
                </span>
              ) : activeFueling.status === 'EN_ROUTE' ? (
                <span>⛽ 2. وصلت البنزينة ({formatSeconds(fuelingElapsedSeconds)})</span>
              ) : activeFueling.status === 'AT_STATION' ? (
                <span>🚚 3. طلعت من البنزينة ({formatSeconds(fuelingElapsedSeconds)})</span>
              ) : (
                <span>🏗️ 4. بدأت التحميل ({formatSeconds(fuelingElapsedSeconds)})</span>
              )}
            </button>

            <button
              onClick={onOpenEquipmentAlerts}
              className="py-3 px-3 rounded-2xl font-black text-xs md:text-sm flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border-2 border-slate-700 transition-all cursor-pointer shadow-lg active:scale-98"
            >
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>🚨 بلاغ عطل / حالة</span>
            </button>

            {/* Dedicated High-Impact SOS Emergency Button */}
            <button
              type="button"
              onClick={() => setShowSosConfirmModal(true)}
              className={`py-3 px-3 rounded-2xl font-black text-xs md:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xl active:scale-95 border-2 ${
                activeSosAlert
                  ? 'bg-red-600 text-white border-white animate-pulse ring-2 ring-red-400 shadow-red-900/80'
                  : 'bg-gradient-to-r from-red-700 via-rose-600 to-red-800 hover:from-red-600 hover:to-rose-700 text-white border-red-500 shadow-red-950/60'
              }`}
              title="إرسال إشارة استغاثة وطوارئ عاجل SOS وتشغيل سارينة الإنذار"
            >
              <span className="text-base animate-bounce">🆘</span>
              <span>{activeSosAlert ? 'طوارئ نشطة 🚨' : 'طوارئ SOS'}</span>
            </button>

            {/* Dynamic Reason selector if standby active */}
            {isStandby && showReasonPicker && (
              <div className="col-span-2 sm:col-span-4 mt-1 p-3 bg-slate-900 border border-purple-500/40 rounded-xl animate-in fade-in">
                <span className="text-xs text-purple-300 font-bold block mb-2">اختر سبب الانتظار والتوقف:</span>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {customStandbyReasonsList.filter(r => r.active).map(r => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => { setStandbyReason(r.code as StandbyReason); playClickSound(); }}
                      className={`py-2 px-2.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer flex items-center gap-1.5 ${
                        standbyReason === r.code
                          ? 'bg-purple-600 text-white border-purple-400 shadow-md shadow-purple-600/30'
                          : 'bg-slate-950 text-slate-300 border-slate-800 hover:bg-slate-800'
                      }`}
                    >
                      <span>{r.icon || '⏱️'}</span>
                      <span className="truncate">{r.labelAr}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* REAL-TIME FUEL STATION OCCUPANCY BAR (Clickable to view trucks at fuel station) */}
          <button
            type="button"
            onClick={() => {
              playClickSound();
              setShowStationTrucksModal(true);
            }}
            className="mb-3.5 w-full p-2.5 px-3.5 rounded-2xl bg-gradient-to-r from-sky-950/90 via-slate-900 to-slate-950 border border-sky-500/40 hover:border-sky-400 flex items-center justify-between gap-3 text-right cursor-pointer transition-all hover:bg-slate-900 shadow-md"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-sky-500/20 border border-sky-400/40 flex items-center justify-center text-sky-400 shrink-0 font-bold">
                <Fuel className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-black text-slate-100 flex items-center gap-1.5 flex-wrap">
                  <span>محطة الوقود الحالية:</span>
                  <span className="text-amber-400 font-bold">
                    {activeStationTrucks.length === 0
                      ? 'لا توجد دنابر في البنزينة حالياً (المحطة فارغة ومتاحة)'
                      : `يوجد الآن ${activeStationTrucks.length} دنابر تفول بالبنزينة`}
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 truncate">
                  اضغط هنا لعرض تفاصيل وأرقام الدنابر المتواجدة في البنزينة لحظياً عبر كل الأجهزة
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <span className={`px-2 py-1 rounded-xl text-xs font-mono font-black border ${
                activeStationTrucks.length > 0
                  ? 'bg-amber-500 text-slate-950 border-amber-300 animate-pulse'
                  : 'bg-slate-800 text-slate-300 border-slate-700'
              }`}>
                ⛽ {activeStationTrucks.length}
              </span>
            </div>
          </button>

          {/* Section Heading */}
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm md:text-base font-bold text-slate-200 flex items-center gap-2">
              <HardHat className="w-5 h-5 text-amber-400" />
              معدات التحميل (الحفارات والشوافل واللوادر):
            </h3>
            <span className="text-xs text-slate-400 font-mono">
              {excavators.length} معدة
            </span>
          </div>

          {/* EXCAVATOR & SHOVEL GRID - Big, Prominent, Clear Numbers with Inactive Warnings */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 flex-1 pb-4">
            {excavators.map((ex) => {
              const isShovel = ex.id.startsWith('SH');
              const isLoader = ex.id.startsWith('WL');
              const isOthers = ex.id === 'Others';
              const typeLabel = isOthers ? 'تحميل آخر' : isShovel ? 'شوڤل' : isLoader ? 'لودر' : 'حفار';
              const inactive = isExcavatorInactive(ex);
              const statusLabel = getExcavatorStatusLabel(ex);

              return (
                <button
                  key={ex.id}
                  onClick={() => handleSelectExcavator(ex.id)}
                  className={`group p-4 md:p-5 rounded-2xl border-2 text-center flex flex-col items-center justify-center shadow-xl active:scale-95 cursor-pointer min-h-[115px] transition-all relative overflow-hidden ${
                    inactive
                      ? 'bg-rose-950/40 border-rose-500/80 hover:border-rose-400 hover:bg-rose-900/50'
                      : isOthers
                      ? 'bg-slate-900 border-amber-500/80 hover:border-amber-400 hover:bg-amber-950/30'
                      : 'bg-slate-900 border-emerald-500/50 hover:border-emerald-400 hover:bg-slate-800/90'
                  }`}
                >
                  {inactive && (
                    <div className="absolute top-1.5 right-1.5 left-1.5 py-0.5 px-1 rounded-md bg-rose-600 text-white text-[10px] font-black tracking-tight flex items-center justify-center gap-1 shadow">
                      <AlertOctagon className="w-3 h-3 shrink-0" />
                      <span className="truncate">{statusLabel}</span>
                    </div>
                  )}

                  {/* Big Massive Number */}
                  <div className={`text-2xl md:text-3xl font-black font-mono tracking-wider group-hover:scale-105 transition-transform mb-1 ${
                    inactive ? 'text-rose-200 line-through opacity-85 mt-3' : 'text-slate-50'
                  }`}>
                    {ex.id}
                  </div>
                  <div className={`text-xs font-bold ${inactive ? 'text-rose-400' : isOthers ? 'text-amber-400' : 'text-emerald-400'}`}>
                    {inactive ? '⚠️ اضغط للتفاصيل' : typeLabel}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* STEP 2: DEDICATED MATERIAL SELECTION SCREEN (5 Materials) */}
      {/* High Grade, Medium Grade, Low Grade, Sub Grade, Waste */}
      {/* ============================================================= */}
      {currentScreen === 'MATERIAL' && activeTripDraft && (
        <div className="flex-1 flex flex-col">
          {/* Header & Back Button */}
          <div className="mb-4 bg-slate-900 border-2 border-amber-500/40 rounded-2xl p-3 md:p-4 flex flex-wrap items-center justify-between gap-3 shadow-lg">
            <div className="flex items-center gap-3">
              <span className="w-7 h-7 rounded-full bg-amber-500 text-slate-950 font-black flex items-center justify-center text-sm">2</span>
              <div>
                <span className="text-xs text-slate-400 block">الخطوة 2 من 3: تحديد نوع الخام المحمل</span>
                <span className="text-sm md:text-base font-bold text-slate-100">
                  تم التحميل من المعدة: <strong className="text-emerald-400 font-mono text-lg">{activeTripDraft.excavator}</strong>
                </span>
              </div>
            </div>

            <button
              onClick={() => { setCurrentScreen('LOADER'); playClickSound(); }}
              className="py-2 px-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
              <span>تغيير معدة التحميل</span>
            </button>
          </div>

          <div className="mb-3 text-center md:text-right">
            <h3 className="text-base md:text-lg font-black text-amber-400 flex items-center justify-center md:justify-start gap-2">
              <Layers className="w-5 h-5 text-amber-400" />
              اختر نوع الخام الموجود الآن في صندوق الدنبر:
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              صفحة مخصصة إلزامية لكل نقلة لضمان دقة فرز الذهب وحسابات الإنتاجية
            </p>
          </div>

          {/* Full-width High-Impact 5 Material Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 md:gap-4 flex-1 pb-4">
            {MATERIAL_CARDS.map((card) => {
              return (
                <button
                  key={card.id}
                  onClick={() => handleSelectMaterial(card.id)}
                  className={`group p-4 md:p-5 rounded-2xl border-2 text-right transition-all flex flex-col justify-between shadow-xl cursor-pointer active:scale-98 ${card.colorTheme.bg} ${card.colorTheme.border}`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className={`py-1 px-3 rounded-lg text-xs font-black uppercase ${card.colorTheme.badgeBg}`}>
                        {card.code}
                      </span>
                      <ArrowRight className="w-5 h-5 text-slate-400 group-hover:translate-x-1 group-hover:text-white transition-all" />
                    </div>

                    <h4 className="text-lg md:text-xl font-black text-slate-100 mb-1 group-hover:text-white">
                      {card.titleAr}
                    </h4>

                    <p className={`text-xs font-semibold ${card.colorTheme.accent} mb-2`}>
                      {card.gradeDesc}
                    </p>
                  </div>

                  <div className="pt-3 border-t border-slate-800/80 text-[11px] text-slate-300">
                    <span className="font-bold text-slate-400">الوجهة المقترحة: </span>
                    <span>{card.recommendation}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* STEP 3: DUMP LOCATION SELECTION SCREEN */}
      {/* ============================================================= */}
      {currentScreen === 'DUMP' && activeTripDraft && activeTripDraft.material && (
        <div className="flex-1 flex flex-col">
          {/* Active Trip Info Banner */}
          <div className="mb-4 bg-slate-900 border-2 border-amber-500/40 rounded-2xl p-3 md:p-4 flex flex-wrap items-center justify-between gap-3 shadow-lg">
            <div className="flex items-center gap-3">
              <span className="w-7 h-7 rounded-full bg-amber-500 text-slate-950 font-black flex items-center justify-center text-sm">3</span>
              <div>
                <span className="text-xs text-slate-400 block">الخطوة 3 من 3: اختيار موقع التفريغ</span>
                <div className="flex flex-wrap items-center gap-2 mt-0.5">
                  <span className="text-xs text-slate-200">
                    المعدة: <strong className="text-emerald-400 font-mono text-sm">{activeTripDraft.excavator}</strong>
                  </span>
                  <span className="text-slate-500">·</span>
                  <span className="text-xs font-bold text-amber-400">
                    نوع الخام: {
                      activeTripDraft.material === 'WASTE'
                        ? 'ويست Waste'
                        : activeTripDraft.material === 'SUB_GRADE'
                        ? 'سب جريد SG'
                        : activeTripDraft.material === 'ORE_HIGH'
                        ? 'هاي جريد HG'
                        : activeTripDraft.material === 'ORE_MEDIUM'
                        ? 'ميديم جريد MG'
                        : 'لو جريد LG'
                    }
                  </span>
                  <span className="text-slate-500">·</span>
                  <span className="text-xs font-mono text-slate-300">
                    الحمولة: <strong>152 طن</strong>
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => { setCurrentScreen('MATERIAL'); playClickSound(); }}
                className="py-1.5 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                <span>تعديل نوع الخام</span>
              </button>
            </div>
          </div>

          {/* Section Heading */}
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm md:text-base font-bold text-slate-200 flex items-center gap-2">
              <Mountain className="w-5 h-5 text-rose-400" />
              اختر مكان التفريغ (الكسارات، الروم باد، المقالب):
            </h3>
            <span className="text-xs text-slate-400">
              اضغط على الموقع لتفريغ الصندوق وتسجيل النقلة
            </span>
          </div>

          {/* DUMP LOCATION GRID */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4 flex-1 pb-4">
            {dumps.map((d) => {
              const inactive = isDumpInactive(d);
              const statusLabel = getDumpStatusLabel(d);
              const isRecommended =
                !inactive && (
                  (activeTripDraft.material === 'WASTE' && (d.id.includes('DUMP') || d.type === 'WASTE_DUMP')) ||
                  (activeTripDraft.material === 'SUB_GRADE' && (d.id.includes('LEACH') || d.id.includes('ROM') || d.type === 'LEACH_PAD' || d.type === 'ROM_PAD')) ||
                  (activeTripDraft.material !== 'WASTE' && activeTripDraft.material !== 'SUB_GRADE' && (d.id.includes('CRUSHER') || d.id.includes('ROM') || d.type === 'CRUSHER' || d.type === 'ROM_PAD'))
                );

              return (
                <button
                  key={d.id}
                  onClick={() => handleSelectDump(d.id)}
                  className={`group p-4 md:p-5 rounded-2xl border-2 text-center flex flex-col items-center justify-center shadow-lg active:scale-95 cursor-pointer min-h-[120px] transition-all relative overflow-hidden ${
                    inactive
                      ? 'bg-rose-950/40 border-rose-500/80 hover:border-rose-400 hover:bg-rose-900/50'
                      : isRecommended
                      ? 'bg-slate-900 border-rose-500/70 hover:border-rose-400 hover:bg-rose-950/20 ring-1 ring-rose-500/30'
                      : 'bg-slate-900 border-slate-800 hover:border-slate-700 hover:bg-slate-800/80'
                  }`}
                >
                  {inactive && (
                    <div className="absolute top-1.5 right-1.5 left-1.5 py-0.5 px-1 rounded-md bg-rose-600 text-white text-[10px] font-black flex items-center justify-center gap-1 shadow">
                      <AlertOctagon className="w-3 h-3 shrink-0" />
                      <span className="truncate">{statusLabel}</span>
                    </div>
                  )}

                  <div className={`text-3xl mb-1.5 group-hover:scale-110 transition-transform ${inactive ? 'mt-3 opacity-75' : ''}`}>
                    {d.type === 'CRUSHER' ? '⚙️' : d.type === 'ROM_PAD' ? '🟡' : '⛰️'}
                  </div>

                  <div className={`text-base md:text-lg font-black font-mono tracking-wide ${inactive ? 'text-rose-200 line-through' : 'text-slate-100'}`}>
                    {d.id}
                  </div>

                  <div className={`text-xs font-medium mt-0.5 ${inactive ? 'text-rose-400' : 'text-rose-300'}`}>
                    {d.nameAr}
                  </div>

                  {isRecommended && !inactive && (
                    <span className="mt-2 py-0.5 px-2 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold border border-emerald-500/30">
                      ⭐ موصى به لهذا الخام
                    </span>
                  )}

                  {inactive && (
                    <span className="mt-1 text-[10px] text-rose-300 font-bold bg-rose-950/80 px-2 py-0.5 rounded-full border border-rose-500/40">
                      ⚠️ يتطلب تأكيد اختياره
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* SCREEN: CELEBRATION / CONFIRMATION ANIMATION */}
      {/* ============================================================= */}
      {currentScreen === 'HAULING_CONFIRM' && activeTripDraft && (
        <div className="my-auto py-10 text-center max-w-md mx-auto w-full bg-slate-900 border-2 border-emerald-500/60 rounded-3xl p-6 md:p-8 shadow-2xl animate-in zoom-in-95 duration-200">
          <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-emerald-500/20 border-2 border-emerald-500 flex items-center justify-center text-emerald-400">
            <CheckCircle2 className="w-10 h-10" />
          </div>

          <h3 className="text-2xl font-black text-emerald-400 mb-1">
            تم تسجيل وتفريغ الحمولة بنجاح!
          </h3>
          <p className="text-slate-300 text-xs mb-4">
            تم تسجيل 152 طن بنجاح وتحديث بيان الإنتاجية
          </p>

          <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 space-y-1.5 text-xs text-slate-300 mb-4">
            <div className="flex justify-between">
              <span className="text-slate-400">الدنبر:</span>
              <strong className="font-mono text-white text-sm">{currentTruck?.id}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">معدة التحميل:</span>
              <strong className="font-mono text-emerald-400 text-sm">{activeTripDraft.excavator}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">نوع الخام:</span>
              <strong className="text-amber-400">
                {
                  activeTripDraft.material === 'WASTE'
                    ? 'ويست Waste'
                    : activeTripDraft.material === 'SUB_GRADE'
                    ? 'سب جريد SG'
                    : activeTripDraft.material === 'ORE_HIGH'
                    ? 'هاي جريد HG'
                    : activeTripDraft.material === 'ORE_MEDIUM'
                    ? 'ميديم جريد MG'
                    : 'لو جريد LG'
                }
              </strong>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">موقع التفريغ:</span>
              <strong className="font-mono text-rose-400 text-sm">{activeTripDraft.dumpLocation}</strong>
            </div>
            <div className="flex justify-between border-t border-slate-800 pt-1.5">
              <span className="text-slate-400">الحمولة المسجلة بالحسابات:</span>
              <strong className="text-emerald-400 font-mono text-sm">152 طن</strong>
            </div>
          </div>

          <button
            onClick={() => {
              setActiveTripDraft(null);
              setCurrentScreen('LOADER');
            }}
            className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm transition-colors cursor-pointer"
          >
            الانتقال للنقلة التالية فوراً ⏭️
          </button>
        </div>
      )}

      {/* ============================================================= */}
      {/* FOOTER CONTROLS (Always Visible When Driver is Logged In) */}
      {/* ============================================================= */}
      {currentScreen !== 'LOGIN' && (
        <footer className="mt-4 pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button
              onClick={handleManualSyncNow}
              className="py-2.5 px-4 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs md:text-sm flex items-center gap-2 transition-colors shadow-md active:scale-95 cursor-pointer"
            >
              <Send className="w-4 h-4" />
              <span>🔄 مزامنة أوتوماتيك الآن</span>
              {pendingSyncCount > 0 && (
                <span className="py-0.5 px-1.5 rounded-full bg-amber-400 text-slate-950 text-[10px] font-mono">
                  {pendingSyncCount}
                </span>
              )}
            </button>

            <button
              onClick={onOpenHourlyArchive}
              className="py-2.5 px-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Clock className="w-4 h-4 text-amber-400" />
              <span>تقارير الساعات</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onOpenMobileModal}
              className="py-2.5 px-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <span>📱 على الموبايل</span>
            </button>

            {/* LOGOUT BUTTON: Opens Custom In-Cab Handover Modal */}
            <button
              onClick={() => {
                playClickSound();
                setShowLogoutModal(true);
              }}
              className="py-2.5 px-4 rounded-xl bg-rose-700 hover:bg-rose-600 text-white font-bold text-xs md:text-sm flex items-center gap-2 transition-colors shadow-md active:scale-95 cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>🚪 خروج وتسليم المعدة</span>
            </button>
          </div>
        </footer>
      )}

      {/* ============================================================= */}
      {/* LOGOUT CONFIRMATION & SHIFT HANDOVER MODAL */}
      {/* Guarantees reliable saving locally on tablet & auto-sync when online */}
      {/* ============================================================= */}
      {/* ============================================================= */}
      {/* SCREEN: DEDICATED SHIFT LOGOUT & PARKING LOCATION SELECTION */}
      {/* Linked to Admin Parkings Master List & Synced to Google Sheets & Firestore */}
      {/* ============================================================= */}
      {showLogoutModal && currentDriver && currentTruck && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 md:p-6 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-slate-900 border-2 border-amber-500/80 rounded-3xl max-w-2xl w-full p-5 md:p-7 shadow-2xl animate-in zoom-in-95 duration-200 my-auto text-slate-100">
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 font-black">
                  <MapPin className="w-6 h-6 animate-bounce" />
                </div>
                <div>
                  <h3 className="text-lg md:text-xl font-black text-slate-100 flex items-center gap-2">
                    <span>تسليم الوردية — أين سيركن الدنبر؟</span>
                    <span className="font-mono text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-lg border border-amber-500/30 text-sm">
                      {currentTruck.id}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    اختر موقع ركنة وتوقف الدنبر لتسليم العهدة وتحديث بيانات غرفة التحكم وجوجل شيت لحظياً
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowLogoutModal(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Shift Production Summary Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4 p-3 bg-slate-950 rounded-2xl border border-slate-800 text-center">
              <div>
                <span className="text-[10px] text-slate-400 block">السائق</span>
                <strong className="text-xs text-slate-200 truncate block">{currentDriver.name}</strong>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block">عدد النقلات</span>
                <strong className="text-xs font-mono text-emerald-400 font-black">{tripsCount} نقلة</strong>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block">الحمولة الإجمالية</span>
                <strong className="text-xs font-mono text-white font-black">{totalTonnesHauled} طن</strong>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block">زمن الانتظار</span>
                <strong className="text-xs font-mono text-purple-400">{formatSeconds(accumulatedStandbySeconds)}</strong>
              </div>
            </div>

            {/* Parking Location Selection Grid */}
            <div className="mb-4">
              <label className="text-xs font-bold text-amber-300 flex items-center justify-between mb-2">
                <span className="flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-amber-400" />
                  <span>اختر مكان ركنة الدنبر الآن ({parkingLocationsList.filter(p => p.active).length} موقع متاح):</span>
                </span>
                <span className="text-[11px] text-slate-400 font-normal">مربوطة بقائمة مواقف الأدمن المركزية</span>
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-60 overflow-y-auto p-1 border border-slate-800 rounded-2xl bg-slate-950/60">
                {parkingLocationsList
                  .filter(p => p.active)
                  .map((p) => {
                    const isSelected = selectedParkingId === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          setSelectedParkingId(p.id);
                          playClickSound();
                        }}
                        className={`p-3 rounded-xl border-2 text-right transition-all flex items-center justify-between gap-2.5 cursor-pointer ${
                          isSelected
                            ? 'bg-amber-500/15 border-amber-500 text-amber-100 ring-2 ring-amber-400/40 shadow-lg'
                            : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700 hover:bg-slate-800/60'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm shrink-0 ${
                            isSelected ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-400'
                          }`}>
                            🅿️
                          </span>
                          <div className="min-w-0 truncate">
                            <div className="text-xs font-black truncate">{p.nameAr}</div>
                            <div className="text-[10px] text-slate-400 truncate flex items-center gap-1.5 mt-0.5">
                              <span className="font-mono text-amber-400/80">{p.code}</span>
                              {p.area && <span>• {p.area}</span>}
                            </div>
                          </div>
                        </div>

                        {isSelected ? (
                          <div className="w-6 h-6 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center shrink-0">
                            <Check className="w-4 h-4 stroke-[3]" />
                          </div>
                        ) : (
                          <div className="w-5 h-5 rounded-full border border-slate-700 shrink-0" />
                        )}
                      </button>
                    );
                  })}
              </div>
            </div>

            {/* Optional Driver Notes on Parking Condition */}
            <div className="mb-5">
              <label className="text-xs font-bold text-slate-300 block mb-1">
                ملاحظات عند ركن المعدة (اختياري - كحالة الدنبر أو طلب بنزينة أو صيانة للوردية التالية):
              </label>
              <input
                type="text"
                value={logoutParkingNotes}
                onChange={(e) => setLogoutParkingNotes(e.target.value)}
                placeholder="مثال: تم إيقاف الدنبر أمام الباي 2، مستوى الجاز 40%، يحتاج فحص هواء إطار خلفي"
                className="w-full py-2.5 px-3 rounded-xl bg-slate-950 border border-slate-700 text-xs text-slate-100 focus:border-amber-500 focus:outline-none"
              />
            </div>

            {/* Network / Real-time sync guarantee */}
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 mb-5 flex items-center justify-between text-xs">
              <span className="text-slate-400">المزامنة المركزية:</span>
              <span className="font-bold text-emerald-400 flex items-center gap-1">
                <span>⚡ مزامنة فورية مع لوحة تحكم الأدمن وملف Google Sheet الرسمي</span>
              </span>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={handleConfirmLogout}
                className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white font-black text-sm transition-all shadow-xl shadow-rose-900/40 flex items-center justify-center gap-2 cursor-pointer active:scale-98"
              >
                <Check className="w-5 h-5" />
                <span>تأكيد موقع الركنة وإنهاء الوردية</span>
              </button>

              <button
                type="button"
                onClick={() => setShowLogoutModal(false)}
                className="w-full py-3.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-sm transition-colors cursor-pointer border border-slate-700"
              >
                <span>الرجوع ومتابعة العمل بالوردية</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* WARNING MODAL: OUT-OF-SERVICE / INACTIVE EQUIPMENT OR DUMP */}
      {/* Allows Driver to Confirm Proceeding ("موافق") or Go Back ("رجوع") */}
      {/* ============================================================= */}
      {warningTarget && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-gradient-to-b from-rose-950 via-slate-900 to-slate-950 border-4 border-rose-500 rounded-3xl max-w-md w-full p-6 shadow-2xl text-slate-100 text-center animate-in zoom-in-95 duration-200">
            <div className="w-20 h-20 rounded-full bg-rose-600/30 border-4 border-rose-500 flex items-center justify-center mx-auto mb-4 text-4xl animate-bounce">
              ⛔
            </div>

            <div className="inline-block px-3 py-1 rounded-full bg-rose-600 text-white text-xs font-black uppercase tracking-wider mb-2">
              تنبيه وتحذير تشغيلي هام
            </div>

            <h3 className="text-xl font-black text-rose-300 mb-1">
              {warningTarget.type === 'EXCAVATOR'
                ? `معدة التحميل ${warningTarget.id} متوقفة ولا تعمل`
                : `موقع التفريغ ${warningTarget.id} مغلق / لا يعمل`}
            </h3>

            <div className="p-3 rounded-2xl bg-slate-950/90 border border-rose-500/40 my-3 text-right space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">الاسم / الكود:</span>
                <strong className="text-white font-mono text-sm">{warningTarget.id} - {warningTarget.nameAr}</strong>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">السبب / الحالة المسجلة:</span>
                <strong className="text-rose-400 font-bold">{warningTarget.statusNote}</strong>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed mb-5">
              تم تغيير حالة هذه المعدة / الموقع من قبل المشرف أو الديسباتشر إلى (غير متاح / لا يعمل).
              <br />
              <strong className="text-amber-300 font-bold">
                اضغط "رجوع" لاختيار معدة أو موقع بديل نشط، أو "موافق" إذا صدرت لك أوامر استثنائية باستخدامها.
              </strong>
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Back button (Recommended action) */}
              <button
                type="button"
                onClick={() => {
                  setWarningTarget(null);
                  playClickSound();
                }}
                className="py-3 px-4 rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-black text-sm flex items-center justify-center gap-2 cursor-pointer transition-all shadow-md active:scale-95 border border-slate-500"
              >
                <RotateCcw className="w-4 h-4 text-amber-400" />
                <span>رجوع واختيار غيرها</span>
              </button>

              {/* Confirm & Accept button */}
              <button
                type="button"
                onClick={() => {
                  playClickSound();
                  if (warningTarget.type === 'EXCAVATOR') {
                    proceedWithExcavator(warningTarget.id);
                  } else {
                    proceedWithDump(warningTarget.id);
                  }
                }}
                className="py-3 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-sm flex items-center justify-center gap-2 cursor-pointer transition-all shadow-lg shadow-rose-900/50 active:scale-95 border border-rose-400"
              >
                <Check className="w-4 h-4" />
                <span>موافق واعتماد</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* REAL-TIME FUEL STATION OCCUPANCY MODAL (Live Across All Devices) */}
      {/* ============================================================= */}
      {showStationTrucksModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-slate-900 border-2 border-sky-500 rounded-3xl max-w-lg w-full p-5 md:p-6 shadow-2xl text-slate-100 animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-sky-500/20 border border-sky-400/40 flex items-center justify-center text-sky-400 font-bold">
                  <Fuel className="w-6 h-6 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-base md:text-lg font-black text-slate-100 flex items-center gap-2">
                    <span>الدنابر المتواجدة بمحطة الوقود حالياً</span>
                    <span className="px-2 py-0.5 rounded-full bg-sky-500 text-slate-950 font-mono text-xs font-black">
                      {activeStationTrucks.length}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    تحديث حي ولحظي يظهر على شاشات جميع سائقي الأسطول
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowStationTrucksModal(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Trucks List */}
            {activeStationTrucks.length === 0 ? (
              <div className="p-8 text-center bg-slate-950 rounded-2xl border border-slate-800 text-slate-400 mb-4">
                <div className="text-3xl mb-2">🟢</div>
                <div className="font-bold text-slate-200 text-sm">محطة الوقود خالية تماماً الآن</div>
                <p className="text-xs text-slate-400 mt-1">
                  لا توجد دنابر في الطريق للبنزينة أو داخل المحطة حالياً، الطريق سالك للتفويل
                </p>
              </div>
            ) : (
              <div className="space-y-2 mb-4 max-h-64 overflow-y-auto p-1">
                {activeStationTrucks.map((st) => (
                  <div
                    key={st.truckId}
                    className="p-3 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center font-mono font-black text-amber-400 text-sm shrink-0">
                        {st.truckId}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-100 truncate">
                          {st.driverName}
                        </div>
                        <div className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                          <Clock className="w-3 h-3 text-slate-500" />
                          <span>منذ {st.elapsedMinutes} دقيقة</span>
                        </div>
                      </div>
                    </div>

                    <div className="shrink-0 text-left">
                      <span className={`px-2.5 py-1 rounded-xl text-xs font-bold flex items-center gap-1 border ${
                        st.status === 'AT_STATION'
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 animate-pulse'
                          : 'bg-sky-500/20 text-sky-300 border-sky-500/40'
                      }`}>
                        {st.status === 'AT_STATION' ? '⛽ داخل المحطة الآن' : '🚚 في الطريق للبنزينة'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Note & Close */}
            <div className="flex items-center justify-between gap-3 pt-2">
              <span className="text-[11px] text-slate-400">
                ⚡ البيانات متزامنة عبر Cloud Firestore وذاكرة التابلتات
              </span>
              <button
                type="button"
                onClick={() => setShowStationTrucksModal(false)}
                className="py-2.5 px-5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs transition-colors cursor-pointer border border-slate-700"
              >
                إغلاق النافذة
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tablet Battery Monitoring & Simulation Modal */}
      {showBatterySimModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg bg-slate-900 border-2 border-amber-500/40 rounded-3xl p-5 md:p-6 shadow-2xl text-slate-100">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <div className="flex items-center gap-2.5">
                <div className={`p-2 rounded-xl border ${
                  battery.isLowBattery ? 'bg-rose-950 text-rose-400 border-rose-500/40' : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                }`}>
                  <Battery className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-100">
                    مراقبة شحن بطارية التابلت
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    ضمان استمرار عمل الجهاز وإرسال التقارير الساعية دون انقطاع
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowBatterySimModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Current Battery Gauge Card */}
            <div className={`p-4 rounded-2xl border mb-4 ${
              battery.isLowBattery
                ? 'bg-rose-950/40 border-rose-500/60'
                : battery.charging
                ? 'bg-emerald-950/40 border-emerald-500/40'
                : 'bg-slate-950 border-slate-800'
            }`}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-slate-400 font-bold">المستوى الفعلي للشحن:</span>
                <span className={`font-mono text-2xl font-black flex items-center gap-1.5 ${
                  battery.isLowBattery
                    ? 'text-rose-400'
                    : battery.level > 50
                    ? 'text-emerald-400'
                    : 'text-amber-400'
                }`}>
                  {battery.level}%
                  {battery.charging && <span className="text-emerald-400 text-lg">⚡</span>}
                </span>
              </div>

              {/* Visual Progress Bar */}
              <div className="w-full h-3 rounded-full bg-slate-800 overflow-hidden mb-3 p-0.5 border border-slate-700">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    battery.isLowBattery
                      ? 'bg-rose-500 animate-pulse'
                      : battery.charging
                      ? 'bg-emerald-500'
                      : battery.level > 50
                      ? 'bg-emerald-500'
                      : 'bg-amber-500'
                  }`}
                  style={{ width: `${Math.max(5, Math.min(100, battery.level))}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">حالة الشاحن:</span>
                <span className={`font-bold flex items-center gap-1 ${
                  battery.charging ? 'text-emerald-400' : battery.isLowBattery ? 'text-rose-400' : 'text-slate-300'
                }`}>
                  {battery.charging ? (
                    <>
                      <Zap className="w-3.5 h-3.5 text-emerald-400" />
                      <span>متصل بالشاحن (جاري الشحن ⚡)</span>
                    </>
                  ) : (
                    <>
                      <ZapOff className="w-3.5 h-3.5 text-slate-400" />
                      <span>يعمل على البطارية الداخلية (تفريغ)</span>
                    </>
                  )}
                </span>
              </div>
            </div>

            {/* Critical Low Battery Info */}
            {battery.isLowBattery && (
              <div className="p-3 rounded-xl bg-rose-600/20 border border-rose-500/50 mb-4 text-xs text-rose-200">
                <strong className="block text-rose-100 font-bold mb-1">
                  ⚠️ تنبيه انخفاض الشحن (أقل من 20%):
                </strong>
                عند انخفاض الشحن دون 20%، يتم إطلاق هذا التنبيه المرئي فوراً لتحذير السائق لتوصيل الشاحن بكابينة الدنبر قبل إيقاف تابلت الإرسال الساعي.
              </div>
            )}

            {/* Quick Simulation / Testing Controls */}
            <div className="border-t border-slate-800 pt-3">
              <span className="block text-xs font-bold text-slate-300 mb-2">
                فحص النظام واختبار التنبيهات (Simulation & Testing):
              </span>
              <div className="grid grid-cols-2 gap-2 mb-3">
                <button
                  type="button"
                  onClick={() => {
                    battery.setSimulatedLevel(15);
                    battery.setSimulatedCharging(false);
                  }}
                  className="p-2 rounded-xl bg-rose-950/70 hover:bg-rose-900 border border-rose-500/60 text-rose-200 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <BatteryWarning className="w-3.5 h-3.5 text-rose-400" />
                  <span>محاكاة 15% (تنبيه منخفض)</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    battery.setSimulatedLevel(8);
                    battery.setSimulatedCharging(false);
                  }}
                  className="p-2 rounded-xl bg-red-950/80 hover:bg-red-900 border border-red-500 text-red-200 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                  <span>محاكاة 8% (حرج جداً)</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    battery.setSimulatedLevel(85);
                  }}
                  className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Battery className="w-3.5 h-3.5 text-emerald-400" />
                  <span>محاكاة 85% (طبيعي)</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    battery.setSimulatedCharging(!battery.charging);
                  }}
                  className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Zap className="w-3.5 h-3.5 text-amber-400" />
                  <span>{battery.charging ? 'فصل الشاحن 🔌' : 'توصيل الشاحن ⚡'}</span>
                </button>
              </div>

              {battery.isSimulated && (
                <button
                  type="button"
                  onClick={() => battery.setSimulatedLevel(null)}
                  className="w-full py-2 px-3 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-slate-200 text-xs transition-colors cursor-pointer border border-slate-700 flex items-center justify-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>استعادة قراءة بطارية الجهاز الأصلية (Hardware Battery)</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Dispatcher Direct Message Pop-up Modal */}
      {showDirectMessageModal && incomingDirectMessage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
          <div className={`relative w-full max-w-lg bg-slate-900 border-4 rounded-3xl p-6 shadow-2xl text-slate-100 animate-in zoom-in-95 ${
            incomingDirectMessage.targetTruckId !== 'ALL'
              ? 'border-indigo-500 shadow-indigo-950/50'
              : 'border-amber-500 shadow-amber-950/50'
          }`}>
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-2xl border flex items-center justify-center font-bold animate-pulse ${
                  incomingDirectMessage.targetTruckId !== 'ALL'
                    ? 'bg-indigo-500/20 border-indigo-400 text-indigo-400'
                    : 'bg-amber-500/20 border-amber-500/40 text-amber-400'
                }`}>
                  <Radio className="w-7 h-7" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`py-0.5 px-2 rounded-full text-xs font-black ${
                      incomingDirectMessage.priority === 'CRITICAL'
                        ? 'bg-rose-500 text-white'
                        : incomingDirectMessage.priority === 'URGENT'
                        ? 'bg-amber-500 text-slate-950'
                        : 'bg-indigo-500 text-white'
                    }`}>
                      {incomingDirectMessage.priority === 'CRITICAL'
                        ? 'إنذار طارئ جداً'
                        : incomingDirectMessage.priority === 'URGENT'
                        ? 'تعليمات عاجلة'
                        : 'معلومة إدارية'}
                    </span>
                    <span className="text-xs font-mono text-slate-400">
                      {new Date(incomingDirectMessage.timestamp).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-slate-100 mt-1">
                    {incomingDirectMessage.sender.includes('Admin') || incomingDirectMessage.sender.includes('إدارة')
                      ? 'رسالة إدارية رسمية (Admin)'
                      : 'تعليمات فورية من غرفة التحكم (Dispatcher)'}
                  </h3>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {incomingDirectMessage.targetTruckId !== 'ALL' && (
                  <span className="py-1 px-2.5 rounded-xl bg-indigo-950 text-indigo-300 border border-indigo-500/40 text-[10px] font-black">
                    خاصة بتابلتك فقط 🔒
                  </span>
                )}
                <span className="py-1 px-2 rounded-xl bg-teal-950/80 text-teal-300 border border-teal-500/40 text-[10px] font-mono flex items-center gap-1">
                  🛡️ مشفر E2EE
                </span>
              </div>
            </div>

            {incomingDirectMessage.targetTruckId !== 'ALL' && (
              <div className="mb-3 py-1 px-3 rounded-lg bg-indigo-950/60 border border-indigo-500/30 text-[11px] text-indigo-200 flex items-center gap-1.5">
                <span>🔒</span>
                <span>
                  <strong>تنبيه خصوصية:</strong> هذه المعلومة مرسلة خصيصاً لشاحنتك ({incomingDirectMessage.targetTruckId}) وتظهر على تابلتك أنت فقط دون باقي الأسطول.
                </span>
              </div>
            )}

            <div className={`p-4 rounded-2xl bg-slate-950 border mb-5 shadow-inner ${
              incomingDirectMessage.targetTruckId !== 'ALL'
                ? 'border-indigo-500/50'
                : 'border-amber-500/50'
            }`}>
              <div className="text-xs text-slate-400 mb-1 font-bold">نص التعليمات / المعلومة الموجهة لك:</div>
              <p className="text-base md:text-lg font-black text-amber-300 leading-relaxed">
                "{incomingDirectMessage.messageText}"
              </p>
              <div className="text-[11px] text-slate-500 mt-3 pt-2 border-t border-slate-800 flex justify-between">
                <span>المرسل: {incomingDirectMessage.sender}</span>
                <span>الموجه إليه: {incomingDirectMessage.targetTruckId === 'ALL' ? 'جميع الدنابر' : `دنبر ${incomingDirectMessage.targetTruckId} فقط`}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                acknowledgeDispatcherMessage(incomingDirectMessage.id);
                acknowledgeCloudMessage(
                  incomingDirectMessage.id,
                  currentDriver?.name || 'سائق'
                );
                setShowDirectMessageModal(false);
                playClickSound();
                showAlert('تم تأكيد استلام التعليمات وإشعار غرفة التحكم فوراً ✅', 'SUCCESS');
              }}
              className="w-full py-4 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-base shadow-xl flex items-center justify-center gap-2 cursor-pointer active:scale-98 transition-transform"
            >
              <CheckCircle2 className="w-6 h-6" />
              <span>استلمت ونفذت التعليمات ✅ (Acknowledge)</span>
            </button>
          </div>
        </div>
      )}

      {/* Session Conflict Modal: Prevent 2 devices opening same truck account */}
      {sessionConflict && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-md bg-slate-900 border-4 border-rose-500 rounded-3xl p-6 shadow-2xl text-slate-100 text-center animate-in zoom-in-95">
            <div className="w-16 h-16 rounded-full bg-rose-500/20 border-2 border-rose-500 flex items-center justify-center mx-auto mb-4 text-rose-400 animate-pulse">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-black text-rose-400 mb-2">
              تنبيه أجهزة: حساب المعدة قيد الاستخدام بجهاز آخر!
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed mb-4">
              تم فتح حساب هذه المعدة ({currentTruck?.id || selectedTruckId}) من تابلت أو جهاز آخر في المنجم بواسطة:
              <strong className="block text-sm text-amber-400 font-bold mt-1">
                {sessionConflict.driverName} (كود: {sessionConflict.driverCode})
              </strong>
              تم تعليق الجلسة على هذا التابلت لمنع تكرار الحسابات وتسجيل الحمولات المزدوجة.
            </p>
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => {
                  if (currentTruck && currentDriver) {
                    claimEquipmentSession(currentTruck.id, 'TRUCK', currentDriver.code, currentDriver.name, true);
                  }
                  setSessionConflict(null);
                  showAlert('تم استرداد التحكم والعمل من هذا التابلت بنجاح ✅', 'SUCCESS');
                }}
                className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-sm cursor-pointer shadow-lg transition-transform active:scale-98"
              >
                استعادة التحكم من هذا التابلت (Force Takeover)
              </button>
              <button
                type="button"
                onClick={() => {
                  setSessionConflict(null);
                  handleConfirmLogout();
                }}
                className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs cursor-pointer border border-slate-700"
              >
                تسجيل الخروج والرجوع لشاشة الدخول
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Emergency SOS Confirmation Modal */}
      {showSosConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-md bg-gradient-to-b from-rose-950 via-slate-900 to-slate-950 border-4 border-red-500 rounded-3xl p-6 shadow-2xl text-slate-100 text-center animate-in zoom-in-95">
            <div className="w-20 h-20 rounded-full bg-red-600/30 border-4 border-red-500 flex items-center justify-center mx-auto mb-4 text-4xl animate-bounce">
              🆘
            </div>
            <h3 className="text-xl font-black text-red-400 mb-2">
              نداء طوارئ واستغاثة عاجل (SOS)
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed mb-4">
              سيتم إرسال إشارة استغاثة قصوى فوراً إلى غرفة الدسباتش والأدمن، وتشغيل سارينة إنذار مستمرة على التابلت حتى يتم تأكيد الاستلام من المراقب.
            </p>
            <div className="p-3 rounded-2xl bg-slate-950 border border-red-500/30 text-xs text-right space-y-1 mb-5">
              <div>الدنبر: <strong className="text-amber-400 font-mono">{currentTruck?.id || selectedTruckId}</strong></div>
              <div>السائق: <strong className="text-white">{currentDriver?.name || 'سائق الكابينة'}</strong> (كود: {currentDriver?.code})</div>
            </div>
            <div className="space-y-3">
              <button
                type="button"
                onClick={handleTriggerSosEmergency}
                disabled={isSendingSos}
                className="w-full py-4 rounded-2xl bg-gradient-to-r from-red-600 via-rose-600 to-red-600 hover:from-red-500 hover:to-rose-500 text-white font-black text-base shadow-2xl shadow-red-900/60 cursor-pointer active:scale-95 transition-transform border border-red-400 flex items-center justify-center gap-2"
              >
                <span className="text-xl">🚨</span>
                <span>{isSendingSos ? 'جاري الإرسال...' : 'تأكيد إرسال استغاثة SOS وتشغيل الإنذار'}</span>
              </button>
              <button
                type="button"
                onClick={() => setShowSosConfirmModal(false)}
                className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs cursor-pointer border border-slate-700"
              >
                إلغاء وتراجع
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
