import { TripLog, Truck, Excavator, DumpLocation, MaterialType } from '../types/dispatch';

export interface EquipmentCumulativeStat {
  id: string;
  name: string;
  category: 'TRUCK' | 'LOADER';
  equipmentTypeStr: string;
  status: string;
  totalTrips: number;
  totalTonnes: number;
  materialsBreakdown: {
    highGradeTonnes: number;
    mediumGradeTonnes: number;
    lowGradeTonnes: number;
    subGradeTonnes: number;
    wasteTonnes: number;
    highGradeTrips: number;
    mediumGradeTrips: number;
    lowGradeTrips: number;
    subGradeTrips: number;
    wasteTrips: number;
  };
  avgCycleMinutes: number;
  topPartner: string; // Loader for truck, or top Truck for loader
  partnerCount: number;
  lastTripTime?: string;
  targetTonnes: number;
  targetCompletionPercent: number;
}

export interface HourlyProductivityStat {
  hourIndex: number;
  hourLabel: string;
  isCurrentHour: boolean;
  totalTrips: number;
  totalTonnes: number;
  oreTonnes: number;
  subGradeTonnes: number;
  wasteTonnes: number;
  activeTrucksCount: number;
  activeTrucks: string[];
  topLoader: string;
  topLoaderTrips: number;
  avgCycleMinutes: number;
  ratePerMinute: number;
}

export interface DailyPerformanceSummary {
  dateStr: string;
  shiftName: string;
  totalTripsToday: number;
  totalTonnesToday: number;
  oreTonnes: number;
  subGradeTonnes: number;
  wasteTonnes: number;
  orePercentage: number;
  subGradePercentage: number;
  wastePercentage: number;
  activeTrucksCount: number;
  activeLoadersCount: number;
  avgCycleMinutes: number;
  peakHourLabel: string;
  peakHourTonnes: number;
  shiftTargetTonnes: number;
  shiftTargetPercent: number;
  avgTonnesPerHour: number;
  avgTripsPerHour: number;
}

/**
 * Filter trips by selected date (defaults to today) and shift.
 */
export function filterTripsByDateAndShift(
  trips: TripLog[],
  dateStr?: string,
  shift?: 'ALL' | 'MORNING' | 'NIGHT'
): TripLog[] {
  const targetDate = dateStr || new Date().toISOString().split('T')[0];

  return trips.filter((t) => {
    // Check date match
    const tripDate = t.shiftDate || (t.dumpTime ? t.dumpTime.split('T')[0] : '');
    const dateMatches = !targetDate || tripDate === targetDate;

    // Check shift match
    if (!dateMatches) return false;
    if (!shift || shift === 'ALL') return true;
    return t.shiftType === shift;
  });
}

/**
 * Compute 24-hour productivity rates based on recorded trips.
 */
export function computeHourlyProductivity(trips: TripLog[]): HourlyProductivityStat[] {
  const now = new Date();
  const currentHour = now.getHours();

  const hourlyMap: Record<
    number,
    {
      trips: TripLog[];
      trucks: Set<string>;
      loaders: Record<string, number>;
      oreTonnes: number;
      subGradeTonnes: number;
      wasteTonnes: number;
      totalTonnes: number;
      cycleTotal: number;
    }
  > = {};

  // Initialize all 24 hours
  for (let h = 0; h < 24; h++) {
    hourlyMap[h] = {
      trips: [],
      trucks: new Set<string>(),
      loaders: {},
      oreTonnes: 0,
      subGradeTonnes: 0,
      wasteTonnes: 0,
      totalTonnes: 0,
      cycleTotal: 0,
    };
  }

  // Populate from trips
  trips.forEach((trip) => {
    if (!trip.dumpTime) return;
    const dateObj = new Date(trip.dumpTime);
    if (isNaN(dateObj.getTime())) return;

    const hour = dateObj.getHours();
    if (hour < 0 || hour > 23) return;

    const tonnes = trip.payloadTonnes || 152;
    const bucket = hourlyMap[hour];

    bucket.trips.push(trip);
    bucket.trucks.add(trip.truckId);
    bucket.totalTonnes += tonnes;
    bucket.cycleTotal += trip.cycleTimeMinutes || 0;

    if (trip.excavatorId) {
      bucket.loaders[trip.excavatorId] = (bucket.loaders[trip.excavatorId] || 0) + 1;
    }

    if (trip.material === 'ORE_HIGH' || trip.material === 'ORE_MEDIUM' || trip.material === 'ORE_LOW') {
      bucket.oreTonnes += tonnes;
    } else if (trip.material === 'SUB_GRADE') {
      bucket.subGradeTonnes += tonnes;
    } else {
      bucket.wasteTonnes += tonnes;
    }
  });

  const result: HourlyProductivityStat[] = [];

  for (let h = 0; h < 24; h++) {
    const bucket = hourlyMap[h];
    const tripCount = bucket.trips.length;

    // Top loader this hour
    let topLoader = '-';
    let topLoaderTrips = 0;
    Object.entries(bucket.loaders).forEach(([loaderId, count]) => {
      if (count > topLoaderTrips) {
        topLoaderTrips = count;
        topLoader = loaderId;
      }
    });

    const hourLabel = `${String(h).padStart(2, '0')}:00`;

    result.push({
      hourIndex: h,
      hourLabel,
      isCurrentHour: h === currentHour,
      totalTrips: tripCount,
      totalTonnes: Math.round(bucket.totalTonnes),
      oreTonnes: Math.round(bucket.oreTonnes),
      subGradeTonnes: Math.round(bucket.subGradeTonnes),
      wasteTonnes: Math.round(bucket.wasteTonnes),
      activeTrucksCount: bucket.trucks.size,
      activeTrucks: Array.from(bucket.trucks),
      topLoader,
      topLoaderTrips,
      avgCycleMinutes: tripCount > 0 ? Math.round((bucket.cycleTotal / tripCount) * 10) / 10 : 0,
      ratePerMinute: tripCount > 0 ? Math.round((bucket.totalTonnes / 60) * 10) / 10 : 0,
    });
  }

  return result;
}

