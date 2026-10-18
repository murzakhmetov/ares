import React from 'react';
import {
  NASA_LAYERS,
  REGION_WAYPOINTS,
  MARS_REGIONS,
  type MarsRegionId,
  type NasaLayerId,
  type ScienceWaypoint,
  type ViewMode
} from '../game/marsData';

export interface LiveTelemetryState {
  suitHp: number;
  o2: number;
  o2Ghost: number;
  battery: number;
  batteryGhost: number;
  radiationDoseUSv: number;
  currentRadRateUSv: number;
  elevationMeters: number;
  slopeDeg: number;
  waterWtPercent: number;
  windSpeedMs: number;
  score: number;
  collectedIds: string[];
  nearbyWaypoint: ScienceWaypoint | null;
  nearHabitat: boolean;
  statusBanner: string | null;
  solarStormActive: boolean;
  autoPilotActive: boolean;
  playerX: number;
  playerZ: number;
}

interface EvaHudProps {
  telemetry: LiveTelemetryState;
  viewMode: ViewMode;
  onToggleViewMode: (mode: ViewMode) => void;
  region: MarsRegionId;
  onSelectRegion: (region: MarsRegionId) => void;
  activeLayer: NasaLayerId;
  onSelectLayer: (layer: NasaLayerId) => void;
  targetWaypointId: string;
  onSelectTargetPoi: (wp: ScienceWaypoint) => void;
  onTriggerSample: () => void;
  onTriggerBoost: () => void;
  onToggleAutoPilot: () => void;
  onToggleStorm: () => void;
  onOpenRoutePlanner: () => void;
  muted: boolean;
  onToggleMute: () => void;
  onPause: () => void;
  onRestart: () => void;
  dockCollapsed: boolean;
  onToggleDock: () => void;
}

