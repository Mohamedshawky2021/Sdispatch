export type MaterialType = 'ORE_HIGH' | 'ORE_MEDIUM' | 'ORE_LOW' | 'SUB_GRADE' | 'WASTE';

export interface MaterialInfo {
  id: MaterialType;
  nameAr: string;
  nameEn: string;
  color: string;
  bgClass: string;
  borderClass: string;
  defaultGrade: string;
}

export type StandbyReason =
  | 'QUEUE'             // طابور انتظار على الحفار
  | 'MECHANICAL'        // عطل ميكانيكي / هيدروليك
  | 'TYRE_CHECK'        // فحص الإطارات / الكاوتش
  | 'BLASTING'          // تفجير في المنجم
  | 'ROAD_MAINTENANCE'  // تسوية الطرق والجريدر
  | 'DUST_WATERING'     // رش مياه / غبار
  | 'SHIFT_CHANGE'      // تبديل وردية / راحة
  | 'WEATHER';          // أحوال جوية / رياح

export interface StandbyReasonInfo {
  id: StandbyReason;
  labelAr: string;
  iconName: string;
}

export interface Driver {
  code: string;
  name: string;
  role: string;
  licenseLevel: string;
  phone?: string;
}

export type EquipmentStatusCode =
  | 'ACTIVE'          // شغال / في الخدمة
  | 'LOADING'         // جاري التحميل
  | 'HAULING'         // نقل في الطريق
  | 'DUMPING'         // تفريغ في الكسارة / المقلب
  | 'STANDBY_QUEUE'   // انتظار في الطابور
  | 'FUELING'         // تفويل جاز / سولار
  | 'BREAKDOWN'       // عطل فني / ميكانيكي
  | 'MAINTENANCE'     // صيانة دورية / تزييت / إطارات
  | 'BLASTING_WAIT';  // متوقف لأعمال التفجير

export interface Truck {
  id: string; // e.g. DT001 - DT060
  model: string;
  capacityTonnes: number;
  tareWeightTonnes: number;
  status: EquipmentStatusCode;
  assignedDriver?: string;
  currentExcavator?: string;
  currentDump?: string;
  tripsToday: number;
  tonnesToday?: number;
  lastStatusChange?: string;
  statusNote?: string;
  lastParkingLocation?: string;
  lastParkingTime?: string;
}

export interface Excavator {
  id: string; // e.g. EX08, SH02, WL01...
  model: string;
  type: 'EXCAVATOR' | 'SHOVEL' | 'WHEEL_LOADER';
  benchLevel: string; // e.g. Bench RL +140m
  assignedMaterial: MaterialType;
  trucksInQueue: number;
  status: EquipmentStatusCode;
  hourlyCapacityTonnes?: number;
  statusNote?: string;
  isAvailable?: boolean;
}

export interface DumpLocation {
  id: string;
  nameAr: string;
  type: 'CRUSHER' | 'WASTE_DUMP' | 'ROM_PAD' | 'LEACH_PAD';
  targetMaterial: MaterialType;
  activeStatus: 'OPEN' | 'CONGESTED' | 'MAINTENANCE' | 'FULL' | 'CLOSED' | 'INACTIVE';
  currentBenches: string;
  statusNote?: string;
  isAvailable?: boolean;
}

export interface ParkingLocation {
  id: string; // e.g. PARK-01
  nameAr: string; // e.g. موقف الورشة المركزية
  code: string; // e.g. P-WORKSHOP
  area?: string; // e.g. الورشة المركزية
  capacity?: number;
  active: boolean;
  notes?: string;
}

export interface TripLog {
  id: string;
  shiftDate: string;
  shiftType: 'MORNING' | 'NIGHT';
  driverCode: string;
  driverName: string;
  truckId: string;
  truckModel: string;
  excavatorId: string;
  material: MaterialType;
  standbyDurationSec: number;
  standbyReason?: StandbyReason;
  loadStartTime: string;
  loadEndTime: string;
  dumpLocationId: string;
  dumpTime: string;
  payloadTonnes: number;
  cycleTimeMinutes: number;
  synced: boolean;
  notes?: string;
}

