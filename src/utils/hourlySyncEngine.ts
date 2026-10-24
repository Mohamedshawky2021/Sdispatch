import {
  getStoredTrips,
  getAppConfig,
  saveHourlyExport,
  generateTripsCSV,
  downloadCSV,
  HourlyExportSnapshot,
  getStoredEquipmentAlerts,
  generateHourlyFormattedText,
  openWhatsAppShare,
} from './storage';
import { playDispatchAlertSound } from './audio';

// Tracks the last exported hour to avoid duplicate export triggers in the same hour
let lastExportedHourKey = '';

export function checkAndTriggerHourlyExport(force = false): HourlyExportSnapshot | null {
  const now = new Date();
  const currentHour = now.getHours();
  const formattedHour = `${String(currentHour).padStart(2, '0')}:00`;
  const dateKey = now.toISOString().split('T')[0];
  const hourKey = `${dateKey}_H${currentHour}`;

  // If already exported this exact hour and not forced, skip
  if (!force && lastExportedHourKey === hourKey) {
    return null;
  }

  const config = getAppConfig();
  if (!config.hourlyAutoExport && !force) {
    return null;
  }

  const allTrips = getStoredTrips();
  const equipmentAlerts = getStoredEquipmentAlerts();
  const activeBreakdownsCount = equipmentAlerts.filter(a => !a.resolved && a.status === 'BREAKDOWN').length;

  // Filter trips for the past 60 minutes
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const hourTrips = allTrips.filter(t => {
    const dumpTime = new Date(t.dumpTime);
    return dumpTime >= oneHourAgo && dumpTime <= now;
  });

  // Calculate hourly metrics
  const totalTripsThisHour = hourTrips.length;
  const totalTonnesThisHour = hourTrips.reduce((acc, t) => acc + (t.payloadTonnes || 152), 0);
  const oreTonnesThisHour = hourTrips
    .filter(t => t.material === 'ORE_HIGH' || t.material === 'ORE_MEDIUM' || t.material === 'ORE_LOW')
    .reduce((acc, t) => acc + (t.payloadTonnes || 152), 0);
  const subGradeTonnesThisHour = hourTrips
    .filter(t => t.material === 'SUB_GRADE')
    .reduce((acc, t) => acc + (t.payloadTonnes || 152), 0);
  const wasteTonnesThisHour = hourTrips
    .filter(t => t.material === 'WASTE')
    .reduce((acc, t) => acc + (t.payloadTonnes || 152), 0);

  const activeTrucks = new Set(hourTrips.map(t => t.truckId)).size;

  // Cumulative metrics
  const cumulativeShiftTrips = allTrips.length;
  const cumulativeShiftTonnes = allTrips.reduce((acc, t) => acc + (t.payloadTonnes || 152), 0);

  const tripsToExport = hourTrips.length > 0 ? hourTrips : allTrips.slice(0, 30);
  const csvContent = generateTripsCSV(
    tripsToExport,
    `تقرير الساعات - منجم السكري - الساعة ${formattedHour}`
  );

  const whatsappMessage = generateHourlyFormattedText({
    hourLabel: formattedHour,
    totalTripsThisHour,
    totalTonnesThisHour,
    oreTonnesThisHour,
    subGradeTonnesThisHour,
    wasteTonnesThisHour,
    activeTrucksCount: activeTrucks,
    cumulativeShiftTrips,
    cumulativeShiftTonnes,
    activeBreakdownsCount,
    trips: tripsToExport,
  });

  const snapshot: HourlyExportSnapshot = {
    id: `EXPORT-${dateKey}-H${currentHour}-${Date.now()}`,
    hourNumber: currentHour,
    hourLabel: formattedHour,
    timestamp: now.toISOString(),
    formattedDate: now.toLocaleDateString('ar-EG', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }),
    totalTripsThisHour,
    totalTonnesThisHour,
    oreTonnesThisHour,
    wasteTonnesThisHour,
    activeTrucksCount: activeTrucks,
    cumulativeShiftTrips,
    cumulativeShiftTonnes,
    activeBreakdownsCount,
    trips: tripsToExport,
    csvContent,
    whatsappMessage,
  };

  saveHourlyExport(snapshot);
  lastExportedHourKey = hourKey;

  // Sound chime
  if (config.soundEnabled) {
    playDispatchAlertSound();
  }

  // Automatic CSV download if enabled or forced
  if (config.autoDownloadCsv || force) {
    const filename = `تقرير_ساعي_منجم_السكري_الساعة_${String(currentHour).padStart(2, '0')}_00_${dateKey}.csv`;
    downloadCSV(csvContent, filename);
  }

  return snapshot;
}

// Compute seconds remaining until the next exact sharp hour (:00:00)
export function getTimeUntilNextHour(): { minutes: number; seconds: number; totalSeconds: number; formatted: string } {
  const now = new Date();
  const minutes = 59 - now.getMinutes();
  const seconds = 59 - now.getSeconds();
  const totalSeconds = minutes * 60 + seconds;
  const formatted = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  return { minutes, seconds, totalSeconds, formatted };
}
