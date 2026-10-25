import {
  Driver,
  Truck,
  Excavator,
  DumpLocation,
  TripLog,
  DispatchAlert,
  EquipmentAlert,
  EquipmentStatusCode,
  ShiftHandoverRecord,
  MaterialType,
  StandbyReason,
  FuelingLog,
  FuelingStage,
  DispatcherDirectMessage,
  ExcavatorTarget,
  ProductionGapAlert,
  DriverSessionRecord,
  CustomStandbyReason,
} from '../types/dispatch';
import {
  sendCloudDispatcherMessage,
  acknowledgeCloudMessage,
  syncMasterDataToCloud,
  fetchMasterDataFromCloud,
  subscribeToMasterData,
  syncEquipmentAlertToCloud,
  subscribeToCloudEquipmentAlerts,
  fetchCloudEquipmentAlerts,
  syncTruckLiveStateToCloud,
  subscribeToFleetTrucks,
  fetchFleetTrucksFromCloud,
  syncTripToCloud,
  subscribeToCloudFleetTrips,
  fetchCloudFleetTrips,
  syncFuelingToCloud,
  subscribeToCloudFuelings,
  fetchCloudFuelings,
  syncDriverSessionToCloud,
  subscribeToCloudDriverSessions,
  fetchCloudDriverSessions,
  syncStandbyToCloud,
  subscribeToCloudStandbys,
  StandbyCloudEvent,
  sendEmergencySos,
  EmergencySosAlert,
} from './firebaseSync';

const STORAGE_KEYS = {
  DRIVERS: 'sukari_drivers_v2',
  TRUCKS: 'sukari_trucks_v2',
  EXCAVATORS: 'sukari_excavators_v2',
  DUMPS: 'sukari_dumps_v2',
  TRIPS: 'sukari_trips_v2',
  HOURLY_EXPORTS: 'sukari_hourly_exports_v2',
  EQUIPMENT_ALERTS: 'sukari_equipment_alerts_v2',
  ADMIN_PASSWORD: 'sukari_admin_pin_v2',
  DISPATCH_ALERTS: 'sukari_dispatch_alerts_v2',
  CONFIG: 'sukari_config_v2',
  SHIFT_HANDOVERS: 'sukari_shift_handovers_v2',
  PENDING_SYNC_QUEUE: 'sukari_pending_sync_queue_v2',
  TABLET_ASSIGNED_TRUCK: 'sukari_tablet_assigned_truck_v2',
  TRUCK_RECENT_DRIVERS: 'sukari_truck_recent_drivers_v2',
  ACTIVE_CAB_SESSION: 'sukari_active_cab_session_v2',
  FUELING_LOGS: 'sukari_fueling_logs_v2',
  DIRECT_MESSAGES: 'sukari_direct_messages_v2',
  EXCAVATOR_TARGETS: 'sukari_excavator_targets_v2',
  DRIVER_SESSIONS: 'sukari_driver_sessions_v2',
  CUSTOM_STANDBY_REASONS: 'sukari_custom_standby_reasons_v2',
  CUSTOM_TRUCKS_ORDER: 'sukari_custom_trucks_order_v2',
  CUSTOM_EXCAVATORS_ORDER: 'sukari_custom_excavators_order_v2',
};

export interface HourlyExportSnapshot {
  id: string;
  hourNumber: number; // e.g. 1, 2, 3...
  hourLabel: string; // e.g. "01:00" or "الساعة 13:00"
  timestamp: string;
  formattedDate: string;
  totalTripsThisHour: number;
  totalTonnesThisHour: number;
  oreTonnesThisHour: number;
  subGradeTonnesThisHour?: number;
  wasteTonnesThisHour: number;
  activeTrucksCount: number;
  cumulativeShiftTrips: number;
  cumulativeShiftTonnes: number;
  activeBreakdownsCount: number;
  trips: TripLog[];
  csvContent: string;
  whatsappMessage: string;
}

export interface AppConfig {
  adminPin: string;
  mineName: string;
  pitSection: string;
  hourlyAutoExport: boolean;
  autoDownloadCsv: boolean;
  targetHourlyTonnes: number;
  targetShiftTonnes: number;
  activeShift: 'MORNING' | 'NIGHT';
  soundEnabled: boolean;
  // External Notifications (Teams / WhatsApp)
  officialTeamsChannelUrl: string;
  teamsWebhookUrl: string;
  whatsappGroupOrPhone: string;
  autoPromptWhatsappShare: boolean;
  autoSendTeamsWebhook: boolean;
}

// Initial default seed drivers
export const INITIAL_DRIVERS: Driver[] = [
  { code: '1001', name: 'محمد حامد', role: 'سائق دنبر منجمي', licenseLevel: 'درجة أولى منجمية', phone: '01012345001' },
  { code: '1002', name: 'أحمد مصطفى', role: 'سائق دنبر منجمي', licenseLevel: 'درجة أولى منجمية', phone: '01012345002' },
  { code: '1003', name: 'إسلام الحضري', role: 'سائق دنبر منجمي', licenseLevel: 'درجة أولى منجمية', phone: '01012345003' },
  { code: '1004', name: 'مينا يوسف', role: 'سائق دنبر منجمي', licenseLevel: 'درجة أولى منجمية', phone: '01012345004' },
  { code: '1005', name: 'محمود شاكر', role: 'سائق دنبر منجمي', licenseLevel: 'درجة أولى منجمية', phone: '01012345005' },
  { code: '1006', name: 'طارق عبد الرحيم', role: 'سائق دنبر منجمي', licenseLevel: 'درجة أولى منجمية', phone: '01012345006' },
  { code: '1007', name: 'ياسر القناوي', role: 'سائق دنبر منجمي', licenseLevel: 'درجة أولى منجمية', phone: '01012345007' },
  { code: '1008', name: 'خالد الصعيدي', role: 'سائق دنبر منجمي', licenseLevel: 'درجة أولى منجمية', phone: '01012345008' },
];

// Generate 60 Dump Trucks: DT001 to DT060 with exact 152 tonnes capacity
export function generateInitialDumpTrucks(): Truck[] {
  const trucks: Truck[] = [];
  const statusOptions: EquipmentStatusCode[] = ['ACTIVE', 'LOADING', 'HAULING', 'DUMPING', 'STANDBY_QUEUE', 'ACTIVE'];

  for (let i = 1; i <= 60; i++) {
    const id = `DT${String(i).padStart(3, '0')}`;
    const status = i === 14 ? 'BREAKDOWN' : i === 28 ? 'MAINTENANCE' : statusOptions[i % statusOptions.length];
    trucks.push({
      id,
      model: id, // Clean display: just truck ID without cluttered model name
      capacityTonnes: 152, // Updated to 152 tonnes as requested
      tareWeightTonnes: 102,
      status,
      tripsToday: Math.floor(Math.random() * 8) + 2,
      tonnesToday: 0,
      statusNote: i === 14 ? 'عطل بخراطيم الهيدروليك - ورشة المنجم' : i === 28 ? 'صيانة كوشوك وفحص إطارات' : undefined,
    });
  }
  return trucks;
}

export const INITIAL_TRUCKS: Truck[] = generateInitialDumpTrucks();

// Exact Loading Equipment Requested by the User:
// EX08, EX09, SH02, SH03, SH04, SH05, SH06, WL01, WL02, WL03, WL04, WL05, EX11, EX12
export const INITIAL_EXCAVATORS: Excavator[] = [
  { id: 'EX08', model: 'CAT 6040 Hydraulic Excavator', type: 'EXCAVATOR', benchLevel: 'North Pit Bench RL +140m', assignedMaterial: 'ORE_HIGH', trucksInQueue: 1, status: 'ACTIVE' },
  { id: 'EX09', model: 'CAT 6040 Hydraulic Excavator', type: 'EXCAVATOR', benchLevel: 'Stage 4 Central RL +110m', assignedMaterial: 'ORE_MEDIUM', trucksInQueue: 2, status: 'ACTIVE' },
  { id: 'SH02', model: 'CAT 7495 Electric Rope Shovel', type: 'SHOVEL', benchLevel: 'Pit Floor RL +60m', assignedMaterial: 'ORE_HIGH', trucksInQueue: 2, status: 'ACTIVE' },
  { id: 'SH03', model: 'Bucyrus Heavy Electric Shovel', type: 'SHOVEL', benchLevel: 'East Wall RL +90m', assignedMaterial: 'WASTE', trucksInQueue: 1, status: 'ACTIVE' },
  { id: 'SH04', model: 'CAT 6060 Mining Face Shovel', type: 'SHOVEL', benchLevel: 'South Cutback RL +120m', assignedMaterial: 'WASTE', trucksInQueue: 0, status: 'ACTIVE' },
  { id: 'SH05', model: 'CAT 6060 Hydraulic Face Shovel', type: 'SHOVEL', benchLevel: 'Central Bench RL +100m', assignedMaterial: 'ORE_HIGH', trucksInQueue: 1, status: 'ACTIVE' },
  { id: 'SH06', model: 'CAT 7495 Mining Shovel', type: 'SHOVEL', benchLevel: 'Stage 5 Pre-strip RL +160m', assignedMaterial: 'WASTE', trucksInQueue: 0, status: 'ACTIVE' },
  { id: 'WL01', model: 'CAT 994K Large Wheel Loader', type: 'WHEEL_LOADER', benchLevel: 'ROM-Pad Rehandle Area', assignedMaterial: 'ORE_HIGH', trucksInQueue: 0, status: 'ACTIVE' },
  { id: 'WL02', model: 'CAT 994K Wheel Loader', type: 'WHEEL_LOADER', benchLevel: 'Primary Crusher 01 Feed', assignedMaterial: 'ORE_HIGH', trucksInQueue: 1, status: 'ACTIVE' },
  { id: 'WL03', model: 'CAT 992K Wheel Loader', type: 'WHEEL_LOADER', benchLevel: 'Stockpile Reclaim Area', assignedMaterial: 'ORE_MEDIUM', trucksInQueue: 0, status: 'ACTIVE' },
  { id: 'WL04', model: 'CAT 992K Wheel Loader', type: 'WHEEL_LOADER', benchLevel: 'Low Grade Heap Leach Pad', assignedMaterial: 'ORE_LOW', trucksInQueue: 0, status: 'ACTIVE' },
  { id: 'WL05', model: 'CAT 988K Utility Loader', type: 'WHEEL_LOADER', benchLevel: 'Pit Road Cleanup & Benches', assignedMaterial: 'WASTE', trucksInQueue: 0, status: 'ACTIVE' },
  { id: 'EX11', model: 'Liebherr R9400 Mining Excavator', type: 'EXCAVATOR', benchLevel: 'Deep Pit West RL +40m', assignedMaterial: 'ORE_HIGH', trucksInQueue: 2, status: 'ACTIVE' },
  { id: 'EX12', model: 'Komatsu PC4000 Mining Excavator', type: 'EXCAVATOR', benchLevel: 'South High-Grade Face RL +70m', assignedMaterial: 'ORE_HIGH', trucksInQueue: 1, status: 'ACTIVE' },
  { id: 'Others', model: 'معدات تحميل ومقاولين أخرى (Others Loader)', type: 'EXCAVATOR', benchLevel: 'Various Pit Benches', assignedMaterial: 'ORE_HIGH', trucksInQueue: 0, status: 'ACTIVE' },
];

