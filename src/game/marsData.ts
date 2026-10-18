export type MarsRegionId = 'jezero' | 'marineris';
export type NasaLayerId = 'natural' | 'mola' | 'odyssey' | 'rad' | 'meda';
export type ViewMode = 'globe' | 'terrain';

export interface MarsRegionSpec {
  id: MarsRegionId;
  name: string;
  subtitle: string;
  coordinates: string;
  latDeg: number;
  lonDeg: number;
  baseElevationMeters: number;
  description: string;
  missions: string;
}

export const MARS_REGIONS: Record<MarsRegionId, MarsRegionSpec> = {
  jezero: {
    id: 'jezero',
    name: 'Jezero Crater Delta',
    subtitle: 'Western Fluvial Fan & Neretva Vallis',
    coordinates: '18.38°N, 77.58°E',
    latDeg: 18.38,
    lonDeg: 77.58,
    baseElevationMeters: -2532,
    description: 'Ancient paleolake delta containing hydrated phyllosilicate clays, carbonate rims, and Perseverance sample depot.',
    missions: 'MRO HiRISE · Mars 2020 Perseverance · MGS MOLA · Odyssey GRS'
  },
  marineris: {
    id: 'marineris',
    name: 'Valles Marineris',
    subtitle: 'Candor Chasma Layered Canyon Floor',
    coordinates: '6.50°S, 289.20°E',
    latDeg: -6.5,
    lonDeg: -70.8,
    baseElevationMeters: -4180,
    description: 'Deep tectonic graben flanked by steep basaltic scarps, layered sulfate mesas, and deep radiation-shielded chasma trenches.',
    missions: 'MGS MOLA · MRO CRISM · Mars Express HRSC · MSL RAD'
  }
};

export interface NasaLayerSpec {
  id: NasaLayerId;
  keyBind: string;
  shortName: string;
  fullName: string;
  instruments: string;
  unit: string;
  accentHex: string;
  description: string;
  survivalGuidance: string;
}

export const NASA_LAYERS: Record<NasaLayerId, NasaLayerSpec> = {
  mola: {
    id: 'mola',
    keyBind: '1',
    shortName: 'Slope Hazard (Green-Red)',
    fullName: 'MGS MOLA + HiRISE Slope & Traction Gradient',
    instruments: 'Mars Orbiter Laser Altimeter · HiRISE Stereo DEM',
    unit: 'deg / m',
    accentHex: '#10B981',
    description: 'Green-to-Amber-to-Red slope hazard gradient mapping safe rover/EVA corridors (<10° green) vs. dangerous cliffs (>16° red).',
    survivalGuidance: 'A* Pathfinding automatically routes through green low-slope valleys to prevent rover rollovers and +70% O2 drain.'
  },
  rad: {
    id: 'rad',
    keyBind: '2',
    shortName: 'Radiation & Dust Storm',
    fullName: 'MSL RAD Dosimetry + MAVEN SEP & Dust Optical Depth',
    instruments: 'Radiation Assessment Detector · MAVEN SEP · MCS',
    unit: 'uSv/h · tau',
    accentHex: '#EF4444',
    description: 'Ionizing cosmic/solar radiation exposure across high ridges vs. shielded basalt canyon walls and dust storm attenuation.',
    survivalGuidance: 'High ridges exceed 45 uSv/h during solar storms. Route along deep canyon walls or basalt overhangs (<14 uSv/h).'
  },
  odyssey: {
    id: 'odyssey',
    keyBind: '3',
    shortName: 'Water-Ice & Minerals',
    fullName: 'Odyssey GRS + MRO CRISM Subsurface Ice & Clays',
    instruments: 'Gamma Ray Spectrometer · SHARAD Radar · CRISM',
    unit: 'wt% H2O',
    accentHex: '#06B6D4',
    description: 'Detects buried hydrogen/water-ice lenses and iron-magnesium smectite clay biosignature outcrops.',
    survivalGuidance: 'Prioritize cyan basins (>7.0 wt% H2O) for ISRU water extraction and astrobiology core drilling.'
  },
  natural: {
    id: 'natural',
    keyBind: '4',
    shortName: 'HiRISE True-Color DEM',
    fullName: 'MRO HiRISE + Viking True-Color Regolith Relief',
    instruments: 'High Resolution Imaging Science Experiment',
    unit: 'Albedo / m',
    accentHex: '#F59E0B',
    description: 'True-to-life ferric oxide dust, dark basaltic bedrock exposures, and subtle MOLA elevation contour lines.',
    survivalGuidance: 'Inspect natural geological stratigraphy and exposed bedrock benches before deploying rotary core drills.'
  },
  meda: {
    id: 'meda',
    keyBind: '5',
    shortName: 'MEDA Wind & Vortices',
    fullName: 'Perseverance MEDA Surface Wind Shear & Thermal Flux',
    instruments: 'Mars Environmental Dynamics Analyzer',
    unit: 'm/s · Pa',
    accentHex: '#A855F7',
    description: 'Real-time katabatic canyon wind corridors, barometric pressure drops, and convective dust devil paths.',
    survivalGuidance: 'Avoid convective pressure troughs where dust devils reduce visibility and solar array charging.'
  }
};

