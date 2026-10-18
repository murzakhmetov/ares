import * as THREE from 'three';
import {
  groundHeightAt,
  groundSlopeAt,
  waterIceAt,
  radiationAt,
  windAt,
  type MarsRegionId,
  type NasaLayerId,
  type ScienceWaypoint,
  type RoutePoint
} from './marsData';

/**
 * Generates a high-frequency tileable micro-relief bump/roughness CanvasTexture for Martian bedrock & aeolian ripples.
 */
export function createRegolithBumpTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, 512, 512);

  let seed = 1337;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  // Fine rock fractures and micro-craters
  for (let i = 0; i < 2200; i++) {
    const x = rand() * 512;
    const y = rand() * 512;
    const r = 0.8 + rand() * 3.5;
    const shade = Math.floor(90 + (rand() - 0.5) * 110);
    ctx.fillStyle = `rgb(${shade},${shade},${shade})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Sharp wind-carved yardang & aeolian sand ripples
  ctx.strokeStyle = 'rgba(225, 225, 225, 0.22)';
  ctx.lineWidth = 1.2;
  for (let y = 0; y < 512; y += 6) {
    ctx.beginPath();
    for (let x = 0; x <= 512; x += 16) {
      const wy = y + Math.sin(x * 0.06 + y * 0.025) * 2.2;
      if (x === 0) ctx.moveTo(x, wy);
      else ctx.lineTo(x, wy);
    }
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(22, 22);
  tex.anisotropy = maxAnisotropy;
  return tex;
}

/**
 * Generates a crisp tileable topographic grid & contour overlay texture so the 3D DEM never looks blurry.
 */
export function createCrispGridTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 512, 512);

  // Subtle fine sub-grid
  ctx.strokeStyle = 'rgba(200, 210, 225, 0.88)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 512; i += 64) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, 512);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(512, i);
    ctx.stroke();
  }

  // Primary meter grid lines
  ctx.strokeStyle = 'rgba(155, 170, 190, 0.78)';
  ctx.lineWidth = 2;
  ctx.strokeRect(0, 0, 512, 512);

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(28, 28);
  tex.anisotropy = maxAnisotropy;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Updates the 3D terrain BufferGeometry heights, normals, and smooth per-vertex scientific colors
 * for the selected Martian region (Jezero Crater or Valles Marineris) and NASA Data Layer.
 */
export function updateTerrainMeshData(
  terrainGeo: THREE.BufferGeometry,
  region: MarsRegionId,
  layer: NasaLayerId,
  solarStormIntensity: number
): void {
  const posAttr = terrainGeo.attributes.position;
  let colorAttr = terrainGeo.getAttribute('color') as THREE.BufferAttribute | undefined;
  if (!colorAttr) {
    const colors = new Float32Array(posAttr.count * 3);
    colorAttr = new THREE.BufferAttribute(colors, 3);
    terrainGeo.setAttribute('color', colorAttr);
  }

  const c = new THREE.Color();
  const cSafeDeep = new THREE.Color(0x047857); // Deep emerald flat basin (0-4 deg)
  const cSafeGreen = new THREE.Color(0x10b981); // Safe rover corridor (4-8 deg)
  const cYellow = new THREE.Color(0xeab308); // Moderate grade (8-13 deg)
  const cOrange = new THREE.Color(0xf97316); // Steep grade (13-16.5 deg)
  const cRed = new THREE.Color(0xdc2626); // Critical cliff hazard (>16.5 deg)
  const cCliffDark = new THREE.Color(0x7f1d1d); // Extreme vertical scarp (>22 deg)

  const cRustLow = new THREE.Color(region === 'marineris' ? 0x6b2d1a : 0x7c341c);
  const cRustMid = new THREE.Color(region === 'marineris' ? 0x9a4224 : 0xb4532a);
  const cRustHigh = new THREE.Color(0xd97742);
  const cBasalt = new THREE.Color(0x27201d);
  const cIceDeep = new THREE.Color(0x0284c7);
  const cIceBright = new THREE.Color(0x22d3ee);
  const cShielded = new THREE.Color(0x059669);
  const cWindPurple = new THREE.Color(0x9333ea);
  const cBase = new THREE.Color();

  for (let i = 0; i < posAttr.count; i++) {
    const wx = posAttr.getX(i);
    const wz = posAttr.getZ(i);
    const h = groundHeightAt(wx, wz, region);
    posAttr.setY(i, h);

    const slope = groundSlopeAt(wx, wz, region);

    // Stratified Martian bedrock base color
    const strataWave = Math.sin(h * 3.2 + wx * 0.07 + wz * 0.05) * 0.5 + 0.5;
    const elevNorm = Math.min(1, Math.max(0, (h + 4) / 14));
    cBase.lerpColors(cRustLow, cRustMid, elevNorm);
    cBase.lerp(cRustHigh, strataWave * 0.28);

    // Darken steep exposed basaltic scarps
    if (slope > 12) {
      const rockMix = Math.min(1, (slope - 12) / 14);
      cBase.lerp(cBasalt, rockMix * 0.68);
    }

    // Topographic MOLA contour ring every 1.6m of elevation
    const contourPhase = Math.abs(((h * 0.625) % 1 + 1) % 1 - 0.5);
    const isContourLine = contourPhase < 0.032;

    if (layer === 'natural') {
      c.copy(cBase);
      if (isContourLine) {
        c.lerp(new THREE.Color(0xfbbf24), 0.32);
      }
    } else if (layer === 'mola') {
      // NASA MOLA + HiRISE Traversability Slope Gradient (Green -> Amber -> Red)
      if (slope <= 4.5) {
        c.lerpColors(cSafeDeep, cSafeGreen, slope / 4.5);
      } else if (slope <= 9.0) {
        c.lerpColors(cSafeGreen, cYellow, (slope - 4.5) / 4.5);
      } else if (slope <= 14.5) {
        c.lerpColors(cYellow, cOrange, (slope - 9.0) / 5.5);
      } else if (slope <= 19.5) {
        c.lerpColors(cOrange, cRed, (slope - 14.5) / 5.0);
      } else {
        c.lerpColors(cRed, cCliffDark, Math.min(1, (slope - 19.5) / 8.0));
      }
      // Blend 20% natural geological stratigraphy so rock relief remains tactile
      c.lerp(cBase, 0.2);
      if (isContourLine) {
        c.multiplyScalar(1.28);
      }
    } else if (layer === 'rad') {
      // MSL RAD + MAVEN Solar Radiation & Dust Storm Exposure
      const rad = radiationAt(wx, wz, solarStormIntensity, region);
      if (rad < 15.5) {
        c.copy(cShielded).lerp(cBase, 0.22);
      } else {
        const t = Math.min(1, Math.max(0, (rad - 15.5) / 30));
        if (t < 0.5) {
          c.lerpColors(cYellow, cOrange, t * 2);
        } else {
          c.lerpColors(cOrange, cRed, (t - 0.5) * 2);
        }
        c.lerp(cBase, 0.22);
      }
      if (isContourLine) c.multiplyScalar(1.22);
    } else if (layer === 'odyssey') {
      // Odyssey GRS + MRO SHARAD Subsurface Water-Ice & Hydrated Clays
      const h2o = waterIceAt(wx, wz, region);
      const norm = Math.min(1, Math.max(0, (h2o - 2.2) / 6.8));
      c.copy(cBase).multiplyScalar(0.62);
      if (norm > 0.04) {
        c.lerp(norm > 0.6 ? cIceBright : cIceDeep, Math.min(1, norm * 0.92));
      }
      if (isContourLine) c.multiplyScalar(1.24);
    } else {
      // MEDA Surface Wind Shear & Convective Vortices
      const wind = windAt(wx, wz, 0, region);
      const wNorm = Math.min(1, Math.max(0, (wind.speedMs - 5.5) / 8.5));
      c.copy(cBase).multiplyScalar(0.75);
      c.lerp(cWindPurple, wNorm * 0.82);
      if (isContourLine) c.multiplyScalar(1.22);
    }

    colorAttr.setXYZ(i, c.r, c.g, c.b);
  }

  posAttr.needsUpdate = true;
  colorAttr.needsUpdate = true;
  terrainGeo.computeVertexNormals();
}

/**
 * Builds the 3D Interactive Mars Orbital Globe with high-resolution procedural Viking/MOLA global map,
 * dedicated topographic bump map (75+ craters, Valles Marineris canyon system, Olympus Mons & Tharsis shields,
 * Syrtis Major dark basalt plains, Hellas basin, polar ice caps), Rayleigh atmosphere shader, and landing pins.
 */
export function createMarsOrbitalGlobe(maxAnisotropy: number): {
  rootGroup: THREE.Group;
  globeMesh: THREE.Mesh;
  cloudsMesh: THREE.Mesh;
  satellitesGroup: THREE.Group;
  jezeroPin: THREE.Group;
  marinerisPin: THREE.Group;
} {
  const rootGroup = new THREE.Group();

  const W = 1024;
  const H = 512;
  const colorCanvas = document.createElement('canvas');
  colorCanvas.width = W;
  colorCanvas.height = H;
  const ctx = colorCanvas.getContext('2d')!;

  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = W;
  bumpCanvas.height = H;
  const bCtx = bumpCanvas.getContext('2d')!;

  const img = ctx.createImageData(W, H);
  const d = img.data;
  const bImg = bCtx.createImageData(W, H);
  const bd = bImg.data;

  // Deterministic list of 75 major Martian impact craters + basins
  let cSeed = 4099;
  const cRand = () => {
    cSeed = (cSeed * 16807) % 2147483647;
    return (cSeed - 1) / 2147483646;
  };
  interface CraterSpec {
    lon: number;
    lat: number;
    rad: number;
    depth: number;
  }
  const craters: CraterSpec[] = [
    // Hellas Planitia giant basin
    { lon: 1.22, lat: -0.74, rad: 0.36, depth: 1.0 },
    // Argyre Planitia basin
    { lon: -0.76, lat: -0.86, rad: 0.22, depth: 0.85 },
    // Isidis Planitia (adjacent to Jezero Crater)
    { lon: 1.52, lat: 0.22, rad: 0.19, depth: 0.75 },
    // Huygens, Schiaparelli, Cassini, Gale
    { lon: 0.98, lat: -0.24, rad: 0.11, depth: 0.7 },
    { lon: 0.29, lat: -0.05, rad: 0.10, depth: 0.65 },
    { lon: 0.56, lat: 0.41, rad: 0.09, depth: 0.65 },
    { lon: 2.40, lat: -0.09, rad: 0.08, depth: 0.6 }
  ];
  for (let i = 0; i < 68; i++) {
    craters.push({
      lon: (cRand() - 0.5) * Math.PI * 2,
      lat: (cRand() - 0.5) * 2.5,
      rad: 0.028 + cRand() * 0.075,
      depth: 0.35 + cRand() * 0.55
    });
  }

  for (let py = 0; py < H; py++) {
    const v = py / H;
    const lat = (0.5 - v) * Math.PI;
    const cosLat = Math.max(0.15, Math.cos(lat));

    for (let px = 0; px < W; px++) {
      const u = px / W;
      const lon = (u - 0.5) * Math.PI * 2;

      // Domain-warped 6-octave planetary fBm (smooth continuous geology, zero blocky step thresholds)
      const warpLon = lon + 0.18 * Math.sin(lat * 3.0 + lon * 2.0);
      const warpLat = lat + 0.14 * Math.cos(lon * 3.0 - lat * 2.0);

      const f1 = Math.sin(warpLon * 2.0 + 0.4) * Math.cos(warpLat * 2.0);
      const f2 = Math.sin(warpLon * 4.0 - warpLat * 3.0 + 1.1) * 0.52;
      const f3 = Math.cos(warpLon * 8.0 + warpLat * 6.0 - 0.7) * 0.28;
      const f4 = Math.sin(warpLon * 16.0 - warpLat * 13.0 + 2.3) * 0.15;
      const f5 = Math.cos(warpLon * 32.0 + warpLat * 27.0) * 0.08;
      const f6 = Math.sin(warpLon * 64.0 - warpLat * 54.0) * 0.04;
      const fbm = f1 + f2 + f3 + f4 + f5 + f6;

      // Smooth S-curve albedo blend between dark basaltic maria (Syrtis Major / Acidalia) and bright ferric plains
      const syrtisPeak = Math.exp(-((lon - 1.18) ** 2 / 0.18 + (lat - 0.16) ** 2 / 0.14));
      const acidaliaPeak = Math.exp(-((lon + 0.45) ** 2 / 0.25 + (lat - 0.72) ** 2 / 0.16));
      const mareWeight = Math.min(
        1,
        Math.max(0, (0.35 - fbm * 0.38) * 0.65 + syrtisPeak * 0.75 + acidaliaPeak * 0.65)
      );

      // Rich Martian ochre/terracotta vs dark iron-bearing basalt
      let r = 206 - mareWeight * 104 + fbm * 22;
      let g = 98 - mareWeight * 56 + fbm * 13;
      let b = 54 - mareWeight * 32 + fbm * 8;
      let heightVal = 128 + fbm * 34 - mareWeight * 22;

      // Valles Marineris giant equatorial canyon network (around lon = -1.24 rad, lat = -0.11 rad)
      const vmLonDist = Math.abs(lon + 1.24);
      const vmSpineLat = -0.11 + Math.sin(lon * 3.6) * 0.038 + Math.cos(lon * 9.0) * 0.012;
      const vmLatDist = Math.abs(lat - vmSpineLat);
      const vmWidth = 0.052 * Math.max(0, 1 - (vmLonDist / 0.48) ** 2);
      if (vmLonDist < 0.48 && vmLatDist < vmWidth) {
        const canyonProfile = 1 - vmLatDist / vmWidth;
        const steepWall = Math.pow(canyonProfile, 0.55);
        r = r * (1 - steepWall * 0.72) + 38 * steepWall;
        g = g * (1 - steepWall * 0.72) + 16 * steepWall;
        b = b * (1 - steepWall * 0.72) + 12 * steepWall;
        heightVal -= steepWall * 78;
      }

      // Olympus Mons & Tharsis Montes volcanic shield edifices
      const shields = [
        { lon: -2.33, lat: 0.32, rad: 0.19, h: 75 }, // Olympus Mons
        { lon: -1.82, lat: 0.19, rad: 0.12, h: 52 }, // Ascraeus Mons
        { lon: -1.97, lat: 0.01, rad: 0.12, h: 48 }, // Pavonis Mons
        { lon: -2.11, lat: -0.15, rad: 0.13, h: 50 } // Arsia Mons
      ];
      for (let s = 0; s < shields.length; s++) {
        const sh = shields[s];
        const dist = Math.hypot((lon - sh.lon) * cosLat, lat - sh.lat);
        if (dist < sh.rad) {
          const uDist = dist / sh.rad;
          // Raised volcanic cone + sunken summit caldera ring
          const cone = uDist < 0.22 ? 0.62 + uDist * 1.1 : Math.cos(uDist * Math.PI * 0.5);
          r += cone * 38;
          g += cone * 22;
          b += cone * 14;
          heightVal += cone * sh.h;
        }
      }

      // Stamp multi-scale impact craters (raised bright rim + depressed dark floor)
      for (let cIdx = 0; cIdx < craters.length; cIdx++) {
        const cr = craters[cIdx];
        let dLon = Math.abs(lon - cr.lon);
        if (dLon > Math.PI) dLon = Math.PI * 2 - dLon;
        const dist = Math.hypot(dLon * cosLat, lat - cr.lat);
        if (dist < cr.rad) {
          const q = dist / cr.rad;
          if (q > 0.76) {
            // Raised crater rim wall
            const rim = Math.sin(((q - 0.76) / 0.24) * Math.PI) * cr.depth;
            r += rim * 36;
            g += rim * 22;
            b += rim * 14;
            heightVal += rim * 42;
          } else {
            // Depressed crater bowl
            const bowl = Math.cos((q / 0.76) * Math.PI * 0.5) * cr.depth;
            r -= bowl * 32;
            g -= bowl * 18;
            b -= bowl * 10;
            heightVal -= bowl * 46;
          }
        }
      }

      // North & South Polar Water-Ice Caps with spiral troughs
      const absLat = Math.abs(lat);
      const polarThreshold = 1.29 + Math.sin(lon * 6 + lat * 18) * 0.045;
      if (absLat > polarThreshold) {
        const iceMix = Math.min(1, (absLat - polarThreshold) / 0.14);
        const spiralTrough = Math.sin(lon * 5 + absLat * 28) > 0.65 ? 0.75 : 1.0;
        r = r * (1 - iceMix) + 244 * spiralTrough * iceMix;
        g = g * (1 - iceMix) + 248 * spiralTrough * iceMix;
        b = b * (1 - iceMix) + 255 * spiralTrough * iceMix;
        heightVal += iceMix * 35 * spiralTrough;
      }

      const idx = (py * W + px) * 4;
      d[idx] = Math.min(255, Math.max(0, Math.round(r)));
      d[idx + 1] = Math.min(255, Math.max(0, Math.round(g)));
      d[idx + 2] = Math.min(255, Math.max(0, Math.round(b)));
      d[idx + 3] = 255;

      const hClamped = Math.min(255, Math.max(0, Math.round(heightVal)));
      bd[idx] = hClamped;
      bd[idx + 1] = hClamped;
      bd[idx + 2] = hClamped;
      bd[idx + 3] = 255;
    }
  }

  ctx.putImageData(img, 0, 0);
  bCtx.putImageData(bImg, 0, 0);

  // Crisp subtle orbital GIS graticule lines on the color map
  ctx.strokeStyle = 'rgba(251, 191, 36, 0.11)';
  ctx.lineWidth = 1;
  for (let x = 0; x <= W; x += 64) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
    ctx.stroke();
  }
  for (let y = 0; y <= H; y += 64) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }

  const globeTex = new THREE.CanvasTexture(colorCanvas);
  globeTex.colorSpace = THREE.SRGBColorSpace;
  globeTex.anisotropy = maxAnisotropy;

  const globeBumpTex = new THREE.CanvasTexture(bumpCanvas);
  globeBumpTex.anisotropy = maxAnisotropy;

  const GLOBE_RADIUS = 8.6;
  const globeGeo = new THREE.SphereGeometry(GLOBE_RADIUS, 72, 54);
  const globeMat = new THREE.MeshStandardMaterial({
    map: globeTex,
    bumpMap: globeBumpTex,
    bumpScale: 0.34,
    roughness: 0.84,
    metalness: 0.06
  });
  const globeMesh = new THREE.Mesh(globeGeo, globeMat);
  rootGroup.add(globeMesh);

  // 2. Atmospheric Rayleigh / Fresnel Scattering Rim Halo Shader
  const atmoGeo = new THREE.SphereGeometry(GLOBE_RADIUS * 1.042, 48, 36);
  const atmoMat = new THREE.ShaderMaterial({
    uniforms: {
      glowColor: { value: new THREE.Color(0xea580c) },
      rimColor: { value: new THREE.Color(0x38bdf8) }
    },
    vertexShader: `
      varying vec3 vNormal;
      varying vec3 vViewPosition;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        vViewPosition = -mvPosition.xyz;
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      uniform vec3 glowColor;
      uniform vec3 rimColor;
      varying vec3 vNormal;
      varying vec3 vViewPosition;
      void main() {
        vec3 viewDir = normalize(vViewPosition);
        float fresnel = pow(1.0 - abs(dot(vNormal, viewDir)), 3.0);
        vec3 col = mix(glowColor, rimColor, fresnel * 0.42);
        gl_FragColor = vec4(col, fresnel * 0.68);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    side: THREE.BackSide,
    depthWrite: false
  });
  const cloudsMesh = new THREE.Mesh(atmoGeo, atmoMat);
  rootGroup.add(cloudsMesh);

  // 3. Helper to place 3D Orbital Target Reticle Pin on Spherical Coordinates (latDeg, lonDeg)
  const createLandingPin = (latDeg: number, lonDeg: number, colorHex: number) => {
    const pinGroup = new THREE.Group();
    const phi = THREE.MathUtils.degToRad(90 - latDeg);
    const theta = THREE.MathUtils.degToRad(lonDeg + 180);

    const x = -GLOBE_RADIUS * Math.sin(phi) * Math.cos(theta);
    const y = GLOBE_RADIUS * Math.cos(phi);
    const z = GLOBE_RADIUS * Math.sin(phi) * Math.sin(theta);

    pinGroup.position.set(x, y, z);
    pinGroup.lookAt(x * 2, y * 2, z * 2);

    const outerRingGeo = new THREE.RingGeometry(0.62, 0.78, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: colorHex,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.92
    });
    const outerRing = new THREE.Mesh(outerRingGeo, ringMat);
    outerRing.position.z = 0.08;
    pinGroup.add(outerRing);

    const innerRingGeo = new THREE.RingGeometry(0.24, 0.34, 24);
    const innerRing = new THREE.Mesh(innerRingGeo, ringMat);
    innerRing.position.z = 0.1;
    pinGroup.add(innerRing);

    const spikeGeo = new THREE.CylinderGeometry(0.04, 0.04, 1.7, 8);
    spikeGeo.rotateX(Math.PI / 2);
    const spikeMat = new THREE.MeshBasicMaterial({ color: colorHex });
    const spike = new THREE.Mesh(spikeGeo, spikeMat);
    spike.position.z = 0.85;
    pinGroup.add(spike);

    const headGeo = new THREE.OctahedronGeometry(0.3, 0);
    const head = new THREE.Mesh(headGeo, spikeMat);
    head.position.z = 1.85;
    pinGroup.add(head);

    return pinGroup;
  };

  const jezeroPin = createLandingPin(18.38, 77.58, 0x10b981);
  globeMesh.add(jezeroPin);

  const marinerisPin = createLandingPin(-6.5, -70.8, 0x06b6d4);
  globeMesh.add(marinerisPin);

  // 4. Orbital Reconnaissance Satellite Rings (MRO, Odyssey, MAVEN)
  const satellitesGroup = new THREE.Group();
  const orbitConfigs = [
    { radius: 10.7, tiltX: 0.42, tiltZ: 0.18, color: 0xf59e0b },
    { radius: 11.5, tiltX: -0.55, tiltZ: 0.32, color: 0x06b6d4 },
    { radius: 12.3, tiltX: 0.15, tiltZ: -0.62, color: 0x10b981 }
  ];

  orbitConfigs.forEach((cfg) => {
    const orbitRing = new THREE.Group();
    orbitRing.rotation.x = cfg.tiltX;
    orbitRing.rotation.z = cfg.tiltZ;

    const torusGeo = new THREE.TorusGeometry(cfg.radius, 0.022, 8, 112);
    torusGeo.rotateX(Math.PI / 2);
    const torusMat = new THREE.MeshBasicMaterial({
      color: cfg.color,
      transparent: true,
      opacity: 0.32
    });
    orbitRing.add(new THREE.Mesh(torusGeo, torusMat));

    const sat = new THREE.Group();
    sat.position.set(cfg.radius, 0, 0);
    const bus = new THREE.Mesh(
      new THREE.BoxGeometry(0.34, 0.34, 0.48),
      new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.88, roughness: 0.2 })
    );
    const wings = new THREE.Mesh(
      new THREE.BoxGeometry(1.45, 0.04, 0.32),
      new THREE.MeshStandardMaterial({ color: 0x0284c7, metalness: 0.85, roughness: 0.18 })
    );
    const dish = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.05, 0.14, 12),
      new THREE.MeshStandardMaterial({ color: 0xf8fafc, metalness: 0.5, roughness: 0.3 })
    );
    dish.position.y = 0.25;
    sat.add(bus, wings, dish);
    orbitRing.add(sat);

    satellitesGroup.add(orbitRing);
  });
  rootGroup.add(satellitesGroup);

  // 5. Deep Space Starfield around the Globe
  const starCount = 520;
  const starPositions = new Float32Array(starCount * 3);
  let sSeed = 9001;
  const sRand = () => {
    sSeed = (sSeed * 16807) % 2147483647;
    return (sSeed - 1) / 2147483646;
  };
  for (let i = 0; i < starCount; i++) {
    const r = 45 + sRand() * 65;
    const theta = sRand() * Math.PI * 2;
    const phi = Math.acos(2 * sRand() - 1);
    starPositions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    starPositions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    starPositions[i * 3 + 2] = r * Math.cos(phi);
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
  const starMat = new THREE.PointsMaterial({ color: 0xe2e8f0, size: 0.24 });
  rootGroup.add(new THREE.Points(starGeo, starMat));

  return { rootGroup, globeMesh, cloudsMesh, satellitesGroup, jezeroPin, marinerisPin };
}