export const INITIAL_DUMP_LOCATIONS: DumpLocation[] = [
  { id: 'CRUSHER-01', nameAr: 'الكسارة الأولية 01 (Primary Crusher)', type: 'CRUSHER', targetMaterial: 'ORE_HIGH', activeStatus: 'OPEN', currentBenches: 'Plant RL +240m' },
  { id: 'CRUSHER-02', nameAr: 'الكسارة الثانوية 02 (Secondary Crusher)', type: 'CRUSHER', targetMaterial: 'ORE_MEDIUM', activeStatus: 'OPEN', currentBenches: 'Plant RL +240m' },
  { id: 'ROM-PAD', nameAr: 'ساحة تشوين الخام (ROM-PAD High Grade)', type: 'ROM_PAD', targetMaterial: 'ORE_HIGH', activeStatus: 'OPEN', currentBenches: 'Processing RL +230m' },
  { id: 'DUMP-A', nameAr: 'مقلب الصخور العقيمة A (North Waste Dump)', type: 'WASTE_DUMP', targetMaterial: 'WASTE', activeStatus: 'OPEN', currentBenches: 'North Waste RL +280m' },
  { id: 'DUMP-B', nameAr: 'مقلب الردم الجنوبي B (South Waste Dump)', type: 'WASTE_DUMP', targetMaterial: 'WASTE', activeStatus: 'OPEN', currentBenches: 'South Ridge RL +310m' },
  { id: 'LEACH-PAD', nameAr: 'مكدس الغسيل والترشيح (Heap Leach Pad)', type: 'LEACH_PAD', targetMaterial: 'ORE_LOW', activeStatus: 'OPEN', currentBenches: 'Valley West RL +190m' },
];

export const DEFAULT_CONFIG: AppConfig = {
  adminPin: '1234',
  mineName: 'منجم السكري لمناجم الذهب (Sukari Gold Mine)',
  pitSection: 'الحفرة المفتوحة (Open Pit Main Stage 4 & 5)',
  hourlyAutoExport: true,
  autoDownloadCsv: true,
  targetHourlyTonnes: 2500,
  targetShiftTonnes: 30000,
  activeShift: 'MORNING',
  soundEnabled: true,
  officialTeamsChannelUrl:
    'https://teams.microsoft.com/l/channel/19%3AEMpWwmniCxNh6E7k5nPfXVhEGQhgqeCTd4WvOoK7_cU1%40thread.tacv2/Dispatch?groupId=9c1b2fd8-02cb-42a1-afaa-c24d1061dd46&tenantId=9e074b7e-9070-48b3-a751-e33af7c1f8fb',
  teamsWebhookUrl: '',
  whatsappGroupOrPhone: '',
  autoPromptWhatsappShare: false,
  autoSendTeamsWebhook: true,
};

// Seed realistic trips with the new fleet DT001-DT060 & Loading units
export function getInitialSeedTrips(): TripLog[] {
  const baseTime = new Date();
  const trips: TripLog[] = [];
  const drivers = INITIAL_DRIVERS;
  const loadingUnits = ['EX08', 'EX09', 'SH02', 'SH03', 'SH05', 'WL01', 'EX11', 'EX12'];
  const dumps = ['CRUSHER-01', 'CRUSHER-02', 'ROM-PAD', 'DUMP-A', 'DUMP-B'];
  const materials: ('ORE_HIGH' | 'ORE_MEDIUM' | 'WASTE')[] = ['ORE_HIGH', 'ORE_HIGH', 'ORE_MEDIUM', 'WASTE'];

  for (let i = 24; i >= 1; i--) {
    const minutesAgo = i * 11 + Math.floor(Math.random() * 4);
    const loadDate = new Date(baseTime.getTime() - minutesAgo * 60000);
    const dumpDate = new Date(loadDate.getTime() + (7 + Math.floor(Math.random() * 5)) * 60000);
    const driver = drivers[i % drivers.length];
    const truckNumber = (i % 60) + 1;
    const truckId = `DT${String(truckNumber).padStart(3, '0')}`;
    const mat = materials[i % materials.length];
    const shovel = loadingUnits[i % loadingUnits.length];
    const dump = mat === 'WASTE' ? (i % 2 === 0 ? 'DUMP-A' : 'DUMP-B') : dumps[i % 3];

    trips.push({
      id: `TRIP-${Date.now() - i * 800000}-${Math.floor(Math.random() * 1000)}`,
      shiftDate: new Date().toISOString().split('T')[0],
      shiftType: 'MORNING',
      driverCode: driver.code,
      driverName: driver.name,
      truckId,
      truckModel: 'Caterpillar 785D',
      excavatorId: shovel,
      material: mat,
      standbyDurationSec: i % 5 === 0 ? 120 + Math.floor(Math.random() * 180) : 0,
      standbyReason: i % 5 === 0 ? 'QUEUE' : undefined,
      loadStartTime: new Date(loadDate.getTime() - 200000).toISOString(),
      loadEndTime: loadDate.toISOString(),
      dumpLocationId: dump,
      dumpTime: dumpDate.toISOString(),
      payloadTonnes: 150,
      cycleTimeMinutes: Math.round(((dumpDate.getTime() - loadDate.getTime()) / 60000) * 10) / 10,
      synced: true,
      notes: mat === 'ORE_HIGH' ? 'درجة عالية +2.7 g/t Au' : undefined,
    });
  }

  return trips;
}

// Initial Equipment Alerts Seed
export const INITIAL_EQUIPMENT_ALERTS: EquipmentAlert[] = [
  {
    id: 'ALT-101',
    equipmentId: 'DT014',
    equipmentType: 'TRUCK',
    status: 'BREAKDOWN',
    reasonAr: 'عطل في خراطيم هيدروليك الصندوق (Hydraulic Hose Leak)',
    severity: 'CRITICAL',
    reportedAt: new Date(Date.now() - 45 * 60000).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
    reportedBy: 'السائق / طارق عبد الرحيم',
    resolved: false,
  },
  {
    id: 'ALT-102',
    equipmentId: 'DT028',
    equipmentType: 'TRUCK',
    status: 'MAINTENANCE',
    reasonAr: 'فحص ضغط وتآكل إطارات خلفية (Tyre Maintenance)',
    severity: 'WARNING',
    reportedAt: new Date(Date.now() - 30 * 60000).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
    reportedBy: 'ورشة الكاوتش والصيانة',
    resolved: false,
  },
  {
    id: 'ALT-103',
    equipmentId: 'SH04',
    equipmentType: 'LOADER',
    status: 'STANDBY_QUEUE',
    reasonAr: 'انتظار تسوية مصطبة جنوب المنجم بواسطة الجريدر',
    severity: 'INFO',
    reportedAt: new Date(Date.now() - 15 * 60000).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
    reportedBy: 'مشرف قطاع المصاطب',
    resolved: false,
  },
];

// Broadcaster for Real-time Multi-device / Multi-tab Sync
let syncChannel: BroadcastChannel | null = null;
if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
  try {
    syncChannel = new BroadcastChannel('sukari_dispatch_sync_v2');
  } catch {
    // Unsupported
  }
}

const localChangeListeners = new Set<(event: { type: string; payload?: unknown }) => void>();

export function broadcastDataChange(type: string, payload?: unknown) {
  const ev = { type, payload, timestamp: Date.now() };

  // 1. Notify local in-memory subscribers in the current tab immediately
  localChangeListeners.forEach((cb) => {
    try {
      cb(ev);
    } catch {
      // Ignore
    }
  });

  // 2. Broadcast across tabs via BroadcastChannel if supported
  if (syncChannel) {
    try {
      syncChannel.postMessage(ev);
    } catch {
      // Ignore
    }
  }
}

export function subscribeToDataChanges(callback: (event: { type: string; payload?: unknown }) => void) {
  localChangeListeners.add(callback);

  let handler: ((e: MessageEvent) => void) | null = null;
  if (syncChannel) {
    handler = (e: MessageEvent) => {
      if (e.data && e.data.type) {
        callback(e.data);
      }
    };
    syncChannel.addEventListener('message', handler);
  }

  return () => {
    localChangeListeners.delete(callback);
    if (syncChannel && handler) {
      syncChannel.removeEventListener('message', handler);
    }
  };
}

// Storage Helpers
export function getStoredDrivers(): Driver[] {
  if (typeof window === 'undefined') return INITIAL_DRIVERS;
  const raw = localStorage.getItem(STORAGE_KEYS.DRIVERS);
  if (!raw) {
    localStorage.setItem(STORAGE_KEYS.DRIVERS, JSON.stringify(INITIAL_DRIVERS));
    return INITIAL_DRIVERS;
  }
  try {
    return JSON.parse(raw);
  } catch {
    return INITIAL_DRIVERS;
  }
}

export function saveDrivers(drivers: Driver[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEYS.DRIVERS, JSON.stringify(drivers));
  broadcastDataChange('DRIVERS_UPDATED', drivers);
  syncMasterDataToCloud('drivers', drivers);
}

export function getStoredTrucks(): Truck[] {
  if (typeof window === 'undefined') return INITIAL_TRUCKS;
  const raw = localStorage.getItem(STORAGE_KEYS.TRUCKS);
  if (!raw) {
    localStorage.setItem(STORAGE_KEYS.TRUCKS, JSON.stringify(INITIAL_TRUCKS));
    return INITIAL_TRUCKS;
  }
  try {
    const list: Truck[] = JSON.parse(raw);
    let modified = false;
    list.forEach(t => {
      if (t.capacityTonnes !== 152) {
        t.capacityTonnes = 152;
        modified = true;
      }
      if (t.model !== t.id) {
        t.model = t.id;
        modified = true;
      }
    });
    if (modified) {
      localStorage.setItem(STORAGE_KEYS.TRUCKS, JSON.stringify(list));
    }
    return list;
  } catch {
    return INITIAL_TRUCKS;
  }
}

export function saveTrucks(trucks: Truck[], syncMaster: boolean = false) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEYS.TRUCKS, JSON.stringify(trucks));
  broadcastDataChange('TRUCKS_UPDATED', trucks);
  // Only sync to master data if explicitly requested by Admin configuration changes
  if (syncMaster) {
    syncMasterDataToCloud('trucks', trucks);
  }
}

export function updateTruckStatus(truckId: string, status: EquipmentStatusCode, statusNote?: string) {
  const current = getStoredTrucks();
  const lastChange = new Date().toISOString();
  let targetTruck: Truck | undefined;

  const updated = current.map(t => {
    if (t.id === truckId) {
      targetTruck = {
        ...t,
        status,
        statusNote: statusNote !== undefined ? statusNote : t.statusNote,
        lastStatusChange: lastChange,
      };
      return targetTruck;
    }
    return t;
  });

  // 1. Update local storage immediately for current tablet
  localStorage.setItem(STORAGE_KEYS.TRUCKS, JSON.stringify(updated));
  broadcastDataChange('TRUCKS_UPDATED', updated);

  // 2. Sync ONLY this truck's independent document to Cloud Firestore (/fleet_trucks/{truckId})
  // This NEVER overwrites any of the other 59 trucks!
  syncTruckLiveStateToCloud(truckId, {
    status,
    statusNote: statusNote !== undefined ? statusNote : (targetTruck?.statusNote || ''),
    lastStatusChange: lastChange,
  }).catch(console.error);
}

export function updateTruckLiveState(truckId: string, partial: Partial<Truck>) {
  const current = getStoredTrucks();
  const lastChange = new Date().toISOString();

  const updated = current.map(t => {
    if (t.id === truckId) {
      return {
        ...t,
        ...partial,
        lastStatusChange: lastChange,
      };
    }
    return t;
  });

  localStorage.setItem(STORAGE_KEYS.TRUCKS, JSON.stringify(updated));
  broadcastDataChange('TRUCKS_UPDATED', updated);

  // Sync ONLY this truck's independent path
  syncTruckLiveStateToCloud(truckId, {
    ...partial,
    lastStatusChange: lastChange,
  }).catch(console.error);
}