export interface ScienceWaypoint {
  id: string;
  region: MarsRegionId;
  code: string;
  name: string;
  categoryLabel: string;
  missionSource: string;
  x: number;
  z: number;
  elevationMeters: number;
  mineralogy: string;
  waterWtPercent: number;
  baseRadiationUSv: number;
  sciencePoints: number;
  sampleType: 'core' | 'ice' | 'shelter' | 'calibration';
  briefing: string;
}

export const REGION_WAYPOINTS: Record<MarsRegionId, ScienceWaypoint[]> = {
  jezero: [
    {
      id: 'wp-butler',
      region: 'jezero',
      code: 'POI-A1',
      name: 'Octavia E. Butler Basalt Pad',
      categoryLabel: 'Basalt Outcrop & Calibration',
      missionSource: 'Mars 2020 Perseverance · HiRISE',
      x: 20,
      z: -18,
      elevationMeters: -2535,
      mineralogy: 'Olivine-rich volcanic basalt floor & witness cache',
      waterWtPercent: 2.4,
      baseRadiationUSv: 24,
      sciencePoints: 250,
      sampleType: 'calibration',
      briefing: 'Calibrate X-ray fluorescence spectrometer on pristine crater-floor basalt.'
    },
    {
      id: 'wp-three-forks',
      region: 'jezero',
      code: 'POI-B2',
      name: 'Three Forks Turbidite Scarp',
      categoryLabel: 'Core Drill Target',
      missionSource: 'MGS MOLA · MRO CTX',
      x: -25,
      z: -16,
      elevationMeters: -2524,
      mineralogy: 'Cross-bedded fluvial conglomerate & carbonate',
      waterWtPercent: 4.9,
      baseRadiationUSv: 26,
      sciencePoints: 350,
      sampleType: 'core',
      briefing: 'Extract sedimentary river delta core deposited by ancient Lake Jezero.'
    },
    {
      id: 'wp-bright-angel',
      region: 'jezero',
      code: 'POI-C3',
      name: 'Bright Angel Smectite Cliff',
      categoryLabel: 'Biosignature Core Site',
      missionSource: 'MRO CRISM · SHERLOC Raman',
      x: -30,
      z: 24,
      elevationMeters: -2502,
      mineralogy: 'Fe/Mg-Phyllosilicate mudstone + sulfate veins',
      waterWtPercent: 7.1,
      baseRadiationUSv: 29,
      sciencePoints: 500,
      sampleType: 'core',
      briefing: 'Prime astrobiology target. Fine clay mudstone preserves organic ring aromatics.'
    },
    {
      id: 'wp-neretva-ice',
      region: 'jezero',
      code: 'POI-D4',
      name: 'Neretva Vallis Glacier Lens',
      categoryLabel: 'Subsurface Ice Deposit',
      missionSource: 'Odyssey GRS · MRO SHARAD',
      x: 26,
      z: 28,
      elevationMeters: -2520,
      mineralogy: 'Pore-filling water ice beneath 0.8m regolith lag',
      waterWtPercent: 9.4,
      baseRadiationUSv: 20,
      sciencePoints: 550,
      sampleType: 'ice',
      briefing: 'Drill shallow SHARAD radar reflector to harvest ISRU survival water and oxygen.'
    },
    {
      id: 'wp-belva-shelter',
      region: 'jezero',
      code: 'POI-E5',
      name: 'Belva Basalt Lava Tube Alcove',
      categoryLabel: 'Basalt Shelter & Overhang',
      missionSource: 'MSL RAD · MAVEN SEP',
      x: 2,
      z: 40,
      elevationMeters: -2489,
      mineralogy: 'Dense vesicular basalt overhang (3.4m roof)',
      waterWtPercent: 3.8,
      baseRadiationUSv: 8,
      sciencePoints: 450,
      sampleType: 'shelter',
      briefing: 'Certify natural basalt cliff overhang for emergency crew solar storm shelter.'
    }
  ],
  marineris: [
    {
      id: 'vm-ceti-mensa',
      region: 'marineris',
      code: 'VM-A1',
      name: 'Ceti Mensa Sulfate Bench',
      categoryLabel: 'Core Drill Target',
      missionSource: 'MRO CRISM · Mars Express',
      x: 22,
      z: -20,
      elevationMeters: -4145,
      mineralogy: 'Polyhydrated magnesium sulfate & ferric oxide',
      waterWtPercent: 6.2,
      baseRadiationUSv: 18,
      sciencePoints: 350,
      sampleType: 'core',
      briefing: 'Sample wind-sculpted interior layered deposit (ILD) inside Candor Chasma.'
    },
    {
      id: 'vm-fault-basalt',
      region: 'marineris',
      code: 'VM-B2',
      name: 'Tectonic Graben Basalt Dyke',
      categoryLabel: 'Basalt Outcrop & Calibration',
      missionSource: 'MGS MOLA · HiRISE',
      x: -26,
      z: -18,
      elevationMeters: -4110,
      mineralogy: 'Columnar flood basalt & pyroxene breccia',
      waterWtPercent: 3.1,
      baseRadiationUSv: 21,
      sciencePoints: 300,
      sampleType: 'calibration',
      briefing: 'Analyze deep crustal stratigraphy exposed by Valles Marineris rifting.'
    },
    {
      id: 'vm-chasma-ice',
      region: 'marineris',
      code: 'VM-C3',
      name: 'Candor Abyssal Permafrost Trap',
      categoryLabel: 'Subsurface Ice Deposit',
      missionSource: 'TGO FREND · Odyssey GRS',
      x: 28,
      z: 26,
      elevationMeters: -4195,
      mineralogy: 'Hydrogen-rich permafrost & hydrated kieserite',
      waterWtPercent: 10.6,
      baseRadiationUSv: 14,
      sciencePoints: 600,
      sampleType: 'ice',
      briefing: 'High-concentration equatorial water-ice reservoir discovered in shadowed canyon trough.'
    },
    {
      id: 'vm-hematite-basin',
      region: 'marineris',
      code: 'VM-D4',
      name: 'Ophir Chasma Hematite Concretions',
      categoryLabel: 'Biosignature Core Site',
      missionSource: 'MGS TES · MRO CRISM',
      x: -28,
      z: 24,
      elevationMeters: -4130,
      mineralogy: 'Crystalline gray hematite spherules & clay',
      waterWtPercent: 7.4,
      baseRadiationUSv: 19,
      sciencePoints: 500,
      sampleType: 'core',
      briefing: 'Extract hydrothermal groundwater concretions indicative of ancient habitable aquifers.'
    },
    {
      id: 'vm-canyon-alcove',
      region: 'marineris',
      code: 'VM-E5',
      name: 'Candor Wall Sub-Basalt Cavern',
      categoryLabel: 'Basalt Shelter & Overhang',
      missionSource: 'MSL RAD · HiRISE Stereo',
      x: 0,
      z: 38,
      elevationMeters: -4085,
      mineralogy: 'Massive cliff-base basaltic talus cavern',
      waterWtPercent: 4.5,
      baseRadiationUSv: 6,
      sciencePoints: 450,
      sampleType: 'shelter',
      briefing: 'Deep canyon geometry + basaltic roof blocks >88% of Solar Energetic Particles.'
    }
  ]
};