/**
 * Compute daily cumulative statistics for each Dump Truck (DT001 - DT060).
 */
export function computeTruckCumulativeStats(
  trucks: Truck[],
  trips: TripLog[],
  targetTripsPerTruck = 10
): EquipmentCumulativeStat[] {
  const targetTonnesPerTruck = targetTripsPerTruck * 152; // 1,520 tonnes per shift target

  return trucks.map((truck) => {
    const truckTrips = trips.filter((t) => t.truckId === truck.id);

    const breakdown = {
      highGradeTonnes: 0,
      mediumGradeTonnes: 0,
      lowGradeTonnes: 0,
      subGradeTonnes: 0,
      wasteTonnes: 0,
      highGradeTrips: 0,
      mediumGradeTrips: 0,
      lowGradeTrips: 0,
      subGradeTrips: 0,
      wasteTrips: 0,
    };

    let totalTonnes = 0;
    let cycleSum = 0;
    let lastDumpTime: string | undefined = undefined;
    const loaderCounts: Record<string, number> = {};

    truckTrips.forEach((t) => {
      const payload = t.payloadTonnes || 152;
      totalTonnes += payload;
      cycleSum += t.cycleTimeMinutes || 0;

      if (!lastDumpTime || (t.dumpTime && t.dumpTime > lastDumpTime)) {
        lastDumpTime = t.dumpTime;
      }

      if (t.excavatorId) {
        loaderCounts[t.excavatorId] = (loaderCounts[t.excavatorId] || 0) + 1;
      }

      if (t.material === 'ORE_HIGH') {
        breakdown.highGradeTonnes += payload;
        breakdown.highGradeTrips += 1;
      } else if (t.material === 'ORE_MEDIUM') {
        breakdown.mediumGradeTonnes += payload;
        breakdown.mediumGradeTrips += 1;
      } else if (t.material === 'ORE_LOW') {
        breakdown.lowGradeTonnes += payload;
        breakdown.lowGradeTrips += 1;
      } else if (t.material === 'SUB_GRADE') {
        breakdown.subGradeTonnes += payload;
        breakdown.subGradeTrips += 1;
      } else {
        breakdown.wasteTonnes += payload;
        breakdown.wasteTrips += 1;
      }
    });

    let topLoader = '-';
    let maxCount = 0;
    Object.entries(loaderCounts).forEach(([loader, count]) => {
      if (count > maxCount) {
        maxCount = count;
        topLoader = loader;
      }
    });

    const totalTrips = truckTrips.length;
    const avgCycleMinutes = totalTrips > 0 ? Math.round((cycleSum / totalTrips) * 10) / 10 : 0;
    const targetPercent = Math.min(100, Math.round((totalTonnes / targetTonnesPerTruck) * 100));

    return {
      id: truck.id,
      name: `دنبر ${truck.id}`,
      category: 'TRUCK',
      equipmentTypeStr: 'شاحنة قلابة 152 طن',
      status: truck.status,
      totalTrips,
      totalTonnes: Math.round(totalTonnes),
      materialsBreakdown: breakdown,
      avgCycleMinutes,
      topPartner: topLoader,
      partnerCount: Object.keys(loaderCounts).length,
      lastTripTime: lastDumpTime ? new Date(lastDumpTime).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) : undefined,
      targetTonnes: targetTonnesPerTruck,
      targetCompletionPercent: targetPercent,
    };
  });
}

