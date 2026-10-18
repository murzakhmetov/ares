/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  REGION_WAYPOINTS,
  MARS_REGIONS,
  HABITAT_BASE,
  WORLD_PLAYABLE_RADIUS,
  groundHeightAt,
  groundSlopeAt,
  waterIceAt,
  radiationAt,
  windAt,
  computeAStarRoute,
  stepHazardBehavior,
  type MarsRegionId,
  type NasaLayerId,
  type ViewMode,
  type RoutePoint,
  type ScienceWaypoint,
  type HazardEntity
} from './game/marsData';
import {
  createRegolithBumpTexture,
  createCrispGridTexture,
  updateTerrainMeshData,
  createMarsOrbitalGlobe,
  buildAStarRoute3DMesh,
  createEvaAstronautMesh,
  createHabitatBaseMesh,
  createScienceWaypointMesh,
  createHazardActorMesh
} from './game/models3d';
import { soundEngine } from './game/sound';
import { EvaHud, type LiveTelemetryState } from './components/EvaHud';
import { TitleScreenOverlay, StatusModalOverlay, type RunSnapshot } from './components/GameModals';
import { TacticalRoutePlanner } from './components/TacticalRoutePlanner';

type GameState = 'title' | 'playing' | 'paused' | 'gameover';

// Pre-allocated scratch math objects at module scope (Zero GC in requestAnimationFrame)
const _camTargetPos = new THREE.Vector3();
const _camDesiredPos = new THREE.Vector3();
const _lookAtPos = new THREE.Vector3();
const _particleMat4 = new THREE.Matrix4();
const _particlePos = new THREE.Vector3();
const _particleScale = new THREE.Vector3();
const _particleQuat = new THREE.Quaternion();
const _particleColor = new THREE.Color();

interface PooledParticle {
  active: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
  size: number;
  colorHex: number;
}

const PARTICLE_POOL_SIZE = 64;

function createInitialHazards(): HazardEntity[] {
  return [
    {
      id: 'hz-devil-1',
      archetype: 'dust_devil',
      x: -16,
      z: -24,
      vx: 1.5,
      vz: 1.2,
      radius: 2.8,
      phase: 'patrol',
      phaseTimer: 0,
      targetX: 0,
      targetZ: 0
    },
    {
      id: 'hz-devil-2',
      archetype: 'dust_devil',
      x: 28,
      z: 8,
      vx: -1.4,
      vz: 1.6,
      radius: 2.8,
      phase: 'patrol',
      phaseTimer: 0,
      targetX: 0,
      targetZ: 0
    },
    {
      id: 'hz-flare-1',
      archetype: 'solar_flare_zone',
      x: -22,
      z: 14,
      vx: 0,
      vz: 0,
      radius: 3.4,
      phase: 'patrol',
      phaseTimer: 3.2,
      targetX: 0,
      targetZ: 0
    },
    {
      id: 'hz-debris-1',
      archetype: 'slope_debris',
      x: 12,
      z: 30,
      vx: -2.4,
      vz: -1.2,
      radius: 2.6,
      phase: 'patrol',
      phaseTimer: 0,
      targetX: 0,
      targetZ: 0
    }
  ];
}