// Backwards-compatible default export for tests/components
export const JEZERO_WAYPOINTS = REGION_WAYPOINTS.jezero;

export const HABITAT_BASE = {
  id: 'ares-hab',
  code: 'HAB-01',
  name: 'Ares-IV Pressurized Habitat & Airlock',
  x: -9.5,
  z: -1.5,
  radius: 6.5
};

export const WORLD_PLAYABLE_RADIUS = 56;

/**
 * Deterministic MOLA-inspired terrain height at world coordinates (x, z) in meters.
 * Includes distinct geological features (steep central ridges, valleys, crater rims, and canyon walls)
 * so A* pathfinding visibly routes around high-slope red ridges!
 */
export function groundHeightAt(x: number, z: number, region: MarsRegionId = 'jezero'): number {
  const distFromCenter = Math.hypot(x, z);
  const distFromHab = Math.hypot(x - HABITAT_BASE.x, z - HABITAT_BASE.z);
  const minBasinDist = Math.min(distFromCenter, distFromHab);
  // Smooth flat landing basin around Habitat Base and central spawn pad
  const padFlatten = Math.min(1, Math.max(0, (minBasinDist - 7.5) / 6.5));

  // Keep immediate 3m radius around science waypoints moderately level so beacons sit cleanly
  const wps = REGION_WAYPOINTS[region];
  let wpFlatten = 1.0;
  for (let i = 0; i < wps.length; i++) {
    const dWp = Math.hypot(x - wps[i].x, z - wps[i].z);
    if (dWp < 5.5) {
      wpFlatten = Math.min(wpFlatten, 0.35 + 0.65 * Math.max(0, (dWp - 2.0) / 3.5));
    }
  }

  // Prominent steep basaltic ridge obstacles in the midground so straight lines hit >20° slopes
  // while A* finds smooth green saddle corridors around them!
  const ridge1Dist = Math.hypot((x - 8) * 0.85, (z + 8) * 1.35);
  const ridge1 = 6.2 * Math.exp(-(ridge1Dist * ridge1Dist) / 42) * padFlatten * wpFlatten;

  const ridge2Dist = Math.hypot((x + 14) * 1.1, (z - 6) * 0.8);
  const ridge2 = 7.0 * Math.exp(-(ridge2Dist * ridge2Dist) / 48) * padFlatten * wpFlatten;

  const ridge3Dist = Math.hypot((x - 10) * 0.9, (z - 16) * 1.15);
  const ridge3 = 6.6 * Math.exp(-(ridge3Dist * ridge3Dist) / 45) * padFlatten * wpFlatten;

  if (region === 'marineris') {
    // Valles Marineris: Deep canyon trough running SW-NE with towering stepped chasma walls and central mensa
    const canyonWallEast = Math.max(0, (x - 28) / 14);
    const canyonWallWest = Math.max(0, (-x - 28) / 14);
    const chasmaWalls = (canyonWallEast * canyonWallEast + canyonWallWest * canyonWallWest) * 11.0;
    const undulation =
      (Math.sin(x * 0.09 + 0.2) * Math.cos(z * 0.08) * 2.2 +
        Math.cos(x * 0.18 - z * 0.15) * 0.9) *
      padFlatten;
    const rimStart = WORLD_PLAYABLE_RADIUS - 5;
    const rimFactor = Math.max(0, (distFromCenter - rimStart) / 13);
    const outerRim = rimFactor * rimFactor * 12.0;

    return undulation + ridge1 + ridge2 + ridge3 + chasmaWalls + outerRim;
  }

  // Jezero Crater Western Delta: Terraced delta fan rising NW, ancient river channels, and ice basin
  const deltaSlope = (z * 0.042 - x * 0.024) * padFlatten;
  const ridges =
    (Math.sin(x * 0.085 + 0.4) * Math.cos(z * 0.075 - 0.2) * 1.95 +
      Math.sin(x * 0.19 - z * 0.16) * 0.78 +
      Math.cos(x * 0.31 + z * 0.27) * 0.25) *
    padFlatten;

  const rimStart = WORLD_PLAYABLE_RADIUS - 6;
  const rimFactor = Math.max(0, (distFromCenter - rimStart) / 14);
  const craterRimHeight = rimFactor * rimFactor * 11.5;

  const distIce = Math.hypot(x - 26, z - 28);
  const iceBasin = -2.2 * Math.exp(-(distIce * distIce) / 140);

  return deltaSlope + ridges + ridge1 + ridge2 + ridge3 + craterRimHeight + iceBasin;
}