/**
 * Compute daily cumulative statistics for each Loader / Excavator.
 */
export function computeLoaderCumulativeStats(
  excavators: Excavator[],
  trips: TripLog[],
  targetLoadsPerLoader = 40
): EquipmentCumulativeStat[] {
  const targetTonnesPerLoader = targetLoadsPerLoader * 152; // e.g. 6,080 tonnes

  return excavators.map((loader) => {
    const loaderTrips = trips.filter((t) => t.excavatorId === loader.id);

    const breakdown = {
      highGradeTonnes: 0,
      mediumGradeTonnes: 0,
      lowGradeTonnes: 0,
      subGradeTonnes: 0,
      wasteTonnes: 0,
      highGradeTrips: 0,
      mediumGradeTrips: 0,
      lowGradeTrips: 0,
      subGradeTrips: 0,
      wasteTrips: 0,
    };

    let totalTonnes = 0;
    let cycleSum = 0;
    let lastDumpTime: string | undefined = undefined;
    const truckCounts: Record<string, number> = {};

    loaderTrips.forEach((t) => {
      const payload = t.payloadTonnes || 152;
      totalTonnes += payload;
      cycleSum += t.cycleTimeMinutes || 0;

      if (!lastDumpTime || (t.dumpTime && t.dumpTime > lastDumpTime)) {
        lastDumpTime = t.dumpTime;
      }

      if (t.truckId) {
        truckCounts[t.truckId] = (truckCounts[t.truckId] || 0) + 1;
      }

      if (t.material === 'ORE_HIGH') {
        breakdown.highGradeTonnes += payload;
        breakdown.highGradeTrips += 1;
      } else if (t.material === 'ORE_MEDIUM') {
        breakdown.mediumGradeTonnes += payload;
        breakdown.mediumGradeTrips += 1;
      } else if (t.material === 'ORE_LOW') {
        breakdown.lowGradeTonnes += payload;
        breakdown.lowGradeTrips += 1;
      } else if (t.material === 'SUB_GRADE') {
        breakdown.subGradeTonnes += payload;
        breakdown.subGradeTrips += 1;
      } else {
        breakdown.wasteTonnes += payload;
        breakdown.wasteTrips += 1;
      }
    });

    let topTruck = '-';
    let maxLoads = 0;
    Object.entries(truckCounts).forEach(([truckId, count]) => {
      if (count > maxLoads) {
        maxLoads = count;
        topTruck = truckId;
      }
    });

    const totalTrips = loaderTrips.length;
    const avgCycleMinutes = totalTrips > 0 ? Math.round((cycleSum / totalTrips) * 10) / 10 : 0;
    const targetPercent = Math.min(100, Math.round((totalTonnes / targetTonnesPerLoader) * 100));

    const typeStr =
      loader.id === 'Others'
        ? 'معدات تحميل ومقاولين أخرى'
        : loader.type === 'SHOVEL'
        ? 'شوڤل كهربائي / هيدروليكي'
        : loader.type === 'WHEEL_LOADER'
        ? 'لودر كبشة عجلات'
        : 'حفار هيدروليكي تعديني';

    return {
      id: loader.id,
      name: loader.id,
      category: 'LOADER',
      equipmentTypeStr: typeStr,
      status: loader.status,
      totalTrips,
      totalTonnes: Math.round(totalTonnes),
      materialsBreakdown: breakdown,
      avgCycleMinutes,
      topPartner: topTruck !== '-' ? `${topTruck} (${maxLoads} نقلة)` : '-',
      partnerCount: Object.keys(truckCounts).length,
      lastTripTime: lastDumpTime ? new Date(lastDumpTime).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) : undefined,
      targetTonnes: targetTonnesPerLoader,
      targetCompletionPercent: targetPercent,
    };
  });
}

/**
 * Compute the high-level daily KPI summary.
 */