export default function App() {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);

  const initialAutoStart =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('autostart') === '1';

  const [gameState, setGameState] = useState<GameState>(initialAutoStart ? 'playing' : 'title');
  const [viewMode, setViewMode] = useState<ViewMode>(initialAutoStart ? 'terrain' : 'globe');
  const [region, setRegion] = useState<MarsRegionId>('jezero');
  const [activeLayer, setActiveLayer] = useState<NasaLayerId>('mola');
  const [routePlannerOpen, setRoutePlannerOpen] = useState(false);
  const [dockCollapsed, setDockCollapsed] = useState(false);
  const [muted, setMuted] = useState(false);
  const [runSnapshot, setRunSnapshot] = useState<RunSnapshot | null>(null);

  // Default Point A (Origin) and Point B (Bright Angel Smectite Cliff POI-C3 so A* visibly detours around steep ridges)
  const initialWaypoints = REGION_WAYPOINTS.jezero;
  const initialPointA: RoutePoint = { x: 0, z: 2, label: 'EVA-START' };
  const initialPointB: RoutePoint = {
    x: initialWaypoints[2].x,
    z: initialWaypoints[2].z,
    label: initialWaypoints[2].code
  };

  const [pointA, setPointA] = useState<RoutePoint>(initialPointA);
  const [pointB, setPointB] = useState<RoutePoint>(initialPointB);
  const [targetWaypointId, setTargetWaypointId] = useState<string>(initialWaypoints[2].id);
  const [avoidSlopes, setAvoidSlopes] = useState<boolean>(true);
  const [plannedRoute, setPlannedRoute] = useState<RoutePoint[]>(() =>
    computeAStarRoute(initialPointA, initialPointB, { region: 'jezero', avoidSlopes: true })
  );

  const [telemetry, setTelemetry] = useState<LiveTelemetryState>({
    suitHp: 100,
    o2: 100,
    o2Ghost: 100,
    battery: 100,
    batteryGhost: 100,
    radiationDoseUSv: 0,
    currentRadRateUSv: 8,
    elevationMeters: -2532,
    slopeDeg: 0,
    waterWtPercent: 2.1,
    windSpeedMs: 6.8,
    score: 0,
    collectedIds: [],
    nearbyWaypoint: null,
    nearHabitat: true,
    statusBanner: 'A* Pathfinding Active · Green Corridor Avoids >16° Red Cliffs · Press [F] for Auto-Pilot',
    solarStormActive: false,
    autoPilotActive: false,
    playerX: 0,
    playerZ: 2
  });

  const simRef = useRef({
    gameState: (initialAutoStart ? 'playing' : 'title') as GameState,
    viewMode: (initialAutoStart ? 'terrain' : 'globe') as ViewMode,
    region: 'jezero' as MarsRegionId,
    activeLayer: 'mola' as NasaLayerId,
    routePlannerOpen: false,
    avoidSlopes: true,
    autoPilotActive: false,
    autoPilotIndex: 1,
    playerX: 0,
    playerY: groundHeightAt(0, 2, 'jezero'),
    playerZ: 2,
    vx: 0,
    vy: 0,
    vz: 0,
    facingYaw: Math.PI,
    onGround: true,
    coyoteTimer: 0,
    jumpBufferTimer: 0,
    sampleBufferTimer: 0,
    scaleX: 1,
    scaleY: 1,
    walkDistanceAccum: 0,
    drillAnimTimer: 0,
    hitstopTimer: 0,
    hitFlashTimer: 0,
    cameraTrauma: 0,
    suitHp: 100,
    o2: 100,
    o2Ghost: 100,
    battery: 100,
    batteryGhost: 100,
    radiationDoseUSv: 0,
    score: 0,
    bestScore: 0,
    elapsedSeconds: 0,
    solarStormIntensity: 0,
    manualStormForced: false,
    collectedIds: [] as string[],
    statusBanner: 'A* Pathfinding Active · Green Corridor Avoids >16° Red Cliffs · Press [F] for Auto-Pilot' as string | null,
    bannerTimer: 7.0,
    hazards: createInitialHazards(),
    keysHeld: new Set<string>(),
    justPressed: new Set<string>(),
    needsTerrainRefresh: true,
    needsRouteRefresh: true,
    needsWaypointsRefresh: false,
    plannedRoute: computeAStarRoute(initialPointA, initialPointB, {
      region: 'jezero',
      avoidSlopes: true
    }),
    particles: Array.from({ length: PARTICLE_POOL_SIZE }, () => ({
      active: false,
      x: 0,
      y: -100,
      z: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      life: 0,
      maxLife: 1,
      size: 0.15,
      colorHex: 0xf59e0b
    })) as PooledParticle[],
    particleCursor: 0
  });

  useEffect(() => {
    document.body.dataset.state = gameState;
    simRef.current.gameState = gameState;
  }, [gameState]);

  useEffect(() => {
    simRef.current.routePlannerOpen = routePlannerOpen;
  }, [routePlannerOpen]);

  const spawnParticleBurst = useCallback(
    (wx: number, wy: number, wz: number, count: number, colorHex: number, speedScale = 1) => {
      const s = simRef.current;
      for (let i = 0; i < count; i++) {
        const p = s.particles[s.particleCursor];
        s.particleCursor = (s.particleCursor + 1) % PARTICLE_POOL_SIZE;
        const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.4;
        const spd = (1.5 + Math.random() * 3.2) * speedScale;
        p.active = true;
        p.x = wx;
        p.y = wy + 0.25;
        p.z = wz;
        p.vx = Math.cos(angle) * spd;
        p.vy = (1.8 + Math.random() * 2.8) * speedScale;
        p.vz = Math.sin(angle) * spd;
        p.life = 0;
        p.maxLife = 0.35 + Math.random() * 0.35;
        p.size = 0.12 + Math.random() * 0.14;
        p.colorHex = colorHex;
      }
    },
    []
  );

  const recomputeAStar = useCallback(
    (
      newA: RoutePoint,
      newB: RoutePoint,
      targetRegion: MarsRegionId,
      useSlopeAvoidance: boolean,
      stormIntensity: number
    ) => {
      const path = computeAStarRoute(newA, newB, {
        region: targetRegion,
        avoidSlopes: useSlopeAvoidance,
        solarStormIntensity: stormIntensity
      });
      simRef.current.plannedRoute = path;
      simRef.current.avoidSlopes = useSlopeAvoidance;
      simRef.current.autoPilotIndex = 1;
      simRef.current.needsRouteRefresh = true;
      setPlannedRoute(path);
    },
    []
  );

  const resetSimRun = useCallback(
    (targetRegion: MarsRegionId = simRef.current.region) => {
      const s = simRef.current;
      s.region = targetRegion;
      s.playerX = 0;
      s.playerZ = 2;
      s.playerY = groundHeightAt(0, 2, targetRegion);
      s.vx = 0;
      s.vy = 0;
      s.vz = 0;
      s.facingYaw = Math.PI;
      s.onGround = true;
      s.coyoteTimer = 0;
      s.jumpBufferTimer = 0;
      s.sampleBufferTimer = 0;
      s.scaleX = 1;
      s.scaleY = 1;
      s.drillAnimTimer = 0;
      s.hitstopTimer = 0;
      s.hitFlashTimer = 0;
      s.cameraTrauma = 0;
      s.suitHp = 100;
      s.o2 = 100;
      s.o2Ghost = 100;
      s.battery = 100;
      s.batteryGhost = 100;
      s.radiationDoseUSv = 0;
      s.score = 0;
      s.elapsedSeconds = 0;
      s.solarStormIntensity = s.manualStormForced ? 0.9 : 0;
      s.autoPilotActive = false;
      s.autoPilotIndex = 1;
      s.collectedIds = [];
      s.statusBanner = `A* Safe Route Plotted in ${MARS_REGIONS[targetRegion].name} · Green Slope Gradient Active`;
      s.bannerTimer = 6.0;
      s.hazards = createInitialHazards();
      s.keysHeld.clear();
      s.justPressed.clear();
      s.needsTerrainRefresh = true;
      s.needsWaypointsRefresh = true;

      const wps = REGION_WAYPOINTS[targetRegion];
      const startPt: RoutePoint = { x: 0, z: 2, label: 'EVA-START' };
      const goalPt: RoutePoint = { x: wps[2].x, z: wps[2].z, label: wps[2].code };
      setPointA(startPt);
      setPointB(goalPt);
      setTargetWaypointId(wps[2].id);
      recomputeAStar(startPt, goalPt, targetRegion, s.avoidSlopes, s.solarStormIntensity);
    },
    [recomputeAStar]
  );

  const handleStartGame = useCallback(() => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    resetSimRun(simRef.current.region);
    document.body.dataset.state = 'playing';
    simRef.current.gameState = 'playing';
    simRef.current.viewMode = 'terrain';
    setViewMode('terrain');
    setRoutePlannerOpen(false);
    setGameState('playing');
  }, [resetSimRun]);

  const handleSelectRegion = useCallback(
    (newRegion: MarsRegionId) => {
      soundEngine.playLayerSwitch(2);
      setRegion(newRegion);
      resetSimRun(newRegion);
    },
    [resetSimRun]
  );

  const handleSelectLayer = useCallback((layer: NasaLayerId) => {
    const idx = ['mola', 'rad', 'odyssey', 'natural', 'meda'].indexOf(layer);
    soundEngine.playLayerSwitch(Math.max(0, idx));
    simRef.current.activeLayer = layer;
    simRef.current.needsTerrainRefresh = true;
    setActiveLayer(layer);
  }, []);

  const handleSelectTargetPoi = useCallback(
    (wp: ScienceWaypoint) => {
      soundEngine.playLayerSwitch(3);
      const s = simRef.current;
      const curA: RoutePoint = {
        x: Number(s.playerX.toFixed(1)),
        z: Number(s.playerZ.toFixed(1)),
        label: 'EVA-POS'
      };
      const curB: RoutePoint = { x: wp.x, z: wp.z, label: wp.code };
      setTargetWaypointId(wp.id);
      setPointA(curA);
      setPointB(curB);
      recomputeAStar(curA, curB, s.region, s.avoidSlopes, s.solarStormIntensity);
      s.statusBanner = `A* Route Recomputed to ${wp.code} (${wp.name}) · Avoiding Steep >16° Slopes`;
      s.bannerTimer = 4.5;
    },
    [recomputeAStar]
  );

  const handleSelectEndpoints = useCallback(
    (newA: RoutePoint, newB: RoutePoint) => {
      soundEngine.playLayerSwitch(1);
      setPointA(newA);
      setPointB(newB);
      recomputeAStar(
        newA,
        newB,
        simRef.current.region,
        simRef.current.avoidSlopes,
        simRef.current.solarStormIntensity
      );
    },
    [recomputeAStar]
  );

  const handleToggleAvoidSlopes = useCallback(
    (avoid: boolean) => {
      soundEngine.playLayerSwitch(avoid ? 2 : 0);
      setAvoidSlopes(avoid);
      recomputeAStar(
        pointA,
        pointB,
        simRef.current.region,
        avoid,
        simRef.current.solarStormIntensity
      );
    },
    [pointA, pointB, recomputeAStar]
  );

  const handleToggleAutoPilot = useCallback(() => {
    const s = simRef.current;
    s.autoPilotActive = !s.autoPilotActive;
    s.autoPilotIndex = 1;
    if (s.autoPilotActive) {
      // Recompute A* from exact current player position to current Point B
      const startPt: RoutePoint = {
        x: Number(s.playerX.toFixed(1)),
        z: Number(s.playerZ.toFixed(1)),
        label: 'EVA-POS'
      };
      setPointA(startPt);
      recomputeAStar(startPt, pointB, s.region, s.avoidSlopes, s.solarStormIntensity);
      s.statusBanner = 'A* Auto-Pilot Engaged · Navigating Safe Low-Slope Corridor to Target POI';
      s.bannerTimer = 4.5;
    } else {
      s.statusBanner = 'Manual EVA Control Resumed (WASD / Arrows)';
      s.bannerTimer = 3.0;
    }
    soundEngine.playLayerSwitch(1);
  }, [pointB, recomputeAStar]);

  const handleToggleStorm = useCallback(() => {
    const s = simRef.current;
    s.manualStormForced = !s.manualStormForced;
    s.solarStormIntensity = s.manualStormForced ? 0.95 : 0;
    s.needsTerrainRefresh = true;
    soundEngine.playHazardWindup();
    s.statusBanner = s.manualStormForced
      ? 'SOLAR ENERGETIC PARTICLE & DUST STORM ACTIVE · High Radiation on Exposed Ridges!'
      : 'Solar Storm Subsided · Nominal Background Cosmic Ray Flux Restored';
    s.bannerTimer = 5.0;
  }, []);

  const handleTriggerSample = useCallback(() => {
    simRef.current.sampleBufferTimer = 0.14;
  }, []);

  const handleTriggerBoost = useCallback(() => {
    simRef.current.jumpBufferTimer = 0.14;
  }, []);

  const handleToggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      soundEngine.setMuted(next);
      return next;
    });
  }, []);

  // Main WebGL / Three.js Scene (3D Orbital Mars Globe + High-Res Local 3D Terrain)
  useEffect(() => {
    const mount = canvasMountRef.current;
    if (!mount) return;

    const isHeadless =
      navigator.webdriver || /HeadlessChrome/i.test(navigator.userAgent);

    const renderer = new THREE.WebGLRenderer({
      antialias: !isHeadless,
      powerPreference: 'high-performance'
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.94;
    renderer.setPixelRatio(isHeadless ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = !isHeadless;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setSize(mount.clientWidth || window.innerWidth, mount.clientHeight || window.innerHeight);

    mount.innerHTML = '';
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const spaceBgColor = new THREE.Color(0x050811);
    const marsHorizonColor = new THREE.Color(0x160d0a);
    const marsStormColor = new THREE.Color(0x3b1507);
    scene.background = spaceBgColor.clone();

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    const camera = new THREE.PerspectiveCamera(
      52,
      (mount.clientWidth || window.innerWidth) / (mount.clientHeight || window.innerHeight),
      0.2,
      280
    );
    camera.position.set(0, 8, 26);

    // Balanced Cinema Lighting Rig (dramatic Martian low-angle sunlight, zero blowout)
    const hemiLight = new THREE.HemisphereLight(0xfb923c, 0x0f172a, 0.48);
    hemiLight.position.set(0, 50, 0);
    scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight(0xffedd5, 1.58);
    sunLight.position.set(48, 34, 28);
    if (!isHeadless) {
      sunLight.castShadow = true;
      sunLight.shadow.mapSize.width = 1024;
      sunLight.shadow.mapSize.height = 1024;
      const d = 58;
      sunLight.shadow.camera.left = -d;
      sunLight.shadow.camera.right = d;
      sunLight.shadow.camera.top = d;
      sunLight.shadow.camera.bottom = -d;
      sunLight.shadow.camera.near = 5;
      sunLight.shadow.camera.far = 150;
      sunLight.shadow.bias = -0.0005;
      sunLight.shadow.normalBias = 0.02;
    }
    scene.add(sunLight);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.45);
    rimLight.position.set(-40, 22, -35);
    scene.add(rimLight);

    const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();

    // =========================================================================
    // WORLD 1: 3D INTERACTIVE MARS ORBITAL GLOBE
    // =========================================================================
    const orbitalGlobe = createMarsOrbitalGlobe(maxAnisotropy);
    orbitalGlobe.rootGroup.position.set(4.2, 0.2, 0);
    scene.add(orbitalGlobe.rootGroup);

    // Interactive pointer drag for spinning the 3D Mars Globe
    let isDraggingGlobe = false;
    let prevPointerX = 0;
    let prevPointerY = 0;
    let globeYawUserOffset = 0;
    let globePitchUserOffset = 0.12;

    const onPointerDown = (e: PointerEvent) => {
      if (simRef.current.gameState === 'title' || simRef.current.viewMode === 'globe') {
        isDraggingGlobe = true;
        prevPointerX = e.clientX;
        prevPointerY = e.clientY;
      }
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!isDraggingGlobe) return;
      const dx = e.clientX - prevPointerX;
      const dy = e.clientY - prevPointerY;
      prevPointerX = e.clientX;
      prevPointerY = e.clientY;
      globeYawUserOffset += dx * 0.0065;
      globePitchUserOffset = Math.max(-0.55, Math.min(0.55, globePitchUserOffset + dy * 0.005));
    };
    const onPointerUp = () => {
      isDraggingGlobe = false;
    };
    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);

    // =========================================================================
    // WORLD 2: HIGH-DENSITY 3D LOCAL MARTIAN DEM TERRAIN (JEZERO & MARINERIS)
    // =========================================================================
    const terrainWorldGroup = new THREE.Group();
    scene.add(terrainWorldGroup);

    const terrainSegments = isHeadless ? 96 : 148;
    const terrainGeo = new THREE.PlaneGeometry(140, 140, terrainSegments, terrainSegments);
    terrainGeo.rotateX(-Math.PI / 2);

    const bumpTexture = createRegolithBumpTexture(maxAnisotropy);
    const gridTexture = createCrispGridTexture(maxAnisotropy);

    const terrainMat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      map: gridTexture,
      bumpMap: bumpTexture,
      bumpScale: 0.26,
      roughness: 0.86,
      metalness: 0.06
    });
    const terrainMesh = new THREE.Mesh(terrainGeo, terrainMat);
    terrainMesh.receiveShadow = true;
    terrainWorldGroup.add(terrainMesh);

    // InstancedMesh for 120 Sculpted Stratified Martian Basalt Outcrops (Ventifacts)
    const boulderCount = 120;
    const boulderGeo = new THREE.IcosahedronGeometry(1.0, 1);
    const bPos = boulderGeo.attributes.position;
    for (let vi = 0; vi < bPos.count; vi++) {
      const vx = bPos.getX(vi);
      const vy = bPos.getY(vi);
      const vz = bPos.getZ(vi);
      // Carve angular wind-eroded strata benches into each rock vertex
      const strataStep = Math.sin(vy * 5.5 + vx * 2.2) * 0.14;
      const facetCrunch = Math.cos(vx * 4.1 - vz * 3.7) * 0.12;
      bPos.setXYZ(
        vi,
        vx * (1 + strataStep),
        vy < 0 ? vy * 0.65 : vy * (0.92 + facetCrunch),
        vz * (1 - strataStep * 0.7)
      );
    }
    boulderGeo.computeVertexNormals();

    const boulderMat = new THREE.MeshStandardMaterial({
      color: 0x5c3020,
      bumpMap: bumpTexture,
      bumpScale: 0.14,
      roughness: 0.9,
      metalness: 0.12,
      flatShading: true
    });
    const boulderInstanced = new THREE.InstancedMesh(boulderGeo, boulderMat, boulderCount);
    boulderInstanced.castShadow = !isHeadless;
    boulderInstanced.receiveShadow = true;
    terrainWorldGroup.add(boulderInstanced);

    const populateBoulders = (reg: MarsRegionId) => {
      let bSeed = reg === 'jezero' ? 4201 : 7819;
      const nextRand = () => {
        bSeed = (bSeed * 16807) % 2147483647;
        return (bSeed - 1) / 2147483646;
      };

      const dummyMat = new THREE.Matrix4();
      const dummyPos = new THREE.Vector3();
      const dummyQuat = new THREE.Quaternion();
      const dummyScale = new THREE.Vector3();
      const dummyEuler = new THREE.Euler();
      const tintColor = new THREE.Color();
      const wps = REGION_WAYPOINTS[reg];

      let placed = 0;
      for (let i = 0; i < 240 && placed < boulderCount; i++) {
        const angle = nextRand() * Math.PI * 2;
        const r = i < 55 ? 48 + nextRand() * 16 : 11 + nextRand() * 38;
        const bx = Math.cos(angle) * r;
        const bz = Math.sin(angle) * r;

        const nearSpawn =
          Math.hypot(bx, bz - 2) < 7.5 || Math.hypot(bx - HABITAT_BASE.x, bz - HABITAT_BASE.z) < 8.5;
        const nearWaypoint = wps.some((w) => Math.hypot(w.x - bx, w.z - bz) < 4.8);
        if (nearSpawn || nearWaypoint) continue;

        const by = groundHeightAt(bx, bz, reg);
        const sx = (0.48 + nextRand() * 1.18) * (r > 46 ? 1.85 : 1.0);
        const sy = sx * (0.55 + nextRand() * 0.55);
        const sz = sx * (0.82 + nextRand() * 0.4);

        dummyPos.set(bx, by + sy * 0.22, bz);
        dummyEuler.set(nextRand() * 0.35, nextRand() * Math.PI * 2, nextRand() * 0.35);
        dummyQuat.setFromEuler(dummyEuler);
        dummyScale.set(sx, sy, sz);
        dummyMat.compose(dummyPos, dummyQuat, dummyScale);
        boulderInstanced.setMatrixAt(placed, dummyMat);

        const shade = 0.42 + nextRand() * 0.48;
        tintColor.setRGB(shade * 0.92, shade * 0.56, shade * 0.44);
        boulderInstanced.setColorAt(placed, tintColor);
        placed++;
      }
      boulderInstanced.count = placed;
      boulderInstanced.instanceMatrix.needsUpdate = true;
      if (boulderInstanced.instanceColor) boulderInstanced.instanceColor.needsUpdate = true;
      boulderInstanced.computeBoundingSphere();
    };
    populateBoulders(simRef.current.region);

    // Add Ares-IV Habitat Base
    const habitatMesh = createHabitatBaseMesh();
    habitatMesh.position.set(
      HABITAT_BASE.x,
      groundHeightAt(HABITAT_BASE.x, HABITAT_BASE.z, simRef.current.region),
      HABITAT_BASE.z
    );
    habitatMesh.rotation.y = 2.4;
    terrainWorldGroup.add(habitatMesh);

    // Container for Science Waypoint Stations
    const waypointsContainer = new THREE.Group();
    terrainWorldGroup.add(waypointsContainer);
    let waypointVisuals: {
      wp: ScienceWaypoint;
      group: THREE.Group;
      beaconCrystal: THREE.Mesh;
      ringMesh: THREE.Mesh;
    }[] = [];

    const rebuildWaypointMeshes = (reg: MarsRegionId) => {
      while (waypointsContainer.children.length > 0) {
        waypointsContainer.remove(waypointsContainer.children[0]);
      }
      waypointVisuals = REGION_WAYPOINTS[reg].map((wp) => {
        const vis = createScienceWaypointMesh(wp);
        waypointsContainer.add(vis.group);
        return { wp, ...vis };
      });
    };
    rebuildWaypointMeshes(simRef.current.region);

    // Add EVA Astronaut Hero Actor
    const astronaut = createEvaAstronautMesh();
    astronaut.group.position.set(0, groundHeightAt(0, 2, simRef.current.region), 2);
    terrainWorldGroup.add(astronaut.group);

    // Add 3 Distinct Hazard Archetypes
    const hazardVisuals = simRef.current.hazards.map((hz) => {
      const vis = createHazardActorMesh(hz.archetype);
      vis.group.position.set(hz.x, groundHeightAt(hz.x, hz.z, simRef.current.region), hz.z);
      terrainWorldGroup.add(vis.group);
      return { id: hz.id, ...vis };
    });

    // Container for 3D A* TubeGeometry Route Ribbon
    const routeRibbonContainer = new THREE.Group();
    terrainWorldGroup.add(routeRibbonContainer);

    // Zero-GC Pooled Particle InstancedMesh
    const particleGeo = new THREE.OctahedronGeometry(1, 0);
    const particleMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.9
    });
    const particleInstanced = new THREE.InstancedMesh(particleGeo, particleMat, PARTICLE_POOL_SIZE);
    particleInstanced.frustumCulled = false;
    terrainWorldGroup.add(particleInstanced);

    // Initial DEM terrain vertex calculation & shader pre-warm
    updateTerrainMeshData(
      terrainGeo,
      simRef.current.region,
      simRef.current.activeLayer,
      simRef.current.solarStormIntensity
    );
    simRef.current.needsTerrainRefresh = false;
    renderer.compile(scene, camera);

    const handleResize = () => {
      if (!mount) return;
      const w = mount.clientWidth || window.innerWidth;
      const h = mount.clientHeight || window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(mount);
    window.addEventListener('resize', handleResize);

    let rafId = 0;
    let lastTimeMs = performance.now();
    let lastRenderMs = 0;
    let lastHudSyncMs = 0;

    const tick = (nowMs: number) => {
      rafId = requestAnimationFrame(tick);

      if (isHeadless && nowMs - lastRenderMs < 64) {
        return;
      }
      const rawDt = (nowMs - lastTimeMs) / 1000;
      lastTimeMs = nowMs;
      lastRenderMs = nowMs;

      const dt = Math.min(Math.max(rawDt, 0.001), 0.05);
      const s = simRef.current;
      const elapsed = nowMs * 0.001;

      // Refresh region waypoints & boulders when region changes
      if (s.needsWaypointsRefresh) {
        rebuildWaypointMeshes(s.region);
        populateBoulders(s.region);
        habitatMesh.position.y = groundHeightAt(HABITAT_BASE.x, HABITAT_BASE.z, s.region);
        s.needsWaypointsRefresh = false;
      }

      // Refresh per-vertex DEM slope/radiation/ice colors when layer or region changes
      if (s.needsTerrainRefresh) {
        updateTerrainMeshData(terrainGeo, s.region, s.activeLayer, s.solarStormIntensity);
        s.needsTerrainRefresh = false;
      }

      // Rebuild 3D A* TubeGeometry path ribbon when route changes
      if (s.needsRouteRefresh) {
        while (routeRibbonContainer.children.length > 0) {
          routeRibbonContainer.remove(routeRibbonContainer.children[0]);
        }
        const ribbon = buildAStarRoute3DMesh(s.plannedRoute, s.region, s.avoidSlopes);
        routeRibbonContainer.add(ribbon);
        s.needsRouteRefresh = false;
      }

      // =======================================================================
      // MODE A: 3D INTERACTIVE MARS ORBITAL GLOBE VIEW (Title Screen or [G] Mode)
      // =======================================================================
      const showGlobe = s.gameState === 'title' || s.viewMode === 'globe';
      orbitalGlobe.rootGroup.visible = showGlobe;
      terrainWorldGroup.visible = !showGlobe;

      if (showGlobe) {
        scene.background = spaceBgColor;
        scene.fog = null;

        // Position globe centered in playing globe mode, or offset right on desktop title screen
        const isNarrowScreen = (mount.clientWidth || window.innerWidth) < 768;
        const targetGlobeX = s.gameState === 'title' && !isNarrowScreen ? 4.2 : 0;
        orbitalGlobe.rootGroup.position.x = THREE.MathUtils.damp(
          orbitalGlobe.rootGroup.position.x,
          targetGlobeX,
          5,
          dt
        );

        // Rotate globe smoothly toward selected landing zone + user drag offset
        const targetLon = s.region === 'jezero' ? -1.15 : 1.35;
        orbitalGlobe.globeMesh.rotation.y =
          targetLon + globeYawUserOffset + Math.sin(elapsed * 0.35) * 0.22 + elapsed * 0.06;
        orbitalGlobe.globeMesh.rotation.x = globePitchUserOffset;
        orbitalGlobe.satellitesGroup.rotation.y = elapsed * 0.45;

        // Pulse landing zone pins
        const pinScale = 1 + Math.sin(elapsed * 4) * 0.15;
        orbitalGlobe.jezeroPin.scale.setScalar(s.region === 'jezero' ? pinScale * 1.25 : 0.85);
        orbitalGlobe.marinerisPin.scale.setScalar(s.region === 'marineris' ? pinScale * 1.25 : 0.85);

        _camDesiredPos.set(0, 3.5, 23.5);
        camera.position.lerp(_camDesiredPos, 1 - Math.exp(-4.5 * dt));
        _lookAtPos.set(0, 0, 0);
        camera.lookAt(_lookAtPos);

        renderer.render(scene, camera);
        return;
      }

      // =======================================================================
      // MODE B: HIGH-RES LOCAL 3D TERRAIN & A* EVA SIMULATION
      // =======================================================================
      const bgTarget = s.solarStormIntensity > 0.4 ? marsStormColor : marsHorizonColor;
      scene.background = bgTarget;
      scene.fog = new THREE.FogExp2(
        bgTarget.getHex(),
        s.solarStormIntensity > 0.4 ? 0.015 : 0.0068
      );

      for (const wv of waypointVisuals) {
        const collected = s.collectedIds.includes(wv.wp.id);
        wv.beaconCrystal.rotation.y = elapsed * 1.8;
        wv.beaconCrystal.position.y = 2.5 + Math.sin(elapsed * 2.5 + wv.wp.x) * 0.16;
        wv.beaconCrystal.scale.setScalar(collected ? 0.55 : 1.0);
        (wv.ringMesh.material as THREE.MeshBasicMaterial).opacity = collected ? 0.22 : 0.82;
      }

      if (s.gameState !== 'playing' || s.routePlannerOpen) {
        renderer.render(scene, camera);
        return;
      }

      if (s.hitFlashTimer > 0) {
        s.hitFlashTimer -= dt;
        (astronaut.visorMesh.material as THREE.MeshStandardMaterial).emissive.setHex(
          s.hitFlashTimer > 0 ? 0xffffff : 0x451a03
        );
      }
      if (s.cameraTrauma > 0) {
        s.cameraTrauma = Math.max(0, s.cameraTrauma - dt * 1.8);
      }

      const simDt = s.hitstopTimer > 0 ? 0 : dt;
      if (s.hitstopTimer > 0) {
        s.hitstopTimer = Math.max(0, s.hitstopTimer - dt);
      }

      if (simDt > 0) {
        s.elapsedSeconds += simDt;

        if (!s.manualStormForced) {
          const stormCycle =
            s.elapsedSeconds > 22 ? Math.max(0, Math.sin((s.elapsedSeconds - 22) * 0.16)) : 0;
          const prevStorm = s.solarStormIntensity > 0.5;
          s.solarStormIntensity = stormCycle > 0.7 ? (stormCycle - 0.7) * 2.5 : 0;
          const nowStorm = s.solarStormIntensity > 0.5;
          if (prevStorm !== nowStorm && s.activeLayer === 'rad') {
            s.needsTerrainRefresh = true;
          }
        }

        if (s.jumpBufferTimer > 0) s.jumpBufferTimer -= simDt;
        if (s.sampleBufferTimer > 0) s.sampleBufferTimer -= simDt;
        if (s.onGround) {
          s.coyoteTimer = 0.11;
        } else if (s.coyoteTimer > 0) {
          s.coyoteTimer -= simDt;
        }

        // Check manual WASD input vs Autonomous A* Path Following
        let moveX = 0;
        let moveZ = 0;
        if (s.keysHeld.has('KeyW') || s.keysHeld.has('ArrowUp')) moveZ -= 1;
        if (s.keysHeld.has('KeyS') || s.keysHeld.has('ArrowDown')) moveZ += 1;
        if (s.keysHeld.has('KeyA') || s.keysHeld.has('ArrowLeft')) moveX -= 1;
        if (s.keysHeld.has('KeyD') || s.keysHeld.has('ArrowRight')) moveX += 1;

        if (moveX !== 0 || moveZ !== 0) {
          // Manual input overrides auto-pilot smoothly
          s.autoPilotActive = false;
        } else if (s.autoPilotActive && s.plannedRoute.length >= 2) {
          // Follow computed A* waypoints
          const targetIdx = Math.min(s.autoPilotIndex, s.plannedRoute.length - 1);
          const wpTarget = s.plannedRoute[targetIdx];
          const dx = wpTarget.x - s.playerX;
          const dz = wpTarget.z - s.playerZ;
          const distToNode = Math.hypot(dx, dz);

          if (distToNode < 1.6) {
            if (s.autoPilotIndex < s.plannedRoute.length - 1) {
              s.autoPilotIndex++;
            } else {
              // Reached Point B destination -> trigger automatic core drill extraction!
              s.autoPilotActive = false;
              s.sampleBufferTimer = 0.14;
            }
          } else {
            moveX = dx / distToNode;
            moveZ = dz / distToNode;
          }
        }

        const moveLen = Math.hypot(moveX, moveZ);
        if (moveLen > 0) {
          moveX /= moveLen;
          moveZ /= moveLen;
        }

        const localSlope = groundSlopeAt(s.playerX, s.playerZ, s.region);
        const slopeSpeedFactor = localSlope > 18 ? 0.65 : localSlope > 12 ? 0.85 : 1.0;
        const maxSpeed = 8.8 * slopeSpeedFactor;

        const targetVx = moveX * maxSpeed;
        const targetVz = moveZ * maxSpeed;
        const accel = s.onGround ? 14.0 : 6.5;
        s.vx = THREE.MathUtils.damp(s.vx, targetVx, accel, simDt);
        s.vz = THREE.MathUtils.damp(s.vz, targetVz, accel, simDt);

        if (s.jumpBufferTimer > 0 && s.coyoteTimer > 0 && s.battery >= 3) {
          s.vy = 7.4;
          s.onGround = false;
          s.coyoteTimer = 0;
          s.jumpBufferTimer = 0;
          s.battery = Math.max(0, s.battery - 2.5);
          s.scaleX = 0.85;
          s.scaleY = 1.18;
          soundEngine.playThrusterHop();
          spawnParticleBurst(s.playerX, s.playerY, s.playerZ, 8, 0xf59e0b, 0.9);
        }

        if (!s.onGround && s.vy > 0 && !s.keysHeld.has('Space')) {
          s.vy *= Math.pow(0.45, simDt * 12);
        }

        s.vy -= 14.5 * simDt;

        s.playerX += s.vx * simDt;
        s.playerZ += s.vz * simDt;
        const radialDist = Math.hypot(s.playerX, s.playerZ);
        if (radialDist > WORLD_PLAYABLE_RADIUS) {
          const clampScale = WORLD_PLAYABLE_RADIUS / radialDist;
          s.playerX *= clampScale;
          s.playerZ *= clampScale;
        }

        const groundY = groundHeightAt(s.playerX, s.playerZ, s.region);
        s.playerY += s.vy * simDt;
        if (s.playerY <= groundY) {
          if (!s.onGround && s.vy < -2.5) {
            s.scaleX = 1.22;
            s.scaleY = 0.78;
            soundEngine.playStep();
            spawnParticleBurst(s.playerX, groundY, s.playerZ, 5, 0xd97706, 0.65);
          }
          s.playerY = groundY;
          s.vy = 0;
          s.onGround = true;
        }

        s.scaleX = THREE.MathUtils.damp(s.scaleX, 1, 12, simDt);
        s.scaleY = THREE.MathUtils.damp(s.scaleY, 1, 12, simDt);

        const horizSpeed = Math.hypot(s.vx, s.vz);
        if (horizSpeed > 0.35) {
          const targetYaw = Math.atan2(s.vx, s.vz);
          let diff = targetYaw - s.facingYaw;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          s.facingYaw += diff * (1 - Math.exp(-12 * simDt));

          if (s.onGround) {
            const prevStepIndex = Math.floor(s.walkDistanceAccum / 2.2);
            s.walkDistanceAccum += horizSpeed * simDt;
            const nextStepIndex = Math.floor(s.walkDistanceAccum / 2.2);
            if (nextStepIndex > prevStepIndex) {
              soundEngine.playStep();
            }
          }
        }

        const legSwing = Math.sin(s.walkDistanceAccum * 2.4) * Math.min(1, horizSpeed / 5) * 0.48;
        astronaut.leftLeg.rotation.x = legSwing;
        astronaut.rightLeg.rotation.x = -legSwing;
        astronaut.group.position.set(s.playerX, s.playerY, s.playerZ);
        astronaut.group.rotation.y = s.facingYaw;
        astronaut.group.scale.set(s.scaleX, s.scaleY, s.scaleX);

        if (s.drillAnimTimer > 0) {
          s.drillAnimTimer -= simDt;
          astronaut.drillBeam.visible = true;
        } else {
          astronaut.drillBeam.visible = false;
        }

        const currentWaypoints = REGION_WAYPOINTS[s.region];
        let nearbyWp: ScienceWaypoint | null = null;
        for (const wp of currentWaypoints) {
          if (!s.collectedIds.includes(wp.id)) {
            if (Math.hypot(wp.x - s.playerX, wp.z - s.playerZ) < 4.8) {
              nearbyWp = wp;
              break;
            }
          }
        }
        const nearHabitat = Math.hypot(s.playerX - HABITAT_BASE.x, s.playerZ - HABITAT_BASE.z) < 7.5;

        if (s.sampleBufferTimer > 0) {
          s.sampleBufferTimer = 0;
          s.drillAnimTimer = 0.45;
          if (nearbyWp) {
            s.collectedIds = [...s.collectedIds, nearbyWp.id];
            s.score += nearbyWp.sciencePoints;
            s.bestScore = Math.max(s.bestScore, s.score);
            s.hitstopTimer = 0.055;
            s.cameraTrauma = 0.35;
            soundEngine.playSampleExtract();
            spawnParticleBurst(
              nearbyWp.x,
              groundHeightAt(nearbyWp.x, nearbyWp.z, s.region) + 1.0,
              nearbyWp.z,
              22,
              0x06b6d4,
              1.35
            );

            if (nearbyWp.sampleType === 'ice') {
              s.o2 = Math.min(100, s.o2 + 25);
              s.battery = Math.min(100, s.battery + 20);
              s.statusBanner = `ISRU Water-Ice Extracted (+25% O2) · ${s.collectedIds.length}/${currentWaypoints.length} POIs Sampled`;
            } else {
              s.statusBanner = `Sampled ${nearbyWp.code}: ${nearbyWp.mineralogy} (+${nearbyWp.sciencePoints} pts)`;
            }
            s.bannerTimer = 5.0;

            // Automatically plot A* path to next uncollected POI!
            const nextUncollected = currentWaypoints.find((w) => !s.collectedIds.includes(w.id));
            if (nextUncollected) {
              const curA = { x: nearbyWp.x, z: nearbyWp.z, label: nearbyWp.code };
              const curB = { x: nextUncollected.x, z: nextUncollected.z, label: nextUncollected.code };
              const nextPath = computeAStarRoute(curA, curB, {
                region: s.region,
                avoidSlopes: s.avoidSlopes,
                solarStormIntensity: s.solarStormIntensity
              });
              s.plannedRoute = nextPath;
              s.autoPilotIndex = 1;
              s.needsRouteRefresh = true;
              setTargetWaypointId(nextUncollected.id);
              setPointA(curA);
              setPointB(curB);
              setPlannedRoute(nextPath);
            } else {
              s.statusBanner = 'ALL 5 SCIENCE POIs SAMPLED! Return to HAB-01 Airlock to Complete Mission!';
              s.bannerTimer = 8.0;
            }
          } else {
            const wPct = waterIceAt(s.playerX, s.playerZ, s.region);
            soundEngine.playLayerSwitch(1);
            spawnParticleBurst(s.playerX, s.playerY + 0.5, s.playerZ, 8, 0x38bdf8, 0.8);
            s.statusBanner = `SHERLOC Local Scan: Regolith Hydration ${wPct.toFixed(1)} wt% H2O · Follow Green A* Path to Target POI`;
            s.bannerTimer = 3.5;
          }
        }

        if (nearHabitat && s.collectedIds.length >= currentWaypoints.length) {
          const finalBonus = Math.round(s.o2 * 3 + s.suitHp * 2);
          s.score += finalBonus;
          s.bestScore = Math.max(s.bestScore, s.score);
          soundEngine.playVictory();
          const snap: RunSnapshot = {
            outcome: 'victory',
            reason: `All 5 ${MARS_REGIONS[s.region].name} science cores cataloged via A* pathfinding and sealed in the Ares-IV Airlock.`,
            score: s.score,
            bestScore: s.bestScore,
            samplesCollected: s.collectedIds.length,
            totalSamples: currentWaypoints.length,
            elapsedSeconds: s.elapsedSeconds,
            radiationDoseUSv: s.radiationDoseUSv
          };
          setRunSnapshot(snap);
          document.body.dataset.state = 'gameover';
          s.gameState = 'gameover';
          setGameState('gameover');
          return;
        }

        let activeAttackers = s.hazards.filter((h) => h.phase === 'windup' || h.phase === 'active').length;
        s.hazards = s.hazards.map((hz, idx) => {
          const prevPhase = hz.phase;
          const canStart = activeAttackers < 2;
          const updated = stepHazardBehavior(hz, s.playerX, s.playerZ, simDt, canStart);
          if (prevPhase === 'patrol' && updated.phase === 'windup') {
            activeAttackers++;
            soundEngine.playHazardWindup();
          }

          const vis = hazardVisuals[idx];
          if (vis) {
            const hy = groundHeightAt(updated.x, updated.z, s.region);
            vis.group.position.set(updated.x, hy, updated.z);
            vis.coreGroup.rotation.y += simDt * (updated.phase === 'active' ? 7.5 : 2.5);
            const ringMat = vis.telegraphRing.material as THREE.MeshBasicMaterial;
            if (updated.phase === 'windup') {
              ringMat.opacity = 0.45 + 0.35 * Math.sin(nowMs * 0.025);
              vis.telegraphRing.scale.setScalar(1.0 + (0.75 - updated.phaseTimer) * 0.45);
            } else if (updated.phase === 'active') {
              ringMat.opacity = 0.85;
              vis.telegraphRing.scale.setScalar(1.35);
            } else {
              ringMat.opacity = 0.14;
              vis.telegraphRing.scale.setScalar(1.0);
            }
          }

          const dPlayer = Math.hypot(updated.x - s.playerX, updated.z - s.playerZ);
          if (updated.phase === 'active' && dPlayer < updated.radius + 0.75 && !nearHabitat) {
            s.suitHp = Math.max(0, s.suitHp - 18);
            s.battery = Math.max(0, s.battery - 8);
            s.hitstopTimer = 0.065;
            s.hitFlashTimer = 0.12;
            s.cameraTrauma = 0.65;
            const kx = (s.playerX - updated.x) / (dPlayer || 1);
            const kz = (s.playerZ - updated.z) / (dPlayer || 1);
            s.vx = kx * 9.5;
            s.vz = kz * 9.5;
            s.vy = 4.2;
            s.onGround = false;
            updated.phase = 'recovery';
            updated.phaseTimer = 1.6;
            soundEngine.playHeavyImpact();
            spawnParticleBurst(s.playerX, s.playerY + 0.8, s.playerZ, 20, 0xef4444, 1.4);
            s.statusBanner = `HAZARD IMPACT (${updated.archetype.toUpperCase()}) · Suit Integrity ${Math.round(s.suitHp)}%`;
            s.bannerTimer = 4.0;
          }

          return updated;
        });

        if (nearHabitat) {
          s.o2 = Math.min(100, s.o2 + simDt * 18);
          s.battery = Math.min(100, s.battery + simDt * 22);
          s.suitHp = Math.min(100, s.suitHp + simDt * 8);
        } else {
          const slopeDrain = localSlope > 16 ? 1.85 : 1.0;
          s.o2 = Math.max(0, s.o2 - simDt * 0.55 * slopeDrain);
          s.battery = Math.max(0, s.battery - simDt * (horizSpeed > 0.5 ? 0.42 : 0.15) * slopeDrain);
        }

        s.o2Ghost = THREE.MathUtils.damp(s.o2Ghost, s.o2, 2.8, simDt);
        s.batteryGhost = THREE.MathUtils.damp(s.batteryGhost, s.battery, 2.8, simDt);

        const currentRadRate = radiationAt(s.playerX, s.playerZ, s.solarStormIntensity, s.region);
        s.radiationDoseUSv += (currentRadRate / 180) * simDt;
        if (currentRadRate > 55 && !nearHabitat) {
          s.suitHp = Math.max(0, s.suitHp - simDt * 2.0);
        }

        if (s.bannerTimer > 0) {
          s.bannerTimer -= simDt;
          if (s.bannerTimer <= 0) s.statusBanner = null;
        }

        if (s.suitHp <= 0 || s.o2 <= 0) {
          soundEngine.playDefeat();
          const snap: RunSnapshot = {
            outcome: 'defeat',
            reason:
              s.o2 <= 0
                ? 'Primary Life Support O2 reserve depleted before returning to the Ares-IV Airlock.'
                : 'Pressurized EVA suit integrity breached by Martian environmental hazards.',
            score: s.score,
            bestScore: Math.max(s.bestScore, s.score),
            samplesCollected: s.collectedIds.length,
            totalSamples: currentWaypoints.length,
            elapsedSeconds: s.elapsedSeconds,
            radiationDoseUSv: s.radiationDoseUSv
          };
          setRunSnapshot(snap);
          document.body.dataset.state = 'gameover';
          s.gameState = 'gameover';
          setGameState('gameover');
          return;
        }

        if (nowMs - lastHudSyncMs > 100) {
          lastHudSyncMs = nowMs;
          const wind = windAt(s.playerX, s.playerZ, s.elapsedSeconds, s.region);
          const regSpec = MARS_REGIONS[s.region];
          setTelemetry({
            suitHp: s.suitHp,
            o2: s.o2,
            o2Ghost: s.o2Ghost,
            battery: s.battery,
            batteryGhost: s.batteryGhost,
            radiationDoseUSv: s.radiationDoseUSv,
            currentRadRateUSv: currentRadRate,
            elevationMeters: regSpec.baseElevationMeters + s.playerY * 4.5,
            slopeDeg: localSlope,
            waterWtPercent: waterIceAt(s.playerX, s.playerZ, s.region),
            windSpeedMs: wind.speedMs,
            score: s.score,
            collectedIds: s.collectedIds,
            nearbyWaypoint: nearbyWp,
            nearHabitat,
            statusBanner: s.statusBanner,
            solarStormActive: s.solarStormIntensity > 0.4,
            autoPilotActive: s.autoPilotActive,
            playerX: s.playerX,
            playerZ: s.playerZ
          });
        }
      }

      for (let i = 0; i < PARTICLE_POOL_SIZE; i++) {
        const p = s.particles[i];
        if (p.active) {
          p.life += dt;
          if (p.life >= p.maxLife) {
            p.active = false;
            _particleScale.setScalar(0.0001);
            _particlePos.set(0, -100, 0);
          } else {
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.z += p.vz * dt;
            p.vy -= 9.8 * dt;
            const scale = p.size * (1 - p.life / p.maxLife);
            _particlePos.set(p.x, p.y, p.z);
            _particleScale.setScalar(Math.max(0.01, scale));
            _particleColor.setHex(p.colorHex);
            particleInstanced.setColorAt(i, _particleColor);
          }
        } else {
          _particleScale.setScalar(0.0001);
          _particlePos.set(0, -100, 0);
        }
        _particleMat4.compose(_particlePos, _particleQuat, _particleScale);
        particleInstanced.setMatrixAt(i, _particleMat4);
      }
      particleInstanced.instanceMatrix.needsUpdate = true;
      if (particleInstanced.instanceColor) particleInstanced.instanceColor.needsUpdate = true;

      // Elevated Tactical Third-Person Chase Camera showing terrain relief + A* path ahead
      _camTargetPos.set(s.playerX, s.playerY + 11.5, s.playerZ + 15.5);
      const camGroundY = groundHeightAt(_camTargetPos.x, _camTargetPos.z, s.region) + 2.8;
      if (_camTargetPos.y < camGroundY) _camTargetPos.y = camGroundY;

      camera.position.lerp(_camTargetPos, 1 - Math.exp(-6.5 * dt));

      const shakeMag = s.cameraTrauma * s.cameraTrauma * 0.65;
      const shakeX = (Math.random() - 0.5) * shakeMag;
      const shakeY = (Math.random() - 0.5) * shakeMag;

      _lookAtPos.set(s.playerX + shakeX, s.playerY + 1.0 + shakeY, s.playerZ - 3.5);
      camera.lookAt(_lookAtPos);

      renderer.render(scene, camera);
      s.justPressed.clear();
    };

    rafId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
      window.removeEventListener('resize', handleResize);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      renderer.dispose();
    };
  }, [spawnParticleBurst]);

  // Unified Window Keyboard & Focus-Loss Hygiene
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const code = e.code;
      const s = simRef.current;

      if (!s.keysHeld.has(code)) {
        s.justPressed.add(code);
      }
      s.keysHeld.add(code);

      if (s.gameState === 'title' || s.gameState === 'gameover') {
        if (code === 'Enter' || code === 'Space') {
          e.preventDefault();
          handleStartGame();
        }
        return;
      }

      if (code === 'Escape' || code === 'KeyP') {
        e.preventDefault();
        if (s.routePlannerOpen) {
          setRoutePlannerOpen(false);
        } else if (s.gameState === 'playing') {
          s.keysHeld.clear();
          document.body.dataset.state = 'paused';
          s.gameState = 'paused';
          setGameState('paused');
        } else if (s.gameState === 'paused') {
          document.body.dataset.state = 'playing';
          s.gameState = 'playing';
          setGameState('playing');
        }
        return;
      }

      if (s.gameState !== 'playing') return;

      if (code === 'Digit1') handleSelectLayer('mola');
      else if (code === 'Digit2') handleSelectLayer('rad');
      else if (code === 'Digit3') handleSelectLayer('odyssey');
      else if (code === 'Digit4') handleSelectLayer('natural');
      else if (code === 'Digit5') handleSelectLayer('meda');
      else if (code === 'KeyG') {
        e.preventDefault();
        const nextMode: ViewMode = s.viewMode === 'globe' ? 'terrain' : 'globe';
        s.viewMode = nextMode;
        setViewMode(nextMode);
        soundEngine.playLayerSwitch(2);
      } else if (code === 'KeyF') {
        e.preventDefault();
        handleToggleAutoPilot();
      } else if (code === 'KeyX') {
        e.preventDefault();
        handleToggleStorm();
      } else if (code === 'KeyE') {
        e.preventDefault();
        s.sampleBufferTimer = 0.14;
      } else if (code === 'Space') {
        e.preventDefault();
        s.jumpBufferTimer = 0.14;
      } else if (code === 'KeyT') {
        e.preventDefault();
        setRoutePlannerOpen((prev) => !prev);
      } else if (code === 'KeyH') {
        e.preventDefault();
        setDockCollapsed((prev) => !prev);
      } else if (code === 'KeyM') {
        e.preventDefault();
        handleToggleMute();
      } else if (code === 'KeyR') {
        e.preventDefault();
        handleStartGame();
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      simRef.current.keysHeld.delete(e.code);
    };

    const clearKeys = () => {
      simRef.current.keysHeld.clear();
      simRef.current.justPressed.clear();
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', clearKeys);
    document.addEventListener('visibilitychange', clearKeys);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', clearKeys);
      document.removeEventListener('visibilitychange', clearKeys);
    };
  }, [
    handleStartGame,
    handleSelectLayer,
    handleToggleAutoPilot,
    handleToggleStorm,
    handleToggleMute
  ]);

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-[#060911] select-none">
      {/* Isolated Full-Viewport 3D WebGL Canvas Mount */}
      <div
        ref={canvasMountRef}
        data-testid="mars-webgl-viewport"
        className="fixed inset-0 w-full h-full z-0"
      />

      {/* Title Screen Overlay over 3D Interactive Mars Orbital Globe */}
      {gameState === 'title' && (
        <TitleScreenOverlay
          selectedRegion={region}
          onSelectRegion={handleSelectRegion}
          onStartGame={handleStartGame}
          onStartWithPresetRoute={() => {
            handleStartGame();
            setRoutePlannerOpen(true);
          }}
        />
      )}

      {/* Playing HUD & Unified Collapsible Bottom Dock */}
      {gameState !== 'title' && (
        <EvaHud
          telemetry={telemetry}
          viewMode={viewMode}
          onToggleViewMode={(mode) => {
            simRef.current.viewMode = mode;
            setViewMode(mode);
            soundEngine.playLayerSwitch(2);
          }}
          region={region}
          onSelectRegion={handleSelectRegion}
          activeLayer={activeLayer}
          onSelectLayer={handleSelectLayer}
          targetWaypointId={targetWaypointId}
          onSelectTargetPoi={handleSelectTargetPoi}
          onTriggerSample={handleTriggerSample}
          onTriggerBoost={handleTriggerBoost}
          onToggleAutoPilot={handleToggleAutoPilot}
          onToggleStorm={handleToggleStorm}
          onOpenRoutePlanner={() => setRoutePlannerOpen(true)}
          muted={muted}
          onToggleMute={handleToggleMute}
          onPause={() => {
            simRef.current.keysHeld.clear();
            document.body.dataset.state = 'paused';
            simRef.current.gameState = 'paused';
            setGameState('paused');
          }}
          onRestart={handleStartGame}
          dockCollapsed={dockCollapsed}
          onToggleDock={() => setDockCollapsed((prev) => !prev)}
        />
      )}

      {/* Interactive A* Pathfinding & Multi-Mission GIS Route Planner Modal */}
      <TacticalRoutePlanner
        isOpen={routePlannerOpen}
        onClose={() => setRoutePlannerOpen(false)}
        region={region}
        onSelectRegion={handleSelectRegion}
        activeLayer={activeLayer}
        onSelectLayer={handleSelectLayer}
        playerPos={{ x: telemetry.playerX, z: telemetry.playerZ }}
        collectedIds={telemetry.collectedIds}
        pointA={pointA}
        pointB={pointB}
        avoidSlopes={avoidSlopes}
        onToggleAvoidSlopes={handleToggleAvoidSlopes}
        onSelectEndpoints={handleSelectEndpoints}
        plannedRoute={plannedRoute}
        onStartAutoTraverse={() => {
          simRef.current.viewMode = 'terrain';
          setViewMode('terrain');
          simRef.current.autoPilotActive = true;
          simRef.current.autoPilotIndex = 1;
        }}
        solarStormIntensity={telemetry.solarStormActive ? 0.9 : 0}
      />

      {/* Pause / Victory / Defeat Status Modal */}
      {(gameState === 'paused' || gameState === 'gameover') && (
        <StatusModalOverlay
          gameState={gameState}
          snapshot={runSnapshot}
          onResume={() => {
            document.body.dataset.state = 'playing';
            simRef.current.gameState = 'playing';
            setGameState('playing');
          }}
          onRestart={handleStartGame}
          onReturnTitle={() => {
            resetSimRun(simRef.current.region);
            document.body.dataset.state = 'title';
            simRef.current.gameState = 'title';
            simRef.current.viewMode = 'globe';
            setViewMode('globe');
            setGameState('title');
          }}
        />
      )}
    </main>
  );
}