/**
 * Builds an elevated 3D glowing TubeGeometry ribbon along the computed A* Pathfinding route,
 * plus a contrasting crimson dashed line over blocked direct-line cliffs so the detour is unmistakable,
 * and Point A (Start) / Point B (Destination) holographic beacons.
 */
export function buildAStarRoute3DMesh(
  routePoints: RoutePoint[],
  region: MarsRegionId,
  avoidSlopes: boolean
): THREE.Group {
  const group = new THREE.Group();
  if (routePoints.length < 2) return group;

  const curveVectors: THREE.Vector3[] = [];
  for (let i = 0; i < routePoints.length; i++) {
    const pt = routePoints[i];
    const y = groundHeightAt(pt.x, pt.z, region) + 0.36;
    curveVectors.push(new THREE.Vector3(pt.x, y, pt.z));
  }

  const curve = new THREE.CatmullRomCurve3(curveVectors);
  const tubeGeo = new THREE.TubeGeometry(curve, Math.max(32, routePoints.length * 4), 0.2, 10, false);
  const pathColor = avoidSlopes ? 0x10b981 : 0xef4444;
  const tubeMat = new THREE.MeshStandardMaterial({
    color: pathColor,
    emissive: pathColor,
    emissiveIntensity: 0.95,
    roughness: 0.25,
    metalness: 0.3,
    transparent: true,
    opacity: 0.94
  });
  const tubeMesh = new THREE.Mesh(tubeGeo, tubeMat);
  group.add(tubeMesh);

  // Place directional glowing node spheres along the A* path
  const nodeGeo = new THREE.OctahedronGeometry(0.3, 0);
  const nodeMat = new THREE.MeshBasicMaterial({ color: 0x6ee7b7 });
  const totalLen = curve.getLength();
  const markerCount = Math.min(20, Math.max(5, Math.floor(totalLen / 5.5)));
  for (let i = 1; i < markerCount; i++) {
    const pos = curve.getPointAt(i / markerCount);
    const m = new THREE.Mesh(nodeGeo, nodeMat);
    m.position.copy(pos);
    m.position.y += 0.12;
    group.add(m);
  }

  // When A* slope-avoidance is active, also show the red blocked straight-line path over the steep cliff
  const startPt = routePoints[0];
  const endPt = routePoints[routePoints.length - 1];
  if (avoidSlopes && routePoints.length > 3) {
    const directMat = new THREE.MeshBasicMaterial({
      color: 0xef4444,
      transparent: true,
      opacity: 0.65
    });
    const dashGeo = new THREE.SphereGeometry(0.14, 6, 6);
    const directSamples = 18;
    for (let i = 1; i < directSamples; i++) {
      const t = i / directSamples;
      const dx = startPt.x + (endPt.x - startPt.x) * t;
      const dz = startPt.z + (endPt.z - startPt.z) * t;
      const dy = groundHeightAt(dx, dz, region) + 0.28;
      const dot = new THREE.Mesh(dashGeo, directMat);
      dot.position.set(dx, dy, dz);
      group.add(dot);
    }
  }

  // Point A (Origin) & Point B (Destination) vertical laser beacons + base rings
  const startVec = curveVectors[0];
  const endVec = curveVectors[curveVectors.length - 1];
  const pillarGeo = new THREE.CylinderGeometry(0.14, 0.14, 6.0, 12);

  const startPillar = new THREE.Mesh(
    pillarGeo,
    new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.78 })
  );
  startPillar.position.set(startVec.x, startVec.y + 3.0, startVec.z);
  group.add(startPillar);

  const endPillar = new THREE.Mesh(
    pillarGeo,
    new THREE.MeshBasicMaterial({ color: 0xf59e0b, transparent: true, opacity: 0.88 })
  );
  endPillar.position.set(endVec.x, endVec.y + 3.0, endVec.z);
  group.add(endPillar);

  return group;
}