export function computeDailySummary(
  trips: TripLog[],
  targetShiftTonnes = 30000
): DailyPerformanceSummary {
  let totalTonnes = 0;
  let oreTonnes = 0;
  let subGradeTonnes = 0;
  let wasteTonnes = 0;
  let cycleTotal = 0;
  const trucksSet = new Set<string>();
  const loadersSet = new Set<string>();

  const hourlyProductivity = computeHourlyProductivity(trips);
  let peakHourLabel = '-';
  let peakHourTonnes = 0;

  hourlyProductivity.forEach((hp) => {
    if (hp.totalTonnes > peakHourTonnes) {
      peakHourTonnes = hp.totalTonnes;
      peakHourLabel = hp.hourLabel;
    }
  });

  trips.forEach((t) => {
    const payload = t.payloadTonnes || 152;
    totalTonnes += payload;
    cycleTotal += t.cycleTimeMinutes || 0;

    if (t.truckId) trucksSet.add(t.truckId);
    if (t.excavatorId) loadersSet.add(t.excavatorId);

    if (t.material === 'ORE_HIGH' || t.material === 'ORE_MEDIUM' || t.material === 'ORE_LOW') {
      oreTonnes += payload;
    } else if (t.material === 'SUB_GRADE') {
      subGradeTonnes += payload;
    } else {
      wasteTonnes += payload;
    }
  });

  const totalTripsToday = trips.length;
  const orePercentage = totalTonnes > 0 ? Math.round((oreTonnes / totalTonnes) * 100) : 0;
  const subGradePercentage = totalTonnes > 0 ? Math.round((subGradeTonnes / totalTonnes) * 100) : 0;
  const wastePercentage = totalTonnes > 0 ? Math.round((wasteTonnes / totalTonnes) * 100) : 0;
  const avgCycleMinutes = totalTripsToday > 0 ? Math.round((cycleTotal / totalTripsToday) * 10) / 10 : 0;
  const shiftTargetPercent = Math.min(100, Math.round((totalTonnes / targetShiftTonnes) * 100));

  // Count active working hours (hours with >0 trips or hours elapsed)
  const currentHour = new Date().getHours();
  const elapsedHours = Math.max(1, currentHour + 1);
  const avgTonnesPerHour = Math.round(totalTonnes / elapsedHours);
  const avgTripsPerHour = Math.round((totalTripsToday / elapsedHours) * 10) / 10;

  const dateStr = new Date().toLocaleDateString('ar-EG', {
    weekday: 'long',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  });

  return {
    dateStr,
    shiftName: currentHour >= 7 && currentHour < 19 ? 'الوردية الصباحية (Day Shift)' : 'الوردية الليلية (Night Shift)',
    totalTripsToday,
    totalTonnesToday: Math.round(totalTonnes),
    oreTonnes: Math.round(oreTonnes),
    subGradeTonnes: Math.round(subGradeTonnes),
    wasteTonnes: Math.round(wasteTonnes),
    orePercentage,
    subGradePercentage,
    wastePercentage,
    activeTrucksCount: trucksSet.size,
    activeLoadersCount: loadersSet.size,
    avgCycleMinutes,
    peakHourLabel,
    peakHourTonnes: Math.round(peakHourTonnes),
    shiftTargetTonnes: targetShiftTonnes,
    shiftTargetPercent,
    avgTonnesPerHour,
    avgTripsPerHour,
  };
}

/**
 * Generate formatted text for WhatsApp Performance Summary
 */