export interface EquipmentAlert {
  id: string;
  equipmentId: string; // e.g. DT014, EX08, SH03
  equipmentType: 'TRUCK' | 'LOADER';
  status: EquipmentStatusCode;
  reasonAr: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  reportedAt: string;
  reportedBy: string;
  resolved: boolean;
  resolvedAt?: string;
  imageUrl?: string; // Optional attached photo of breakdown/incident
}

export interface DispatchAlert {
  id: string;
  timestamp: string;
  sender: string;
  messageAr: string;
  priority: 'NORMAL' | 'URGENT' | 'CRITICAL';
  active: boolean;
  imageUrl?: string; // Optional attached photo
}

export interface ShiftSummary {
  shiftDate: string;
  shiftName: string;
  totalTrips: number;
  totalTonnes: number;
  oreTonnes: number;
  wasteTonnes: number;
  totalStandbyMinutes: number;
  avgCycleMinutes: number;
}

export interface ShiftHandoverRecord {
  id: string;
  driverCode: string;
  driverName: string;
  truckId: string;
  truckModel: string;
  shiftStartTime: string;
  shiftEndTime: string;
  tripsCount: number;
  totalTonnes: number;
  standbySeconds: number;
  parkingLocationId?: string;
  parkingLocationName?: string;
  notes?: string;
  synced: boolean;
  syncedAt?: string;
}

export type FuelingStage =
  | 'EN_ROUTE'     // رايح أفول
  | 'AT_STATION'   // وصلت البنزينة
  | 'RETURNING'    // طلعت من البنزينة
  | 'COMPLETED';   // بدأت التحميل

export interface FuelingLog {
  id: string;
  truckId: string;
  driverCode: string;
  driverName: string;
  startTime: string; // ISO string
  enRouteStartTime?: string; // رايح أفول
  atStationTime?: string; // وصلت البنزينة
  departStationTime?: string; // طلعت من البنزينة
  loadingStartTime?: string; // بدأت التحميل
  endTime?: string;   // ISO string
  durationMinutes?: number;
  status: FuelingStage | 'IN_PROGRESS';
  notes?: string;
}

export interface DriverSessionRecord {
  id: string;
  driverCode: string;
  driverName: string;
  truckId: string;
  loginTime: string; // ISO string
  logoutTime?: string; // ISO string
  totalDurationMinutes?: number;
  tripsCompleted: number;
  tonnesMoved: number;
  parkingLocation?: string;
  status: 'ACTIVE' | 'CLOSED';
  date: string;
}

export interface CustomStandbyReason {
  id: string;
  code: string;
  labelAr: string;
  icon?: string;
  category?: 'OPERATIONAL' | 'SAFETY' | 'MAINTENANCE' | 'WEATHER';
  active: boolean;
}

export interface DispatcherDirectMessage {
  id: string;
  timestamp: string; // ISO string
  targetTruckId: string; // 'ALL' or e.g. 'DT005'
  targetDriverName?: string;
  messageText: string;
  priority: 'NORMAL' | 'URGENT' | 'CRITICAL';
  sender: string;
  acknowledged: boolean;
  acknowledgedAt?: string;
}

export interface ExcavatorTarget {
  excavatorId: string;
  targetTonnesPerHour: number;
  targetTripsPerHour: number;
}

export interface ProductionGapAlert {
  id: string;
  unitId: string; // e.g. DT014 or EX08
  unitType: 'TRUCK' | 'EXCAVATOR';
  gapType: 'STANDBY_QUEUE' | 'FUELING_DELAY' | 'CYCLE_DELAY' | 'LOADER_STARVATION' | 'LOW_PRODUCTIVITY';
  severity: 'WARNING' | 'CRITICAL'; // WARNING = 15-25 min, CRITICAL = >25 min
  durationMinutes: number;
  estimatedTonsLost: number;
  descriptionAr: string;
  detectedAt: string;
  correctiveAction: string;
}

