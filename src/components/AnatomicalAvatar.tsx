import React, { useState, useEffect, useRef, useMemo } from 'react';
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { 
  RotateCw, 
  Layers, 
  Activity, 
  Sparkles, 
  Compass, 
  User, 
  Undo,
  BookmarkCheck,
  Dumbbell,
  Upload
} from 'lucide-react';
import { WorkoutSet, MachineConfig } from '../types';
import { auth } from '../firebase';
import { calculateFatigueScores } from '../utils/fatigue';
import { MACHINES } from './MachineList';

import { Point3D, MuscleDefinition, MUSCLES } from '../data/muscleData';
export type { Point3D, MuscleDefinition };
export { MUSCLES };

function getBaseMuscleColor(group: string, id: string): number {
  switch (id) {
    // Chest
    case 'pectoralis_major': return 0xff5722;
    case 'pectoralis_minor': return 0xe64a19;
    
    // Shoulders
    case 'deltoid_anterior': return 0xffd54f;
    case 'deltoid_lateral': return 0xffb300;
    case 'deltoid_posterior': return 0xff8f00;
    case 'rotator_cuff': return 0xffa000;
    case 'sternocleidomastoid': return 0xffca28;
    
    // Arms
    case 'biceps_brachii': return 0xffa000;
    case 'brachialis': return 0xff8f00;
    case 'triceps_brachii': return 0xff6d00;
    case 'forearm_extensors': return 0xff9100;
    case 'forearm_flexors': return 0xffa726;
    
    // Core
    case 'rectus_abdominis': return 0xff9800;
    case 'obliques':
    case 'obliques_left':
    case 'obliques_right': return 0xf57c00;
    case 'transversus_abdominis': return 0xef6c00;
    
    // Back
    case 'trapezius_upper': return 0xf4511e;
    case 'splenius_capitis': return 0xdd2c00;
    case 'rhomboideus_major': return 0xd84315;
    case 'erector_spinae': return 0xbf360c;
    case 'latissimus_dorsi': return 0xe64a19;
    
    // Glutes
    case 'gluteus_maximus': return 0xdd2c00;
    case 'gluteus_medius': return 0xf4511e;
    case 'gluteus_minimus': return 0xe64a19;
    
    // Legs
    case 'quadriceps_femoris': return 0xef5350;
    case 'hamstrings': return 0xe53935;
    case 'gastrocnemius': return 0xd32f2f;
    case 'soleus': return 0xc62828;
    case 'tibialis_anterior': return 0xe57373;
    case 'extensor_digitorum_brevis': return 0xef9a9a;
    case 'serratus_anterior': return 0xffa726;
    case 'iliopsoas': return 0xff8f00;
    case 'adductors': return 0xe53935;
    case 'sartorius': return 0xf44336;
    case 'fibularis': return 0xe57373;

    
    default:
      switch (group) {
        case 'Chest': return 0xff5722;
        case 'Shoulders': return 0xffb300;
        case 'Arms': return 0xff9800;
        case 'Back': return 0xf4511e;
        case 'Core': return 0xffa726;
        case 'Glutes': return 0xe64a19;
        case 'Legs': return 0xef4444;
        default: return 0xffa726;
      }
  }
}

interface ColorRGBA {
  r: number;
  g: number;
  b: number;
  alpha: number;
}

// Solid geometric triangulator for perfect Water-tight 3D muscles inside Three.js
function buildMuscleGeometry(points3D: THREE.Vector3[], thick: number, extrudeDir: THREE.Vector3): THREE.BufferGeometry {
  const geom = new THREE.BufferGeometry();
  
  // 1. Interpolate input points using Catmull-Rom for perfectly smooth, organic boundaries
  const k = points3D.length;
  const N = Math.max(6, k * 2);
  
  // Close the curve for an enclosed perimeter loop
  const curve = new THREE.CatmullRomCurve3(points3D, true);
  curve.curveType = 'centripetal'; // Reduces loops/kinks
  
  // getPoints(N) returns N+1 points, we want exactly N so we omit the last matching point
  const pts = curve.getPoints(N).slice(0, N);

  // Calculate clean centroid
  const centroid = new THREE.Vector3();
  pts.forEach(p => centroid.add(p));
  centroid.divideScalar(N);

  const R = 6; // Concentric rings for natural doming
  
  // Create all vertices in a sequential layout:
  // 1. Shared perimeter ring 0 (indices [0..N-1]): sitting directly on base body shell pts.
  // 2. Outer side ring 1 to R-1 (indices [N .. R*N-1]), and Center Outer (at idx: R * N)
  // 3. Inner side ring 1 to R-1 (indices [R*N+1 .. 2*R*N-N]), and Center Inner (at idx: 2 * R * N - N + 1)
  const totalVertsCount = 2 * R * N - N + 2;
  const verticesMap = new Float32Array(totalVertsCount * 3);
  const uvsMap = new Float32Array(totalVertsCount * 2);

  // Determine predominant axis for UV alignment (striation direction)
  let minBox = new THREE.Vector3(Infinity, Infinity, Infinity);
  let maxBox = new THREE.Vector3(-Infinity, -Infinity, -Infinity);
  pts.forEach(p => { minBox.min(p); maxBox.max(p); });
  const span = new THREE.Vector3().subVectors(maxBox, minBox);
  
  // Decide major axes (U across, V along length usually)
  let isXLongest = span.x > span.y && span.x > span.z;
  let sx = Math.max(0.01, span.x);
  let sy = Math.max(0.01, span.y);

  const getIndex = (isOuter: boolean, r: number, idx: number): number => {
    if (r === 0) return idx;
    if (isOuter) {
      if (r === R) return R * N;
      return N + (r - 1) * N + idx;
    } else {
      if (r === R) return 2 * R * N - N + 1;
      return R * N + 1 + (r - 1) * N + idx;
    }
  };

  // Helper to get the 3D position for a given ring coordinate
  const computePosition = (isOuter: boolean, r: number, idx: number): THREE.Vector3 => {
    if (r === 0) {
      // Perimeter edges represent tendons inserting tightly onto the skeleton bones.
      // Plunge deeply towards the skeletal structure to visually bind them to the joint sites.
      return pts[idx].clone().addScaledVector(extrudeDir, -thick * 1.2);
    }
    
    const t = r / R; // Contraction progress (0 to 1), 0=perimeter, 1=center
    // Smooth bell-shaped curve for the muscle belly
    const bulgeProfile = Math.sin(t * Math.PI / 2);
    
    // Scale from perimeter to centroid
    const pos = centroid.clone().lerp(pts[idx], 1 - t);
    
    if (isOuter) {
      // Outer side of the muscle: wraps snugly around the body, barely protruding for high definition
      // Must converge to -1.2 at t=0
      const offset = thick * (0.8 * bulgeProfile - 1.2 * (1 - bulgeProfile));
      pos.addScaledVector(extrudeDir, offset);
    } else {
      // Deep inner side: plunges deep into the core to wrap the bones
      // Must converge to -1.2 at t=0
      const offset = -thick * (1.5 * bulgeProfile + 1.2 * (1 - bulgeProfile));
      pos.addScaledVector(extrudeDir, offset);
    }
    return pos;
  };

  // Populate all vertices in Float32Array
  for (let r = 0; r <= R; r++) {
    const loopLimit = (r === R) ? 1 : N;
    for (let i = 0; i < loopLimit; i++) {
      // Outer point
      const idxOuter = getIndex(true, r, i);
      const posOuter = computePosition(true, r, i);
      verticesMap[idxOuter * 3]     = posOuter.x;
      verticesMap[idxOuter * 3 + 1] = posOuter.y;
      verticesMap[idxOuter * 3 + 2] = posOuter.z;
      
      uvsMap[idxOuter * 2]     = isXLongest ? (posOuter.y - minBox.y) / sy : (posOuter.x - minBox.x) / sx;
      uvsMap[idxOuter * 2 + 1] = isXLongest ? (posOuter.x - minBox.x) / sx : (posOuter.y - minBox.y) / sy;

      // Inner point (skip r=0 since it's shared/identical)
      if (r > 0) {
        const idxInner = getIndex(false, r, i);
        const posInner = computePosition(false, r, i);
        verticesMap[idxInner * 3]     = posInner.x;
        verticesMap[idxInner * 3 + 1] = posInner.y;
        verticesMap[idxInner * 3 + 2] = posInner.z;
        
        uvsMap[idxInner * 2]     = isXLongest ? (posInner.y - minBox.y) / sy : (posInner.x - minBox.x) / sx;
        uvsMap[idxInner * 2 + 1] = isXLongest ? (posInner.x - minBox.x) / sx : (posInner.y - minBox.y) / sy;
      }
    }
  }

  // Generate Indices (Triangles list)
  const indices: number[] = [];

  // 1. Generate Outer dome triangles (CCW facing out)
  for (let r = 0; r < R - 1; r++) {
    for (let i = 0; i < N; i++) {
      const next = (i + 1) % N;
      const curr_curr = getIndex(true, r, i);
      const curr_next = getIndex(true, r, next);
      const next_curr = getIndex(true, r + 1, i);
      const next_next = getIndex(true, r + 1, next);
      indices.push(curr_curr, curr_next, next_next);
      indices.push(curr_curr, next_next, next_curr);
    }
  }
  // Connect outer ring R-1 to Center Outer (r=R)
  for (let i = 0; i < N; i++) {
    const next = (i + 1) % N;
    const curr_curr = getIndex(true, R - 1, i);
    const curr_next = getIndex(true, R - 1, next);
    const center_idx = getIndex(true, R, 0);
    indices.push(curr_curr, center_idx, curr_next);
  }

  // 2. Generate Inner dome triangles (CW so normals face inward)
  for (let r = 0; r < R - 1; r++) {
    for (let i = 0; i < N; i++) {
      const next = (i + 1) % N;
      const curr_curr = getIndex(false, r, i);
      const curr_next = getIndex(false, r, next);
      const next_curr = getIndex(false, r + 1, i);
      const next_next = getIndex(false, r + 1, next);
      indices.push(curr_curr, next_next, curr_next);
      indices.push(curr_curr, next_curr, next_next);
    }
  }
  // Connect inner ring R-1 to Center Inner (r=R)
  for (let i = 0; i < N; i++) {
    const next = (i + 1) % N;
    const curr_curr = getIndex(false, R - 1, i);
    const curr_next = getIndex(false, R - 1, next);
    const center_idx = getIndex(false, R, 0);
    indices.push(curr_curr, curr_next, center_idx);
  }

  geom.setAttribute('position', new THREE.BufferAttribute(verticesMap, 3));
  geom.setAttribute('uv', new THREE.BufferAttribute(uvsMap, 2));
  geom.setIndex(indices);
  geom.computeVertexNormals();
  return geom;
}

// Convert slice grids into watertight solid double-sided tubes for the silhouette shell
function buildGridTubeGeometry(grid: Point3D[][]): THREE.BufferGeometry {
  const geom = new THREE.BufferGeometry();
  const rows = grid.length;
  if (rows === 0) return geom;
  const cols = grid[0].length;
  
  const vertices: number[] = [];
  const indices: number[] = [];
  const uvs: number[] = [];
  
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const p = grid[r][c];
      vertices.push(p.x, p.y, p.z);
      uvs.push(c / cols, r / (rows - 1));
    }
  }
  
  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < cols; c++) {
      const nextC = (c + 1) % cols;
      const v00 = r * cols + c;
      const v01 = r * cols + nextC;
      const v10 = (r + 1) * cols + c;
      const v11 = (r + 1) * cols + nextC;
      
      // Triangle 1
      indices.push(v00, v11, v10);
      // Triangle 2
      indices.push(v00, v01, v11);
    }
  }
  
  geom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(vertices), 3));
  geom.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(uvs), 2));
  geom.setIndex(indices);
  geom.computeVertexNormals();
  return geom;
}

