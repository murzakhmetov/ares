import React from 'react';
import { MARS_REGIONS, type MarsRegionId } from '../game/marsData';

export interface RunSnapshot {
  outcome: 'victory' | 'defeat';
  reason: string;
  score: number;
  bestScore: number;
  samplesCollected: number;
  totalSamples: number;
  elapsedSeconds: number;
  radiationDoseUSv: number;
}

interface TitleScreenOverlayProps {
  selectedRegion: MarsRegionId;
  onSelectRegion: (region: MarsRegionId) => void;
  onStartGame: () => void;
  onStartWithPresetRoute: () => void;
}

export const TitleScreenOverlay: React.FC<TitleScreenOverlayProps> = ({
  selectedRegion,
  onSelectRegion,
  onStartGame,
  onStartWithPresetRoute
}) => {
  const regionSpec = MARS_REGIONS[selectedRegion];

  return (
    <div className="fixed inset-0 z-30 flex flex-col justify-between p-6 md:p-10 pointer-events-none select-none">
      {/* Left/Top Negative-Space Title Lockup (leaves >= 65% of the 3D Orbital Mars Globe unobstructed) */}
      <div className="max-w-xl bg-[#0B0E14]/90 border border-slate-800/90 p-6 md:p-7 rounded-lg shadow-2xl pointer-events-auto">
        {/* Bespoke Inline SVG Mission Emblem & Display Lockup */}
        <div className="mb-4">
          <svg
            viewBox="0 0 540 112"
            className="w-full max-w-[490px] h-auto"
            role="img"
            aria-label="ARES-IV Interactive 3D Mars Globe and A* Survival Route Planner"
          >
            <path
              d="M 8 86 Q 110 22 260 66 T 520 34"
              fill="none"
              stroke="#334155"
              strokeWidth="1.5"
              strokeDasharray="4 4"
            />
            <polygon
              points="46,14 78,32 78,68 46,86 14,68 14,32"
              fill="#131824"
              stroke="#F59E0B"
              strokeWidth="2.5"
            />
            <circle cx="46" cy="50" r="18" fill="#9A3412" stroke="#F59E0B" strokeWidth="1.5" />
            <path d="M 30 52 Q 46 42 62 54" fill="none" stroke="#10B981" strokeWidth="2.2" />
            <circle cx="51" cy="46" r="3.5" fill="#06B6D4" />
            <line x1="46" y1="24" x2="46" y2="32" stroke="#F8FAFC" strokeWidth="1.5" />
            <line x1="46" y1="68" x2="46" y2="76" stroke="#F8FAFC" strokeWidth="1.5" />

            <text
              x="94"
              y="28"
              fill="#F59E0B"
              fontFamily="'IBM Plex Mono', monospace"
              fontSize="11"
              fontWeight="600"
              letterSpacing="1.1"
            >
              NASA SPACE APPS · 3D ORBITAL GLOBE &amp; DEM PATHFINDER
            </text>

            <text
              x="92"
              y="64"
              fill="#F8FAFC"
              fontFamily="'Chakra Petch', sans-serif"
              fontSize="33"
              fontWeight="700"
              letterSpacing="1.0"
            >
              ARES-IV: MARTIAN MAP
            </text>

            <rect x="94" y="75" width="410" height="22" rx="3" fill="#161F30" stroke="#1E293B" strokeWidth="1" />
            <text
              x="104"
              y="90"
              fill="#10B981"
              fontFamily="'IBM Plex Mono', monospace"
              fontSize="11"
              fontWeight="600"
              letterSpacing="0.8"
            >
              3D GLOBE ZOOM · GREEN-RED SLOPE DEM · A* PATHFINDING
            </text>
          </svg>
        </div>

        {/* Interactive Landing Zone Selector on 3D Mars Globe */}
        <div className="mb-4">
          <div className="text-[11px] font-mono uppercase text-slate-400 mb-1.5">
            Select Orbital Target Zone on 3D Mars Globe:
          </div>
          <div className="grid grid-cols-2 gap-2">
            {(['jezero', 'marineris'] as MarsRegionId[]).map((rId) => {
              const r = MARS_REGIONS[rId];
              const active = selectedRegion === rId;
              return (
                <button
                  key={rId}
                  type="button"
                  onClick={() => onSelectRegion(rId)}
                  className={`p-2.5 rounded border text-left transition-colors ${
                    active
                      ? 'bg-amber-500/15 border-amber-400 text-slate-100'
                      : 'bg-[#111622] border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1 text-xs font-mono font-bold text-amber-400">
                    <span className="truncate">{r.name}</span>
                    <span className="shrink-0">{r.coordinates.split(',')[0]}</span>
                  </div>
                  <div className="text-[11px] text-slate-300 mt-0.5 truncate">{r.subtitle}</div>
                </button>
              );
            })}
          </div>
          <p className="text-xs text-slate-300 mt-2 leading-relaxed">
            <strong className="text-cyan-400">{regionSpec.name} ({regionSpec.coordinates}):</strong>{' '}
            {regionSpec.description}
          </p>
        </div>

        {/* Primary & Secondary Start CTAs */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          <button
            type="button"
            data-start="true"
            onClick={(e) => {
              e.currentTarget.blur();
              onStartGame();
            }}
            className="w-full sm:w-auto px-5 py-3 text-sm font-bold tracking-wide bg-amber-500 hover:bg-amber-400 text-slate-950 rounded transition-colors cursor-pointer text-center"
            style={{ fontFamily: "'Chakra Petch', sans-serif" }}
          >
            Zoom to {regionSpec.name} 3D Surface [Enter]
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.currentTarget.blur();
              onStartWithPresetRoute();
            }}
            className="w-full sm:w-auto px-4 py-3 text-xs font-mono font-semibold bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/50 rounded transition-colors cursor-pointer text-center"
          >
            Open A* Pathfinding Planner (A→B)
          </button>
        </div>
      </div>

      {/* Bottom Safe-Margin Single Flat Control-Hint Line */}
      <div className="w-full flex justify-center">
        <div className="px-4 py-1.5 bg-[#0B0E14]/88 text-xs font-mono text-slate-300 tracking-wide rounded">
          WASD Move · G 3D Mars Globe · 1-4 NASA Layers (Slope/RAD/Ice) · T A* Route Planner · F Auto-Pilot · E Sample
        </div>
      </div>
    </div>
  );
};

interface StatusModalProps {
  gameState: 'paused' | 'gameover';
  snapshot: RunSnapshot | null;
  onResume: () => void;
  onRestart: () => void;
  onReturnTitle: () => void;
}

export const StatusModalOverlay: React.FC<StatusModalProps> = ({
  gameState,
  snapshot,
  onResume,
  onRestart,
  onReturnTitle
}) => {
  if (gameState === 'paused') {
    return (
      <div
        className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-[#07090E]/82 pointer-events-auto"
        role="dialog"
        aria-modal="true"
        aria-label="EVA Mission Paused"
      >
        <div className="w-full max-w-md bg-[#0B0E17] border border-slate-800 rounded-lg p-6 shadow-2xl">
          <div className="text-xs font-mono text-amber-400 uppercase tracking-wider mb-1">
            PLSS TELEMETRY STANDBY
          </div>
          <h2
            className="text-2xl font-bold text-slate-100 mb-4"
            style={{ fontFamily: "'Chakra Petch', sans-serif" }}
          >
            Marswalk Paused
          </h2>
          <p className="text-sm text-slate-400 mb-6">
            Life support consumables, A* pathfinding telemetry, and orbital hazard tracking are holding in standby.
          </p>
          <div className="flex flex-col gap-2.5">
            <button
              type="button"
              onClick={(e) => {
                e.currentTarget.blur();
                onResume();
              }}
              className="w-full py-2.5 px-4 text-sm font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded transition-colors"
              style={{ fontFamily: "'Chakra Petch', sans-serif" }}
            >
              Resume Marswalk [Esc / P]
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.currentTarget.blur();
                onRestart();
              }}
              className="w-full py-2.5 px-4 text-sm font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition-colors"
            >
              Restart EVA Mission [R]
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.currentTarget.blur();
                onReturnTitle();
              }}
              className="w-full py-2.5 px-4 text-sm font-medium bg-[#131926] hover:bg-slate-800 text-slate-400 border border-slate-800 rounded transition-colors"
            >
              Return to 3D Mars Orbital Globe
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (gameState === 'gameover' && snapshot) {
    const isVictory = snapshot.outcome === 'victory';
    const mins = Math.floor(snapshot.elapsedSeconds / 60);
    const secs = Math.floor(snapshot.elapsedSeconds % 60);
    const timeFormatted = `${mins}:${secs < 10 ? '0' : ''}${secs}`;

    return (
      <div
        className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-[#07090E]/85 pointer-events-auto"
        role="dialog"
        aria-modal="true"
        aria-label={isVictory ? 'Marswalk Mission Accomplished' : 'EVA Emergency Abort'}
      >
        <div className="w-full max-w-lg bg-[#0B0E17] border border-slate-800 rounded-lg p-6 shadow-2xl">
          <div
            className={`text-xs font-mono uppercase tracking-wider mb-1 ${
              isVictory ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {isVictory ? '● ARES-IV AIRLOCK RE-PRESSURIZED · MISSION COMPLETE' : '✖ PLSS EMERGENCY ABORT TRIGGERED'}
          </div>
          <h2
            className="text-2xl font-bold text-slate-100 mb-2"
            style={{ fontFamily: "'Chakra Petch', sans-serif" }}
          >
            {isVictory ? 'Martian Traverse Complete' : 'Marswalk Terminated'}
          </h2>
          <p className="text-sm text-slate-300 mb-5">{snapshot.reason}</p>

          <div className="grid grid-cols-3 gap-3 mb-6">
            <div className="p-3 bg-[#111622] border border-slate-800 rounded">
              <div className="text-[11px] font-mono text-slate-400 uppercase">SCIENCE SCORE</div>
              <div className="text-xl font-mono font-bold text-amber-400 tabular-nums">
                {Math.round(snapshot.score)}
              </div>
              <div className="text-[11px] font-mono text-slate-500 tabular-nums">
                BEST {Math.round(snapshot.bestScore)}
              </div>
            </div>

            <div className="p-3 bg-[#111622] border border-slate-800 rounded">
              <div className="text-[11px] font-mono text-slate-400 uppercase">SAMPLES / TIME</div>
              <div className="text-xl font-mono font-bold text-cyan-400 tabular-nums">
                {snapshot.samplesCollected}/{snapshot.totalSamples}
              </div>
              <div className="text-[11px] font-mono text-slate-400 tabular-nums">EVA {timeFormatted}</div>
            </div>

            <div className="p-3 bg-[#111622] border border-slate-800 rounded">
              <div className="text-[11px] font-mono text-slate-400 uppercase">RAD EXPOSURE</div>
              <div className="text-xl font-mono font-bold text-rose-400 tabular-nums">
                {Math.round(snapshot.radiationDoseUSv)}
                <span className="text-xs text-slate-400 ml-1">uSv</span>
              </div>
              <div className="text-[11px] font-mono text-emerald-400">LIMIT 150 uSv</div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              data-start="true"
              onClick={(e) => {
                e.currentTarget.blur();
                onRestart();
              }}
              className="flex-1 py-3 px-5 text-sm font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded transition-colors"
              style={{ fontFamily: "'Chakra Petch', sans-serif" }}
            >
              {isVictory ? 'Launch New EVA Traverse' : 'Try Again'} [Enter / Space]
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.currentTarget.blur();
                onReturnTitle();
              }}
              className="py-3 px-4 text-sm font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition-colors"
            >
              3D Globe
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
};
