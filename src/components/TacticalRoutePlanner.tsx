import React, { useMemo, useRef, useEffect } from 'react';
import {
  REGION_WAYPOINTS,
  MARS_REGIONS,
  HABITAT_BASE,
  NASA_LAYERS,
  calculateRouteTelemetry,
  computeAStarRoute,
  groundHeightAt,
  groundSlopeAt,
  radiationAt,
  waterIceAt,
  type MarsRegionId,
  type NasaLayerId,
  type RoutePoint
} from '../game/marsData';

interface TacticalRoutePlannerProps {
  isOpen: boolean;
  onClose: () => void;
  region: MarsRegionId;
  onSelectRegion: (r: MarsRegionId) => void;
  activeLayer: NasaLayerId;
  onSelectLayer: (layer: NasaLayerId) => void;
  playerPos: { x: number; z: number };
  collectedIds: string[];
  pointA: RoutePoint;
  pointB: RoutePoint;
  avoidSlopes: boolean;
  onToggleAvoidSlopes: (avoid: boolean) => void;
  onSelectEndpoints: (newA: RoutePoint, newB: RoutePoint) => void;
  plannedRoute: RoutePoint[];
  onStartAutoTraverse: () => void;
  solarStormIntensity: number;
}

export const TacticalRoutePlanner: React.FC<TacticalRoutePlannerProps> = ({
  isOpen,
  onClose,
  region,
  onSelectRegion,
  activeLayer,
  onSelectLayer,
  playerPos,
  collectedIds,
  pointA,
  pointB,
  avoidSlopes,
  onToggleAvoidSlopes,
  onSelectEndpoints,
  plannedRoute,
  onStartAutoTraverse,
  solarStormIntensity
}) => {
  const demCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const waypoints = REGION_WAYPOINTS[region];
  const regionSpec = MARS_REGIONS[region];

  const telemetry = useMemo(
    () => calculateRouteTelemetry(plannedRoute, solarStormIntensity, region),
    [plannedRoute, solarStormIntensity, region]
  );

  // Also compute direct-line telemetry for side-by-side A* savings comparison
  const directTelemetry = useMemo(() => {
    const directPts = computeAStarRoute(pointA, pointB, {
      region,
      solarStormIntensity,
      avoidSlopes: false
    });
    return calculateRouteTelemetry(directPts, solarStormIntensity, region);
  }, [pointA, pointB, region, solarStormIntensity]);

  // Render crisp 2D Green-to-Red Slope / Radiation / Water-Ice DEM heatmap onto the background canvas
  useEffect(() => {
    if (!isOpen) return;
    const canvas = demCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = 180;
    const img = ctx.createImageData(size, size);
    const data = img.data;

    for (let py = 0; py < size; py++) {
      const wz = (py / size) * 116 - 58;
      for (let px = 0; px < size; px++) {
        const wx = (px / size) * 116 - 58;
        const slope = groundSlopeAt(wx, wz, region);
        const h = groundHeightAt(wx, wz, region);

        let r = 18;
        let g = 26;
        let b = 38;

        if (activeLayer === 'mola' || activeLayer === 'natural') {
          // Green -> Yellow -> Red slope gradient
          if (slope <= 7.5) {
            const t = slope / 7.5;
            r = Math.round(16 + t * 180);
            g = Math.round(165 + t * 30);
            b = Math.round(110 - t * 80);
          } else if (slope <= 14.0) {
            const t = (slope - 7.5) / 6.5;
            r = Math.round(196 + t * 50);
            g = Math.round(195 - t * 85);
            b = Math.round(30 - t * 10);
          } else {
            const t = Math.min(1, (slope - 14.0) / 6.0);
            r = Math.round(239);
            g = Math.round(110 * (1 - t) + 45 * t);
            b = Math.round(45);
          }
          // Subtle contour line
          const contour = Math.abs(((h * 0.85) % 1 + 1) % 1 - 0.5);
          if (contour < 0.045) {
            r = Math.min(255, r + 35);
            g = Math.min(255, g + 35);
            b = Math.min(255, b + 35);
          } else {
            r = Math.round(r * 0.52);
            g = Math.round(g * 0.52);
            b = Math.round(b * 0.52);
          }
        } else if (activeLayer === 'rad') {
          const rad = radiationAt(wx, wz, solarStormIntensity, region);
          if (rad < 15) {
            r = 16;
            g = 140;
            b = 105;
          } else {
            const t = Math.min(1, (rad - 15) / 35);
            r = Math.round(50 + t * 190);
            g = Math.round(110 * (1 - t) + 35);
            b = 45;
          }
        } else if (activeLayer === 'odyssey') {
          const h2o = waterIceAt(wx, wz, region);
          const t = Math.min(1, Math.max(0, (h2o - 2.0) / 7.5));
          r = Math.round(18 + t * 20);
          g = Math.round(32 + t * 165);
          b = Math.round(55 + t * 190);
        } else {
          r = 45;
          g = 32;
          b = 68;
        }

        const idx = (py * size + px) * 4;
        data[idx] = r;
        data[idx + 1] = g;
        data[idx + 2] = b;
        data[idx + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  }, [isOpen, region, activeLayer, solarStormIntensity]);

  // Sample cross-section profile points along the planned A* route
  const profileSamples = useMemo(() => {
    if (plannedRoute.length < 2) return [];
    const samples: { dist: number; elev: number; slope: number; rad: number }[] = [];
    const totalSamples = 32;

    let totalLen = 0;
    for (let i = 0; i < plannedRoute.length - 1; i++) {
      totalLen += Math.hypot(
        plannedRoute[i + 1].x - plannedRoute[i].x,
        plannedRoute[i + 1].z - plannedRoute[i].z
      );
    }
    if (totalLen < 1) return [];

    for (let s = 0; s <= totalSamples; s++) {
      const targetD = (s / totalSamples) * totalLen;
      let curD = 0;
      let sx = plannedRoute[0].x;
      let sz = plannedRoute[0].z;

      for (let i = 0; i < plannedRoute.length - 1; i++) {
        const a = plannedRoute[i];
        const b = plannedRoute[i + 1];
        const seg = Math.hypot(b.x - a.x, b.z - a.z);
        if (curD + seg >= targetD || i === plannedRoute.length - 2) {
          const t = seg > 0 ? Math.min(1, Math.max(0, (targetD - curD) / seg)) : 0;
          sx = a.x + (b.x - a.x) * t;
          sz = a.z + (b.z - a.z) * t;
          break;
        }
        curD += seg;
      }

      samples.push({
        dist: Math.round(targetD),
        elev: Number((regionSpec.baseElevationMeters + groundHeightAt(sx, sz, region) * 4.5).toFixed(1)),
        slope: Number(groundSlopeAt(sx, sz, region).toFixed(1)),
        rad: radiationAt(sx, sz, solarStormIntensity, region)
      });
    }
    return samples;
  }, [plannedRoute, region, regionSpec.baseElevationMeters, solarStormIntensity]);

  if (!isOpen) return null;

  const worldToSvg = (wx: number, wz: number) => {
    const svgX = ((wx + 58) / 116) * 360;
    const svgY = ((wz + 58) / 116) * 360;
    return { x: Math.max(8, Math.min(352, svgX)), y: Math.max(8, Math.min(352, svgY)) };
  };

  const handleMapClick = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = (e.clientX - rect.left) / rect.width;
    const relY = (e.clientY - rect.top) / rect.height;
    const wx = Math.round((relX * 116 - 58) * 10) / 10;
    const wz = Math.round((relY * 116 - 58) * 10) / 10;

    // Snap to nearest science POI if within 6m
    for (const wp of waypoints) {
      if (Math.hypot(wp.x - wx, wp.z - wz) < 6.0) {
        onSelectEndpoints(pointA, { x: wp.x, z: wp.z, label: wp.code });
        return;
      }
    }
    if (Math.hypot(HABITAT_BASE.x - wx, HABITAT_BASE.z - wz) < 6.0) {
      onSelectEndpoints(pointA, { x: HABITAT_BASE.x, z: HABITAT_BASE.z, label: 'HAB-01' });
      return;
    }

    onSelectEndpoints(pointA, { x: wx, z: wz, label: `TARGET (${Math.round(wx)},${Math.round(wz)})` });
  };

  const layerSpec = NASA_LAYERS[activeLayer];
  const directPtA = worldToSvg(pointA.x, pointA.z);
  const directPtB = worldToSvg(pointB.x, pointB.z);

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center p-3 md:p-5 bg-[#07090E]/88 pointer-events-auto"
      role="dialog"
      aria-modal="true"
      aria-label="A* Pathfinding and NASA Multi-Mission GIS Route Planner"
    >
      <div className="w-full max-w-5xl bg-[#0B0E17] border border-slate-800 rounded-lg shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 border-b border-slate-800 bg-[#0F1420]">
          <div>
            <div className="text-[11px] font-mono text-amber-400 tracking-wider uppercase">
              A* AUTONOMOUS PATHFINDING &amp; MULTI-MISSION GIS · {regionSpec.name.toUpperCase()} ({regionSpec.coordinates})
            </div>
            <h2
              className="text-lg font-bold tracking-tight text-slate-100"
              style={{ fontFamily: "'Chakra Petch', sans-serif" }}
            >
              Martian Traverse Route Computer (Point A → Point B Slope Avoidance)
            </h2>
          </div>

          <div className="flex items-center gap-2">
            {/* Region Switcher inside Planner */}
            <div className="flex items-center bg-[#0B0E17] p-0.5 rounded border border-slate-800">
              {(['jezero', 'marineris'] as MarsRegionId[]).map((rId) => (
                <button
                  key={rId}
                  type="button"
                  onClick={() => onSelectRegion(rId)}
                  className={`px-2.5 py-1 text-xs font-mono rounded transition-colors whitespace-nowrap shrink-0 ${
                    region === rId
                      ? 'bg-cyan-500 text-slate-950 font-bold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {rId === 'jezero' ? 'Jezero Crater' : 'Valles Marineris'}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => {
                onStartAutoTraverse();
                onClose();
              }}
              className="px-3.5 py-1.5 text-xs font-mono font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded transition-colors whitespace-nowrap shrink-0"
            >
              Auto-Pilot EVA Along A* Path
            </button>

            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 text-xs font-semibold bg-amber-500 text-slate-950 rounded hover:bg-amber-400 transition-colors whitespace-nowrap shrink-0"
            >
              Upload to 3D Visor [T / Esc]
            </button>
          </div>
        </div>

        {/* Main Content Split */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 p-5 overflow-y-auto">
          {/* Left Column: Live 2D Slope-Gradient DEM Heatmap + A* Route Overlay */}
          <div className="lg:col-span-5 flex flex-col gap-2.5">
            <div className="flex items-center justify-between text-xs text-slate-300">
              <span>Click any POI or map location to set Point B</span>
              <span className="font-mono text-emerald-400">
                {avoidSlopes ? 'A* Slope-Avoidance ON' : 'Direct Line Mode'}
              </span>
            </div>

            <div className="relative aspect-square w-full max-w-[360px] mx-auto bg-[#111622] border border-slate-700 rounded overflow-hidden shadow-inner">
              {/* Underlying 2D Green-to-Red Slope / Radiation / Ice Heatmap Canvas */}
              <canvas
                ref={demCanvasRef}
                width={180}
                height={180}
                className="absolute inset-0 w-full h-full object-cover pointer-events-none"
              />

              <svg
                viewBox="0 0 360 360"
                className="relative z-10 w-full h-full cursor-crosshair select-none"
                onClick={handleMapClick}
                aria-label="Interactive A* Pathfinding Topographic Map"
              >
                {/* Graticule Grid */}
                <defs>
                  <pattern id="gis-grid-astar" width="36" height="36" patternUnits="userSpaceOnUse">
                    <path d="M 36 0 L 0 0 0 36" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
                  </pattern>
                </defs>
                <rect width="360" height="360" fill="url(#gis-grid-astar)" />

                {/* Direct Euclidean Reference Line (dashed red) when A* is active to show detour */}
                {avoidSlopes && (
                  <line
                    x1={directPtA.x}
                    y1={directPtA.y}
                    x2={directPtB.x}
                    y2={directPtB.y}
                    stroke="rgba(239,68,68,0.55)"
                    strokeWidth="1.5"
                    strokeDasharray="3 3"
                  />
                )}

                {/* Computed A* Traverse Polyline */}
                {plannedRoute.length >= 2 && (
                  <polyline
                    fill="none"
                    stroke={avoidSlopes ? '#10B981' : '#EF4444'}
                    strokeWidth="3.2"
                    points={plannedRoute
                      .map((pt) => {
                        const p = worldToSvg(pt.x, pt.z);
                        return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
                      })
                      .join(' ')}
                  />
                )}

                {/* Habitat Base HAB-01 */}
                {(() => {
                  const hab = worldToSvg(HABITAT_BASE.x, HABITAT_BASE.z);
                  return (
                    <g>
                      <circle cx={hab.x} cy={hab.y} r="9" fill="rgba(16,185,129,0.3)" stroke="#10B981" strokeWidth="2" />
                      <text x={hab.x + 11} y={hab.y + 3} fill="#A7F3D0" fontSize="9.5" fontFamily="monospace" fontWeight="bold">
                        HAB-01 (Base)
                      </text>
                    </g>
                  );
                })()}

                {/* 5 NASA Science POIs */}
                {waypoints.map((wp) => {
                  const p = worldToSvg(wp.x, wp.z);
                  const done = collectedIds.includes(wp.id);
                  const isTargetB = Math.hypot(pointB.x - wp.x, pointB.z - wp.z) < 2.5;
                  return (
                    <g key={wp.id}>
                      <circle
                        cx={p.x}
                        cy={p.y}
                        r={isTargetB ? '8.5' : '6.5'}
                        fill={done ? 'rgba(16,185,129,0.45)' : isTargetB ? 'rgba(245,158,11,0.5)' : 'rgba(15,23,42,0.75)'}
                        stroke={done ? '#10B981' : isTargetB ? '#F59E0B' : '#38BDF8'}
                        strokeWidth="2"
                      />
                      <text x={p.x + 10} y={p.y + 3} fill="#F8FAFC" fontSize="9.5" fontFamily="monospace" fontWeight="bold">
                        {wp.code} {done ? '✓' : ''}
                      </text>
                    </g>
                  );
                })}

                {/* Point A Marker */}
                <g>
                  <circle cx={directPtA.x} cy={directPtA.y} r="6" fill="#38BDF8" stroke="#0B0E17" strokeWidth="2" />
                  <text x={directPtA.x - 8} y={directPtA.y - 9} fill="#38BDF8" fontSize="10" fontFamily="monospace" fontWeight="bold">
                    A
                  </text>
                </g>

                {/* Point B Marker */}
                <g>
                  <circle cx={directPtB.x} cy={directPtB.y} r="6.5" fill="#F59E0B" stroke="#0B0E17" strokeWidth="2" />
                  <text x={directPtB.x - 8} y={directPtB.y - 9} fill="#F59E0B" fontSize="10" fontFamily="monospace" fontWeight="bold">
                    B
                  </text>
                </g>
              </svg>
            </div>

            {/* Legend for Green-to-Red Slope Gradient */}
            <div className="flex items-center justify-between px-2 py-1.5 bg-[#111622] border border-slate-800 rounded text-[11px] font-mono text-slate-300">
              <span className="text-emerald-400">● 0-8° Safe</span>
              <span className="text-yellow-400">● 8-14° Moderate</span>
              <span className="text-orange-400">▲ 14-18° Steep</span>
              <span className="text-rose-400">✖ &gt;18° Cliff</span>
            </div>
          </div>

          {/* Right Column: Point A / Point B Selector, A* Mode Toggle, Layer Switcher & Telemetry */}
          <div className="lg:col-span-7 flex flex-col justify-between gap-3.5">
            {/* Point A -> Point B & A* Algorithm Selector */}
            <div className="p-3 bg-[#111622] border border-slate-800 rounded-lg space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs font-mono uppercase text-slate-400">
                  1. Select Point A (Origin) &amp; Point B (Science Target POI)
                </div>
                <div className="flex items-center gap-1 bg-[#0B0E17] p-0.5 rounded border border-slate-800">
                  <button
                    type="button"
                    onClick={() => onToggleAvoidSlopes(true)}
                    className={`px-2.5 py-1 text-xs font-mono rounded transition-colors whitespace-nowrap shrink-0 ${
                      avoidSlopes
                        ? 'bg-emerald-500 text-slate-950 font-bold'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    A* Safe Route (Avoid Steep Slopes)
                  </button>
                  <button
                    type="button"
                    onClick={() => onToggleAvoidSlopes(false)}
                    className={`px-2.5 py-1 text-xs font-mono rounded transition-colors whitespace-nowrap shrink-0 ${
                      !avoidSlopes
                        ? 'bg-rose-500 text-white font-bold'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Direct Line (Unfiltered)
                  </button>
                </div>
              </div>

              {/* Point A & Point B Quick Buttons */}
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs font-mono text-sky-400 mr-1">Point A:</span>
                <button
                  type="button"
                  onClick={() =>
                    onSelectEndpoints({ x: HABITAT_BASE.x, z: HABITAT_BASE.z, label: 'HAB-01' }, pointB)
                  }
                  className={`px-2 py-1 text-xs font-mono rounded border transition-colors whitespace-nowrap shrink-0 ${
                    Math.hypot(pointA.x - HABITAT_BASE.x, pointA.z - HABITAT_BASE.z) < 2
                      ? 'bg-sky-500/25 border-sky-400 text-sky-200 font-bold'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  HAB-01 Base
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onSelectEndpoints(
                      { x: Math.round(playerPos.x), z: Math.round(playerPos.z), label: 'EVA-POS' },
                      pointB
                    )
                  }
                  className={`px-2 py-1 text-xs font-mono rounded border transition-colors whitespace-nowrap shrink-0 ${
                    Math.hypot(pointA.x - HABITAT_BASE.x, pointA.z - HABITAT_BASE.z) >= 2
                      ? 'bg-sky-500/25 border-sky-400 text-sky-200 font-bold'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Current Suit Pos ({Math.round(playerPos.x)},{Math.round(playerPos.z)})
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs font-mono text-amber-400 mr-1">Point B (Target POI):</span>
                {waypoints.map((wp) => {
                  const selected = Math.hypot(pointB.x - wp.x, pointB.z - wp.z) < 2.5;
                  return (
                    <button
                      key={wp.id}
                      type="button"
                      onClick={() =>
                        onSelectEndpoints(pointA, { x: wp.x, z: wp.z, label: wp.code })
                      }
                      className={`px-2 py-1 text-xs font-mono rounded border transition-colors whitespace-nowrap shrink-0 ${
                        selected
                          ? 'bg-amber-500 text-slate-950 border-amber-400 font-bold'
                          : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      {wp.code} · {wp.categoryLabel.split(' ')[0]}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Active NASA Layer Switcher */}
            <div>
              <div className="text-xs font-mono uppercase text-slate-400 mb-1.5">
                2. NASA Orbital &amp; Surface Data Layer Overlay
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 p-1 bg-[#111622] border border-slate-800 rounded-lg">
                {(['mola', 'rad', 'odyssey', 'natural'] as NasaLayerId[]).map((id) => {
                  const item = NASA_LAYERS[id];
                  const active = activeLayer === id;
                  const compactLabel =
                    id === 'mola'
                      ? 'Slope (Grn-Red)'
                      : id === 'rad'
                      ? 'RAD & Storms'
                      : id === 'odyssey'
                      ? 'Ice & POIs'
                      : 'HiRISE Relief';
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => onSelectLayer(id)}
                      className={`px-1.5 py-2 text-[11px] font-mono font-medium rounded transition-colors text-center whitespace-nowrap shrink-0 ${
                        active ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-300 hover:bg-slate-800/70'
                      }`}
                    >
                      [{item.keyBind}] {compactLabel}
                    </button>
                  );
                })}
              </div>
              <div className="mt-1.5 px-3 py-2 bg-[#111622] border border-slate-800/80 rounded text-xs text-slate-300">
                <span className="font-semibold text-slate-100">{layerSpec.fullName}: </span>
                <span className="text-slate-400">{layerSpec.description}</span>
              </div>
            </div>

            {/* A* Resource & Safety Telemetry Grid */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-mono uppercase text-slate-400">
                  3. A* Pathfinding Resource &amp; Slope Telemetry
                </span>
                <span
                  className={`text-xs font-mono font-semibold ${
                    telemetry.safetyRating === 'NOMINAL'
                      ? 'text-emerald-400'
                      : telemetry.safetyRating === 'CAUTION'
                      ? 'text-amber-400'
                      : 'text-rose-400'
                  }`}
                >
                  {telemetry.safetyRating === 'NOMINAL'
                    ? '● SAFE A* CORRIDOR'
                    : telemetry.safetyRating === 'CAUTION'
                    ? '▲ MODERATE GRADE'
                    : '✖ STEEP CLIFF HAZARD'}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                <div className="p-2.5 bg-[#111622] border border-slate-800 rounded">
                  <div className="text-[10px] font-mono text-slate-400 uppercase">PEAK SLOPE / DIST</div>
                  <div className="text-lg font-mono font-bold text-emerald-400 tabular-nums">
                    {telemetry.maxSlopeDeg}°
                    <span className="text-xs text-slate-400 ml-1.5">{telemetry.totalDistanceMeters}m</span>
                  </div>
                  {avoidSlopes && directTelemetry.maxSlopeDeg > telemetry.maxSlopeDeg && (
                    <div className="text-[10px] font-mono text-slate-400">
                      Direct line hits <span className="text-rose-400">{directTelemetry.maxSlopeDeg}°</span> cliff
                    </div>
                  )}
                </div>

                <div className="p-2.5 bg-[#111622] border border-slate-800 rounded">
                  <div className="text-[10px] font-mono text-slate-400 uppercase">SUIT O2 &amp; POWER COST</div>
                  <div className="text-lg font-mono font-bold text-cyan-400 tabular-nums">
                    -{telemetry.estimatedO2Percent}%
                    <span className="text-xs text-slate-400 ml-1">O2</span>
                    <span className="text-xs text-amber-300 ml-1.5">-{telemetry.estimatedBatteryPercent}% kWh</span>
                  </div>
                  <div className="text-[10px] font-mono text-emerald-400">
                    Elev Gain +{telemetry.elevationGainMeters}m
                  </div>
                </div>

                <div className="p-2.5 bg-[#111622] border border-slate-800 rounded">
                  <div className="text-[10px] font-mono text-slate-400 uppercase">RAD DOSE / H2O YIELD</div>
                  <div className="text-lg font-mono font-bold text-rose-400 tabular-nums">
                    {telemetry.estimatedRadiationUSv}
                    <span className="text-xs text-slate-400 ml-1">uSv</span>
                    <span className="text-xs text-cyan-300 ml-1.5">{telemetry.waterDiscoveryPotential}% H2O</span>
                  </div>
                  <div className="text-[10px] font-mono text-slate-400">
                    Avg Grade {telemetry.avgSlopeDeg}°
                  </div>
                </div>
              </div>
            </div>

            {/* MOLA Elevation & Slope Cross-Section SVG Chart */}
            <div className="p-3 bg-[#111622] border border-slate-800 rounded">
              <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 mb-1">
                <span>A* TOPOGRAPHIC ELEVATION PROFILE (EMERALD) &amp; SLOPE GRADE (AMBER)</span>
                <span>MAX GRADE: {telemetry.maxSlopeDeg}°</span>
              </div>
              {profileSamples.length > 1 ? (
                <svg viewBox="0 0 400 78" className="w-full h-20 overflow-visible">
                  <line x1="0" y1="68" x2="400" y2="68" stroke="#1E293B" strokeWidth="1" />
                  <line x1="0" y1="34" x2="400" y2="34" stroke="#1E293B" strokeDasharray="3 3" strokeWidth="1" />
                  <polyline
                    fill="none"
                    stroke="#10B981"
                    strokeWidth="2.4"
                    points={profileSamples
                      .map((s, idx) => {
                        const x = (idx / (profileSamples.length - 1)) * 400;
                        const normY = Math.min(1, Math.max(0, (s.elev - (regionSpec.baseElevationMeters - 10)) / 48));
                        const y = 66 - normY * 54;
                        return `${x.toFixed(1)},${y.toFixed(1)}`;
                      })
                      .join(' ')}
                  />
                  <polyline
                    fill="none"
                    stroke="#F59E0B"
                    strokeWidth="1.5"
                    strokeDasharray="4 2"
                    points={profileSamples
                      .map((s, idx) => {
                        const x = (idx / (profileSamples.length - 1)) * 400;
                        const normSlope = Math.min(1, Math.max(0, s.slope / 25));
                        const y = 66 - normSlope * 54;
                        return `${x.toFixed(1)},${y.toFixed(1)}`;
                      })
                      .join(' ')}
                  />
                </svg>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
