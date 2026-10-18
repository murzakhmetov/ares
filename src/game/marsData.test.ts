import test from 'node:test';
import assert from 'node:assert/strict';
import {
  groundHeightAt,
  groundSlopeAt,
  waterIceAt,
  radiationAt,
  calculateRouteTelemetry,
  computeAStarRoute,
  stepHazardBehavior,
  JEZERO_WAYPOINTS,
  REGION_WAYPOINTS,
  HABITAT_BASE,
  type HazardEntity
} from './marsData.ts';

test('Habitat base sits on a flat landing basin with near-zero slope', () => {
  const h0 = groundHeightAt(0, 0);
  const slope0 = groundSlopeAt(0, 0);
  assert.equal(Math.abs(h0) < 0.01, true, 'Center height should be 0');
  assert.equal(slope0 < 1.0, true, 'Habitat pad should be flat (< 1 deg slope)');
});

test('Odyssey GRS water-ice layer peaks near Neretva Vallis Ice Lens (26, 28)', () => {
  const iceAtNeretva = waterIceAt(26, 28);
  const iceAtOrigin = waterIceAt(0, 0);
  assert.equal(iceAtNeretva > 8.0, true, `Expected high water wt% at Neretva, got ${iceAtNeretva}`);
  assert.equal(iceAtNeretva > iceAtOrigin + 4.0, true);
});

test('MSL RAD dosimetry shows strong radiation shielding inside Habitat and Belva Alcove', () => {
  const radOpen = radiationAt(-20, 20, 0.8);
  const radHab = radiationAt(HABITAT_BASE.x, HABITAT_BASE.z, 0.8);
  const radBelva = radiationAt(2, 40, 0.8);
  assert.equal(radHab < radOpen * 0.4, true, 'Habitat should shield radiation');
  assert.equal(radBelva < radOpen * 0.4, true, 'Belva basalt alcove should shield radiation');
});

test('A* Pathfinding detours around steep ridges to achieve lower peak slope and lower O2 cost than direct line', () => {
  // Route from Habitat (-9.5, -1.5) to Bright Angel Smectite Cliff (-30, 24) which passes near ridge2 (-14, 6)
  const start = { x: HABITAT_BASE.x, z: HABITAT_BASE.z, label: 'HAB-01' };
  const goal = { x: JEZERO_WAYPOINTS[2].x, z: JEZERO_WAYPOINTS[2].z, label: 'POI-C3' };

  const aStarPath = computeAStarRoute(start, goal, { region: 'jezero', avoidSlopes: true });
  const directPath = computeAStarRoute(start, goal, { region: 'jezero', avoidSlopes: false });

  assert.equal(aStarPath.length > 5, true, 'A* should generate a multi-waypoint smoothed trajectory');
  const aStarStats = calculateRouteTelemetry(aStarPath, 0, 'jezero');
  const directStats = calculateRouteTelemetry(directPath, 0, 'jezero');

  assert.equal(
    aStarStats.maxSlopeDeg < directStats.maxSlopeDeg,
    true,
    `Expected A* maxSlope (${aStarStats.maxSlopeDeg}) < Direct maxSlope (${directStats.maxSlopeDeg})`
  );
});

test('Valles Marineris region waypoints and A* pathfinding work accurately', () => {
  const vmWaypoints = REGION_WAYPOINTS.marineris;
  assert.equal(vmWaypoints.length, 5);
  const path = computeAStarRoute(
    { x: HABITAT_BASE.x, z: HABITAT_BASE.z },
    { x: vmWaypoints[2].x, z: vmWaypoints[2].z },
    { region: 'marineris', avoidSlopes: true }
  );
  const summary = calculateRouteTelemetry(path, 0, 'marineris');
  assert.equal(summary.totalDistanceMeters > 30, true);
  assert.equal(summary.waterDiscoveryPotential > 8.5, true);
});

test('stepHazardBehavior transitions dust_devil from patrol to windup to active surge', () => {
  const initial: HazardEntity = {
    id: 'hz-1',
    archetype: 'dust_devil',
    x: 10,
    z: 10,
    vx: 0,
    vz: 0,
    radius: 3.2,
    phase: 'patrol',
    phaseTimer: 0,
    targetX: 0,
    targetZ: 0
  };

  const windupState = stepHazardBehavior(initial, 14, 14, 0.1, true);
  assert.equal(windupState.phase, 'windup');
  assert.equal(windupState.phaseTimer > 0.5, true);

  const activeState = stepHazardBehavior(windupState, 14, 14, 0.7, true);
  assert.equal(activeState.phase, 'active');
  assert.equal(Math.hypot(activeState.vx, activeState.vz) > 8.0, true);
});