/**
 * Builds the 10-part composite EVA Astronaut & Rover Excursion Unit mesh.
 */
export function createEvaAstronautMesh(): {
  group: THREE.Group;
  leftLeg: THREE.Mesh;
  rightLeg: THREE.Mesh;
  drillBeam: THREE.Mesh;
  visorMesh: THREE.Mesh;
} {
  const group = new THREE.Group();

  const shadowGeo = new THREE.CircleGeometry(0.95, 24);
  shadowGeo.rotateX(-Math.PI / 2);
  const shadowMat = new THREE.MeshBasicMaterial({
    color: 0x050508,
    transparent: true,
    opacity: 0.45,
    depthWrite: false
  });
  const shadowDisc = new THREE.Mesh(shadowGeo, shadowMat);
  shadowDisc.position.y = 0.02;
  group.add(shadowDisc);

  const suitFabricMat = new THREE.MeshStandardMaterial({
    color: 0xf1f5f9,
    roughness: 0.82,
    metalness: 0.1
  });
  const trimMetalMat = new THREE.MeshStandardMaterial({
    color: 0x475569,
    roughness: 0.32,
    metalness: 0.78
  });
  const goldVisorMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    roughness: 0.12,
    metalness: 0.94,
    emissive: 0x451a03,
    emissiveIntensity: 0.35
  });
  const accentOrangeMat = new THREE.MeshStandardMaterial({
    color: 0xea580c,
    roughness: 0.55,
    metalness: 0.2
  });
  const cyanEmissiveMat = new THREE.MeshStandardMaterial({
    color: 0x06b6d4,
    emissive: 0x06b6d4,
    emissiveIntensity: 1.4,
    roughness: 0.2,
    metalness: 0.5
  });

  const legGeo = new THREE.CapsuleGeometry(0.16, 0.42, 6, 12);
  const leftLeg = new THREE.Mesh(legGeo, suitFabricMat);
  leftLeg.position.set(-0.2, 0.38, 0);
  leftLeg.castShadow = true;
  group.add(leftLeg);

  const rightLeg = new THREE.Mesh(legGeo, suitFabricMat);
  rightLeg.position.set(0.2, 0.38, 0);
  rightLeg.castShadow = true;
  group.add(rightLeg);

  const torsoGeo = new THREE.CylinderGeometry(0.36, 0.31, 0.78, 16);
  const torso = new THREE.Mesh(torsoGeo, suitFabricMat);
  torso.position.set(0, 1.02, 0);
  torso.castShadow = true;
  group.add(torso);

  const collarGeo = new THREE.TorusGeometry(0.32, 0.065, 10, 20);
  collarGeo.rotateX(Math.PI / 2);
  const collar = new THREE.Mesh(collarGeo, accentOrangeMat);
  collar.position.set(0, 1.38, 0);
  group.add(collar);

  const plssGeo = new THREE.BoxGeometry(0.56, 0.74, 0.34);
  const plss = new THREE.Mesh(plssGeo, trimMetalMat);
  plss.position.set(0, 1.08, -0.32);
  plss.castShadow = true;
  group.add(plss);

  const visorGeo = new THREE.SphereGeometry(0.29, 20, 16);
  const visorMesh = new THREE.Mesh(visorGeo, goldVisorMat);
  visorMesh.position.set(0, 1.66, 0.03);
  visorMesh.castShadow = true;
  group.add(visorMesh);

  const shroudGeo = new THREE.SphereGeometry(0.31, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.58);
  const shroud = new THREE.Mesh(shroudGeo, suitFabricMat);
  shroud.position.set(0, 1.67, -0.02);
  shroud.rotation.x = -0.35;
  group.add(shroud);

  const dcmGeo = new THREE.BoxGeometry(0.34, 0.24, 0.14);
  const dcm = new THREE.Mesh(dcmGeo, trimMetalMat);
  dcm.position.set(0, 1.1, 0.32);
  group.add(dcm);

  const screenGeo = new THREE.PlaneGeometry(0.24, 0.12);
  const screen = new THREE.Mesh(screenGeo, cyanEmissiveMat);
  screen.position.set(0, 1.12, 0.395);
  group.add(screen);

  const armGeo = new THREE.CylinderGeometry(0.11, 0.1, 0.58, 10);
  armGeo.rotateX(Math.PI / 2);
  const rightArm = new THREE.Mesh(armGeo, suitFabricMat);
  rightArm.position.set(0.44, 1.08, 0.18);
  group.add(rightArm);

  const leftArm = new THREE.Mesh(armGeo, suitFabricMat);
  leftArm.position.set(-0.44, 1.08, 0.12);
  group.add(leftArm);

  const drillBarrelGeo = new THREE.ConeGeometry(0.09, 0.38, 12);
  drillBarrelGeo.rotateX(Math.PI / 2);
  const drillBarrel = new THREE.Mesh(drillBarrelGeo, trimMetalMat);
  drillBarrel.position.set(0.44, 1.08, 0.55);
  group.add(drillBarrel);

  const antGeo = new THREE.CylinderGeometry(0.015, 0.025, 0.65, 6);
  const ant = new THREE.Mesh(antGeo, trimMetalMat);
  ant.position.set(-0.22, 1.72, -0.38);
  group.add(ant);

  const antTip = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8), cyanEmissiveMat);
  antTip.position.set(-0.22, 2.06, -0.38);
  group.add(antTip);

  const beamGeo = new THREE.CylinderGeometry(0.03, 0.12, 2.6, 12);
  beamGeo.rotateX(Math.PI / 2);
  const beamMat = new THREE.MeshBasicMaterial({
    color: 0x06b6d4,
    transparent: true,
    opacity: 0.85,
    depthWrite: false
  });
  const drillBeam = new THREE.Mesh(beamGeo, beamMat);
  drillBeam.position.set(0.44, 0.65, 1.55);
  drillBeam.rotation.x = 0.32;
  drillBeam.visible = false;
  group.add(drillBeam);

  return { group, leftLeg, rightLeg, drillBeam, visorMesh };
}

