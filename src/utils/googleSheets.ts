import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
  signOut,
  setPersistence,
  browserLocalPersistence,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import {
  TripLog,
  Truck,
  Excavator,
  FuelingLog,
  DumpLocation,
  DriverSessionRecord,
  StandbyReason,
} from '../types/dispatch';
import {
  getStoredTrips,
  getStoredTrucks,
  getStoredExcavators,
  getStoredDumps,
  getFuelingLogs,
  getDriverSessions,
  getEquipmentInterventions,
  getTruckExcavatorAssignments,
} from './storage';

// Ensure Firebase is initialized only once
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);

// Provider with required Google Workspace Scopes
const provider = new GoogleAuthProvider();
provider.addScope('https://www.googleapis.com/auth/spreadsheets');
provider.addScope('https://www.googleapis.com/auth/drive.file');

// Permanent Constant Defaults for all devices in the mine
export const DEFAULT_SPREADSHEET_ID = '13OBFMBXBC515M7-qbHJmQaiMDsqxUBZ9f546U5YOkj4';
export const DEFAULT_SPREADSHEET_URL =
  'https://docs.google.com/spreadsheets/d/13OBFMBXBC515M7-qbHJmQaiMDsqxUBZ9f546U5YOkj4/edit?usp=drivesdk';
export const DEFAULT_OFFICIAL_ACCOUNT_EMAIL = 'sukaridispatch@gmail.com';

provider.setCustomParameters({
  login_hint: DEFAULT_OFFICIAL_ACCOUNT_EMAIL,
  prompt: 'select_account',
});

// LocalStorage keys for persistent sign-in across reloads, restarts and app closes
const ACCESS_TOKEN_KEY = 'SUKARI_GOOGLE_ACCESS_TOKEN_V1';
const USER_CACHE_KEY = 'SUKARI_GOOGLE_USER_CACHE_V1';

// Enforce browser local persistence in Firebase Auth so session survives browser/tablet restart
if (typeof window !== 'undefined') {
  setPersistence(auth, browserLocalPersistence).catch((err) => {
    console.warn('Failed to set browserLocalPersistence:', err);
  });
}

// Token cache initialized from localStorage
let isSigningIn = false;
let cachedAccessToken: string | null =
  typeof window !== 'undefined' ? localStorage.getItem(ACCESS_TOKEN_KEY) : null;
let currentUser: User | null = null;

const SHEETS_CONFIG_KEY = 'SUKARI_GOOGLE_SHEETS_CONFIG_V1';

export interface GoogleSheetsConfig {
  spreadsheetId: string;
  spreadsheetUrl: string;
  spreadsheetTitle: string;
  lastSyncedAt?: string;
  syncedTripsCount?: number;
  autoSyncEnabled?: boolean;
}

export const DEFAULT_SHEETS_CONFIG: GoogleSheetsConfig = {
  spreadsheetId: DEFAULT_SPREADSHEET_ID,
  spreadsheetUrl: DEFAULT_SPREADSHEET_URL,
  spreadsheetTitle: 'منجم السكري — سجلات الدسباتش المعتمدة (13OBFMBX...)',
  autoSyncEnabled: true,
};

export function getStoredSheetsConfig(): GoogleSheetsConfig {
  if (typeof window === 'undefined') return DEFAULT_SHEETS_CONFIG;
  const raw = localStorage.getItem(SHEETS_CONFIG_KEY);
  if (!raw) {
    localStorage.setItem(SHEETS_CONFIG_KEY, JSON.stringify(DEFAULT_SHEETS_CONFIG));
    return DEFAULT_SHEETS_CONFIG;
  }
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.spreadsheetId) {
      return DEFAULT_SHEETS_CONFIG;
    }
    return parsed;
  } catch {
    return DEFAULT_SHEETS_CONFIG;
  }
}

export function saveStoredSheetsConfig(config: GoogleSheetsConfig | null) {
  if (typeof window === 'undefined') return;
  if (!config) {
    localStorage.setItem(SHEETS_CONFIG_KEY, JSON.stringify(DEFAULT_SHEETS_CONFIG));
  } else {
    localStorage.setItem(SHEETS_CONFIG_KEY, JSON.stringify(config));
  }
}