interface AnatomicalAvatarProps {
  sets: WorkoutSet[];
  machineConfigs: MachineConfig[];
  onSelectMachineByCategory: (category: string) => void;
  initialGroup?: string;
  onGroupChange?: (group: string) => void;
  initialShowFatigue?: boolean;
  linkingExercise?: string | null;
  onClearLinking?: () => void;
  saveMachineConfig?: (
    exercise: string, 
    baseWeightLbs: number, 
    baseWeightKg: number,
    brand?: string,
    category?: string,
    variantCategories?: Record<string, string>,
    type?: 'Machine' | 'Weightlifting' | 'Exercise',
    oldExercise?: string,
    linkedMuscles?: string[],
    linkedGroups?: string[],
    customFields?: string[],
    invertWeight?: boolean,
    invertBaseWeight?: boolean
  ) => Promise<void>;
}

const holographicVertexShader = `
varying vec3 vNormal;
varying vec2 vUv;
varying vec3 vViewPosition;

void main() {
  vUv = uv;
  vNormal = normalize(normalMatrix * normal);
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  vViewPosition = -mvPosition.xyz;
  gl_Position = projectionMatrix * mvPosition;
}
`;

const holographicFragmentShader = `
uniform vec3 uColor;
uniform vec3 uBaseColor;
uniform float uOpacity;
uniform float uIsLinked;
uniform float uTime;
uniform float uEmissiveIntensity;
uniform vec3 uEmissiveColor;

varying vec3 vNormal;
varying vec2 vUv;
varying vec3 vViewPosition;

float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
}
float noise(vec2 x) {
    vec2 i = floor(x);
    vec2 f = fract(x);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}

void main() {
  vec3 normal = normalize(vNormal);
  vec3 viewDir = normalize(vViewPosition);

  // Perturb normal slightly using striations (fake bump mapping)
  // Lower the high frequency to make fibers look like long continuous bands
  vec2 noiseUv = vec2(vUv.x * 12.0, vUv.y * 2.0);
  vec2 animatedUv = noiseUv + vec2(0.0, uTime * 0.4 * uIsLinked);
  
  float n1 = noise(animatedUv);
  float n2 = noise(animatedUv * 2.0 + vec2(sin(uTime * 0.5), 0.0));
  float striation = smoothstep(0.3, 0.8, (n1 * 0.7 + n2 * 0.3));
  
  // Tangent/bitangent generation
  vec3 tangent = normalize(cross(normal, vec3(0.0, 1.0, 0.0)));
  // Handle edge case where normal is parallel to Y
  if (length(tangent) < 0.01) { tangent = normalize(cross(normal, vec3(1.0, 0.0, 0.0))); }
  vec3 bitangent = normalize(cross(normal, tangent));
  
  // Finite difference for bump
  float n1_dx = noise(animatedUv + vec2(0.3, 0.0));
  float bumpAmount = 0.5;
  vec3 bumpedNormal = normalize(normal + tangent * (n1_dx - n1) * bumpAmount);

  // Studio Lighting Setup
  vec3 lightDir1 = normalize(vec3(0.5, 1.0, 1.0)); // Main Top-Front
  vec3 lightDir2 = normalize(vec3(-1.0, 0.2, -0.5)); // Rim Right-Back
  vec3 lightDir3 = normalize(vec3(0.0, -1.0, 0.5)); // Fill Bottom

  // Diffuse
  float diff1 = max(dot(bumpedNormal, lightDir1), 0.0);
  float diff2 = max(dot(bumpedNormal, lightDir2), 0.0);
  float diff3 = max(dot(bumpedNormal, lightDir3), 0.0);
  
  // Dialed down diffuse light to avoid blowing out to white
  vec3 diffuseLight = vec3(1.0, 0.95, 0.9) * diff1 * 0.75 + 
                      vec3(0.4, 0.7, 1.0) * diff2 * 0.45 + 
                      vec3(0.2, 0.25, 0.35) * diff3 * 0.25;
  diffuseLight += vec3(0.12, 0.12, 0.15); // Ambient / GI

  // Specular (Glossy organic wetness)
  vec3 halfVector1 = normalize(lightDir1 + viewDir);
  float dotHalf1 = clamp(dot(bumpedNormal, halfVector1), 0.0, 1.0);
  float spec1 = pow(dotHalf1, 16.0); // Broad sweat
  float spec2 = pow(dotHalf1, 128.0); // Sharp moist highlight
  
  // Diminish specular highlight significantly so it doesn't wash out to white
  vec3 specularLight = vec3(1.0, 0.9, 0.8) * (spec1 * 0.15 + spec2 * 0.25);

  // Base muscle color heavily modulated by striation
  vec3 mixColor = mix(uBaseColor * 0.5, uBaseColor * 1.1, striation);

  // Combine lighting model
  vec3 finalColor = mixColor * diffuseLight + specularLight;
  
  // Bioluminescent pulsating energy flowing through the muscle fibers when selected
  float pulse = sin(uTime * 4.0 - vUv.y * 10.0) * 0.5 + 0.5;
  
  // Determine if it should pulse based on high emissive intensity (which we set for fatigue > 0 or linked muscles)
  float isHighlyActive = step(1.1, uEmissiveIntensity); 
  float activeEnergy = isHighlyActive * pulse * striation * 2.5;
  
  // Core glow & fatigue emissives
  finalColor += (uEmissiveColor * uEmissiveIntensity); 
  
  // Mix in the energy pulses
  finalColor += uEmissiveColor * activeEnergy;

  // Fresnel effect (Holographic Sci-Fi Rim)
  float dotProduct = clamp(dot(normal, viewDir), 0.0, 1.0);
  float fresnel = pow(clamp(1.0 - dotProduct, 0.0, 1.0), 3.5);
  finalColor += uColor * fresnel * 2.5; 
  
  // Active state intense glow rim
  if (uIsLinked > 0.5 || isHighlyActive > 0.5) {
      finalColor += uEmissiveColor * fresnel * 1.5 * uEmissiveIntensity;
  }
  
  // Solid opacity with slight depth to edges for X-ray feel
  float alpha = uOpacity;
  
  // Make completely saturated when fatigue/emissive is high
  if (uEmissiveIntensity > 1.1) {
     finalColor = mix(finalColor, uEmissiveColor * uEmissiveIntensity * 1.5, 0.4);
  }

  gl_FragColor = vec4(finalColor, alpha);
}
`;

const skeletonFragmentShader = `
uniform vec3 uColor;
uniform float uOpacity;
varying vec3 vNormal;
varying vec3 vViewPosition;

void main() {
  vec3 normal = normalize(vNormal);
  vec3 viewDir = normalize(vViewPosition);

  // High-fidelity x-ray fresnel
  float dotProduct = clamp(dot(normal, viewDir), 0.0, 1.0);
  float fresnel = pow(clamp(1.0 - dotProduct, 0.0, 1.0), 2.0);
  
  // Add a subtle inner glow
  float innerGlow = pow(clamp(dotProduct, 0.0, 1.0), 4.0) * 0.3;

  vec3 baseColor = uColor;
  vec3 rimColor = uColor * 2.5;

  vec3 finalColor = mix(baseColor * innerGlow, rimColor, fresnel);

  gl_FragColor = vec4(finalColor, uOpacity * (fresnel + innerGlow));
}
`;

// Activate three.js global cache to speed up re-renders and model loading
THREE.Cache.enabled = true;

// Instantiate loaders globally so they are reused across component mounts, saving memory and init time
const globalDracoLoader = new DRACOLoader();
globalDracoLoader.setDecoderPath('/draco/gltf/');
const globalGLTFLoader = new GLTFLoader();
globalGLTFLoader.setDRACOLoader(globalDracoLoader);

const globalGLBCache: Record<string, Promise<any>> = {};

const loadCachedGLB = async (url: string) => {
  if (!globalGLBCache[url]) {
    console.log('Attempting to load URL:', url);
    globalGLBCache[url] = globalGLTFLoader.loadAsync(url).catch(err => {
      console.error('Failed to load GLB:', url, err);
      delete globalGLBCache[url];
      throw err;
    });
  }
  return await globalGLBCache[url];
};