/**
 * Builds the 9-part Ares-IV Pressurized Habitat Dome & Airlock Base.
 */
export function createHabitatBaseMesh(): THREE.Group {
  const group = new THREE.Group();

  const hullMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    roughness: 0.68,
    metalness: 0.22
  });
  const titaniumMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughness: 0.3,
    metalness: 0.82
  });
  const solarMat = new THREE.MeshStandardMaterial({
    color: 0x1e3a8a,
    roughness: 0.18,
    metalness: 0.88
  });
  const beaconMat = new THREE.MeshStandardMaterial({
    color: 0x10b981,
    emissive: 0x10b981,
    emissiveIntensity: 1.5,
    roughness: 0.2
  });

  const padGeo = new THREE.CylinderGeometry(6.4, 6.8, 0.24, 32);
  const pad = new THREE.Mesh(padGeo, titaniumMat);
  pad.position.y = 0.12;
  pad.receiveShadow = true;
  group.add(pad);

  const ringGeo = new THREE.RingGeometry(6.5, 6.85, 48);
  ringGeo.rotateX(-Math.PI / 2);
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0x10b981,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.65,
    depthWrite: false
  });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.position.y = 0.04;
  group.add(ring);

  const domeGeo = new THREE.SphereGeometry(3.8, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.52);
  const dome = new THREE.Mesh(domeGeo, hullMat);
  dome.position.set(0, 0.2, 1.2);
  dome.castShadow = true;
  dome.receiveShadow = true;
  group.add(dome);

  const ribGeo = new THREE.TorusGeometry(3.75, 0.14, 10, 32);
  ribGeo.rotateX(Math.PI / 2);
  const rib = new THREE.Mesh(ribGeo, titaniumMat);
  rib.position.set(0, 0.45, 1.2);
  group.add(rib);

  const airlockGeo = new THREE.CylinderGeometry(1.25, 1.25, 3.2, 16);
  airlockGeo.rotateX(Math.PI / 2);
  const airlock = new THREE.Mesh(airlockGeo, titaniumMat);
  airlock.position.set(0, 1.25, -2.6);
  airlock.castShadow = true;
  group.add(airlock);

  const archGeo = new THREE.TorusGeometry(1.3, 0.08, 8, 24, Math.PI);
  const arch = new THREE.Mesh(archGeo, beaconMat);
  arch.position.set(0, 1.25, -4.2);
  group.add(arch);

  const wingGeo = new THREE.BoxGeometry(3.4, 0.08, 1.8);
  const leftWing = new THREE.Mesh(wingGeo, solarMat);
  leftWing.position.set(-5.1, 1.8, 1.2);
  leftWing.rotation.z = 0.22;
  leftWing.castShadow = true;
  group.add(leftWing);

  const rightWing = new THREE.Mesh(wingGeo, solarMat);
  rightWing.position.set(5.1, 1.8, 1.2);
  rightWing.rotation.z = -0.22;
  rightWing.castShadow = true;
  group.add(rightWing);

  const mastGeo = new THREE.CylinderGeometry(0.12, 0.18, 2.8, 10);
  const mast = new THREE.Mesh(mastGeo, titaniumMat);
  mast.position.set(0, 4.8, 1.2);
  group.add(mast);

  const dishGeo = new THREE.SphereGeometry(0.95, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.38);
  const dish = new THREE.Mesh(dishGeo, hullMat);
  dish.position.set(0, 6.2, 1.2);
  dish.rotation.x = -0.6;
  group.add(dish);

  return group;
}