/**
 * Initialize Firebase Auth state listener with persistent token recovery
 */
export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      currentUser = user;
      const token =
        cachedAccessToken ||
        (typeof window !== 'undefined' ? localStorage.getItem(ACCESS_TOKEN_KEY) : null);
      if (token) {
        cachedAccessToken = token;
        if (onAuthSuccess) onAuthSuccess(user, token);
      } else if (!isSigningIn) {
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      const persistedToken =
        typeof window !== 'undefined' ? localStorage.getItem(ACCESS_TOKEN_KEY) : null;
      if (persistedToken) {
        cachedAccessToken = persistedToken;
      } else {
        currentUser = null;
        cachedAccessToken = null;
        if (onAuthFailure) onAuthFailure();
      }
    }
  });
};

const TOKEN_TIMESTAMP_KEY = 'SUKARI_GOOGLE_TOKEN_TIME_V1';

export const clearCachedGoogleToken = () => {
  cachedAccessToken = null;
  if (typeof window !== 'undefined') {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(TOKEN_TIMESTAMP_KEY);
  }
};

/**
 * Sign in with Google to obtain Workspace Access Token and permanently cache it
 */
export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('لم يتم استلام رمز الوصول (Access Token) من Google');
    }

    cachedAccessToken = credential.accessToken;
    currentUser = result.user;

    // Persist permanently in localStorage with timestamp
    if (typeof window !== 'undefined') {
      localStorage.setItem(ACCESS_TOKEN_KEY, cachedAccessToken);
      localStorage.setItem(TOKEN_TIMESTAMP_KEY, Date.now().toString());
      localStorage.setItem(
        USER_CACHE_KEY,
        JSON.stringify({
          uid: result.user.uid,
          displayName: result.user.displayName,
          email: result.user.email,
          photoURL: result.user.photoURL,
        })
      );
    }

    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.warn('Google Sign In warning:', error?.message || error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  if (typeof window === 'undefined') return null;

  const persisted = localStorage.getItem(ACCESS_TOKEN_KEY);
  if (!persisted) {
    cachedAccessToken = null;
    return null;
  }

  // Verify token expiry: Google OAuth access tokens expire after 60 minutes
  const timeStr = localStorage.getItem(TOKEN_TIMESTAMP_KEY);
  if (timeStr) {
    const elapsed = Date.now() - parseInt(timeStr, 10);
    if (elapsed > 55 * 60 * 1000) {
      // Token expired, clear it cleanly so background sync won't repeatedly fail
      clearCachedGoogleToken();
      return null;
    }
  }

  cachedAccessToken = persisted;
  return persisted;
};

export const getCurrentGoogleUser = (): User | null => {
  return currentUser;
};

export const googleLogout = async () => {
  try {
    await signOut(auth);
  } catch {}
  clearCachedGoogleToken();
  if (typeof window !== 'undefined') {
    localStorage.removeItem(USER_CACHE_KEY);
  }
  currentUser = null;
};

/**
 * Creates a brand new Google Spreadsheet with structured tabs for Sukari Gold Mine
 */
