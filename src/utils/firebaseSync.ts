import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  doc,
  collection,
  setDoc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  orderBy,
  limit,
  where,
  getDocFromServer,
  deleteDoc,
  Unsubscribe,
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { DispatcherDirectMessage, EquipmentAlert } from '../types/dispatch';

// Ensure Firebase is initialized
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

// ----------------------------------------------------------------------
// 1. Error Handler Conforming to Firebase Skill Standard
// ----------------------------------------------------------------------
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map(provider => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.warn('Firestore Operation Status:', JSON.stringify(errInfo));
  return errInfo;
}

// ----------------------------------------------------------------------
// 2. Validate Connection to Firestore (Per Skill Requirement)
// ----------------------------------------------------------------------
export async function testFirestoreConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firestore is running in offline-cached mode');
    }
    return false;
  }
}

// ----------------------------------------------------------------------
// 3. Persistent Device Identifier (To enforce single-device active session)
// ----------------------------------------------------------------------
const DEVICE_ID_KEY = 'SUKARI_DEVICE_UNIQUE_ID_V1';

export function getDeviceId(): string {
  if (typeof window === 'undefined') return 'server_instance';
  let devId = localStorage.getItem(DEVICE_ID_KEY);
  if (!devId) {
    devId = 'dev_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now().toString(36);
    localStorage.setItem(DEVICE_ID_KEY, devId);
  }
  return devId;
}

// ----------------------------------------------------------------------
// 4. Real-Time Cloud Dispatcher Messaging (Broadcast + Individual)
// ----------------------------------------------------------------------
export async function sendCloudDispatcherMessage(
  targetId: string, // 'ALL' or 'TRUCKS_ALL' or 'EXCAVATORS_ALL' or 'DT001', etc.
  messageText: string,
  priority: 'NORMAL' | 'URGENT' | 'CRITICAL' = 'NORMAL',
  sender: string = 'إدارة المنجم (Admin)',
  driverName?: string
): Promise<DispatcherDirectMessage> {
  const messageId = 'MSG_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
  const newMsg: DispatcherDirectMessage = {
    id: messageId,
    targetTruckId: targetId,
    messageText,
    priority,
    sender,
    timestamp: new Date().toISOString(),
    targetDriverName: driverName || '',
    acknowledged: false,
  };

  const path = `dispatcher_messages/${messageId}`;
  try {
    // Sanitize object to remove any undefined fields that cause Firestore errors
    const cleanDoc = Object.fromEntries(
      Object.entries(newMsg).filter(([_, v]) => v !== undefined)
    );
    await setDoc(doc(db, 'dispatcher_messages', messageId), cleanDoc);
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }

  // Also cache locally in localStorage
  try {
    const raw = localStorage.getItem('sukari_direct_messages_v2') || '[]';
    const local = JSON.parse(raw);
    localStorage.setItem('sukari_direct_messages_v2', JSON.stringify([newMsg, ...local.filter((m: any) => m.id !== messageId)]));
  } catch {}

  return newMsg;
}

export function subscribeToCloudDispatcherMessages(
  callback: (messages: DispatcherDirectMessage[]) => void
): Unsubscribe {
  const path = 'dispatcher_messages';
  try {
    const q = query(collection(db, path), orderBy('timestamp', 'desc'), limit(100));
    return onSnapshot(
      q,
      (snapshot) => {
        const list: DispatcherDirectMessage[] = [];
        snapshot.forEach((d) => {
          list.push(d.data() as DispatcherDirectMessage);
        });
        callback(list);
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, path);
      }
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, path);
    return () => {};
  }
}