/**
 * Builds a 6-part NASA Science Station / Geological POI Marker at each waypoint.
 */
export function createScienceWaypointMesh(wp: ScienceWaypoint): {
  group: THREE.Group;
  beaconCrystal: THREE.Mesh;
  ringMesh: THREE.Mesh;
} {
  const group = new THREE.Group();
  const y = groundHeightAt(wp.x, wp.z, wp.region);
  group.position.set(wp.x, y, wp.z);

  const colorHex =
    wp.sampleType === 'ice'
      ? 0x06b6d4
      : wp.sampleType === 'shelter'
      ? 0x10b981
      : wp.sampleType === 'calibration'
      ? 0xf59e0b
      : 0xec4899;

  const baseMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughness: 0.35,
    metalness: 0.78
  });
  const foilMat = new THREE.MeshStandardMaterial({
    color: 0xd97706,
    roughness: 0.22,
    metalness: 0.9
  });
  const emissiveMat = new THREE.MeshStandardMaterial({
    color: colorHex,
    emissive: colorHex,
    emissiveIntensity: 1.5,
    roughness: 0.15,
    metalness: 0.4
  });

  const ringGeo = new THREE.RingGeometry(2.1, 2.5, 32);
  ringGeo.rotateX(-Math.PI / 2);
  const ringMat = new THREE.MeshBasicMaterial({
    color: colorHex,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.8,
    depthWrite: false
  });
  const ringMesh = new THREE.Mesh(ringGeo, ringMat);
  ringMesh.position.y = 0.05;
  group.add(ringMesh);

  const coreGeo = new THREE.CylinderGeometry(0.45, 0.55, 0.75, 8);
  const core = new THREE.Mesh(coreGeo, foilMat);
  core.position.y = 0.42;
  core.castShadow = true;
  group.add(core);

  for (let i = 0; i < 3; i++) {
    const angle = (i * Math.PI * 2) / 3;
    const legGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.9, 6);
    const leg = new THREE.Mesh(legGeo, baseMat);
    leg.position.set(Math.cos(angle) * 0.55, 0.32, Math.sin(angle) * 0.55);
    leg.rotation.z = -Math.cos(angle) * 0.45;
    leg.rotation.x = Math.sin(angle) * 0.45;
    group.add(leg);
  }

  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 1.4, 8), baseMat);
  mast.position.y = 1.4;
  group.add(mast);

  const crystalGeo = new THREE.OctahedronGeometry(0.45, 0);
  const beaconCrystal = new THREE.Mesh(crystalGeo, emissiveMat);
  beaconCrystal.position.y = 2.55;
  group.add(beaconCrystal);

  if (wp.sampleType === 'shelter') {
    const basaltMat = new THREE.MeshStandardMaterial({
      color: 0x3f2e26,
      roughness: 0.92,
      metalness: 0.06,
      flatShading: true
    });
    const archPillarL = new THREE.Mesh(new THREE.DodecahedronGeometry(2.6, 0), basaltMat);
    archPillarL.position.set(-3.2, 1.8, -1.5);
    archPillarL.scale.set(1.1, 1.6, 1.1);
    archPillarL.castShadow = true;
    group.add(archPillarL);

    const archPillarR = new THREE.Mesh(new THREE.DodecahedronGeometry(2.6, 0), basaltMat);
    archPillarR.position.set(3.2, 1.8, -1.5);
    archPillarR.scale.set(1.1, 1.6, 1.1);
    archPillarR.castShadow = true;
    group.add(archPillarR);

    const archRoof = new THREE.Mesh(new THREE.DodecahedronGeometry(3.6, 0), basaltMat);
    archRoof.position.set(0, 4.2, -1.2);
    archRoof.scale.set(1.6, 0.65, 1.2);
    archRoof.castShadow = true;
    group.add(archRoof);
  }

  return { group, beaconCrystal, ringMesh };
}

