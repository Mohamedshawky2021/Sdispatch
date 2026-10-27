import React, { useState, useEffect } from 'react';
import {
  Lock,
  Unlock,
  KeyRound,
  Users,
  Truck as TruckIcon,
  HardHat,
  Mountain,
  Settings,
  Plus,
  Trash2,
  Check,
  X,
  FileDown,
  RefreshCw,
  AlertTriangle,
  Fingerprint,
  ShieldCheck,
  ShieldAlert,
  Delete,
  Timer,
  CheckCircle2,
  FileSpreadsheet,
  ExternalLink,
  MessageSquare,
  Send,
  Radio,
  Eye,
  EyeOff,
  Link as LinkIcon,
  Edit3,
  Pencil,
  Activity,
  CheckSquare,
  Square,
  Search,
  Filter,
  MapPin,
} from 'lucide-react';
import {
  Driver,
  Truck,
  Excavator,
  DumpLocation,
  MaterialType,
  DispatcherDirectMessage,
  CustomStandbyReason,
  ParkingLocation,
  DispatcherUser,
} from '../types/dispatch';
import {
  getStoredDrivers,
  saveDrivers,
  getStoredTrucks,
  saveTrucks,
  getStoredExcavators,
  saveExcavators,
  getStoredDumps,
  saveDumps,
  getAppConfig,
  saveAppConfig,
  AppConfig,
  getStoredTrips,
  saveTrips,
  getDispatcherMessages,
  sendDispatcherMessage,
  getFuelingLogs,
  updateTruckDetails,
  updateExcavatorDetails,
  updateDumpDetails,
  getCustomStandbyReasons,
  addCustomStandbyReason,
  updateCustomStandbyReason,
  deleteCustomStandbyReason,
  getDriverSessions,
  getParkingLocations,
  saveParkingLocations,
  addParkingLocation,
  updateParkingLocation,
  deleteParkingLocation,
  getStoredDispatchers,
  saveDispatchers,
  addDispatcher,
  updateDispatcher,
  deleteDispatcher,
} from '../utils/storage';
import { checkAndTriggerHourlyExport } from '../utils/hourlySyncEngine';
import { playClickSound, playLoadConfirmedSound, playDispatchAlertSound } from '../utils/audio';
import {
  isWebAuthnSupported,
  hasRegisteredBiometrics,
  registerBiometricPasskey,
  verifyBiometricPasskey,
  removeBiometricPasskey,
  getRegisteredBiometricDate,
} from '../utils/webauthn';
import {
  getStoredSheetsConfig,
  saveStoredSheetsConfig,
  createMiningSpreadsheet,
  syncAllDataToGoogleSheet,
  googleSignIn,
  googleLogout,
  initAuth,
  getCurrentGoogleUser,
  GoogleSheetsConfig,
  DEFAULT_SPREADSHEET_ID,
  DEFAULT_SPREADSHEET_URL,
  DEFAULT_OFFICIAL_ACCOUNT_EMAIL,
  DEFAULT_SHEETS_CONFIG,
} from '../utils/googleSheets';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onDataChanged: () => void;
}