/**
 * Computes local slope angle in degrees at (x, z) using finite differences.
 */
export function groundSlopeAt(x: number, z: number, region: MarsRegionId = 'jezero'): number {
  const eps = 0.5;
  const hx1 = groundHeightAt(x + eps, z, region);
  const hx0 = groundHeightAt(x - eps, z, region);
  const hz1 = groundHeightAt(x, z + eps, region);
  const hz0 = groundHeightAt(x, z - eps, region);

  const dx = (hx1 - hx0) / (2 * eps);
  const dz = (hz1 - hz0) / (2 * eps);
  const gradMag = Math.hypot(dx, dz);
  return (Math.atan(gradMag) * 180) / Math.PI;
}

/**
 * Computes Odyssey GRS / CRISM water-ice & hydrated clay weight percentage at (x, z).
 */
export function waterIceAt(x: number, z: number, region: MarsRegionId = 'jezero'): number {
  const distNeretva = Math.hypot(x - 26, z - 28);
  const distBrightAngel = Math.hypot(x + 30, z - 22);
  const distThreeForks = Math.hypot(x + 24, z + 16);

  const neretvaPeak = (region === 'marineris' ? 9.0 : 7.8) * Math.exp(-(distNeretva * distNeretva) / 210);
  const brightPeak = 5.4 * Math.exp(-(distBrightAngel * distBrightAngel) / 220);
  const forksPeak = 3.2 * Math.exp(-(distThreeForks * distThreeForks) / 240);
  const background = 1.8 + 0.5 * Math.sin(x * 0.09) * Math.cos(z * 0.09);

  return Number(Math.min(12.5, Math.max(0.8, background + neretvaPeak + brightPeak + forksPeak)).toFixed(1));
}

/**
 * Computes MSL RAD ionizing radiation dose rate in uSv/h at (x, z).
 */
export function radiationAt(
  x: number,
  z: number,
  solarStormIntensity = 0,
  region: MarsRegionId = 'jezero'
): number {
  const distHab = Math.hypot(x - HABITAT_BASE.x, z - HABITAT_BASE.z);
  const shelterWp = REGION_WAYPOINTS[region][4];
  const distShelter = Math.hypot(x - shelterWp.x, z - shelterWp.z);
  const elev = groundHeightAt(x, z, region);

  const baseFlux = region === 'marineris' ? 18 : 22;
  let flux = baseFlux + Math.max(0, elev) * 3.1 + solarStormIntensity * 68;

  if (distHab < 7.5) {
    flux *= 0.22;
  } else if (distShelter < 8.5) {
    flux *= 0.24;
  }

  return Math.round(Math.max(4, flux));
}