// Tablet-dedicated Truck Assignment & Lock
export function getAssignedTabletTruck(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(STORAGE_KEYS.TABLET_ASSIGNED_TRUCK);
}

export function setAssignedTabletTruck(truckId: string | null) {
  if (typeof window === 'undefined') return;
  if (truckId) {
    localStorage.setItem(STORAGE_KEYS.TABLET_ASSIGNED_TRUCK, truckId);
  } else {
    localStorage.removeItem(STORAGE_KEYS.TABLET_ASSIGNED_TRUCK);
  }
  broadcastDataChange('TABLET_TRUCK_CHANGED', truckId);
}

// Recent drivers who operated this specific truck (last 3-4 drivers)
export function getRecentDriversForTruck(truckId: string): Driver[] {
  if (typeof window === 'undefined') return [];
  const allDrivers = getStoredDrivers();
  const raw = localStorage.getItem(STORAGE_KEYS.TRUCK_RECENT_DRIVERS);
  if (!raw) {
    return allDrivers.slice(0, 4);
  }
  try {
    const map: Record<string, string[]> = JSON.parse(raw);
    const codes = map[truckId] || [];
    const matched = codes
      .map(code => allDrivers.find(d => d.code === code))
      .filter((d): d is Driver => !!d)
      .slice(0, 4);

    if (matched.length === 0) {
      return allDrivers.slice(0, 4);
    }
    return matched;
  } catch {
    return allDrivers.slice(0, 4);
  }
}

export function recordDriverForTruck(truckId: string, driverCode: string) {
  if (typeof window === 'undefined') return;
  const raw = localStorage.getItem(STORAGE_KEYS.TRUCK_RECENT_DRIVERS);
  let map: Record<string, string[]> = {};
  if (raw) {
    try {
      map = JSON.parse(raw);
    } catch {
      map = {};
    }
  }
  const existing = map[truckId] || [];
  const updated = [driverCode, ...existing.filter(c => c !== driverCode)].slice(0, 6);
  map[truckId] = updated;
  localStorage.setItem(STORAGE_KEYS.TRUCK_RECENT_DRIVERS, JSON.stringify(map));
}

export function getStoredExcavators(): Excavator[] {
  if (typeof window === 'undefined') return INITIAL_EXCAVATORS;
  const raw = localStorage.getItem(STORAGE_KEYS.EXCAVATORS);
  if (!raw) {
    localStorage.setItem(STORAGE_KEYS.EXCAVATORS, JSON.stringify(INITIAL_EXCAVATORS));
    return INITIAL_EXCAVATORS;
  }
  try {
    const list: Excavator[] = JSON.parse(raw);
    if (!list.some(e => e.id === 'Others')) {
      const othersItem = INITIAL_EXCAVATORS.find(e => e.id === 'Others');
      if (othersItem) {
        list.push(othersItem);
        localStorage.setItem(STORAGE_KEYS.EXCAVATORS, JSON.stringify(list));
      }
    }
    return list;
  } catch {
    return INITIAL_EXCAVATORS;
  }
}

export function saveExcavators(excavators: Excavator[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEYS.EXCAVATORS, JSON.stringify(excavators));
  broadcastDataChange('EXCAVATORS_UPDATED', excavators);
  syncMasterDataToCloud('excavators', excavators);
}

export function getStoredDumps(): DumpLocation[] {
  if (typeof window === 'undefined') return INITIAL_DUMP_LOCATIONS;
  const raw = localStorage.getItem(STORAGE_KEYS.DUMPS);
  if (!raw) {
    localStorage.setItem(STORAGE_KEYS.DUMPS, JSON.stringify(INITIAL_DUMP_LOCATIONS));
    return INITIAL_DUMP_LOCATIONS;
  }
  try {
    return JSON.parse(raw);
  } catch {
    return INITIAL_DUMP_LOCATIONS;
  }
}

export function saveDumps(dumps: DumpLocation[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEYS.DUMPS, JSON.stringify(dumps));
  broadcastDataChange('DUMPS_UPDATED', dumps);
  syncMasterDataToCloud('dumps', dumps);
}

export function getStoredTrips(): TripLog[] {
  if (typeof window === 'undefined') return [];
  const raw = localStorage.getItem(STORAGE_KEYS.TRIPS);
  if (!raw) {
    const seed = getInitialSeedTrips();
    localStorage.setItem(STORAGE_KEYS.TRIPS, JSON.stringify(seed));
    return seed;
  }
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveTrips(trips: TripLog[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEYS.TRIPS, JSON.stringify(trips));
  broadcastDataChange('TRIPS_UPDATED', trips);
}

export interface PendingSyncItem {
  id: string;
  type: 'TRIP' | 'HANDOVER';
  timestamp: string;
}

export function getPendingSyncQueue(): PendingSyncItem[] {
  if (typeof window === 'undefined') return [];
  const raw = localStorage.getItem(STORAGE_KEYS.PENDING_SYNC_QUEUE);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function addToPendingSyncQueue(type: 'TRIP' | 'HANDOVER', id: string) {
  if (typeof window === 'undefined') return;
  const queue = getPendingSyncQueue();
  if (!queue.some(item => item.id === id && item.type === type)) {
    queue.push({ id, type, timestamp: new Date().toISOString() });
    localStorage.setItem(STORAGE_KEYS.PENDING_SYNC_QUEUE, JSON.stringify(queue));
    broadcastDataChange('PENDING_SYNC_UPDATED', queue.length);
  }
}

export function getPendingSyncCount(): number {
  return getPendingSyncQueue().length;
}

export function getStoredShiftHandovers(): ShiftHandoverRecord[] {
  if (typeof window === 'undefined') return [];
  const raw = localStorage.getItem(STORAGE_KEYS.SHIFT_HANDOVERS);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveShiftHandover(record: ShiftHandoverRecord): { savedLocally: boolean; syncedImmediately: boolean } {
  if (typeof window === 'undefined') return { savedLocally: false, syncedImmediately: false };
  const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

  record.synced = isOnline;
  if (isOnline) {
    record.syncedAt = new Date().toISOString();
  }

  const handovers = getStoredShiftHandovers();
  const filtered = handovers.filter(h => h.id !== record.id);
  const updated = [record, ...filtered];
  localStorage.setItem(STORAGE_KEYS.SHIFT_HANDOVERS, JSON.stringify(updated));

  if (!isOnline) {
    addToPendingSyncQueue('HANDOVER', record.id);
  }

  broadcastDataChange('SHIFT_HANDOVER_SAVED', record);
  return { savedLocally: true, syncedImmediately: isOnline };
}

export interface ActiveCabSession {
  driver: Driver;
  truck: Truck;
  shiftStartTime: string;
  currentScreen: 'LOADER' | 'MATERIAL' | 'DUMP' | 'HAULING_CONFIRM';
  tripsCount: number;
  totalTonnesHauled: number;
  accumulatedStandbySeconds: number;
  isStandby: boolean;
  standbyStart?: string | null;
  standbyReason?: StandbyReason;
  activeTripDraft?: {
    excavator: string;
    loadTime: string;
    standbySec: number;
    standbyReason?: StandbyReason;
    material?: MaterialType;
    dumpLocation?: string;
    payloadTonnes?: number;
  } | null;
}

export function getActiveCabSession(): ActiveCabSession | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(STORAGE_KEYS.ACTIVE_CAB_SESSION);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function saveActiveCabSession(session: ActiveCabSession) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEYS.ACTIVE_CAB_SESSION, JSON.stringify(session));
  broadcastDataChange('ACTIVE_CAB_SESSION_UPDATED', session);
}

export function clearActiveCabSession() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEYS.ACTIVE_CAB_SESSION);
  broadcastDataChange('ACTIVE_CAB_SESSION_CLEARED', null);
}

export function syncPendingOfflineData(): { syncedTrips: number; syncedHandovers: number } {
  if (typeof window === 'undefined') return { syncedTrips: 0, syncedHandovers: 0 };
  const queue = getPendingSyncQueue();
  if (queue.length === 0) return { syncedTrips: 0, syncedHandovers: 0 };

  let syncedTrips = 0;
  let syncedHandovers = 0;

  const trips = getStoredTrips();
  let tripsModified = false;
  const handovers = getStoredShiftHandovers();
  let handoversModified = false;

  for (const item of queue) {
    if (item.type === 'TRIP') {
      const idx = trips.findIndex(t => t.id === item.id);
      if (idx >= 0 && !trips[idx].synced) {
        trips[idx].synced = true;
        tripsModified = true;
        syncedTrips++;
        syncTripToCloud(trips[idx]).catch(console.error);
        syncTruckLiveStateToCloud(trips[idx].truckId, {
          status: 'ACTIVE',
          lastStatusChange: new Date().toISOString(),
        }).catch(console.error);
      }
    } else if (item.type === 'HANDOVER') {
      const idx = handovers.findIndex(h => h.id === item.id);
      if (idx >= 0 && !handovers[idx].synced) {
        handovers[idx].synced = true;
        handovers[idx].syncedAt = new Date().toISOString();
        handoversModified = true;
        syncedHandovers++;
      }
    }
  }

  if (tripsModified) {
    saveTrips(trips);
  }
  if (handoversModified) {
    localStorage.setItem(STORAGE_KEYS.SHIFT_HANDOVERS, JSON.stringify(handovers));
    broadcastDataChange('SHIFT_HANDOVERS_SYNCED', handovers);
  }

  localStorage.removeItem(STORAGE_KEYS.PENDING_SYNC_QUEUE);
  broadcastDataChange('PENDING_SYNC_CLEARED', { syncedTrips, syncedHandovers });

  return { syncedTrips, syncedHandovers };
}

export function addTrip(newTrip: TripLog) {
  const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
  newTrip.synced = isOnline;

  const current = getStoredTrips();
  const updated = [newTrip, ...current];
  saveTrips(updated);

  // 1. Sync trip to cloud immediately using distinct paths (/fleet_trips/{tripId} and /fleet_trucks/{truckId}/trips/{tripId})
  if (isOnline) {
    syncTripToCloud(newTrip).catch(console.error);
  } else {
    addToPendingSyncQueue('TRIP', newTrip.id);
  }

  // 2. Update ONLY this truck's trip count and status (Zero-overwrite for all other 59 dumpers!)
  const trucks = getStoredTrucks();
  const truckIndex = trucks.findIndex(t => t.id === newTrip.truckId);
  if (truckIndex >= 0) {
    const newTripsToday = (trucks[truckIndex].tripsToday || 0) + 1;
    const newTonnesToday = (trucks[truckIndex].tonnesToday || 0) + (newTrip.payloadTonnes || 152);
    const nowIso = new Date().toISOString();

    trucks[truckIndex].tripsToday = newTripsToday;
    trucks[truckIndex].tonnesToday = newTonnesToday;
    trucks[truckIndex].status = 'ACTIVE';
    trucks[truckIndex].lastStatusChange = nowIso;

    // Save locally on this tablet & broadcast to local tabs
    localStorage.setItem(STORAGE_KEYS.TRUCKS, JSON.stringify(trucks));
    broadcastDataChange('TRUCKS_UPDATED', trucks);

    // 3. Sync ONLY this truck's live state to Cloud Firestore
    syncTruckLiveStateToCloud(newTrip.truckId, {
      tripsToday: newTripsToday,
      tonnesToday: newTonnesToday,
      status: 'ACTIVE',
      lastStatusChange: nowIso,
    }).catch(console.error);
  }
  return updated;
}

