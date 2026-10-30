import React, { useState, useEffect } from 'react';
import {
  Truck as TruckIcon,
  HardHat,
  Mountain,
  Clock,
  Download,
  Search,
  Radio,
  Send,
  SlidersHorizontal,
  ChevronDown,
  Layers,
  Sparkles,
  BarChart3,
  Flame,
  CheckCircle2,
  Fuel,
  Navigation,
  Target,
  ExternalLink,
  FileSpreadsheet,
  Calendar,
  LogOut,
} from 'lucide-react';
import {
  Driver,
  Truck,
  Excavator,
  DumpLocation,
  TripLog,
  DispatchAlert,
  EquipmentAlert,
  FuelingLog,
  DispatcherUser,
} from '../types/dispatch';
import {
  generateTripsCSV,
  downloadCSV,
  saveDispatchAlerts,
  openWhatsAppShare,
  generateHourlyFormattedText,
  getAppConfig,
  getActiveFuelingTrucks,
  subscribeToDataChanges,
  getCustomTrucksOrder,
  saveCustomTrucksOrder,
  getCustomExcavatorsOrder,
  saveCustomExcavatorsOrder,
  getTruckExcavatorAssignments,
  assignTrucksToExcavator,
  getEquipmentInterventions,
  sendDispatcherMessage,
} from '../utils/storage';
import { playClickSound, playDispatchAlertSound, playLoadConfirmedSound } from '../utils/audio';
import { getStoredSheetsConfig, GoogleSheetsConfig } from '../utils/googleSheets';
import { ProductionGapAlertsPanel } from './ProductionGapAlertsPanel';
import { FuelingMonitoringPanel } from './FuelingMonitoringPanel';
import { DispatcherMessengerWidget } from './DispatcherMessengerWidget';
import { MineGpsSimulationMap } from './MineGpsSimulationMap';
import { ExcavatorTargetsModal } from './ExcavatorTargetsModal';
import { GoogleSheetsModal } from './GoogleSheetsModal';
import { ProductivityChartsTab } from './ProductivityChartsTab';
import { ShiftManagementModal } from './ShiftManagementModal';
import { TruckExcavatorAssignmentModal } from './TruckExcavatorAssignmentModal';
import { InterventionsModal } from './InterventionsModal';
import { DispatcherMessengerModal } from './DispatcherMessengerModal';
import {
  subscribeToEquipmentPresence,
  EquipmentPresenceInfo,
  sendCloudDispatcherMessage,
  subscribeToEmergencySos,
  acknowledgeEmergencySos,
  EmergencySosAlert,
} from '../utils/firebaseSync';

interface Props {
  drivers: Driver[];
  trucks: Truck[];
  excavators: Excavator[];
  dumps: DumpLocation[];
  trips: TripLog[];
  alerts: DispatchAlert[];
  equipmentAlerts: EquipmentAlert[];
  onAlertsChanged: (alerts: DispatchAlert[]) => void;
  nextHourFormatted: string;
  onForceHourlySync: () => void;
  onOpenAdmin: () => void;
  onOpenMobileModal: () => void;
  onOpenHourlyArchive: () => void;
  onOpenEquipmentAlerts: () => void;
  onNavigateToDashboard?: () => void;
  activeDispatcher?: DispatcherUser | null;
  onDispatcherLogout?: () => void;
}