/**
 * Computes Perseverance MEDA local wind speed (m/s) and direction (radians) at (x, z, timeSec).
 */
export function windAt(
  x: number,
  z: number,
  timeSec: number,
  region: MarsRegionId = 'jezero'
): { speedMs: number; angleRad: number; pressurePa: number } {
  const wave = Math.sin(x * 0.06 + timeSec * 0.35) + Math.cos(z * 0.05 - timeSec * 0.25);
  const speedMs = Number(
    (6.5 + Math.abs(wave) * 4.2 + Math.max(0, groundHeightAt(x, z, region)) * 0.6).toFixed(1)
  );
  const angleRad = -0.65 + 0.25 * Math.sin((x + z) * 0.04 + timeSec * 0.2);
  const pressurePa = Number(((region === 'marineris' ? 865 : 742) - speedMs * 0.85).toFixed(1));
  return { speedMs, angleRad, pressurePa };
}

export interface RoutePoint {
  x: number;
  z: number;
  label?: string;
}

export interface RouteTelemetrySummary {
  totalDistanceMeters: number;
  elevationGainMeters: number;
  maxSlopeDeg: number;
  avgSlopeDeg: number;
  estimatedO2Percent: number;
  estimatedBatteryPercent: number;
  estimatedRadiationUSv: number;
  waterDiscoveryPotential: number;
  safetyRating: 'NOMINAL' | 'CAUTION' | 'CRITICAL';
  warnings: string[];
}

/**
 * Pure calculation of traverse route telemetry across multiple NASA mission layers.
 */
export function calculateRouteTelemetry(
  waypoints: RoutePoint[],
  solarStormIntensity = 0,
  region: MarsRegionId = 'jezero'
): RouteTelemetrySummary {
  if (waypoints.length < 2) {
    return {
      totalDistanceMeters: 0,
      elevationGainMeters: 0,
      maxSlopeDeg: 0,
      avgSlopeDeg: 0,
      estimatedO2Percent: 0,
      estimatedBatteryPercent: 0,
      estimatedRadiationUSv: 0,
      waterDiscoveryPotential: 0,
      safetyRating: 'NOMINAL',
      warnings: []
    };
  }

  let totalDist = 0;
  let elevGain = 0;
  let maxSlope = 0;
  let slopeSum = 0;
  let slopeSamples = 0;
  let o2Cost = 0;
  let batteryCost = 0;
  let totalRadUSv = 0;
  let maxWater = 0;

  const sampleStepMeters = 1.5;

  for (let i = 0; i < waypoints.length - 1; i++) {
    const a = waypoints[i];
    const b = waypoints[i + 1];
    const segDist = Math.hypot(b.x - a.x, b.z - a.z);
    if (segDist < 0.01) continue;

    totalDist += segDist;
    const steps = Math.max(1, Math.ceil(segDist / sampleStepMeters));
    let prevH = groundHeightAt(a.x, a.z, region);

    for (let s = 1; s <= steps; s++) {
      const t = s / steps;
      const sx = a.x + (b.x - a.x) * t;
      const sz = a.z + (b.z - a.z) * t;
      const h = groundHeightAt(sx, sz, region);
      const stepLen = segDist / steps;

      if (h > prevH) {
        elevGain += h - prevH;
      }
      prevH = h;

      const slope = groundSlopeAt(sx, sz, region);
      if (slope > maxSlope) maxSlope = slope;
      slopeSum += slope;
      slopeSamples++;

      // Metabolic O2 & Rover battery drain spikes sharply on steep >15° grades
      const slopePenalty =
        slope > 20 ? 2.6 : slope > 15 ? 1.85 : slope > 10 ? 1.3 : 1.0;
      o2Cost += stepLen * 0.25 * slopePenalty;
      batteryCost += stepLen * 0.22 * slopePenalty;

      const radRate = radiationAt(sx, sz, solarStormIntensity, region);
      const hoursInStep = stepLen / 120;
      totalRadUSv += radRate * hoursInStep;

      const w = waterIceAt(sx, sz, region);
      if (w > maxWater) maxWater = w;
    }
  }

  const avgSlope = slopeSamples > 0 ? slopeSum / slopeSamples : 0;
  const warnings: string[] = [];
  if (maxSlope > 16) {
    warnings.push(
      `MOLA Slope Hazard: Peak grade ${maxSlope.toFixed(1)}° exceeds 16° safe rover/boot traction limit.`
    );
  }
  if (o2Cost > 60) {
    warnings.push(
      `PLSS Life Support Alert: Route consumes ${Math.round(o2Cost)}% O2 reserve. Use A* Slope-Avoiding Path.`
    );
  }
  if (totalRadUSv > 45 || solarStormIntensity > 0.4) {
    warnings.push(
      `MSL RAD Dosimetry Alert: Elevated SEP radiation exposure (${Math.round(totalRadUSv)} uSv).`
    );
  }

  let safetyRating: 'NOMINAL' | 'CAUTION' | 'CRITICAL' = 'NOMINAL';
  if (maxSlope > 20 || o2Cost > 80 || totalRadUSv > 75) {
    safetyRating = 'CRITICAL';
  } else if (maxSlope > 15 || o2Cost > 50 || totalRadUSv > 40 || warnings.length > 0) {
    safetyRating = 'CAUTION';
  }

  return {
    totalDistanceMeters: Math.round(totalDist),
    elevationGainMeters: Number(elevGain.toFixed(1)),
    maxSlopeDeg: Number(maxSlope.toFixed(1)),
    avgSlopeDeg: Number(avgSlope.toFixed(1)),
    estimatedO2Percent: Math.min(100, Math.round(o2Cost)),
    estimatedBatteryPercent: Math.min(100, Math.round(batteryCost)),
    estimatedRadiationUSv: Math.round(totalRadUSv),
    waterDiscoveryPotential: maxWater,
    safetyRating,
    warnings
  };
}