export async function acknowledgeCloudMessage(messageId: string, acknowledgedBy?: string): Promise<void> {
  const path = `dispatcher_messages/${messageId}`;
  try {
    await setDoc(
      doc(db, 'dispatcher_messages', messageId),
      {
        acknowledged: true,
        acknowledgedAt: new Date().toISOString(),
        acknowledgedBy: acknowledgedBy || 'سائق الشاحنة',
      },
      { merge: true }
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

// ----------------------------------------------------------------------
// 4b. Real-time listener for unit messages (runs on any tablet in the mine instantly)
// ----------------------------------------------------------------------
export function listenForUnitMessages(
  unitId: string,
  onNewMessage: (msg: string, fullMessage?: DispatcherDirectMessage) => void
): Unsubscribe {
  const path = 'dispatcher_messages';
  try {
    const q = query(collection(db, path), orderBy('timestamp', 'desc'), limit(50));
    const notifiedMessageIds = new Set<string>();

    return onSnapshot(
      q,
      (snapshot) => {
        const cloudMessages: DispatcherDirectMessage[] = [];
        snapshot.forEach((d) => {
          cloudMessages.push(d.data() as DispatcherDirectMessage);
        });

        // Sync directly into local storage on this tablet
        if (typeof window !== 'undefined' && cloudMessages.length > 0) {
          try {
            const raw = localStorage.getItem('sukari_direct_messages_v2') || '[]';
            const local = JSON.parse(raw) as DispatcherDirectMessage[];
            const map = new Map<string, DispatcherDirectMessage>();
            local.forEach((m) => map.set(m.id, m));
            cloudMessages.forEach((m) => map.set(m.id, m));
            const merged = Array.from(map.values()).sort(
              (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
            );
            localStorage.setItem('sukari_direct_messages_v2', JSON.stringify(merged));
          } catch {}
        }

        // Find any unacknowledged message targeted to this specific truck or to ALL
        const targetMsg = cloudMessages.find(
          (m) =>
            !m.acknowledged &&
            (m.targetTruckId === unitId ||
              m.targetTruckId === 'ALL' ||
              m.targetTruckId === 'TRUCKS_ALL')
        );

        if (targetMsg && !notifiedMessageIds.has(targetMsg.id)) {
          notifiedMessageIds.add(targetMsg.id);
          onNewMessage(targetMsg.messageText, targetMsg);
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, path);
      }
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, path);
    return () => {};
  }
}

// ----------------------------------------------------------------------
// 4bb. Real-Time Equipment Status & Breakdown Alerts across all tablets
// ----------------------------------------------------------------------
export async function syncEquipmentAlertToCloud(alert: EquipmentAlert): Promise<void> {
  const path = `equipment_alerts/${alert.id}`;
  try {
    const cleanAlert = Object.fromEntries(
      Object.entries(alert).filter(([_, v]) => v !== undefined)
    );
    await setDoc(doc(db, 'equipment_alerts', alert.id), cleanAlert);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function deleteEquipmentAlertFromCloud(alertId: string): Promise<void> {
  const path = `equipment_alerts/${alertId}`;
  try {
    await deleteDoc(doc(db, 'equipment_alerts', alertId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

export function subscribeToCloudEquipmentAlerts(
  callback: (alerts: EquipmentAlert[]) => void
): Unsubscribe {
  const path = 'equipment_alerts';
  try {
    return onSnapshot(
      collection(db, path),
      (snapshot) => {
        const list: EquipmentAlert[] = [];
        snapshot.forEach((d) => {
          list.push(d.data() as EquipmentAlert);
        });
        callback(list);
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, path);
      }
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, path);
    return () => {};
  }
}

export async function fetchCloudEquipmentAlerts(): Promise<EquipmentAlert[]> {
  const path = 'equipment_alerts';
  try {
    const snap = await getDocs(collection(db, path));
    const list: EquipmentAlert[] = [];
    snap.forEach((d) => {
      list.push(d.data() as EquipmentAlert);
    });
    return list;
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, path);
    return [];
  }
}

// ----------------------------------------------------------------------
// 4c. Master Data Cloud Sync (Admin & Dispatcher Settings across all tablets)
// ----------------------------------------------------------------------
export interface MasterDataPayload<T = any> {
  docId: string;
  data: T;
  updatedAt: string;
  updatedBy: string;
}

export async function syncMasterDataToCloud(
  docId: 'trucks' | 'excavators' | 'dumps' | 'drivers' | 'custom_standby_reasons' | 'app_config',
  data: any,
  updatedBy: string = 'Admin'
): Promise<void> {
  const path = `admin_master_data/${docId}`;
  try {
    const payload: MasterDataPayload = {
      docId,
      data,
      updatedAt: new Date().toISOString(),
      updatedBy,
    };
    await setDoc(doc(db, 'admin_master_data', docId), payload);
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function fetchMasterDataFromCloud(
  docId: 'trucks' | 'excavators' | 'dumps' | 'drivers' | 'custom_standby_reasons' | 'app_config'
): Promise<any | null> {
  const path = `admin_master_data/${docId}`;
  try {
    const snap = await getDoc(doc(db, 'admin_master_data', docId));
    if (snap.exists()) {
      return (snap.data() as MasterDataPayload).data;
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, path);
  }
  return null;
}

export function subscribeToMasterData(
  onUpdate: (docId: string, data: any) => void
): Unsubscribe {
  const path = 'admin_master_data';
  try {
    return onSnapshot(
      collection(db, path),
      (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added' || change.type === 'modified') {
            const item = change.doc.data() as MasterDataPayload;
            if (item && item.docId && item.data) {
              onUpdate(item.docId, item.data);
            }
          }
        });
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, path);
      }
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, path);
    return () => {};
  }
}

// ----------------------------------------------------------------------
// 5. Equipment Session Lock (Preventing two devices using same account)
// ----------------------------------------------------------------------
export interface CloudEquipmentSession {
  equipmentId: string;
  equipmentType: 'TRUCK' | 'EXCAVATOR';
  deviceId: string;
  driverCode: string;
  driverName: string;
  loginTime: string;
  lastHeartbeat: string;
  status: 'ACTIVE' | 'DISCONNECTED' | 'TRANSFERRED';
  deviceInfo?: string;
}

export async function claimEquipmentSession(
  equipmentId: string,
  equipmentType: 'TRUCK' | 'EXCAVATOR',
  driverCode: string,
  driverName: string,
  forceTakeover: boolean = false
): Promise<{ success: boolean; conflict?: boolean; existingSession?: CloudEquipmentSession }> {
  const path = `equipment_sessions/${equipmentId}`;
  const currentDeviceId = getDeviceId();

  try {
    const snap = await getDoc(doc(db, 'equipment_sessions', equipmentId));
    if (snap.exists()) {
      const existing = snap.data() as CloudEquipmentSession;
      const lastHb = new Date(existing.lastHeartbeat || 0).getTime();
      const isRecent = Date.now() - lastHb < 90 * 1000; // active within last 90s

      if (existing.status === 'ACTIVE' && existing.deviceId !== currentDeviceId && isRecent && !forceTakeover) {
        return {
          success: false,
          conflict: true,
          existingSession: existing,
        };
      }
    }

    // Claim or Transfer session to this device
    const newSession: CloudEquipmentSession = {
      equipmentId,
      equipmentType,
      deviceId: currentDeviceId,
      driverCode,
      driverName,
      loginTime: new Date().toISOString(),
      lastHeartbeat: new Date().toISOString(),
      status: 'ACTIVE',
      deviceInfo: typeof navigator !== 'undefined' ? `${navigator.userAgent.slice(0, 50)}` : 'Mining Tablet',
    };

    await setDoc(doc(db, 'equipment_sessions', equipmentId), newSession);
    return { success: true };
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
    // If offline, allow local login
    return { success: true };
  }
}

export function subscribeToEquipmentSessionConflict(
  equipmentId: string,
  onTerminated: (info: CloudEquipmentSession) => void
): Unsubscribe {
  const currentDeviceId = getDeviceId();
  const path = `equipment_sessions/${equipmentId}`;

  return onSnapshot(
    doc(db, 'equipment_sessions', equipmentId),
    (snap) => {
      if (!snap.exists()) return;
      const data = snap.data() as CloudEquipmentSession;
      if (data.status === 'ACTIVE' && data.deviceId !== currentDeviceId) {
        onTerminated(data);
      }
    },
    (err) => {
      handleFirestoreError(err, OperationType.GET, path);
    }
  );
}

export async function sendSessionHeartbeat(equipmentId: string): Promise<void> {
  const currentDeviceId = getDeviceId();
  const path = `equipment_sessions/${equipmentId}`;
  try {
    await setDoc(
      doc(db, 'equipment_sessions', equipmentId),
      {
        deviceId: currentDeviceId,
        lastHeartbeat: new Date().toISOString(),
        status: 'ACTIVE',
      },
      { merge: true }
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function releaseEquipmentSession(equipmentId: string): Promise<void> {
  const currentDeviceId = getDeviceId();
  const path = `equipment_sessions/${equipmentId}`;
  try {
    await setDoc(
      doc(db, 'equipment_sessions', equipmentId),
      {
        deviceId: currentDeviceId,
        lastHeartbeat: new Date().toISOString(),
        status: 'DISCONNECTED',
      },
      { merge: true }
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

// ----------------------------------------------------------------------
// 6. Presence & Real-Time Online/Offline Indicator
// ----------------------------------------------------------------------
export interface EquipmentPresenceInfo {
  equipmentId: string;
  lastSeen: string;
  isOnline: boolean;
  status?: string;
  currentOperator?: string;
}

export async function updateEquipmentPresenceHeartbeat(
  equipmentId: string,
  status?: string,
  currentOperator?: string
): Promise<void> {
  const path = `equipment_presence/${equipmentId}`;
  try {
    await setDoc(
      doc(db, 'equipment_presence', equipmentId),
      {
        equipmentId,
        lastSeen: new Date().toISOString(),
        isOnline: true,
        status: status || 'ACTIVE',
        currentOperator: currentOperator || '',
      },
      { merge: true }
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export function subscribeToEquipmentPresence(
  callback: (presenceMap: Record<string, EquipmentPresenceInfo>) => void
): Unsubscribe {
  const path = 'equipment_presence';
  return onSnapshot(
    collection(db, path),
    (snapshot) => {
      const map: Record<string, EquipmentPresenceInfo> = {};
      const now = Date.now();
      snapshot.forEach((d) => {
        const data = d.data() as EquipmentPresenceInfo;
        const lastSeenMs = new Date(data.lastSeen).getTime();
        // Online if pinged within last 75 seconds
        const isOnline = now - lastSeenMs < 75 * 1000;
        map[data.equipmentId] = {
          ...data,
          isOnline,
        };
      });
      callback(map);
    },
    (err) => {
      handleFirestoreError(err, OperationType.GET, path);
    }
  );
}

// ----------------------------------------------------------------------
// 7. Operator Shift Management (Shift Handover Records)
// ----------------------------------------------------------------------
export interface ShiftHandoverRecord {
  id: string;
  equipmentId: string;
  equipmentType: 'TRUCK' | 'EXCAVATOR';
  driverCode: string;
  driverName: string;
  shiftType: 'DAY' | 'NIGHT';
  startTime: string;
  endTime?: string;
  status: 'ACTIVE' | 'HANDED_OVER' | 'COMPLETED';
  handoverToCode?: string;
  handoverToName?: string;
  engineHoursStart?: number;
  engineHoursEnd?: number;
  fuelLevelPercent?: number;
  safetyInspectionPassed: boolean;
  notes?: string;
  tripsCount: number;
  tonnesCount: number;
}

const SHIFT_STORAGE_KEY = 'SUKARI_SHIFT_RECORDS_V1';

export function getLocalShiftRecords(): ShiftHandoverRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(SHIFT_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveLocalShiftRecords(records: ShiftHandoverRecord[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(SHIFT_STORAGE_KEY, JSON.stringify(records));
}

export async function logStartShift(
  record: Omit<ShiftHandoverRecord, 'id' | 'status' | 'tripsCount' | 'tonnesCount'>
): Promise<ShiftHandoverRecord> {
  const id = 'SHIFT_' + Date.now() + '_' + Math.random().toString(36).substring(2, 5);
  const fullRecord: ShiftHandoverRecord = {
    ...record,
    id,
    status: 'ACTIVE',
    tripsCount: 0,
    tonnesCount: 0,
  };

  // Local storage
  const local = getLocalShiftRecords();
  saveLocalShiftRecords([fullRecord, ...local]);

  // Cloud sync
  const path = `shift_logs/${id}`;
  try {
    await setDoc(doc(db, 'shift_logs', id), fullRecord);
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }

  return fullRecord;
}

export async function logCompleteShiftHandover(
  shiftId: string,
  updates: {
    handoverToCode?: string;
    handoverToName?: string;
    engineHoursEnd?: number;
    fuelLevelPercent?: number;
    notes?: string;
    tripsCount?: number;
    tonnesCount?: number;
  }
): Promise<void> {
  const endTime = new Date().toISOString();
  const local = getLocalShiftRecords();
  const updated = local.map((s) => {
    if (s.id === shiftId) {
      return {
        ...s,
        ...updates,
        endTime,
        status: (updates.handoverToCode ? 'HANDED_OVER' : 'COMPLETED') as 'HANDED_OVER' | 'COMPLETED',
      };
    }
    return s;
  });
  saveLocalShiftRecords(updated);

  const path = `shift_logs/${shiftId}`;
  try {
    await setDoc(
      doc(db, 'shift_logs', shiftId),
      {
        ...updates,
        endTime,
        status: updates.handoverToCode ? 'HANDED_OVER' : 'COMPLETED',
      },
      { merge: true }
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export function subscribeToShiftLogs(callback: (records: ShiftHandoverRecord[]) => void): Unsubscribe {
  const path = 'shift_logs';
  try {
    const q = query(collection(db, path), orderBy('startTime', 'desc'), limit(100));
    return onSnapshot(
      q,
      (snap) => {
        const records: ShiftHandoverRecord[] = [];
        snap.forEach((d) => {
          records.push(d.data() as ShiftHandoverRecord);
        });
        if (records.length > 0) {
          saveLocalShiftRecords(records);
          callback(records);
        } else {
          callback(getLocalShiftRecords());
        }
      },
      (err) => {
        handleFirestoreError(err, OperationType.GET, path);
        callback(getLocalShiftRecords());
      }
    );
  } catch {
    callback(getLocalShiftRecords());
    return () => {};
  }
}