export const DispatcherControlRoom: React.FC<Props> = ({
  drivers,
  trucks,
  excavators,
  dumps,
  trips,
  alerts,
  equipmentAlerts,
  onAlertsChanged,
  nextHourFormatted,
  onForceHourlySync,
  onOpenAdmin,
  onOpenMobileModal,
  onOpenHourlyArchive,
  onOpenEquipmentAlerts,
  onNavigateToDashboard,
  activeDispatcher,
  onDispatcherLogout,
}) => {
  const [fleetTab, setFleetTab] = useState<'TRUCKS' | 'LOADERS' | 'CHARTS'>('TRUCKS');
  const [truckStatusFilter, setTruckStatusFilter] = useState<
    'ALL' | 'ACTIVE' | 'FUELING' | 'STANDBY_QUEUE' | 'BREAKDOWN' | 'MAINTENANCE'
  >('ALL');
  const [filterMaterial, setFilterMaterial] = useState<string>('ALL');
  const [filterTruck, setFilterTruck] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [broadcastText, setBroadcastText] = useState('');
  const [broadcastPriority, setBroadcastPriority] = useState<'NORMAL' | 'URGENT'>('NORMAL');
  const [broadcastTarget, setBroadcastTarget] = useState<'ALL' | 'TRUCKS_ALL' | 'EXCAVATORS_ALL'>('ALL');

  // Emergency SOS Realtime Beacon State
  const [sosAlerts, setSosAlerts] = useState<EmergencySosAlert[]>([]);
  const [isAcknowledgingSos, setIsAcknowledgingSos] = useState<boolean>(false);

  // Real-time Presence map from Firebase
  const [presenceMap, setPresenceMap] = useState<Record<string, EquipmentPresenceInfo>>({});

  // New modules states
  const [selectedTruckForMessage, setSelectedTruckForMessage] = useState<string | null>(null);
  const [isMessengerModalOpen, setIsMessengerModalOpen] = useState(false);
  const [isAssignmentModalOpen, setIsAssignmentModalOpen] = useState(false);
  const [assignmentTargetExcavatorId, setAssignmentTargetExcavatorId] = useState<string | null>(null);
  const [assignmentFeedback, setAssignmentFeedback] = useState<string | null>(null);
  const [isInterventionsModalOpen, setIsInterventionsModalOpen] = useState(false);
  const [interventionPreselectedUnitId, setInterventionPreselectedUnitId] = useState<string | null>(null);
  const [interventionsList, setInterventionsList] = useState(getEquipmentInterventions());
  const [truckAssignments, setTruckAssignments] = useState(getTruckExcavatorAssignments());
  const [isTargetsModalOpen, setIsTargetsModalOpen] = useState(false);
  const [isGoogleSheetsModalOpen, setIsGoogleSheetsModalOpen] = useState(false);
  const [isShiftModalOpen, setIsShiftModalOpen] = useState(false);
  const [sheetsConfig, setSheetsConfig] = useState<GoogleSheetsConfig | null>(getStoredSheetsConfig());
  const [activeFuelings, setActiveFuelings] = useState<FuelingLog[]>(getActiveFuelingTrucks());

  // HTML5 Drag & Drop State for Trucks and Excavators
  const [trucksOrder, setTrucksOrder] = useState<string[]>(() => {
    const saved = getCustomTrucksOrder();
    return saved.length > 0 ? saved : trucks.map(t => t.id);
  });

  const [excavatorsOrder, setExcavatorsOrder] = useState<string[]>(() => {
    const saved = getCustomExcavatorsOrder();
    return saved.length > 0 ? saved : excavators.map(e => e.id);
  });

  const [draggedTruckId, setDraggedTruckId] = useState<string | null>(null);
  const [draggedExcavatorId, setDraggedExcavatorId] = useState<string | null>(null);
  const [dragOverTruckId, setDragOverTruckId] = useState<string | null>(null);
  const [dragOverExcavatorId, setDragOverExcavatorId] = useState<string | null>(null);

  // Live updates subscription
  useEffect(() => {
    const refreshFuel = () => setActiveFuelings(getActiveFuelingTrucks());
    refreshFuel();

    // Subscribe to cloud equipment presence (Online / Offline status)
    const unsubPresence = subscribeToEquipmentPresence((map) => {
      setPresenceMap(map);
    });

    // Subscribe to cloud emergency SOS alerts from any truck in the mine
    const unsubSos = subscribeToEmergencySos((alertsList) => {
      setSosAlerts(alertsList);
      const unack = alertsList.find(a => !a.acknowledged && a.status === 'ACTIVE');
      if (unack) {
        playDispatchAlertSound();
      }
    });

    const unsub = subscribeToDataChanges(event => {
      if (event.type === 'FUELING_LOGS_UPDATED' || event.type === 'TRUCKS_UPDATED') {
        refreshFuel();
      }
      if (event.type === 'TRUCKS_ORDER_UPDATED') {
        setTrucksOrder(getCustomTrucksOrder());
      }
      if (event.type === 'EXCAVATORS_ORDER_UPDATED') {
        setExcavatorsOrder(getCustomExcavatorsOrder());
      }
      if (event.type === 'GOOGLE_SHEETS_CONFIG_UPDATED') {
        setSheetsConfig(getStoredSheetsConfig());
      }
      if (event.type === 'EQUIPMENT_INTERVENTIONS_UPDATED') {
        setInterventionsList(getEquipmentInterventions());
      }
      if (event.type === 'TRUCK_ASSIGNMENTS_UPDATED') {
        setTruckAssignments(getTruckExcavatorAssignments());
      }
    });

    return () => {
      unsub();
      unsubPresence();
      unsubSos();
    };
  }, []);

  // Handle Dispatcher one-click SOS Acknowledgement
  const handleAcknowledgeSos = async (alertId: string) => {
    setIsAcknowledgingSos(true);
    playClickSound();
    try {
      await acknowledgeEmergencySos(alertId, 'غرفة الدسباتش (المراقب الميداني)');
    } catch (err) {
      console.error('Failed to acknowledge SOS:', err);
    } finally {
      setIsAcknowledgingSos(false);
    }
  };

  // Direct 1-click loading unit assignment per dump truck with automated dispatch messaging
  const handleQuickAssignTruck = (truckId: string, targetExcavatorId: string) => {
    const truckObj = trucks.find(t => t.id === truckId);
    const isOutOfService = truckObj?.status === 'BREAKDOWN' || truckObj?.status === 'MAINTENANCE';

    if (isOutOfService && targetExcavatorId !== 'UNASSIGNED') {
      playDispatchAlertSound();
      setAssignmentFeedback(`⛔ تنبيه: الدنبر ${truckId} مسجل في حالة (عطل / صيانة خارج الخدمة) ولا يمكن تعيينه للتحميل.`);
      setTimeout(() => setAssignmentFeedback(null), 4000);
      return;
    }

    playLoadConfirmedSound();

    if (!targetExcavatorId || targetExcavatorId === 'UNASSIGNED') {
      assignTrucksToExcavator([truckId], 'UNASSIGNED');
      setTruckAssignments(getTruckExcavatorAssignments());
      setAssignmentFeedback(`⚪ تم إلغاء تخصيص الدنبر ${truckId} وأصبح في وضع التحميل الحر.`);
      setTimeout(() => setAssignmentFeedback(null), 4000);
      return;
    }

    const targetEx = excavators.find(e => e.id === targetExcavatorId);
    assignTrucksToExcavator(
      [truckId],
      targetExcavatorId,
      activeDispatcher?.name || 'غرفة العمليات المركزية',
      activeDispatcher?.code || 'DSP',
      targetEx?.benchLevel,
      undefined,
      `تخصيص مباشر من بطاقة الدنبر بواسطة ${activeDispatcher?.name || 'الديسباتشر'}`
    );
    setTruckAssignments(getTruckExcavatorAssignments());

    // Send immediate urgent voice/dispatch instruction to the truck tablet
    const driverName = truckObj?.assignedDriver;
    const benchDesc = targetEx?.benchLevel ? `بموقع (${targetEx.benchLevel})` : 'في الحفرة المفتوحة';
    const modelDesc = targetEx?.model ? `طراز ${targetEx.model}` : 'معدة تحميل';
    const msgText = `🚨 أمر تشغيل فوري: تم تعيينك للعمل مع معدة التحميل [${targetExcavatorId}] (${modelDesc}) ${benchDesc}. توجه فوراً للمعدة لبدء التحميل.`;

    sendDispatcherMessage(
      truckId,
      msgText,
      'URGENT',
      activeDispatcher?.name ? `الديسباتشر: ${activeDispatcher.name}` : 'غرفة الدسباتش المركزي',
      driverName
    );

    setAssignmentFeedback(`✅ تم تعيين الدنبر ${truckId} للعمل مع المعدة [${targetExcavatorId}] وإرسال أمر التحميل الفوري لكابينة السائق 📢`);
    setTimeout(() => setAssignmentFeedback(null), 5000);
  };

  const handleQuickAddFreeTruckToExcavator = (excavatorId: string) => {
    playClickSound();
    const currentAssignments = getTruckExcavatorAssignments();
    // Find first truck with no assigned excavator
    const freeTruck = trucks.find(t => !currentAssignments[t.id]?.excavatorId);
    if (!freeTruck) {
      alert('جميع الدنابر الـ 60 مخصصة بالفعل لحفارات، لا توجد دنابر حرة حالياً.');
      return;
    }
    const targetEx = excavators.find(e => e.id === excavatorId);
    assignTrucksToExcavator(
      [freeTruck.id],
      excavatorId,
      activeDispatcher?.name || 'غرفة العمليات',
      activeDispatcher?.code || 'DSP',
      targetEx?.benchLevel,
      undefined,
      `تخصيص سريع مباشر بواسطة ${activeDispatcher?.name || 'الديسباتشر'}`
    );
    setTruckAssignments(getTruckExcavatorAssignments());
  };

  const handleClearExcavatorTrucks = (excavatorId: string) => {
    playClickSound();
    const currentAssignments = getTruckExcavatorAssignments();
    const trucksToClear = Object.values(currentAssignments)
      .filter(a => a.excavatorId === excavatorId)
      .map(a => a.truckId);
    if (trucksToClear.length > 0) {
      assignTrucksToExcavator(trucksToClear, 'UNASSIGNED');
      setTruckAssignments(getTruckExcavatorAssignments());
    }
  };

  const activeBreakdownsCount = equipmentAlerts.filter(a => !a.resolved && (a.status === 'BREAKDOWN' || a.status === 'MAINTENANCE')).length;

  // Reordering logic with localStorage persistence
  const handleTruckDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData('text/plain', id);
    e.dataTransfer.effectAllowed = 'move';
    setDraggedTruckId(id);
  };

  const handleTruckDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverTruckId !== id) {
      setDragOverTruckId(id);
    }
  };

  const handleTruckDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    const sourceId = draggedTruckId || e.dataTransfer.getData('text/plain');
    if (!sourceId || sourceId === targetId) {
      setDraggedTruckId(null);
      setDragOverTruckId(null);
      return;
    }

    const currentList = trucksOrder.length > 0 ? [...trucksOrder] : trucks.map(t => t.id);
    const sourceIdx = currentList.indexOf(sourceId);
    const targetIdx = currentList.indexOf(targetId);

    if (sourceIdx !== -1 && targetIdx !== -1) {
      currentList.splice(sourceIdx, 1);
      currentList.splice(targetIdx, 0, sourceId);
      setTrucksOrder(currentList);
      saveCustomTrucksOrder(currentList);
    }

    setDraggedTruckId(null);
    setDragOverTruckId(null);
  };

  const handleResetTrucksOrder = () => {
    const defaultOrder = trucks.map(t => t.id);
    setTrucksOrder(defaultOrder);
    saveCustomTrucksOrder(defaultOrder);
  };

  const handleExcavatorDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData('text/plain', id);
    e.dataTransfer.effectAllowed = 'move';
    setDraggedExcavatorId(id);
  };

  const handleExcavatorDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverExcavatorId !== id) {
      setDragOverExcavatorId(id);
    }
  };

  const handleExcavatorDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    const sourceId = draggedExcavatorId || e.dataTransfer.getData('text/plain');
    if (!sourceId || sourceId === targetId) {
      setDraggedExcavatorId(null);
      setDragOverExcavatorId(null);
      return;
    }

    const currentList = excavatorsOrder.length > 0 ? [...excavatorsOrder] : excavators.map(e => e.id);
    const sourceIdx = currentList.indexOf(sourceId);
    const targetIdx = currentList.indexOf(targetId);

    if (sourceIdx !== -1 && targetIdx !== -1) {
      currentList.splice(sourceIdx, 1);
      currentList.splice(targetIdx, 0, sourceId);
      setExcavatorsOrder(currentList);
      saveCustomExcavatorsOrder(currentList);
    }

    setDraggedExcavatorId(null);
    setDragOverExcavatorId(null);
  };

  const handleResetExcavatorsOrder = () => {
    const defaultOrder = excavators.map(e => e.id);
    setExcavatorsOrder(defaultOrder);
    saveCustomExcavatorsOrder(defaultOrder);
  };

  // Ordered trucks and excavators according to custom drag & drop sequence
  const orderedTrucks = [...trucks].sort((a, b) => {
    const indexA = trucksOrder.indexOf(a.id);
    const indexB = trucksOrder.indexOf(b.id);
    if (indexA === -1 && indexB === -1) return 0;
    if (indexA === -1) return 1;
    if (indexB === -1) return -1;
    return indexA - indexB;
  });

  const orderedExcavators = [...excavators].sort((a, b) => {
    const indexA = excavatorsOrder.indexOf(a.id);
    const indexB = excavatorsOrder.indexOf(b.id);
    if (indexA === -1 && indexB === -1) return 0;
    if (indexA === -1) return 1;
    if (indexB === -1) return -1;
    return indexA - indexB;
  });

  // Compute Production KPIs
  const totalTonnes = trips.reduce((sum, t) => sum + (t.payloadTonnes || 0), 0);
  const totalTrips = trips.length;
  const oreTonnes = trips
    .filter(t => t.material !== 'WASTE')
    .reduce((sum, t) => sum + (t.payloadTonnes || 0), 0);
  const wasteTonnes = trips
    .filter(t => t.material === 'WASTE')
    .reduce((sum, t) => sum + (t.payloadTonnes || 0), 0);

  const orePercentage = totalTonnes > 0 ? Math.round((oreTonnes / totalTonnes) * 100) : 0;
  const wastePercentage = totalTonnes > 0 ? 100 - orePercentage : 0;

  const avgCycleMinutes = trips.length > 0
    ? Math.round((trips.reduce((sum, t) => sum + t.cycleTimeMinutes, 0) / trips.length) * 10) / 10
    : 0;

  const totalStandbyMinutes = Math.round(
    trips.reduce((sum, t) => sum + (t.standbyDurationSec || 0), 0) / 60
  );

  // Filtered trips
  const filteredTrips = trips.filter(t => {
    if (filterMaterial !== 'ALL' && t.material !== filterMaterial) return false;
    if (filterTruck !== 'ALL' && t.truckId !== filterTruck) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchDriver = t.driverName.toLowerCase().includes(q) || t.driverCode.includes(q);
      const matchTruck = t.truckId.toLowerCase().includes(q);
      const matchShovel = t.excavatorId.toLowerCase().includes(q);
      const matchDump = t.dumpLocationId.toLowerCase().includes(q);
      return matchDriver || matchTruck || matchShovel || matchDump;
    }
    return true;
  });

  const handleExportFullCSV = () => {
    const csv = generateTripsCSV(filteredTrips, 'سجل_دسباتش_منجم_السكري_الكامل');
    downloadCSV(csv, `سجل_رحلات_دسباتش_السكري_${new Date().toISOString().split('T')[0]}.csv`);
  };

  const handleSendBroadcast = (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastText.trim()) return;

    const newAlert: DispatchAlert = {
      id: `ALERT-${Date.now()}`,
      timestamp: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
      sender: 'المراقب الميداني (Control Room)',
      messageAr: broadcastText.trim(),
      priority: broadcastPriority,
      active: true,
    };

    const updated = [newAlert, ...alerts.slice(0, 9)];
    onAlertsChanged(updated);
    saveDispatchAlerts(updated);

    // Also broadcast over Cloud Firestore to all devices in the field
    sendCloudDispatcherMessage(
      broadcastTarget,
      broadcastText.trim(),
      broadcastPriority === 'URGENT' ? 'URGENT' : 'NORMAL',
      'المراقب الميداني (Control Room)'
    ).catch(err => console.warn('Cloud broadcast warn:', err));

    setBroadcastText('');
    playDispatchAlertSound();
  };

  return (
    <div className="flex-1 flex flex-col p-3 md:p-6 max-w-7xl mx-auto w-full space-y-6">
      {/* Real-time Emergency SOS Beacon Alerts from any Truck in the mine */}
      {sosAlerts.filter(a => !a.acknowledged && a.status === 'ACTIVE').length > 0 && (
        <div className="space-y-3">
          {sosAlerts
            .filter(a => !a.acknowledged && a.status === 'ACTIVE')
            .map((sos) => (
              <div
                key={sos.id}
                className="bg-gradient-to-r from-rose-950 via-red-900 to-rose-950 border-4 border-red-500 rounded-2xl p-4 md:p-5 shadow-2xl animate-pulse flex flex-col md:flex-row items-center justify-between gap-4"
              >
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-red-600 border-2 border-white flex items-center justify-center text-3xl font-black text-white shrink-0 animate-bounce shadow-xl">
                    🆘
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-lg md:text-xl font-black text-white tracking-wide">
                        🚨 إشارة استغاثة وطوارئ عاجلة (SOS) من الدنبر [{sos.truckId}]
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full bg-red-600 text-white text-xs font-mono font-black animate-ping">
                        CRITICAL SOS
                      </span>
                    </div>
                    <p className="text-sm text-red-100 mt-1">
                      السائق: <strong>{sos.driverName}</strong> (كود: {sos.driverCode}) — {sos.message}
                    </p>
                    <div className="text-xs text-red-300 mt-0.5 font-mono">
                      وقت النداء: {new Date(sos.timestamp).toLocaleTimeString('ar-EG')} — سارينة الإنذار تعمل حالياً بكابينة السائق حتى تأكيد الاستلام!
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleAcknowledgeSos(sos.id)}
                    disabled={isAcknowledgingSos}
                    className="py-3 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm flex items-center gap-2 shadow-2xl cursor-pointer active:scale-95 transition-transform border border-emerald-400"
                  >
                    <CheckCircle2 className="w-5 h-5 text-white" />
                    <span>{isAcknowledgingSos ? 'جاري التأكيد...' : 'تأكيد الاستلام وإيقاف الإنذار 🛑'}</span>
                  </button>
                </div>
              </div>
            ))}
        </div>
      )}

      {/* Top Banner & Quick Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg">
        {/* Active Dispatcher Info & Prominent Logout Strip */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 px-4 rounded-xl bg-slate-950 border border-amber-500/40 w-full shadow-inner">
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <div>
              <span className="text-xs text-slate-400">الديسباتشر المسؤول: </span>
              <strong className="text-sm font-black text-amber-400">
                {activeDispatcher?.name || 'غرفة العمليات المركزية'}
              </strong>
              {activeDispatcher && (
                <span className="mr-2 font-mono text-xs bg-slate-800 px-2 py-0.5 rounded text-slate-300 border border-slate-700">
                  كود: {activeDispatcher.code}
                </span>
              )}
              <span className="mr-2 text-[11px] text-emerald-400 font-bold">
                (تسجيل التقارير والشيتات باسمه)
              </span>
            </div>
          </div>

          {onDispatcherLogout && (
            <button
              type="button"
              onClick={onDispatcherLogout}
              className="py-2 px-5 rounded-xl bg-gradient-to-r from-rose-600 via-red-600 to-rose-700 hover:from-rose-500 hover:to-red-500 text-white font-black text-xs md:text-sm flex items-center gap-2 shadow-xl shadow-rose-950/60 cursor-pointer active:scale-95 transition-all border-2 border-rose-400"
              title="تسجيل خروج الديسباتشر والعودة لشاشة السائق"
            >
              <LogOut className="w-4 h-4 text-white" />
              <span>تسجيل خروج الديسباتشر 🚪</span>
            </button>
          )}
        </div>

        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-black text-slate-100 flex items-center gap-2">
              <span className="text-amber-400">⚡</span>
              غرفة المراقبة والدسباتش المركزي — منجم السكري
            </h2>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">
              متصل لحظياً
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            متابعة حية لأسطول النقل والتحميل بمصاطب الحفرة المفتوحة (Open Pit) والمزامنة الساعية للوردية
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Dispatcher Direct Messenger Button */}
          <button
            type="button"
            onClick={() => {
              playClickSound();
              setIsMessengerModalOpen(true);
            }}
            className="py-2 px-3.5 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white font-black text-xs flex items-center gap-1.5 transition-all shadow-md cursor-pointer border border-indigo-400"
            title="إرسال رسائل وتعليمات فورية مشفرة بكابينة السائق مع تلاوة صوتية"
          >
            <span>💬 رسائل الدنابر والأسطول</span>
          </button>

          {/* Dynamic Truck-to-Excavator Fleet Assignment Button */}
          <button
            type="button"
            onClick={() => {
              playClickSound();
              setIsAssignmentModalOpen(true);
            }}
            className="py-2 px-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs flex items-center gap-1.5 transition-all shadow-md cursor-pointer border border-amber-300"
            title="توزيع أسطول الدنابر على الحفارات وإظهار الحفار في تابلت السائق"
          >
            <span>🚜 توزيع الأسطول على الحفارات</span>
          </button>

          {/* Equipment Interventions & Manual Corrective Actions Button */}
          <button
            type="button"
            onClick={() => {
              playClickSound();
              setInterventionPreselectedUnitId(null);
              setIsInterventionsModalOpen(true);
            }}
            className="py-2 px-3.5 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white font-black text-xs flex items-center gap-1.5 transition-all shadow-md cursor-pointer border border-teal-400"
            title="سجل الحلول والإجراءات الميدانية للمعدات المتأخرة وتوثيق من اقترح ومن اعتمد"
          >
            <span>🛠️ سجل الحلول والإجراءات</span>
            {interventionsList.length > 0 && (
              <span className="py-0.5 px-1.5 rounded-full bg-slate-950 text-teal-300 font-mono text-[10px]">
                {interventionsList.length}
              </span>
            )}
          </button>

          {/* Equipment Status Alerts Button */}
          <button
            onClick={onOpenEquipmentAlerts}
            className={`py-2 px-3.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer ${
              activeBreakdownsCount > 0
                ? 'bg-rose-600 hover:bg-rose-500 text-white animate-pulse'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
            }`}
          >
            <span>🚨 حالات المعدات</span>
            {activeBreakdownsCount > 0 && (
              <span className="py-0.5 px-1.5 rounded-full bg-slate-950 text-rose-300 font-mono text-[10px]">
                {activeBreakdownsCount} متوقف
              </span>
            )}
          </button>

          {/* Google Sheets Live Integration Button */}
          <button
            onClick={() => {
              playClickSound();
              setIsGoogleSheetsModalOpen(true);
            }}
            className={`py-2 px-3.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer ${
              sheetsConfig?.spreadsheetId
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white ring-1 ring-emerald-400'
                : 'bg-emerald-700/80 hover:bg-emerald-600 text-emerald-100 border border-emerald-500/50'
            }`}
            title="مزامنة لحظية مستمرة لبيانات الإنتاج والرحلات وحضور السائقين إلى Google Sheets"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-300" />
            <span>{sheetsConfig?.spreadsheetId ? '🟢 متصل بجوجل شيت' : 'ربط جوجل شيت 📊'}</span>
          </button>

          {sheetsConfig?.spreadsheetUrl && (
            <a
              href={sheetsConfig.spreadsheetUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-emerald-500/40 font-bold text-xs flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer"
              title="فتح ملف Google Sheets المربوط على Google Drive"
            >
              <span>فتح الشيت ↗️</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}

          {/* Shift Management Button */}
          <button
            onClick={() => {
              playClickSound();
              setIsShiftModalOpen(true);
            }}
            className="py-2 px-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer"
            title="إدارة وتسجيل الورديات ومحاضر التسليم والتسلم للمعدات"
          >
            <Calendar className="w-4 h-4 text-indigo-200" />
            <span>📋 إدارة الورديات</span>
          </button>

          {/* Excavator Targets Modal Button */}
          <button
            onClick={() => {
              playClickSound();
              setIsTargetsModalOpen(true);
            }}
            className="py-2 px-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer"
            title="تحديد ومتابعة الأهداف الإنتاجية لكل حفار"
          >
            <Target className="w-4 h-4" />
            <span>🎯 أهداف الحفارات</span>
          </button>

          {/* Hourly Countdown Badge */}
          <div className="py-2 px-3.5 rounded-xl bg-slate-950 border border-slate-800 text-xs flex items-center gap-2">
            <Clock className="w-4 h-4 text-sky-400" />
            <span className="text-slate-400">التصدير الساعي:</span>
            <span className="font-mono font-bold text-sky-400 tabular-nums text-sm">{nextHourFormatted}</span>
          </div>

          <button
            onClick={onForceHourlySync}
            className="py-2 px-3.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer"
          >
            <span>🔄 تصدير ساعي</span>
          </button>

          {onNavigateToDashboard && (
            <button
              onClick={onNavigateToDashboard}
              className="py-2 px-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer"
            >
              <BarChart3 className="w-4 h-4" />
              <span>📊 لوحة الأداء</span>
            </button>
          )}

          <button
            onClick={onOpenHourlyArchive}
            className="py-2 px-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <span>📁 أرشيف الساعات</span>
          </button>

          <button
            onClick={onOpenAdmin}
            className="py-2 px-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer"
          >
            <span>🔑 قاعدة البيانات (Admin)</span>
          </button>
        </div>
      </div>

      {/* PRODUCTION GAP ALERTS PANEL (> 15 MIN DEVIATIONS) */}
      <ProductionGapAlertsPanel
        trips={trips}
        trucks={trucks}
        excavators={excavators}
        activeFuelings={activeFuelings}
        onSelectTruckForMessage={(truckId) => {
          setSelectedTruckForMessage(truckId);
          setIsMessengerModalOpen(true);
        }}
        onOpenInterventions={(unitId) => {
          setInterventionPreselectedUnitId(unitId || null);
          setIsInterventionsModalOpen(true);
        }}
      />

      {/* FUELING MONITORING PANEL */}
      <FuelingMonitoringPanel
        onSelectTruckForMessage={(truckId) => setSelectedTruckForMessage(truckId)}
      />

      {/* KPI METRICS STRIP */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        {/* Total Tonnage */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>إجمالي الطن المنقول</span>
            <span className="text-amber-400">⚖️</span>
          </div>
          <div className="text-2xl md:text-3xl font-black font-mono text-amber-400 tabular-nums">
            {totalTonnes.toLocaleString()} <span className="text-sm font-normal text-slate-400">طن</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            مستهدف الوردية: 30,000 طن ({Math.min(100, Math.round((totalTonnes / 30000) * 100))}%)
          </div>
        </div>

        {/* Total Trips */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>إجمالي النقلات (Trips)</span>
            <TruckIcon className="w-4 h-4 text-sky-400" />
          </div>
          <div className="text-2xl md:text-3xl font-black font-mono text-slate-100 tabular-nums">
            {totalTrips} <span className="text-sm font-normal text-slate-400">نقلة</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            متوسط زمن الدورة: <strong className="text-sky-400 font-mono">{avgCycleMinutes} دقيقة</strong>
          </div>
        </div>

        {/* Ore vs Waste Ratio */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>الخام مقابل الردم</span>
            <Layers className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl md:text-3xl font-black font-mono text-emerald-400 tabular-nums">
            {orePercentage}% <span className="text-xs font-normal text-slate-400">خام ذهب</span>
          </div>
          <div className="w-full bg-slate-950 h-2 rounded-full mt-2 overflow-hidden flex">
            <div className="bg-emerald-500 h-full transition-all" style={{ width: `${orePercentage}%` }} />
            <div className="bg-rose-500 h-full transition-all" style={{ width: `${wastePercentage}%` }} />
          </div>
        </div>

        {/* Standby & Lost Time */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>الأعطال والانتظار</span>
            <Clock className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl md:text-3xl font-black font-mono text-purple-400 tabular-nums">
            {totalStandbyMinutes} <span className="text-sm font-normal text-slate-400">دقيقة</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
            <span>دنابر عاملة: <strong className="text-slate-300 font-mono">60</strong></span>
            {activeBreakdownsCount > 0 && (
              <span className="text-rose-400 font-bold font-mono">({activeBreakdownsCount} متوقف)</span>
            )}
          </div>
        </div>
      </div>

      {/* GPS LIVE SIMULATION MAP (HAFRA OPEN PIT) */}
      <MineGpsSimulationMap
        trucks={trucks}
        excavators={excavators}
        dumps={dumps}
        trips={trips}
        onSelectTruckForMessage={(truckId) => setSelectedTruckForMessage(truckId)}
      />

      {/* DISPATCH RADIO BROADCAST & LIVE TRUCKS/LOADERS BOARD */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Radio Broadcast + Directed Driver Messenger */}
        <div className="space-y-6 flex flex-col">
          {/* Dispatch Radio Broadcast Panel */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm flex flex-col">
            <div className="flex items-center gap-2 mb-3">
              <Radio className="w-5 h-5 text-amber-400 animate-pulse" />
              <h3 className="font-bold text-sm text-slate-200">اللاسلكي الميداني وتنبيهات الحفرة</h3>
            </div>
            <p className="text-xs text-slate-400 mb-3">
              بث رسالة فورية تظهر بصوت تنبيهي على شاشات كابينات جميع السائقين
            </p>

            <form onSubmit={handleSendBroadcast} className="space-y-3 mb-4">
              <div className="flex items-center gap-1.5 p-1 bg-slate-950 border border-slate-800 rounded-xl">
                <button
                  type="button"
                  onClick={() => setBroadcastTarget('ALL')}
                  className={`flex-1 py-1.5 px-2 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
                    broadcastTarget === 'ALL'
                      ? 'bg-amber-500 text-slate-950 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  🌐 الكل (عامة)
                </button>
                <button
                  type="button"
                  onClick={() => setBroadcastTarget('TRUCKS_ALL')}
                  className={`flex-1 py-1.5 px-2 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
                    broadcastTarget === 'TRUCKS_ALL'
                      ? 'bg-amber-500 text-slate-950 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  🚛 كل الدنابر
                </button>
                <button
                  type="button"
                  onClick={() => setBroadcastTarget('EXCAVATORS_ALL')}
                  className={`flex-1 py-1.5 px-2 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
                    broadcastTarget === 'EXCAVATORS_ALL'
                      ? 'bg-amber-500 text-slate-950 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  🏗️ كل الحفارات
                </button>
              </div>

              <textarea
                value={broadcastText}
                onChange={(e) => setBroadcastText(e.target.value)}
                placeholder={
                  broadcastTarget === 'ALL'
                    ? "اكتب تعميماً عاماً لجميع المعدات والدنابر (مثال: بدء التفجير الساعة 14:00 - إخلاء الحفرة)..."
                    : broadcastTarget === 'TRUCKS_ALL'
                    ? "اكتب رسالة موجهة لجميع سائقي الدنابر (مثال: التوجه للكسارة 01 بدل الكسارة 02)..."
                    : "اكتب رسالة موجهة لجميع مشغلي الحفارات واللوادر..."
                }
                rows={3}
                className="w-full py-2 px-3 rounded-xl bg-slate-950 border border-slate-700 text-xs text-slate-100 placeholder:text-slate-500 focus:border-amber-500 focus:outline-none resize-none"
              />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setBroadcastPriority('NORMAL')}
                    className={`py-1 px-2.5 rounded-lg text-xs font-bold transition-colors ${
                      broadcastPriority === 'NORMAL'
                        ? 'bg-slate-800 text-amber-400 border border-amber-500/30'
                        : 'text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    عادي
                  </button>
                  <button
                    type="button"
                    onClick={() => setBroadcastPriority('URGENT')}
                    className={`py-1 px-2.5 rounded-lg text-xs font-bold transition-colors ${
                      broadcastPriority === 'URGENT'
                        ? 'bg-rose-950 text-rose-300 border border-rose-500/40'
                        : 'text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    عاجل وطارئ ⚠️
                  </button>
                </div>

                <button
                  type="submit"
                  className="py-1.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  إرسال للأسطول
                </button>
              </div>
            </form>

            {/* Recent Alerts Feed */}
            <div className="flex-1 overflow-y-auto space-y-2 max-h-[220px]">
              <span className="text-[11px] font-bold text-slate-400 block mb-1">آخر البلاغات المرسلة:</span>
              {alerts.slice(0, 4).map(alert => (
                <div
                  key={alert.id}
                  className={`p-2.5 rounded-xl border text-xs ${
                    alert.priority === 'URGENT'
                      ? 'bg-rose-950/40 border-rose-500/30 text-rose-200'
                      : 'bg-slate-950/60 border-slate-800 text-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                    <span className="font-bold text-amber-400">{alert.sender}</span>
                    <span className="font-mono">{alert.timestamp}</span>
                  </div>
                  <p className="leading-relaxed">{alert.messageAr}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Instant Directed Messenger to Individual Drivers */}
          <DispatcherMessengerWidget
            trucks={trucks}
            drivers={drivers}
            preselectedTruckId={selectedTruckForMessage}
            onClearPreselectedTruck={() => setSelectedTruckForMessage(null)}
          />
        </div>

        {/* Right 2 cols: Live Fleet Status Grid (Dump Trucks DT001-DT060 & 14 Loading Units) */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm flex flex-col">
          {/* Header & Fleet Switcher Tabs */}
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-1 p-1 bg-slate-950 border border-slate-800 rounded-xl">
              <button
                type="button"
                onClick={() => setFleetTab('TRUCKS')}
                className={`py-1.5 px-3 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  fleetTab === 'TRUCKS'
                    ? 'bg-amber-500 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                🚛 أسطول الدنابر (60 دنبر)
              </button>
              <button
                type="button"
                onClick={() => setFleetTab('LOADERS')}
                className={`py-1.5 px-3 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  fleetTab === 'LOADERS'
                    ? 'bg-amber-500 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                🏗️ معدات التحميل (14 معدة)
              </button>
              <button
                type="button"
                onClick={() => setFleetTab('CHARTS')}
                className={`py-1.5 px-3 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
                  fleetTab === 'CHARTS'
                    ? 'bg-sky-500 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <span>📊 رسوم الإنتاجية (Recharts)</span>
              </button>
            </div>

            {fleetTab === 'TRUCKS' && (
              <div className="flex items-center gap-1 flex-wrap">
                <button
                  type="button"
                  onClick={() => setTruckStatusFilter('ALL')}
                  className={`py-1 px-2.5 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
                    truckStatusFilter === 'ALL' ? 'bg-slate-800 text-slate-100' : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  الكل ({trucks.length})
                </button>
                <button
                  type="button"
                  onClick={() => setTruckStatusFilter('ACTIVE')}
                  className={`py-1 px-2.5 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
                    truckStatusFilter === 'ACTIVE' ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40' : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  في الخدمة 🟢
                </button>
                <button
                  type="button"
                  onClick={() => setTruckStatusFilter('FUELING')}
                  className={`py-1 px-2.5 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
                    truckStatusFilter === 'FUELING' ? 'bg-amber-950 text-amber-300 border border-amber-500/40' : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  بيفول ⛽
                </button>
                <button
                  type="button"
                  onClick={() => setTruckStatusFilter('STANDBY_QUEUE')}
                  className={`py-1 px-2.5 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
                    truckStatusFilter === 'STANDBY_QUEUE' ? 'bg-purple-950 text-purple-300 border border-purple-500/40' : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  استاند باي ⏳
                </button>
                <button
                  type="button"
                  onClick={() => setTruckStatusFilter('BREAKDOWN')}
                  className={`py-1 px-2.5 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
                    truckStatusFilter === 'BREAKDOWN' ? 'bg-rose-950 text-rose-300 border border-rose-500/40' : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  أعطال 🚨
                </button>
                <button
                  type="button"
                  onClick={() => setTruckStatusFilter('MAINTENANCE')}
                  className={`py-1 px-2.5 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
                    truckStatusFilter === 'MAINTENANCE' ? 'bg-slate-800 text-slate-300 border border-slate-600' : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  صيانة 🔧
                </button>
              </div>
            )}
          </div>

          {/* Quick Circuit Matrix Bar (توزيع الدنابر على الحفارات) */}
          <div className="mb-3 p-2.5 rounded-xl bg-slate-950/90 border border-slate-800 flex flex-wrap items-center justify-between gap-2.5 shadow-inner">
            <div className="flex items-center gap-2">
              <span className="text-xs font-black text-slate-200 flex items-center gap-1.5">
                <span className="text-amber-400 text-sm">⚡</span>
                <span>توزيع أسطول الدنابر على الحفارات:</span>
              </span>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-500/40 font-bold">
                {Object.keys(truckAssignments).length} من {trucks.length} مخصص
              </span>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              <div className="flex items-center gap-1 overflow-x-auto max-w-[520px] py-0.5 pr-1">
                {excavators.map(ex => {
                  const count = Object.values(truckAssignments).filter(a => a.excavatorId === ex.id).length;
                  return (
                    <button
                      key={ex.id}
                      type="button"
                      onClick={() => {
                        playClickSound();
                        setAssignmentTargetExcavatorId(ex.id);
                        setIsAssignmentModalOpen(true);
                      }}
                      className={`px-2 py-1 rounded-lg text-[10px] font-mono font-bold transition-all flex items-center gap-1 cursor-pointer shrink-0 ${
                        count > 0
                          ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-900'
                          : 'bg-slate-900 text-slate-500 border border-slate-800 hover:text-slate-300'
                      }`}
                      title={`عرض دنابر الحفار ${ex.id} (${count} دنابر حالياً)`}
                    >
                      <span>{ex.id}</span>
                      <span className={`px-1 py-0.2 rounded text-[9px] ${
                        count > 0
                          ? 'bg-emerald-900 text-white'
                          : 'bg-slate-950 text-slate-500'
                      }`}>
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={() => {
                  playClickSound();
                  setAssignmentTargetExcavatorId(null);
                  setIsAssignmentModalOpen(true);
                }}
                className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition-colors cursor-pointer flex items-center gap-1 shrink-0 shadow-sm"
                title="فتح نافذة التوزيع الشاملة لكل الحفارات"
              >
                <span>🚜 ضبط التوزيع الكامل</span>
              </button>
            </div>
          </div>

          {/* Sub-view 1: 60 Dump Trucks (DT001-DT060) with Drag & Drop */}
          {fleetTab === 'TRUCKS' && (
            <div className="flex flex-col">
              {/* Assignment Feedback Toast */}
              {assignmentFeedback && (
                <div className="mb-2.5 p-3 px-4 rounded-xl bg-gradient-to-r from-emerald-950 via-slate-900 to-emerald-950 border-2 border-emerald-500/60 text-emerald-200 text-xs font-bold flex items-center justify-between shadow-xl animate-in fade-in">
                  <div className="flex items-center gap-2">
                    <span className="text-emerald-400 text-base animate-bounce">📢</span>
                    <span>{assignmentFeedback}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAssignmentFeedback(null)}
                    className="p-1 text-slate-400 hover:text-white text-xs cursor-pointer"
                  >
                    ✕
                  </button>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-2 mb-2 p-2 bg-slate-950/70 border border-slate-800/80 rounded-xl text-xs">
                <div className="flex items-center gap-1.5 text-slate-400">
                  <span className="text-amber-400 font-bold">✨ السحب والإفلات (Drag & Drop):</span>
                  <span>اسحب بطاقة الدنبر لتحريك أولويته في الأسطول</span>
                </div>
                <button
                  type="button"
                  onClick={handleResetTrucksOrder}
                  className="py-1 px-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-[11px] transition-colors cursor-pointer flex items-center gap-1"
                  title="إعادة الترتيب التلقائي من DT001 إلى DT060"
                >
                  <span>إعادة الترتيب الافتراضي ↺</span>
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 max-h-[360px] overflow-y-auto pr-1">
                {orderedTrucks
                  .filter(t => {
                    if (truckStatusFilter === 'ACTIVE') return t.status === 'ACTIVE' || t.status === 'LOADING' || t.status === 'HAULING';
                    if (truckStatusFilter === 'FUELING') return t.status === 'FUELING';
                    if (truckStatusFilter === 'STANDBY_QUEUE') return t.status === 'STANDBY_QUEUE';
                    if (truckStatusFilter === 'BREAKDOWN') return t.status === 'BREAKDOWN';
                    if (truckStatusFilter === 'MAINTENANCE') return t.status === 'MAINTENANCE';
                    return true;
                  })
                  .map(truck => {
                    const isFueling = truck.status === 'FUELING';
                    const isStandby = truck.status === 'STANDBY_QUEUE';
                    const isBreakdown = truck.status === 'BREAKDOWN';
                    const isMaint = truck.status === 'MAINTENANCE';

                    return (
                      <div
                        key={truck.id}
                        draggable={true}
                        onDragStart={(e) => handleTruckDragStart(e, truck.id)}
                        onDragOver={(e) => handleTruckDragOver(e, truck.id)}
                        onDrop={(e) => handleTruckDrop(e, truck.id)}
                        onDragEnd={() => { setDraggedTruckId(null); setDragOverTruckId(null); }}
                        className={`p-2.5 rounded-xl border transition-all cursor-grab active:cursor-grabbing select-none relative group ${
                          dragOverTruckId === truck.id
                            ? 'border-amber-400 bg-amber-500/10 scale-102 ring-2 ring-amber-400/40 z-10'
                            : draggedTruckId === truck.id
                            ? 'opacity-40 border-dashed border-slate-600 bg-slate-900'
                            : isBreakdown
                            ? 'bg-rose-950/40 border-rose-500/60 shadow-rose-950/40'
                            : isFueling
                            ? 'bg-amber-950/40 border-amber-500/60'
                            : isStandby
                            ? 'bg-purple-950/40 border-purple-500/60'
                            : isMaint
                            ? 'bg-slate-900 border-slate-700'
                            : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] text-slate-500 font-mono group-hover:text-amber-400">⋮⋮</span>
                            <span className="font-black text-xs font-mono text-amber-400">{truck.id}</span>
                            {/* Real-time online/offline indicator */}
                            {presenceMap[truck.id]?.isOnline ? (
                              <span
                                className="flex items-center gap-1 text-[9px] font-bold text-emerald-400 bg-emerald-950/80 px-1 py-0.5 rounded border border-emerald-500/40"
                                title={`متصل لحظياً من التابلت - آخر نشاط: ${new Date(presenceMap[truck.id].lastSeen).toLocaleTimeString('ar-EG')}`}
                              >
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                متصل
                              </span>
                            ) : (
                              <span
                                className="text-[9px] text-slate-500 bg-slate-900/90 px-1 py-0.5 rounded border border-slate-800"
                                title="غير متصل حالياً"
                              >
                                أوفلاين
                              </span>
                            )}
                          </div>
                          <span className={`text-[9px] font-bold py-0.5 px-1.5 rounded ${
                            isBreakdown
                              ? 'bg-rose-900 text-rose-200 animate-pulse'
                              : isFueling
                              ? 'bg-amber-900 text-amber-200'
                              : isStandby
                              ? 'bg-purple-900 text-purple-200'
                              : isMaint
                              ? 'bg-slate-800 text-slate-300'
                              : 'bg-emerald-950 text-emerald-300'
                          }`}>
                            {isBreakdown ? 'عطل 🚨' : isFueling ? 'بيفول ⛽' : isStandby ? 'انتظار ⏳' : isMaint ? 'صيانة 🔧' : 'شغال 🟢'}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-300 truncate font-medium flex items-center justify-between gap-1">
                          <span className="truncate">
                            {truck.statusNote || (truck.assignedDriver ? `سائق: ${truck.assignedDriver}` : `${truck.capacityTonnes} طن · CAT 785`)}
                          </span>
                          {truckAssignments[truck.id] && (
                            <span className="shrink-0 text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                              🚜 {truckAssignments[truck.id].excavatorId}
                            </span>
                          )}
                        </div>

                        {/* Dedicated Loading Equipment Selector for this truck */}
                        <div className={`mt-2 p-1.5 rounded-xl border transition-all ${
                          truckAssignments[truck.id]?.excavatorId
                            ? 'bg-slate-900/95 border-emerald-500/60 ring-1 ring-emerald-500/30'
                            : 'bg-slate-950/90 border-slate-800'
                        }`}>
                          <div className="flex items-center justify-between text-[10px] font-bold mb-1">
                            <span className="text-amber-400 flex items-center gap-1">
                              <span>🏗️ معدة التحميل:</span>
                            </span>
                            {truckAssignments[truck.id]?.excavatorId ? (
                              <span className="font-mono text-[9px] px-1.5 py-0.2 rounded bg-emerald-950 text-emerald-300 border border-emerald-500/40 font-bold">
                                مع {truckAssignments[truck.id].excavatorId} 🟢
                              </span>
                            ) : (
                              <span className="text-[9px] text-slate-500 font-normal">
                                تحميل حر ⚪
                              </span>
                            )}
                          </div>

                          <select
                            value={truckAssignments[truck.id]?.excavatorId || 'UNASSIGNED'}
                            onChange={(e) => {
                              e.stopPropagation();
                              handleQuickAssignTruck(truck.id, e.target.value);
                            }}
                            disabled={isBreakdown || isMaint}
                            className={`w-full text-[11px] font-mono font-bold py-1 px-1.5 rounded-lg border focus:outline-none transition-colors ${
                              isBreakdown || isMaint
                                ? 'bg-slate-900 border-slate-800 text-slate-600 cursor-not-allowed'
                                : truckAssignments[truck.id]?.excavatorId
                                ? 'bg-slate-950 border-emerald-500/60 text-emerald-300 focus:border-emerald-400 cursor-pointer shadow-sm'
                                : 'bg-slate-950 border-slate-700 text-slate-300 focus:border-amber-400 cursor-pointer'
                            }`}
                            title="اختر معدة التحميل لهذا الدنبر وسيصل أمر التحميل الفوري إلى تابلت السائق مع التلاوة الصوتية"
                          >
                            <option value="UNASSIGNED">⚪ غير مخصص (تحميل حر)</option>
                            {excavators.map(ex => (
                              <option key={ex.id} value={ex.id}>
                                🚜 {ex.id} — {ex.model} ({ex.benchLevel?.split('(')[0]?.trim() || ex.benchLevel})
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="mt-1.5 pt-1 border-t border-slate-800/80 flex items-center justify-between text-[10px]">
                          <span className="text-slate-400">حمولات: <strong className="font-bold font-mono text-emerald-400">{truck.tripsToday || 0}</strong> ({truck.tonnesToday || 0}t)</span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              playClickSound();
                              setSelectedTruckForMessage(truck.id);
                              setIsMessengerModalOpen(true);
                            }}
                            className="text-[10px] text-indigo-400 hover:text-indigo-300 font-bold px-2 py-0.5 rounded bg-indigo-950/70 hover:bg-indigo-900 border border-indigo-500/40 transition-colors cursor-pointer"
                            title="إرسال رسالة خاصة لهذا الدنبر"
                          >
                            رسالة 💬
                          </button>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {/* Sub-view 2: 14 Loading Units with Drag & Drop */}
          {fleetTab === 'LOADERS' && (
            <div className="flex flex-col">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2 p-2 bg-slate-950/70 border border-slate-800/80 rounded-xl text-xs">
                <div className="flex items-center gap-1.5 text-slate-400">
                  <span className="text-emerald-400 font-bold">✨ السحب والإفلات (Drag & Drop):</span>
                  <span>اسحب بطاقة الحفار لترتيب الأولوية ومواقع الحفر والمصاطب</span>
                </div>
                <button
                  type="button"
                  onClick={handleResetExcavatorsOrder}
                  className="py-1 px-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-[11px] transition-colors cursor-pointer flex items-center gap-1"
                  title="إعادة الترتيب التلقائي للحفارات"
                >
                  <span>إعادة الترتيب الافتراضي ↺</span>
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 max-h-[380px] overflow-y-auto pr-1">
                {orderedExcavators.map(ex => {
                  const isShovel = ex.id.startsWith('SH');
                  const isLoader = ex.id.startsWith('WL');
                  const emoji = isShovel ? '🏗️' : isLoader ? '🚜' : '🚜';

                  return (
                    <div
                      key={ex.id}
                      draggable={true}
                      onDragStart={(e) => handleExcavatorDragStart(e, ex.id)}
                      onDragOver={(e) => handleExcavatorDragOver(e, ex.id)}
                      onDrop={(e) => handleExcavatorDrop(e, ex.id)}
                      onDragEnd={() => { setDraggedExcavatorId(null); setDragOverExcavatorId(null); }}
                      onClick={() => {
                        playClickSound();
                        setAssignmentTargetExcavatorId(ex.id);
                        setIsAssignmentModalOpen(true);
                      }}
                      className={`p-3 rounded-xl border transition-all cursor-pointer select-none group ${
                        dragOverExcavatorId === ex.id
                          ? 'border-emerald-400 bg-emerald-500/10 scale-102 ring-2 ring-emerald-400/40 z-10'
                          : draggedExcavatorId === ex.id
                          ? 'opacity-40 border-dashed border-slate-600 bg-slate-900'
                          : 'bg-slate-950/80 border-slate-800 hover:border-emerald-500/50 hover:bg-slate-900'
                      }`}
                      title={`عرض دنابر وموقع الحفار ${ex.id}`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1.5">
                          <span className="font-black text-xs font-mono text-emerald-400 flex items-center gap-1">
                            <span className="text-[10px] text-slate-500 group-hover:text-emerald-400">⋮⋮</span>
                            <span>{emoji}</span> {ex.id}
                          </span>
                          {/* Real-time online/offline indicator */}
                          {presenceMap[ex.id]?.isOnline ? (
                            <span
                              className="flex items-center gap-1 text-[9px] font-bold text-emerald-400 bg-emerald-950/80 px-1 py-0.5 rounded border border-emerald-500/40"
                              title={`متصل لحظياً - آخر نشاط: ${new Date(presenceMap[ex.id].lastSeen).toLocaleTimeString('ar-EG')}`}
                            >
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                              متصل
                            </span>
                          ) : (
                            <span
                              className="text-[9px] text-slate-500 bg-slate-900/90 px-1 py-0.5 rounded border border-slate-800"
                              title="غير متصل حالياً"
                            >
                              أوفلاين
                            </span>
                          )}
                        </div>
                        <span className="text-[9px] font-bold py-0.5 px-1.5 rounded bg-slate-800 text-slate-300">
                          {ex.trucksInQueue || 0} في الطابور
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-300 font-bold truncate">
                        {ex.benchLevel?.split('(')[0] || ex.benchLevel}
                      </div>
                      <div className="text-[9px] text-slate-500 truncate mt-0.5">
                        {ex.model}
                      </div>

                      {/* Dynamic Assigned Dumpers Section */}
                      {(() => {
                        const assignedTrucks = Object.values(truckAssignments).filter(a => a.excavatorId === ex.id);
                        return (
                          <div className="mt-2 pt-1.5 border-t border-slate-800/80 flex flex-col gap-1.5">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-bold text-amber-400 flex items-center gap-1">
                                <span>🚜 الدنابر:</span>
                                <span className={`font-mono px-1.5 py-0.2 rounded font-black text-[10px] ${
                                  assignedTrucks.length > 0
                                    ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40'
                                    : 'bg-slate-900 text-slate-500'
                                }`}>
                                  {assignedTrucks.length}
                                </span>
                              </span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  playClickSound();
                                  setAssignmentTargetExcavatorId(ex.id);
                                  setIsAssignmentModalOpen(true);
                                }}
                                className="text-[10px] font-bold text-emerald-400 hover:text-emerald-300 bg-emerald-950/90 hover:bg-emerald-900 px-2 py-0.5 rounded-lg border border-emerald-500/40 transition-colors cursor-pointer flex items-center gap-0.5"
                                title={`تخصيص دنابر الحفار ${ex.id}`}
                              >
                                <span>➕ تخصيص</span>
                              </button>
                            </div>

                            {/* Assigned truck chips */}
                            {assignedTrucks.length > 0 ? (
                              <div className="flex flex-wrap gap-1 max-h-[44px] overflow-y-auto">
                                {assignedTrucks.map(a => (
                                  <span
                                    key={a.truckId}
                                    className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-slate-900 border border-emerald-500/30 text-emerald-300"
                                  >
                                    {a.truckId}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-[9px] text-slate-500 italic">لا توجد دنابر مخصصة</span>
                            )}

                            {/* Fast Action Buttons */}
                            <div className="flex items-center gap-1 mt-0.5">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleQuickAddFreeTruckToExcavator(ex.id);
                                }}
                                className="flex-1 text-[9px] font-bold text-amber-300 hover:text-amber-200 bg-slate-900 hover:bg-slate-850 px-1.5 py-1 rounded border border-slate-700 hover:border-amber-500/50 transition-colors cursor-pointer text-center"
                                title="إضافة أول دنبر حر غير مخصص إلى هذا الحفار فوراً بنقرة واحدة"
                              >
                                ⚡ +1 حر
                              </button>
                              {assignedTrucks.length > 0 && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleClearExcavatorTrucks(ex.id);
                                  }}
                                  className="text-[9px] font-bold text-rose-400 hover:text-rose-300 bg-rose-950/40 hover:bg-rose-900/60 px-1.5 py-1 rounded border border-rose-800/50 transition-colors cursor-pointer"
                                  title="إلغاء تخصيص دنابر هذا الحفار"
                                >
                                  تفريغ ↺
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Sub-view 3: Interactive Recharts Productivity Visualizations */}
          {fleetTab === 'CHARTS' && (
            <div className="flex flex-col">
              <ProductivityChartsTab
                trips={trips}
                trucks={trucks}
                excavators={excavators}
                dumps={dumps}
              />
            </div>
          )}
        </div>
      </div>

      {/* FULL TRIP LOGS TABLE WITH FILTERS & CSV EXPORT */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-base text-slate-100">سجل النقلات الميداني التراكمي للوردية</h3>
            <span className="text-xs px-2 py-0.5 rounded-md bg-slate-800 text-slate-400 font-mono">
              {filteredTrips.length} رحلة
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Search */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-500 absolute right-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="بحث بالسائق، المعدة، الحفار..."
                className="py-1.5 pr-9 pl-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 placeholder:text-slate-500 focus:border-amber-500 focus:outline-none w-48 md:w-64"
              />
            </div>

            {/* Filter Material */}
            <select
              value={filterMaterial}
              onChange={(e) => setFilterMaterial(e.target.value)}
              className="py-1.5 px-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 font-medium"
            >
              <option value="ALL">جميع المواد والخامات</option>
              <option value="ORE_HIGH">هاي جريد HG</option>
              <option value="ORE_MEDIUM">ميديم جريد MG</option>
              <option value="ORE_LOW">لو جريد LG</option>
              <option value="SUB_GRADE">سب جريد SG</option>
              <option value="WASTE">ويست Waste</option>
            </select>

            {/* Filter Truck */}
            <select
              value={filterTruck}
              onChange={(e) => setFilterTruck(e.target.value)}
              className="py-1.5 px-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 font-medium"
            >
              <option value="ALL">جميع الشاحنات</option>
              {trucks.map(t => (
                <option key={t.id} value={t.id}>{t.id}</option>
              ))}
            </select>

            {/* Export CSV Button */}
            <button
              onClick={handleExportFullCSV}
              className="py-1.5 px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 transition-colors shadow-sm"
            >
              <Download className="w-4 h-4" />
              تصدير Excel (CSV)
            </button>
          </div>
        </div>

        {/* Trips Table */}
        <div className="border border-slate-800 rounded-xl overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 font-bold">
              <tr>
                <th className="py-3 px-3">رقم النقلة</th>
                <th className="py-3 px-3">السائق</th>
                <th className="py-3 px-3">المعدة</th>
                <th className="py-3 px-3">معدة التحميل</th>
                <th className="py-3 px-3">المادة</th>
                <th className="py-3 px-3">موقع التفريغ</th>
                <th className="py-3 px-3 text-center">الحمولة (طن)</th>
                <th className="py-3 px-3 text-center">الانتظار</th>
                <th className="py-3 px-3 text-center">الدورة (د)</th>
                <th className="py-3 px-3">وقت التفريغ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-medium">
              {filteredTrips.slice(0, 50).map((t) => (
                <tr key={t.id} className="hover:bg-slate-800/40 transition-colors">
                  <td className="py-2.5 px-3 font-mono text-slate-400">{t.id}</td>
                  <td className="py-2.5 px-3 text-slate-200 font-bold">
                    {t.driverName} <span className="text-[10px] text-slate-400 font-mono">({t.driverCode})</span>
                  </td>
                  <td className="py-2.5 px-3 font-mono text-amber-400 font-bold">{t.truckId}</td>
                  <td className="py-2.5 px-3 font-mono text-emerald-400">{t.excavatorId}</td>
                  <td className="py-2.5 px-3">
                    {t.material === 'WASTE' ? (
                      <span className="text-rose-400 font-bold">ويست Waste</span>
                    ) : t.material === 'SUB_GRADE' ? (
                      <span className="text-emerald-400 font-bold">سب جريد SG</span>
                    ) : t.material === 'ORE_HIGH' ? (
                      <span className="text-amber-400 font-bold">هاي جريد HG</span>
                    ) : t.material === 'ORE_MEDIUM' ? (
                      <span className="text-orange-400 font-bold">ميديم جريد MG</span>
                    ) : (
                      <span className="text-cyan-400 font-bold">لو جريد LG</span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 font-mono text-slate-200">{t.dumpLocationId}</td>
                  <td className="py-2.5 px-3 text-center font-mono font-bold text-emerald-400">
                    {t.payloadTonnes || 152}
                  </td>
                  <td className="py-2.5 px-3 text-center font-mono text-purple-400">
                    {t.standbyDurationSec > 0 ? `${Math.round(t.standbyDurationSec / 60)} د` : '-'}
                  </td>
                  <td className="py-2.5 px-3 text-center font-mono text-slate-300">
                    {t.cycleTimeMinutes}
                  </td>
                  <td className="py-2.5 px-3 font-mono text-slate-400">
                    {new Date(t.dumpTime).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* EXCAVATOR TARGETS CONFIGURATION MODAL */}
      <ExcavatorTargetsModal
        isOpen={isTargetsModalOpen}
        onClose={() => setIsTargetsModalOpen(false)}
        excavators={excavators}
        trips={trips}
      />

      {/* GOOGLE SHEETS LIVE INTEGRATION MODAL */}
      <GoogleSheetsModal
        isOpen={isGoogleSheetsModalOpen}
        onClose={() => setIsGoogleSheetsModalOpen(false)}
        trips={trips}
        trucks={trucks}
        excavators={excavators}
        dumps={dumps}
      />

      {/* SHIFT & OPERATOR MANAGEMENT MODAL */}
      <ShiftManagementModal
        isOpen={isShiftModalOpen}
        onClose={() => setIsShiftModalOpen(false)}
        trucks={trucks}
        excavators={excavators}
        drivers={drivers}
      />

      {/* DISPATCHER MESSENGER POPUP MODAL */}
      <DispatcherMessengerModal
        isOpen={isMessengerModalOpen}
        onClose={() => {
          setIsMessengerModalOpen(false);
          setSelectedTruckForMessage(null);
        }}
        trucks={trucks}
        drivers={drivers}
        preselectedTruckId={selectedTruckForMessage}
        onClearPreselectedTruck={() => setSelectedTruckForMessage(null)}
      />

      {/* TRUCK-TO-EXCAVATOR FLEET CIRCUIT ASSIGNMENT MODAL */}
      <TruckExcavatorAssignmentModal
        isOpen={isAssignmentModalOpen}
        onClose={() => {
          setIsAssignmentModalOpen(false);
          setAssignmentTargetExcavatorId(null);
        }}
        initialExcavatorId={assignmentTargetExcavatorId}
        excavators={excavators}
        trucks={trucks}
        activeDispatcher={activeDispatcher}
        onAssignmentsUpdated={() => setTruckAssignments(getTruckExcavatorAssignments())}
      />

      {/* EQUIPMENT INTERVENTIONS & MANUAL CORRECTIVE ACTIONS MODAL */}
      <InterventionsModal
        isOpen={isInterventionsModalOpen}
        onClose={() => {
          setIsInterventionsModalOpen(false);
          setInterventionPreselectedUnitId(null);
        }}
        trucks={trucks}
        excavators={excavators}
        activeDispatcher={activeDispatcher}
        preselectedUnitId={interventionPreselectedUnitId}
        onInterventionsChanged={() => setInterventionsList(getEquipmentInterventions())}
      />
    </div>
  );
};