export async function createMiningSpreadsheet(
  customTitle?: string
): Promise<{ spreadsheetId: string; spreadsheetUrl: string }> {
  const token = await getAccessToken();
  if (!token) {
    throw new Error('يرجى تسجيل الدخول بحساب Google أولاً للمتابعة');
  }

  const title =
    customTitle ||
    `منجم السكري — سجلات الدسباتش والإنتاج المعتمدة (${new Date().toLocaleDateString('ar-EG')})`;

  const payload = {
    properties: {
      title,
      locale: 'ar_EG',
      timeZone: 'Africa/Cairo',
    },
    sheets: [
      {
        properties: {
          title: 'ملخص الإنتاج والوردية',
          gridProperties: { rowCount: 100, columnCount: 10 },
        },
      },
      {
        properties: {
          title: 'سجل النقلات (Trips)',
          gridProperties: { rowCount: 1000, columnCount: 14 },
        },
      },
      {
        properties: {
          title: 'سجل الانتظار والاستندباي (Standby)',
          gridProperties: { rowCount: 800, columnCount: 11 },
        },
      },
      {
        properties: {
          title: 'سجلات التفويل التفصيلية (Fueling)',
          gridProperties: { rowCount: 500, columnCount: 10 },
        },
      },
      {
        properties: {
          title: 'حضور ودخول وخروج السائقين',
          gridProperties: { rowCount: 500, columnCount: 10 },
        },
      },
      {
        properties: {
          title: 'أسطول وحالات المعدات (Status)',
          gridProperties: { rowCount: 200, columnCount: 10 },
        },
      },
      {
        properties: {
          title: 'سجل الحلول والإجراءات (Interventions)',
          gridProperties: { rowCount: 300, columnCount: 12 },
        },
      },
      {
        properties: {
          title: 'توزيع الأسطول على الحفارات (Circuit)',
          gridProperties: { rowCount: 200, columnCount: 10 },
        },
      },
    ],
  };

  const response = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`فشل إنشاء ملف Google Sheet: ${errText}`);
  }

  const data = await response.json();
  const spreadsheetId = data.spreadsheetId;
  const spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;

  const config: GoogleSheetsConfig = {
    spreadsheetId,
    spreadsheetUrl,
    spreadsheetTitle: title,
    lastSyncedAt: new Date().toISOString(),
    syncedTripsCount: 0,
    autoSyncEnabled: true,
  };
  saveStoredSheetsConfig(config);

  return { spreadsheetId, spreadsheetUrl };
}

/**
 * Synchronizes all Trips, Standbys, Fuelings, Equipment status, and Driver Attendance to Google Sheets
 */