/**
 * Real 8-directional A* Pathfinding over the Martian MOLA Digital Elevation Model.
 * Avoids steep red slopes (>14°) and high-radiation ridges to find an optimal safe EVA traverse corridor.
 */
export function computeAStarRoute(
  start: RoutePoint,
  goal: RoutePoint,
  options: {
    region?: MarsRegionId;
    solarStormIntensity?: number;
    avoidSlopes?: boolean;
  } = {}
): RoutePoint[] {
  const region = options.region ?? 'jezero';
  const solarStorm = options.solarStormIntensity ?? 0;
  const avoidSlopes = options.avoidSlopes ?? true;

  if (!avoidSlopes) {
    // Direct Euclidean path sampled into 16 segments for comparison
    const pts: RoutePoint[] = [];
    const steps = 16;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      pts.push({
        x: Number((start.x + (goal.x - start.x) * t).toFixed(2)),
        z: Number((start.z + (goal.z - start.z) * t).toFixed(2)),
        label: i === 0 ? start.label : i === steps ? goal.label : undefined
      });
    }
    return pts;
  }

  const GRID_N = 56;
  const MIN_COORD = -52;
  const MAX_COORD = 52;
  const CELL_SIZE = (MAX_COORD - MIN_COORD) / (GRID_N - 1);

  const toGrid = (wx: number, wz: number) => {
    const gx = Math.max(0, Math.min(GRID_N - 1, Math.round((wx - MIN_COORD) / CELL_SIZE)));
    const gz = Math.max(0, Math.min(GRID_N - 1, Math.round((wz - MIN_COORD) / CELL_SIZE)));
    return { gx, gz };
  };

  const toWorld = (gx: number, gz: number) => ({
    x: MIN_COORD + gx * CELL_SIZE,
    z: MIN_COORD + gz * CELL_SIZE
  });

  const sNode = toGrid(start.x, start.z);
  const gNode = toGrid(goal.x, goal.z);

  if (sNode.gx === gNode.gx && sNode.gz === gNode.gz) {
    return [start, goal];
  }

  const totalCells = GRID_N * GRID_N;
  const gScore = new Float64Array(totalCells).fill(Infinity);
  const fScore = new Float64Array(totalCells).fill(Infinity);
  const cameFrom = new Int32Array(totalCells).fill(-1);
  const closed = new Uint8Array(totalCells);

  const idxOf = (gx: number, gz: number) => gz * GRID_N + gx;
  const startIdx = idxOf(sNode.gx, sNode.gz);
  const goalIdx = idxOf(gNode.gx, gNode.gz);

  gScore[startIdx] = 0;
  fScore[startIdx] = Math.hypot(gNode.gx - sNode.gx, gNode.gz - sNode.gz) * CELL_SIZE;

  const openList: number[] = [startIdx];

  const dirs = [
    [-1, 0, 1],
    [1, 0, 1],
    [0, -1, 1],
    [0, 1, 1],
    [-1, -1, Math.SQRT2],
    [1, -1, Math.SQRT2],
    [-1, 1, Math.SQRT2],
    [1, 1, Math.SQRT2]
  ];

  while (openList.length > 0) {
    // Find node in openList with lowest fScore
    let bestPos = 0;
    let currentIdx = openList[0];
    let bestF = fScore[currentIdx];
    for (let i = 1; i < openList.length; i++) {
      const cand = openList[i];
      if (fScore[cand] < bestF) {
        bestF = fScore[cand];
        currentIdx = cand;
        bestPos = i;
      }
    }

    if (currentIdx === goalIdx) {
      break;
    }

    openList.splice(bestPos, 1);
    closed[currentIdx] = 1;

    const cx = currentIdx % GRID_N;
    const cz = Math.floor(currentIdx / GRID_N);
    const cWorld = toWorld(cx, cz);
    const cHeight = groundHeightAt(cWorld.x, cWorld.z, region);

    for (let d = 0; d < dirs.length; d++) {
      const nx = cx + dirs[d][0];
      const nz = cz + dirs[d][1];
      if (nx < 0 || nx >= GRID_N || nz < 0 || nz >= GRID_N) continue;

      const nIdx = idxOf(nx, nz);
      if (closed[nIdx]) continue;

      const nWorld = toWorld(nx, nz);
      const nHeight = groundHeightAt(nWorld.x, nWorld.z, region);
      const stepHoriz = dirs[d][2] * CELL_SIZE;
      const dh = Math.abs(nHeight - cHeight);
      const segSlopeDeg = (Math.atan(dh / stepHoriz) * 180) / Math.PI;
      const pointSlopeDeg = groundSlopeAt(nWorld.x, nWorld.z, region);
      const effectiveSlope = Math.max(segSlopeDeg, pointSlopeDeg);

      // Strong non-linear penalty for steep >12° slopes so A* detours around red hazard hills
      let slopeWeight = 1.0 + (effectiveSlope / 11.0) ** 2.4;
      if (effectiveSlope > 15) {
        slopeWeight += ((effectiveSlope - 14) ** 2.8) * 3.5;
      }

      const rad = radiationAt(nWorld.x, nWorld.z, solarStorm, region);
      const radWeight = rad > 35 ? (rad - 30) * 0.08 : 0;

      const tentativeG = gScore[currentIdx] + stepHoriz * (slopeWeight + radWeight);

      if (tentativeG < gScore[nIdx]) {
        cameFrom[nIdx] = currentIdx;
        gScore[nIdx] = tentativeG;
        const hDist = Math.hypot(gNode.gx - nx, gNode.gz - nz) * CELL_SIZE;
        fScore[nIdx] = tentativeG + hDist;
        if (!openList.includes(nIdx)) {
          openList.push(nIdx);
        }
      }
    }
  }

  // Reconstruct raw path
  const rawPoints: RoutePoint[] = [];
  let cur = goalIdx;
  if (cameFrom[cur] === -1 && cur !== startIdx) {
    return [start, goal];
  }
  while (cur !== -1) {
    const gx = cur % GRID_N;
    const gz = Math.floor(cur / GRID_N);
    const w = toWorld(gx, gz);
    rawPoints.push({ x: w.x, z: w.z });
    if (cur === startIdx) break;
    cur = cameFrom[cur];
  }
  rawPoints.reverse();
  rawPoints[0] = { ...start };
  rawPoints[rawPoints.length - 1] = { ...goal };

  // Chaikin corner-cutting smoothing (2 passes) for natural organic rover/EVA trajectory
  let smoothed = rawPoints;
  for (let pass = 0; pass < 2; pass++) {
    if (smoothed.length < 3) break;
    const nextPts: RoutePoint[] = [smoothed[0]];
    for (let i = 0; i < smoothed.length - 1; i++) {
      const p0 = smoothed[i];
      const p1 = smoothed[i + 1];
      nextPts.push({
        x: Number((0.75 * p0.x + 0.25 * p1.x).toFixed(2)),
        z: Number((0.75 * p0.z + 0.25 * p1.z).toFixed(2))
      });
      nextPts.push({
        x: Number((0.25 * p0.x + 0.75 * p1.x).toFixed(2)),
        z: Number((0.25 * p0.z + 0.75 * p1.z).toFixed(2))
      });
    }
    nextPts.push(smoothed[smoothed.length - 1]);
    smoothed = nextPts;
  }

  return smoothed;
}