export default function AnatomicalAvatar({ 
  sets, 
  machineConfigs, 
  onSelectMachineByCategory,
  initialGroup,
  onGroupChange,
  initialShowFatigue,
  linkingExercise = null,
  onClearLinking,
  saveMachineConfig
}: AnatomicalAvatarProps) {
  const [gender, setGender] = useState<'male' | 'female'>('male');
  const [selectedGroup, setSelectedGroup] = useState<string>(initialGroup || 'All');
  const [selectedMuscleId, setSelectedMuscleId] = useState<string | null>(null);
  const [showFatigue, setShowFatigue] = useState<boolean>(initialShowFatigue || false);
  const [avatarLoading, setAvatarLoading] = useState<boolean>(true);
  const [avatarLoadingStage, setAvatarLoadingStage] = useState<string>('Initializing Biomechanical Stream...');

  // References and flags for custom mouse/touch long press handling
  const longPressTimerRef = useRef<any>(null);
  const isLongPressRef = useRef<boolean>(false);
  const activePressObjectRef = useRef<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canvas2DRef = useRef<HTMLCanvasElement>(null);
  const renderedCameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const renderedMeshesRef = useRef<THREE.Mesh[]>([]);
  const loadCustomGLBRef = useRef<any>(null);

  const genderHipFactor = gender === 'female' ? 1.05 : 0.95;
  const genderShoulderFactor = gender === 'male' ? 1.05 : 0.95;

  const handleMuscleClick = (muscleId: string | null) => {
    setSelectedMuscleId(muscleId);
    if (muscleId) {
      const muscleDef = MUSCLES.find(m => m.id === muscleId);
      if (muscleDef) {
        setSelectedGroup(muscleDef.group);
      }
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && loadCustomGLBRef.current) {
      const url = URL.createObjectURL(file);
      loadCustomGLBRef.current(url);
    }
  };

  const currentConfig = useMemo(() => {
    if (!linkingExercise) return null;
    return machineConfigs.find(c => c.exercise.toLowerCase() === linkingExercise.toLowerCase()) || null;
  }, [machineConfigs, linkingExercise]);

  const linkedGroups = useMemo(() => {
    return currentConfig?.linkedGroups || [];
  }, [currentConfig]);

  const linkedMuscles = useMemo(() => {
    return currentConfig?.linkedMuscles || [];
  }, [currentConfig]);

  const toggleGroupLink = async (groupName: string) => {
    if (!linkingExercise || !saveMachineConfig) return;
    
    const existing = machineConfigs.find(c => c.exercise.toLowerCase() === linkingExercise.toLowerCase());
    const baseWeightLbs = existing?.baseWeightLbs || 0;
    const baseWeightKg = existing?.baseWeightKg || 0;
    const brand = existing?.brand || 'Standard';
    
    let nextGroups = [...(existing?.linkedGroups || [])];
    if (nextGroups.includes(groupName)) {
      nextGroups = nextGroups.filter(g => g !== groupName);
    } else {
      nextGroups.push(groupName);
    }

    const nextMuscles = existing?.linkedMuscles || [];
    
    let category = existing?.category || 'Custom';
    if (nextGroups.length > 0) {
      category = nextGroups[0];
    } else if (nextMuscles.length > 0) {
      const firstM = MUSCLES.find(m => m.id === nextMuscles[0]);
      if (firstM) category = firstM.group;
    } else {
      category = 'Custom';
    }
    
    const variantCategories = existing?.variantCategories || {};
    const type = existing?.type || 'Machine';

    try {
      if (navigator.vibrate) navigator.vibrate(30);
      await saveMachineConfig(
        linkingExercise,
        baseWeightLbs,
        baseWeightKg,
        brand,
        category,
        variantCategories,
        type,
        undefined,
        nextMuscles,
        nextGroups
      );
      setHintMessage(`Toggled mapped region '${groupName}' for ${linkingExercise}.`);
    } catch (e) {
      console.error("Failed to link group:", e);
    }
  };

  const toggleMuscleLink = async (muscleId: string) => {
    if (!linkingExercise || !saveMachineConfig) return;

    const existing = machineConfigs.find(c => c.exercise.toLowerCase() === linkingExercise.toLowerCase());
    const baseWeightLbs = existing?.baseWeightLbs || 0;
    const baseWeightKg = existing?.baseWeightKg || 0;
    const brand = existing?.brand || 'Standard';
    
    const muscleDef = MUSCLES.find(m => m.id === muscleId);
    const type = existing?.type || 'Machine';

    let nextMuscles = [...(existing?.linkedMuscles || [])];
    if (nextMuscles.includes(muscleId)) {
      nextMuscles = nextMuscles.filter(mId => mId !== muscleId);
    } else {
      nextMuscles.push(muscleId);
    }

    const nextGroups = existing?.linkedGroups || [];

    let category = existing?.category || 'Custom';
    if (nextGroups.length > 0) {
      category = nextGroups[0];
    } else if (nextMuscles.length > 0) {
      const firstM = MUSCLES.find(m => m.id === nextMuscles[0]);
      if (firstM) category = firstM.group;
    } else {
      category = 'Custom';
    }

    const variantCategories = existing?.variantCategories || {};

    try {
      if (navigator.vibrate) navigator.vibrate(30);
      await saveMachineConfig(
        linkingExercise,
        baseWeightLbs,
        baseWeightKg,
        brand,
        category,
        variantCategories,
        type,
        undefined,
        nextMuscles,
        nextGroups
      );
      setHintMessage(`Toggled muscle '${muscleDef?.name || muscleId}' for ${linkingExercise}.`);
    } catch (e) {
      console.error("Failed to link muscle:", e);
    }
  };

  // Group Long Press Listeners
  const startGroupPress = (group: string) => {
    isLongPressRef.current = false;
    activePressObjectRef.current = `group:${group}`;
    longPressTimerRef.current = setTimeout(() => {
      isLongPressRef.current = true;
      if (group !== 'All') {
        toggleGroupLink(group);
      }
    }, 550);
  };

  const endGroupPress = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handleGroupClickWithLinking = (groupName: string) => {
    if (isLongPressRef.current) {
      isLongPressRef.current = false;
      return;
    }
    if (linkingExercise && groupName !== 'All') {
      toggleGroupLink(groupName);
    } else {
      handleGroupClick(groupName);
    }
  };

  // Muscle Long Press Listeners
  const startMusclePress = (muscleId: string) => {
    isLongPressRef.current = false;
    activePressObjectRef.current = `muscle:${muscleId}`;
    longPressTimerRef.current = setTimeout(() => {
      isLongPressRef.current = true;
      toggleMuscleLink(muscleId);
    }, 550);
  };

  const endMusclePress = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handleMuscleClickWithLinking = (muscleId: string) => {
    if (isLongPressRef.current) {
      isLongPressRef.current = false;
      return;
    }

    if (linkingExercise) {
      toggleMuscleLink(muscleId);
    } else {
      handleMuscleClick(muscleId);
    }
  };

  useEffect(() => {
    if (initialShowFatigue !== undefined) {
      setShowFatigue(initialShowFatigue);
    }
  }, [initialShowFatigue]);

  const [showSkeleton, setShowSkeleton] = useState<boolean>(false);
  const [isRotating, setIsRotating] = useState<boolean>(true);
  const [hintMessage, setHintMessage] = useState<string>('Click muscles to trigger HUD analysis.');

  const [currentYaw, setCurrentYaw] = useState<number>(0.3);

  const lastMousePos = useRef({ x: 0, y: 0 });
  const mouseDownPos = useRef({ x: 0, y: 0 });
  const isUserInteracting = useRef(false);
  const targetRotation = useRef({ yaw: 0.3, pitch: 0.05 });
  const targetZoom = useRef(0.55);
  const targetYOffset = useRef(0.0);

  const fatigueScores = useMemo(() => {
    if (!sets || !machineConfigs) return {};
    return calculateFatigueScores(sets, machineConfigs);
  }, [sets, machineConfigs]);

  const activeMuscle = useMemo(() => {
    if (!selectedMuscleId) return undefined;
    const found = MUSCLES.find(m => m.id === selectedMuscleId);
    if (found) return found;
    // Fallback for custom muscles found in limb models
    return {
      id: selectedMuscleId,
      name: selectedMuscleId.replace(/[_-]/g, ' ').toUpperCase(),
      latinName: 'm. ' + selectedMuscleId.toLowerCase(),
      group: 'Arms' as any,
      isDeep: false,
      isSymmetric: false,
      description: 'Automatically highlighted auxiliary muscle structure.',
      bestAngle: { yaw: 0, pitch: 0, zoom: 4.4, targetY: 60 },
      points: []
    } as MuscleDefinition;
  }, [selectedMuscleId]);

  useEffect(() => {
    if (activeMuscle && activeMuscle.bestAngle) {
      targetRotation.current = { yaw: activeMuscle.bestAngle.yaw, pitch: activeMuscle.bestAngle.pitch };
      targetZoom.current = activeMuscle.bestAngle.zoom;
      targetYOffset.current = activeMuscle.bestAngle.targetY;
      setIsRotating(false);
    } else if (selectedGroup && selectedGroup !== 'All') {
      let gYaw = 0.3;
      let gPitch = 0.05;
      let gZoom = 2.0;
      let gY = 20;

      switch (selectedGroup) {
        case 'Chest':
          gYaw = 0; gPitch = 0; gZoom = 3.2; gY = 75; break;
        case 'Back':
          gYaw = Math.PI; gPitch = 0; gZoom = 2.8; gY = 70; break;
        case 'Shoulders':
          gYaw = 0.4; gPitch = 0.1; gZoom = 3.5; gY = 90; break;
        case 'Arms':
          gYaw = 0.5; gPitch = 0.1; gZoom = 3.0; gY = 60; break;
        case 'Core':
          gYaw = 0; gPitch = 0; gZoom = 3.2; gY = 45; break;
        case 'Legs':
          gYaw = 0; gPitch = -0.15; gZoom = 2.2; gY = -20; break;
        case 'Glutes':
          gYaw = Math.PI; gPitch = 0; gZoom = 3.0; gY = 20; break;
      }

      targetRotation.current = { yaw: gYaw, pitch: gPitch };
      targetZoom.current = gZoom;
      targetYOffset.current = gY;
      setIsRotating(false);
    } else {
      // All
      targetRotation.current = { yaw: 0.3, pitch: 0.05 };
      targetZoom.current = 0.55;
      targetYOffset.current = 0.0;
      setIsRotating(true);
    }
  }, [activeMuscle, selectedGroup]);

  const stateRef = useRef({
    selectedGroup,
    selectedMuscleId,
    showFatigue,
    showSkeleton,
    isRotating,
    fatigueScores
  });

  useEffect(() => {
    stateRef.current = {
      selectedGroup,
      selectedMuscleId,
      showFatigue,
      showSkeleton,
      isRotating,
      fatigueScores
    };
  }, [selectedGroup, selectedMuscleId, showFatigue, showSkeleton, isRotating, fatigueScores]);

  useEffect(() => {
    const canvasWebGL = canvasRef.current;
    const canvas2D = canvas2DRef.current;
    if (!canvasWebGL || !canvas2D) return;

    const renderer = new THREE.WebGLRenderer({
      canvas: canvasWebGL,
      antialias: false // disable antialias for post-processing if needed, but we keep it here if composer supports it, though false is safer for bloom performance
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x020617);
    scene.fog = new THREE.FogExp2(0x020617, 0.0025);

    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
    renderedCameraRef.current = camera;

    // Setup Post-Processing (Bloom)
    const renderScene = new RenderPass(scene, camera);
    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth || 800, window.innerHeight || 600),
      1.2,  // strength
      0.5,  // radius
      0.8   // threshold
    );
    const composer = new EffectComposer(renderer);
    composer.addPass(renderScene);
    composer.addPass(bloomPass);

    const glbModelsGroup = new THREE.Group();
    scene.add(glbModelsGroup);

    const globalShaderUniforms = {
      uTime: { value: 0.0 }
    };
    
    let muscleMeshes: any[] = [];
    renderedMeshesRef.current = [];

    let loadedCount = 0;
    const TOTAL_MODELS = 3;

    const glTfMaterial = new THREE.ShaderMaterial({
      vertexShader: holographicVertexShader,
      fragmentShader: skeletonFragmentShader,
      uniforms: {
        uColor: { value: new THREE.Color(0x67e8f9) }, // Ghostly cyan x-ray
        uOpacity: { value: 0.3 }
      },
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false, 
      blending: THREE.AdditiveBlending 
    });
    
    const getMuscleIdFromName = (name: string): string | null => {
      const n = name.toLowerCase().replace(/_/g, ' ');
      
      // Direct Node Name Mapping
      if (n.includes('pectoralis minor')) return 'pectoralis_minor';
      if (n.includes('pectoralis major')) return 'pectoralis_major';
      if (n.includes('serratus anterior')) return 'serratus_anterior';
      if (n.includes('subclavius')) return 'pectoralis_minor'; 
      
      // Shoulders
      if (n.includes('deltoid anterior') || n.includes('clavicular') || n.includes('acromial')) return 'deltoid_anterior';
      if (n.includes('deltoid posterior') || n.includes('spinal part of deltoid')) return 'deltoid_posterior';
      if (n.includes('deltoid')) return 'deltoid_lateral';
      if (n.includes('supraspinatus')) return 'rotator_cuff';
      if (n.includes('infraspinatus')) return 'rotator_cuff';
      if (n.includes('subscapularis')) return 'rotator_cuff';
      if (n.includes('teres major')) return 'rotator_cuff';
      if (n.includes('teres minor')) return 'rotator_cuff';
      
      // Neck & Core
      if (n.includes('sternocleidomastoid')) return 'sternocleidomastoid';
      if (n.includes('rectus abdominis')) return 'rectus_abdominis';
      if (n.includes('obliquus externus abdominis')) return 'obliques';
      if (n.includes('transversus abdominis')) return 'transversus_abdominis';
      if (n.includes('iliopsoas')) return 'iliopsoas';
      
      // Back
      if (n.includes('trapezius')) return 'trapezius_upper';
      if (n.includes('latissimus dorsi')) return 'latissimus_dorsi';
      if (n.includes('rhomboid major')) return 'rhomboideus_major';
      if (n.includes('rhomboid minor')) return 'rhomboideus_major'; // Map minor to major for simplicity
      if (n.includes('erector spinae')) return 'erector_spinae';
      if (n.includes('splenius capitis')) return 'splenius_capitis';
      
      // Arms
      if (n.includes('biceps brachii')) return 'biceps_brachii';
      if (n.includes('brachialis')) return 'brachialis';
      if (n.includes('triceps brachii')) return 'triceps_brachii';
      
      // Forearms & Hand
      if (n.includes('extensor carpi') || n.includes('extensor digitorum') || n.includes('brachioradialis')) return 'forearm_extensors';
      if (n.includes('flexor carpi') || n.includes('flexor digitorum') || n.includes('pronator')) return 'forearm_flexors';

      // Glutes & Deep Hip
      if (n.includes('gluteus maximus')) return 'gluteus_maximus';
      if (n.includes('gluteus medius')) return 'gluteus_medius';
      if (n.includes('gluteus minimus')) return 'gluteus_minimus';
      if (n.includes('piriformis') || n.includes('gemellus') || n.includes('obturator')) return 'gluteus_minimus'; 
      if (n.includes('tensor fasciae latae')) return 'gluteus_minimus'; // Adding missing muscle
      
      // Legs (Thighs)
      if (n.includes('quadriceps') || n.includes('rectus femoris') || n.includes('vastus')) return 'quadriceps_femoris';
      if (n.includes('semimembranosus') || n.includes('semitendinosus') || n.includes('biceps femoris')) return 'hamstrings';
      if (n.includes('adductor longus') || n.includes('adductor brevis') || n.includes('adductor magnus') || n.includes('gracilis') || n.includes('pectineus')) return 'adductors';
      if (n.includes('sartorius')) return 'sartorius';
      
      // Calves & Foot
      if (n.includes('gastrocnemius')) return 'gastrocnemius';
      if (n.includes('soleus') || n.includes('popliteus')) return 'soleus';
      if (n.includes('tibialis anterior')) return 'tibialis_anterior';
      if (n.includes('tibialis posterior')) return 'soleus';
      if (n.includes('fibularis') || n.includes('peroneus')) return 'fibularis';
      
      return null;
    };

    const skeletonMeshNames = new Set<string>();

    const processGLBScene = (sceneGroup: THREE.Group, isMirrored: boolean) => {
      sceneGroup.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const mesh = child as THREE.Mesh;
          
          let meshNodeName = mesh.name;
          if (meshNodeName.startsWith('mesh.') && mesh.parent && mesh.parent.name && mesh.parent.name !== 'Scene') {
            meshNodeName = mesh.parent.name;
          }

          let muscleId = getMuscleIdFromName(meshNodeName);
          let shouldHide = false;
          const lowerName = meshNodeName.toLowerCase();

          // Hide unnecessary connective tissue and nerves
          if (lowerName.includes('fascia') || 
              lowerName.includes('nerve') || 
              lowerName.includes('artery') || 
              lowerName.includes('vein') || 
              lowerName.includes('bursa') || 
              lowerName.includes('ligament') || 
              lowerName.includes('retinaculum') || 
              lowerName.includes('aponeurosis') || 
              lowerName.includes('sheath') ||
              lowerName.includes('vessel') ||
              lowerName.includes('tract') ||
              lowerName.includes('cartilage')) {
            shouldHide = true;
          }

          // If mirrored, hide central spine/skull elements so they don't duplicate and z-fight
          if (isMirrored) {
            if (lowerName.includes('spine') || 
                lowerName.includes('vertebra') || 
                lowerName.includes('sternum') || 
                lowerName.includes('sacrum') || 
                lowerName.includes('coccyx') || 
                lowerName.includes('skull') ||
                lowerName.includes('atlas') ||
                lowerName.includes('axis') ||
                lowerName.includes('bone') && (lowerName.includes('frontal') || lowerName.includes('occipital'))) {
              shouldHide = true;
            }
          }

          if (shouldHide) {
            mesh.visible = false;
            return;
          }

          if (!muscleId) {
            // It's a bone! Render it as skeleton
            mesh.material = glTfMaterial;
          } else {
            // It's a muscle!
            const mDef = MUSCLES.find(m => m.id === muscleId);
            const groupId = mDef ? mDef.group : 'Arms';
            const effectiveId = muscleId;
            
            const isLeftSide = isMirrored || meshNodeName.toLowerCase().includes('left');
            let existingEntry = muscleMeshes.find(m => m.id === effectiveId);
            let uniqueMat: THREE.ShaderMaterial | null = null;
            
            if (existingEntry) {
              if (isLeftSide && existingEntry.matLeft) uniqueMat = existingEntry.matLeft;
              if (!isLeftSide && existingEntry.matRight) uniqueMat = existingEntry.matRight;
            }

            if (!uniqueMat) {
               uniqueMat = new THREE.ShaderMaterial({
                 vertexShader: holographicVertexShader,
                 fragmentShader: holographicFragmentShader,
                 uniforms: {
                   uTime: globalShaderUniforms.uTime,
                   uColor: { value: new THREE.Color(0x44aadd) },
                   uBaseColor: { value: new THREE.Color(getBaseMuscleColor(groupId, effectiveId)) },
                   uOpacity: { value: 0.15 },
                   uIsLinked: { value: 0.0 },
                   uEmissiveIntensity: { value: 0.4 },
                   uEmissiveColor: { value: new THREE.Color(getBaseMuscleColor(groupId, effectiveId)) } 
                 },
                 transparent: true,
                 side: THREE.DoubleSide,
                 depthWrite: true,
                 blending: THREE.NormalBlending
               });
            }
            mesh.material = uniqueMat;
            
            mesh.userData = { muscleId };
            
            if (!existingEntry) {
              existingEntry = {
                id: muscleId,
                group: groupId,
                isDeep: mDef ? mDef.isDeep : false,
                meshRight: isLeftSide ? null : mesh,
                meshLeft: isLeftSide ? mesh : null,
                matRight: isLeftSide ? null : uniqueMat,
                matLeft: isLeftSide ? uniqueMat : null
              };
              muscleMeshes.push(existingEntry);
            } else {
              if (isLeftSide) {
                existingEntry.meshLeft = mesh;
                existingEntry.matLeft = uniqueMat;
              } else {
                existingEntry.meshRight = mesh;
                existingEntry.matRight = uniqueMat;
              }
            }
          }
          renderedMeshesRef.current.push(mesh);
          mesh.updateMatrixWorld();
        }
      });
      glbModelsGroup.add(sceneGroup);
    };

    let skelCenterX = 0;

    const applyScaleAndPosition = () => {
      glbModelsGroup.position.set(0, 0, 0);
      glbModelsGroup.scale.set(1, 1, 1);
      glbModelsGroup.rotation.set(0, 0, 0);
      glbModelsGroup.updateMatrixWorld(true);

      const box = new THREE.Box3().setFromObject(glbModelsGroup);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      skelCenterX = center.x; // Capture the skeleton's actual center for mirroring

      console.log('Avatar bounding box before scaling:', { size, center });

      const maxDim = Math.max(size.x, size.y, size.z);
      const targetMaxDim = 200; 
      const targetCenter = new THREE.Vector3(0, 10, 0); 

      if (maxDim > 0) {
        const scale = targetMaxDim / maxDim; 
        
        glbModelsGroup.scale.set(scale, scale, scale);
        
        const scaledCenter = center.clone().multiplyScalar(scale);
        glbModelsGroup.position.set(
          0, // Keep true midline at 0 instead of targetCenter.x - scaledCenter.x
          targetCenter.y - scaledCenter.y,
          targetCenter.z - scaledCenter.z
        );
      }
    };

    const generateProxyThorax = () => {
      const thoraxGroup = new THREE.Group();
      thoraxGroup.name = "proxy_thorax";
      const baseMat = new THREE.MeshStandardMaterial({ color: 0x888888 });

      // We use real skeleton coordinates (meters)
      const abGeo = new THREE.BoxGeometry(1, 1, 1, 4, 4, 4);
      
      const positionAttribute = abGeo.attributes.position;
      for (let i = 0; i < positionAttribute.count; i++) {
        const x = positionAttribute.getX(i);
        const y = positionAttribute.getY(i);
        const z = positionAttribute.getZ(i);
        
        // Front face curves outward (creates the muscle belly bulge)
        const isFront = z > 0;
        const bulge = isFront ? Math.cos(x * Math.PI) * Math.cos(y * Math.PI) * 0.35 : 0;
        positionAttribute.setZ(i, z * 0.4 + bulge);
      }
      abGeo.computeVertexNormals();

      // Top to bottom (i = 0 is top, i = 3 is bottom)
      // Anchor top to Xiphoid (Y = 1.24, Z = 0.11)
      // Anchor bottom to Pubis (Y = 0.81, Z = 0.05)
      
      for (let i = 0; i < 4; i++) {
        // Interpolate from top to bottom
        const t = i / 3.0; // 0.0 (top) to 1.0 (bottom)
        
        // Y position: Move slightly lower to align perfectly with the blue dot (Local Y=0.98)
        // Top: 1.14 (below pecs), Bottom: 0.82 (pubis)
        const yPos = 1.14 - (t * 0.32); 
        
        // Width tapers from top to bottom, slightly wider to match muscular physique
        const wScale = 0.065 - (t * 0.030); 
        
        // Height: ~0.10 per segment
        const hScale = i === 3 ? 0.12 : 0.095;
        
        // Z position: ensure it sits in front of the skeleton and blends with pecs
        // Top sits slightly behind pecs (0.12), Middle bulges (0.15), Bottom tucks in (0.07)
        const zPos = 0.04 + Math.sin(t * Math.PI) * 0.02 - (t * 0.01);
        
        // X position: distance from midline. Make them touch each other.
        const xPos = (wScale / 2) - 0.003;
        
        // Pitch: Angle of the surface. 
        // Top should lean FORWARD to match ribcage slope (positive rotX)
        // Bottom should lean BACK slightly
        const rotX = 0.10 - (t * 0.20);
        
        // Yaw: Wrap around the belly
        const rotY = 0.20 - (t * 0.08);

        const abR = new THREE.Mesh(abGeo, baseMat);
        abR.name = `Rectus Abdominis Right ${i}`;
        // Make them slightly thicker to look muscular (0.035)
        abR.scale.set(wScale, hScale, 0.035);
        abR.position.set(xPos, yPos, zPos);
        abR.rotation.set(rotX, rotY, 0.02);
        thoraxGroup.add(abR);
        
        const abL = new THREE.Mesh(abGeo, baseMat);
        abL.name = `Rectus Abdominis Left ${i}`;
        abL.scale.set(wScale, hScale, 0.035);
        abL.position.set(-xPos, yPos, zPos);
        abL.rotation.set(rotX, -rotY, -0.02);
        thoraxGroup.add(abL);
      }

      // Add Transversus/Oblique proxy padding on the sides
      // Capsule: radius, length, capSegments, radialSegments
      const obliqueGeo = new THREE.CapsuleGeometry(0.045, 0.22, 4, 8); 
      
      const oblR = new THREE.Mesh(obliqueGeo, baseMat);
      oblR.name = "Obliques Right";
      oblR.position.set(0.11, 0.98, 0.03);
      oblR.rotation.set(0.05, 0, 0.20); // Lean outward
      thoraxGroup.add(oblR);
      
      const oblL = new THREE.Mesh(obliqueGeo, baseMat);
      oblL.name = "Obliques Left";
      oblL.position.set(-0.11, 0.98, 0.03);
      oblL.rotation.set(0.05, 0, -0.20);
      thoraxGroup.add(oblL);

      return thoraxGroup;
    };

    const loadGLBSequentially = async () => {
      try {
        setAvatarLoading(true);
        setAvatarLoadingStage('Loading Upper Biomechanical Chain...');
        console.log('Loading full upper limb...');
        const upperGltf = await loadCachedGLB('/models/upper-limb.glb');
        const upperClone = upperGltf.scene.clone();
        processGLBScene(upperClone, false);
        
        const upperMirrored = upperClone.clone();
        upperMirrored.scale.x = -1;
        processGLBScene(upperMirrored, true);
        
        setAvatarLoadingStage('Loading Lower Kinetic Chain...');
        console.log('Loading full lower limb...');
        const lowerGltf = await loadCachedGLB('/models/lower-limb.glb');
        const lowerClone = lowerGltf.scene.clone();
        processGLBScene(lowerClone, false);
        
        const lowerMirrored = lowerClone.clone();
        lowerMirrored.scale.x = -1;
        processGLBScene(lowerMirrored, true);
        
        setAvatarLoadingStage('Synthesizing Core Hologram...');
        // Restore procedural parts that were missing in the original models
        const proceduralThorax = generateProxyThorax();
        proceduralThorax.scale.set(1, 1, 1);
        proceduralThorax.position.set(0, 0, 0);
        proceduralThorax.rotation.set(0, 0, 0);
        processGLBScene(proceduralThorax, false);

        // Base layer is ready, scale and position the whole setup
        applyScaleAndPosition();

        setAvatarLoading(false);
      } catch (error) {
        console.warn('GLB loading failed, rendering procedural core fallback.', error);
        const proceduralThorax = generateProxyThorax();
        proceduralThorax.scale.set(1, 1, 1);
        proceduralThorax.position.set(0, 0, 0);
        proceduralThorax.rotation.set(0, 0, 0);
        processGLBScene(proceduralThorax, false);
        applyScaleAndPosition();
        setAvatarLoading(false);
      }
    };

    loadGLBSequentially();
    
    loadCustomGLBRef.current = (url: string) => {
      globalGLTFLoader.load(url, (gltf) => {
        processGLBScene(gltf.scene, false);
      }, undefined, (err) => {
        console.error('Failed to load custom GLB:', url, err);
      });
    };

    const HUD_LABELS = [
      { id: 'hud_deltoid_R', name: 'M. DELTOIDEUS (R)', subName: 'Anterior Shoulder', worldPt: new THREE.Vector3(19.5, 52, 4.0), side: 'R' },
      { id: 'hud_deltoid_L', name: 'M. DELTOIDEUS (L)', subName: 'Anterior Shoulder', worldPt: new THREE.Vector3(-19.5, 52, 4.0), side: 'L' },
      { id: 'hud_pectoralis', name: 'M. PECTORALIS MAJOR', subName: 'Chest Muscle', worldPt: new THREE.Vector3(7.5, 46, 10.0), side: 'R' },
      { id: 'hud_trapezius', name: 'M. TRAPEZIUS', subName: 'Trapezius Plates', worldPt: new THREE.Vector3(5.0, 56, -5.0), side: 'R' },
      { id: 'hud_scm_R', name: 'M. STERNOCLEIDOMASTOIDEUS (R)', subName: 'Sternocleidomastoid Neck', worldPt: new THREE.Vector3(2.5, 67, 3.5), side: 'R' },
      { id: 'hud_biceps', name: 'M. BICEPS BRACHII', subName: 'Biceps Brachii', worldPt: new THREE.Vector3(19.5, 42, 3.0), side: 'R' },
      { id: 'hud_rectus', name: 'M. RECTUS ABDOMINIS', subName: 'Core Abdominals', worldPt: new THREE.Vector3(0, 25, 9.0), side: 'R' },
      { id: 'hud_latissimus', name: 'M. LATISSIMUS DORSI', subName: 'Latissimus Dorsi', worldPt: new THREE.Vector3(11.0, 31, -7.0), side: 'R' },
      { id: 'hud_gluteus', name: 'M. GLUTEUS MAXIMUS', subName: 'Gluteus Maximus', worldPt: new THREE.Vector3(8.0, -10, -8.5), side: 'R' },
      { id: 'hud_quads_R', name: 'M. QUADRICEPS (R)', subName: 'Quadriceps Thigh', worldPt: new THREE.Vector3(6.0, -25, 5.5), side: 'R' },
      { id: 'hud_quads_L', name: 'M. QUADRICEPS (L)', subName: 'Quadriceps Thigh', worldPt: new THREE.Vector3(-6.0, -25, 5.5), side: 'L' },
      { id: 'hud_edb_R', name: 'M. EXTENSOR DIGITORUM BREVIS', subName: 'Intrinsic Foot Muscle', worldPt: new THREE.Vector3(5.4, -99, 3.8), side: 'R' },
      { id: 'hud_calves', name: 'M. GASTROCNEMIUS', worldPt: new THREE.Vector3(5.5, -65, -3.5), subName: 'Gastrocnemius Calf', side: 'R' }
    ];

    const handleResize = () => {
      const rect = containerRef.current?.getBoundingClientRect();
      const w = Math.floor(rect?.width || containerRef.current?.clientWidth || 0);
      const h = Math.floor(rect?.height || containerRef.current?.clientHeight || 0);
      if (w < 20 || h < 20) return;

      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      canvasWebGL.width = w * dpr;
      canvasWebGL.height = h * dpr;
      canvas2D.width = w * dpr;
      canvas2D.height = h * dpr;

      renderer.setSize(w, h, false);
      composer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    
    handleResize();
    window.addEventListener('resize', handleResize);

    const resizeObserver = new ResizeObserver(() => {
      window.requestAnimationFrame(() => handleResize());
    });
    if (containerRef.current) resizeObserver.observe(containerRef.current);

    const raycaster = new THREE.Raycaster();
    const timer = new THREE.Timer();
    timer.connect(document);

    let frameId: number;

    const targetLookAt = new THREE.Vector3(0, 0, 0);
    const cameraWorldPos = new THREE.Vector3();
    const nodeV = new THREE.Vector3();
    
    // Cinematic initial camera position for dramatic reveal
    let currentRot = { yaw: -Math.PI, pitch: 0.2 };
    let currentZoom = 0.05; // starts very zoomed out
    let currentYOff = -15; // starts lower
    
    const pCount = 50;
    const pGeometry = new THREE.BufferGeometry();
    const pPositions = new Float32Array(pCount * 3);
    const pSpeeds = new Float32Array(pCount);
    const pOffsets = new Float32Array(pCount);
    const basePodiumY = -90;

    for (let i = 0; i < pCount; i++) {
        const rad = Math.random() * 32;
        const angle = Math.random() * Math.PI * 2;
        pPositions[i * 3] = rad * Math.cos(angle);
        pPositions[i * 3 + 1] = basePodiumY + Math.random() * 80;
        pPositions[i * 3 + 2] = rad * Math.sin(angle);
        pSpeeds[i] = 0.05 + Math.random() * 0.1;
        pOffsets[i] = Math.random() * Math.PI * 2;
    }
    pGeometry.setAttribute('position', new THREE.BufferAttribute(pPositions, 3));
    
    const pMaterial = new THREE.PointsMaterial({
      color: 0x44aadd,
      size: 1.5,
      transparent: true,
      opacity: 0.4,
      blending: THREE.AdditiveBlending
    });
    const particles = new THREE.Points(pGeometry, pMaterial);
    scene.add(particles);

    const ringGeo = new THREE.CylinderGeometry(32, 40, 4, 64);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x44aadd, transparent: true, opacity: 0.15, wireframe: true });
    const ringGroup = new THREE.Mesh(ringGeo, ringMat);
    ringGroup.position.y = basePodiumY - 2;
    scene.add(ringGroup);

    const ringSolidGeo = new THREE.CylinderGeometry(32, 40, 4, 64);
    const ringSolidMat = new THREE.MeshBasicMaterial({ color: 0x0f2c4d, transparent: true, opacity: 0.4 });
    const ringSolid = new THREE.Mesh(ringSolidGeo, ringSolidMat);
    ringSolid.position.y = basePodiumY - 2;
    scene.add(ringSolid);

    let wasHidden = false;
    const renderLoop = () => {
      const ctx2D = canvas2D.getContext('2d');
      if (!ctx2D) return;

      if (containerRef.current && containerRef.current.offsetParent === null) {
        wasHidden = true;
        frameId = requestAnimationFrame(renderLoop);
        return;
      }
      if (wasHidden) {
        wasHidden = false;
        handleResize();
      }

      timer.update();
      const elapsed = timer.getElapsed();
      globalShaderUniforms.uTime.value = elapsed;
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const w = canvasWebGL.width; const h = canvasWebGL.height;
      const cx = w / 2;
      const cy = h / 2;

      const { 
        selectedGroup: sGroup, 
        selectedMuscleId: sMuscleId, 
        showFatigue: sFatigue, 
        showSkeleton: sSkeleton,
        isRotating: sRotating, 
        fatigueScores: fScores 
      } = stateRef.current;

      const isSkeletonVisible = sSkeleton;
      glbModelsGroup.traverse(child => {
        if ((child as THREE.Mesh).isMesh) {
          if (!(child as THREE.Mesh).userData.muscleId) {
            // It's a bone/skeleton piece
            child.visible = isSkeletonVisible;
          }
        }
      });

      if (sRotating && !isUserInteracting.current) {
        targetRotation.current.yaw += 0.005;
      }

      currentRot.yaw += (targetRotation.current.yaw - currentRot.yaw) * 0.12;
      currentRot.pitch += (targetRotation.current.pitch - currentRot.pitch) * 0.12;
      currentZoom += (targetZoom.current - currentZoom) * 0.12;
      currentYOff += (targetYOffset.current - currentYOff) * 0.12;

      setCurrentYaw(currentRot.yaw % (Math.PI * 2));

      const radius = 175 / currentZoom;
      camera.position.x = radius * Math.sin(currentRot.yaw) * Math.cos(currentRot.pitch);
      camera.position.z = radius * Math.cos(currentRot.yaw) * Math.cos(currentRot.pitch);
      camera.position.y = radius * Math.sin(currentRot.pitch) + currentYOff;
      
      targetLookAt.set(0, currentYOff, 0);
      camera.lookAt(targetLookAt);

      muscleMeshes.forEach(item => {
         const isFocusedGroup = sGroup === 'All' || item.group === sGroup;
         const fatigue = fScores[item.id] !== undefined ? fScores[item.id] : (fScores[item.group] || 0);
         const isFocusedMuscle = sMuscleId === item.id;
         const isMuscleLinked = linkingExercise ? (linkedMuscles.includes(item.id) || linkedGroups.includes(item.group)) : false;
 
         let baseOpacity = 0.85; 
         if (isFocusedGroup) {
           baseOpacity = isFocusedMuscle ? 1.0 : 0.8;
         } else if (sMuscleId !== null) {
           baseOpacity = sFatigue ? 0.6 : 0.25; 
         } else if (sFatigue) {
           baseOpacity = 0.9;
         }

         if (linkingExercise) {
           baseOpacity = isMuscleLinked ? 1.0 : 0.15;
         }
 
         const isAnimating = (linkingExercise && isMuscleLinked) || (!linkingExercise && sFatigue && fatigue > 0.70);
         const stateHash = `${baseOpacity}-${linkingExercise}-${isMuscleLinked}-${sFatigue}-${fatigue}-${isFocusedMuscle}`;

    const nid = item.id.toLowerCase();
    const isVein = nid.includes('vein');
    const isArtery = nid.includes('arter') || nid.includes('vessel') || nid.includes('blood');

    const updateSideMat = (mat: THREE.ShaderMaterial & { _lastStateHash?: string }, sideFatigue: number) => {
      const isSideAnimating = (linkingExercise && isMuscleLinked) || (!linkingExercise && sFatigue && sideFatigue > 0.70);
      const sideStateHash = `${baseOpacity}-${linkingExercise}-${isMuscleLinked}-${sFatigue}-${sideFatigue}-${isFocusedMuscle}`;
      if (mat._lastStateHash === sideStateHash && !isSideAnimating) {
        return; 
      }
      mat._lastStateHash = sideStateHash;

      mat.uniforms.uOpacity.value = baseOpacity;
      mat.uniforms.uIsLinked.value = isMuscleLinked ? 1.0 : 0.0;
      
      if (isVein || isArtery) {
        const vColor = isVein ? 0x00ffff : 0xff0000;
        mat.uniforms.uBaseColor.value.setHex(vColor);
        mat.uniforms.uEmissiveColor.value.setHex(vColor);
        mat.uniforms.uColor.value.setHex(vColor);
        mat.uniforms.uEmissiveIntensity.value = 0.8;
        return;
      }

      if (linkingExercise) {
        if (isMuscleLinked) {
          const pulse = 1.0 + 0.45 * Math.sin(elapsed * 4.5);
          mat.uniforms.uBaseColor.value.setHex(0xf59e0b);
          mat.uniforms.uEmissiveColor.value.setHex(0xf59e0b);
          mat.uniforms.uColor.value.setHex(0xf59e0b);
          mat.uniforms.uEmissiveIntensity.value = 1.5 * pulse;
        } else {
          mat.uniforms.uBaseColor.value.setHex(0x1e293b);
          mat.uniforms.uEmissiveColor.value.setHex(0x1e293b);
          mat.uniforms.uColor.value.setHex(0x44aadd);
          mat.uniforms.uEmissiveIntensity.value = 0.05;
        }
      } else if (!sFatigue) {
        const baseColor = getBaseMuscleColor(item.group, item.id);
        mat.uniforms.uBaseColor.value.setHex(baseColor);
        mat.uniforms.uEmissiveColor.value.setHex(baseColor);
        mat.uniforms.uColor.value.setHex(0x44aadd);
        if (isFocusedMuscle) {
          mat.uniforms.uEmissiveIntensity.value = 1.6;
        } else {
          mat.uniforms.uEmissiveIntensity.value = 0.65;
        }
      } else {
        if (sideFatigue <= 0.05) {
          const healedColor = 0x0ea5e9; // Cyan/blue resting color instead of the base thematic orange
          const dimHealedColor = 0x0369a1;
          if (isFocusedMuscle) {
            mat.uniforms.uColor.value.setHex(0x38bdf8);
            mat.uniforms.uBaseColor.value.setHex(healedColor);
            mat.uniforms.uEmissiveColor.value.setHex(healedColor);
            mat.uniforms.uEmissiveIntensity.value = 1.6;
          } else {
            mat.uniforms.uColor.value.setHex(0x0284c7);
            mat.uniforms.uBaseColor.value.setHex(dimHealedColor);
            mat.uniforms.uEmissiveColor.value.setHex(dimHealedColor);
            mat.uniforms.uEmissiveIntensity.value = 0.55;
          }
        } else if (sideFatigue <= 0.35) {
          mat.uniforms.uColor.value.setHex(0x8b5cf6);
          mat.uniforms.uBaseColor.value.setHex(0x8b5cf6);
          mat.uniforms.uEmissiveColor.value.setHex(0x8b5cf6);
          mat.uniforms.uEmissiveIntensity.value = isFocusedMuscle ? 2.0 : 1.2;
        } else if (sideFatigue <= 0.70) {
          mat.uniforms.uColor.value.setHex(0xf97316);
          mat.uniforms.uBaseColor.value.setHex(0xf97316);
          mat.uniforms.uEmissiveColor.value.setHex(0xf97316);
          mat.uniforms.uEmissiveIntensity.value = isFocusedMuscle ? 2.5 : 1.5;
        } else {
          const pulse = (0.5 + 0.95 * Math.sin(elapsed * 6.0)) * (isFocusedMuscle ? 2.5 : 1.8);
          mat.uniforms.uColor.value.setHex(0xef4444);
          mat.uniforms.uBaseColor.value.setHex(0xef4444);
          mat.uniforms.uEmissiveColor.value.setHex(0xef4444);
          mat.uniforms.uEmissiveIntensity.value = pulse;
        }
      }
    };

    const fatigueRight = (item.id === 'obliques' && fScores['obliques_right'] !== undefined)
      ? fScores['obliques_right']
      : (fScores[item.id] !== undefined ? fScores[item.id] : (fScores[item.group] || 0));

    const fatigueLeft = (item.id === 'obliques' && fScores['obliques_left'] !== undefined)
      ? fScores['obliques_left']
      : (fScores[item.id] !== undefined ? fScores[item.id] : (fScores[item.group] || 0));

    if (item.matRight) updateSideMat(item.matRight, fatigueRight);
    if (item.matLeft) updateSideMat(item.matLeft, fatigueLeft);
      });

      // 3. UPDATE FLOATING MICRO PARTICLES
      const pos = pGeometry.attributes.position.array as Float32Array;
      for (let i = 0; i < pCount; i++) {
        // Drift upwards
        pos[i * 3 + 1] += pSpeeds[i];
        // Dynamic horizontal oscillation
        pos[i * 3]     += Math.sin(pos[i * 3 + 1] * 0.05 + pOffsets[i]) * 0.04;
        pos[i * 3 + 2] += Math.cos(pos[i * 3 + 1] * 0.05 + pOffsets[i]) * 0.04;

        // Reset if float higher than shoulders
        if (pos[i * 3 + 1] > 75) {
          const angle = Math.random() * Math.PI * 2;
          const rad = Math.random() * 32;
          pos[i * 3]     = rad * Math.cos(angle);
          pos[i * 3 + 1] = basePodiumY;
          pos[i * 3 + 2] = rad * Math.sin(angle);
        }
      }
      pGeometry.attributes.position.needsUpdate = true;

      // Spin basic podium helpers
      ringGroup.rotation.y = elapsed * 0.12;
      ringSolid.rotation.y = elapsed * 0.12;

      // Render actual 3D WebGL WebGL frame
      composer.render();

      // --- 4. HIGH-PRECISION 2D DIAGNOSTIC HUD OVERLAY SCAN ---
      ctx2D.clearRect(0, 0, w, h);

      // Subtle tech scanline/coordinates markings in overlay canvas margins
      ctx2D.strokeStyle = 'rgba(6, 182, 212, 0.04)';
      ctx2D.lineWidth = 1 * dpr;
      
      // Draw grid tickers in corners
      const pad = 16 * dpr;
      ctx2D.beginPath();
      // TL corner frame tick
      ctx2D.moveTo(pad, pad + 15 * dpr); ctx2D.lineTo(pad, pad); ctx2D.lineTo(pad + 15 * dpr, pad);
      // TR corner frame tick
      ctx2D.moveTo(w - pad, pad + 15 * dpr); ctx2D.lineTo(w - pad, pad); ctx2D.lineTo(w - pad - 15 * dpr, pad);
      // BL corner frame tick
      ctx2D.moveTo(pad, h - pad - 15 * dpr); ctx2D.lineTo(pad, h - pad); ctx2D.lineTo(pad + 15 * dpr, h - pad);
      // BR corner frame tick
      ctx2D.moveTo(w - pad, h - pad - 15 * dpr); ctx2D.lineTo(w - pad, h - pad); ctx2D.lineTo(w - pad - 15 * dpr, h - pad);
      ctx2D.stroke();

      // Project HUD leader line nodes 3D positions to 2D screen coordinates
      camera.getWorldPosition(cameraWorldPos);
      const camDistSq = cameraWorldPos.length(); // scene is centered at 0,0,0

      const projectedNodes: any[] = [];
      
      HUD_LABELS.forEach(hud => {
        nodeV.copy(hud.worldPt);
        nodeV.project(camera);
        
        // Check if point is behind camera
        if (nodeV.z > 1) return;
        
        const projX = (nodeV.x * 0.5 + 0.5) * w;
        const projY = (-(nodeV.y * 0.5) + 0.5) * h;
        
        projectedNodes.push({ ...hud, projX, projY });
      });

      // Enable Glow for HUD
      ctx2D.shadowBlur = 12;
      ctx2D.shadowColor = sFatigue ? 'rgba(239, 68, 68, 0.8)' : 'rgba(34, 211, 238, 0.8)';
      
      const lhsNodes = projectedNodes.filter(n => n.side === 'L');
      const rhsNodes = projectedNodes.filter(n => n.side === 'R');

      // Render Left-Hand diagnostics labels
      const lhsTextX = 35 * dpr;
      lhsNodes.forEach((node, idx) => {
        const targetTextY = 55 * dpr + idx * (34 * dpr);

        // Vector pointer dot joint
        ctx2D.beginPath();
        ctx2D.arc(node.projX, node.projY, 3.5 * dpr, 0, Math.PI * 2);
        ctx2D.fillStyle = sFatigue ? '#ef4444' : '#22d3ee';
        ctx2D.fill();

        // High gloss node circle rim
        ctx2D.beginPath();
        ctx2D.arc(node.projX, node.projY, 6 * dpr, 0, Math.PI * 2);
        ctx2D.strokeStyle = sFatigue ? 'rgba(239, 68, 68, 0.45)' : 'rgba(34, 211, 238, 0.45)';
        ctx2D.lineWidth = 0.5 * dpr;
        ctx2D.stroke();

        // Laser leader line with 45-degree angle elbow joint
        ctx2D.beginPath();
        ctx2D.moveTo(node.projX, node.projY);
        const elbowX = lhsTextX + 65 * dpr;
        ctx2D.lineTo(elbowX, targetTextY);
        ctx2D.lineTo(lhsTextX, targetTextY);
        ctx2D.strokeStyle = sFatigue ? 'rgba(239, 68, 68, 0.35)' : 'rgba(34, 211, 238, 0.35)';
        ctx2D.lineWidth = 0.75 * dpr;
        ctx2D.stroke();

        // Small bullet icon
        ctx2D.beginPath();
        ctx2D.arc(lhsTextX, targetTextY, 1.5 * dpr, 0, Math.PI * 2);
        ctx2D.fillStyle = sFatigue ? '#f97316' : '#22d3ee';
        ctx2D.fill();

        // Textual readout details (crisp monospace typography)
        ctx2D.font = `bold ${8.5 * dpr}px "JetBrains Mono", monospace`;
        ctx2D.fillStyle = '#ffffff';
        ctx2D.fillText(node.name, lhsTextX + pad, targetTextY - 3 * dpr);

        ctx2D.font = `${6.5 * dpr}px "JetBrains Mono", monospace`;
        ctx2D.fillStyle = sFatigue ? '#f87171' : '#67e8f9';
        ctx2D.fillText(node.subName, lhsTextX + pad, targetTextY + 7 * dpr);
      });

      // Render Right-Hand diagnostics labels
      const rhsTextX = w - 35 * dpr;
      rhsNodes.forEach((node, idx) => {
        const targetTextY = 55 * dpr + idx * (34 * dpr);

        // Vector pointer dot joint
        ctx2D.beginPath();
        ctx2D.arc(node.projX, node.projY, 3.5 * dpr, 0, Math.PI * 2);
        ctx2D.fillStyle = sFatigue ? '#ef4444' : '#22d3ee';
        ctx2D.fill();

        // High gloss node circle rim
        ctx2D.beginPath();
        ctx2D.arc(node.projX, node.projY, 6 * dpr, 0, Math.PI * 2);
        ctx2D.strokeStyle = sFatigue ? 'rgba(239, 68, 68, 0.45)' : 'rgba(34, 211, 238, 0.45)';
        ctx2D.lineWidth = 0.5 * dpr;
        ctx2D.stroke();

        // Laser leader line with 45-degree angle elbow joint
        ctx2D.beginPath();
        ctx2D.moveTo(node.projX, node.projY);
        const elbowX = rhsTextX - 65 * dpr;
        ctx2D.lineTo(elbowX, targetTextY);
        ctx2D.lineTo(rhsTextX, targetTextY);
        ctx2D.strokeStyle = sFatigue ? 'rgba(239, 68, 68, 0.35)' : 'rgba(34, 211, 238, 0.35)';
        ctx2D.lineWidth = 0.75 * dpr;
        ctx2D.stroke();

        // Small bullet icon
        ctx2D.beginPath();
        ctx2D.arc(rhsTextX, targetTextY, 1.5 * dpr, 0, Math.PI * 2);
        ctx2D.fillStyle = sFatigue ? '#f97316' : '#22d3ee';
        ctx2D.fill();

        // Right-aligned technical typography
        ctx2D.textAlign = 'right';
        ctx2D.font = `bold ${8.5 * dpr}px "JetBrains Mono", monospace`;
        ctx2D.fillStyle = '#ffffff';
        ctx2D.fillText(node.name, rhsTextX - pad, targetTextY - 3 * dpr);

        ctx2D.font = `${6.5 * dpr}px "JetBrains Mono", monospace`;
        ctx2D.fillStyle = sFatigue ? '#f87171' : '#67e8f9';
        ctx2D.fillText(node.subName, rhsTextX - pad, targetTextY + 7 * dpr);
        ctx2D.textAlign = 'left'; // Reset left alignment default
      });

      frameId = requestAnimationFrame(renderLoop);
    };

    renderLoop();

    // --- CLEANUP FUNCTION FOR WEBGL MEMORY LEAK PREVENTION ---
    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener('resize', handleResize);
      resizeObserver.disconnect();
      renderedCameraRef.current = null;

      scene.traverse((obj) => {
        if (!(obj instanceof THREE.Mesh)) return;
        
        // DO NOT dispose geometry here so cached GLB model geometries are preserved across mounts!
        if (Array.isArray(obj.material)) {
          obj.material.forEach(m => m.dispose());
        } else if (obj.material) {
          obj.material.dispose();
        }
      });

      // Dispose of systems
      pGeometry.dispose();
      pMaterial.dispose();
      ringGeo.dispose();
      ringMat.dispose();
      
      composer.dispose();
      renderer.dispose();
    };
  }, [gender, genderHipFactor, genderShoulderFactor]); // Redraw geometry when gender morph changes!

  // --- POINTER & WHEEL EVENTS ---
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    isUserInteracting.current = true;
    setIsRotating(false); // suspend auto orbit spin
    lastMousePos.current = { x: e.clientX, y: e.clientY };
    mouseDownPos.current = { x: e.clientX, y: e.clientY };
    
    // Setup 3D mesh long-press timer
    isLongPressRef.current = false;
    const canvas2D = canvas2DRef.current;
    const camera = renderedCameraRef.current;
    const meshes = renderedMeshesRef.current;
    if (canvas2D && camera && meshes && meshes.length > 0) {
      const rect = canvas2D.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;
      const ndcX = (clickX / rect.width) * 2 - 1;
      const ndcY = -(clickY / rect.height) * 2 + 1;
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), camera);
      const intersects = raycaster.intersectObjects(meshes);
      
      const validHit = intersects.find(hit => hit.object.userData && hit.object.userData.muscleId);
      if (validHit) {
        const muscleId = validHit.object.userData.muscleId;
        activePressObjectRef.current = `muscle:${muscleId}`;
        longPressTimerRef.current = setTimeout(() => {
          isLongPressRef.current = true;
          if (linkingExercise) {
            toggleMuscleLink(muscleId);
          }
        }, 550);
      }
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isUserInteracting.current) return;
    const dx = e.clientX - lastMousePos.current.x;
    const dy = e.clientY - lastMousePos.current.y;

    const dragDx = e.clientX - mouseDownPos.current.x;
    const dragDy = e.clientY - mouseDownPos.current.y;
    const dragDist = Math.sqrt(dragDx * dragDx + dragDy * dragDy);
    if (dragDist > 5) {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
    }

    targetRotation.current.yaw += dx * 0.008;
    targetRotation.current.pitch = Math.max(-0.65, Math.min(0.65, targetRotation.current.pitch + dy * 0.008));

    lastMousePos.current = { x: e.clientX, y: e.clientY };
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    // Wheel events usually prevent default automatically in React if non-passive
    // e.preventDefault(); 
    const zoomDelta = e.deltaY * -0.0035;
    targetZoom.current = Math.max(0.35, Math.min(7.5, targetZoom.current + zoomDelta));
  };

  const handlePointerUpOrLeave = (e: React.PointerEvent<HTMLCanvasElement>) => {
    isUserInteracting.current = false;
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }

    if (e.type === 'pointerup') {
      if (isLongPressRef.current) {
        isLongPressRef.current = false;
        return;
      }

      const dragDx = e.clientX - mouseDownPos.current.x;
      const dragDy = e.clientY - mouseDownPos.current.y;
      const dragDist = Math.sqrt(dragDx * dragDx + dragDy * dragDy);
      if (dragDist > 10) {
        return;
      }

      const canvas2D = canvas2DRef.current;
      const camera = renderedCameraRef.current;
      const meshes = renderedMeshesRef.current;
      if (!canvas2D || !camera || !meshes || meshes.length === 0) return;

      const rect = canvas2D.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;

      const ndcX = (clickX / rect.width) * 2 - 1;
      const ndcY = -(clickY / rect.height) * 2 + 1;

      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), camera);

      const intersects = raycaster.intersectObjects(meshes);
      const validHit = intersects.find(hit => hit.object.userData && hit.object.userData.muscleId);

      if (validHit) {
        const optimalId = validHit.object.userData.muscleId;
        if (linkingExercise) {
          toggleMuscleLink(optimalId);
        } else {
          handleMuscleClick(selectedMuscleId === optimalId ? null : optimalId);
        }
      } else {
        handleMuscleClick(null);
      }
    }
  };

  const muscleMeshesRef = useRef(MUSCLES);
  useEffect(() => {
    muscleMeshesRef.current = MUSCLES;
  }, []);

  const handleGroupClick = (group: string) => {
    setSelectedGroup(group);
    setSelectedMuscleId(null); // avoid camera focus conflict
    if (onGroupChange) {
      onGroupChange(group);
    }
  };

  const handleResetCamera = () => {
    targetRotation.current = { yaw: 0.3, pitch: 0.05 };
    targetZoom.current = 0.55;
    targetYOffset.current = 0.0;
    setSelectedMuscleId(null);
    setSelectedGroup('All');
    if (onGroupChange) {
      onGroupChange('All');
    }
    setIsRotating(true);
    setHintMessage('System orbit camera repositioned.');
  };

  const displayedMusclesList = MUSCLES.filter(m => {
    if (linkingExercise && linkedGroups.length > 0) {
      return linkedGroups.includes(m.group) || (selectedGroup !== 'All' && m.group === selectedGroup);
    }
    return selectedGroup === 'All' || m.group === selectedGroup;
  });

  return (
    <div className="border border-slate-800 rounded-3xl p-4 sm:p-6 space-y-6 bg-slate-950 text-slate-100 shadow-[0_0_40px_-10px_rgba(6,182,212,0.15)] transition-all">
      
      {/* Top Controls Box */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div>
          <h3 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <Sparkles className="text-cyan-400 animate-pulse" size={20} />
            Holographic Anatomical Avatar
          </h3>
          <p className="text-xs text-slate-400">
            Interactive 3D WebGL muscular diagnostic platform
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Administrator Menu - Admin Only */}
          {auth.currentUser && (auth.currentUser.email === 'n.lohberger.pro@gmail.com' || auth.currentUser.email === 'lohbergerscholar@gmail.com') && (
            <div className="relative group border-r border-slate-700 pr-3 mr-1">
              <button className="flex items-center gap-2 px-3 py-1.5 bg-slate-900 border border-slate-700 hover:bg-slate-800 text-slate-300 hover:text-cyan-400 text-xs font-bold rounded-xl cursor-pointer transition-colors shadow-sm">
                <span className="text-red-500">⚙️ Admin</span> Menu
              </button>
              <div className="absolute top-full left-0 mt-2 w-48 bg-slate-800 border border-slate-700 rounded-xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 overflow-hidden">
                <label className="flex items-center gap-3 px-4 py-3 hover:bg-slate-700 text-slate-300 hover:text-cyan-400 text-xs font-bold cursor-pointer transition-colors">
                  <Upload size={14} />
                  Upload GLB Model
                  <input 
                    type="file" 
                    accept=".glb,.gltf" 
                    className="hidden" 
                    onChange={handleFileUpload} 
                  />
                </label>
              </div>
            </div>
          )}

          {/* Male / Female Morphing Selector */}
          <div className="flex bg-slate-900 border border-slate-800 p-1 rounded-xl">
          <button
            onClick={() => {
              setGender('male');
              setHintMessage('Adjusted skeleton parameters to male mesomorph ratio.');
            }}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1 ${
              gender === 'male'
                ? 'bg-cyan-500 text-slate-950 shadow-md translate-y-[-1px]'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <User size={13} /> Male
          </button>
          <button
            onClick={() => {
              setGender('female');
              setHintMessage('Adjusted skeleton parameters to female gynomorph ratio.');
            }}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1 ${
              gender === 'female'
                ? 'bg-rose-500 text-white shadow-md translate-y-[-1px]'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <User size={13} /> Female
          </button>
        </div>
      </div>
    </div>

      {linkingExercise && (
        <div className="bg-gradient-to-r from-amber-500/10 via-amber-600/15 to-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 animate-in fade-in slide-in-from-top-3 duration-300 font-sans">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/20 text-amber-400 rounded-xl animate-pulse">
              <Dumbbell size={20} />
            </div>
            <div>
              <p className="text-xs font-mono font-bold uppercase tracking-wider text-amber-500">
                ACTIVE MUSCLE LINKING CONFIGURATOR
              </p>
              <h4 className="text-sm font-black text-white">
                Mapping target fatigue vectors for: <span className="text-amber-400 font-mono underline">{linkingExercise}</span>
              </h4>
              <p className="text-[11px] text-slate-400 mt-1 max-w-xl leading-relaxed">
                Click/long-press any <span className="text-cyan-400 font-semibold">Anatomical Region (Group filter)</span> or specific <span className="text-teal-400 font-semibold">individual muscle</span> on the sidebar list or directly on the 3D avatar scene to bind/unbind it to this equipment.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClearLinking}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 font-black text-xs rounded-xl transition-all shadow-md flex items-center gap-1.5 cursor-pointer whitespace-nowrap self-stretch sm:self-auto justify-center"
          >
            <BookmarkCheck size={14} className="stroke-[3px]" /> Save & Exit Setup
          </button>
        </div>
      )}

      {/* Main Row: 3D Frame and Details sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Hologram visualizer canvas (span 7) */}
        <div ref={containerRef} className="lg:col-span-7 bg-slate-900/40 border border-slate-800/80 rounded-2xl relative overflow-hidden aspect-square flex flex-col min-h-[380px] w-full">
          
          {/* Futuristic Compass Badge */}
          <div className="absolute top-4 left-4 z-10 bg-slate-950/80 backdrop-blur-md px-2.5 py-1.5 rounded-xl border border-slate-800 flex items-center gap-2 text-[10px] font-mono tracking-wider text-cyan-400">
            <Compass size={12} className="animate-spin-slow text-cyan-400" />
            ROT: {currentYaw.toFixed(2)} rad
          </div>

          {/* Quick controls bar */}
          <div className="absolute top-4 right-4 z-10 flex gap-1.5 align-middle items-center">
            <button
              onClick={() => {
                setIsRotating(!isRotating);
              }}
              className={`p-2 rounded-xl border transition-all ${
                isRotating 
                  ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 hover:scale-105' 
                  : 'bg-slate-950/80 text-slate-400 border-slate-800 hover:text-white hover:scale-105'
              }`}
              title={isRotating ? 'Pause auto orbit rotation' : 'Resume auto orbit rotation'}
            >
              <RotateCw size={14} className={isRotating ? 'animate-spin' : ''} />
            </button>

            <button
              onClick={handleResetCamera}
              className="p-2 rounded-xl border bg-slate-950/80 text-slate-400 border-slate-800 hover:text-white hover:scale-105 transition-all"
              title="Reset view angles"
            >
              <Undo size={14} />
            </button>
          </div>

          <div className="relative w-full flex-1">
            {/* Standard 3D WebGL context with interaction handlers */}
            {/* Standard 3D WebGL context */}
            <canvas
              ref={canvasRef}
              className="absolute inset-0 w-full h-full block"
              style={{ display: 'block' }}
            />
            {/* High fidelity diagnostics 2D line overlay */}
            <canvas
              ref={canvas2DRef}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUpOrLeave}
              onPointerLeave={handlePointerUpOrLeave}
              onPointerCancel={handlePointerUpOrLeave}
              onWheel={handleWheel}
              
              className="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing z-5 block touch-none"
              style={{ display: 'block' }}
            />

            {/* Hologram loading telemetry overlay */}
            {avatarLoading && (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-slate-950/70 backdrop-blur-sm pointer-events-none transition-opacity duration-300">
                <div className="relative flex items-center justify-center">
                  <div className="w-14 h-14 rounded-full border-2 border-cyan-500/20 border-t-cyan-400 animate-spin" />
                  <div className="absolute w-9 h-9 rounded-full border-2 border-indigo-500/30 border-b-indigo-400 animate-spin [animation-direction:reverse]" />
                  <Sparkles className="w-4 h-4 text-cyan-400 animate-pulse" />
                </div>
                <p className="mt-4 text-xs font-mono tracking-widest text-cyan-300 uppercase animate-pulse">
                  {avatarLoadingStage}
                </p>
                <p className="mt-1 text-[10px] font-mono text-slate-400">
                  Streaming Biomechanical Geometry
                </p>
              </div>
            )}
          </div>

          {/* Hologram static scanning lines overlay */}
          <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(to_bottom,rgba(255,255,255,0)_97%,rgba(6,182,212,0.02)_97%)] bg-[size:100%_4px]" />

          {/* Fatigue heatmap color gradient legend */}
          {showFatigue && (
            <div className="absolute bottom-4 left-4 right-4 z-10 bg-slate-950/90 backdrop-blur-md px-3 py-2 rounded-xl border border-slate-800/85 text-[10px] font-mono space-y-1.5">
              <div className="flex justify-between text-slate-400">
                <span className="flex items-center gap-1 font-bold text-cyan-400">● Healed</span>
                <span className="text-purple-400">Active</span>
                <span className="text-orange-400">Fatigued</span>
                <span className="flex items-center gap-1 font-bold text-red-500">● REST (Needs recover)</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-gradient-to-r from-cyan-500 via-purple-500 via-orange-500 to-red-500" />
            </div>
          )}

          {/* Drag zoom helper text */}
          <div className="absolute bottom-4 right-4 hidden sm:block text-[9px] text-slate-500 font-mono">
            Scroll to zoom • Drag to orbit
          </div>
        </div>

        {/* Anatomical controls and Details Sidebar (span 5) */}
        <div className="lg:col-span-5 flex flex-col justify-between space-y-4">
          
          <div className="space-y-4">
            {/* Control Toggles */}
            <div className="grid grid-cols-2 gap-4">
              {/* Heatmap switch controls */}
              <div className="flex flex-col justify-between bg-slate-900 border border-slate-800/80 p-3 rounded-2xl">
                <div className="mb-3">
                  <span className="text-xs font-extrabold tracking-wider uppercase text-cyan-400 font-mono flex items-center gap-1.5">
                    <Activity size={14} /> Health
                  </span>
                  <p className="text-[10px] text-slate-400 mt-1 leading-tight">
                    Analyze muscle fatigue
                  </p>
                </div>
                <div className="flex justify-end">
                {/* Toggle slider */}
                <button
                  onClick={() => {
                    setShowFatigue(!showFatigue);
                    setHintMessage(showFatigue ? 'Disabled biology color heatmap overlay.' : 'Loaded localized fatigue analysis heatmap.');
                  }}
                  className={`w-14 h-7 rounded-full transition-all relative p-0.5 ${
                    showFatigue ? 'bg-indigo-500' : 'bg-slate-800'
                  }`}
                >
                  <div className={`w-6 h-6 rounded-full bg-white transition-all transform ${
                    showFatigue ? 'translate-x-7 shadow-lg shadow-indigo-500/50' : 'translate-x-0'
                  }`} />
                </button>
                </div>
              </div>

              {/* Skeleton switch controls */}
              <div className="flex flex-col justify-between bg-slate-900 border border-slate-800/80 p-3 rounded-2xl">
                <div className="mb-3">
                  <span className="text-xs font-extrabold tracking-wider uppercase text-orange-400 font-mono flex items-center gap-1.5">
                    🩻 Skeleton
                  </span>
                  <p className="text-[10px] text-slate-400 mt-1 leading-tight">
                    Show bone structure
                  </p>
                </div>
                <div className="flex justify-end">
                <button
                  onClick={() => {
                    setShowSkeleton(!showSkeleton);
                    setHintMessage(showSkeleton ? 'Bone structure hidden.' : 'Skeletal system overlay active.');
                  }}
                  className={`w-14 h-7 rounded-full transition-all relative p-0.5 ${
                    showSkeleton ? 'bg-orange-500' : 'bg-slate-800'
                  }`}
                >
                  <div className={`w-6 h-6 rounded-full bg-white transition-all transform ${
                    showSkeleton ? 'translate-x-7 shadow-lg shadow-orange-500/50' : 'translate-x-0'
                  }`} />
                </button>
                </div>
              </div>
            </div>

            {/* Muscle Group Filtering Grid */}
            <div className="space-y-1.5 font-sans">
              <label className="block text-xs font-mono font-bold tracking-wider text-slate-400 uppercase">
                Anatomical Regions (Group filters)
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {['All', 'Chest', 'Back', 'Shoulders', 'Arms', 'Legs', 'Glutes', 'Core'].map(group => {
                  const fatigue = fatigueScores[group] || 0;
                  const isSelected = selectedGroup === group;
                  const isLinked = linkingExercise ? (linkedGroups.includes(group)) : false;
                  
                  return (
                    <button
                      key={group}
                      onMouseDown={() => startGroupPress(group)}
                      onMouseUp={endGroupPress}
                      onTouchStart={() => startGroupPress(group)}
                      onTouchEnd={endGroupPress}
                      onMouseLeave={endGroupPress}
                      onClick={() => handleGroupClickWithLinking(group)}
                      className={`relative py-2 px-1 text-[11px] font-bold rounded-xl border text-center transition-all cursor-pointer select-none active:scale-95 duration-150 ${
                        isLinked
                          ? 'bg-amber-500/10 text-amber-300 border-amber-400/80 shadow-[0_0_8px_rgba(245,158,11,0.25)]'
                          : isSelected
                            ? 'bg-cyan-500 text-slate-950 border-cyan-400 font-extrabold'
                            : 'bg-slate-900/40 text-slate-300 border-slate-800/80 hover:border-slate-700 hover:text-white'
                      }`}
                      title={linkingExercise && group !== 'All' ? `Click / Long press to link or unlink ${group} region` : `Click to filter by ${group}`}
                    >
                      <span className="flex items-center justify-center gap-1">
                        {isLinked && <span className="text-amber-400 text-[10px]">🔗</span>}
                        {group}
                      </span>
                      {showFatigue && fatigue > 0 && (
                        <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-500 border border-slate-950 animate-pulse" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* List of muscles in selected region */}
            <div className="space-y-1.5 font-sans">
              <div className="flex justify-between items-center">
                <label className="text-xs font-mono font-bold tracking-wider text-slate-400 uppercase">
                  Muscle Select ({displayedMusclesList.length})
                </label>
                {selectedGroup !== 'All' && (
                  <button 
                    onClick={() => onSelectMachineByCategory(selectedGroup)}
                    className="text-[10px] text-cyan-400 font-bold hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Dumbbell size={10} /> View {selectedGroup} Machines
                  </button>
                )}
              </div>
              
              <div className="bg-slate-900/30 border border-slate-800/80 rounded-2xl p-2 max-h-[170px] overflow-y-auto space-y-1">
                {displayedMusclesList.map(m => {
                  const fatigue = fatigueScores[m.id] !== undefined ? fatigueScores[m.id] : (fatigueScores[m.group] || 0);
                  const isSelected = selectedMuscleId === m.id;
                  const isMuscleLinked = linkingExercise ? (linkedMuscles.includes(m.id) || linkedGroups.includes(m.group)) : false;
                  
                  return (
                    <button
                      key={m.id}
                      onMouseDown={() => startMusclePress(m.id)}
                      onMouseUp={endMusclePress}
                      onTouchStart={() => startMusclePress(m.id)}
                      onTouchEnd={endMusclePress}
                      onMouseLeave={endMusclePress}
                      onClick={() => handleMuscleClickWithLinking(m.id)}
                      className={`w-full flex items-center justify-between text-left py-1.5 px-3 rounded-lg text-[11px] transition-all cursor-pointer select-none active:scale-98 duration-150 border ${
                        isMuscleLinked
                          ? 'bg-amber-500/10 text-amber-300 border-amber-500/30 font-bold shadow-sm'
                          : isSelected
                            ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20 font-semibold'
                            : 'hover:bg-slate-900/60 text-slate-300 border-transparent'
                      }`}
                      title={linkingExercise ? `Click / Long press to link or unlink ${m.name}` : `Click to focus on ${m.name}`}
                    >
                      <div className="flex items-center gap-1.5">
                        <div className={`w-1.5 h-1.5 rounded-full ${isMuscleLinked ? 'bg-amber-400 animate-pulse' : m.isDeep ? 'bg-violet-400' : 'bg-cyan-400'}`} />
                        <span className="font-bold flex items-center gap-1">
                          {m.name}
                          {isMuscleLinked && <span className="text-amber-400 text-[9px] font-bold">🔗 LINKED</span>}
                        </span>
                        {m.isDeep && <span className="text-[8px] px-1 bg-slate-900 text-purple-400 rounded">DEEP</span>}
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="text-[9px] text-slate-400 font-mono italic">{m.latinName}</span>
                        {showFatigue && fatigue > 0 && (
                          <span className={`text-[9px] font-mono px-1 rounded ${
                            fatigue > 0.7 ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-300'
                          }`}>
                            {Math.round(fatigue * 100)}% FAT
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Diagnostics readout detailed bio box */}
          <div className="bg-slate-900/55 border border-slate-800/90 rounded-2xl p-4 space-y-2 relative min-h-[110px]">
            {activeMuscle ? (
              <div className="space-y-1.5 animate-in fade-in duration-200">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[9px] font-mono uppercase tracking-widest text-cyan-400 bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-800/40">
                      {activeMuscle.group} Anatomy
                    </span>
                    <h4 className="text-sm font-bold text-white mt-1">
                      {activeMuscle.name}
                    </h4>
                  </div>
                  <span className="text-[10px] italic font-mono text-slate-400">
                    {activeMuscle.latinName}
                  </span>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  {activeMuscle.description}
                </p>
                {showFatigue && (fatigueScores[activeMuscle.group] || 0) > 0 && (
                  <div className="text-[10px] font-mono text-orange-400 flex items-center gap-1">
                    <Activity size={10} /> Live diagnostic suggests {Math.round((fatigueScores[activeMuscle.group] || 0) * 100)}% muscular tension accumulation on this segment.
                  </div>
                )}
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center py-4 text-slate-500 space-y-1">
                <Layers size={22} className="text-slate-600 animate-pulse" />
                <p className="text-[11px] font-bold">No active segment diagnostic selected</p>
                <p className="text-[9px] font-mono">
                  {hintMessage}
                </p>
              </div>
            )}
          </div>

        </div>
      </div>

    </div>
  );
}