/**
 * Builds composite 3D meshes for the 3 distinct Martian hazard archetypes.
 */
export function createHazardActorMesh(archetype: 'dust_devil' | 'solar_flare_zone' | 'slope_debris'): {
  group: THREE.Group;
  telegraphRing: THREE.Mesh;
  coreGroup: THREE.Group;
} {
  const group = new THREE.Group();
  const coreGroup = new THREE.Group();
  group.add(coreGroup);

  const ringColor =
    archetype === 'dust_devil' ? 0xf59e0b : archetype === 'solar_flare_zone' ? 0xef4444 : 0xec4899;

  const telegraphGeo = new THREE.RingGeometry(0.6, 3.2, 32);
  telegraphGeo.rotateX(-Math.PI / 2);
  const telegraphMat = new THREE.MeshBasicMaterial({
    color: ringColor,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.15,
    depthWrite: false
  });
  const telegraphRing = new THREE.Mesh(telegraphGeo, telegraphMat);
  telegraphRing.position.y = 0.06;
  group.add(telegraphRing);

  if (archetype === 'dust_devil') {
    const matOuter = new THREE.MeshStandardMaterial({
      color: 0xd97706,
      roughness: 0.85,
      transparent: true,
      opacity: 0.45,
      depthWrite: false
    });
    const matInner = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      emissive: 0x78350f,
      roughness: 0.6,
      transparent: true,
      opacity: 0.65,
      depthWrite: false
    });
    for (let i = 0; i < 4; i++) {
      const rTop = 0.55 + i * 0.48;
      const rBot = 0.25 + i * 0.2;
      const h = 1.8 + i * 1.35;
      const cone = new THREE.Mesh(
        new THREE.CylinderGeometry(rTop, rBot, h, 14, 1, true),
        i % 2 === 0 ? matOuter : matInner
      );
      cone.position.y = h * 0.5 + i * 0.4;
      coreGroup.add(cone);
    }
  } else if (archetype === 'solar_flare_zone') {
    const crystalMat = new THREE.MeshStandardMaterial({
      color: 0xef4444,
      emissive: 0xdc2626,
      emissiveIntensity: 1.2,
      roughness: 0.2,
      metalness: 0.7
    });
    for (let i = 0; i < 5; i++) {
      const angle = (i * Math.PI * 2) / 5;
      const spire = new THREE.Mesh(new THREE.ConeGeometry(0.28, 1.6, 6), crystalMat);
      spire.position.set(Math.cos(angle) * 1.4, 0.8, Math.sin(angle) * 1.4);
      coreGroup.add(spire);
    }
  } else {
    const rockMat = new THREE.MeshStandardMaterial({
      color: 0x7c2d12,
      roughness: 0.88,
      metalness: 0.12,
      flatShading: true
    });
    const glowMat = new THREE.MeshStandardMaterial({
      color: 0xf97316,
      emissive: 0xea580c,
      emissiveIntensity: 1.1,
      roughness: 0.3
    });
    const mainBoulder = new THREE.Mesh(new THREE.DodecahedronGeometry(0.95, 0), rockMat);
    mainBoulder.position.y = 0.95;
    coreGroup.add(mainBoulder);

    for (let i = 0; i < 3; i++) {
      const a = (i * Math.PI * 2) / 3;
      const shard = new THREE.Mesh(new THREE.OctahedronGeometry(0.4, 0), glowMat);
      shard.position.set(Math.cos(a) * 1.0, 0.65, Math.sin(a) * 1.0);
      coreGroup.add(shard);
    }
  }

  return { group, telegraphRing, coreGroup };
}