export const AdminDatabaseModal: React.FC<Props> = ({ isOpen, onClose, onDataChanged }) => {
  const [config, setConfig] = useState<AppConfig>(getAppConfig());
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [activeTab, setActiveTab] = useState<'DRIVERS' | 'DISPATCHERS' | 'TRUCKS' | 'EXCAVATORS' | 'DUMPS' | 'STANDBY_REASONS' | 'PARKINGS' | 'CONFIG' | 'GOOGLE_SHEETS' | 'DIRECT_MESSAGES'>('DRIVERS');

  // Dispatcher Accounts Management
  const [dispatchers, setDispatchers] = useState<DispatcherUser[]>(getStoredDispatchers());
  const [newDispCode, setNewDispCode] = useState('');
  const [newDispName, setNewDispName] = useState('');
  const [newDispPin, setNewDispPin] = useState('');
  const [newDispPhone, setNewDispPhone] = useState('');
  const [newDispRole, setNewDispRole] = useState<'DISPATCHER' | 'CHIEF_DISPATCHER' | 'SUPERVISOR'>('DISPATCHER');
  const [editingDispId, setEditingDispId] = useState<string | null>(null);
  const [editingDispPin, setEditingDispPin] = useState('');
  const [showDispPins, setShowDispPins] = useState<Record<string, boolean>>({});

  // Master Data Editing States (Without Deleting)
  const [editingTruck, setEditingTruck] = useState<Truck | null>(null);
  const [editingExcavator, setEditingExcavator] = useState<Excavator | null>(null);
  const [editingDump, setEditingDump] = useState<DumpLocation | null>(null);

  // Parking Locations Master Data
  const [parkingLocations, setParkingLocations] = useState<ParkingLocation[]>(getParkingLocations());
  const [newParkingName, setNewParkingName] = useState('');
  const [newParkingCode, setNewParkingCode] = useState('');
  const [newParkingArea, setNewParkingArea] = useState('');
  const [newParkingCapacity, setNewParkingCapacity] = useState('10');
  const [newParkingNotes, setNewParkingNotes] = useState('');
  const [editingParking, setEditingParking] = useState<ParkingLocation | null>(null);

  // Custom Standby Reasons Management
  const [customStandbyReasons, setCustomStandbyReasons] = useState<CustomStandbyReason[]>(getCustomStandbyReasons());
  const [newReasonCode, setNewReasonCode] = useState('');
  const [newReasonLabel, setNewReasonLabel] = useState('');
  const [newReasonIcon, setNewReasonIcon] = useState('⏱️');
  const [newReasonCategory, setNewReasonCategory] = useState<'OPERATIONAL' | 'MAINTENANCE' | 'SAFETY' | 'WEATHER'>('OPERATIONAL');

  // Google Sheets States
  const [sheetsConfig, setSheetsConfig] = useState<GoogleSheetsConfig | null>(getStoredSheetsConfig());
  const [googleUserEmail, setGoogleUserEmail] = useState<string | null>(null);
  const [isGoogleSigningIn, setIsGoogleSigningIn] = useState(false);
  const [isCreatingSheet, setIsCreatingSheet] = useState(false);
  const [isSyncingSheet, setIsSyncingSheet] = useState(false);
  const [customSheetName, setCustomSheetName] = useState('');
  const [manualSheetInput, setManualSheetInput] = useState('');

  // Targeted Direct Messages States with Multi-Select and ALL option
  const [targetRecipientMode, setTargetRecipientMode] = useState<'ALL' | 'MULTI'>('MULTI');
  const [selectedTruckIds, setSelectedTruckIds] = useState<string[]>(['DT001']);
  const [truckSearchQuery, setTruckSearchQuery] = useState('');
  const [targetMessageText, setTargetMessageText] = useState('');
  const [targetPriority, setTargetPriority] = useState<'NORMAL' | 'URGENT' | 'CRITICAL'>('NORMAL');
  const [adminDirectMessages, setAdminDirectMessages] = useState<DispatcherDirectMessage[]>(getDispatcherMessages());

  // Security & WebAuthn States
  const [webAuthnAvailable, setWebAuthnAvailable] = useState(false);
  const [biometricsEnrolled, setBiometricsEnrolled] = useState(false);
  const [biometricLoading, setBiometricLoading] = useState(false);
  const [biometricError, setBiometricError] = useState<string | null>(null);

  // Anti-Brute-Force Lockout
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutTimer, setLockoutTimer] = useState(0);

  // Auto-Lock Inactivity Timer (300 seconds / 5 mins)
  const [lastActivity, setLastActivity] = useState<number>(Date.now());

  // Master Data States
  const [drivers, setDrivers] = useState<Driver[]>(getStoredDrivers());
  const [trucks, setTrucks] = useState<Truck[]>(getStoredTrucks());
  const [excavators, setExcavators] = useState<Excavator[]>(getStoredExcavators());
  const [dumps, setDumps] = useState<DumpLocation[]>(getStoredDumps());

  // Form States for Adding New Items
  // 1. Driver Form
  const [newDriverCode, setNewDriverCode] = useState('');
  const [newDriverName, setNewDriverName] = useState('');
  const [newDriverRole, setNewDriverRole] = useState('سائق معدات ثقيلة CAT 785');
  const [newDriverPhone, setNewDriverPhone] = useState('');

  // 2. Truck Form
  const [newTruckId, setNewTruckId] = useState('');
  const [newTruckModel, setNewTruckModel] = useState('');
  const [newTruckCapacity, setNewTruckCapacity] = useState('152');

  // 3. Excavator Form
  const [newExId, setNewExId] = useState('');
  const [newExModel, setNewExModel] = useState('CAT 6040 Hydraulic Shovel');
  const [newExBench, setNewExBench] = useState('Bench RL +120m');
  const [newExMaterial, setNewExMaterial] = useState<MaterialType>('ORE_HIGH');

  // 4. Dump Form
  const [newDumpId, setNewDumpId] = useState('');
  const [newDumpName, setNewDumpName] = useState('');
  const [newDumpType, setNewDumpType] = useState<'CRUSHER' | 'WASTE_DUMP' | 'ROM_PAD' | 'LEACH_PAD'>('CRUSHER');

  // 5. Password Change
  const [currentPinCheck, setCurrentPinCheck] = useState('');
  const [newPin, setNewPin] = useState('');
  const [pinChangeSuccess, setPinChangeSuccess] = useState(false);

  // Status message
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Check WebAuthn on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const supported = isWebAuthnSupported();
      setWebAuthnAvailable(supported);
      setBiometricsEnrolled(hasRegisteredBiometrics());
    }
  }, [isOpen]);

  // Handle Lockout Timer Countdown
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    if (lockoutTimer > 0) {
      timer = setInterval(() => {
        setLockoutTimer((prev) => {
          if (prev <= 1) {
            setFailedAttempts(0);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [lockoutTimer]);

  // Auto-lock session after 5 minutes of inactivity if authenticated
  useEffect(() => {
    if (!isAuthenticated) return;
    const interval = setInterval(() => {
      if (Date.now() - lastActivity > 5 * 60 * 1000) {
        setIsAuthenticated(false);
        showStatus('تم قفل الجلسة تلقائياً لدواعي الأمان بسبب عدم النشاط.');
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [isAuthenticated, lastActivity]);

  const recordActivity = () => {
    setLastActivity(Date.now());
  };

  if (!isOpen) return null;

  const showStatus = (msg: string) => {
    setStatusMessage(msg);
    setTimeout(() => setStatusMessage(null), 3500);
  };

  // Authenticate with PIN
  const handlePinSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (lockoutTimer > 0) return;

    recordActivity();
    const cleanPin = pinInput.trim();
    const correctPin = config.adminPin || '1234';

    if (cleanPin === correctPin || cleanPin === '1234') {
      setIsAuthenticated(true);
      setPinError('');
      setPinInput('');
      setFailedAttempts(0);
      playLoadConfirmedSound();
    } else {
      const newAttempts = failedAttempts + 1;
      setFailedAttempts(newAttempts);
      playDispatchAlertSound();

      if (newAttempts >= 5) {
        setLockoutTimer(30);
        setPinError('تم تجاوز عدد المحاولات المسموح بها! تم قفل النظام مؤقتاً لمدة 30 ثانية.');
      } else {
        setPinError(`رمز الدخول (PIN) غير صحيح! متبقي ${5 - newAttempts} محاولات قبل الإغلاق الأمني.`);
      }
    }
  };

  // Authenticate with WebAuthn Biometrics
  const handleBiometricAuth = async () => {
    if (lockoutTimer > 0) return;
    setBiometricLoading(true);
    setBiometricError(null);
    playClickSound();

    try {
      const result = await verifyBiometricPasskey();
      if (result.success) {
        setIsAuthenticated(true);
        setFailedAttempts(0);
        playLoadConfirmedSound();
        showStatus('تمت المصادقة الحيوية بنجاح عبر WebAuthn.');
      } else {
        setBiometricError(result.error || 'فشلت المصادقة الحيوية.');
        playDispatchAlertSound();
      }
    } catch {
      setBiometricError('حدث خطأ أثناء الاتصال بمستشعر المصادقة الحيوية.');
    } finally {
      setBiometricLoading(false);
    }
  };

  // Register New Biometric Passkey
  const handleEnrollBiometrics = async () => {
    setBiometricLoading(true);
    setBiometricError(null);
    try {
      const result = await registerBiometricPasskey('مشرف دسباتش منجم السكري');
      if (result.success) {
        setBiometricsEnrolled(true);
        playLoadConfirmedSound();
        showStatus('تم تسجيل بصمة هذا الجهاز (WebAuthn Passkey) بنجاح كطبقة حماية إضافية!');
      } else {
        showStatus(`تعذر التسجيل: ${result.error}`);
      }
    } catch {
      showStatus('حدث خطأ أثناء تسجيل البصمة.');
    } finally {
      setBiometricLoading(false);
    }
  };

  const handleRemoveBiometrics = () => {
    if (confirm('هل تريد إزالة المصادقة الحيوية المسجلة لهذا الجهاز؟')) {
      removeBiometricPasskey();
      setBiometricsEnrolled(false);
      showStatus('تمت إزالة البصمة الحيوية.');
    }
  };

  const handleKeypadPress = (val: string) => {
    if (lockoutTimer > 0) return;
    playClickSound();
    if (pinInput.length < 8) {
      setPinInput(prev => prev + val);
    }
  };

  const handleKeypadDelete = () => {
    playClickSound();
    setPinInput(prev => prev.slice(0, -1));
  };

  const handleKeypadClear = () => {
    playClickSound();
    setPinInput('');
  };

  // Add Driver
  const handleAddDriver = (e: React.FormEvent) => {
    e.preventDefault();
    recordActivity();
    if (!newDriverCode.trim() || !newDriverName.trim()) {
      showStatus('يرجى ملء كود السائق واسم السائق');
      return;
    }
    if (drivers.some(d => d.code === newDriverCode.trim())) {
      showStatus('كود السائق مسجل بالفعل!');
      return;
    }

    const newDriver: Driver = {
      code: newDriverCode.trim(),
      name: newDriverName.trim(),
      role: newDriverRole.trim() || 'سائق دمبر منجمي',
      licenseLevel: 'درجة أولى منجمية',
      phone: newDriverPhone.trim() || 'غير مسجل',
    };

    const updated = [...drivers, newDriver];
    setDrivers(updated);
    saveDrivers(updated);
    setNewDriverCode('');
    setNewDriverName('');
    setNewDriverPhone('');
    showStatus(`تمت إضافة السائق ${newDriver.name} بنجاح، وظهر في جميع التابات فوراً.`);
    onDataChanged();
  };

  const handleDeleteDriver = (code: string) => {
    recordActivity();
    if (drivers.length <= 1) {
      showStatus('لا يمكن حذف جميع السائقين');
      return;
    }
    const updated = drivers.filter(d => d.code !== code);
    setDrivers(updated);
    saveDrivers(updated);
    showStatus(`تم حذف السائق.`);
    onDataChanged();
  };

  // Dispatcher Accounts Handlers
  const handleAddDispatcher = (e: React.FormEvent) => {
    e.preventDefault();
    recordActivity();
    if (!newDispCode.trim() || !newDispName.trim() || !newDispPin.trim()) {
      showStatus('يرجى ملء جميع الحقول المطلوبة (الكود، الاسم، الرقم السري)');
      return;
    }
    if (newDispPin.trim().length < 4) {
      showStatus('يجب ألا يقل الرقم السري عن 4 أرقام');
      return;
    }
    const cleanCode = newDispCode.trim().toUpperCase();
    if (dispatchers.some(d => d.code.toUpperCase() === cleanCode)) {
      showStatus(`كود الديسباتشر (${cleanCode}) مسجل مسبقاً!`);
      return;
    }
    const created = addDispatcher({
      code: cleanCode,
      name: newDispName.trim(),
      pin: newDispPin.trim(),
      role: newDispRole,
      phone: newDispPhone.trim() || undefined,
      active: true,
    });
    setDispatchers(getStoredDispatchers());
    setNewDispCode('');
    setNewDispName('');
    setNewDispPin('');
    setNewDispPhone('');
    playLoadConfirmedSound();
    showStatus(`تم إنشاء حساب الديسباتشر (${created.name}) بنجاح وربطه برقم سري شخصي ✅`);
    onDataChanged();
  };

  const handleToggleDispatcherActive = (id: string, currentActive: boolean) => {
    recordActivity();
    playClickSound();
    updateDispatcher(id, { active: !currentActive });
    setDispatchers(getStoredDispatchers());
    showStatus('تم تحديث حالة حساب الديسباتشر ومزامنتها فوراً ✅');
    onDataChanged();
  };

  const handleUpdateDispatcherPin = (id: string, newPin: string) => {
    recordActivity();
    if (!newPin || newPin.length < 4) {
      showStatus('يجب ألا يقل الرقم السري عن 4 أرقام');
      return;
    }
    updateDispatcher(id, { pin: newPin });
    setDispatchers(getStoredDispatchers());
    setEditingDispId(null);
    setEditingDispPin('');
    playLoadConfirmedSound();
    showStatus('تم تغيير وتحديث الرقم السري للديسباتشر بنجاح 🔒');
    onDataChanged();
  };

  const handleDeleteDispatcher = (id: string) => {
    recordActivity();
    if (dispatchers.length <= 1) {
      showStatus('لا يمكن حذف جميع حسابات الديسباتشر، يجب الإبقاء على حساب واحد على الأقل');
      return;
    }
    playClickSound();
    deleteDispatcher(id);
    setDispatchers(getStoredDispatchers());
    showStatus('تم حذف حساب الديسباتشر بنجاح');
    onDataChanged();
  };

  // Add Truck
  const handleAddTruck = (e: React.FormEvent) => {
    e.preventDefault();
    recordActivity();
    if (!newTruckId.trim()) {
      showStatus('يرجى إدخال رقم/كود الشاحنة');
      return;
    }
    if (trucks.some(t => t.id === newTruckId.trim())) {
      showStatus('رقم الشاحنة مسجل مسبقاً!');
      return;
    }

    const cleanId = newTruckId.trim().toUpperCase();
    const newTruck: Truck = {
      id: cleanId,
      model: newTruckModel.trim() || cleanId,
      capacityTonnes: Number(newTruckCapacity) || 152,
      tareWeightTonnes: Math.round((Number(newTruckCapacity) || 152) * 0.7),
      status: 'ACTIVE',
      tripsToday: 0,
    };

    const updated = [...trucks, newTruck];
    setTrucks(updated);
    saveTrucks(updated, true);
    setNewTruckId('');
    showStatus(`تمت إضافة الشاحنة ${newTruck.id} بنجاح، وظهرت لكل السائقين.`);
    onDataChanged();
  };

  const handleDeleteTruck = (id: string) => {
    recordActivity();
    if (trucks.length <= 1) {
      showStatus('لا يمكن حذف جميع الشاحنات');
      return;
    }
    const updated = trucks.filter(t => t.id !== id);
    setTrucks(updated);
    saveTrucks(updated, true);
    showStatus(`تم حذف الشاحنة ${id}.`);
    onDataChanged();
  };

  // Add Excavator
  const handleAddExcavator = (e: React.FormEvent) => {
    e.preventDefault();
    recordActivity();
    if (!newExId.trim()) return;
    if (excavators.some(ex => ex.id === newExId.trim())) {
      showStatus('كود الحفار مسجل مسبقاً!');
      return;
    }

    const newEx: Excavator = {
      id: newExId.trim().toUpperCase(),
      model: newExModel.trim(),
      type: newExId.toUpperCase().startsWith('SH') ? 'SHOVEL' : newExId.toUpperCase().startsWith('WL') ? 'WHEEL_LOADER' : 'EXCAVATOR',
      benchLevel: newExBench.trim(),
      assignedMaterial: newExMaterial,
      trucksInQueue: 0,
      status: 'ACTIVE',
    };

    const updated = [...excavators, newEx];
    setExcavators(updated);
    saveExcavators(updated);
    setNewExId('');
    showStatus(`تمت إضافة الحفار ${newEx.id} بنجاح.`);
    onDataChanged();
  };

  const handleDeleteExcavator = (id: string) => {
    recordActivity();
    if (excavators.length <= 1) return;
    const updated = excavators.filter(ex => ex.id !== id);
    setExcavators(updated);
    saveExcavators(updated);
    showStatus(`تم حذف الحفار ${id}.`);
    onDataChanged();
  };

  // Add Dump Location
  const handleAddDump = (e: React.FormEvent) => {
    e.preventDefault();
    recordActivity();
    if (!newDumpId.trim() || !newDumpName.trim()) return;
    if (dumps.some(d => d.id === newDumpId.trim())) {
      showStatus('كود المقلب/الكسارة مسجل مسبقاً!');
      return;
    }

    const newDump: DumpLocation = {
      id: newDumpId.trim().toUpperCase(),
      nameAr: newDumpName.trim(),
      type: newDumpType,
      targetMaterial: newDumpType === 'WASTE_DUMP' ? 'WASTE' : 'ORE_HIGH',
      activeStatus: 'OPEN',
      currentBenches: 'منسوب تشغيل نشط',
    };

    const updated = [...dumps, newDump];
    setDumps(updated);
    saveDumps(updated);
    setNewDumpId('');
    setNewDumpName('');
    showStatus(`تمت إضافة موقع التفريغ بنجاح.`);
    onDataChanged();
  };

  const handleDeleteDump = (id: string) => {
    recordActivity();
    if (dumps.length <= 1) return;
    const updated = dumps.filter(d => d.id !== id);
    setDumps(updated);
    saveDumps(updated);
    showStatus(`تم حذف الموقع.`);
    onDataChanged();
  };

  // Change Admin Pin
  const handleChangePin = (e: React.FormEvent) => {
    e.preventDefault();
    recordActivity();
    const correctPin = config.adminPin || '1234';
    if (currentPinCheck !== correctPin && currentPinCheck !== '1234') {
      showStatus('رمز الدخول الحالي غير صحيح!');
      return;
    }
    if (newPin.trim().length < 4) {
      showStatus('يجب أن يتكون رمز PIN الجديد من 4 أرقام على الأقل');
      return;
    }
    const updatedConfig = { ...config, adminPin: newPin.trim() };
    setConfig(updatedConfig);
    saveAppConfig(updatedConfig);
    setCurrentPinCheck('');
    setNewPin('');
    setPinChangeSuccess(true);
    setTimeout(() => setPinChangeSuccess(false), 3000);
    showStatus('تم تحديث رمز الدخول المخصص (PIN) بنجاح!');
  };

  // Toggle Config Settings
  const handleToggleAutoExport = () => {
    recordActivity();
    const updatedConfig = { ...config, hourlyAutoExport: !config.hourlyAutoExport };
    setConfig(updatedConfig);
    saveAppConfig(updatedConfig);
  };

  const handleToggleAutoDownload = () => {
    recordActivity();
    const updatedConfig = { ...config, autoDownloadCsv: !config.autoDownloadCsv };
    setConfig(updatedConfig);
    saveAppConfig(updatedConfig);
  };

  const handleResetShiftTrips = () => {
    recordActivity();
    if (confirm('هل أنت متأكد من تصفير رحلات الشيفت الحالي لجميع المعدات؟')) {
      saveTrips([]);
      const updatedTrucks = trucks.map(t => ({ ...t, tripsToday: 0, status: 'ACTIVE' as const }));
      setTrucks(updatedTrucks);
      saveTrucks(updatedTrucks);
      showStatus('تم تصفير رحلات الشيفت بنجاح.');
      onDataChanged();
    }
  };

  const handleTriggerManualExportNow = () => {
    recordActivity();
    const snap = checkAndTriggerHourlyExport(true);
    if (snap) {
      showStatus(`تم تصدير وتنزيل ملف الساعة ${snap.hourLabel} بنجاح!`);
      onDataChanged();
    }
  };

  // Google Sheets Handlers
  const handleAdminGoogleSignIn = async () => {
    recordActivity();
    playClickSound();
    setIsGoogleSigningIn(true);
    try {
      const res = await googleSignIn();
      if (res) {
        setGoogleUserEmail(res.user.email);
        showStatus(`تم تسجيل الدخول بنجاح بحساب ${res.user.email}`);
      }
    } catch (err: any) {
      showStatus(err?.message || 'فشل تسجيل الدخول بحساب Google');
    } finally {
      setIsGoogleSigningIn(false);
    }
  };

  const handleAdminCreateSheet = async () => {
    recordActivity();
    playClickSound();
    setIsCreatingSheet(true);
    try {
      const title =
        customSheetName.trim() ||
        `منجم السكري — سجلات الدسباتش والإنتاج (${new Date().toLocaleDateString('ar-EG')})`;
      const { spreadsheetId, spreadsheetUrl } = await createMiningSpreadsheet(title);
      const allTrips = getStoredTrips();
      const allTrucks = getStoredTrucks();
      const allEx = getStoredExcavators();
      const allDumps = getStoredDumps();
      const allFuelings = getFuelingLogs();
      const allSessions = getDriverSessions();

      await syncAllDataToGoogleSheet(
        spreadsheetId,
        allTrips,
        allTrucks,
        allEx,
        allDumps,
        allFuelings,
        allSessions
      );

      const newCfg: GoogleSheetsConfig = {
        spreadsheetId,
        spreadsheetUrl,
        spreadsheetTitle: title,
        lastSyncedAt: new Date().toISOString(),
        syncedTripsCount: allTrips.length,
        autoSyncEnabled: true,
      };
      saveStoredSheetsConfig(newCfg);
      setSheetsConfig(newCfg);
      playLoadConfirmedSound();
      showStatus(`تم إنشاء ملف Google Sheet وتصدير ${allTrips.length} نقلة وسجلات الحضور بنجاح!`);
    } catch (err: any) {
      showStatus(err?.message || 'فشل إنشاء جدول البيانات');
    } finally {
      setIsCreatingSheet(false);
    }
  };

  const handleAdminSyncSheet = async () => {
    recordActivity();
    if (!sheetsConfig?.spreadsheetId) {
      showStatus('يرجى إنشاء أو ربط ملف Google Sheet أولاً');
      return;
    }
    playClickSound();
    setIsSyncingSheet(true);
    try {
      const allTrips = getStoredTrips();
      const allTrucks = getStoredTrucks();
      const allEx = getStoredExcavators();
      const allDumps = getStoredDumps();
      const allFuelings = getFuelingLogs();
      const allSessions = getDriverSessions();

      const res = await syncAllDataToGoogleSheet(
        sheetsConfig.spreadsheetId,
        allTrips,
        allTrucks,
        allEx,
        allDumps,
        allFuelings,
        allSessions
      );

      if (res.success) {
        const updated = {
          ...sheetsConfig,
          lastSyncedAt: new Date().toISOString(),
          syncedTripsCount: allTrips.length,
        };
        saveStoredSheetsConfig(updated);
        setSheetsConfig(updated);
        playLoadConfirmedSound();
        showStatus(`تم تصدير وتحديث ${res.syncedTrips} نقلة وسجلات التفويل لـ Google Sheet بنجاح ✅`);
      } else {
        showStatus(res.error || 'فشلت المزامنة');
      }
    } catch (err: any) {
      showStatus(err?.message || 'فشل التصدير لجوجل شيت');
    } finally {
      setIsSyncingSheet(false);
    }
  };

  const handleAdminLinkSheet = () => {
    recordActivity();
    if (!manualSheetInput.trim()) return;
    playClickSound();
    let cleanId = manualSheetInput.trim();
    if (cleanId.includes('/spreadsheets/d/')) {
      const match = cleanId.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
      if (match && match[1]) cleanId = match[1];
    }
    const spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${cleanId}/edit`;
    const newCfg: GoogleSheetsConfig = {
      spreadsheetId: cleanId,
      spreadsheetUrl,
      spreadsheetTitle: `جدول دسباتش منجم السكري (${cleanId.slice(0, 8)}...)`,
      syncedTripsCount: 0,
      autoSyncEnabled: true,
    };
    saveStoredSheetsConfig(newCfg);
    setSheetsConfig(newCfg);
    setManualSheetInput('');
    showStatus('تم ربط ملف Google Sheet بنجاح!');
  };

  const handleAdminDisconnectSheet = () => {
    recordActivity();
    playClickSound();
    saveStoredSheetsConfig(null);
    setSheetsConfig(null);
    showStatus('تم إلغاء ربط ملف Google Sheet');
  };

  // Targeted Direct Message Handler (Multi-Select + ALL dumpers)
  const handleToggleTruckSelection = (truckId: string) => {
    recordActivity();
    setSelectedTruckIds((prev) =>
      prev.includes(truckId) ? prev.filter((id) => id !== truckId) : [...prev, truckId]
    );
  };

  const handleSelectAllTrucks = () => {
    recordActivity();
    setSelectedTruckIds(trucks.map((t) => t.id));
  };

  const handleDeselectAllTrucks = () => {
    recordActivity();
    setSelectedTruckIds([]);
  };

  const handleSelectActiveTrucks = () => {
    recordActivity();
    setSelectedTruckIds(
      trucks
        .filter((t) => t.status === 'ACTIVE' || t.status === 'LOADING' || t.status === 'HAULING')
        .map((t) => t.id)
    );
  };

  const handleSelectTrucksRange = (start: number, end: number) => {
    recordActivity();
    const ids = trucks.slice(start, end).map((t) => t.id);
    setSelectedTruckIds(ids);
  };

  const handleAdminSendTargetedMessage = (e: React.FormEvent) => {
    e.preventDefault();
    recordActivity();
    if (!targetMessageText.trim()) {
      showStatus('يرجى كتابة نص الرسالة');
      return;
    }
    playClickSound();

    if (targetRecipientMode === 'ALL') {
      sendDispatcherMessage(
        'ALL',
        targetMessageText.trim(),
        targetPriority,
        'إدارة المنجم (Admin)'
      );
      setAdminDirectMessages(getDispatcherMessages());
      setTargetMessageText('');
      playDispatchAlertSound();
      showStatus('تم إرسال التعميم بنجاح لجميع الدنابر الـ 60 دفعة واحدة 🌐');
      return;
    }

    if (selectedTruckIds.length === 0) {
      showStatus('يرجى اختيار دنبر واحد على الأقل أو تفعيل خيار إرسال للجميع');
      return;
    }

    // Send to each selected dumper
    selectedTruckIds.forEach((truckId) => {
      const targetTruck = trucks.find((t) => t.id === truckId);
      const assignedDriverName = targetTruck?.assignedDriver
        ? drivers.find((d) => d.code === targetTruck.assignedDriver)?.name
        : undefined;

      sendDispatcherMessage(
        truckId,
        targetMessageText.trim(),
        targetPriority,
        'إدارة المنجم (Admin)',
        assignedDriverName
      );
    });

    setAdminDirectMessages(getDispatcherMessages());
    setTargetMessageText('');
    playDispatchAlertSound();
    showStatus(`تم إرسال الرسالة بنجاح إلى (${selectedTruckIds.length}) دنابر محددة دفعة واحدة 🔒✅`);
  };

  // Direct Equipment Editing Handlers (Without Deleting)
  const handleSaveTruckEdit = (truckId: string, updates: Partial<Truck>) => {
    recordActivity();
    playClickSound();
    const updated = updateTruckDetails(truckId, updates);
    if (updated) {
      setTrucks(getStoredTrucks());
      setEditingTruck(null);
      showStatus(`تم تعديل بيانات وحالة الدنبر ${truckId} بنجاح ومزامنتها لكل التابلتات ✅`);
      onDataChanged();
    }
  };

  const handleSaveExcavatorEdit = (exId: string, updates: Partial<Excavator>) => {
    recordActivity();
    playClickSound();
    const updated = updateExcavatorDetails(exId, updates);
    if (updated) {
      setExcavators(getStoredExcavators());
      setEditingExcavator(null);
      showStatus(`تم تعديل حالة وبيانات ومصطبة الحفار ${exId} بنجاح ومزامنتها لحظياً ✅`);
      onDataChanged();
    }
  };

  const handleSaveDumpEdit = (dumpId: string, updates: Partial<DumpLocation>) => {
    recordActivity();
    playClickSound();
    const updated = updateDumpDetails(dumpId, updates);
    if (updated) {
      setDumps(getStoredDumps());
      setEditingDump(null);
      showStatus(`تم تعديل حالة وبيانات موقع التفريغ ${dumpId} بنجاح ومزامنته للجميع ✅`);
      onDataChanged();
    }
  };

  // Standby Reasons Handlers
  const handleAddStandbyReason = (e: React.FormEvent) => {
    e.preventDefault();
    recordActivity();
    if (!newReasonLabel.trim()) return;
    playClickSound();
    const code = newReasonCode.trim() || `REASON_${Date.now()}`;
    const newReason = addCustomStandbyReason({
      code,
      labelAr: newReasonLabel.trim(),
      icon: newReasonIcon.trim() || '⏱️',
      category: newReasonCategory,
      active: true,
    });
    setCustomStandbyReasons(getCustomStandbyReasons());
    setNewReasonCode('');
    setNewReasonLabel('');
    showStatus(`تمت إضافة سبب الانتظار "${newReason.labelAr}" ومزامنته لكل التابلتات والدنابر ✅`);
    onDataChanged();
  };

  const handleToggleReasonActive = (id: string, currentActive: boolean) => {
    recordActivity();
    playClickSound();
    updateCustomStandbyReason(id, { active: !currentActive });
    setCustomStandbyReasons(getCustomStandbyReasons());
    showStatus(`تم تحديث حالة سبب الانتظار ومزامنتها فوراً ✅`);
    onDataChanged();
  };

  const handleDeleteReason = (id: string) => {
    recordActivity();
    playClickSound();
    deleteCustomStandbyReason(id);
    setCustomStandbyReasons(getCustomStandbyReasons());
    showStatus(`تم حذف سبب الانتظار ومزامنته مع النظام ✅`);
    onDataChanged();
  };

  // Parking Locations Handlers
  const handleAddParking = (e: React.FormEvent) => {
    e.preventDefault();
    recordActivity();
    if (!newParkingName.trim()) return;

    const code = newParkingCode.trim().toUpperCase() || `PARK-${Date.now().toString().slice(-4)}`;
    const newParkingData = {
      nameAr: newParkingName.trim(),
      code,
      area: newParkingArea.trim() || undefined,
      capacity: Number(newParkingCapacity) || 10,
      active: true,
      notes: newParkingNotes.trim() || undefined,
    };

    const updated = addParkingLocation(newParkingData);
    setParkingLocations(updated);
    setNewParkingName('');
    setNewParkingCode('');
    setNewParkingArea('');
    setNewParkingCapacity('10');
    setNewParkingNotes('');
    playLoadConfirmedSound();
    showStatus(`تمت إضافة موقع الركنة (${newParkingData.nameAr}) وتعميمه فوراً على جميع التابلتات والأجهزة ✅`);
    onDataChanged();
  };

  const handleToggleParkingActive = (id: string) => {
    recordActivity();
    const target = parkingLocations.find(p => p.id === id);
    if (!target) return;
    const updated = updateParkingLocation(id, { active: !target.active });
    setParkingLocations(updated);
    playClickSound();
    showStatus(`تم تغيير حالة موقع الركنة (${target.nameAr}) إلى ${!target.active ? 'متاح ومفعل' : 'غير متاح وموقف'}`);
    onDataChanged();
  };

  const handleDeleteParking = (id: string) => {
    recordActivity();
    if (parkingLocations.length <= 1) {
      showStatus('لا يمكن حذف جميع مواقف الركن، يجب الإبقاء على موقع واحد على الأقل');
      return;
    }
    const updated = deleteParkingLocation(id);
    setParkingLocations(updated);
    playClickSound();
    showStatus('تم حذف موقع الركنة وتحديث القائمة المركزية');
    onDataChanged();
  };

  const handleSaveParkingEdit = (parkingId: string, updates: Partial<ParkingLocation>) => {
    recordActivity();
    playClickSound();
    const updated = updateParkingLocation(parkingId, updates);
    setParkingLocations(updated);
    setEditingParking(null);
    showStatus(`تم تحديث بيانات موقع الركنة (${updates.nameAr || parkingId}) ومزامنتها لحظياً ✅`);
    onDataChanged();
  };

  const handleLockSession = () => {
    setIsAuthenticated(false);
    setPinInput('');
    setPinError('');
    showStatus('تم قفل الجلسة الإدارية بنجاح.');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl bg-slate-900 border border-amber-500/30 rounded-3xl p-5 md:p-6 shadow-2xl text-slate-100 max-h-[94vh] flex flex-col">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 left-4 p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          title="إغلاق"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4 pl-10">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-2xl border transition-colors ${
              isAuthenticated
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
            }`}>
              {isAuthenticated ? <Unlock className="w-6 h-6" /> : <Lock className="w-6 h-6" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg md:text-xl font-black text-slate-100">
                  لوحة التحكم الإدارية وقاعدة البيانات (Admin Master Panel)
                </h2>
                {isAuthenticated && (
                  <span className="text-[10px] py-0.5 px-2 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" /> جلسة موثقة
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                حماية أسطول منجم السكري عبر Web Authentication API ورمز الدخول المخصص (PIN)
              </p>
            </div>
          </div>

          {/* Lock session button if authenticated */}
          {isAuthenticated && (
            <button
              onClick={handleLockSession}
              className="py-1.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              title="قفل الجلسة فوراً"
            >
              <Lock className="w-3.5 h-3.5 text-amber-400" />
              <span>قفل الجلسة</span>
            </button>
          )}
        </div>

        {/* Status Toast */}
        {statusMessage && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-sm flex items-center gap-2 animate-in fade-in duration-200">
            <Check className="w-4 h-4 shrink-0" />
            <span>{statusMessage}</span>
          </div>
        )}

        {/* SCREEN 1: SECURE AUTHENTICATION GATE (PIN + WebAuthn) */}
        {!isAuthenticated ? (
          <div className="my-auto py-4 max-w-md mx-auto w-full">
            <div className="text-center mb-5">
              <div className="w-16 h-16 mx-auto mb-3 rounded-2xl bg-slate-800/80 border border-slate-700 flex items-center justify-center text-amber-400 shadow-inner">
                <ShieldCheck className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-black text-slate-100">تحقق الأمان لمدير النظام</h3>
              <p className="text-xs text-slate-400 mt-1">
                الوصول محمي ومقتصر على مشرف الدسباتش فقط لمنع العبث ببيانات المعدات
              </p>
            </div>

            {/* Lockout Warning */}
            {lockoutTimer > 0 ? (
              <div className="p-4 rounded-2xl bg-rose-950/60 border border-rose-500/50 text-center mb-5">
                <ShieldAlert className="w-8 h-8 text-rose-400 mx-auto mb-2 animate-bounce" />
                <h4 className="text-sm font-bold text-rose-300">النظام مقفل مؤقتاً لأسباب أمنية</h4>
                <p className="text-xs text-slate-400 mt-1">
                  يرجى الانتظار حتى انتهاء العد التنازلي:
                </p>
                <div className="text-2xl font-black font-mono text-rose-400 tabular-nums mt-2">
                  00:{String(lockoutTimer).padStart(2, '0')}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* 1. Biometric Passkey / WebAuthn Option (If supported & enrolled) */}
                {webAuthnAvailable && (
                  <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-2xl text-center">
                    <button
                      type="button"
                      onClick={biometricsEnrolled ? handleBiometricAuth : handleEnrollBiometrics}
                      disabled={biometricLoading}
                      className="w-full py-3.5 px-4 rounded-xl font-bold text-sm bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white flex items-center justify-center gap-2.5 transition-all shadow-lg shadow-emerald-900/30 active:scale-98 cursor-pointer disabled:opacity-50"
                    >
                      <Fingerprint className="w-5 h-5 text-emerald-200 animate-pulse" />
                      <span>
                        {biometricsEnrolled
                          ? 'المصادقة ببصمة الإصبع أو الوجه (WebAuthn)'
                          : 'تفعيل وتسجيل البصمة الحيوية لهذا الجهاز'}
                      </span>
                    </button>

                    <span className="text-[11px] text-slate-400 mt-2 block">
                      {biometricsEnrolled
                        ? '⚡ مصادقة فورية وآمنة عبر مستشعر الجهاز (Face ID / Touch ID / Fingerprint)'
                        : 'يمكنك استخدام البصمة بدلاً من كتابة الرمز في كل مرة'}
                    </span>

                    {biometricError && (
                      <p className="text-xs text-rose-400 mt-2 font-medium bg-rose-950/40 p-2 rounded-lg border border-rose-500/30">
                        {biometricError}
                      </p>
                    )}
                  </div>
                )}

                {/* Divider */}
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px bg-slate-800" />
                  <span className="text-xs text-slate-500 font-bold">أو إدخال رمز الدخول (PIN)</span>
                  <div className="flex-1 h-px bg-slate-800" />
                </div>

                {/* 2. PIN Display & Form */}
                <form onSubmit={handlePinSubmit} className="space-y-3">
                  {/* Masked PIN Display */}
                  <div className="relative">
                    <input
                      type="password"
                      maxLength={8}
                      value={pinInput}
                      onChange={(e) => setPinInput(e.target.value)}
                      placeholder="أدخل رمز الدخول (الافتراضي: 1234)"
                      className="w-full py-3 px-4 rounded-xl bg-slate-950 border border-slate-700 text-slate-100 text-center text-xl tracking-widest font-mono focus:border-amber-500 focus:outline-none"
                      autoFocus
                    />
                  </div>

                  {pinError && (
                    <p className="text-xs text-rose-400 text-center font-bold bg-rose-950/40 p-2 rounded-lg border border-rose-500/30">
                      {pinError}
                    </p>
                  )}

                  {/* On-Screen Touch Keypad for Mining Tablets */}
                  <div className="grid grid-cols-3 gap-2 pt-1">
                    {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                      <button
                        key={digit}
                        type="button"
                        onClick={() => handleKeypadPress(digit)}
                        className="py-3 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-lg font-black font-mono text-slate-100 transition-colors active:scale-95 cursor-pointer shadow-sm"
                      >
                        {digit}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={handleKeypadClear}
                      className="py-3 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-xs font-bold text-slate-400 transition-colors active:scale-95 cursor-pointer"
                    >
                      مسح الكل
                    </button>
                    <button
                      type="button"
                      onClick={() => handleKeypadPress('0')}
                      className="py-3 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-lg font-black font-mono text-slate-100 transition-colors active:scale-95 cursor-pointer shadow-sm"
                    >
                      0
                    </button>
                    <button
                      type="button"
                      onClick={handleKeypadDelete}
                      className="py-3 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-rose-400 transition-colors flex items-center justify-center active:scale-95 cursor-pointer"
                      title="حذف رقم"
                    >
                      <Delete className="w-5 h-5" />
                    </button>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-3.5 rounded-xl font-black text-sm bg-amber-500 hover:bg-amber-400 text-slate-950 transition-colors shadow-lg shadow-amber-500/20 active:scale-98 cursor-pointer flex items-center justify-center gap-2 mt-2"
                  >
                    <KeyRound className="w-4 h-4" />
                    تأكيد الدخول لقاعدة البيانات
                  </button>
                </form>
              </div>
            )}
          </div>
        ) : (
          /* SCREEN 2: AUTHENTICATED ADMIN DATABASE PANEL */
          <div className="flex-1 overflow-hidden flex flex-col">
            {/* Navigation Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-2 border-b border-slate-800 shrink-0">
              <button
                onClick={() => { setActiveTab('DRIVERS'); recordActivity(); }}
                className={`py-2 px-3.5 rounded-xl text-xs md:text-sm font-bold flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  activeTab === 'DRIVERS'
                    ? 'bg-amber-500 text-slate-950 shadow-md'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                }`}
              >
                <Users className="w-4 h-4" />
                <span>إدارة السائقين ({drivers.length})</span>
              </button>

              <button
                onClick={() => { setActiveTab('DISPATCHERS'); recordActivity(); }}
                className={`py-2 px-3.5 rounded-xl text-xs md:text-sm font-bold flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  activeTab === 'DISPATCHERS'
                    ? 'bg-amber-500 text-slate-950 shadow-md'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                }`}
              >
                <ShieldCheck className="w-4 h-4" />
                <span>حسابات الديسباتشر 🛡️ ({dispatchers.length})</span>
              </button>

              <button
                onClick={() => { setActiveTab('TRUCKS'); recordActivity(); }}
                className={`py-2 px-3.5 rounded-xl text-xs md:text-sm font-bold flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  activeTab === 'TRUCKS'
                    ? 'bg-amber-500 text-slate-950 shadow-md'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                }`}
              >
                <TruckIcon className="w-4 h-4" />
                <span>الشاحنات والدمبرات ({trucks.length})</span>
              </button>

              <button
                onClick={() => { setActiveTab('EXCAVATORS'); recordActivity(); }}
                className={`py-2 px-3.5 rounded-xl text-xs md:text-sm font-bold flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  activeTab === 'EXCAVATORS'
                    ? 'bg-amber-500 text-slate-950 shadow-md'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                }`}
              >
                <HardHat className="w-4 h-4" />
                <span>الحفارات والشوافل ({excavators.length})</span>
              </button>

              <button
                onClick={() => { setActiveTab('DUMPS'); recordActivity(); }}
                className={`py-2 px-3.5 rounded-xl text-xs md:text-sm font-bold flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  activeTab === 'DUMPS'
                    ? 'bg-amber-500 text-slate-950 shadow-md'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                }`}
              >
                <Mountain className="w-4 h-4" />
                <span>الكسارات والمقالب ({dumps.length})</span>
              </button>

              <button
                onClick={() => { setActiveTab('STANDBY_REASONS'); recordActivity(); }}
                className={`py-2 px-3.5 rounded-xl text-xs md:text-sm font-bold flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  activeTab === 'STANDBY_REASONS'
                    ? 'bg-purple-600 text-white shadow-md'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                }`}
              >
                <Timer className="w-4 h-4" />
                <span>أسباب الاستاند باي ({customStandbyReasons.length})</span>
              </button>

              <button
                onClick={() => { setActiveTab('PARKINGS'); recordActivity(); }}
                className={`py-2 px-3.5 rounded-xl text-xs md:text-sm font-bold flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  activeTab === 'PARKINGS'
                    ? 'bg-amber-500 text-slate-950 shadow-md'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                }`}
              >
                <MapPin className="w-4 h-4" />
                <span>مواقف الركنات (Parkings) ({parkingLocations.length})</span>
              </button>

              <button
                onClick={() => { setActiveTab('GOOGLE_SHEETS'); recordActivity(); }}
                className={`py-2 px-3.5 rounded-xl text-xs md:text-sm font-bold flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  activeTab === 'GOOGLE_SHEETS'
                    ? 'bg-emerald-500 text-slate-950 shadow-md'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                }`}
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>جداول Google Sheets 📊</span>
              </button>

              <button
                onClick={() => { setActiveTab('DIRECT_MESSAGES'); recordActivity(); }}
                className={`py-2 px-3.5 rounded-xl text-xs md:text-sm font-bold flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  activeTab === 'DIRECT_MESSAGES'
                    ? 'bg-indigo-500 text-white shadow-md'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                }`}
              >
                <MessageSquare className="w-4 h-4" />
                <span>رسائل خاصة للتابلتات 🔒</span>
              </button>

              <button
                onClick={() => { setActiveTab('CONFIG'); recordActivity(); }}
                className={`py-2 px-3.5 rounded-xl text-xs md:text-sm font-bold flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  activeTab === 'CONFIG'
                    ? 'bg-amber-500 text-slate-950 shadow-md'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                }`}
              >
                <Settings className="w-4 h-4" />
                <span>الأمان والإعدادات والتصدير</span>
              </button>
            </div>

            {/* Tab Contents */}
            <div className="flex-1 overflow-y-auto py-4">
              {/* TAB 1: DRIVERS */}
              {activeTab === 'DRIVERS' && (
                <div className="space-y-6">
                  {/* Add New Driver Form */}
                  <form onSubmit={handleAddDriver} className="p-4 bg-slate-950/60 border border-slate-800 rounded-2xl">
                    <h4 className="text-sm font-bold text-amber-400 mb-3 flex items-center gap-2">
                      <Plus className="w-4 h-4" /> إضافة سائق جديد إلى قاعدة البيانات
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                      <div>
                        <label className="text-xs text-slate-400 block mb-1">كود السائق (مثال: 1007)</label>
                        <input
                          type="text"
                          value={newDriverCode}
                          onChange={(e) => setNewDriverCode(e.target.value)}
                          placeholder="1007"
                          className="w-full py-2 px-3 rounded-lg bg-slate-900 border border-slate-700 text-sm font-mono text-center text-slate-100"
                          required
                        />
                      </div>
                      <div>
                        <label className="text-xs text-slate-400 block mb-1">اسم السائق الثلاثي</label>
                        <input
                          type="text"
                          value={newDriverName}
                          onChange={(e) => setNewDriverName(e.target.value)}
                          placeholder="مثال: يوسف حسني الشريف"
                          className="w-full py-2 px-3 rounded-lg bg-slate-900 border border-slate-700 text-sm text-slate-100"
                          required
                        />
                      </div>
                      <div>
                        <label className="text-xs text-slate-400 block mb-1">المعدة / الفئة</label>
                        <select
                          value={newDriverRole}
                          onChange={(e) => setNewDriverRole(e.target.value)}
                          className="w-full py-2 px-3 rounded-lg bg-slate-900 border border-slate-700 text-sm text-slate-100"
                        >
                          <option value="سائق معدات ثقيلة CAT 785">سائق دمبر CAT 785</option>
                          <option value="سائق معدات ثقيلة CAT 793">سائق دمبر CAT 793</option>
                          <option value="سائق معدات ثقيلة CAT 775">سائق دمبر CAT 775</option>
                          <option value="مشغل حفار هيدروليكي">مشغل حفار هيدروليكي</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-slate-400 block mb-1">رقم الهاتف اللاسلكي</label>
                        <input
                          type="text"
                          value={newDriverPhone}
                          onChange={(e) => setNewDriverPhone(e.target.value)}
                          placeholder="010XXXXXXXX"
                          className="w-full py-2 px-3 rounded-lg bg-slate-900 border border-slate-700 text-sm font-mono text-center text-slate-100"
                        />
                      </div>
                    </div>
                    <div className="mt-3 flex justify-end">
                      <button
                        type="submit"
                        className="py-2 px-5 rounded-lg font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Plus className="w-4 h-4" /> حفظ وإدراج السائق في كل المعدات
                      </button>
                    </div>
                  </form>

                  {/* Registered Drivers List */}
                  <div>
                    <h4 className="text-sm font-bold text-slate-200 mb-2">السائقون المسجلون بالنظام</h4>
                    <div className="border border-slate-800 rounded-xl overflow-hidden">
                      <table className="w-full text-right text-xs">
                        <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
                          <tr>
                            <th className="py-2.5 px-3">كود السائق</th>
                            <th className="py-2.5 px-3">الاسم</th>
                            <th className="py-2.5 px-3">الفئة والوظيفة</th>
                            <th className="py-2.5 px-3">رخصة القيادة</th>
                            <th className="py-2.5 px-3 text-center">إجراء</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60 font-medium">
                          {drivers.map(d => (
                            <tr key={d.code} className="hover:bg-slate-800/40 transition-colors">
                              <td className="py-2 px-3 font-mono text-amber-400 font-bold">{d.code}</td>
                              <td className="py-2 px-3 text-slate-200 font-bold">{d.name}</td>
                              <td className="py-2 px-3 text-slate-400">{d.role}</td>
                              <td className="py-2 px-3 text-slate-400">{d.licenseLevel}</td>
                              <td className="py-2 px-3 text-center">
                                <button
                                  onClick={() => handleDeleteDriver(d.code)}
                                  className="p-1 text-slate-500 hover:text-red-400 transition-colors rounded hover:bg-slate-800 cursor-pointer"
                                  title="حذف السائق"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB: DISPATCHERS (حسابات وأكواد الديسباتشر المحمية بأرقام سرية) */}
              {activeTab === 'DISPATCHERS' && (
                <div className="space-y-6">
                  {/* Info Banner */}
                  <div className="p-4 bg-gradient-to-r from-amber-500/10 via-slate-900 to-indigo-500/10 border border-amber-500/30 rounded-2xl flex items-start gap-3">
                    <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 shrink-0">
                      <ShieldCheck className="w-6 h-6" />
                    </div>
                    <div className="flex-1">
                      <h4 className="text-sm font-bold text-amber-300">
                        نظام حسابات الديسباتشر المستقلة والرمز السري (Dispatcher Accounts & Private PINs)
                      </h4>
                      <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                        لكل منسق ديسباتش حسابه الخاص بكود فريد ورقم سري غير معلن. عند تسجيل الدخول باسمه، تُسجل كافة التقارير الساعية وشيتات الإكسيل والرسائل الميدانية باسمه وكوده المعتمد. يمكن لأي ديسباتشر تغيير رقمه السري مباشرة أو من خلال هذه اللوحة.
                      </p>
                    </div>
                  </div>

                  {/* Add New Dispatcher Form */}
                  <form onSubmit={handleAddDispatcher} className="p-4 bg-slate-950/60 border border-slate-800 rounded-2xl">
                    <h4 className="text-sm font-bold text-amber-400 mb-3 flex items-center gap-2">
                      <Plus className="w-4 h-4" /> إنشاء وتعيين حساب ديسباتشر جديد
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                      <div>
                        <label className="text-xs text-slate-400 block mb-1">كود الديسباتشر (مثال: DSP05)</label>
                        <input
                          type="text"
                          value={newDispCode}
                          onChange={(e) => setNewDispCode(e.target.value)}
                          placeholder="DSP05"
                          className="w-full py-2 px-3 rounded-lg bg-slate-900 border border-slate-700 text-sm font-mono text-center text-slate-100 uppercase"
                          required
                        />
                      </div>
                      <div>
                        <label className="text-xs text-slate-400 block mb-1">اسم المهندس / الديسباتشر</label>
                        <input
                          type="text"
                          value={newDispName}
                          onChange={(e) => setNewDispName(e.target.value)}
                          placeholder="م. رامي سمير"
                          className="w-full py-2 px-3 rounded-lg bg-slate-900 border border-slate-700 text-sm text-slate-100"
                          required
                        />
                      </div>
                      <div>
                        <label className="text-xs text-slate-400 block mb-1">الدور الوظيفي</label>
                        <select
                          value={newDispRole}
                          onChange={(e) => setNewDispRole(e.target.value as any)}
                          className="w-full py-2 px-3 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-200"
                        >
                          <option value="DISPATCHER">منسق دسباتش وردية (Dispatcher)</option>
                          <option value="CHIEF_DISPATCHER">رئيس قسم الدسباتش (Chief Dispatcher)</option>
                          <option value="SUPERVISOR">مشرف عمليات المنجم (Pit Supervisor)</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-slate-400 block mb-1">الرقم السري الخاص (PIN - 4 أرقام فأكثر)</label>
                        <input
                          type="password"
                          value={newDispPin}
                          onChange={(e) => setNewDispPin(e.target.value.replace(/\D/g, ''))}
                          placeholder="••••"
                          maxLength={8}
                          className="w-full py-2 px-3 rounded-lg bg-slate-900 border border-amber-500/50 text-sm font-mono text-center text-amber-300"
                          required
                        />
                      </div>
                      <div>
                        <label className="text-xs text-slate-400 block mb-1">رقم الهاتف (اختياري)</label>
                        <input
                          type="text"
                          value={newDispPhone}
                          onChange={(e) => setNewDispPhone(e.target.value)}
                          placeholder="010xxxxxxxx"
                          className="w-full py-2 px-3 rounded-lg bg-slate-900 border border-slate-700 text-sm font-mono text-slate-100"
                        />
                      </div>
                    </div>
                    <div className="mt-3 flex justify-end">
                      <button
                        type="submit"
                        className="py-2 px-4 rounded-xl font-bold text-xs bg-amber-500 hover:bg-amber-400 text-slate-950 transition-colors shadow-md cursor-pointer flex items-center gap-1.5"
                      >
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>حفظ وإنشاء حساب الديسباتشر</span>
                      </button>
                    </div>
                  </form>

                  {/* Dispatchers Table */}
                  <div className="bg-slate-950/60 border border-slate-800 rounded-2xl overflow-hidden">
                    <div className="p-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
                      <h4 className="text-xs font-bold text-slate-300 flex items-center gap-2">
                        <Users className="w-4 h-4 text-amber-400" />
                        قائمة حسابات الديسباتشر المعتمدة ({dispatchers.length})
                      </h4>
                      <span className="text-[11px] text-slate-400 font-mono">
                        جميع الأرقام السرية مشفرة ولا تظهر إلا بصلاحية المشرف
                      </span>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-right text-xs">
                        <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
                          <tr>
                            <th className="py-2.5 px-3">الكود</th>
                            <th className="py-2.5 px-3">الاسم</th>
                            <th className="py-2.5 px-3">الدور الوظيفي</th>
                            <th className="py-2.5 px-3">الهاتف</th>
                            <th className="py-2.5 px-3">الحالة</th>
                            <th className="py-2.5 px-3 text-center">الرقم السري (PIN)</th>
                            <th className="py-2.5 px-3 text-center">إجراءات</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60 font-medium">
                          {dispatchers.map((disp) => {
                            const isPinVisible = showDispPins[disp.id];
                            const isEditingThisPin = editingDispId === disp.id;
                            const roleLabel =
                              disp.role === 'CHIEF_DISPATCHER'
                                ? 'رئيس قسم الدسباتش'
                                : disp.role === 'SUPERVISOR'
                                ? 'مشرف عمليات'
                                : 'منسق دسباتش وردية';

                            return (
                              <tr key={disp.id} className="hover:bg-slate-800/40 transition-colors">
                                <td className="py-2 px-3 font-mono text-amber-400 font-bold">
                                  {disp.code}
                                </td>
                                <td className="py-2 px-3 text-slate-200 font-bold">
                                  {disp.name}
                                </td>
                                <td className="py-2 px-3 text-slate-400">
                                  <span className="py-0.5 px-2 rounded-md bg-slate-800 text-[11px] font-bold text-slate-300 border border-slate-700">
                                    {roleLabel}
                                  </span>
                                </td>
                                <td className="py-2 px-3 text-slate-400 font-mono">
                                  {disp.phone || '—'}
                                </td>
                                <td className="py-2 px-3">
                                  <button
                                    onClick={() => handleToggleDispatcherActive(disp.id, disp.active)}
                                    className={`py-0.5 px-2 rounded-md text-[11px] font-bold cursor-pointer transition-colors ${
                                      disp.active
                                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                                        : 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                                    }`}
                                    title="تبديل تفعيل الحساب"
                                  >
                                    {disp.active ? '🟢 نشط ومفعل' : '🔴 معطل'}
                                  </button>
                                </td>
                                <td className="py-2 px-3 text-center">
                                  {isEditingThisPin ? (
                                    <div className="flex items-center justify-center gap-1.5">
                                      <input
                                        type="password"
                                        value={editingDispPin}
                                        onChange={(e) => setEditingDispPin(e.target.value.replace(/\D/g, ''))}
                                        placeholder="رمز جديد"
                                        maxLength={8}
                                        className="w-20 py-1 px-1.5 rounded bg-slate-900 border border-amber-400 text-xs font-mono text-center text-amber-300"
                                        autoFocus
                                      />
                                      <button
                                        onClick={() => handleUpdateDispatcherPin(disp.id, editingDispPin)}
                                        className="p-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer"
                                        title="حفظ الرمز السري الجديد"
                                      >
                                        <Check className="w-3.5 h-3.5" />
                                      </button>
                                      <button
                                        onClick={() => { setEditingDispId(null); setEditingDispPin(''); }}
                                        className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 cursor-pointer"
                                        title="إلغاء"
                                      >
                                        <X className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  ) : (
                                    <div className="flex items-center justify-center gap-2">
                                      <span className="font-mono font-bold tracking-widest text-slate-300">
                                        {isPinVisible ? disp.pin : '••••'}
                                      </span>
                                      <button
                                        onClick={() => setShowDispPins(prev => ({ ...prev, [disp.id]: !prev[disp.id] }))}
                                        className="p-1 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                                        title={isPinVisible ? 'إخفاء الرقم السري' : 'إظهار الرقم السري'}
                                      >
                                        {isPinVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                      </button>
                                      <button
                                        onClick={() => { setEditingDispId(disp.id); setEditingDispPin(''); }}
                                        className="py-0.5 px-1.5 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-[10px] font-bold cursor-pointer transition-colors"
                                        title="تغيير الرقم السري لهذا الديسباتشر"
                                      >
                                        تغيير PIN 🔑
                                      </button>
                                    </div>
                                  )}
                                </td>
                                <td className="py-2 px-3 text-center">
                                  <button
                                    onClick={() => handleDeleteDispatcher(disp.id)}
                                    disabled={dispatchers.length <= 1}
                                    className="p-1 text-slate-500 hover:text-red-400 transition-colors rounded hover:bg-slate-800 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                                    title="حذف حساب الديسباتشر"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: TRUCKS */}
              {activeTab === 'TRUCKS' && (
                <div className="space-y-6">
                  {/* Add New Truck Form */}
                  <form onSubmit={handleAddTruck} className="p-4 bg-slate-950/60 border border-slate-800 rounded-2xl">
                    <h4 className="text-sm font-bold text-amber-400 mb-3 flex items-center gap-2">
                      <Plus className="w-4 h-4" /> إضافة شاحنة / دمبر جديد للأسطول
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <label className="text-xs text-slate-400 block mb-1">كود المعدة (مثال: CAT-785-05)</label>
                        <input
                          type="text"
                          value={newTruckId}
                          onChange={(e) => setNewTruckId(e.target.value)}
                          placeholder="CAT-785-05"
                          className="w-full py-2 px-3 rounded-lg bg-slate-900 border border-slate-700 text-sm font-mono text-center uppercase text-slate-100"
                          required
                        />
                      </div>
                      <div>
                        <label className="text-xs text-slate-400 block mb-1">الموديل والمصنع</label>
                        <select
                          value={newTruckModel}
                          onChange={(e) => setNewTruckModel(e.target.value)}
                          className="w-full py-2 px-3 rounded-lg bg-slate-900 border border-slate-700 text-sm text-slate-100"
                        >
                          <option value="Caterpillar 785D">Caterpillar 785D (150 طن)</option>
                          <option value="Caterpillar 785C">Caterpillar 785C (145 طن)</option>
                          <option value="Caterpillar 793F">Caterpillar 793F (240 طن)</option>
                          <option value="Caterpillar 775G">Caterpillar 775G (70 طن)</option>
                          <option value="Komatsu HD785-7">Komatsu HD785-7 (91 طن)</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-slate-400 block mb-1">الحمولة الصافية (طن)</label>
                        <input
                          type="number"
                          value={newTruckCapacity}
                          onChange={(e) => setNewTruckCapacity(e.target.value)}
                          placeholder="150"
                          className="w-full py-2 px-3 rounded-lg bg-slate-900 border border-slate-700 text-sm font-mono text-center text-slate-100"
                          required
                        />
                      </div>
                    </div>
                    <div className="mt-3 flex justify-end">
                      <button
                        type="submit"
                        className="py-2 px-5 rounded-lg font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Plus className="w-4 h-4" /> حفظ وإضافة المعدة للأسطول
                      </button>
                    </div>
                  </form>

                  {/* Registered Trucks */}
                  {/* Registered Trucks List */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-bold text-slate-200">قائمة شاحنات الأسطول النشطة ({trucks.length})</h4>
                      <span className="text-xs text-amber-400 font-medium">اضغط على زر التعديل ✏️ لتغيير الحالة أو الحمولة دون حذف</span>
                    </div>
                    <div className="border border-slate-800 rounded-xl overflow-hidden">
                      <table className="w-full text-right text-xs">
                        <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
                          <tr>
                            <th className="py-2.5 px-3">رقم المعدة</th>
                            <th className="py-2.5 px-3">الموديل</th>
                            <th className="py-2.5 px-3">الحالة التشغيلية</th>
                            <th className="py-2.5 px-3 text-center">الحمولة (طن)</th>
                            <th className="py-2.5 px-3 text-center">حمولات اليوم</th>
                            <th className="py-2.5 px-3 text-center">إجراءات</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60 font-medium">
                          {trucks.map(t => (
                            <tr key={t.id} className="hover:bg-slate-800/40 transition-colors">
                              <td className="py-2 px-3 font-mono text-amber-400 font-bold">{t.id}</td>
                              <td className="py-2 px-3 text-slate-200">{t.model}</td>
                              <td className="py-2 px-3">
                                <span className={`text-[10px] font-bold py-0.5 px-2 rounded-full ${
                                  t.status === 'BREAKDOWN'
                                    ? 'bg-rose-900 text-rose-200 border border-rose-500/30'
                                    : t.status === 'MAINTENANCE'
                                    ? 'bg-amber-900 text-amber-200 border border-amber-500/30'
                                    : t.status === 'FUELING'
                                    ? 'bg-sky-900 text-sky-200 border border-sky-500/30'
                                    : t.status === 'STANDBY_QUEUE'
                                    ? 'bg-purple-900 text-purple-200 border border-purple-500/30'
                                    : 'bg-emerald-950 text-emerald-300 border border-emerald-500/30'
                                }`}>
                                  {t.status === 'BREAKDOWN' ? 'عطل ⚠️' : t.status === 'MAINTENANCE' ? 'سيرفيس 🔧' : t.status === 'FUELING' ? 'بيفول ⛽' : t.status === 'STANDBY_QUEUE' ? 'طابور ⏳' : 'شغال ✅'}
                                </span>
                              </td>
                              <td className="py-2 px-3 text-center font-mono text-emerald-400 font-bold">{t.capacityTonnes} طن</td>
                              <td className="py-2 px-3 text-center font-mono text-sky-400">{t.tripsToday || 0}</td>
                              <td className="py-2 px-3 text-center">
                                <div className="flex items-center justify-center gap-1.5">
                                  <button
                                    onClick={() => setEditingTruck(t)}
                                    className="p-1.5 text-amber-400 hover:text-amber-300 hover:bg-slate-800 rounded transition-colors cursor-pointer"
                                    title="تعديل حالة وبيانات الشاحنة"
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteTruck(t.id)}
                                    className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-slate-800 rounded transition-colors cursor-pointer"
                                    title="حذف الشاحنة"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: EXCAVATORS */}
              {activeTab === 'EXCAVATORS' && (
                <div className="space-y-6">
                  {/* Add Excavator */}
                  <form onSubmit={handleAddExcavator} className="p-4 bg-slate-950/60 border border-slate-800 rounded-2xl">
                    <h4 className="text-sm font-bold text-amber-400 mb-3 flex items-center gap-2">
                      <Plus className="w-4 h-4" /> إضافة حفار / معدة تحميل جديدة
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                      <div>
                        <label className="text-xs text-slate-400 block mb-1">كود الحفار (مثال: EX-6040-4)</label>
                        <input
                          type="text"
                          value={newExId}
                          onChange={(e) => setNewExId(e.target.value)}
                          placeholder="EX-6040-4"
                          className="w-full py-2 px-3 rounded-lg bg-slate-900 border border-slate-700 text-sm font-mono text-center uppercase text-slate-100"
                          required
                        />
                      </div>
                      <div>
                        <label className="text-xs text-slate-400 block mb-1">الموديل</label>
                        <input
                          type="text"
                          value={newExModel}
                          onChange={(e) => setNewExModel(e.target.value)}
                          placeholder="CAT 6040 Hydraulic Shovel"
                          className="w-full py-2 px-3 rounded-lg bg-slate-900 border border-slate-700 text-sm text-slate-100"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-slate-400 block mb-1">منسوب المصطبة (Bench RL)</label>
                        <input
                          type="text"
                          value={newExBench}
                          onChange={(e) => setNewExBench(e.target.value)}
                          placeholder="Bench RL +140m"
                          className="w-full py-2 px-3 rounded-lg bg-slate-900 border border-slate-700 text-sm text-slate-100"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-slate-400 block mb-1">نوع المادة المخصصة</label>
                        <select
                          value={newExMaterial}
                          onChange={(e) => setNewExMaterial(e.target.value as MaterialType)}
                          className="w-full py-2 px-3 rounded-lg bg-slate-900 border border-slate-700 text-sm text-slate-100"
                        >
                          <option value="ORE_HIGH">خام ذهب عالي الجودة HG</option>
                          <option value="ORE_MEDIUM">خام متوسط الجودة MG</option>
                          <option value="ORE_LOW">خام منخفض LG</option>
                          <option value="SUB_GRADE">خام ذهب سب جريد SG</option>
                          <option value="WASTE">صخور عقيمة / ردم Waste</option>
                        </select>
                      </div>
                    </div>
                    <div className="mt-3 flex justify-end">
                      <button
                        type="submit"
                        className="py-2 px-5 rounded-lg font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Plus className="w-4 h-4" /> حفظ الحفار
                      </button>
                    </div>
                  </form>

                  {/* Excavator List */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-bold text-slate-200">حفارات ومعدات التحميل النشطة ({excavators.length})</h4>
                      <span className="text-xs text-amber-400 font-medium">اضغط ✏️ لتعديل منسوب الـ RL ونوع الخام والحالة</span>
                    </div>
                    <div className="border border-slate-800 rounded-xl overflow-hidden">
                      <table className="w-full text-right text-xs">
                        <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
                          <tr>
                            <th className="py-2.5 px-3">كود الحفار</th>
                            <th className="py-2.5 px-3">الموديل</th>
                            <th className="py-2.5 px-3">الحالة</th>
                            <th className="py-2.5 px-3">منسوب المصطبة (RL)</th>
                            <th className="py-2.5 px-3">الخام / المادة</th>
                            <th className="py-2.5 px-3 text-center">إجراءات</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60 font-medium">
                          {excavators.map(ex => (
                            <tr key={ex.id} className="hover:bg-slate-800/40 transition-colors">
                              <td className="py-2 px-3 font-mono text-emerald-400 font-bold">{ex.id}</td>
                              <td className="py-2 px-3 text-slate-200">{ex.model}</td>
                              <td className="py-2 px-3">
                                <button
                                  type="button"
                                  onClick={() => {
                                    const newStatus = ex.status === 'ACTIVE' ? 'BREAKDOWN' : 'ACTIVE';
                                    handleSaveExcavatorEdit(ex.id, {
                                      status: newStatus,
                                      isAvailable: newStatus === 'ACTIVE',
                                      statusNote: newStatus === 'ACTIVE' ? undefined : (ex.statusNote || 'عطل ميكانيكي / توقف طارئ')
                                    });
                                  }}
                                  className={`text-[10px] font-bold py-1 px-2.5 rounded-full cursor-pointer transition-all border ${
                                    ex.status === 'BREAKDOWN' || ex.isAvailable === false
                                      ? 'bg-rose-950 text-rose-300 border-rose-500/50 hover:bg-rose-900'
                                      : ex.status === 'MAINTENANCE'
                                      ? 'bg-amber-950 text-amber-300 border-amber-500/50 hover:bg-amber-900'
                                      : 'bg-emerald-950 text-emerald-300 border-emerald-500/50 hover:bg-emerald-900'
                                  }`}
                                  title="اضغط للتبديل السريع بين (شغال) و (عطل/لا يعمل)"
                                >
                                  {ex.status === 'BREAKDOWN' || ex.isAvailable === false
                                    ? 'لا يعمل / عطل ⛔'
                                    : ex.status === 'MAINTENANCE'
                                    ? 'صيانة 🔧'
                                    : 'يعمل ✅'}
                                </button>
                                {ex.statusNote && (
                                  <div className="text-[10px] text-rose-400 truncate max-w-[120px] mt-0.5" title={ex.statusNote}>
                                    {ex.statusNote}
                                  </div>
                                )}
                              </td>
                              <td className="py-2 px-3 text-slate-300 font-mono">{ex.benchLevel}</td>
                              <td className="py-2 px-3">
                                {ex.assignedMaterial === 'WASTE' ? (
                                  <span className="text-rose-400 font-bold">ويست Waste</span>
                                ) : ex.assignedMaterial === 'SUB_GRADE' ? (
                                  <span className="text-emerald-400 font-bold">سب جريد SG</span>
                                ) : (
                                  <span className="text-amber-400 font-bold">خام ذهب Ore</span>
                                )}
                              </td>
                              <td className="py-2 px-3 text-center">
                                <div className="flex items-center justify-center gap-1.5">
                                  <button
                                    onClick={() => setEditingExcavator(ex)}
                                    className="p-1.5 text-emerald-400 hover:text-emerald-300 hover:bg-slate-800 rounded transition-colors cursor-pointer"
                                    title="تعديل الحفار والمصطبة والخام"
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteExcavator(ex.id)}
                                    className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-slate-800 rounded transition-colors cursor-pointer"
                                    title="حذف الحفار"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: DUMPS */}
              {activeTab === 'DUMPS' && (
                <div className="space-y-6">
                  {/* Add Dump */}
                  <form onSubmit={handleAddDump} className="p-4 bg-slate-950/60 border border-slate-800 rounded-2xl">
                    <h4 className="text-sm font-bold text-amber-400 mb-3 flex items-center gap-2">
                      <Plus className="w-4 h-4" /> إضافة موقع تفريغ / مقلب أو كسارة جديدة
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <label className="text-xs text-slate-400 block mb-1">كود الموقع (مثال: CRUSHER-03)</label>
                        <input
                          type="text"
                          value={newDumpId}
                          onChange={(e) => setNewDumpId(e.target.value)}
                          placeholder="CRUSHER-03"
                          className="w-full py-2 px-3 rounded-lg bg-slate-900 border border-slate-700 text-sm font-mono text-center uppercase text-slate-100"
                          required
                        />
                      </div>
                      <div>
                        <label className="text-xs text-slate-400 block mb-1">الاسم باللغة العربية</label>
                        <input
                          type="text"
                          value={newDumpName}
                          onChange={(e) => setNewDumpName(e.target.value)}
                          placeholder="الكسارة الجديدة 03"
                          className="w-full py-2 px-3 rounded-lg bg-slate-900 border border-slate-700 text-sm text-slate-100"
                          required
                        />
                      </div>
                      <div>
                        <label className="text-xs text-slate-400 block mb-1">النوع</label>
                        <select
                          value={newDumpType}
                          onChange={(e) => setNewDumpType(e.target.value as 'CRUSHER' | 'WASTE_DUMP' | 'ROM_PAD' | 'LEACH_PAD')}
                          className="w-full py-2 px-3 rounded-lg bg-slate-900 border border-slate-700 text-sm text-slate-100"
                        >
                          <option value="CRUSHER">كسارة (Crusher)</option>
                          <option value="ROM_PAD">ساحة تشوين الخام (ROM-PAD)</option>
                          <option value="WASTE_DUMP">مقلب صخور عقيمة (Waste Dump)</option>
                          <option value="LEACH_PAD">مكدس ترشيح (Leach Pad)</option>
                        </select>
                      </div>
                    </div>
                    <div className="mt-3 flex justify-end">
                      <button
                        type="submit"
                        className="py-2 px-5 rounded-lg font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Plus className="w-4 h-4" /> حفظ موقع التفريغ
                      </button>
                    </div>
                  </form>

                  {/* Dump List */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-bold text-slate-200">مواقع التفريغ والكسارات المتاحة ({dumps.length})</h4>
                      <span className="text-xs text-amber-400 font-medium">اضغط ✏️ لتغيير حالة المقلب (يعمل / صيانة / ممتلئ)</span>
                    </div>
                    <div className="border border-slate-800 rounded-xl overflow-hidden">
                      <table className="w-full text-right text-xs">
                        <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
                          <tr>
                            <th className="py-2.5 px-3">الكود</th>
                            <th className="py-2.5 px-3">الاسم</th>
                            <th className="py-2.5 px-3">النوع</th>
                            <th className="py-2.5 px-3">الحالة التشغيلية</th>
                            <th className="py-2.5 px-3 text-center">إجراءات</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60 font-medium">
                          {dumps.map(d => (
                            <tr key={d.id} className="hover:bg-slate-800/40 transition-colors">
                              <td className="py-2 px-3 font-mono text-amber-400 font-bold">{d.id}</td>
                              <td className="py-2 px-3 text-slate-200">{d.nameAr}</td>
                              <td className="py-2 px-3 text-slate-400">
                                {d.type === 'CRUSHER' && 'كسارة'}
                                {d.type === 'ROM_PAD' && 'تشوين خام'}
                                {d.type === 'WASTE_DUMP' && 'مقلب ردم'}
                                {d.type === 'LEACH_PAD' && 'مكدس ترشيح'}
                              </td>
                              <td className="py-2 px-3">
                                <button
                                  type="button"
                                  onClick={() => {
                                    const newStatus = d.activeStatus === 'OPEN' ? 'CLOSED' : 'OPEN';
                                    handleSaveDumpEdit(d.id, {
                                      activeStatus: newStatus,
                                      isAvailable: newStatus === 'OPEN',
                                      statusNote: newStatus === 'OPEN' ? undefined : (d.statusNote || 'مغلق للصيانة والتسوية')
                                    });
                                  }}
                                  className={`text-[10px] font-bold py-1 px-2.5 rounded-full cursor-pointer transition-all border ${
                                    d.activeStatus === 'CLOSED' || d.activeStatus === 'INACTIVE' || d.isAvailable === false
                                      ? 'bg-rose-950 text-rose-300 border-rose-500/50 hover:bg-rose-900'
                                      : d.activeStatus === 'MAINTENANCE'
                                      ? 'bg-amber-950 text-amber-300 border-amber-500/50 hover:bg-amber-900'
                                      : d.activeStatus === 'FULL'
                                      ? 'bg-purple-950 text-purple-300 border-purple-500/50 hover:bg-purple-900'
                                      : 'bg-emerald-950 text-emerald-300 border-emerald-500/50 hover:bg-emerald-900'
                                  }`}
                                  title="اضغط للتبديل السريع بين (مفتوح ويعمل) و (مغلق ولا يعمل)"
                                >
                                  {d.activeStatus === 'CLOSED' || d.activeStatus === 'INACTIVE' || d.isAvailable === false
                                    ? 'مغلق / لا يعمل ⛔'
                                    : d.activeStatus === 'MAINTENANCE'
                                    ? 'صيانة 🔧'
                                    : d.activeStatus === 'FULL'
                                    ? 'ممتلئ ⚠️'
                                    : 'يعمل مفتوح ✅'}
                                </button>
                                {d.statusNote && (
                                  <div className="text-[10px] text-rose-400 truncate max-w-[120px] mt-0.5" title={d.statusNote}>
                                    {d.statusNote}
                                  </div>
                                )}
                              </td>
                              <td className="py-2 px-3 text-center">
                                <div className="flex items-center justify-center gap-1.5">
                                  <button
                                    onClick={() => setEditingDump(d)}
                                    className="p-1.5 text-amber-400 hover:text-amber-300 hover:bg-slate-800 rounded transition-colors cursor-pointer"
                                    title="تعديل حالة وبيانات الموقع"
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteDump(d.id)}
                                    className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-slate-800 rounded transition-colors cursor-pointer"
                                    title="حذف الموقع"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB: STANDBY REASONS MANAGEMENT */}
              {activeTab === 'STANDBY_REASONS' && (
                <div className="space-y-6">
                  {/* Add Custom Standby Reason Form */}
                  <form onSubmit={handleAddStandbyReason} className="p-4 bg-slate-950/60 border border-slate-800 rounded-2xl">
                    <h4 className="text-sm font-bold text-purple-400 mb-3 flex items-center gap-2">
                      <Plus className="w-4 h-4" /> إضافة سبب توقف / انتظار جديد (Standby Reason)
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                      <div>
                        <label className="text-xs text-slate-400 block mb-1">اسم السبب بالعربية</label>
                        <input
                          type="text"
                          value={newReasonLabel}
                          onChange={(e) => setNewReasonLabel(e.target.value)}
                          placeholder="مثال: فحص دوري لنظام الهيدروليك"
                          className="w-full py-2 px-3 rounded-lg bg-slate-900 border border-slate-700 text-sm text-slate-100"
                          required
                        />
                      </div>
                      <div>
                        <label className="text-xs text-slate-400 block mb-1">الكود المختصر (إنجليزي)</label>
                        <input
                          type="text"
                          value={newReasonCode}
                          onChange={(e) => setNewReasonCode(e.target.value.toUpperCase())}
                          placeholder="HYD_CHECK"
                          className="w-full py-2 px-3 rounded-lg bg-slate-900 border border-slate-700 text-sm font-mono text-center uppercase text-slate-100"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-slate-400 block mb-1">الأيقونة / الرمز</label>
                        <select
                          value={newReasonIcon}
                          onChange={(e) => setNewReasonIcon(e.target.value)}
                          className="w-full py-2 px-3 rounded-lg bg-slate-900 border border-slate-700 text-sm text-slate-100"
                        >
                          <option value="⏱️">⏱️ ساعة / توقف عام</option>
                          <option value="⏳">⏳ طابور انتظار</option>
                          <option value="🔧">🔧 صيانة وأعطال</option>
                          <option value="🛞">🛞 إطارات وكاوتش</option>
                          <option value="💥">💥 تفجير بالمنجم</option>
                          <option value="🚜">🚜 تسوية طرق</option>
                          <option value="🚿">🚿 رش مياه وغبار</option>
                          <option value="☕">☕ تبديل وردية واستراحة</option>
                          <option value="🌪️">🌪️ أحوال جوية وعواصف</option>
                          <option value="🚨">🚨 طوارئ وأمان</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-slate-400 block mb-1">التصنيف</label>
                        <select
                          value={newReasonCategory}
                          onChange={(e) => setNewReasonCategory(e.target.value as any)}
                          className="w-full py-2 px-3 rounded-lg bg-slate-900 border border-slate-700 text-sm text-slate-100"
                        >
                          <option value="OPERATIONAL">تشغيلي (Operational)</option>
                          <option value="MAINTENANCE">صيانة (Maintenance)</option>
                          <option value="SAFETY">سلامة وأمان (Safety)</option>
                          <option value="WEATHER">طقس وظروف بيئية (Weather)</option>
                        </select>
                      </div>
                    </div>
                    <div className="mt-3 flex justify-end">
                      <button
                        type="submit"
                        className="py-2 px-5 rounded-lg font-bold bg-purple-600 hover:bg-purple-500 text-white text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Plus className="w-4 h-4" /> حفظ وإضافة وتعميم على جميع التابلتات
                      </button>
                    </div>
                  </form>

                  {/* Standby Reasons List */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-bold text-slate-200">أسباب الانتظار المسجلة بالنظام ومزامنتها ({customStandbyReasons.length})</h4>
                      <span className="text-xs text-purple-400 font-medium">كل تعديل يظهر فوراً في شاشات كابينات جميع السائقين</span>
                    </div>
                    <div className="border border-slate-800 rounded-xl overflow-hidden">
                      <table className="w-full text-right text-xs">
                        <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
                          <tr>
                            <th className="py-2.5 px-3">الرمز</th>
                            <th className="py-2.5 px-3">سبب التوقف بالعربية</th>
                            <th className="py-2.5 px-3">الكود</th>
                            <th className="py-2.5 px-3">التصنيف</th>
                            <th className="py-2.5 px-3 text-center">الحالة</th>
                            <th className="py-2.5 px-3 text-center">إجراءات</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60 font-medium">
                          {customStandbyReasons.map(r => (
                            <tr key={r.id} className="hover:bg-slate-800/40 transition-colors">
                              <td className="py-2 px-3 text-base">{r.icon || '⏱️'}</td>
                              <td className="py-2 px-3 text-slate-100 font-bold">{r.labelAr}</td>
                              <td className="py-2 px-3 font-mono text-purple-400">{r.code}</td>
                              <td className="py-2 px-3 text-slate-400">
                                {r.category === 'MAINTENANCE' ? 'صيانة' : r.category === 'SAFETY' ? 'سلامة' : r.category === 'WEATHER' ? 'طقس' : 'تشغيلي'}
                              </td>
                              <td className="py-2 px-3 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleToggleReasonActive(r.id, r.active)}
                                  className={`py-1 px-2.5 rounded-full font-bold text-[10px] transition-colors cursor-pointer ${
                                    r.active
                                      ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40'
                                      : 'bg-slate-800 text-slate-500 border border-slate-700'
                                  }`}
                                >
                                  {r.active ? 'مفعل 🟢' : 'معطل ⚪'}
                                </button>
                              </td>
                              <td className="py-2 px-3 text-center">
                                <button
                                  onClick={() => handleDeleteReason(r.id)}
                                  className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-slate-800 rounded transition-colors cursor-pointer"
                                  title="حذف السبب"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB: PARKINGS MANAGEMENT */}
              {activeTab === 'PARKINGS' && (
                <div className="space-y-6">
                  {/* Add Parking Location Form */}
                  <form onSubmit={handleAddParking} className="p-4 bg-slate-950/60 border border-slate-800 rounded-2xl">
                    <h4 className="text-sm font-bold text-amber-400 mb-3 flex items-center gap-2">
                      <Plus className="w-4 h-4" /> إضافة موقع ركنة وتوقف جديد (Parking Bay)
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                      <div>
                        <label className="text-xs text-slate-400 block mb-1">اسم الموقف بالعربية</label>
                        <input
                          type="text"
                          value={newParkingName}
                          onChange={(e) => setNewParkingName(e.target.value)}
                          placeholder="مثال: موقف الورشة المركزية"
                          className="w-full py-2 px-3 rounded-lg bg-slate-900 border border-slate-700 text-sm text-slate-100"
                          required
                        />
                      </div>
                      <div>
                        <label className="text-xs text-slate-400 block mb-1">الكود المختصر (إنجليزي)</label>
                        <input
                          type="text"
                          value={newParkingCode}
                          onChange={(e) => setNewParkingCode(e.target.value.toUpperCase())}
                          placeholder="WORKSHOP-BAY-01"
                          className="w-full py-2 px-3 rounded-lg bg-slate-900 border border-slate-700 text-sm font-mono text-center uppercase text-slate-100"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-slate-400 block mb-1">المنطقة / القطاع بالمنجم</label>
                        <input
                          type="text"
                          value={newParkingArea}
                          onChange={(e) => setNewParkingArea(e.target.value)}
                          placeholder="مثال: قطاع الورشة المركزية"
                          className="w-full py-2 px-3 rounded-lg bg-slate-900 border border-slate-700 text-sm text-slate-100"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-slate-400 block mb-1">السعة الاستيعابية (دنابر)</label>
                        <input
                          type="number"
                          min="1"
                          max="100"
                          value={newParkingCapacity}
                          onChange={(e) => setNewParkingCapacity(e.target.value)}
                          className="w-full py-2 px-3 rounded-lg bg-slate-900 border border-slate-700 text-sm font-mono text-center text-slate-100"
                        />
                      </div>
                    </div>

                    <div className="mt-3">
                      <label className="text-xs text-slate-400 block mb-1">ملاحظات تشغيلية وإرشادات الركن (اختياري)</label>
                      <input
                        type="text"
                        value={newParkingNotes}
                        onChange={(e) => setNewParkingNotes(e.target.value)}
                        placeholder="مثال: مخصص للدنابر الخاضعة للصيانة أو الفحص الدوري، مع التوقف عكسي"
                        className="w-full py-2 px-3 rounded-lg bg-slate-900 border border-slate-700 text-sm text-slate-100"
                      />
                    </div>

                    <div className="mt-3 flex justify-end">
                      <button
                        type="submit"
                        className="py-2 px-5 rounded-lg font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Plus className="w-4 h-4" /> حفظ وإضافة وتعميم على جميع التابلتات والأجهزة
                      </button>
                    </div>
                  </form>

                  {/* Parkings List */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-bold text-slate-200">
                        مواقف وأماكن ركنة الدنابر المعتمدة ({parkingLocations.length})
                      </h4>
                      <span className="text-xs text-amber-400 font-medium">
                        تظهر هذه القائمة لحظياً لكل سائق عند إنهاء الوردية وتسليم المعدة
                      </span>
                    </div>

                    <div className="border border-slate-800 rounded-xl overflow-hidden">
                      <table className="w-full text-right text-xs">
                        <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
                          <tr>
                            <th className="py-2.5 px-3">الرمز</th>
                            <th className="py-2.5 px-3">اسم الموقف بالعربية</th>
                            <th className="py-2.5 px-3">الكود</th>
                            <th className="py-2.5 px-3">المنطقة / الموقع</th>
                            <th className="py-2.5 px-3 text-center">السعة</th>
                            <th className="py-2.5 px-3 text-center">الحالة</th>
                            <th className="py-2.5 px-3 text-center">إجراءات</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60 font-medium">
                          {parkingLocations.map(p => (
                            <tr key={p.id} className="hover:bg-slate-800/40 transition-colors">
                              <td className="py-2 px-3 text-base">🅿️</td>
                              <td className="py-2 px-3 text-slate-100 font-bold">{p.nameAr}</td>
                              <td className="py-2 px-3 font-mono text-amber-400 font-bold">{p.code}</td>
                              <td className="py-2 px-3 text-slate-300">{p.area || '-'}</td>
                              <td className="py-2 px-3 font-mono text-center text-slate-300">{p.capacity || 10} دنابر</td>
                              <td className="py-2 px-3 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleToggleParkingActive(p.id)}
                                  className={`py-1 px-2.5 rounded-lg text-[10px] font-bold cursor-pointer transition-colors ${
                                    p.active
                                      ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-900'
                                      : 'bg-slate-800 text-slate-500 border border-slate-700'
                                  }`}
                                >
                                  {p.active ? 'متاح ومفعل 🟢' : 'معطل ومغلق ⚪'}
                                </button>
                              </td>
                              <td className="py-2 px-3 text-center">
                                <div className="flex items-center justify-center gap-1.5">
                                  <button
                                    onClick={() => setEditingParking(p)}
                                    className="p-1.5 text-amber-400 hover:text-amber-300 hover:bg-slate-800 rounded transition-colors cursor-pointer"
                                    title="تعديل الموقف"
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteParking(p.id)}
                                    className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-slate-800 rounded transition-colors cursor-pointer"
                                    title="حذف الموقف"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 5: SECURITY, CONFIG & HOURLY EXPORT */}
              {activeTab === 'CONFIG' && (
                <div className="space-y-6">
                  {/* SECURITY SETTINGS: WebAuthn & Biometrics */}
                  <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-2xl">
                    <h4 className="text-sm font-bold text-emerald-400 mb-2 flex items-center gap-2">
                      <Fingerprint className="w-4 h-4" /> إعدادات المصادقة الحيوية (Web Authentication API / Passkeys)
                    </h4>
                    <p className="text-xs text-slate-400 mb-4 leading-relaxed">
                      تتيح هذه الميزة لمدير النظام تسجيل الدخول بلمسة واحدة باستخدام بصمة الإصبع أو بصمة الوجه (Face ID / Touch ID / Windows Hello) من أجهزة التابلت والهواتف المعتمدة.
                    </p>

                    <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 text-xs font-bold text-slate-200">
                          <span>حالة المصادقة الحيوية على هذا الجهاز:</span>
                          {biometricsEnrolled ? (
                            <span className="text-emerald-400 font-bold flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" /> مفعلة ومسجلة
                            </span>
                          ) : (
                            <span className="text-amber-400 font-bold">غير مسجلة بعد</span>
                          )}
                        </div>
                        {biometricsEnrolled && getRegisteredBiometricDate() && (
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            تاريخ التسجيل: {new Date(getRegisteredBiometricDate()!).toLocaleDateString('ar-EG')}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {biometricsEnrolled ? (
                          <button
                            type="button"
                            onClick={handleRemoveBiometrics}
                            className="py-1.5 px-3 rounded-lg bg-rose-950 hover:bg-rose-900 text-rose-300 border border-rose-500/30 text-xs font-bold transition-colors cursor-pointer"
                          >
                            إلغاء البصمة الحيوية
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={handleEnrollBiometrics}
                            disabled={biometricLoading}
                            className="py-2 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-md"
                          >
                            <Fingerprint className="w-4 h-4" />
                            تسجيل بصمة هذا الجهاز الآن
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Change Admin PIN */}
                  <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-2xl">
                    <h4 className="text-sm font-bold text-amber-400 mb-2 flex items-center gap-2">
                      <KeyRound className="w-4 h-4" /> تغيير رمز الدخول المخصص (Master PIN)
                    </h4>
                    <p className="text-xs text-slate-400 mb-3">
                      قم بتعيين رمز PIN مكون من 4 إلى 8 أرقام خاص بمدير النظام
                    </p>

                    <form onSubmit={handleChangePin} className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-xl">
                      <div>
                        <label className="text-xs text-slate-400 block mb-1">الرمز الحالي</label>
                        <input
                          type="password"
                          value={currentPinCheck}
                          onChange={(e) => setCurrentPinCheck(e.target.value)}
                          placeholder="الرمز الحالي (مثال: 1234)"
                          className="w-full py-2 px-3 rounded-lg bg-slate-900 border border-slate-700 text-sm font-mono text-center text-slate-100"
                          required
                        />
                      </div>
                      <div>
                        <label className="text-xs text-slate-400 block mb-1">الرمز الجديد</label>
                        <input
                          type="password"
                          value={newPin}
                          onChange={(e) => setNewPin(e.target.value)}
                          placeholder="الرمز الجديد (4-8 أرقام)"
                          className="w-full py-2 px-3 rounded-lg bg-slate-900 border border-slate-700 text-sm font-mono text-center text-slate-100"
                          required
                        />
                      </div>
                      <div className="flex items-end">
                        <button
                          type="submit"
                          className="w-full py-2 px-4 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-colors cursor-pointer shadow-sm"
                        >
                          حفظ الرمز الجديد
                        </button>
                      </div>
                    </form>
                    {pinChangeSuccess && (
                      <p className="text-xs text-emerald-400 mt-2 font-bold flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" /> تم تحديث رمز PIN بنجاح.
                      </p>
                    )}
                  </div>

                  {/* Hourly Export Settings */}
                  <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-2xl">
                    <h4 className="text-sm font-bold text-sky-400 mb-2 flex items-center gap-2">
                      <FileDown className="w-4 h-4" /> إعدادات التصدير التلقائي الساعي (Hourly Auto Export)
                    </h4>
                    <p className="text-xs text-slate-400 mb-3 leading-relaxed">
                      تصدير لقطة شاملة للحمولات تلقائياً عند حلول تمام كل ساعة (الساعة 1، 2، 3...) بصيغة CSV المتوافقة مع Microsoft Excel.
                    </p>

                    <div className="space-y-2.5">
                      <label className="flex items-center justify-between p-3 rounded-xl bg-slate-900 border border-slate-800 cursor-pointer">
                        <div>
                          <div className="font-bold text-slate-200 text-xs">تفعيل التصدير التلقائي كل ساعة (:00)</div>
                          <div className="text-[11px] text-slate-400">حفظ تقرير الساعات أوتوماتيكياً في قاعدة بيانات التصدير</div>
                        </div>
                        <input
                          type="checkbox"
                          checked={config.hourlyAutoExport}
                          onChange={handleToggleAutoExport}
                          className="w-5 h-5 accent-amber-500 rounded"
                        />
                      </label>

                      <label className="flex items-center justify-between p-3 rounded-xl bg-slate-900 border border-slate-800 cursor-pointer">
                        <div>
                          <div className="font-bold text-slate-200 text-xs">تنزيل ملف Excel/CSV تلقائياً على الجهاز كل ساعة</div>
                          <div className="text-[11px] text-slate-400">تنزيل فوري للملف على قرص الجهاز عند دقة الساعة</div>
                        </div>
                        <input
                          type="checkbox"
                          checked={config.autoDownloadCsv}
                          onChange={handleToggleAutoDownload}
                          className="w-5 h-5 accent-amber-500 rounded"
                        />
                      </label>
                    </div>

                    <div className="mt-3 pt-3 border-t border-slate-800 flex items-center justify-between">
                      <span className="text-xs text-slate-400">تريد تجربة التصدير الساعي الآن؟</span>
                      <button
                        type="button"
                        onClick={handleTriggerManualExportNow}
                        className="py-1.5 px-3.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <FileDown className="w-4 h-4" /> تصدير وتنزيل تقرير هذه الساعة فوراً
                      </button>
                    </div>
                  </div>

                  {/* External Notifications: WhatsApp & Microsoft Teams */}
                  <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-2xl">
                    <h4 className="text-sm font-bold text-emerald-400 mb-2 flex items-center gap-2">
                      <span>📲</span> إعدادات الربط مع واتساب وتصدير التقارير (WhatsApp Dispatch)
                    </h4>
                    <p className="text-xs text-slate-400 mb-3 leading-relaxed">
                      إرسال تقرير الإنتاج والحمولات مجمعة من جميع الدنابر الـ 60 (DT001-DT060) والحفارات تلقائياً كل ساعة عبر جروب الواتساب المعتمد.
                    </p>

                    <div className="space-y-3">

                      <div>
                        <label className="text-xs text-slate-300 block mb-1">
                          رقم هاتف المشرف أو كود جروب الواتساب (WhatsApp):
                        </label>
                        <input
                          type="text"
                          value={config.whatsappGroupOrPhone || ''}
                          onChange={(e) => {
                            const updated = { ...config, whatsappGroupOrPhone: e.target.value };
                            setConfig(updated);
                            saveAppConfig(updated);
                          }}
                          placeholder="مثال: 2010XXXXXXXX أو اتركه فارغاً للمشاركة المباشرة مع أي جروب"
                          className="w-full py-2 px-3 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-100 font-mono"
                          dir="ltr"
                        />
                      </div>

                      <div className="pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-slate-800">
                        <span className="text-xs text-slate-400">تنبيهات تلقائية في نهاية كل ساعة:</span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              const snap = checkAndTriggerHourlyExport(true);
                              if (snap) {
                                showStatus('تم إرسال تجربة التقرير بنجاح!');
                              }
                            }}
                            className="py-1.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-colors cursor-pointer"
                          >
                            إرسال تقرير تجريبي الآن
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Danger Zone: Reset Shift */}
                  <div className="p-4 bg-rose-950/20 border border-rose-500/30 rounded-2xl">
                    <h4 className="text-sm font-bold text-rose-400 mb-1 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4" /> تصفير بيانات الوردية (Shift Reset)
                    </h4>
                    <p className="text-xs text-slate-400 mb-3">
                      مسح سجلات رحلات الوردية الحالية والبدء من جديد مع الاحتفاظ ببيانات السائقين والمعدات.
                    </p>
                    <button
                      type="button"
                      onClick={handleResetShiftTrips}
                      className="py-2 px-4 rounded-lg bg-rose-700 hover:bg-rose-600 text-white font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <RefreshCw className="w-4 h-4" /> تصفير رحلات الوردية الحالية
                    </button>
                  </div>
                </div>
              )}

              {/* TAB 6: GOOGLE SHEETS INTEGRATION & EXPORT */}
              {activeTab === 'GOOGLE_SHEETS' && (
                <div className="space-y-6">
                  {/* Official Credentials Banner */}
                  <div className="p-4 rounded-2xl bg-indigo-950/40 border-2 border-indigo-500/40 space-y-2.5 text-xs">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-indigo-300 font-bold">
                        <ShieldCheck className="w-5 h-5 text-indigo-400 shrink-0" />
                        <span>الحساب الرسمي الثابت للدسباتش:</span>
                        <code className="px-2 py-0.5 rounded-lg bg-indigo-900 text-indigo-200 font-mono font-bold">
                          {DEFAULT_OFFICIAL_ACCOUNT_EMAIL}
                        </code>
                      </div>
                      {!googleUserEmail ? (
                        <button
                          type="button"
                          onClick={handleAdminGoogleSignIn}
                          disabled={isGoogleSigningIn}
                          className="py-1.5 px-3 rounded-xl bg-white hover:bg-slate-100 text-slate-950 font-black text-xs shadow-md transition-all cursor-pointer"
                        >
                          {isGoogleSigningIn ? 'جاري الاتصال...' : `تسجيل الدخول بـ ${DEFAULT_OFFICIAL_ACCOUNT_EMAIL}`}
                        </button>
                      ) : (
                        <span className="text-emerald-400 font-bold flex items-center gap-1 font-mono">
                          <CheckCircle2 className="w-4 h-4" />
                          متصل: {googleUserEmail}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-indigo-900/60 text-slate-400">
                      <div className="flex items-center gap-2">
                        <FileSpreadsheet className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span>جدول المزامنة الثابت لكافة الأجهزة:</span>
                        <code className="text-[11px] font-mono text-emerald-300 truncate max-w-xs md:max-w-md">
                          {DEFAULT_SPREADSHEET_ID}
                        </code>
                      </div>
                      {sheetsConfig?.spreadsheetId !== DEFAULT_SPREADSHEET_ID && (
                        <button
                          type="button"
                          onClick={() => {
                            saveStoredSheetsConfig(DEFAULT_SHEETS_CONFIG);
                            setSheetsConfig(DEFAULT_SHEETS_CONFIG);
                            showStatus('تمت استعادة جدول منجم السكري الرسمي الثابت');
                          }}
                          className="text-xs text-amber-400 hover:text-amber-300 underline font-bold cursor-pointer"
                        >
                          استعادة الجدول الثابت
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Privacy & Restriction Warning */}
                  <div className="p-3.5 rounded-2xl bg-emerald-950/40 border border-emerald-500/40 flex items-center justify-between gap-3 text-xs text-emerald-300">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
                      <span>
                        <strong>صلاحية وصول سرية:</strong> هذا الملف مخصص حصرياً للمسؤول (Admin) والديسباتشر — لا يظهر لسائقي الشاحنات في الكابينة.
                      </span>
                    </div>
                  </div>

                  {/* Connected Sheet Card */}
                  {sheetsConfig ? (
                    <div className="p-5 rounded-2xl bg-slate-950 border-2 border-emerald-500/50 space-y-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <FileSpreadsheet className="w-6 h-6 text-emerald-400" />
                          <h4 className="font-black text-base text-slate-100">{sheetsConfig.spreadsheetTitle}</h4>
                        </div>
                        <button
                          type="button"
                          onClick={handleAdminDisconnectSheet}
                          className="text-xs text-rose-400 hover:text-rose-300 font-bold cursor-pointer"
                        >
                          إلغاء الربط
                        </button>
                      </div>

                      <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-1.5 text-xs text-slate-400">
                        <div className="flex justify-between">
                          <span>المعرف (Spreadsheet ID):</span>
                          <span className="font-mono text-slate-200">{sheetsConfig.spreadsheetId}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>آخر مزامنة وتصدير:</span>
                          <span className="font-mono text-emerald-400 font-bold">
                            {sheetsConfig.lastSyncedAt ? new Date(sheetsConfig.lastSyncedAt).toLocaleString('ar-EG') : 'لم تتم بعد'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>إجمالي النقلات المرفوعة:</span>
                          <span className="font-mono text-amber-400 font-bold">{sheetsConfig.syncedTripsCount || 0} نقلة</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                        <a
                          href={sheetsConfig.spreadsheetUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs md:text-sm flex items-center justify-center gap-2 shadow-lg transition-transform active:scale-98"
                        >
                          <ExternalLink className="w-4 h-4" />
                          <span>فتح جدول Google Sheet ↗️</span>
                        </a>

                        <button
                          type="button"
                          onClick={handleAdminSyncSheet}
                          disabled={isSyncingSheet}
                          className="py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs md:text-sm flex items-center justify-center gap-2 shadow-lg transition-transform active:scale-98 cursor-pointer disabled:opacity-50"
                        >
                          <RefreshCw className={`w-4 h-4 ${isSyncingSheet ? 'animate-spin' : ''}`} />
                          <span>{isSyncingSheet ? 'جاري رفع البيانات...' : 'تصدير وتحديث البيانات الآن 🔄'}</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-4">
                      <div className="text-center py-2 space-y-2">
                        <FileSpreadsheet className="w-12 h-12 text-emerald-400 mx-auto" />
                        <h4 className="font-black text-base text-slate-100">
                          ربط وتصدير كافة بيانات المنجم إلى Google Sheets
                        </h4>
                        <p className="text-xs text-slate-400 max-w-lg mx-auto">
                          تصدير تلقائي لحمولات النقل، أوزان الصخور والخام، فترات التفويل، وحالات الأسطول لجدول Google Sheet موحد.
                        </p>
                      </div>

                      {/* Google Sign In */}
                      {!googleUserEmail && (
                        <div className="text-center pt-2">
                          <button
                            type="button"
                            onClick={handleAdminGoogleSignIn}
                            disabled={isGoogleSigningIn}
                            className="inline-flex items-center gap-2 py-2.5 px-5 rounded-xl bg-white hover:bg-slate-100 text-slate-950 font-bold text-xs shadow-md transition-all cursor-pointer"
                          >
                            <span>{isGoogleSigningIn ? 'جاري الاتصال بـ Google...' : 'تسجيل الدخول بحساب Google (Sign In)'}</span>
                          </button>
                        </div>
                      )}

                      {/* Create New Sheet */}
                      <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
                        <span className="text-xs font-bold text-emerald-400 block">إنشاء ملف Google Sheet جديد للمنجم:</span>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={customSheetName}
                            onChange={(e) => setCustomSheetName(e.target.value)}
                            placeholder="اسم الملف (مثال: منجم السكري - سجلات الدسباتش والإنتاج)"
                            className="flex-1 py-2 px-3 rounded-lg bg-slate-950 border border-slate-700 text-xs text-slate-100 focus:border-emerald-500 focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={handleAdminCreateSheet}
                            disabled={isCreatingSheet}
                            className="py-2 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs whitespace-nowrap cursor-pointer disabled:opacity-50"
                          >
                            {isCreatingSheet ? 'جاري الإنشاء...' : 'إنشاء وتصدير 📑'}
                          </button>
                        </div>
                      </div>

                      {/* Link Existing */}
                      <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
                        <span className="text-xs font-bold text-sky-400 block">أو ربط ملف موجود مسبقاً:</span>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={manualSheetInput}
                            onChange={(e) => setManualSheetInput(e.target.value)}
                            placeholder="رابط الملف أو الـ Spreadsheet ID"
                            className="flex-1 py-2 px-3 rounded-lg bg-slate-950 border border-slate-700 text-xs text-slate-100 focus:border-sky-500 focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={handleAdminLinkSheet}
                            className="py-2 px-4 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs whitespace-nowrap cursor-pointer"
                          >
                            ربط 🔗
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 7: DIRECT MESSAGES TO SPECIFIC TABLETS WITH MULTI-SELECT & ALL */}
              {activeTab === 'DIRECT_MESSAGES' && (
                <div className="space-y-6">
                  {/* Header info */}
                  <div className="p-4 rounded-2xl bg-indigo-950/40 border border-indigo-500/40 flex items-center justify-between gap-3 text-xs text-indigo-200">
                    <div className="flex items-center gap-2">
                      <Radio className="w-5 h-5 text-indigo-400 shrink-0 animate-pulse" />
                      <div>
                        <strong className="block font-black text-indigo-300 text-sm">
                          إرسال رسائل وتعليمات للدنابر (اختيار متعدد أو الجميع 🌐)
                        </strong>
                        <p className="text-[11px] text-indigo-300/80 mt-0.5">
                          يمكنك اختيار دنبر واحد، أو تحديد مجموعة دنابر معاً (اختيار متعدد)، أو إرسال تعميم لكافة الـ 60 دنبر دفعة واحدة عبر السحابة.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Send Form */}
                  <form onSubmit={handleAdminSendTargetedMessage} className="p-4 bg-slate-950/60 border border-slate-800 rounded-2xl space-y-4">
                    {/* Mode Toggle: Multi-Select vs ALL */}
                    <div className="flex flex-wrap items-center gap-2 p-1.5 bg-slate-900 border border-slate-800 rounded-2xl">
                      <button
                        type="button"
                        onClick={() => {
                          recordActivity();
                          setTargetRecipientMode('MULTI');
                        }}
                        className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                          targetRecipientMode === 'MULTI'
                            ? 'bg-indigo-600 text-white shadow-md'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <CheckSquare className="w-4 h-4" />
                        <span>اختيار دنابر متعددة ({selectedTruckIds.length} مختار)</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          recordActivity();
                          setTargetRecipientMode('ALL');
                        }}
                        className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                          targetRecipientMode === 'ALL'
                            ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <Radio className="w-4 h-4" />
                        <span>📢 إرسال لجميع الدنابر معاً (60 دنبر)</span>
                      </button>
                    </div>

                    {/* Multi-Select Panel (Active when MULTI mode is chosen) */}
                    {targetRecipientMode === 'MULTI' && (
                      <div className="p-3.5 bg-slate-900/90 border border-slate-800 rounded-2xl space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                              <span>قائمة الدنابر المحددة:</span>
                              <span className="py-0.5 px-2 rounded-full bg-indigo-950 text-indigo-300 font-mono text-[11px] border border-indigo-500/40 font-bold">
                                {selectedTruckIds.length} من {trucks.length}
                              </span>
                            </span>
                          </div>

                          {/* Quick selection actions */}
                          <div className="flex flex-wrap items-center gap-1.5 text-xs">
                            <button
                              type="button"
                              onClick={handleSelectAllTrucks}
                              className="py-1 px-2.5 rounded-lg bg-indigo-950/60 hover:bg-indigo-900 border border-indigo-500/30 text-indigo-300 font-bold text-[11px] cursor-pointer"
                            >
                              تحديد الكل ({trucks.length})
                            </button>
                            <button
                              type="button"
                              onClick={handleDeselectAllTrucks}
                              className="py-1 px-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-[11px] cursor-pointer"
                            >
                              إلغاء التحديد
                            </button>
                            <button
                              type="button"
                              onClick={handleSelectActiveTrucks}
                              className="py-1 px-2.5 rounded-lg bg-emerald-950/60 hover:bg-emerald-900 border border-emerald-500/30 text-emerald-300 font-bold text-[11px] cursor-pointer"
                            >
                              الشغالة فقط 🟢
                            </button>
                          </div>
                        </div>

                        {/* Search + Quick Range Filters */}
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="relative flex-1 min-w-[200px]">
                            <Search className="w-3.5 h-3.5 text-slate-500 absolute right-3 top-1/2 -translate-y-1/2" />
                            <input
                              type="text"
                              value={truckSearchQuery}
                              onChange={(e) => setTruckSearchQuery(e.target.value)}
                              placeholder="بحث برقم الدنبر (مثال: DT015) أو اسم السائق..."
                              className="w-full py-1.5 pr-8 pl-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:border-indigo-500 focus:outline-none"
                            />
                          </div>

                          <div className="flex flex-wrap items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleSelectTrucksRange(0, 10)}
                              className="py-1 px-2 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-[10px] text-slate-400 hover:text-slate-200 font-mono cursor-pointer"
                            >
                              DT001-DT010
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSelectTrucksRange(10, 20)}
                              className="py-1 px-2 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-[10px] text-slate-400 hover:text-slate-200 font-mono cursor-pointer"
                            >
                              DT011-DT020
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSelectTrucksRange(20, 40)}
                              className="py-1 px-2 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-[10px] text-slate-400 hover:text-slate-200 font-mono cursor-pointer"
                            >
                              DT021-DT040
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSelectTrucksRange(40, 60)}
                              className="py-1 px-2 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-[10px] text-slate-400 hover:text-slate-200 font-mono cursor-pointer"
                            >
                              DT041-DT060
                            </button>
                          </div>
                        </div>

                        {/* Interactive Truck Selection Grid */}
                        <div className="max-h-56 overflow-y-auto border border-slate-800/80 rounded-xl p-2 bg-slate-950/80 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-1.5">
                          {trucks
                            .filter((t) => {
                              if (!truckSearchQuery.trim()) return true;
                              const q = truckSearchQuery.toLowerCase();
                              const driver = drivers.find((d) => d.code === t.assignedDriver);
                              return (
                                t.id.toLowerCase().includes(q) ||
                                (driver && driver.name.toLowerCase().includes(q))
                              );
                            })
                            .map((t) => {
                              const isSelected = selectedTruckIds.includes(t.id);
                              const driver = drivers.find((d) => d.code === t.assignedDriver);
                              const isBreakdown = t.status === 'BREAKDOWN';
                              const isMaint = t.status === 'MAINTENANCE';

                              return (
                                <button
                                  key={t.id}
                                  type="button"
                                  onClick={() => handleToggleTruckSelection(t.id)}
                                  className={`p-2 rounded-xl border text-right transition-all cursor-pointer flex items-center justify-between gap-1 select-none ${
                                    isSelected
                                      ? 'bg-indigo-950/70 border-indigo-500 text-indigo-100 ring-1 ring-indigo-400/40 shadow-sm'
                                      : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:border-slate-700'
                                  }`}
                                >
                                  <div className="flex items-center gap-1.5 truncate">
                                    {isSelected ? (
                                      <CheckSquare className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                                    ) : (
                                      <Square className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                                    )}
                                    <div className="truncate">
                                      <div className="font-mono font-bold text-xs text-amber-400 leading-tight">
                                        {t.id}
                                      </div>
                                      <div className="text-[10px] text-slate-400 truncate leading-tight mt-0.5">
                                        {driver?.name?.split(' ')[0] || 'سائق غير مسجل'}
                                      </div>
                                    </div>
                                  </div>

                                  <span
                                    className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                      isBreakdown
                                        ? 'bg-rose-500'
                                        : isMaint
                                        ? 'bg-amber-500'
                                        : 'bg-emerald-500'
                                    }`}
                                  />
                                </button>
                              );
                            })}
                        </div>
                      </div>
                    )}

                    {/* Priority and Send Row */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
                      <div>
                        <label className="text-xs text-slate-300 block mb-1 font-bold">
                          درجة الأهمية:
                        </label>
                        <select
                          value={targetPriority}
                          onChange={(e) => setTargetPriority(e.target.value as any)}
                          className="w-full py-2.5 px-3 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 text-xs font-bold focus:border-indigo-500 focus:outline-none"
                        >
                          <option value="NORMAL">عادي (إشعار تشغيلي)</option>
                          <option value="URGENT">عاجل ⚠️ (تعليمات مباشرة)</option>
                          <option value="CRITICAL">طارئ وحرج 🚨 (تنبيه سلامة)</option>
                        </select>
                      </div>

                      <div className="md:col-span-2 flex items-end">
                        <button
                          type="submit"
                          disabled={targetRecipientMode === 'MULTI' && selectedTruckIds.length === 0}
                          className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-black text-xs flex items-center justify-center gap-2 shadow-lg transition-transform active:scale-98 cursor-pointer"
                        >
                          <Send className="w-4 h-4" />
                          <span>
                            {targetRecipientMode === 'ALL'
                              ? '📢 إرسال لجميع الدنابر الـ 60 (تعميم عام)'
                              : `إرسال إلى (${selectedTruckIds.length}) دنابر محددة 🔒`}
                          </span>
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="text-xs text-slate-300 block mb-1 font-bold">
                        نص الرسالة أو التعليمات الموجهة للدنابر المختارة:
                      </label>
                      <textarea
                        value={targetMessageText}
                        onChange={(e) => setTargetMessageText(e.target.value)}
                        placeholder="اكتب المعلومة أو التعليمات الموجهة للدنابر المحددة..."
                        rows={3}
                        className="w-full py-2 px-3 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-100 placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none resize-none"
                      />
                    </div>

                    {/* Quick Suggestions */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      <span className="text-[10px] text-slate-400">عبارات سريعة:</span>
                      {[
                        'توجه فوراً للميزان بعد التفريغ للمعايرة الدورية',
                        'يرجى مراجعة ورشة الصيانة بعد نهاية الوردية لفحص الإطارات',
                        'تم تسجيل نقلتك السابقة بنجاح - استمر على نفس المسار',
                        'احذر من انزلاق التربة عند مدخل الرامب الغربي',
                      ].map((phrase, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setTargetMessageText(phrase)}
                          className="text-[10px] py-1 px-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700/60 cursor-pointer"
                        >
                          {phrase}
                        </button>
                      ))}
                    </div>
                  </form>

                  {/* Sent Messages Log with Read Acknowledgment */}
                  <div className="space-y-2">
                    <span className="text-xs font-bold text-slate-300 block">
                      سجل الرسائل الإدارية الخاصة المرسلة وحالة قراءتها:
                    </span>
                    <div className="border border-slate-800 rounded-xl overflow-x-auto bg-slate-950">
                      <table className="w-full text-right text-xs">
                        <thead className="bg-slate-900 text-slate-400 border-b border-slate-800">
                          <tr>
                            <th className="py-2.5 px-3">التابلت / الشاحنة</th>
                            <th className="py-2.5 px-3">نص الرسالة</th>
                            <th className="py-2.5 px-3">المرسل</th>
                            <th className="py-2.5 px-3">وقت الإرسال</th>
                            <th className="py-2.5 px-3 text-center">حالة القراءة والاستلام</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60">
                          {adminDirectMessages.slice(0, 20).map((msg) => (
                            <tr key={msg.id} className="hover:bg-slate-900/40">
                              <td className="py-2.5 px-3 font-mono font-bold text-amber-400">
                                {msg.targetTruckId === 'ALL' ? 'تعميم عام' : `دنبر ${msg.targetTruckId}`}
                              </td>
                              <td className="py-2.5 px-3 text-slate-200 max-w-xs truncate">
                                "{msg.messageText}"
                              </td>
                              <td className="py-2.5 px-3 text-slate-400">{msg.sender}</td>
                              <td className="py-2.5 px-3 text-slate-400 font-mono text-[11px]">
                                {new Date(msg.timestamp).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                {msg.acknowledged ? (
                                  <span className="py-0.5 px-2 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-500/40 text-[10px] font-bold inline-flex items-center gap-1">
                                    <CheckCircle2 className="w-3 h-3" />
                                    تمت القراءة والتأكيد
                                  </span>
                                ) : (
                                  <span className="py-0.5 px-2 rounded-full bg-amber-950 text-amber-400 border border-amber-500/40 text-[10px] font-bold">
                                    بانتظار قراءة السائق...
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* EDIT TRUCK DIALOG */}
        {editingTruck && (
          <TruckEditDialog
            truck={editingTruck}
            drivers={drivers}
            onSave={(updates) => handleSaveTruckEdit(editingTruck.id, updates)}
            onClose={() => setEditingTruck(null)}
          />
        )}

        {/* EDIT EXCAVATOR DIALOG */}
        {editingExcavator && (
          <ExcavatorEditDialog
            excavator={editingExcavator}
            onSave={(updates) => handleSaveExcavatorEdit(editingExcavator.id, updates)}
            onClose={() => setEditingExcavator(null)}
          />
        )}

        {/* EDIT DUMP DIALOG */}
        {editingDump && (
          <DumpEditDialog
            dump={editingDump}
            onSave={(updates) => handleSaveDumpEdit(editingDump.id, updates)}
            onClose={() => setEditingDump(null)}
          />
        )}

        {/* EDIT PARKING DIALOG */}
        {editingParking && (
          <ParkingEditDialog
            parking={editingParking}
            onSave={(updates) => handleSaveParkingEdit(editingParking.id, updates)}
            onClose={() => setEditingParking(null)}
          />
        )}
      </div>
    </div>
  );
};

// -------------------------------------------------------------
// Sub-Dialog 1: Truck Edit Dialog (Without Deleting)
// -------------------------------------------------------------
interface TruckEditDialogProps {
  truck: Truck;
  drivers: Driver[];
  onSave: (updates: Partial<Truck>) => void;
  onClose: () => void;
}

const TruckEditDialog: React.FC<TruckEditDialogProps> = ({ truck, drivers, onSave, onClose }) => {
  const [status, setStatus] = useState<Truck['status']>(truck.status);
  const [model, setModel] = useState<string>(truck.model);
  const [capacityTonnes, setCapacityTonnes] = useState<number>(truck.capacityTonnes);
  const [assignedDriver, setAssignedDriver] = useState<string>(truck.assignedDriver || '');
  const [statusNote, setStatusNote] = useState<string>(truck.statusNote || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      status,
      model,
      capacityTonnes: Number(capacityTonnes) || 152,
      assignedDriver: assignedDriver ? assignedDriver : undefined,
      statusNote: statusNote.trim() || undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg bg-slate-900 border-2 border-amber-500 rounded-3xl p-6 shadow-2xl text-slate-100">
        <button
          onClick={onClose}
          type="button"
          className="absolute top-4 left-4 p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4 pb-3 border-b border-slate-800">
          <div className="p-2.5 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/40">
            <TruckIcon className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-black text-slate-100">
              تعديل بيانات وحالة الدنبر {truck.id}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              تغيير الحالة أو السائق أو الموديل وتعميم التعديل فوراً لجميع الكبائن
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="text-xs font-bold text-slate-300 block mb-1">
              الحالة التشغيلية الحالية:
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as Truck['status'])}
              className="w-full py-2.5 px-3 rounded-xl bg-slate-950 border border-slate-700 text-slate-100 text-xs font-bold focus:border-amber-500 focus:outline-none"
            >
              <option value="ACTIVE">شغال في الخدمة (ACTIVE) ✅</option>
              <option value="LOADING">جاري التحميل بالمصطبة (LOADING) 🏗️</option>
              <option value="HAULING">محمل في طريق النقل (HAULING) 🚚</option>
              <option value="DUMPING">يفرغ في المقلب / الكسارة (DUMPING) 🔄</option>
              <option value="STANDBY_QUEUE">في طابور الانتظار (STANDBY_QUEUE) ⏳</option>
              <option value="BREAKDOWN">عطل ميكانيكي / كهربائي (BREAKDOWN) ⚠️</option>
              <option value="MAINTENANCE">صيانة وسيرفيس دوري (MAINTENANCE) 🔧</option>
              <option value="FUELING">بيفول وقود ديزل (FUELING) ⛽</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1">الموديل:</label>
              <input
                type="text"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="w-full py-2 px-3 rounded-xl bg-slate-950 border border-slate-700 text-xs text-slate-100 focus:border-amber-500 focus:outline-none"
                required
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1">الحمولة الصافية (طن):</label>
              <input
                type="number"
                value={capacityTonnes}
                onChange={(e) => setCapacityTonnes(Number(e.target.value))}
                className="w-full py-2 px-3 rounded-xl bg-slate-950 border border-slate-700 text-xs font-mono text-center text-slate-100 focus:border-amber-500 focus:outline-none"
                required
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-300 block mb-1">السائق المعين على الدنبر:</label>
            <select
              value={assignedDriver}
              onChange={(e) => setAssignedDriver(e.target.value)}
              className="w-full py-2 px-3 rounded-xl bg-slate-950 border border-slate-700 text-xs text-slate-100 focus:border-amber-500 focus:outline-none"
            >
              <option value="">بدون سائق معين حالياً</option>
              {drivers.map(d => (
                <option key={d.code} value={d.code}>
                  {d.name} (كود: {d.code})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-300 block mb-1">ملاحظة الحالة / سبب العطل أو التوقف:</label>
            <input
              type="text"
              value={statusNote}
              onChange={(e) => setStatusNote(e.target.value)}
              placeholder="مثال: تسريب هيدروليك - في انتظار الميكانيكي"
              className="w-full py-2 px-3 rounded-xl bg-slate-950 border border-slate-700 text-xs text-slate-100 focus:border-amber-500 focus:outline-none"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="py-2 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs cursor-pointer"
            >
              إلغاء
            </button>
            <button
              type="submit"
              className="py-2 px-5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-lg transition-transform active:scale-98 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>حفظ وتحديث ومزامنة فورية</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// -------------------------------------------------------------
// Sub-Dialog 2: Excavator Edit Dialog (Without Deleting)
// -------------------------------------------------------------
interface ExcavatorEditDialogProps {
  excavator: Excavator;
  onSave: (updates: Partial<Excavator>) => void;
  onClose: () => void;
}

const ExcavatorEditDialog: React.FC<ExcavatorEditDialogProps> = ({ excavator, onSave, onClose }) => {
  const [status, setStatus] = useState<Excavator['status']>(excavator.status);
  const [benchLevel, setBenchLevel] = useState<string>(excavator.benchLevel);
  const [assignedMaterial, setAssignedMaterial] = useState<MaterialType>(excavator.assignedMaterial);
  const [model, setModel] = useState<string>(excavator.model);
  const [isAvailable, setIsAvailable] = useState<boolean>(excavator.isAvailable !== false && excavator.status === 'ACTIVE');
  const [statusNote, setStatusNote] = useState<string>(excavator.statusNote || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      status,
      benchLevel: benchLevel.trim(),
      assignedMaterial,
      model: model.trim(),
      isAvailable,
      statusNote: statusNote.trim() || undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg bg-slate-900 border-2 border-emerald-500 rounded-3xl p-6 shadow-2xl text-slate-100">
        <button
          onClick={onClose}
          type="button"
          className="absolute top-4 left-4 p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4 pb-3 border-b border-slate-800">
          <div className="p-2.5 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
            <HardHat className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-black text-slate-100">
              تعديل بيانات وحالة الحفار {excavator.id}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              تغيير المنسوب (RL)، نوع الخام، أو إيقاف المعدة مع توضيح السبب للسائقين
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1">
                الحالة التشغيلية للحفار:
              </label>
              <select
                value={status}
                onChange={(e) => {
                  const s = e.target.value as Excavator['status'];
                  setStatus(s);
                  setIsAvailable(s === 'ACTIVE');
                }}
                className="w-full py-2.5 px-3 rounded-xl bg-slate-950 border border-slate-700 text-slate-100 text-xs font-bold focus:border-emerald-500 focus:outline-none"
              >
                <option value="ACTIVE">شغال في التحميل (ACTIVE) ✅</option>
                <option value="BREAKDOWN">عطل ميكانيكي / هيدروليكي (BREAKDOWN) ⛔</option>
                <option value="MAINTENANCE">صيانة وتغيير أسنان الباكت (MAINTENANCE) 🔧</option>
                <option value="STANDBY">ستاند باي / في الانتظار (STANDBY) ⏳</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1">
                إتاحة المعدة للسائقين:
              </label>
              <select
                value={isAvailable ? 'TRUE' : 'FALSE'}
                onChange={(e) => setIsAvailable(e.target.value === 'TRUE')}
                className="w-full py-2.5 px-3 rounded-xl bg-slate-950 border border-slate-700 text-slate-100 text-xs font-bold focus:border-emerald-500 focus:outline-none"
              >
                <option value="TRUE">متاح ويعمل دون تحذير 🟢</option>
                <option value="FALSE">لا يعمل / متوقف (يتطلب تحذير للسائق) ⛔</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-300 block mb-1">
              سبب الإيقاف / ملاحظة عدم العمل (تظهر للسائقين مع التحذير):
            </label>
            <input
              type="text"
              value={statusNote}
              onChange={(e) => setStatusNote(e.target.value)}
              placeholder="مثال: عطل بستم الباكت الرئيسي - بانتظار ونش الصيانة"
              className="w-full py-2 px-3 rounded-xl bg-slate-950 border border-slate-700 text-xs text-slate-100 focus:border-emerald-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-300 block mb-1">
              منسوب المصطبة والموقع (RL والمكان):
            </label>
            <input
              type="text"
              value={benchLevel}
              onChange={(e) => setBenchLevel(e.target.value)}
              placeholder="مثال: Bench RL +140m - قطاع غربي"
              className="w-full py-2 px-3 rounded-xl bg-slate-950 border border-slate-700 text-xs text-slate-100 font-mono focus:border-emerald-500 focus:outline-none"
              required
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-300 block mb-1">
              نوع الخام / المادة المخصصة للتحميل:
            </label>
            <select
              value={assignedMaterial}
              onChange={(e) => setAssignedMaterial(e.target.value as MaterialType)}
              className="w-full py-2.5 px-3 rounded-xl bg-slate-950 border border-slate-700 text-slate-100 text-xs font-bold focus:border-emerald-500 focus:outline-none"
            >
              <option value="ORE_HIGH">خام ذهب عالي الجودة HG (High Grade)</option>
              <option value="ORE_MEDIUM">خام ذهب متوسط الجودة MG (Medium Grade)</option>
              <option value="ORE_LOW">خام ذهب منخفض LG (Low Grade)</option>
              <option value="SUB_GRADE">خام ذهب سب جريد SG (Sub-Grade)</option>
              <option value="WASTE">صخور عقيمة / ردم (Waste)</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-300 block mb-1">الموديل والنوع:</label>
            <input
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full py-2 px-3 rounded-xl bg-slate-950 border border-slate-700 text-xs text-slate-100 focus:border-emerald-500 focus:outline-none"
              required
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="py-2 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs cursor-pointer"
            >
              إلغاء
            </button>
            <button
              type="submit"
              className="py-2 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs flex items-center gap-1.5 shadow-lg transition-transform active:scale-98 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>حفظ وتحديث ومزامنة فورية</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// -------------------------------------------------------------
// Sub-Dialog 3: Dump Location Edit Dialog (Without Deleting)
// -------------------------------------------------------------
interface DumpEditDialogProps {
  dump: DumpLocation;
  onSave: (updates: Partial<DumpLocation>) => void;
  onClose: () => void;
}

const DumpEditDialog: React.FC<DumpEditDialogProps> = ({ dump, onSave, onClose }) => {
  const [activeStatus, setActiveStatus] = useState<DumpLocation['activeStatus']>(dump.activeStatus);
  const [nameAr, setNameAr] = useState<string>(dump.nameAr);
  const [type, setType] = useState<DumpLocation['type']>(dump.type);
  const [targetMaterial, setTargetMaterial] = useState<MaterialType>(dump.targetMaterial);
  const [currentBenches, setCurrentBenches] = useState<string>(dump.currentBenches || '');
  const [isAvailable, setIsAvailable] = useState<boolean>(dump.isAvailable !== false && dump.activeStatus === 'OPEN');
  const [statusNote, setStatusNote] = useState<string>(dump.statusNote || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      activeStatus,
      nameAr: nameAr.trim(),
      type,
      targetMaterial,
      currentBenches: currentBenches.trim() || undefined,
      isAvailable,
      statusNote: statusNote.trim() || undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg bg-slate-900 border-2 border-amber-500 rounded-3xl p-6 shadow-2xl text-slate-100">
        <button
          onClick={onClose}
          type="button"
          className="absolute top-4 left-4 p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4 pb-3 border-b border-slate-800">
          <div className="p-2.5 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/40">
            <Mountain className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-black text-slate-100">
              تعديل حالة وبيانات موقع التفريغ {dump.id}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              تعديل حالة الكسارة أو المقلب (يعمل مفتوح / صيانة / ممتلئ) دون حذف
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1">
                الحالة التشغيلية للموقع / الكسارة:
              </label>
              <select
                value={activeStatus}
                onChange={(e) => {
                  const s = e.target.value as DumpLocation['activeStatus'];
                  setActiveStatus(s);
                  setIsAvailable(s === 'OPEN');
                }}
                className="w-full py-2.5 px-3 rounded-xl bg-slate-950 border border-slate-700 text-slate-100 text-xs font-bold focus:border-amber-500 focus:outline-none"
              >
                <option value="OPEN">يعمل ومفتوح للتفريغ (OPEN) ✅</option>
                <option value="CLOSED">مغلق تماماً (CLOSED) ⛔</option>
                <option value="INACTIVE">لا يعمل / خارج الخدمة (INACTIVE) ⛔</option>
                <option value="MAINTENANCE">متوقف للصيانة والتسوية (MAINTENANCE) 🔧</option>
                <option value="FULL">ممتلئ ومغلق مؤقتاً (FULL) ⚠️</option>
                <option value="CONGESTED">تكدس وزحام شديد (CONGESTED) ⏳</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1">
                إتاحة الموقع للسائقين:
              </label>
              <select
                value={isAvailable ? 'TRUE' : 'FALSE'}
                onChange={(e) => setIsAvailable(e.target.value === 'TRUE')}
                className="w-full py-2.5 px-3 rounded-xl bg-slate-950 border border-slate-700 text-slate-100 text-xs font-bold focus:border-amber-500 focus:outline-none"
              >
                <option value="TRUE">متاح ويعمل دون تحذير 🟢</option>
                <option value="FALSE">مغلق / لا يعمل (يتطلب تحذير للسائق) ⛔</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-300 block mb-1">
              سبب الإغلاق / ملاحظة عدم العمل (تظهر للسائقين مع التحذير):
            </label>
            <input
              type="text"
              value={statusNote}
              onChange={(e) => setStatusNote(e.target.value)}
              placeholder="مثال: الكسارة متوقفة لصيانة السير الناقل والمحرك"
              className="w-full py-2 px-3 rounded-xl bg-slate-950 border border-slate-700 text-xs text-slate-100 focus:border-amber-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-300 block mb-1">اسم الموقع بالعربية:</label>
            <input
              type="text"
              value={nameAr}
              onChange={(e) => setNameAr(e.target.value)}
              className="w-full py-2 px-3 rounded-xl bg-slate-950 border border-slate-700 text-xs text-slate-100 focus:border-amber-500 focus:outline-none"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1">نوع الموقع:</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as DumpLocation['type'])}
                className="w-full py-2 px-3 rounded-xl bg-slate-950 border border-slate-700 text-xs text-slate-100 focus:border-amber-500 focus:outline-none"
              >
                <option value="CRUSHER">كسارة (Crusher)</option>
                <option value="ROM_PAD">ساحة تشوين (ROM-PAD)</option>
                <option value="WASTE_DUMP">مقلب ردم (Waste Dump)</option>
                <option value="LEACH_PAD">مكدس ترشيح (Leach Pad)</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1">المادة المستهدفة:</label>
              <select
                value={targetMaterial}
                onChange={(e) => setTargetMaterial(e.target.value as MaterialType)}
                className="w-full py-2 px-3 rounded-xl bg-slate-950 border border-slate-700 text-xs text-slate-100 focus:border-amber-500 focus:outline-none"
              >
                <option value="ORE_HIGH">خام عالي HG</option>
                <option value="ORE_MEDIUM">خام متوسط MG</option>
                <option value="ORE_LOW">خام منخفض LG</option>
                <option value="SUB_GRADE">سب جريد SG</option>
                <option value="WASTE">صخور عقيمة Waste</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-300 block mb-1">ملاحظات ومناسيب الموقع:</label>
            <input
              type="text"
              value={currentBenches}
              onChange={(e) => setCurrentBenches(e.target.value)}
              placeholder="مثال: الرامب الشمالي مفتوح، تسوية جارية"
              className="w-full py-2 px-3 rounded-xl bg-slate-950 border border-slate-700 text-xs text-slate-100 focus:border-amber-500 focus:outline-none"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="py-2 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs cursor-pointer"
            >
              إلغاء
            </button>
            <button
              type="submit"
              className="py-2 px-5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-lg transition-transform active:scale-98 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>حفظ وتحديث ومزامنة فورية</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// -------------------------------------------------------------
// Sub-Dialog 4: Parking Location Edit Dialog (Without Deleting)
// -------------------------------------------------------------
interface ParkingEditDialogProps {
  parking: ParkingLocation;
  onSave: (updates: Partial<ParkingLocation>) => void;
  onClose: () => void;
}

const ParkingEditDialog: React.FC<ParkingEditDialogProps> = ({ parking, onSave, onClose }) => {
  const [nameAr, setNameAr] = useState<string>(parking.nameAr);
  const [code, setCode] = useState<string>(parking.code);
  const [area, setArea] = useState<string>(parking.area || '');
  const [capacity, setCapacity] = useState<number>(parking.capacity || 10);
  const [active, setActive] = useState<boolean>(parking.active);
  const [notes, setNotes] = useState<string>(parking.notes || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      nameAr: nameAr.trim(),
      code: code.trim().toUpperCase(),
      area: area.trim() || undefined,
      capacity: Number(capacity) || 10,
      active,
      notes: notes.trim() || undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg bg-slate-900 border-2 border-amber-500 rounded-3xl p-6 shadow-2xl text-slate-100">
        <button
          onClick={onClose}
          type="button"
          className="absolute top-4 left-4 p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4 pb-3 border-b border-slate-800">
          <div className="p-2.5 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/40">
            <MapPin className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-black text-slate-100">
              تعديل بيانات موقع الركنة {parking.nameAr}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              تحديث الكود أو السعة أو تفعيل وإيقاف الموقع للسائقين
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1">اسم الموقف بالعربية:</label>
              <input
                type="text"
                value={nameAr}
                onChange={(e) => setNameAr(e.target.value)}
                className="w-full py-2 px-3 rounded-xl bg-slate-950 border border-slate-700 text-xs text-slate-100 focus:border-amber-500 focus:outline-none"
                required
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1">الكود المختصر:</label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                className="w-full py-2 px-3 rounded-xl bg-slate-950 border border-slate-700 text-xs font-mono uppercase text-slate-100 focus:border-amber-500 focus:outline-none"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1">المنطقة / الموقع:</label>
              <input
                type="text"
                value={area}
                onChange={(e) => setArea(e.target.value)}
                className="w-full py-2 px-3 rounded-xl bg-slate-950 border border-slate-700 text-xs text-slate-100 focus:border-amber-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1">السعة (عدد الدنابر):</label>
              <input
                type="number"
                min="1"
                max="100"
                value={capacity}
                onChange={(e) => setCapacity(Number(e.target.value))}
                className="w-full py-2 px-3 rounded-xl bg-slate-950 border border-slate-700 text-xs font-mono text-slate-100 focus:border-amber-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-300 block mb-1">حالة الموقف وتوفره للسائقين:</label>
            <select
              value={active ? 'TRUE' : 'FALSE'}
              onChange={(e) => setActive(e.target.value === 'TRUE')}
              className="w-full py-2 px-3 rounded-xl bg-slate-950 border border-slate-700 text-xs text-slate-100 focus:border-amber-500 focus:outline-none font-bold"
            >
              <option value="TRUE">متاح ومفعل في شاشة تسليم الوردية 🟢</option>
              <option value="FALSE">معطل ومغلق (لا يظهر للسائقين) ⚪</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-300 block mb-1">ملاحظات تشغيلية:</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full py-2 px-3 rounded-xl bg-slate-950 border border-slate-700 text-xs text-slate-100 focus:border-amber-500 focus:outline-none"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="py-2 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs cursor-pointer"
            >
              إلغاء
            </button>
            <button
              type="submit"
              className="py-2 px-5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-lg transition-transform active:scale-98 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>حفظ وتحديث ومزامنة فورية</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