export function getStoredHourlyExports(): HourlyExportSnapshot[] {
  if (typeof window === 'undefined') return [];
  const raw = localStorage.getItem(STORAGE_KEYS.HOURLY_EXPORTS);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveHourlyExport(snapshot: HourlyExportSnapshot) {
  if (typeof window === 'undefined') return;
  const existing = getStoredHourlyExports();
  const filtered = existing.filter(item => item.id !== snapshot.id);
  const updated = [snapshot, ...filtered];
  localStorage.setItem(STORAGE_KEYS.HOURLY_EXPORTS, JSON.stringify(updated));
  broadcastDataChange('HOURLY_EXPORT_ADDED', snapshot);
  return updated;
}

export function getStoredEquipmentAlerts(): EquipmentAlert[] {
  if (typeof window === 'undefined') return INITIAL_EQUIPMENT_ALERTS;
  const raw = localStorage.getItem(STORAGE_KEYS.EQUIPMENT_ALERTS);
  if (!raw) {
    localStorage.setItem(STORAGE_KEYS.EQUIPMENT_ALERTS, JSON.stringify(INITIAL_EQUIPMENT_ALERTS));
    return INITIAL_EQUIPMENT_ALERTS;
  }
  try {
    return JSON.parse(raw);
  } catch {
    return INITIAL_EQUIPMENT_ALERTS;
  }
}

export function saveEquipmentAlerts(alerts: EquipmentAlert[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEYS.EQUIPMENT_ALERTS, JSON.stringify(alerts));
  broadcastDataChange('EQUIPMENT_ALERTS_UPDATED', alerts);
}

export function addEquipmentAlert(newAlert: EquipmentAlert) {
  const current = getStoredEquipmentAlerts();
  const updated = [newAlert, ...current];
  saveEquipmentAlerts(updated);

  // Sync alert to Cloud Firestore immediately
  syncEquipmentAlertToCloud(newAlert).catch(console.error);

  // If this alert applies to a truck, update the truck status
  if (newAlert.equipmentType === 'TRUCK') {
    const trucks = getStoredTrucks();
    const idx = trucks.findIndex(t => t.id === newAlert.equipmentId);
    if (idx >= 0) {
      trucks[idx].status = newAlert.status;
      trucks[idx].statusNote = newAlert.reasonAr;
      trucks[idx].lastStatusChange = newAlert.reportedAt;
      saveTrucks(trucks);
    }
  }

  // If this alert applies to an excavator, update the excavator status
  if (newAlert.equipmentType === 'LOADER') {
    const excavators = getStoredExcavators();
    const idx = excavators.findIndex(ex => ex.id === newAlert.equipmentId);
    if (idx >= 0) {
      excavators[idx].status = newAlert.status;
      saveExcavators(excavators);
    }
  }

  return updated;
}

export function resolveEquipmentAlert(alertId: string) {
  const current = getStoredEquipmentAlerts();
  let resolvedItem: EquipmentAlert | null = null;
  const updated = current.map(a => {
    if (a.id === alertId) {
      resolvedItem = { ...a, resolved: true, resolvedAt: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) };
      return resolvedItem;
    }
    return a;
  });
  saveEquipmentAlerts(updated);

  if (resolvedItem) {
    syncEquipmentAlertToCloud(resolvedItem).catch(console.error);
  }

  // Restore equipment status to ACTIVE
  const target = current.find(a => a.id === alertId);
  if (target && target.equipmentType === 'TRUCK') {
    const trucks = getStoredTrucks();
    const idx = trucks.findIndex(t => t.id === target.equipmentId);
    if (idx >= 0) {
      trucks[idx].status = 'ACTIVE';
      trucks[idx].statusNote = undefined;
      saveTrucks(trucks);
    }
  }
  return updated;
}

export function getAppConfig(): AppConfig {
  if (typeof window === 'undefined') return DEFAULT_CONFIG;
  const raw = localStorage.getItem(STORAGE_KEYS.CONFIG);
  if (!raw) {
    localStorage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify(DEFAULT_CONFIG));
    return DEFAULT_CONFIG;
  }
  try {
    return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_CONFIG;
  }
}

export function saveAppConfig(config: AppConfig) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify(config));
  broadcastDataChange('CONFIG_UPDATED', config);
  syncMasterDataToCloud('app_config', config);
}

export function getStoredDispatchAlerts(): DispatchAlert[] {
  if (typeof window === 'undefined') return [];
  const raw = localStorage.getItem(STORAGE_KEYS.DISPATCH_ALERTS);
  if (!raw) {
    const defaultAlert: DispatchAlert = {
      id: 'ALERT-01',
      timestamp: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
      sender: 'غرفة الدسباتش المركزية',
      messageAr: 'أسطول الدنابر (DT001 إلى DT060) ومعدات التحميل متصل وجاهز. الرجاء الالتزام بمسارات التحميل المحددة.',
      priority: 'NORMAL',
      active: true,
    };
    return [defaultAlert];
  }
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveDispatchAlerts(alerts: DispatchAlert[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEYS.DISPATCH_ALERTS, JSON.stringify(alerts));
  broadcastDataChange('ALERTS_UPDATED', alerts);
}

// Convert TripLogs to CSV string with Arabic Excel BOM
export function generateTripsCSV(trips: TripLog[], title = 'تقرير دسباتش منجم السكري'): string {
  const headers = [
    'معرف الرحلة',
    'التاريخ',
    'الوردية',
    'كود السائق',
    'اسم السائق',
    'رقم الدنبر (المعدة)',
    'موديل الشاحنة',
    'معدة التحميل (الحفار/الشوڤل)',
    'نوع الخام / المادة',
    'مدة الانتظار (ثانية)',
    'سبب الانتظار',
    'وقت التحميل',
    'مكان التفريغ',
    'وقت التفريغ',
    'الحمولة (طن)',
    'زمن الدورة (دقيقة)',
    'ملاحظات'
  ];

  const materialNames: Record<string, string> = {
    ORE_HIGH: 'هاي جريد HG (+2.5g/t)',
    ORE_MEDIUM: 'ميديم جريد MG (1.2-2.5g/t)',
    ORE_LOW: 'لو جريد LG (0.5-1.2g/t)',
    SUB_GRADE: 'سب جريد SG (Sub-Grade)',
    WASTE: 'صخور عقيمة / ويست Waste',
  };

  const reasonNames: Record<string, string> = {
    QUEUE: 'طابور انتظار بالحفار',
    MECHANICAL: 'عطل ميكانيكي',
    TYRE_CHECK: 'فحص إطارات',
    BLASTING: 'تفجير بالمنجم',
    ROAD_MAINTENANCE: 'تسوية مسار',
    DUST_WATERING: 'رش مياه',
    SHIFT_CHANGE: 'تبديل وردية',
    WEATHER: 'أحوال جوية',
  };

  const rows = trips.map(t => [
    t.id,
    t.shiftDate,
    t.shiftType === 'MORNING' ? 'صباحي' : 'ليلي',
    t.driverCode,
    `"${t.driverName}"`,
    t.truckId,
    `"${t.truckId}"`, // Clean truck ID without cluttered model
    t.excavatorId,
    `"${materialNames[t.material] || t.material}"`,
    t.standbyDurationSec,
    `"${t.standbyReason ? (reasonNames[t.standbyReason] || t.standbyReason) : '-'}"`,
    `"${new Date(t.loadEndTime).toLocaleTimeString('ar-EG')}"`,
    t.dumpLocationId,
    `"${new Date(t.dumpTime).toLocaleTimeString('ar-EG')}"`,
    t.payloadTonnes || 152, // 152 tonnes
    t.cycleTimeMinutes,
    `"${t.notes || ''}"`
  ]);

  return '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
}

export function downloadCSV(csvContent: string, filename: string) {
  if (typeof window === 'undefined') return;
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Generate Beautiful WhatsApp / Teams Formatted Shift Report matching Excel sheet
export function generateHourlyFormattedText(snapshot: {
  hourLabel: string;
  totalTripsThisHour: number;
  totalTonnesThisHour: number;
  oreTonnesThisHour: number;
  subGradeTonnesThisHour?: number;
  wasteTonnesThisHour: number;
  activeTrucksCount: number;
  cumulativeShiftTrips: number;
  cumulativeShiftTonnes: number;
  activeBreakdownsCount?: number;
  trips?: TripLog[];
}): string {
  const dateStr = new Date().toLocaleDateString('ar-EG', {
    weekday: 'long',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  });
  const timeStr = new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });

  // Group trips by truck ID (رقم الدنبر) for detailed matching with Excel
  const truckSummary: Record<string, { trips: number; tonnes: number; materials: Set<string>; excavators: Set<string>; dumps: Set<string> }> = {};
  if (snapshot.trips && snapshot.trips.length > 0) {
    snapshot.trips.forEach(t => {
      if (!truckSummary[t.truckId]) {
        truckSummary[t.truckId] = {
          trips: 0,
          tonnes: 0,
          materials: new Set(),
          excavators: new Set(),
          dumps: new Set(),
        };
      }
      truckSummary[t.truckId].trips += 1;
      truckSummary[t.truckId].tonnes += (t.payloadTonnes || 152);
      truckSummary[t.truckId].materials.add(t.material);
      truckSummary[t.truckId].excavators.add(t.excavatorId);
      truckSummary[t.truckId].dumps.add(t.dumpLocationId);
    });
  }

  const matShort: Record<string, string> = {
    ORE_HIGH: 'هاي جريد HG',
    ORE_MEDIUM: 'ميديم جريد MG',
    ORE_LOW: 'لو جريد LG',
    SUB_GRADE: 'سب جريد SG',
    WASTE: 'ويست Waste',
  };

  const truckLines = Object.keys(truckSummary).sort().map(truckId => {
    const s = truckSummary[truckId];
    const mats = Array.from(s.materials).map(m => matShort[m] || m).join(' / ');
    const exs = Array.from(s.excavators).join(', ');
    const dmps = Array.from(s.dumps).join(', ');
    return `🚛 *دنبر [${truckId}]:* ${s.trips} نقلات (${s.tonnes.toLocaleString()} طن) | خام: ${mats} | حفار: ${exs} | مقلب: ${dmps}`;
  }).join('\n');

  return `📊 *تقرير الدسباتش الساعي الرسمي — منجم السكري لمناجم الذهب*
━━━━━━━━━━━━━━━━━━━━
⏰ *رقم وتوقيت التقرير:* تقرير الساعة ${snapshot.hourLabel} (${timeStr})
📅 *التاريخ:* ${dateStr}
⛏️ *قطاع التشغيل:* الحفرة المفتوحة (Open Pit)
⚖️ *حمولة الدنبر المعتمدة بالحسابات:* 152 طن / نقلة

📈 *ملخص إنتاجية الساعة (${snapshot.hourLabel}):*
• إجمالي الحمولات: *${snapshot.totalTripsThisHour} نقلة*
• إجمالي الطن المنقول: *${snapshot.totalTonnesThisHour.toLocaleString()} طن* (بمعدل 152 طن/نقلة)
• خام الذهب (Ore HG/MG/LG): *${snapshot.oreTonnesThisHour.toLocaleString()} طن*
${snapshot.subGradeTonnesThisHour ? `• خام سب جريد (Sub-Grade SG): *${snapshot.subGradeTonnesThisHour.toLocaleString()} طن*\n` : ''}• صخور عقيمة (Waste): *${snapshot.wasteTonnesThisHour.toLocaleString()} طن*
• عدد الدنابر العاملة بالساعة: *${snapshot.activeTrucksCount} دنبر*

📋 *بيان تفصيلي بكل دنبر والمعدات خلال الساعة (${snapshot.hourLabel}):*
${truckLines || '• لم تُسجل نقلات خلال هذه الساعة'}

🏆 *الإجمالي التراكمي منذ بداية الوردية:*
• إجمالي حمولات الوردية: *${snapshot.cumulativeShiftTrips} نقلة*
• إجمالي الأطنان التراكمية: *${snapshot.cumulativeShiftTonnes.toLocaleString()} طن*

⚠️ *الأعطال والحالات الطارئة:* ${snapshot.activeBreakdownsCount || 0} معدة متوقفة للصيانة
━━━━━━━━━━━━━━━━━━━━
📡 _نسخة رقمية مطابقة لتقرير الإكسيل الساعي — أوتوماتيك لجروب الواتساب_`;
}

