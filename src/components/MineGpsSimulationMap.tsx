import React, { useState, useEffect, useMemo } from 'react';
import {
  MapPin,
  Navigation,
  Truck as TruckIcon,
  HardHat,
  Mountain,
  Fuel,
  Wrench,
  Search,
  Filter,
  Maximize2,
  Radio,
  Clock,
  Layers,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Truck, Excavator, DumpLocation, TripLog } from '../types/dispatch';
import { playClickSound } from '../utils/audio';

interface Props {
  trucks: Truck[];
  excavators: Excavator[];
  dumps: DumpLocation[];
  trips: TripLog[];
  onSelectTruckForMessage?: (truckId: string) => void;
}

interface SimulatedTruckPos {
  truckId: string;
  status: string;
  x: number;
  y: number;
  speedKmh: number;
  heading: number; // in degrees
  destinationName: string;
  driverName?: string;
  payloadTonnes: number;
}

export const MineGpsSimulationMap: React.FC<Props> = ({
  trucks,
  excavators,
  dumps,
  trips,
  onSelectTruckForMessage,
}) => {
  const [selectedTruckId, setSelectedTruckId] = useState<string | null>(null);
  const [filterMode, setFilterMode] = useState<'ALL' | 'HAULING' | 'LOADING' | 'FUELING' | 'DUMPING' | 'STANDBY'>('ALL');
  const [searchTruckQuery, setSearchTruckQuery] = useState('');
  const [isExpanded, setIsExpanded] = useState(true);
  const [animationTick, setAnimationTick] = useState(0);

  // Smooth position animation loop
  useEffect(() => {
    const interval = setInterval(() => {
      setAnimationTick(t => t + 1);
    }, 1500);
    return () => clearInterval(interval);
  }, []);

  // Predefined geographic waypoint nodes on the Sukari Open Pit map (in SVG 1000 x 600 coordinate system)
  const ZONES = useMemo(() => ({
    // Surface & Processing
    CRUSHER_01: { id: 'CRUSHER-01', name: 'الكسارة الأولية 01', x: 220, y: 120, rl: '+240m' },
    CRUSHER_02: { id: 'CRUSHER-02', name: 'الكسارة الثانوية 02', x: 290, y: 110, rl: '+240m' },
    ROM_PAD: { id: 'ROM-PAD', name: 'ساحة تشوين ROM-PAD', x: 160, y: 180, rl: '+230m' },
    WASTE_DUMP_A: { id: 'DUMP-A', name: 'مقلب الردم الشمالي A', x: 820, y: 120, rl: '+280m' },
    WASTE_DUMP_B: { id: 'DUMP-B', name: 'مقلب الردم الجنوبي B', x: 850, y: 380, rl: '+310m' },
    LEACH_PAD: { id: 'LEACH-PAD', name: 'مكدس الغسيل والترشيح', x: 120, y: 340, rl: '+190m' },
    FUEL_BAY: { id: 'FUEL-STATION', name: 'محطة الوقود المركزية ⛽', x: 420, y: 160, rl: '+220m' },
    WORKSHOP: { id: 'WORKSHOP', name: 'ورشة الصيانة الميكانيكية 🛠️', x: 500, y: 140, rl: '+220m' },

    // Mining Pit Benches (Open Pit Center & Floor)
    NORTH_BENCH: { id: 'EX08', name: 'North Pit Bench RL +140m (EX08)', x: 620, y: 240, rl: '+140m' },
    CENTRAL_BENCH: { id: 'EX09', name: 'Stage 4 Central RL +110m (EX09)', x: 510, y: 290, rl: '+110m' },
    PIT_FLOOR: { id: 'SH02', name: 'Pit Floor RL +60m (SH02)', x: 460, y: 410, rl: '+60m' },
    EAST_WALL: { id: 'SH03', name: 'East Wall Cut RL +90m (SH03)', x: 660, y: 370, rl: '+90m' },
    SOUTH_CUTBACK: { id: 'SH04', name: 'South Cutback RL +120m (SH04)', x: 380, y: 490, rl: '+120m' },
    DEEP_WEST: { id: 'EX11', name: 'Deep Pit West RL +40m (EX11)', x: 310, y: 430, rl: '+40m' },
  }), []);

  // Compute simulated positions for trucks based on their real state and tick
  const simulatedPositions: SimulatedTruckPos[] = useMemo(() => {
    return trucks.map((truck, idx) => {
      // Deterministic spread around waypoints with gentle animation drift
      const hash = idx * 17 + animationTick;
      const progress = (hash % 100) / 100;

      let x = 500;
      let y = 300;
      let heading = 45;
      let speedKmh = 0;
      let destinationName = 'الحفرة المفتوحة';

      if (truck.status === 'LOADING') {
        // Near pit excavators
        const loaderZone = idx % 2 === 0 ? ZONES.NORTH_BENCH : ZONES.PIT_FLOOR;
        x = loaderZone.x + ((idx % 5) - 2) * 16;
        y = loaderZone.y + ((idx % 3) - 1) * 14;
        speedKmh = 0;
        heading = (idx * 60) % 360;
        destinationName = loaderZone.name;
      } else if (truck.status === 'DUMPING') {
        // At crushers or waste dump
        const dumpZone = idx % 2 === 0 ? ZONES.CRUSHER_01 : ZONES.WASTE_DUMP_A;
        x = dumpZone.x + ((idx % 4) - 2) * 16;
        y = dumpZone.y + ((idx % 3) - 1) * 14;
        speedKmh = 0;
        heading = 270;
        destinationName = dumpZone.name;
      } else if (truck.status === 'FUELING') {
        // At fuel bay
        x = ZONES.FUEL_BAY.x + ((idx % 3) - 1) * 18;
        y = ZONES.FUEL_BAY.y + ((idx % 2) - 0.5) * 14;
        speedKmh = 0;
        heading = 90;
        destinationName = 'محطة تموين السولار';
      } else if (truck.status === 'BREAKDOWN' || truck.status === 'MAINTENANCE') {
        // At workshop
        x = ZONES.WORKSHOP.x + ((idx % 4) - 1.5) * 18;
        y = ZONES.WORKSHOP.y + ((idx % 2) - 0.5) * 14;
        speedKmh = 0;
        heading = 0;
        destinationName = 'ورشة المعدات الثقيلة';
      } else if (truck.status === 'STANDBY_QUEUE') {
        // Queued at excavation benches
        const bench = ZONES.CENTRAL_BENCH;
        x = bench.x - 40 - (idx % 4) * 18;
        y = bench.y + ((idx % 3) - 1) * 10;
        speedKmh = 0;
        destinationName = 'طابور انتظار الحفار';
      } else {
        // HAULING / ACTIVE: moving along haul ramp path from Pit Floor to Crusher
        const start = ZONES.PIT_FLOOR;
        const end = idx % 2 === 0 ? ZONES.CRUSHER_01 : ZONES.WASTE_DUMP_A;
        // Linear interpolation along ramp curve
        x = start.x + (end.x - start.x) * progress + Math.sin(progress * Math.PI) * 40;
        y = start.y + (end.y - start.y) * progress;
        speedKmh = 24 + (idx % 12);
        heading = Math.atan2(end.y - start.y, end.x - start.x) * (180 / Math.PI);
        destinationName = end.name;
      }

      const driverCode = truck.assignedDriver;
      const lastTrip = trips.find(t => t.truckId === truck.id);

      return {
        truckId: truck.id,
        status: truck.status,
        x,
        y,
        speedKmh,
        heading,
        destinationName,
        driverName: lastTrip?.driverName || (driverCode ? `سائق ${driverCode}` : 'متاح للتكليف'),
        payloadTonnes: truck.status === 'DUMPING' || (truck.status === 'HAULING' && progress > 0.5) ? 152 : 0,
      };
    });
  }, [trucks, trips, animationTick, ZONES]);

  // Filter trucks
  const filteredTrucks = useMemo(() => {
    return simulatedPositions.filter(t => {
      if (filterMode === 'HAULING' && t.status !== 'HAULING' && t.speedKmh === 0) return false;
      if (filterMode === 'LOADING' && t.status !== 'LOADING') return false;
      if (filterMode === 'FUELING' && t.status !== 'FUELING') return false;
      if (filterMode === 'DUMPING' && t.status !== 'DUMPING') return false;
      if (filterMode === 'STANDBY' && t.status !== 'STANDBY_QUEUE') return false;
      if (searchTruckQuery.trim() && !t.truckId.toLowerCase().includes(searchTruckQuery.toLowerCase())) {
        return false;
      }
      return true;
    });
  }, [simulatedPositions, filterMode, searchTruckQuery]);

  const selectedTruck = simulatedPositions.find(t => t.truckId === selectedTruckId);

  return (
    <div className="mb-5 rounded-2xl border-2 border-emerald-500/40 bg-slate-900 shadow-xl overflow-hidden">
      {/* Header Bar */}
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className="p-4 bg-gradient-to-r from-emerald-950/70 via-slate-900 to-slate-900 flex flex-wrap items-center justify-between gap-3 cursor-pointer select-none"
      >
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-emerald-500/20 border-2 border-emerald-400 flex items-center justify-center text-emerald-400 font-bold shrink-0">
            <Navigation className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-black text-base md:text-lg text-slate-100">
                نظام التتبع الجغرافي والرادار الميداني (GPS Haulage Simulation)
              </h3>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-500/30">
                الحفرة المفتوحة
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              خريطة طبوغرافية تفاعلية لمواقع الشاحنات وحركتها على مسارات الرامب بين مصاطب التحميل ومواقع الكسارات
            </p>
          </div>
        </div>

        {/* Filter Controls */}
        <div className="flex items-center gap-2 mr-auto md:mr-0" onClick={e => e.stopPropagation()}>
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2.5" />
            <input
              type="text"
              value={searchTruckQuery}
              onChange={(e) => setSearchTruckQuery(e.target.value)}
              placeholder="ابحث برقم الدنبر (DT...)"
              className="py-1.5 pr-8 pl-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-slate-200 placeholder:text-slate-500 w-36 md:w-44 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Expanded Body: Interactive Pit Map */}
      {isExpanded && (
        <div className="p-4 border-t border-slate-800 bg-slate-950/80 space-y-3">
          {/* Quick Filters Row */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex flex-wrap items-center gap-1.5">
              {[
                { id: 'ALL', label: 'كافة الأسطول (60 دنبر)' },
                { id: 'HAULING', label: 'في الطريق (Hauling) 🚛' },
                { id: 'LOADING', label: 'جاري التحميل 🚜' },
                { id: 'DUMPING', label: 'تفريغ بالكسارات 🏗️' },
                { id: 'FUELING', label: 'محطة الوقود ⛽' },
                { id: 'STANDBY', label: 'في الطابور ⏳' },
              ].map(f => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => {
                    playClickSound();
                    setFilterMode(f.id as typeof filterMode);
                  }}
                  className={`py-1 px-2.5 rounded-lg font-bold transition-colors cursor-pointer ${
                    filterMode === f.id
                      ? 'bg-emerald-500 text-slate-950 shadow-sm'
                      : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div className="text-[11px] text-slate-400 flex items-center gap-3">
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block"></span> تحميل
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block"></span> نقل
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-sky-400 inline-block"></span> تفويل
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block"></span> عطل/صيانة
              </span>
            </div>
          </div>

          {/* SVG Map Canvas */}
          <div className="relative rounded-2xl bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 border border-slate-800 overflow-hidden shadow-inner">
            <svg
              viewBox="0 0 1000 600"
              className="w-full h-auto max-h-[520px] select-none"
              style={{ minHeight: '380px' }}
            >
              <defs>
                {/* Pit Benches Contour Radial Gradient */}
                <radialGradient id="pitDepthGradient" cx="48%" cy="58%" r="45%">
                  <stop offset="0%" stopColor="#0f172a" />
                  <stop offset="40%" stopColor="#1e293b" />
                  <stop offset="75%" stopColor="#334155" />
                  <stop offset="100%" stopColor="#1e293b" />
                </radialGradient>

                {/* Glowing Filter for Moving Trucks */}
                <filter id="glowEffect" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              {/* Background Pit Terrain Contours */}
              <ellipse cx="500" cy="360" rx="440" ry="210" fill="url(#pitDepthGradient)" stroke="#475569" strokeWidth="2" strokeDasharray="6 4" opacity="0.6" />
              <ellipse cx="490" cy="370" rx="350" ry="160" fill="none" stroke="#64748b" strokeWidth="1.5" strokeDasharray="4 4" opacity="0.5" />
              <ellipse cx="480" cy="380" rx="260" ry="110" fill="none" stroke="#94a3b8" strokeWidth="1.5" opacity="0.4" />
              <ellipse cx="460" cy="410" rx="140" ry="60" fill="#020617" stroke="#cbd5e1" strokeWidth="2" opacity="0.7" />

              {/* Haulage Ramp Paths (connecting pit floor to surface crushers) */}
              {/* Main Ramp Spiral */}
              <path
                d="M 460 410 Q 320 370 280 240 T 220 120"
                fill="none"
                stroke="#f59e0b"
                strokeWidth="7"
                strokeLinecap="round"
                opacity="0.35"
              />
              <path
                d="M 460 410 Q 320 370 280 240 T 220 120"
                fill="none"
                stroke="#fbbf24"
                strokeWidth="2"
                strokeDasharray="8 6"
                strokeLinecap="round"
                opacity="0.8"
              />

              {/* North Waste Dump Ramp */}
              <path
                d="M 510 290 Q 640 210 740 160 T 820 120"
                fill="none"
                stroke="#64748b"
                strokeWidth="5"
                strokeDasharray="6 6"
                opacity="0.4"
              />

              {/* Fuel Station Access Road */}
              <path
                d="M 280 240 Q 360 190 420 160"
                fill="none"
                stroke="#38bdf8"
                strokeWidth="3"
                strokeDasharray="5 5"
                opacity="0.5"
              />

              {/* Zone Landmarks & Stations */}
              {/* Primary Crusher 01 */}
              <g transform={`translate(${ZONES.CRUSHER_01.x}, ${ZONES.CRUSHER_01.y})`}>
                <rect x="-45" y="-22" width="90" height="44" rx="8" fill="#1e293b" stroke="#f59e0b" strokeWidth="2" />
                <text x="0" y="-4" fill="#fbbf24" fontSize="10" fontWeight="bold" textAnchor="middle">الكسارة 01</text>
                <text x="0" y="12" fill="#94a3b8" fontSize="8" textAnchor="middle">RL +240m</text>
              </g>

              {/* Secondary Crusher 02 */}
              <g transform={`translate(${ZONES.CRUSHER_02.x}, ${ZONES.CRUSHER_02.y})`}>
                <rect x="-40" y="-18" width="80" height="36" rx="6" fill="#1e293b" stroke="#ea580c" strokeWidth="1.5" />
                <text x="0" y="-3" fill="#fdba74" fontSize="9" fontWeight="bold" textAnchor="middle">الكسارة 02</text>
                <text x="0" y="10" fill="#94a3b8" fontSize="7" textAnchor="middle">RL +240m</text>
              </g>

              {/* ROM-PAD */}
              <g transform={`translate(${ZONES.ROM_PAD.x}, ${ZONES.ROM_PAD.y})`}>
                <rect x="-38" y="-18" width="76" height="36" rx="6" fill="#1e293b" stroke="#10b981" strokeWidth="1.5" />
                <text x="0" y="-2" fill="#6ee7b7" fontSize="9" fontWeight="bold" textAnchor="middle">ROM-PAD</text>
                <text x="0" y="10" fill="#94a3b8" fontSize="7" textAnchor="middle">خام عالي RL +230m</text>
              </g>

              {/* Waste Dump A */}
              <g transform={`translate(${ZONES.WASTE_DUMP_A.x}, ${ZONES.WASTE_DUMP_A.y})`}>
                <rect x="-45" y="-20" width="90" height="40" rx="8" fill="#1e293b" stroke="#ef4444" strokeWidth="2" />
                <text x="0" y="-3" fill="#fca5a5" fontSize="10" fontWeight="bold" textAnchor="middle">مقلب الصخور A</text>
                <text x="0" y="11" fill="#94a3b8" fontSize="8" textAnchor="middle">North RL +280m</text>
              </g>

              {/* Waste Dump B */}
              <g transform={`translate(${ZONES.WASTE_DUMP_B.x}, ${ZONES.WASTE_DUMP_B.y})`}>
                <rect x="-42" y="-18" width="84" height="36" rx="6" fill="#1e293b" stroke="#ef4444" strokeWidth="1.5" />
                <text x="0" y="-2" fill="#fca5a5" fontSize="9" fontWeight="bold" textAnchor="middle">مقلب الردم B</text>
                <text x="0" y="10" fill="#94a3b8" fontSize="7" textAnchor="middle">South RL +310m</text>
              </g>

              {/* Fuel Station Bay */}
              <g transform={`translate(${ZONES.FUEL_BAY.x}, ${ZONES.FUEL_BAY.y})`}>
                <rect x="-40" y="-20" width="80" height="40" rx="8" fill="#0c4a6e" stroke="#38bdf8" strokeWidth="2" />
                <text x="0" y="-3" fill="#7dd3fc" fontSize="10" fontWeight="bold" textAnchor="middle">⛽ محطة الوقود</text>
                <text x="0" y="11" fill="#bae6fd" fontSize="8" textAnchor="middle">Fuel Bay</text>
              </g>

              {/* Workshop */}
              <g transform={`translate(${ZONES.WORKSHOP.x}, ${ZONES.WORKSHOP.y})`}>
                <rect x="-40" y="-18" width="80" height="36" rx="6" fill="#1e293b" stroke="#94a3b8" strokeWidth="1.5" />
                <text x="0" y="-2" fill="#cbd5e1" fontSize="9" fontWeight="bold" textAnchor="middle">🛠️ ورشة الصيانة</text>
                <text x="0" y="10" fill="#94a3b8" fontSize="7" textAnchor="middle">Workshop</text>
              </g>

              {/* Bench Mining Nodes */}
              {/* North Pit Bench EX08 */}
              <g transform={`translate(${ZONES.NORTH_BENCH.x}, ${ZONES.NORTH_BENCH.y})`}>
                <circle cx="0" cy="0" r="18" fill="#065f46" stroke="#34d399" strokeWidth="2" />
                <text x="0" y="4" fill="#a7f3d0" fontSize="9" fontWeight="bold" textAnchor="middle">EX08</text>
                <text x="0" y="-22" fill="#6ee7b7" fontSize="8" textAnchor="middle">North RL +140m</text>
              </g>

              {/* Central Bench EX09 */}
              <g transform={`translate(${ZONES.CENTRAL_BENCH.x}, ${ZONES.CENTRAL_BENCH.y})`}>
                <circle cx="0" cy="0" r="16" fill="#065f46" stroke="#34d399" strokeWidth="2" />
                <text x="0" y="4" fill="#a7f3d0" fontSize="9" fontWeight="bold" textAnchor="middle">EX09</text>
                <text x="0" y="24" fill="#94a3b8" fontSize="8" textAnchor="middle">Stage 4 RL +110m</text>
              </g>

              {/* Pit Floor Deep Excavator SH02 */}
              <g transform={`translate(${ZONES.PIT_FLOOR.x}, ${ZONES.PIT_FLOOR.y})`}>
                <circle cx="0" cy="0" r="22" fill="#78350f" stroke="#fbbf24" strokeWidth="2.5" />
                <text x="0" y="4" fill="#fde68a" fontSize="10" fontWeight="black" textAnchor="middle">SH02</text>
                <text x="0" y="28" fill="#fcd34d" fontSize="8" fontWeight="bold" textAnchor="middle">قاع الحفرة RL +60m</text>
              </g>

              {/* Deep Pit West EX11 */}
              <g transform={`translate(${ZONES.DEEP_WEST.x}, ${ZONES.DEEP_WEST.y})`}>
                <circle cx="0" cy="0" r="15" fill="#065f46" stroke="#34d399" strokeWidth="1.5" />
                <text x="0" y="4" fill="#a7f3d0" fontSize="8" fontWeight="bold" textAnchor="middle">EX11</text>
              </g>

              {/* East Wall SH03 */}
              <g transform={`translate(${ZONES.EAST_WALL.x}, ${ZONES.EAST_WALL.y})`}>
                <circle cx="0" cy="0" r="16" fill="#881337" stroke="#fb7185" strokeWidth="1.5" />
                <text x="0" y="4" fill="#fecdd3" fontSize="8" fontWeight="bold" textAnchor="middle">SH03</text>
              </g>

              {/* Render Animated Simulated Trucks */}
              {filteredTrucks.map(truck => {
                const isSelected = selectedTruckId === truck.truckId;
                const isBreakdown = truck.status === 'BREAKDOWN';
                const isFueling = truck.status === 'FUELING';
                const isDumping = truck.status === 'DUMPING';
                const isLoading = truck.status === 'LOADING';

                const fillColor = isBreakdown
                  ? '#ef4444'
                  : isFueling
                  ? '#38bdf8'
                  : isDumping
                  ? '#22d3ee'
                  : isLoading
                  ? '#10b981'
                  : '#f59e0b';

                return (
                  <g
                    key={truck.truckId}
                    transform={`translate(${truck.x}, ${truck.y})`}
                    onClick={() => {
                      playClickSound();
                      setSelectedTruckId(truck.truckId);
                    }}
                    className="cursor-pointer transition-transform duration-300 hover:scale-125"
                  >
                    {/* Outer Selection Pulsing Ring */}
                    {isSelected && (
                      <circle cx="0" cy="0" r="18" fill="none" stroke="#f59e0b" strokeWidth="2.5" className="animate-ping" opacity="0.8" />
                    )}

                    {/* Truck Dot Vehicle */}
                    <circle
                      cx="0"
                      cy="0"
                      r={isSelected ? "11" : "8"}
                      fill={fillColor}
                      stroke="#020617"
                      strokeWidth="2"
                      filter="url(#glowEffect)"
                    />

                    {/* Truck ID Label */}
                    <text
                      x="0"
                      y={isSelected ? "-14" : "-10"}
                      fill="#ffffff"
                      fontSize={isSelected ? "9" : "7"}
                      fontWeight="bold"
                      fontFamily="monospace"
                      textAnchor="middle"
                      className="select-none pointer-events-none drop-shadow"
                    >
                      {truck.truckId}
                    </text>
                  </g>
                );
              })}
            </svg>

            {/* Selected Truck Live Inspector Card (Float within map) */}
            {selectedTruck && (
              <div className="absolute bottom-3 right-3 max-w-sm w-full bg-slate-900/95 border-2 border-amber-500 rounded-2xl p-4 shadow-2xl backdrop-blur-md animate-in fade-in zoom-in-95 text-xs text-slate-100">
                <div className="flex items-center justify-between mb-2 pb-2 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <TruckIcon className="w-5 h-5 text-amber-400" />
                    <div>
                      <span className="font-mono font-black text-sm text-amber-400">
                        {selectedTruck.truckId}
                      </span>
                      <span className="text-[10px] text-slate-400 block">
                        CAT 785 Mining Truck (152t)
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedTruckId(null)}
                    className="text-slate-400 hover:text-white p-1"
                  >
                    ✕
                  </button>
                </div>

                <div className="space-y-1.5 mb-3 text-[11px]">
                  <div className="flex justify-between text-slate-400">
                    <span>السائق:</span>
                    <strong className="text-slate-200">{selectedTruck.driverName}</strong>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>الحالة التشغيلية:</span>
                    <span className="font-bold text-emerald-400">{selectedTruck.status}</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>الموقع / الوجهة الحالية:</span>
                    <strong className="text-slate-200 font-bold">{selectedTruck.destinationName}</strong>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>السرعة التقديرية:</span>
                    <strong className="font-mono text-sky-400">{selectedTruck.speedKmh} كم/ساعة</strong>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>الحمولة المنقولة:</span>
                    <strong className="font-mono text-amber-400 font-bold">{selectedTruck.payloadTonnes} طن</strong>
                  </div>
                </div>

                {onSelectTruckForMessage && (
                  <button
                    type="button"
                    onClick={() => {
                      playClickSound();
                      onSelectTruckForMessage(selectedTruck.truckId);
                    }}
                    className="w-full py-2 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-md"
                  >
                    <Radio className="w-3.5 h-3.5" />
                    <span>إرسال تعليمات مباشرة لسائق الدنبر ({selectedTruck.truckId})</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