export async function syncAllDataToGoogleSheet(
  spreadsheetId: string,
  trips: TripLog[],
  trucks: Truck[],
  excavators: Excavator[],
  dumps: DumpLocation[],
  fuelingLogs: FuelingLog[],
  driverSessions?: DriverSessionRecord[]
): Promise<{ success: boolean; syncedTrips: number; error?: string }> {
  const token = await getAccessToken();
  if (!token) {
    return { success: false, syncedTrips: 0, error: 'غير مسجل الدخول بحساب Google' };
  }

  try {
    // 1. Calculate Summary
    const totalTonnes = trips.reduce((sum, t) => sum + (t.payloadTonnes || 0), 0);
    const oreTonnes = trips
      .filter(t => t.material !== 'WASTE')
      .reduce((sum, t) => sum + (t.payloadTonnes || 0), 0);
    const wasteTonnes = trips
      .filter(t => t.material === 'WASTE')
      .reduce((sum, t) => sum + (t.payloadTonnes || 0), 0);
    const totalTrips = trips.length;
    const avgCycle =
      totalTrips > 0
        ? Math.round((trips.reduce((sum, t) => sum + t.cycleTimeMinutes, 0) / totalTrips) * 10) / 10
        : 0;

    const totalStandbyMinutes = Math.round(
      trips.reduce((sum, t) => sum + (t.standbyDurationSec || 0), 0) / 60
    );

    const summaryValues = [
      ['نظام دسباتش منجم السكري — تقرير الإنتاج والمزامنة المعتمد والشامل'],
      ['توقيت المزامنة الدورية', new Date().toLocaleString('ar-EG')],
      ['حالة المزامنة', 'مزامنة سحابية حية وشاملة من جميع تابلتات الحفرة والكسارة والإدارة'],
      [],
      ['المؤشر التشغيلي', 'القيمة الفعلية المسجلة', 'الوحدة / الملاحظات'],
      ['إجمالي الإنتاج المنقول', totalTonnes.toLocaleString(), 'طن صخري'],
      ['خام الذهب المستخلص (Ore)', oreTonnes.toLocaleString(), `طن (${totalTonnes > 0 ? Math.round((oreTonnes / totalTonnes) * 100) : 0}%)`],
      ['الردم والصخور العقيمة (Waste)', wasteTonnes.toLocaleString(), `طن (${totalTonnes > 0 ? Math.round((wasteTonnes / totalTonnes) * 100) : 0}%)`],
      ['إجمالي عدد النقلات (Trips)', totalTrips.toString(), 'نقلة مكتملة وموزونة'],
      ['متوسط زمن دورة النقل (Cycle Time)', `${avgCycle}`, 'دقيقة لكل رحلة'],
      ['إجمالي وقت الانتظار المسجل (Standby)', `${totalStandbyMinutes}`, 'دقيقة توقف وهدر زمني'],
      ['إجمالي أسطول الدنابر', trucks.length.toString(), 'شاحنة CAT 785 / 152t'],
      ['إجمالي وحدات التحميل والحفارات', excavators.length.toString(), 'حفار وشاول ولودر'],
      ['عمليات التفويل المنفذة', fuelingLogs.length.toString(), 'عملية تزويد سولار'],
      ['جلسات السائقين المسجلة (حضور وانصراف)', (driverSessions || []).length.toString(), 'جلسة حضور/تسليم وردية'],
    ];

    // 2. Trips Header & Rows with Detailed Loading Time & Durations
    const tripsHeader = [
      'رقم النقلة (Trip ID)',
      'اسم السائق',
      'كود السائق',
      'رقم الشاحنة',
      'معدة التحميل',
      'نوع المادة',
      'موقع التفريغ',
      'الحمولة (طن)',
      'وقت التحميل (Loading Time)',
      'وقت الانتظار (دقيقة)',
      'سبب الانتظار إن وجد',
      'زمن الدورة (دقيقة)',
      'تاريخ ووقت التفريغ',
      'حالة الرفع والمزامنة',
    ];

    const tripsRows = trips.map(t => [
      t.id,
      t.driverName,
      t.driverCode,
      t.truckId,
      t.excavatorId,
      getMaterialArabic(t.material),
      t.dumpLocationId,
      t.payloadTonnes || 152,
      t.loadStartTime
        ? new Date(t.loadStartTime).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })
        : t.loadEndTime
        ? new Date(t.loadEndTime).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })
        : '-',
      Math.round(((t.standbyDurationSec || 0) / 60) * 10) / 10,
      t.standbyReason ? getStandbyReasonArabic(t.standbyReason) : '-',
      t.cycleTimeMinutes,
      new Date(t.dumpTime).toLocaleString('ar-EG'),
      t.synced ? 'تمت المزامنة سحابياً' : 'مسجل محلياً',
    ]);

    // 3. Standby & Delay Logs Sheet (تفاصيل أسباب الانتظار والتوقف والوقت)
    const standbyHeader = [
      'رقم الشاحنة (Truck ID)',
      'اسم السائق',
      'كود السائق',
      'سبب الانتظار (Standby Reason)',
      'كود السبب (Reason Code)',
      'مدة الانتظار (دقيقة)',
      'مدة الانتظار (ثانية)',
      'تاريخ وتوقيت الرحلة / التوقف',
      'الحفار المرتبط',
      'موقع التفريغ المستهدف',
      'ملاحظات',
    ];

    const standbyRows = trips
      .filter(t => (t.standbyDurationSec || 0) > 0 || t.standbyReason)
      .map(t => [
        t.truckId,
        t.driverName,
        t.driverCode,
        getStandbyReasonArabic(t.standbyReason),
        t.standbyReason || 'QUEUE',
        Math.round(((t.standbyDurationSec || 0) / 60) * 10) / 10,
        t.standbyDurationSec || 0,
        new Date(t.loadStartTime || t.dumpTime).toLocaleString('ar-EG'),
        t.excavatorId,
        t.dumpLocationId,
        t.notes || '',
      ]);

    // 4. Fueling Header & Rows with 4-stage time details
    const fuelingHeader = [
      'رقم الشاحنة',
      'اسم السائق',
      'كود السائق',
      'المرحلة الحالية',
      'وقت رايح أفول (En Route)',
      'وقت الوصول للمحطة (At Station)',
      'وقت الخروج من المحطة (Departed)',
      'وقت بدء التحميل بالحفرة (Loading)',
      'المدة الإجمالية (دقيقة)',
      'ملاحظات الوقود',
    ];

    const fuelingRows = fuelingLogs.map(f => [
      f.truckId,
      f.driverName,
      f.driverCode,
      getFuelingStageArabic(f.status),
      f.enRouteStartTime
        ? new Date(f.enRouteStartTime).toLocaleTimeString('ar-EG')
        : new Date(f.startTime).toLocaleTimeString('ar-EG'),
      f.atStationTime ? new Date(f.atStationTime).toLocaleTimeString('ar-EG') : '-',
      f.departStationTime ? new Date(f.departStationTime).toLocaleTimeString('ar-EG') : '-',
      f.loadingStartTime
        ? new Date(f.loadingStartTime).toLocaleTimeString('ar-EG')
        : f.endTime
        ? new Date(f.endTime).toLocaleTimeString('ar-EG')
        : '-',
      f.durationMinutes || '-',
      f.notes || '',
    ]);

    // 5. Driver Sessions Attendance (سجل الحضور والدخول والخروج بالتفصيل)
    const sessionsHeader = [
      'رقم الدنبر (Truck ID)',
      'اسم السائق',
      'كود السائق',
      'وقت تسجيل الدخول (Login Time)',
      'وقت تسجيل الخروج / تسليم الوردية',
      'إجمالي مدة الوردية (دقيقة)',
      'عدد النقلات المنجزة',
      'إجمالي الأطنان المنقولة',
      'موقع الركنة (Parking Location)',
      'حالة الجلسة',
      'تاريخ الوردية',
    ];

    const sessions = driverSessions || [];
    const sessionsRows = sessions.map(s => [
      s.truckId,
      s.driverName,
      s.driverCode,
      new Date(s.loginTime).toLocaleString('ar-EG'),
      s.logoutTime ? new Date(s.logoutTime).toLocaleString('ar-EG') : 'نشط على التابلت حالياً 🟢',
      s.totalDurationMinutes || '-',
      s.tripsCompleted,
      s.tonnesMoved,
      s.parkingLocation || '-',
      s.status === 'ACTIVE' ? 'شغال حالياً في الوردية' : 'مغلق ومسلم للوردية',
      s.date,
    ]);

    // 6. Equipment Status & Benches (حالة المعدات بالتفصيل والمصاطب والأعطال)
    const equipmentHeader = [
      'رمز المعدة',
      'النوع',
      'الموديل',
      'السعة (طن)',
      'الموقع / المصطبة (Bench RL)',
      'الحالة التشغيلية الحالية',
      'عدد نقلات اليوم',
      'أطنان اليوم',
      'السائق الحالي / الطابور',
      'آخر موقع ركنة (Parking)',
      'ملاحظات الحالة والأعطال',
    ];

    const truckRows = trucks.map(t => [
      t.id,
      'دنبر نقل صخري 152t',
      t.model,
      '152 طن',
      'مسار الحفرة والرامب',
      t.status === 'ACTIVE'
        ? 'في الخدمة 🟢'
        : t.status === 'BREAKDOWN'
        ? 'عطل 🚨'
        : t.status === 'FUELING'
        ? 'بيفول ⛽'
        : t.status === 'MAINTENANCE'
        ? 'صيانة 🔧'
        : 'طابور انتظار ⏳',
      t.tripsToday || 0,
      t.tonnesToday || (t.tripsToday || 0) * (t.capacityTonnes || 152),
      t.assignedDriver ? `سائق كود ${t.assignedDriver}` : 'جاهز للتخصيص',
      t.lastParkingLocation || '-',
      t.statusNote || 'جاهز للتشغيل',
    ]);

    const excavatorRows = excavators.map(e => [
      e.id,
      'معدة تحميل وشاول',
      e.model,
      '-',
      e.benchLevel,
      e.status === 'ACTIVE' ? 'شغال في التحميل 🟢' : 'متوقف / صيانة 🔧',
      trips.filter(t => t.excavatorId === e.id).length,
      trips.filter(t => t.excavatorId === e.id).reduce((sum, tr) => sum + (tr.payloadTonnes || 0), 0),
      `طابور الشاحنات: ${e.trucksInQueue || 0}`,
      `مادة التحميل: ${getMaterialArabic(e.assignedMaterial)}`,
    ]);

    // 7. Equipment Interventions & Manual Corrective Actions
    const interventions = getEquipmentInterventions();
    const interventionsHeader = [
      'كود الإجراء (ID)',
      'المعدة / الدنبر',
      'نوع المعدة',
      'وصف الفجوة / التأخير',
      'الحل والإجراء التصحيحي المقترح',
      'مقترح الحل (الاسم والكود)',
      'وقت الاقتراح',
      'حالة الاعتماد',
      'معتمد الحل (الاسم والكود)',
      'وقت الاعتماد',
      'الطن المستعاد التقديري',
      'ملاحظات إضافية',
    ];
    const interventionsRows = interventions.map(inv => [
      inv.id,
      inv.equipmentId,
      inv.equipmentType === 'TRUCK' ? 'دنبر نقل 152t' : 'حفار / شوڤل تحميل',
      inv.problemDescription,
      inv.proposedAction,
      `${inv.proposedByDispatcherName} (${inv.proposedByDispatcherCode})`,
      new Date(inv.proposedAt).toLocaleString('ar-EG'),
      inv.status === 'APPROVED' ? 'معتمد رسمياً ✅' : inv.status === 'RESOLVED' ? 'تم الحل بنجاح 🟢' : 'قيد المراجعة ⏳',
      inv.approvedByDispatcherName ? `${inv.approvedByDispatcherName} (${inv.approvedByDispatcherCode || ''})` : '-',
      inv.approvedAt ? new Date(inv.approvedAt).toLocaleString('ar-EG') : '-',
      inv.estimatedTonsRecovered || 0,
      inv.notes || '',
    ]);

    // 8. Dynamic Truck-to-Excavator Circuit Assignments
    const assignmentsMap = getTruckExcavatorAssignments();
    const assignmentsHeader = [
      'رقم الدنبر (Truck ID)',
      'الحفار المخصص (Excavator ID)',
      'مصطبة العمل المستهدفة',
      'نوع الخام المستهدف',
      'الديسباتشر المسؤول عن التوزيع',
      'كود الديسباتشر',
      'توقيت التوزيع والربط',
      'ملاحظات المسار',
    ];
    const assignmentsRows = Object.values(assignmentsMap).map(asg => [
      asg.truckId,
      asg.excavatorId,
      asg.targetBench || '-',
      asg.targetMaterial || 'حسب التوجيه',
      asg.assignedByDispatcherName || 'غرفة العمليات',
      asg.assignedByDispatcherCode || '-',
      new Date(asg.assignedAt).toLocaleString('ar-EG'),
      asg.notes || '',
    ]);

    // Execute Batch Updates to all 8 Sheets
    const updateData = [
      {
        range: "'ملخص الإنتاج والوردية'!A1",
        values: summaryValues,
      },
      {
        range: "'سجل النقلات (Trips)'!A1",
        values: [tripsHeader, ...tripsRows],
      },
      {
        range: "'سجل الانتظار والاستندباي (Standby)'!A1",
        values: [standbyHeader, ...standbyRows],
      },
      {
        range: "'سجلات التفويل التفصيلية (Fueling)'!A1",
        values: [fuelingHeader, ...fuelingRows],
      },
      {
        range: "'حضور ودخول وخروج السائقين'!A1",
        values: [sessionsHeader, ...sessionsRows],
      },
      {
        range: "'أسطول وحالات المعدات (Status)'!A1",
        values: [equipmentHeader, ...truckRows, ...excavatorRows],
      },
      {
        range: "'سجل الحلول والإجراءات (Interventions)'!A1",
        values: [interventionsHeader, ...interventionsRows],
      },
      {
        range: "'توزيع الأسطول على الحفارات (Circuit)'!A1",
        values: [assignmentsHeader, ...assignmentsRows],
      },
    ];

    let batchRes: Response;
    try {
      batchRes = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            valueInputOption: 'USER_ENTERED',
            data: updateData,
          }),
        }
      );
    } catch (fetchErr: any) {
      console.warn('[GoogleSheets] Network or CORS restriction on direct sync:', fetchErr?.message || fetchErr);
      clearCachedGoogleToken();
      return {
        success: false,
        syncedTrips: 0,
        error: 'انتهت صلاحية جلسة Google أو لا تتوفر استجابة من السيرفر حالياً',
      };
    }

    if (!batchRes.ok) {
      if (batchRes.status === 401 || batchRes.status === 403) {
        clearCachedGoogleToken();
      }
      const err = await batchRes.text().catch(() => '');
      return { success: false, syncedTrips: 0, error: `فشل استجابة الجدول (${batchRes.status}): ${err}` };
    }

    // Update stored metadata
    const prevConfig = getStoredSheetsConfig();
    if (prevConfig && prevConfig.spreadsheetId === spreadsheetId) {
      saveStoredSheetsConfig({
        ...prevConfig,
        lastSyncedAt: new Date().toISOString(),
        syncedTripsCount: trips.length,
      });
    }

    return { success: true, syncedTrips: trips.length };
  } catch (err: any) {
    console.warn('[GoogleSheets] Sync skipped:', err?.message || err);
    return { success: false, syncedTrips: 0, error: err?.message || 'خطأ غير متوقع' };
  }
}