export const OFFICIAL_SUKARI_WHATSAPP_GROUP = 'https://chat.whatsapp.com/GirrgYGO1OFDRRk8Kv4voV?s=cl&p=a&mlu=4&ilr=4';

// Manual Direct WhatsApp Share (Only triggered when driver/dispatcher explicitly clicks share)
export function openWhatsAppShare(text: string, phoneOrGroup = '') {
  if (typeof window === 'undefined') return;

  const config = getAppConfig();

  // Always copy full formatted message to clipboard
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).catch(() => {});
  }

  const encoded = encodeURIComponent(text);
  const target = phoneOrGroup || config.whatsappGroupOrPhone || OFFICIAL_SUKARI_WHATSAPP_GROUP;
  const cleanPhone = target.replace(/[^0-9]/g, '');

  const url = cleanPhone && !target.includes('chat.whatsapp.com')
    ? `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encoded}`
    : `https://api.whatsapp.com/send?text=${encoded}`;

  window.open(url, '_blank');
}

// Automatically Share Excel CSV File + Formatted Report to WhatsApp Group
export async function shareExcelReportToWhatsApp(snapshot: HourlyExportSnapshot): Promise<boolean> {
  const config = getAppConfig();
  const targetGroup = config.whatsappGroupOrPhone || OFFICIAL_SUKARI_WHATSAPP_GROUP;
  const filename = `تقرير_ساعي_دسباتش_منجم_السكري_الساعة_${snapshot.hourLabel.replace(':', '_')}.csv`;

  // 1. Copy formatted text with truck breakdown & Excel equivalent to clipboard
  if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
    try {
      await navigator.clipboard.writeText(snapshot.whatsappMessage);
    } catch {}
  }

  // 2. Try native mobile / tablet share if available (shares the real Excel CSV file directly into WhatsApp!)
  if (typeof navigator !== 'undefined' && navigator.share && navigator.canShare) {
    try {
      const blob = new Blob([snapshot.csvContent], { type: 'text/csv;charset=utf-8;' });
      const file = new File([blob], filename, { type: 'text/csv' });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: `تقرير إكسيل منجم السكري - الساعة ${snapshot.hourLabel}`,
          text: snapshot.whatsappMessage,
          files: [file],
        });
        return true;
      }
    } catch {
      // Fall through to direct group URL
    }
  }

  // 3. Fallback: Trigger download of Excel CSV & Open WhatsApp with prefilled message
  downloadCSV(snapshot.csvContent, filename);
  openWhatsAppShare(snapshot.whatsappMessage, targetGroup);
  return true;
}

export function getStandbyReasonArabicLabel(reason?: StandbyReason): string {
  switch (reason) {
    case 'QUEUE':
      return 'طابور انتظار على الحفار (Queue)';
    case 'MECHANICAL':
      return 'عطل ميكانيكي / هيدروليك (Mechanical)';
    case 'TYRE_CHECK':
      return 'فحص الإطارات والكاوتش (Tyre Check)';
    case 'BLASTING':
      return 'توقف لأعمال التفجير (Blasting)';
    case 'ROAD_MAINTENANCE':
      return 'تسوية الطرق والجريدر (Road Maintenance)';
    case 'DUST_WATERING':
      return 'رش مياه وتثبيط الغبار (Dust Watering)';
    case 'SHIFT_CHANGE':
      return 'تبديل وردية واستراحة (Shift Change)';
    case 'WEATHER':
      return 'أحوال جوية وعواصف (Weather)';
    default:
      return 'انتظار وتوقف مؤقت (Standby)';
  }
}

// Background Dispatchers
export function sendDriverLoginToWhatsApp(_driver: Driver, _truck: Truck) {}

export function sendStandbyStartToWhatsApp(_driver: Driver, _truck: Truck, _reason?: StandbyReason, _startTime = new Date()) {}

export function sendStandbyEndToWhatsApp(
  _driver: Driver,
  _truck: Truck,
  _durationSeconds: number,
  _reason?: StandbyReason,
  _endTime = new Date()
) {}

export function sendShiftHandoverToWhatsApp(_handover: ShiftHandoverRecord) {}

export async function sendTeamsWebhookMessage(_webhookUrl: string, _title: string, _text: string): Promise<boolean> {
  return true;
}

// Global Online Listener for Automatic Sync upon reconnecting to internet
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    const res = syncPendingOfflineData();
    if (res.syncedTrips > 0 || res.syncedHandovers > 0) {
      broadcastDataChange('OFFLINE_SYNC_COMPLETED', res);
    }
  });
}

// ==========================================
// 1. FUELING LOGS & MONITORING (تفويل جاز)
// ==========================================