export interface HazardEntity {
  id: string;
  archetype: 'dust_devil' | 'solar_flare_zone' | 'slope_debris';
  x: number;
  z: number;
  vx: number;
  vz: number;
  radius: number;
  phase: 'patrol' | 'windup' | 'active' | 'recovery';
  phaseTimer: number;
  targetX: number;
  targetZ: number;
}

/**
 * Updates the 3 distinct Martian hazard archetypes with readable windup telegraphs.
 */
export function stepHazardBehavior(
  hazard: HazardEntity,
  playerX: number,
  playerZ: number,
  dt: number,
  canStartWindup: boolean
): HazardEntity {
  const next: HazardEntity = { ...hazard };
  const distToPlayer = Math.hypot(playerX - next.x, playerZ - next.z);

  if (next.archetype === 'dust_devil') {
    if (next.phase === 'patrol') {
      const dirX = playerX - next.x;
      const dirZ = playerZ - next.z;
      const len = Math.hypot(dirX, dirZ) || 1;
      const speed = 2.8;
      next.vx = (dirX / len) * speed;
      next.vz = (dirZ / len) * speed;
      next.x += next.vx * dt;
      next.z += next.vz * dt;

      if (distToPlayer < 13 && canStartWindup) {
        next.phase = 'windup';
        next.phaseTimer = 0.65;
        next.targetX = playerX;
        next.targetZ = playerZ;
      }
    } else if (next.phase === 'windup') {
      next.phaseTimer -= dt;
      if (next.phaseTimer <= 0) {
        next.phase = 'active';
        next.phaseTimer = 0.9;
        const dx = next.targetX - next.x;
        const dz = next.targetZ - next.z;
        const l = Math.hypot(dx, dz) || 1;
        next.vx = (dx / l) * 9.2;
        next.vz = (dz / l) * 9.2;
      }
    } else if (next.phase === 'active') {
      next.x += next.vx * dt;
      next.z += next.vz * dt;
      next.phaseTimer -= dt;
      if (next.phaseTimer <= 0) {
        next.phase = 'recovery';
        next.phaseTimer = 1.1;
      }
    } else {
      next.phaseTimer -= dt;
      if (next.phaseTimer <= 0) {
        next.phase = 'patrol';
      }
    }
  } else if (next.archetype === 'solar_flare_zone') {
    if (next.phase === 'patrol') {
      const angle = Math.atan2(next.z, next.x) + dt * 0.22;
      const r = Math.max(16, Math.min(42, Math.hypot(next.x, next.z)));
      next.x = Math.cos(angle) * r;
      next.z = Math.sin(angle) * r;
      next.phaseTimer -= dt;
      if ((distToPlayer < 15 || next.phaseTimer <= 0) && canStartWindup) {
        next.phase = 'windup';
        next.phaseTimer = 0.75;
      }
    } else if (next.phase === 'windup') {
      next.phaseTimer -= dt;
      if (next.phaseTimer <= 0) {
        next.phase = 'active';
        next.phaseTimer = 0.55;
      }
    } else if (next.phase === 'active') {
      next.phaseTimer -= dt;
      if (next.phaseTimer <= 0) {
        next.phase = 'recovery';
        next.phaseTimer = 2.4;
      }
    } else {
      next.phaseTimer -= dt;
      if (next.phaseTimer <= 0) {
        next.phase = 'patrol';
        next.phaseTimer = 4.0;
      }
    }
  } else if (next.archetype === 'slope_debris') {
    if (next.phase === 'patrol') {
      next.x += next.vx * dt;
      next.z += next.vz * dt;
      if (Math.hypot(next.x, next.z) > WORLD_PLAYABLE_RADIUS - 6) {
        next.vx *= -1;
        next.vz *= -1;
      }
      if (distToPlayer < 14 && canStartWindup) {
        next.phase = 'windup';
        next.phaseTimer = 0.55;
        next.targetX = playerX;
        next.targetZ = playerZ;
      }
    } else if (next.phase === 'windup') {
      next.phaseTimer -= dt;
      if (next.phaseTimer <= 0) {
        next.phase = 'active';
        next.phaseTimer = 0.75;
        const dx = next.targetX - next.x;
        const dz = next.targetZ - next.z;
        const l = Math.hypot(dx, dz) || 1;
        next.vx = (dx / l) * 10.5;
        next.vz = (dz / l) * 10.5;
      }
    } else if (next.phase === 'active') {
      next.x += next.vx * dt;
      next.z += next.vz * dt;
      next.phaseTimer -= dt;
      if (next.phaseTimer <= 0) {
        next.phase = 'recovery';
        next.phaseTimer = 1.3;
      }
    } else {
      next.phaseTimer -= dt;
      if (next.phaseTimer <= 0) {
        next.phase = 'patrol';
      }
    }
  }

  const d = Math.hypot(next.x, next.z);
  if (d > WORLD_PLAYABLE_RADIUS - 4) {
    const scale = (WORLD_PLAYABLE_RADIUS - 4) / d;
    next.x *= scale;
    next.z *= scale;
  }
  const dHab = Math.hypot(next.x - HABITAT_BASE.x, next.z - HABITAT_BASE.z);
  if (dHab < HABITAT_BASE.radius + 3.5) {
    const dx = next.x - HABITAT_BASE.x;
    const dz = next.z - HABITAT_BASE.z;
    const push = (HABITAT_BASE.radius + 3.5) / (dHab || 1);
    next.x = HABITAT_BASE.x + dx * push;
    next.z = HABITAT_BASE.z + dz * push;
  }

  return next;
}