function getMaterialArabic(mat: string): string {
  switch (mat) {
    case 'ORE_HIGH':
      return 'هاي جريد HG';
    case 'ORE_MEDIUM':
      return 'ميديم جريد MG';
    case 'ORE_LOW':
      return 'لو جريد LG';
    case 'SUB_GRADE':
      return 'سب جريد SG';
    case 'WASTE':
      return 'ردم / ويست Waste';
    default:
      return mat;
  }
}

function getStandbyReasonArabic(reason?: StandbyReason | string): string {
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
      return reason || 'انتظار وتوقف مؤقت (Standby)';
  }
}

function getFuelingStageArabic(stage: string): string {
  switch (stage) {
    case 'EN_ROUTE':
      return 'رايح أفول ⛽ (في الطريق للمحطة)';
    case 'AT_STATION':
      return 'وصل البنزينة وجاري التفويل ⛽';
    case 'RETURNING':
      return 'طلع من البنزينة وعائد للحفرة 🚚';
    case 'COMPLETED':
      return 'مكتمل — بدأ التحميل عند الحفار 🏗️';
    default:
      return stage;
  }
}

export async function triggerBackgroundSheetsSync(
  getTripsFn?: () => TripLog[],
  getTrucksFn?: () => Truck[],
  getExcavatorsFn?: () => Excavator[],
  getDumpsFn?: () => DumpLocation[],
  getFuelingsFn?: () => FuelingLog[],
  getSessionsFn?: () => DriverSessionRecord[]
): Promise<{ success: boolean; syncedTrips: number; error?: string }> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return { success: false, syncedTrips: 0, error: 'التابلت يعمل أوفلاين دون اتصال بالإنترنت' };
  }
  const config = getStoredSheetsConfig();
  if (!config || !config.spreadsheetId) {
    return { success: false, syncedTrips: 0, error: 'لم يتم ربط ملف Google Sheets بعد' };
  }
  const token = await getAccessToken();
  if (!token) {
    return { success: false, syncedTrips: 0, error: 'غير مسجل الدخول بحساب Google' };
  }

  const trips = getTripsFn ? getTripsFn() : getStoredTrips();
  const trucks = getTrucksFn ? getTrucksFn() : getStoredTrucks();
  const excavators = getExcavatorsFn ? getExcavatorsFn() : getStoredExcavators();
  const dumps = getDumpsFn ? getDumpsFn() : getStoredDumps();
  const fuelings = getFuelingsFn ? getFuelingsFn() : getFuelingLogs();
  const sessions = getSessionsFn ? getSessionsFn() : getDriverSessions();

  const res = await syncAllDataToGoogleSheet(
    config.spreadsheetId,
    trips,
    trucks,
    excavators,
    dumps,
    fuelings,
    sessions
  );

  if (res.success) {
    const updated = {
      ...config,
      lastSyncedAt: new Date().toISOString(),
      syncedTripsCount: res.syncedTrips,
    };
    saveStoredSheetsConfig(updated);
  }
  return res;
}
