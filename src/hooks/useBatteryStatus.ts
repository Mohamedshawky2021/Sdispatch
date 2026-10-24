import { useState, useEffect, useCallback, useRef } from 'react';
import { playLowBatteryAlarmSound } from '../utils/audio';

interface BatteryManager extends EventTarget {
  charging: boolean;
  chargingTime: number;
  dischargingTime: number;
  level: number; // 0.0 to 1.0
  onchargingchange: ((this: BatteryManager, ev: Event) => void) | null;
  onlevelchange: ((this: BatteryManager, ev: Event) => void) | null;
}

interface NavigatorWithBattery extends Navigator {
  getBattery?: () => Promise<BatteryManager>;
}

export interface BatteryState {
  level: number; // 0 to 100
  charging: boolean;
  isSupported: boolean;
  isLowBattery: boolean; // < 20% and not charging
  isCritical: boolean; // <= 10% and not charging
  isSimulated: boolean;
  simulatedLevel: number | null;
  setSimulatedLevel: (level: number | null) => void;
  setSimulatedCharging: (charging: boolean) => void;
}

const STORAGE_KEY_SIM_LEVEL = 'SUKARI_TABLET_BATTERY_SIM_LEVEL';
const STORAGE_KEY_SIM_CHARGING = 'SUKARI_TABLET_BATTERY_SIM_CHARGING';

export function useBatteryStatus(): BatteryState {
  const [level, setLevel] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(STORAGE_KEY_SIM_LEVEL);
      if (saved !== null) return parseInt(saved, 10);
    }
    return 88; // Default optimistic fallback
  });

  const [charging, setCharging] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(STORAGE_KEY_SIM_CHARGING);
      if (saved !== null) return saved === 'true';
    }
    return false;
  });

  const [isSupported, setIsSupported] = useState<boolean>(false);
  const [simulatedLevel, setSimulatedLevelState] = useState<number | null>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(STORAGE_KEY_SIM_LEVEL);
      return saved !== null ? parseInt(saved, 10) : null;
    }
    return null;
  });

  const hasPlayedAlarmRef = useRef<boolean>(false);

  // Monitor hardware battery if API supported
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const nav = navigator as NavigatorWithBattery;
    if (typeof nav.getBattery !== 'function') {
      setIsSupported(false);
      return;
    }

    let batteryInstance: BatteryManager | null = null;

    const updateBatteryInfo = (b: BatteryManager) => {
      // If user has not explicitly forced a simulation, use hardware battery
      if (simulatedLevel === null) {
        const roundedPct = Math.round(b.level * 100);
        setLevel(roundedPct);
        setCharging(b.charging);
      }
    };

    nav.getBattery().then((battery) => {
      batteryInstance = battery;
      setIsSupported(true);
      updateBatteryInfo(battery);

      const handleLevelChange = () => updateBatteryInfo(battery);
      const handleChargingChange = () => updateBatteryInfo(battery);

      battery.addEventListener('levelchange', handleLevelChange);
      battery.addEventListener('chargingchange', handleChargingChange);

      return () => {
        battery.removeEventListener('levelchange', handleLevelChange);
        battery.removeEventListener('chargingchange', handleChargingChange);
      };
    }).catch(() => {
      setIsSupported(false);
    });
  }, [simulatedLevel]);

  // Alarm sound trigger when battery falls below 20%
  const effectiveLevel = simulatedLevel !== null ? simulatedLevel : level;
  const isLowBattery = effectiveLevel < 20 && !charging;
  const isCritical = effectiveLevel <= 10 && !charging;

  useEffect(() => {
    if (isLowBattery && !hasPlayedAlarmRef.current) {
      playLowBatteryAlarmSound();
      hasPlayedAlarmRef.current = true;
    } else if (!isLowBattery) {
      hasPlayedAlarmRef.current = false;
    }
  }, [isLowBattery]);

  const setSimulatedLevel = useCallback((lvl: number | null) => {
    setSimulatedLevelState(lvl);
    if (lvl === null) {
      localStorage.removeItem(STORAGE_KEY_SIM_LEVEL);
      // Re-trigger hardware read
      const nav = navigator as NavigatorWithBattery;
      if (typeof nav.getBattery === 'function') {
        nav.getBattery().then(b => {
          setLevel(Math.round(b.level * 100));
          setCharging(b.charging);
        }).catch(() => {});
      } else {
        setLevel(85);
      }
    } else {
      setLevel(lvl);
      localStorage.setItem(STORAGE_KEY_SIM_LEVEL, lvl.toString());
    }
  }, []);

  const setSimulatedCharging = useCallback((chg: boolean) => {
    setCharging(chg);
    localStorage.setItem(STORAGE_KEY_SIM_CHARGING, chg ? 'true' : 'false');
  }, []);

  return {
    level: effectiveLevel,
    charging,
    isSupported,
    isLowBattery,
    isCritical,
    isSimulated: simulatedLevel !== null,
    simulatedLevel,
    setSimulatedLevel,
    setSimulatedCharging,
  };
}