export const EvaHud: React.FC<EvaHudProps> = ({
  telemetry,
  viewMode,
  onToggleViewMode,
  region,
  onSelectRegion,
  activeLayer,
  onSelectLayer,
  targetWaypointId,
  onSelectTargetPoi,
  onTriggerSample,
  onTriggerBoost,
  onToggleAutoPilot,
  onToggleStorm,
  onOpenRoutePlanner,
  muted,
  onToggleMute,
  onPause,
  onRestart,
  dockCollapsed,
  onToggleDock
}) => {
  const waypoints = REGION_WAYPOINTS[region];
  const regionSpec = MARS_REGIONS[region];

  const renderVitalitySockets = () => {
    const sockets = [];
    for (let i = 0; i < 5; i++) {
      const pipMin = i * 20;
      const pipVal = Math.max(0, Math.min(20, telemetry.suitHp - pipMin));
      const state: 'full' | 'cracked' | 'empty' =
        pipVal >= 14 ? 'full' : pipVal > 0 ? 'cracked' : 'empty';

      sockets.push(
        <svg key={i} viewBox="0 0 24 24" className="w-5 h-5 shrink-0" aria-hidden="true">
          <polygon
            points="12,2 21,7 21,17 12,22 3,17 3,7"
            fill="#0B0E17"
            stroke={state === 'empty' ? '#334155' : state === 'cracked' ? '#F59E0B' : '#10B981'}
            strokeWidth="2"
          />
          {state === 'full' && (
            <>
              <polygon points="12,5 18,8.5 18,15.5 12,19 6,15.5 6,8.5" fill="#10B981" />
              <polyline points="8,9 12,6.5 16,9" fill="none" stroke="#A7F3D0" strokeWidth="1.5" />
            </>
          )}
          {state === 'cracked' && (
            <>
              <polygon points="12,5 18,8.5 18,15.5 12,19 6,15.5 6,8.5" fill="#F59E0B" />
              <polyline points="9,6 13,12 10,18" fill="none" stroke="#0B0E17" strokeWidth="2" />
            </>
          )}
        </svg>
      );
    }
    return sockets;
  };

  const nextTarget =
    waypoints.find((w) => w.id === targetWaypointId) ||
    waypoints.find((w) => !telemetry.collectedIds.includes(w.id)) ||
    null;
  const distToNext = nextTarget
    ? Math.round(Math.hypot(nextTarget.x - telemetry.playerX, nextTarget.z - telemetry.playerZ))
    : 0;

  const isLowSuit = telemetry.suitHp < 35 || telemetry.o2 < 25;

  return (
    <div className="fixed inset-0 z-20 pointer-events-none select-none flex flex-col justify-between p-3.5 md:p-5">
      {isLowSuit && (
        <div
          className="fixed inset-0 pointer-events-none"
          style={{ boxShadow: 'inset 0 0 90px rgba(239, 68, 68, 0.42)' }}
        />
      )}

      {/* TOP PERIMETER ROW */}
      <div className="flex items-start justify-between gap-4">
        {/* Top-Left Cluster: PLSS Vitality Pips, O2, Battery & Local NASA Sensor Readout */}
        <div className="bg-[#0B0E17]/92 border border-slate-800/90 rounded-lg p-3 shadow-xl pointer-events-auto max-w-sm">
          <div className="flex items-center justify-between gap-4 mb-2">
            <div>
              <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                PLSS INTEGRITY · {regionSpec.name.toUpperCase()}
              </div>
              <div className="flex items-center gap-1 mt-0.5" aria-label={`Suit Integrity ${Math.round(telemetry.suitHp)}%`}>
                {renderVitalitySockets()}
              </div>
            </div>

            <div className="text-right">
              <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                RAD FLUX
              </div>
              <div
                className={`text-xl font-mono font-bold tabular-nums leading-none mt-0.5 ${
                  telemetry.currentRadRateUSv > 40
                    ? 'text-rose-400'
                    : telemetry.currentRadRateUSv < 15
                    ? 'text-emerald-400'
                    : 'text-amber-400'
                }`}
              >
                {Math.round(telemetry.currentRadRateUSv)}
                <span className="text-[11px] font-normal text-slate-400 ml-1">uSv/h</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-2">
            <div>
              <div className="flex items-baseline justify-between">
                <span className="text-[10px] font-mono uppercase text-slate-400">O2 RESERVE</span>
                <span className="text-base font-mono font-bold text-cyan-400 tabular-nums">
                  {Math.round(telemetry.o2)}%
                </span>
              </div>
              <div className="w-full h-2 bg-slate-900 rounded overflow-hidden relative border border-slate-800">
                <div
                  className="h-full bg-amber-400/50 transition-all duration-300"
                  style={{ width: `${Math.max(0, Math.min(100, telemetry.o2Ghost))}%` }}
                />
                <div
                  className="h-full bg-cyan-400 absolute top-0 left-0"
                  style={{ width: `${Math.max(0, Math.min(100, telemetry.o2))}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex items-baseline justify-between">
                <span className="text-[10px] font-mono uppercase text-slate-400">SUIT POWER</span>
                <span className="text-base font-mono font-bold text-amber-400 tabular-nums">
                  {Math.round(telemetry.battery)}%
                </span>
              </div>
              <div className="w-full h-2 bg-slate-900 rounded overflow-hidden relative border border-slate-800">
                <div
                  className="h-full bg-rose-400/50 transition-all duration-300"
                  style={{ width: `${Math.max(0, Math.min(100, telemetry.batteryGhost))}%` }}
                />
                <div
                  className="h-full bg-amber-400 absolute top-0 left-0"
                  style={{ width: `${Math.max(0, Math.min(100, telemetry.battery))}%` }}
                />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 text-[11px] font-mono text-slate-300 tabular-nums pt-1 border-t border-slate-800/80">
            <span>ELEV {Math.round(telemetry.elevationMeters)}m</span>
            <span aria-hidden="true">·</span>
            <span
              className={
                telemetry.slopeDeg > 16
                  ? 'text-rose-400 font-bold'
                  : telemetry.slopeDeg > 10
                  ? 'text-amber-300'
                  : 'text-emerald-400'
              }
            >
              SLOPE {Math.round(telemetry.slopeDeg)}°
            </span>
            <span aria-hidden="true">·</span>
            <span className="text-cyan-300">H2O {telemetry.waterWtPercent.toFixed(1)}%</span>
          </div>
        </div>

        {/* Center-Top Contextual Mode Switcher (3D Mars Globe <-> Local 3D Terrain) & Alerts */}
        <div className="flex flex-col items-center gap-2 pointer-events-none">
          {/* 3D Orbital Globe vs Local Terrain Zoom Bar */}
          <div className="flex items-center gap-1 p-1 bg-[#0B0E17]/94 border border-slate-800 rounded-lg shadow-xl pointer-events-auto">
            <button
              type="button"
              tabIndex={-1}
              onClick={(e) => {
                e.currentTarget.blur();
                onToggleViewMode(viewMode === 'globe' ? 'terrain' : 'globe');
              }}
              className={`px-3 py-1.5 text-xs font-mono font-bold rounded transition-colors whitespace-nowrap shrink-0 ${
                viewMode === 'globe'
                  ? 'bg-amber-500 text-slate-950'
                  : 'bg-[#131926] text-amber-400 hover:bg-slate-800 border border-amber-500/40'
              }`}
            >
              [G] {viewMode === 'globe' ? '● 3D Mars Globe Active' : 'Zoom Out: 3D Mars Globe'}
            </button>

            <button
              type="button"
              tabIndex={-1}
              onClick={(e) => {
                e.currentTarget.blur();
                onSelectRegion('jezero');
                onToggleViewMode('terrain');
              }}
              className={`px-3 py-1.5 text-xs font-mono rounded transition-colors whitespace-nowrap shrink-0 ${
                viewMode === 'terrain' && region === 'jezero'
                  ? 'bg-emerald-500 text-slate-950 font-bold'
                  : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              Zoom: Jezero Crater (18.4°N)
            </button>

            <button
              type="button"
              tabIndex={-1}
              onClick={(e) => {
                e.currentTarget.blur();
                onSelectRegion('marineris');
                onToggleViewMode('terrain');
              }}
              className={`px-3 py-1.5 text-xs font-mono rounded transition-colors whitespace-nowrap shrink-0 ${
                viewMode === 'terrain' && region === 'marineris'
                  ? 'bg-cyan-500 text-slate-950 font-bold'
                  : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              Zoom: Valles Marineris (6.5°S)
            </button>
          </div>

          {telemetry.nearbyWaypoint && viewMode === 'terrain' && (
            <div className="px-4 py-2 bg-[#0B0E17]/94 border border-cyan-500/80 rounded-lg shadow-lg pointer-events-auto flex items-center gap-3">
              <div>
                <div className="text-[10px] font-mono text-cyan-400 uppercase">
                  POI REACHED · {telemetry.nearbyWaypoint.code} ({telemetry.nearbyWaypoint.categoryLabel})
                </div>
                <div className="text-sm font-bold text-slate-100">{telemetry.nearbyWaypoint.name}</div>
              </div>
              <button
                type="button"
                tabIndex={-1}
                onClick={(e) => {
                  e.currentTarget.blur();
                  onTriggerSample();
                }}
                className="px-3 py-1.5 text-xs font-mono font-bold bg-cyan-400 hover:bg-cyan-300 text-slate-950 rounded transition-colors whitespace-nowrap shrink-0"
              >
                [E] Drill Core (+{telemetry.nearbyWaypoint.sciencePoints})
              </button>
            </div>
          )}

          {telemetry.statusBanner && (
            <div className="hidden md:block px-3.5 py-1 bg-[#0B0E17]/92 border border-amber-500/60 rounded text-xs font-mono text-amber-300">
              {telemetry.statusBanner}
            </div>
          )}
        </div>

        {/* Top-Right Cluster: Science Progress, Next Target & Utility Buttons */}
        <div className="flex items-start gap-2.5 pointer-events-auto">
          <div className="bg-[#0B0E17]/92 border border-slate-800/90 rounded-lg px-3.5 py-2.5 shadow-xl text-right">
            <div className="flex items-center justify-end gap-4">
              <div>
                <div className="text-[10px] font-mono uppercase text-slate-400">POIS SAMPLED</div>
                <div className="text-xl font-mono font-bold text-cyan-400 tabular-nums leading-none mt-0.5">
                  {telemetry.collectedIds.length}/{waypoints.length}
                </div>
              </div>
              <div>
                <div className="text-[10px] font-mono uppercase text-slate-400">SCIENCE SCORE</div>
                <div className="text-xl font-mono font-bold text-amber-400 tabular-nums leading-none mt-0.5">
                  {Math.round(telemetry.score)}
                </div>
              </div>
            </div>
            <div className="text-[11px] font-mono text-slate-300 mt-1.5 pt-1.5 border-t border-slate-800/80 tabular-nums">
              {nextTarget ? (
                <span>
                  A* TARGET: <strong className="text-emerald-400">{nextTarget.code}</strong> ({distToNext}m)
                </span>
              ) : (
                <span className="text-emerald-400 font-semibold">RETURN TO HAB-01 AIRLOCK</span>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                tabIndex={-1}
                aria-label="Open Tactical NASA Route Planner"
                title="A* Route Planner [T]"
                onClick={(e) => {
                  e.currentTarget.blur();
                  onOpenRoutePlanner();
                }}
                className="w-9 h-9 flex items-center justify-center bg-[#0B0E17]/92 hover:bg-slate-800 border border-slate-700 rounded text-amber-400 transition-colors"
              >
                <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
                  <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21" />
                  <line x1="9" y1="3" x2="9" y2="18" />
                  <line x1="15" y1="6" x2="15" y2="21" />
                </svg>
              </button>

              <button
                type="button"
                tabIndex={-1}
                aria-label={muted ? 'Unmute Audio' : 'Mute Audio'}
                title="Mute / Unmute Audio [M]"
                onClick={(e) => {
                  e.currentTarget.blur();
                  onToggleMute();
                }}
                className="w-9 h-9 flex items-center justify-center bg-[#0B0E17]/92 hover:bg-slate-800 border border-slate-700 rounded text-slate-200 transition-colors"
              >
                {muted ? (
                  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                    <line x1="23" y1="9" x2="17" y2="15" />
                    <line x1="17" y1="9" x2="23" y2="15" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                    <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                  </svg>
                )}
              </button>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                tabIndex={-1}
                aria-label="Pause Game"
                title="Pause Game [P / Esc]"
                onClick={(e) => {
                  e.currentTarget.blur();
                  onPause();
                }}
                className="w-9 h-9 flex items-center justify-center bg-[#0B0E17]/92 hover:bg-slate-800 border border-slate-700 rounded text-slate-200 transition-colors"
              >
                <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="6" y="4" width="4" height="16" />
                  <rect x="14" y="4" width="4" height="16" />
                </svg>
              </button>

              <button
                type="button"
                tabIndex={-1}
                aria-label="Restart EVA"
                title="Restart EVA [R]"
                onClick={(e) => {
                  e.currentTarget.blur();
                  onRestart();
                }}
                className="w-9 h-9 flex items-center justify-center bg-[#0B0E17]/92 hover:bg-slate-800 border border-slate-700 rounded text-slate-200 transition-colors"
              >
                <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="1 4 1 10 7 10" />
                  <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* UNIFIED COLLAPSIBLE BOTTOM CONTROL DOCK */}
      <div className="w-full flex flex-col items-center pointer-events-none">
        <button
          type="button"
          tabIndex={-1}
          onClick={(e) => {
            e.currentTarget.blur();
            onToggleDock();
          }}
          className="px-3 py-1 bg-[#0B0E17]/92 border border-b-0 border-slate-800 rounded-t text-[11px] font-mono text-slate-300 hover:text-amber-400 transition-colors pointer-events-auto flex items-center gap-1.5"
        >
          <svg viewBox="0 0 16 16" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2">
            {dockCollapsed ? <polyline points="3 10 8 5 13 10" /> : <polyline points="3 6 8 11 13 6" />}
          </svg>
          <span>{dockCollapsed ? 'Show NASA Layers & A* Pathfinding Dock [H]' : 'Hide Controls [H]'}</span>
        </button>

        {!dockCollapsed && (
          <div className="w-full max-w-[960px] bg-[#0B0E17]/95 border border-slate-800 rounded-lg px-3.5 py-2.5 shadow-2xl pointer-events-auto flex flex-col gap-2">
            {/* Row 1: NASA Data Layers + Dust Storm Toggle */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="NASA Science Mission Layers">
                {(['mola', 'rad', 'odyssey', 'natural'] as NasaLayerId[]).map((id) => {
                  const layer = NASA_LAYERS[id];
                  const isActive = activeLayer === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      tabIndex={-1}
                      onClick={(e) => {
                        e.currentTarget.blur();
                        onSelectLayer(id);
                      }}
                      className={`px-2.5 py-1.5 rounded text-xs font-mono transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                        isActive
                          ? 'bg-amber-500 text-slate-950 font-bold'
                          : 'bg-[#131926] hover:bg-slate-800 text-slate-300 border border-slate-800'
                      }`}
                    >
                      <span>[{layer.keyBind}]</span>
                      <span>{layer.shortName}</span>
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={(e) => {
                    e.currentTarget.blur();
                    onToggleStorm();
                  }}
                  className={`px-2.5 py-1.5 rounded text-xs font-mono font-semibold border transition-colors whitespace-nowrap shrink-0 ${
                    telemetry.solarStormActive
                      ? 'bg-rose-500 text-white border-rose-400'
                      : 'bg-rose-950/40 hover:bg-rose-900/50 text-rose-300 border-rose-800/60'
                  }`}
                >
                  [X] {telemetry.solarStormActive ? '● Solar Storm / Dust Active' : 'Sim Solar Storm'}
                </button>

                <button
                  type="button"
                  tabIndex={-1}
                  onClick={(e) => {
                    e.currentTarget.blur();
                    onTriggerSample();
                  }}
                  className="px-2.5 py-1.5 rounded text-xs font-mono font-semibold bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/50 transition-colors whitespace-nowrap shrink-0"
                >
                  [E] Drill Core
                </button>
              </div>
            </div>

            {/* Row 2: Instant Point B Science POI Selector for Live 3D A* Pathfinding + Auto-Pilot */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1.5 border-t border-slate-800/80">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-mono text-emerald-400 font-semibold mr-1">
                  A* ROUTE (A→B):
                </span>
                {waypoints.map((wp) => {
                  const isTarget = wp.id === targetWaypointId;
                  const done = telemetry.collectedIds.includes(wp.id);
                  return (
                    <button
                      key={wp.id}
                      type="button"
                      tabIndex={-1}
                      onClick={(e) => {
                        e.currentTarget.blur();
                        onSelectTargetPoi(wp);
                      }}
                      className={`px-2 py-1 rounded text-[11px] font-mono transition-colors whitespace-nowrap shrink-0 ${
                        isTarget
                          ? 'bg-emerald-500 text-slate-950 font-bold'
                          : done
                          ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/60'
                          : 'bg-[#131926] hover:bg-slate-800 text-slate-300 border border-slate-800'
                      }`}
                    >
                      {wp.code}: {wp.categoryLabel.split(' ')[0]} {done ? '✓' : ''}
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={(e) => {
                    e.currentTarget.blur();
                    onToggleAutoPilot();
                  }}
                  className={`px-3 py-1 rounded text-xs font-mono font-bold transition-colors whitespace-nowrap shrink-0 ${
                    telemetry.autoPilotActive
                      ? 'bg-emerald-400 text-slate-950'
                      : 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/50'
                  }`}
                >
                  [F] {telemetry.autoPilotActive ? '● Auto-Pilot Walking A*' : 'Auto-Walk A* Path'}
                </button>

                <button
                  type="button"
                  tabIndex={-1}
                  onClick={(e) => {
                    e.currentTarget.blur();
                    onTriggerBoost();
                  }}
                  className="px-2.5 py-1 rounded text-xs font-mono text-amber-300 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 transition-colors whitespace-nowrap shrink-0"
                >
                  [Space] Hop
                </button>

                <button
                  type="button"
                  tabIndex={-1}
                  onClick={(e) => {
                    e.currentTarget.blur();
                    onOpenRoutePlanner();
                  }}
                  className="px-2.5 py-1 rounded text-xs font-mono font-semibold bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 transition-colors whitespace-nowrap shrink-0"
                >
                  [T] A* GIS Computer
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