export function generatePerformanceWhatsAppSummary(
  summary: DailyPerformanceSummary,
  topTrucks: EquipmentCumulativeStat[],
  topLoaders: EquipmentCumulativeStat[],
  hourly: HourlyProductivityStat[]
): string {
  const activeHours = hourly.filter((h) => h.totalTrips > 0);

  const lines = [
    `📊 *تقرير لوحة تحكم الأداء التراكمي - منجم السكري* ⛏️`,
    `📅 *التاريخ:* ${summary.dateStr}`,
    `⏱️ *الوردية:* ${summary.shiftName}`,
    `----------------------------------------`,
    `🏆 *المؤشرات الإجمالية التراكمية اليومية:*`,
    `• إجمالي النقلات: *${summary.totalTripsToday} نقلة*`,
    `• إجمالي الحمولات: *${summary.totalTonnesToday.toLocaleString('en-US')} طن*`,
    `• نسبة إنجاز المستهدف: *${summary.shiftTargetPercent}%* من (${summary.shiftTargetTonnes.toLocaleString('en-US')} طن)`,
    `• خام الذهب (HG/MG/LG): *${summary.oreTonnes.toLocaleString('en-US')} طن* (${summary.orePercentage}%)`,
    `• سب جريد (Sub-Grade): *${summary.subGradeTonnes.toLocaleString('en-US')} طن* (${summary.subGradePercentage}%)`,
    `• صخور عقيمة (Waste): *${summary.wasteTonnes.toLocaleString('en-US')} طن* (${summary.wastePercentage}%)`,
    `• متوسط زمن الدورة: *${summary.avgCycleMinutes} دقيقة/نقلة*`,
    `• شاحنات نشطة بالخدمة: *${summary.activeTrucksCount} شاحنة*`,
    `• معدات تحميل عاملة: *${summary.activeLoadersCount} معدة*`,
    `----------------------------------------`,
    `⚡ *أعلى 5 دنابر إنتاجية اليوم (حمولات 152 طن):*`,
    ...topTrucks.slice(0, 5).map(
      (t, idx) =>
        `${idx + 1}. *${t.id}*: ${t.totalTrips} نقلة | ${t.totalTonnes.toLocaleString('en-US')} طن (دورة: ${t.avgCycleMinutes} د)`
    ),
    `----------------------------------------`,
    `🚜 *أعلى معدات التحميل إنتاجية:*`,
    ...topLoaders.slice(0, 5).map(
      (l, idx) =>
        `${idx + 1}. *${l.id}*: ${l.totalTrips} نقلة | ${l.totalTonnes.toLocaleString('en-US')} طن (خدمت ${l.partnerCount} دنبر)`
    ),
    `----------------------------------------`,
    `🕒 *ساعات الذروة الإنتاجية:*`,
    `• أعلى ساعة إنتاجية: الساعة *${summary.peakHourLabel}* بحمولة *${summary.peakHourTonnes.toLocaleString('en-US')} طن*`,
    ...activeHours.slice(-3).map(
      (h) => `• س ${h.hourLabel}: ${h.totalTrips} نقلة | ${h.totalTonnes.toLocaleString('en-US')} طن`
    ),
    `----------------------------------------`,
    `📍 _صادر تلقائياً من نظام دسباتش منجم السكري للذهب_`,
  ];

  return lines.join('\n');
}

/**
 * Generate CSV text for Equipment Cumulative Performance
 */
export function generateEquipmentPerformanceCSV(
  truckStats: EquipmentCumulativeStat[],
  loaderStats: EquipmentCumulativeStat[],
  summary: DailyPerformanceSummary
): string {
  const headers = [
    'نوع المعدة',
    'كود المعدة',
    'الوصف / الموديل',
    'الحالة التشغيلية',
    'إجمالي النقلات اليومية',
    'الوزن الكلي التراكمي (طن)',
    'طن خام هاي جريد',
    'طن خام ميديم جريد',
    'طن خام لو جريد',
    'طن سب جريد',
    'طن صخور عقيمة (ويست)',
    'متوسط زمن الدورة (دقيقة)',
    'المعدة الشريكة الأكثر خدمة',
    'عدد المعدات المقترنة',
    'نسبة تحقيق المستهدف (%)',
    'آخر نقلة مسجلة',
  ];

  const rows: (string | number)[][] = [];

  // Trucks
  truckStats.forEach((t) => {
    rows.push([
      'دنبر نقل (Dump Truck)',
      t.id,
      `"${t.equipmentTypeStr}"`,
      t.status,
      t.totalTrips,
      t.totalTonnes,
      t.materialsBreakdown.highGradeTonnes,
      t.materialsBreakdown.mediumGradeTonnes,
      t.materialsBreakdown.lowGradeTonnes,
      t.materialsBreakdown.subGradeTonnes,
      t.materialsBreakdown.wasteTonnes,
      t.avgCycleMinutes,
      t.topPartner,
      t.partnerCount,
      `${t.targetCompletionPercent}%`,
      t.lastTripTime || '-',
    ]);
  });

  // Loaders
  loaderStats.forEach((l) => {
    rows.push([
      'معدة تحميل (Loader/Excavator)',
      l.id,
      `"${l.equipmentTypeStr}"`,
      l.status,
      l.totalTrips,
      l.totalTonnes,
      l.materialsBreakdown.highGradeTonnes,
      l.materialsBreakdown.mediumGradeTonnes,
      l.materialsBreakdown.lowGradeTonnes,
      l.materialsBreakdown.subGradeTonnes,
      l.materialsBreakdown.wasteTonnes,
      l.avgCycleMinutes,
      l.topPartner,
      l.partnerCount,
      `${l.targetCompletionPercent}%`,
      l.lastTripTime || '-',
    ]);
  });

  return '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
}