export function getFuelingLogs(): FuelingLog[] {
  if (typeof window === 'undefined') return [];
  const raw = localStorage.getItem(STORAGE_KEYS.FUELING_LOGS);
  if (!raw) {
    // Seed initial demo fueling events
    const initialSeed: FuelingLog[] = [
      {
        id: 'FUEL-001',
        truckId: 'DT019',
        driverCode: '1004',
        driverName: 'مينا يوسف',
        startTime: new Date(Date.now() - 18 * 60 * 1000).toISOString(), // 18 mins ago (In Progress - Warning)
        status: 'IN_PROGRESS',
        notes: 'تفويل ديزل دوري - محطة الوقود المركزية',
      },
      {
        id: 'FUEL-002',
        truckId: 'DT007',
        driverCode: '1002',
        driverName: 'أحمد مصطفى',
        startTime: new Date(Date.now() - 55 * 60 * 1000).toISOString(),
        endTime: new Date(Date.now() - 42 * 60 * 1000).toISOString(),
        durationMinutes: 13,
        status: 'COMPLETED',
        notes: 'تم تزويد 820 لتر ديزل بنجاح',
      },
    ];
    localStorage.setItem(STORAGE_KEYS.FUELING_LOGS, JSON.stringify(initialSeed));
    return initialSeed;
  }
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveFuelingLogs(logs: FuelingLog[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEYS.FUELING_LOGS, JSON.stringify(logs));
  broadcastDataChange('FUELING_LOGS_UPDATED', logs);
}

// ==========================================
// 1. 4-STAGE PROGRESSIVE FUELING (تفويل الجاز المتدرج)
// رايح أفول -> وصلت البنزينة -> طلعت من البنزينة -> بدأت التحميل
// ==========================================

export function startTruckFuelingEnRoute(
  truckId: string,
  driverCode: string,
  driverName: string,
  notes = 'في الطريق لمحطة الوقود'
): FuelingLog {
  const current = getFuelingLogs();
  const now = new Date().toISOString();

  // Close any previously hanging active session for this truck
  const cleaned = current.map(f => {
    if (f.truckId === truckId && f.status !== 'COMPLETED') {
      const closed = { ...f, status: 'COMPLETED' as const, endTime: now };
      syncFuelingToCloud(closed).catch(console.error);
      return closed;
    }
    return f;
  });

  const newLog: FuelingLog = {
    id: `FUEL-${truckId}-${Date.now()}`,
    truckId,
    driverCode,
    driverName,
    startTime: now,
    enRouteStartTime: now,
    status: 'EN_ROUTE',
    notes,
  };

  const updated = [newLog, ...cleaned];
  saveFuelingLogs(updated);

  // Sync distinct fueling event to cloud
  syncFuelingToCloud(newLog).catch(console.error);

  // Update truck status in /fleet_trucks/{truckId}
  updateTruckStatus(truckId, 'FUELING', 'رايح يفول جاز ⛽ (في الطريق للمحطة)');
  return newLog;
}

export function advanceTruckFuelingAtStation(truckId: string): FuelingLog | null {
  const current = getFuelingLogs();
  const now = new Date().toISOString();
  let updatedLog: FuelingLog | null = null;

  const updated = current.map(f => {
    if (f.truckId === truckId && f.status !== 'COMPLETED') {
      updatedLog = {
        ...f,
        status: 'AT_STATION' as const,
        atStationTime: now,
        notes: 'وصل البنزينة وجاري التفويل',
      };
      return updatedLog;
    }
    return f;
  });

  if (updatedLog) {
    saveFuelingLogs(updated);
    syncFuelingToCloud(updatedLog).catch(console.error);
    updateTruckStatus(truckId, 'FUELING', 'وصل البنزينة وجاري التفويل ⛽');
  }
  return updatedLog;
}

export function advanceTruckFuelingDepartStation(truckId: string): FuelingLog | null {
  const current = getFuelingLogs();
  const now = new Date().toISOString();
  let updatedLog: FuelingLog | null = null;

  const updated = current.map(f => {
    if (f.truckId === truckId && f.status !== 'COMPLETED') {
      updatedLog = {
        ...f,
        status: 'RETURNING' as const,
        departStationTime: now,
        notes: 'طلع من البنزينة وعائد للحفرة',
      };
      return updatedLog;
    }
    return f;
  });

  if (updatedLog) {
    saveFuelingLogs(updated);
    syncFuelingToCloud(updatedLog).catch(console.error);
    updateTruckStatus(truckId, 'ACTIVE', 'طلع من البنزينة وعائد للحفرة 🚚');
  }
  return updatedLog;
}

export function advanceTruckFuelingStartLoading(truckId: string, excavatorId?: string): FuelingLog | null {
  const current = getFuelingLogs();
  const now = new Date();
  const nowIso = now.toISOString();
  let completedLog: FuelingLog | null = null;

  const updated = current.map(f => {
    if (f.truckId === truckId && f.status !== 'COMPLETED') {
      const start = new Date(f.startTime).getTime();
      const durationMinutes = Math.max(1, Math.round((now.getTime() - start) / 60000));
      completedLog = {
        ...f,
        status: 'COMPLETED' as const,
        loadingStartTime: nowIso,
        endTime: nowIso,
        durationMinutes,
        notes: excavatorId ? `بدأ التحميل عند حفار ${excavatorId}` : 'بدأ التحميل واكتمل التفويل',
      };
      return completedLog;
    }
    return f;
  });

  if (completedLog) {
    saveFuelingLogs(updated);
    syncFuelingToCloud(completedLog).catch(console.error);
    updateTruckStatus(truckId, 'LOADING', excavatorId ? `بدأ التحميل عند ${excavatorId} 🏗️` : 'بدأ التحميل 🏗️');
  }
  return completedLog;
}

export function startTruckFueling(
  truckId: string,
  driverCode: string,
  driverName: string,
  notes?: string
): FuelingLog {
  return startTruckFuelingEnRoute(truckId, driverCode, driverName, notes);
}

export function endTruckFueling(truckId: string): FuelingLog | null {
  return advanceTruckFuelingStartLoading(truckId);
}

export function getActiveFuelingTrucks(): FuelingLog[] {
  return getFuelingLogs().filter(f => f.status !== 'COMPLETED');
}

export function getActiveFuelingForTruck(truckId: string): FuelingLog | undefined {
  return getFuelingLogs().find(f => f.truckId === truckId && f.status !== 'COMPLETED');
}

// ==========================================
// DRIVER SESSIONS & ATTENDANCE (تسجيل حضور ودخول وخروج السائقين)
// ==========================================

export function getDriverSessions(): DriverSessionRecord[] {
  if (typeof window === 'undefined') return [];
  const raw = localStorage.getItem(STORAGE_KEYS.DRIVER_SESSIONS);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveDriverSessions(sessions: DriverSessionRecord[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEYS.DRIVER_SESSIONS, JSON.stringify(sessions));
  broadcastDataChange('DRIVER_SESSIONS_UPDATED', sessions);
}

export function recordDriverLoginSession(driverCode: string, driverName: string, truckId: string): DriverSessionRecord {
  const current = getDriverSessions();
  const now = new Date();
  const nowIso = now.toISOString();

  // Close any existing active session for this truck
  const cleaned = current.map(s => {
    if (s.truckId === truckId && s.status === 'ACTIVE') {
      const start = new Date(s.loginTime).getTime();
      const durationMinutes = Math.max(1, Math.round((now.getTime() - start) / 60000));
      const closed = { ...s, status: 'CLOSED' as const, logoutTime: nowIso, totalDurationMinutes: durationMinutes };
      syncDriverSessionToCloud(closed).catch(console.error);
      return closed;
    }
    return s;
  });

  const newSession: DriverSessionRecord = {
    id: `SESS-${truckId}-${driverCode}-${Date.now()}`,
    driverCode,
    driverName,
    truckId,
    loginTime: nowIso,
    status: 'ACTIVE',
    tripsCompleted: 0,
    tonnesMoved: 0,
    date: now.toLocaleDateString('ar-EG'),
  };

  const updated = [newSession, ...cleaned];
  saveDriverSessions(updated);

  // Sync session and truck state
  syncDriverSessionToCloud(newSession).catch(console.error);
  syncTruckLiveStateToCloud(truckId, {
    status: 'ACTIVE',
    assignedDriver: driverCode,
    statusNote: 'في الخدمة 🟢',
    lastStatusChange: nowIso,
  }).catch(console.error);

  return newSession;
}

export function recordDriverLogoutSession(truckId: string, tripsCount: number, totalTonnes: number): DriverSessionRecord | null {
  const current = getDriverSessions();
  const now = new Date();
  const nowIso = now.toISOString();
  let closedSession: DriverSessionRecord | null = null;

  const updated = current.map(s => {
    if (s.truckId === truckId && s.status === 'ACTIVE') {
      const start = new Date(s.loginTime).getTime();
      const durationMinutes = Math.max(1, Math.round((now.getTime() - start) / 60000));
      closedSession = {
        ...s,
        status: 'CLOSED' as const,
        logoutTime: nowIso,
        totalDurationMinutes: durationMinutes,
        tripsCompleted: tripsCount,
        tonnesMoved: totalTonnes,
      };
      return closedSession;
    }
    return s;
  });

  saveDriverSessions(updated);

  if (closedSession) {
    syncDriverSessionToCloud(closedSession).catch(console.error);
    syncTruckLiveStateToCloud(truckId, {
      status: 'STANDBY_QUEUE',
      assignedDriver: '',
      statusNote: 'تسليم الوردية وانصراف السائق',
      lastStatusChange: nowIso,
    }).catch(console.error);
  }

  return closedSession;
}

// ==========================================
// DISTINCT STANDBY & DELAY TRACKING
// ==========================================

export function recordStandbyStart(
  truckId: string,
  driverCode: string,
  driverName: string,
  reason: StandbyReason,
  reasonLabelAr?: string
): StandbyCloudEvent {
  const standbyId = `STDBY-${truckId}-${Date.now()}`;
  const nowIso = new Date().toISOString();
  const label = reasonLabelAr || getStandbyReasonArabicLabel(reason);

  const event: StandbyCloudEvent = {
    id: standbyId,
    truckId,
    driverCode,
    driverName,
    reason,
    reasonLabelAr: label,
    startTime: nowIso,
    status: 'ACTIVE',
  };

  syncStandbyToCloud(event).catch(console.error);
  updateTruckStatus(truckId, 'STANDBY_QUEUE', label);

  return event;
}

export function recordStandbyEnd(
  standbyId: string | null,
  truckId: string,
  durationSeconds: number
): void {
  const nowIso = new Date().toISOString();

  if (standbyId) {
    syncStandbyToCloud({
      id: standbyId,
      truckId,
      driverCode: '',
      driverName: '',
      reason: 'QUEUE',
      reasonLabelAr: 'استاند باي',
      startTime: nowIso,
      endTime: nowIso,
      durationSeconds,
      status: 'COMPLETED',
    }).catch(console.error);
  }

  updateTruckStatus(truckId, 'ACTIVE', 'استئناف العمل 🟢');
}

// ==========================================
// CUSTOM STANDBY REASONS (إدارة أسباب الانتظار والتوقف)
// ==========================================

const DEFAULT_STANDBY_REASONS: CustomStandbyReason[] = [
  { id: 'QUEUE', code: 'QUEUE', labelAr: 'طابور انتظار على الحفار (Queue)', icon: '⏳', active: true, category: 'OPERATIONAL' },
  { id: 'MECHANICAL', code: 'MECHANICAL', labelAr: 'عطل ميكانيكي / هيدروليك (Mechanical)', icon: '🔧', active: true, category: 'MAINTENANCE' },
  { id: 'TYRE_CHECK', code: 'TYRE_CHECK', labelAr: 'فحص الإطارات والكاوتش (Tyre Check)', icon: '🛞', active: true, category: 'MAINTENANCE' },
  { id: 'BLASTING', code: 'BLASTING', labelAr: 'توقف لأعمال التفجير (Blasting)', icon: '💥', active: true, category: 'SAFETY' },
  { id: 'ROAD_MAINTENANCE', code: 'ROAD_MAINTENANCE', labelAr: 'تسوية الطرق والجريدر (Road)', icon: '🚜', active: true, category: 'OPERATIONAL' },
  { id: 'DUST_WATERING', code: 'DUST_WATERING', labelAr: 'رش مياه وتثبيط الغبار (Dust)', icon: '🚿', active: true, category: 'SAFETY' },
  { id: 'SHIFT_CHANGE', code: 'SHIFT_CHANGE', labelAr: 'تبديل وردية واستراحة (Shift)', icon: '☕', active: true, category: 'OPERATIONAL' },
  { id: 'WEATHER', code: 'WEATHER', labelAr: 'أحوال جوية وعواصف (Weather)', icon: '🌪️', active: true, category: 'WEATHER' },
];

export function getCustomStandbyReasons(): CustomStandbyReason[] {
  if (typeof window === 'undefined') return DEFAULT_STANDBY_REASONS;
  const raw = localStorage.getItem(STORAGE_KEYS.CUSTOM_STANDBY_REASONS);
  if (!raw) {
    localStorage.setItem(STORAGE_KEYS.CUSTOM_STANDBY_REASONS, JSON.stringify(DEFAULT_STANDBY_REASONS));
    return DEFAULT_STANDBY_REASONS;
  }
  try {
    return JSON.parse(raw);
  } catch {
    return DEFAULT_STANDBY_REASONS;
  }
}

export function saveCustomStandbyReasons(reasons: CustomStandbyReason[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEYS.CUSTOM_STANDBY_REASONS, JSON.stringify(reasons));
  broadcastDataChange('CUSTOM_STANDBY_REASONS_UPDATED', reasons);
  syncMasterDataToCloud('custom_standby_reasons', reasons);
}

export function addCustomStandbyReason(reason: Omit<CustomStandbyReason, 'id'>): CustomStandbyReason {
  const current = getCustomStandbyReasons();
  const newReason: CustomStandbyReason = {
    ...reason,
    id: `REASON-${Date.now()}`,
  };
  const updated = [...current, newReason];
  saveCustomStandbyReasons(updated);
  return newReason;
}

export function updateCustomStandbyReason(id: string, updates: Partial<CustomStandbyReason>) {
  const current = getCustomStandbyReasons();
  const updated = current.map(r => (r.id === id ? { ...r, ...updates } : r));
  saveCustomStandbyReasons(updated);
}

export function deleteCustomStandbyReason(id: string) {
  const current = getCustomStandbyReasons();
  const updated = current.filter(r => r.id !== id);
  saveCustomStandbyReasons(updated);
}

// ==========================================
// DIRECT EQUIPMENT CRUD UPDATES (ADMIN PANEL)
// ==========================================

export function updateTruckDetails(truckId: string, updates: Partial<Truck>): Truck | null {
  const current = getStoredTrucks();
  let updatedTruck: Truck | null = null;
  const updated = current.map(t => {
    if (t.id === truckId) {
      updatedTruck = { ...t, ...updates };
      return updatedTruck;
    }
    return t;
  });
  if (updatedTruck) {
    localStorage.setItem(STORAGE_KEYS.TRUCKS, JSON.stringify(updated));
    broadcastDataChange('TRUCKS_UPDATED', updated);
    syncTruckLiveStateToCloud(truckId, updates).catch(console.error);
  }
  return updatedTruck;
}

export function updateExcavatorDetails(excavatorId: string, updates: Partial<Excavator>): Excavator | null {
  const current = getStoredExcavators();
  let updatedEx: Excavator | null = null;
  const updated = current.map(ex => {
    if (ex.id === excavatorId) {
      updatedEx = { ...ex, ...updates };
      return updatedEx;
    }
    return ex;
  });
  if (updatedEx) {
    saveExcavators(updated);
    broadcastDataChange('EXCAVATORS_UPDATED', updated);
  }
  return updatedEx;
}

export function updateDumpDetails(dumpId: string, updates: Partial<DumpLocation>): DumpLocation | null {
  const current = getStoredDumps();
  let updatedDump: DumpLocation | null = null;
  const updated = current.map(d => {
    if (d.id === dumpId) {
      updatedDump = { ...d, ...updates };
      return updatedDump;
    }
    return d;
  });
  if (updatedDump) {
    saveDumps(updated);
    broadcastDataChange('DUMPS_UPDATED', updated);
  }
  return updatedDump;
}

// ==========================================
// DRAG & DROP CUSTOM SORT ORDER
// ==========================================

export function getCustomTrucksOrder(): string[] {
  if (typeof window === 'undefined') return [];
  const raw = localStorage.getItem(STORAGE_KEYS.CUSTOM_TRUCKS_ORDER);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveCustomTrucksOrder(order: string[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEYS.CUSTOM_TRUCKS_ORDER, JSON.stringify(order));
  broadcastDataChange('TRUCKS_ORDER_UPDATED', order);
}

export function getCustomExcavatorsOrder(): string[] {
  if (typeof window === 'undefined') return [];
  const raw = localStorage.getItem(STORAGE_KEYS.CUSTOM_EXCAVATORS_ORDER);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveCustomExcavatorsOrder(order: string[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEYS.CUSTOM_EXCAVATORS_ORDER, JSON.stringify(order));
  broadcastDataChange('EXCAVATORS_ORDER_UPDATED', order);
}

// ==========================================
// 2. DISPATCHER INSTANT DIRECT MESSENGER
// ==========================================

export function getDispatcherMessages(): DispatcherDirectMessage[] {
  if (typeof window === 'undefined') return [];
  const raw = localStorage.getItem(STORAGE_KEYS.DIRECT_MESSAGES);
  if (!raw) {
    const initialSeed: DispatcherDirectMessage[] = [
      {
        id: 'MSG-001',
        timestamp: new Date(Date.now() - 35 * 60 * 1000).toISOString(),
        targetTruckId: 'DT005',
        targetDriverName: 'محمود شاكر',
        messageText: 'توجه فوراً لحفار EX08 - قطاع North Pit RL +140m لتحميل خام هاي جريد',
        priority: 'URGENT',
        sender: 'منسق غرفة التحكم (Dispatcher)',
        acknowledged: true,
        acknowledgedAt: new Date(Date.now() - 34 * 60 * 1000).toISOString(),
      },
      {
        id: 'MSG-002',
        timestamp: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
        targetTruckId: 'ALL',
        messageText: 'تنبيه لجميع السائقين: يرجى تخفيف السرعة عند منحدر الرامب الشرقي لوجود جريدر صيانة طرق',
        priority: 'NORMAL',
        sender: 'منسق غرفة التحكم (Dispatcher)',
        acknowledged: false,
      },
    ];
    localStorage.setItem(STORAGE_KEYS.DIRECT_MESSAGES, JSON.stringify(initialSeed));
    return initialSeed;
  }
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveDispatcherMessages(messages: DispatcherDirectMessage[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEYS.DIRECT_MESSAGES, JSON.stringify(messages));
  broadcastDataChange('DIRECT_MESSAGES_UPDATED', messages);
}

export function sendDispatcherMessage(
  targetTruckId: string,
  messageText: string,
  priority: 'NORMAL' | 'URGENT' | 'CRITICAL' = 'NORMAL',
  sender = 'منسق غرفة التحكم (Dispatcher)',
  targetDriverName?: string
): DispatcherDirectMessage {
  const current = getDispatcherMessages();
  const id = `MSG-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  const newMsg: DispatcherDirectMessage = {
    id,
    timestamp: new Date().toISOString(),
    targetTruckId,
    targetDriverName,
    messageText,
    priority,
    sender,
    acknowledged: false,
  };

  const updated = [newMsg, ...current.slice(0, 49)];
  saveDispatcherMessages(updated);

  // Send to Cloud Firestore over the Internet so any tablet receives it immediately
  sendCloudDispatcherMessage(targetTruckId, messageText, priority, sender, targetDriverName).catch(console.error);

  return newMsg;
}

export function acknowledgeDispatcherMessage(id: string): boolean {
  const current = getDispatcherMessages();
  let found = false;
  const updated = current.map(m => {
    if (m.id === id) {
      found = true;
      return { ...m, acknowledged: true, acknowledgedAt: new Date().toISOString() };
    }
    return m;
  });
  if (found) {
    saveDispatcherMessages(updated);
    acknowledgeCloudMessage(id).catch(console.error);
  }
  return found;
}

export function getUnacknowledgedMessagesForTruck(truckId: string): DispatcherDirectMessage[] {
  const messages = getDispatcherMessages();
  return messages.filter(
    m => !m.acknowledged && (m.targetTruckId === 'ALL' || m.targetTruckId === truckId)
  );
}

// ==========================================
// 3. EXCAVATOR PRODUCTIVITY TARGETS
// ==========================================

export const DEFAULT_EXCAVATOR_TARGETS: Record<string, ExcavatorTarget> = {
  EX08: { excavatorId: 'EX08', targetTonnesPerHour: 450, targetTripsPerHour: 3 },
  EX09: { excavatorId: 'EX09', targetTonnesPerHour: 450, targetTripsPerHour: 3 },
  SH02: { excavatorId: 'SH02', targetTonnesPerHour: 760, targetTripsPerHour: 5 },
  SH03: { excavatorId: 'SH03', targetTonnesPerHour: 600, targetTripsPerHour: 4 },
  SH04: { excavatorId: 'SH04', targetTonnesPerHour: 600, targetTripsPerHour: 4 },
  SH05: { excavatorId: 'SH05', targetTonnesPerHour: 600, targetTripsPerHour: 4 },
  SH06: { excavatorId: 'SH06', targetTonnesPerHour: 760, targetTripsPerHour: 5 },
  WL01: { excavatorId: 'WL01', targetTonnesPerHour: 300, targetTripsPerHour: 2 },
  WL02: { excavatorId: 'WL02', targetTonnesPerHour: 300, targetTripsPerHour: 2 },
  WL03: { excavatorId: 'WL03', targetTonnesPerHour: 300, targetTripsPerHour: 2 },
  WL04: { excavatorId: 'WL04', targetTonnesPerHour: 300, targetTripsPerHour: 2 },
  WL05: { excavatorId: 'WL05', targetTonnesPerHour: 250, targetTripsPerHour: 2 },
  EX11: { excavatorId: 'EX11', targetTonnesPerHour: 450, targetTripsPerHour: 3 },
  EX12: { excavatorId: 'EX12', targetTonnesPerHour: 450, targetTripsPerHour: 3 },
  Others: { excavatorId: 'Others', targetTonnesPerHour: 300, targetTripsPerHour: 2 },
};

export function getExcavatorTargets(): Record<string, ExcavatorTarget> {
  if (typeof window === 'undefined') return DEFAULT_EXCAVATOR_TARGETS;
  const raw = localStorage.getItem(STORAGE_KEYS.EXCAVATOR_TARGETS);
  if (!raw) {
    localStorage.setItem(STORAGE_KEYS.EXCAVATOR_TARGETS, JSON.stringify(DEFAULT_EXCAVATOR_TARGETS));
    return DEFAULT_EXCAVATOR_TARGETS;
  }
  try {
    return { ...DEFAULT_EXCAVATOR_TARGETS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_EXCAVATOR_TARGETS;
  }
}

export function saveExcavatorTarget(target: ExcavatorTarget): void {
  if (typeof window === 'undefined') return;
  const current = getExcavatorTargets();
  const updated = { ...current, [target.excavatorId]: target };
  localStorage.setItem(STORAGE_KEYS.EXCAVATOR_TARGETS, JSON.stringify(updated));
  broadcastDataChange('EXCAVATOR_TARGETS_UPDATED', updated);
}

// ==========================================
// 4. PRODUCTION GAP ALERTS DETECTOR (>= 15 MIN DEVIATION)
// لوحة تنبيهات الفجوات الإنتاجية
// ==========================================

export function detectProductionGaps(
  trips: TripLog[],
  trucks: Truck[],
  excavators: Excavator[],
  activeFuelings: FuelingLog[]
): ProductionGapAlert[] {
  const alerts: ProductionGapAlert[] = [];
  const now = Date.now();

  // 1. Check Trucks Fueling Delays (> 15 minutes)
  activeFuelings.forEach(fuel => {
    const startMs = new Date(fuel.startTime).getTime();
    const elapsedMinutes = Math.floor((now - startMs) / 60000);
    if (elapsedMinutes >= 15) {
      const severity: 'WARNING' | 'CRITICAL' = elapsedMinutes >= 25 ? 'CRITICAL' : 'WARNING';
      const estimatedLostTonnes = Math.round((elapsedMinutes / 12) * 152); // ~152t every 12-min trip cycle
      alerts.push({
        id: `GAP-FUEL-${fuel.truckId}`,
        unitId: fuel.truckId,
        unitType: 'TRUCK',
        gapType: 'FUELING_DELAY',
        severity,
        durationMinutes: elapsedMinutes,
        estimatedTonsLost: estimatedLostTonnes,
        descriptionAr: `تجاوز زمن التفويل في محطة الوقود ${elapsedMinutes} دقيقة بواسطة السائق ${fuel.driverName}`,
        detectedAt: new Date(fuel.startTime).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
        correctiveAction: 'الاتصال بمحطة الوقود وتوجيه الدنبر للمغادرة فوراً لاستئناف دورة التحميل',
      });
    }
  });

  // 2. Check Trucks Standby & Excessive Queue (> 15 minutes)
  trucks.forEach(truck => {
    if (truck.status === 'STANDBY_QUEUE') {
      // Find last trip
      const lastTrip = trips.find(t => t.truckId === truck.id);
      const lastTime = lastTrip ? new Date(lastTrip.dumpTime).getTime() : now - 22 * 60 * 1000;
      const elapsedMinutes = Math.floor((now - lastTime) / 60000);
      if (elapsedMinutes >= 15) {
        const severity: 'WARNING' | 'CRITICAL' = elapsedMinutes >= 25 ? 'CRITICAL' : 'WARNING';
        const estimatedLostTonnes = Math.round((elapsedMinutes / 12) * 152);
        alerts.push({
          id: `GAP-TRUCK-QUEUE-${truck.id}`,
          unitId: truck.id,
          unitType: 'TRUCK',
          gapType: 'STANDBY_QUEUE',
          severity,
          durationMinutes: elapsedMinutes,
          estimatedTonsLost: estimatedLostTonnes,
          descriptionAr: `توقف وتكدس في طابور الحفار لأكثر من ${elapsedMinutes} دقيقة دون إتمام نقلة`,
          detectedAt: new Date(lastTime).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
          correctiveAction: 'إعادة توزيع مسار الدنبر إلى حفار بديل أقل ازدحاماً',
        });
      }
    }
  });

  // 3. Check Excavator Starvation / Bottleneck (Active loader with > 15 minutes since last load)
  const targets = getExcavatorTargets();
  excavators.forEach(ex => {
    if (ex.status === 'ACTIVE') {
      const loaderTrips = trips.filter(t => t.excavatorId === ex.id);
      const mostRecentTrip = loaderTrips.sort((a, b) => new Date(b.dumpTime).getTime() - new Date(a.dumpTime).getTime())[0];
      const lastLoadTime = mostRecentTrip ? new Date(mostRecentTrip.dumpTime).getTime() : now - 32 * 60 * 1000;
      const elapsedMinutes = Math.floor((now - lastLoadTime) / 60000);

      if (elapsedMinutes >= 15) {
        const target = targets[ex.id]?.targetTonnesPerHour || 450;
        const tonsPerMin = target / 60;
        const estimatedLostTonnes = Math.round(elapsedMinutes * tonsPerMin);
        const severity: 'WARNING' | 'CRITICAL' = elapsedMinutes >= 25 ? 'CRITICAL' : 'WARNING';

        alerts.push({
          id: `GAP-LOADER-${ex.id}`,
          unitId: ex.id,
          unitType: 'EXCAVATOR',
          gapType: 'LOADER_STARVATION',
          severity,
          durationMinutes: elapsedMinutes,
          estimatedTonsLost: estimatedLostTonnes,
          descriptionAr: `توقف تدفق التحميل على الحفار ${ex.id} في ${ex.benchLevel} منذ ${elapsedMinutes} دقيقة`,
          detectedAt: new Date(lastLoadTime).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
          correctiveAction: 'توجيه شاحنتين فارغتين فوراً إلى مصطبة الحفار لإنعاش خط التحميل',
        });
      }
    }
  });

  // Sort: CRITICAL first, then highest duration
  return alerts.sort((a, b) => {
    if (a.severity === 'CRITICAL' && b.severity !== 'CRITICAL') return -1;
    if (a.severity !== 'CRITICAL' && b.severity === 'CRITICAL') return 1;
    return b.durationMinutes - a.durationMinutes;
  });
}

// ==========================================
// CLOUD MASTER DATA SYNC & REALTIME SUBSCRIBER
// Automatically syncs any Admin or Dispatcher edits to all devices every minute and upon changes
// ==========================================

export async function pullCloudMasterData(): Promise<{ success: boolean; syncedItems: string[] }> {
  const syncedItems: string[] = [];
  try {
    const [trucks, excavators, dumps, drivers, reasons, config, alerts, liveTrucksMap, cloudTrips] =
      await Promise.all([
        fetchMasterDataFromCloud('trucks'),
        fetchMasterDataFromCloud('excavators'),
        fetchMasterDataFromCloud('dumps'),
        fetchMasterDataFromCloud('drivers'),
        fetchMasterDataFromCloud('custom_standby_reasons'),
        fetchMasterDataFromCloud('app_config'),
        fetchCloudEquipmentAlerts(),
        fetchFleetTrucksFromCloud(),
        fetchCloudFleetTrips(300),
      ]);

    // 1. Smart merge for trucks: Base definition from master data + live per-truck state from /fleet_trucks/{truckId}
    const currentTrucks = getStoredTrucks();
    const currentTrucksMap = new Map<string, Truck>();
    currentTrucks.forEach(t => currentTrucksMap.set(t.id, t));

    const baseTrucksList = trucks && Array.isArray(trucks) && trucks.length > 0 ? trucks : currentTrucks;
    const mergedTrucks = baseTrucksList.map((baseTruck: Truck) => {
      const live = liveTrucksMap[baseTruck.id];
      const existing = currentTrucksMap.get(baseTruck.id);
      return {
        ...baseTruck,
        // Live state takes precedence over static definition
        status: live?.status || existing?.status || baseTruck.status,
        statusNote: live?.statusNote !== undefined ? live.statusNote : existing?.statusNote !== undefined ? existing.statusNote : baseTruck.statusNote,
        lastStatusChange: live?.lastStatusChange || existing?.lastStatusChange || baseTruck.lastStatusChange,
        tripsToday: live?.tripsToday !== undefined ? live.tripsToday : existing?.tripsToday !== undefined ? existing.tripsToday : baseTruck.tripsToday,
        tonnesToday: live?.tonnesToday !== undefined ? live.tonnesToday : existing?.tonnesToday !== undefined ? existing.tonnesToday : baseTruck.tonnesToday,
        assignedDriver: live?.assignedDriver || existing?.assignedDriver || baseTruck.assignedDriver,
      };
    });

    localStorage.setItem(STORAGE_KEYS.TRUCKS, JSON.stringify(mergedTrucks));
    broadcastDataChange('TRUCKS_UPDATED', mergedTrucks);
    syncedItems.push('trucks');

    // 2. Cumulative merge for haulage trips across all 60 dumpers
    if (cloudTrips && Array.isArray(cloudTrips) && cloudTrips.length > 0) {
      const localTrips = getStoredTrips();
      const tripsMap = new Map<string, TripLog>();
      localTrips.forEach(t => tripsMap.set(t.id, t));
      cloudTrips.forEach(t => tripsMap.set(t.id, t));
      const mergedTrips = Array.from(tripsMap.values()).sort(
        (a, b) => new Date(b.dumpTime).getTime() - new Date(a.dumpTime).getTime()
      );
      localStorage.setItem(STORAGE_KEYS.TRIPS, JSON.stringify(mergedTrips));
      broadcastDataChange('TRIPS_UPDATED', mergedTrips);
      syncedItems.push('trips');
    }

    if (excavators && Array.isArray(excavators) && excavators.length > 0) {
      localStorage.setItem(STORAGE_KEYS.EXCAVATORS, JSON.stringify(excavators));
      broadcastDataChange('EXCAVATORS_UPDATED', excavators);
      syncedItems.push('excavators');
    }
    if (dumps && Array.isArray(dumps) && dumps.length > 0) {
      localStorage.setItem(STORAGE_KEYS.DUMPS, JSON.stringify(dumps));
      broadcastDataChange('DUMPS_UPDATED', dumps);
      syncedItems.push('dumps');
    }
    if (drivers && Array.isArray(drivers) && drivers.length > 0) {
      localStorage.setItem(STORAGE_KEYS.DRIVERS, JSON.stringify(drivers));
      broadcastDataChange('DRIVERS_UPDATED', drivers);
      syncedItems.push('drivers');
    }
    if (reasons && Array.isArray(reasons) && reasons.length > 0) {
      localStorage.setItem(STORAGE_KEYS.CUSTOM_STANDBY_REASONS, JSON.stringify(reasons));
      broadcastDataChange('CUSTOM_STANDBY_REASONS_UPDATED', reasons);
      syncedItems.push('custom_standby_reasons');
    }
    if (config) {
      localStorage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify(config));
      broadcastDataChange('CONFIG_UPDATED', config);
      syncedItems.push('app_config');
    }
    if (alerts && Array.isArray(alerts) && alerts.length > 0) {
      localStorage.setItem(STORAGE_KEYS.EQUIPMENT_ALERTS, JSON.stringify(alerts));
      broadcastDataChange('EQUIPMENT_ALERTS_UPDATED', alerts);
      syncedItems.push('equipment_alerts');
    }

    return { success: true, syncedItems };
  } catch (err) {
    console.warn('Failed to pull master data from cloud:', err);
    return { success: false, syncedItems };
  }
}

// Global Master Data & Realtime Listeners across all tablets in the mine
if (typeof window !== 'undefined') {
  // 1. Master data updates from admin
  subscribeToMasterData((docId, data) => {
    try {
      if (docId === 'trucks' && Array.isArray(data) && data.length > 0) {
        // Smart merge preserving active operational status
        const current = getStoredTrucks();
        const currentMap = new Map<string, Truck>();
        current.forEach(t => currentMap.set(t.id, t));

        const merged = data.map((masterTruck: Truck) => {
          const existing = currentMap.get(masterTruck.id);
          if (!existing) return masterTruck;
          return {
            ...masterTruck,
            status: existing.status || masterTruck.status,
            statusNote: existing.statusNote !== undefined ? existing.statusNote : masterTruck.statusNote,
            lastStatusChange: existing.lastStatusChange || masterTruck.lastStatusChange,
            tripsToday: Math.max(existing.tripsToday || 0, masterTruck.tripsToday || 0),
            tonnesToday: Math.max(existing.tonnesToday || 0, masterTruck.tonnesToday || 0),
            assignedDriver: existing.assignedDriver || masterTruck.assignedDriver,
          };
        });
        localStorage.setItem(STORAGE_KEYS.TRUCKS, JSON.stringify(merged));
        broadcastDataChange('TRUCKS_UPDATED', merged);
      } else if (docId === 'excavators' && Array.isArray(data) && data.length > 0) {
        localStorage.setItem(STORAGE_KEYS.EXCAVATORS, JSON.stringify(data));
        broadcastDataChange('EXCAVATORS_UPDATED', data);
      } else if (docId === 'dumps' && Array.isArray(data) && data.length > 0) {
        localStorage.setItem(STORAGE_KEYS.DUMPS, JSON.stringify(data));
        broadcastDataChange('DUMPS_UPDATED', data);
      } else if (docId === 'drivers' && Array.isArray(data) && data.length > 0) {
        localStorage.setItem(STORAGE_KEYS.DRIVERS, JSON.stringify(data));
        broadcastDataChange('DRIVERS_UPDATED', data);
      } else if (docId === 'custom_standby_reasons' && Array.isArray(data) && data.length > 0) {
        localStorage.setItem(STORAGE_KEYS.CUSTOM_STANDBY_REASONS, JSON.stringify(data));
        broadcastDataChange('CUSTOM_STANDBY_REASONS_UPDATED', data);
      } else if (docId === 'app_config' && data) {
        localStorage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify(data));
        broadcastDataChange('CONFIG_UPDATED', data);
      }
    } catch (e) {
      console.warn('Error applying cloud master data update in background:', e);
    }
  });

  // 2. Real-time individual truck live state listener (/fleet_trucks/{truckId})
  // When ANY truck sends an update, only that truck is updated; all other 59 trucks remain active and untouched!
  subscribeToFleetTrucks((trucksMap) => {
    try {
      const current = getStoredTrucks();
      let modified = false;
      const updated = current.map(t => {
        const live = trucksMap[t.id];
        if (live) {
          modified = true;
          return {
            ...t,
            status: live.status || t.status,
            statusNote: live.statusNote !== undefined ? live.statusNote : t.statusNote,
            lastStatusChange: live.lastStatusChange || t.lastStatusChange,
            tripsToday: live.tripsToday !== undefined ? live.tripsToday : t.tripsToday,
            tonnesToday: live.tonnesToday !== undefined ? live.tonnesToday : t.tonnesToday,
            assignedDriver: live.assignedDriver || t.assignedDriver,
          };
        }
        return t;
      });
      if (modified) {
        localStorage.setItem(STORAGE_KEYS.TRUCKS, JSON.stringify(updated));
        broadcastDataChange('TRUCKS_UPDATED', updated);
      }
    } catch (e) {
      console.warn('Error applying live truck state update:', e);
    }
  });

  // 3. Real-time distinct haulage trips listener (/fleet_trips/{tripId})
  // Accumulates distinct trips from all 60 dumpers without any concurrency collision!
  subscribeToCloudFleetTrips((cloudTrips) => {
    try {
      if (cloudTrips && cloudTrips.length > 0) {
        const current = getStoredTrips();
        const tripsMap = new Map<string, TripLog>();
        current.forEach(t => tripsMap.set(t.id, t));
        cloudTrips.forEach(t => tripsMap.set(t.id, t));
        const merged = Array.from(tripsMap.values()).sort(
          (a, b) => new Date(b.dumpTime).getTime() - new Date(a.dumpTime).getTime()
        );
        localStorage.setItem(STORAGE_KEYS.TRIPS, JSON.stringify(merged));
        broadcastDataChange('TRIPS_UPDATED', merged);
      }
    } catch (e) {
      console.warn('Error applying cloud fleet trips update:', e);
    }
  });

  // 4. Real-time equipment status and breakdown alerts sync across all devices
  subscribeToCloudEquipmentAlerts((alerts) => {
    try {
      if (alerts && Array.isArray(alerts) && alerts.length > 0) {
        localStorage.setItem(STORAGE_KEYS.EQUIPMENT_ALERTS, JSON.stringify(alerts));
        broadcastDataChange('EQUIPMENT_ALERTS_UPDATED', alerts);
      }
    } catch (e) {
      console.warn('Error applying equipment alerts update:', e);
    }
  });

  // 5. Real-time distinct fueling sync across all tablets
  subscribeToCloudFuelings((cloudFuelings) => {
    try {
      if (cloudFuelings && cloudFuelings.length > 0) {
        const current = getFuelingLogs();
        const map = new Map<string, FuelingLog>();
        current.forEach(f => map.set(f.id, f));
        cloudFuelings.forEach(f => map.set(f.id, f));
        const merged = Array.from(map.values()).sort(
          (a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
        );
        localStorage.setItem(STORAGE_KEYS.FUELING_LOGS, JSON.stringify(merged));
        broadcastDataChange('FUELING_LOGS_UPDATED', merged);
      }
    } catch (e) {
      console.warn('Error applying cloud fuelings update:', e);
    }
  });

  // 6. Real-time distinct driver sessions sync across all devices
  subscribeToCloudDriverSessions((cloudSessions) => {
    try {
      if (cloudSessions && cloudSessions.length > 0) {
        const current = getDriverSessions();
        const map = new Map<string, DriverSessionRecord>();
        current.forEach(s => map.set(s.id, s));
        cloudSessions.forEach(s => map.set(s.id, s));
        const merged = Array.from(map.values()).sort(
          (a, b) => new Date(b.loginTime).getTime() - new Date(a.loginTime).getTime()
        );
        localStorage.setItem(STORAGE_KEYS.DRIVER_SESSIONS, JSON.stringify(merged));
        broadcastDataChange('DRIVER_SESSIONS_UPDATED', merged);
      }
    } catch (e) {
      console.warn('Error applying cloud driver sessions update:', e);
    }
  });
}


