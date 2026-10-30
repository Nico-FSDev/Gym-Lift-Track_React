export interface Point3D {
  x: number;
  y: number;
  z: number;
}

export interface MuscleDefinition {
  id: string;
  name: string;
  latinName: string;
  group: 'Chest' | 'Back' | 'Shoulders' | 'Arms' | 'Legs' | 'Glutes' | 'Core';
  isDeep: boolean;
  isSymmetric: boolean;
  description: string;
  bestAngle: { yaw: number; pitch: number; zoom: number; targetY: number };
  points: Point3D[];
}

// Highly precise pro-level anatomical dictionary of key muscle groups
export const MUSCLES: MuscleDefinition[] = [
  // --- CHEST ---
  {
    id: 'pectoralis_major',
    name: 'Pectoralis Major',
    latinName: 'm. pectoralis major',
    group: 'Chest',
    isDeep: false,
    isSymmetric: true,
    description: 'Adducts and medially rotates humerus; draws scapula anteriorly and inferiorly.',
    bestAngle: { yaw: 0, pitch: 0.1, zoom: 4.2, targetY: 70 },
    points: [
      { x: 1.5, y: 52, z: 10.2 },
      { x: 11.5, y: 50, z: 9.0 },
      { x: 12.5, y: 44, z: 8.5 },
      { x: 7.5, y: 38, z: 9.2 },
      { x: 1.5, y: 37, z: 10.0 }
    ]
  },
  {
    id: 'pectoralis_minor',
    name: 'Pectoralis Minor',
    latinName: 'm. pectoralis minor',
    group: 'Chest',
    isDeep: true,
    isSymmetric: true,
    description: 'Stabilizes scapula by drawing it inferiorly and anteriorly against thoracic wall.',
    bestAngle: { yaw: 0.2, pitch: 0.15, zoom: 4.8, targetY: 70 },
    points: [
      { x: 3.5, y: 48, z: 7.5 },
      { x: 9.0, y: 44, z: 6.5 },
      { x: 7.5, y: 37, z: 5.5 },
      { x: 3.5, y: 39, z: 6.5 }
    ]
  },

  // --- SHOULDERS ---
  {
    id: 'deltoid_anterior',
    name: 'Anterior Deltoid',
    latinName: 'm. deltoideus pars clavicularis',
    group: 'Shoulders',
    isDeep: false,
    isSymmetric: true,
    description: 'Flexes and medially rotates arm at the glenohumeral joint.',
    bestAngle: { yaw: 0.3, pitch: 0.1, zoom: 4.4, targetY: 90 },
    points: [
      { x: 12.0, y: 58, z: 7.5 },
      { x: 16.0, y: 55, z: 7.5 },
      { x: 15.0, y: 44, z: 6.0 },
      { x: 11.5, y: 46, z: 5.0 }
    ]
  },
  {
    id: 'deltoid_lateral',
    name: 'Lateral Deltoid',
    latinName: 'm. deltoideus pars acromialis',
    group: 'Shoulders',
    isDeep: false,
    isSymmetric: true,
    description: 'Abducts arm past the initial 15 degrees performed by supraspinatus.',
    bestAngle: { yaw: Math.PI / 2, pitch: 0.1, zoom: 4.4, targetY: 90 },
    points: [
      { x: 14.5, y: 58, z: 2.0 },
      { x: 17.5, y: 55, z: 0.0 },
      { x: 15.5, y: 44, z: -1.0 },
      { x: 12.5, y: 46, z: 1.0 }
    ]
  },
  {
    id: 'deltoid_posterior',
    name: 'Posterior Deltoid',
    latinName: 'm. deltoideus pars spinalis',
    group: 'Shoulders',
    isDeep: false,
    isSymmetric: true,
    description: 'Extends and laterally rotates arm at the glenohumeral joint.',
    bestAngle: { yaw: Math.PI - 0.3, pitch: 0.1, zoom: 4.4, targetY: 90 },
    points: [
      { x: 11.0, y: 58, z: -7.0 },
      { x: 14.5, y: 55, z: -8.0 },
      { x: 13.5, y: 44, z: -6.5 },
      { x: 10.0, y: 46, z: -5.5 }
    ]
  },
  {
    id: 'rotator_cuff',
    name: 'Rotator Cuff Team',
    latinName: 'm. supraspinatus, infraspinatus et subscapularis',
    group: 'Shoulders',
    isDeep: true,
    isSymmetric: true,
    description: 'Establishes glenohumeral stabilization; primary rotators of humerus.',
    bestAngle: { yaw: Math.PI - 0.4, pitch: 0.2, zoom: 4.8, targetY: 90 },
    points: [
      { x: 4.0, y: 55, z: -4.5 },
      { x: 11.0, y: 50, z: -5.5 },
      { x: 10.0, y: 44, z: -4.5 },
      { x: 5.0, y: 46, z: -4.5 }
    ]
  },
  {
    id: 'sternocleidomastoid',
    name: 'Sternocleidomastoid (SCM)',
    latinName: 'm. sternocleidomastoideus',
    group: 'Shoulders',
    isDeep: false,
    isSymmetric: true,
    description: 'Main neck flexor and rotator; stabilizes the head during complex physical movements.',
    bestAngle: { yaw: 0.4, pitch: 0.1, zoom: 4.5, targetY: 90 },
    points: [
      { x: 3.8, y: 81, z: -2.3 },
      { x: 3.4, y: 75, z: 1.5 },
      { x: 2.4, y: 68, z: 4.5 },
      { x: 1.2, y: 61, z: 7.2 }
    ]
  },

  // --- CORE ---
    {
    id: 'iliopsoas',
    name: 'Iliopsoas',
    latinName: 'm. iliopsoas',
    group: 'Core',
    isDeep: true,
    isSymmetric: true,
    description: 'Primary hip flexor.',
    bestAngle: { yaw: 0, pitch: 0, zoom: 3.5, targetY: 15 },
    points: [ { x: 3.0, y: 15, z: 2.0 } ]
  },
  {
    id: 'rectus_abdominis',
    name: 'Rectus Abdominis',
    latinName: 'm. rectus abdominis',
    group: 'Core',
    isDeep: false,
    isSymmetric: false,
    description: 'Flexes vertebral column; compresses abdominal viscera; stabilizes pelvis.',
    bestAngle: { yaw: 0, pitch: 0, zoom: 3.8, targetY: 45 },
    points: [
      { x: -4.0, y: 37, z: 9.5 },
      { x: 4.0, y: 37, z: 9.5 },
      { x: 3.2, y: 10, z: 9.8 },
      { x: -3.2, y: 10, z: 9.8 }
    ]
  },
  {
    id: 'obliques',
    name: 'External Obliques',
    latinName: 'm. obliquus externus abdominis',
    group: 'Core',
    isDeep: false,
    isSymmetric: true,
    description: 'Flexes vertebral column laterally; rotates trunk to opposite side.',
    bestAngle: { yaw: 0.5, pitch: 0.05, zoom: 3.8, targetY: 45 },
    points: [
      { x: 4.0, y: 31, z: 8.0 },
      { x: 9.5, y: 25, z: 7.2 },
      { x: 8.0, y: 12, z: 8.0 },
      { x: 3.2, y: 10, z: 9.0 }
    ]
  },
  {
    id: 'obliques_left',
    name: 'External Oblique (Left)',
    latinName: 'm. obliquus externus abdominis sinister',
    group: 'Core',
    isDeep: false,
    isSymmetric: false,
    description: 'Rotates torso toward right. Loaded heavily by positive rotary angle (+70°).',
    bestAngle: { yaw: 0.5, pitch: 0.05, zoom: 3.8, targetY: 45 },
    points: [
      { x: -4.0, y: 31, z: 8.0 },
      { x: -9.5, y: 25, z: 7.2 },
      { x: -8.0, y: 12, z: 8.0 }
    ]
  },
  {
    id: 'obliques_right',
    name: 'External Oblique (Right)',
    latinName: 'm. obliquus externus abdominis dexter',
    group: 'Core',
    isDeep: false,
    isSymmetric: false,
    description: 'Rotates torso toward left. Loaded heavily by negative rotary angle (-70°).',
    bestAngle: { yaw: -0.5, pitch: 0.05, zoom: 3.8, targetY: 45 },
    points: [
      { x: 4.0, y: 31, z: 8.0 },
      { x: 9.5, y: 25, z: 7.2 },
      { x: 8.0, y: 12, z: 8.0 }
    ]
  },
  {
    id: 'transversus_abdominis',
    name: 'Transversus Abdominis',
    latinName: 'm. transversus abdominis',
    group: 'Core',
    isDeep: true,
    isSymmetric: false,
    description: 'Deep core stabilizing cylinder; increases intra-abdominal pressure.',
    bestAngle: { yaw: 0, pitch: -0.1, zoom: 4.3, targetY: 45 },
    points: [
      { x: -4.5, y: 22, z: 7.0 },
      { x: 4.5, y: 22, z: 7.0 },
      { x: 3.8, y: 12, z: 7.8 },
      { x: -3.8, y: 12, z: 7.8 }
    ]
  },

  // --- BACK ---
  {
    id: 'trapezius_upper',
    name: 'Trapezius',
    latinName: 'm. trapezius',
    group: 'Back',
    isDeep: false,
    isSymmetric: false,
    description: 'Elevates, rotates, retracts, and depresses scapula; extends the neck to skull base.',
    bestAngle: { yaw: Math.PI, pitch: 0.1, zoom: 3.8, targetY: 75 },
    points: [
      { x: 0, y: 81, z: -2.5 },
      { x: 11.0, y: 55, z: -4.2 },
      { x: 0, y: 37, z: -6.5 },
      { x: -11.0, y: 55, z: -4.2 }
    ]
  },
  {
    id: 'latissimus_dorsi',
    name: 'Latissimus Dorsi',
    latinName: 'm. latissimus dorsi',
    group: 'Back',
    isDeep: false,
    isSymmetric: true,
    description: 'Extends, adducts, and medially rotates humerus; draws shoulder downward.',
    bestAngle: { yaw: Math.PI, pitch: 0, zoom: 3.5, targetY: 75 },
    points: [
      { x: 1.5, y: 37, z: -8.2 },
      { x: 12.0, y: 40, z: -6.5 },
      { x: 10.0, y: 18, z: -7.2 },
      { x: 1.5, y: 10, z: -8.2 }
    ]
  },
  {
    id: 'rhomboideus_major',
    name: 'Rhomboideus Major',
    latinName: 'm. rhomboideus major',
    group: 'Back',
    isDeep: true,
    isSymmetric: true,
    description: 'Retracts scapula and rotates it to depress glenoid cavity; fixes scapula.',
    bestAngle: { yaw: Math.PI, pitch: 0.1, zoom: 4.4, targetY: 75 },
    points: [
      { x: 1.0, y: 50, z: -4.8 },
      { x: 7.0, y: 44, z: -5.2 },
      { x: 6.0, y: 37, z: -6.2 },
      { x: 1.0, y: 39, z: -6.0 }
    ]
  },
  {
    id: 'erector_spinae',
    name: 'Erector Spinae',
    latinName: 'm. erector spinae',
    group: 'Back',
    isDeep: true,
    isSymmetric: false,
    description: 'Extends vertebral column and head; assists lateral flexion of vertebral spine.',
    bestAngle: { yaw: Math.PI + 0.1, pitch: -0.1, zoom: 4.0, targetY: 75 },
    points: [
      { x: -1.8, y: 31, z: -5.2 },
      { x: 1.8, y: 31, z: -5.2 },
      { x: 1.8, y: 8, z: -6.2 },
      { x: -1.8, y: 8, z: -6.2 }
    ]
  },
  {
    id: 'splenius_capitis',
    name: 'Splenius Capitis',
    latinName: 'm. splenius capitis',
    group: 'Back',
    isDeep: true,
    isSymmetric: true,
    description: 'Deep splenius neck group; rotates, extends, and laterally flexes head and cervical spine.',
    bestAngle: { yaw: Math.PI - 0.4, pitch: 0.1, zoom: 4.5, targetY: 75 },
    points: [
      { x: 3.6, y: 81, z: -2.0 },
      { x: 2.4, y: 75, z: -3.0 },
      { x: 1.0, y: 68, z: -3.8 },
      { x: 0.2, y: 61, z: -3.5 }
    ]
  },

  // --- ARMS ---
  {
    id: 'biceps_brachii',
    name: 'Biceps Brachii',
    latinName: 'm. biceps brachii',
    group: 'Arms',
    isDeep: false,
    isSymmetric: true,
    description: 'Supinator and flexor of forearm at the elbow joint; minor humerus flexor.',
    bestAngle: { yaw: 0.2, pitch: 0.1, zoom: 4.4, targetY: 45 },
    points: [
      { x: 14.0, y: 52, z: 4.0 },
      { x: 17.5, y: 50, z: 5.5 },
      { x: 17.0, y: 35, z: 4.2 },
      { x: 14.5, y: 36, z: 2.8 }
    ]
  },
  {
    id: 'brachialis',
    name: 'Brachialis',
    latinName: 'm. brachialis',
    group: 'Arms',
    isDeep: true,
    isSymmetric: true,
    description: 'The absolute workhorse elbow flexor; active in all elbow flexions.',
    bestAngle: { yaw: 0.4, pitch: 0.15, zoom: 4.8, targetY: 60 },
    points: [
      { x: 14.5, y: 44, z: 2.0 },
      { x: 17.0, y: 42, z: 3.0 },
      { x: 16.5, y: 34, z: 2.2 },
      { x: 14.5, y: 35, z: 1.5 }
    ]
  },
  {
    id: 'triceps_brachii',
    name: 'Triceps Brachii',
    latinName: 'm. triceps brachii',
    group: 'Arms',
    isDeep: false,
    isSymmetric: true,
    description: 'Primary extensor of forearm; long head assists adduction of arm.',
    bestAngle: { yaw: Math.PI - 0.2, pitch: 0.1, zoom: 4.4, targetY: 45 },
    points: [
      { x: 14.0, y: 52, z: -4.0 },
      { x: 18.0, y: 50, z: -5.5 },
      { x: 17.0, y: 34, z: -4.2 },
      { x: 14.0, y: 36, z: -2.8 }
    ]
  },
  {
    id: 'forearm_extensors',
    name: 'Forearm Extensors',
    latinName: 'm. extensores carpi',
    group: 'Arms',
    isDeep: false,
    isSymmetric: true,
    description: 'Extends and abducts/adducts wrist; extends digits.',
    bestAngle: { yaw: 0.4, pitch: -0.1, zoom: 4.2, targetY: 60 },
    points: [
      { x: 16.5, y: 28, z: 2.2 },
      { x: 18.2, y: 27, z: 3.0 },
      { x: 17.8, y: 10, z: 1.2 },
      { x: 16.0, y: 11, z: 0.5 }
    ]
  },
  {
    id: 'forearm_flexors',
    name: 'Forearm Flexors',
    latinName: 'm. flexores carpi',
    group: 'Arms',
    isDeep: false,
    isSymmetric: true,
    description: 'Flexes and adducts/abducts wrist; flexes digits.',
    bestAngle: { yaw: Math.PI - 0.4, pitch: -0.1, zoom: 4.2, targetY: 60 },
    points: [
      { x: 16.0, y: 28, z: -2.2 },
      { x: 17.8, y: 27, z: -3.0 },
      { x: 17.4, y: 10, z: -1.2 },
      { x: 15.5, y: 11, z: -0.5 }
    ]
  },

  // --- GLUTES ---
  {
    id: 'gluteus_maximus',
    name: 'Gluteus Maximus',
    latinName: 'm. gluteus maximus',
    group: 'Glutes',
    isDeep: false,
    isSymmetric: true,
    description: 'Dominant extensor and lateral rotator of hip joint; stabilizes knee.',
    bestAngle: { yaw: Math.PI, pitch: 0, zoom: 3.2, targetY: 20 },
    points: [
      { x: 1.5, y: 10, z: -9.0 },
      { x: 10.5, y: 8, z: -8.2 },
      { x: 10.0, y: -6, z: -6.5 },
      { x: 1.5, y: -5, z: -7.2 }
    ]
  },
  {
    id: 'gluteus_medius',
    name: 'Gluteus Medius',
    latinName: 'm. gluteus medius',
    group: 'Glutes',
    isDeep: false,
    isSymmetric: true,
    description: 'Abducts and medially rotates thigh; stabilizes pelvis during gait.',
    bestAngle: { yaw: Math.PI / 2 + 0.3, pitch: 0.05, zoom: 3.5, targetY: 20 },
    points: [
      { x: 6.0, y: 12, z: -6.5 },
      { x: 11.0, y: 10, z: -4.5 },
      { x: 10.5, y: -2, z: -5.5 },
      { x: 5.0, y: -1, z: -6.8 }
    ]
  },
  {
    id: 'gluteus_minimus',
    name: 'Gluteus Minimus',
    latinName: 'm. gluteus minimus',
    group: 'Glutes',
    isDeep: true,
    isSymmetric: true,
    description: 'Deep pelvic stabilizer; works heavily with gluteus medius to balance hips.',
    bestAngle: { yaw: Math.PI / 2, pitch: 0.1, zoom: 4.0, targetY: 20 },
    points: [
      { x: 4.0, y: 10, z: -3.2 },
      { x: 8.5, y: 8, z: -2.2 },
      { x: 7.5, y: -2, z: -2.8 },
      { x: 3.2, y: -1, z: -3.2 }
    ]
  },

  // --- LEGS ---
    {
    id: 'adductors',
    name: 'Adductor Group',
    latinName: 'm. adductores',
    group: 'Legs',
    isDeep: true,
    isSymmetric: true,
    description: 'Adducts the thigh at the hip joint.',
    bestAngle: { yaw: 0.1, pitch: 0, zoom: 3.5, targetY: 10 },
    points: [ { x: 3.0, y: 0, z: 2.0 } ]
  },
  {
    id: 'sartorius',
    name: 'Sartorius',
    latinName: 'm. sartorius',
    group: 'Legs',
    isDeep: false,
    isSymmetric: true,
    description: 'Longest muscle; flexes, abducts, and laterally rotates thigh.',
    bestAngle: { yaw: 0.2, pitch: 0, zoom: 3.5, targetY: 10 },
    points: [ { x: 5.0, y: -5, z: 4.0 } ]
  },
  {
    id: 'fibularis',
    name: 'Fibularis (Peroneal)',
    latinName: 'm. fibularis',
    group: 'Legs',
    isDeep: false,
    isSymmetric: true,
    description: 'Everts and plantar flexes the foot.',
    bestAngle: { yaw: Math.PI / 2, pitch: -0.1, zoom: 3.8, targetY: -20 },
    points: [ { x: 5.0, y: -15, z: 2.0 } ]
  },
  {
    id: 'quadriceps_femoris',
    name: 'Quadriceps Femoris',
    latinName: 'm. quadriceps femoris',
    group: 'Legs',
    isDeep: false,
    isSymmetric: true,
    description: 'Extends leg at the knee joint; rectus femoris also flexes thigh at the hip.',
    bestAngle: { yaw: 0, pitch: -0.1, zoom: 3.0, targetY: -20 },
    points: [
      { x: 2.5, y: 0, z: 6.8 },
      { x: 8.0, y: -5, z: 5.8 },
      { x: 7.0, y: -38, z: 4.0 },
      { x: 2.5, y: -36, z: 4.5 }
    ]
  },
  {
    id: 'hamstrings',
    name: 'Hamstrings',
    latinName: 'm. ischiocrurales',
    group: 'Legs',
    isDeep: false,
    isSymmetric: true,
    description: 'Flexes leg at the knee joint; extends thigh at the hip joint.',
    bestAngle: { yaw: Math.PI, pitch: -0.1, zoom: 3.0, targetY: -20 },
    points: [
      { x: 2.5, y: 0, z: -6.8 },
      { x: 8.0, y: -5, z: -5.8 },
      { x: 7.0, y: -38, z: -4.0 },
      { x: 2.5, y: -36, z: -4.5 }
    ]
  },
  {
    id: 'gastrocnemius',
    name: 'Gastrocnemius',
    latinName: 'm. gastrocnemius',
    group: 'Legs',
    isDeep: false,
    isSymmetric: true,
    description: 'Primary superficial calf; plantar flexes ankle and attaches to calcaneus heel.',
    bestAngle: { yaw: Math.PI, pitch: -0.15, zoom: 3.2, targetY: -20 },
    points: [
      { x: 2.2, y: -55, z: -4.0 },
      { x: 5.8, y: -56, z: -3.5 },
      { x: 5.4, y: -72, z: -2.8 },
      { x: 4.0, y: -84, z: -2.2 },
      { x: 3.0, y: -94, z: -1.8 }
    ]
  },
  {
    id: 'soleus',
    name: 'Soleus',
    latinName: 'm. soleus',
    group: 'Legs',
    isDeep: true,
    isSymmetric: true,
    description: 'Deep postural calf; reinforces Achilles tendon insertion point on heel.',
    bestAngle: { yaw: Math.PI - 0.2, pitch: -0.15, zoom: 3.5, targetY: -20 },
    points: [
      { x: 2.2, y: -60, z: -2.5 },
      { x: 5.0, y: -62, z: -2.0 },
      { x: 4.5, y: -78, z: -1.6 },
      { x: 3.4, y: -88, z: -1.6 },
      { x: 3.0, y: -94, z: -1.8 }
    ]
  },
  {
    id: 'tibialis_anterior',
    name: 'Tibialis Anterior',
    latinName: 'm. tibialis anterior',
    group: 'Legs',
    isDeep: false,
    isSymmetric: true,
    description: 'Flexes and lifts foot; spans the shin to insert precisely on native foot structures.',
    bestAngle: { yaw: 0.2, pitch: -0.2, zoom: 3.2, targetY: -20 },
    points: [
      { x: 2.2, y: -55, z: 4.0 },
      { x: 5.0, y: -57, z: 3.5 },
      { x: 4.4, y: -72, z: 3.0 },
      { x: 3.6, y: -85, z: 2.5 },
      { x: 2.8, y: -94, z: 3.2 }
    ]
  },
  {
    id: 'extensor_digitorum_brevis',
    name: 'Extensor Digitorum Brevis',
    latinName: 'm. extensor digitorum brevis',
    group: 'Legs',
    isDeep: false,
    isSymmetric: true,
    description: 'Intrinsic foot muscle; extends toes assisting stance and gait stabilization.',
    bestAngle: { yaw: 0.3, pitch: -0.25, zoom: 4.8, targetY: -20 },
    points: [
      { x: 3.6, y: -95, z: 1.2 },
      { x: 4.2, y: -97, z: 3.2 },
      { x: 3.8, y: -99, z: 5.2 },
      { x: 2.8, y: -100, z: 5.6 }
    ]
  }
];
