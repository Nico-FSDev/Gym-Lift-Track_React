export const MACHINE_PRESETS: Record<string, { groups: string[], muscles: string[] }> = {
  // --- CHEST ---
  'chest press': { groups: ['Chest', 'Shoulders', 'Arms'], muscles: ['pectoralis_major', 'deltoid_anterior', 'triceps_brachii'] },
  'incline chest press': { groups: ['Chest', 'Shoulders', 'Arms'], muscles: ['pectoralis_major', 'pectoralis_minor', 'deltoid_anterior', 'triceps_brachii'] },
  'decline chest press': { groups: ['Chest', 'Arms'], muscles: ['pectoralis_major', 'triceps_brachii'] },
  'converging chest press': { groups: ['Chest', 'Shoulders', 'Arms'], muscles: ['pectoralis_major', 'deltoid_anterior', 'triceps_brachii'] },
  'independent chest press': { groups: ['Chest', 'Shoulders', 'Arms'], muscles: ['pectoralis_major', 'deltoid_anterior', 'triceps_brachii'] },
  'pec fly': { groups: ['Chest'], muscles: ['pectoralis_major', 'pectoralis_minor'] },
  'pec dec': { groups: ['Chest'], muscles: ['pectoralis_major', 'pectoralis_minor'] },
  'pec deck': { groups: ['Chest'], muscles: ['pectoralis_major', 'pectoralis_minor'] },
  'rear delt / pec fly': { groups: ['Chest', 'Shoulders', 'Back'], muscles: ['pectoralis_major', 'deltoid_posterior', 'trapezius_upper', 'rhomboideus_major'] }, // Hybrid
  'pec fly / rear delt': { groups: ['Chest', 'Shoulders', 'Back'], muscles: ['pectoralis_major', 'deltoid_posterior', 'trapezius_upper', 'rhomboideus_major'] }, // Hybrid
  'rear delt': { groups: ['Shoulders', 'Back'], muscles: ['deltoid_posterior', 'trapezius_upper', 'rhomboideus_major'] },
  'cable crossover': { groups: ['Chest'], muscles: ['pectoralis_major', 'pectoralis_minor'] },
  'chest fly': { groups: ['Chest'], muscles: ['pectoralis_major', 'pectoralis_minor'] },
  'multi-press': { groups: ['Chest', 'Shoulders', 'Arms'], muscles: ['pectoralis_major', 'deltoid_anterior', 'triceps_brachii'] },
  'multipress': { groups: ['Chest', 'Shoulders', 'Arms'], muscles: ['pectoralis_major', 'deltoid_anterior', 'triceps_brachii'] },
  
  // --- BACK ---
  'lat pulldown': { groups: ['Back', 'Arms'], muscles: ['latissimus_dorsi', 'biceps_brachii', 'brachialis'] },
  'lat pull': { groups: ['Back', 'Arms'], muscles: ['latissimus_dorsi', 'biceps_brachii', 'brachialis'] },
  'pulldown': { groups: ['Back', 'Arms'], muscles: ['latissimus_dorsi', 'biceps_brachii', 'brachialis'] },
  'diverging lat pulldown': { groups: ['Back', 'Arms'], muscles: ['latissimus_dorsi', 'biceps_brachii', 'brachialis'] },
  'seated row': { groups: ['Back', 'Arms'], muscles: ['latissimus_dorsi', 'rhomboideus_major', 'trapezius_upper', 'biceps_brachii'] },
  'diverging seated row': { groups: ['Back', 'Arms'], muscles: ['latissimus_dorsi', 'rhomboideus_major', 'trapezius_upper', 'biceps_brachii'] },
  'low row': { groups: ['Back', 'Arms'], muscles: ['latissimus_dorsi', 'rhomboideus_major', 'biceps_brachii'] },
  'cable row': { groups: ['Back', 'Arms'], muscles: ['latissimus_dorsi', 'rhomboideus_major', 'trapezius_upper', 'biceps_brachii'] },
  't-bar row': { groups: ['Back', 'Arms'], muscles: ['latissimus_dorsi', 'rhomboideus_major', 'trapezius_upper', 'biceps_brachii'] },
  'back extension': { groups: ['Back'], muscles: ['erector_spinae'] },
  'lower back': { groups: ['Back'], muscles: ['erector_spinae'] },
  'chin / dip assist': { groups: ['Arms', 'Chest', 'Shoulders', 'Back'], muscles: ['triceps_brachii', 'pectoralis_major', 'deltoid_anterior', 'latissimus_dorsi', 'biceps_brachii'] },
  'dip / chin assist': { groups: ['Arms', 'Chest', 'Shoulders', 'Back'], muscles: ['triceps_brachii', 'pectoralis_major', 'deltoid_anterior', 'latissimus_dorsi', 'biceps_brachii'] },
  'chin assist': { groups: ['Back', 'Arms'], muscles: ['latissimus_dorsi', 'biceps_brachii'] },
  'assisted pull-up': { groups: ['Back', 'Arms'], muscles: ['latissimus_dorsi', 'biceps_brachii'] },
  'assisted chin-up': { groups: ['Back', 'Arms'], muscles: ['latissimus_dorsi', 'biceps_brachii'] },
  'pull-up': { groups: ['Back', 'Arms'], muscles: ['latissimus_dorsi', 'biceps_brachii'] },
  'pull up': { groups: ['Back', 'Arms'], muscles: ['latissimus_dorsi', 'biceps_brachii'] },
  'chin-up': { groups: ['Back', 'Arms'], muscles: ['latissimus_dorsi', 'biceps_brachii'] },
  'chin up': { groups: ['Back', 'Arms'], muscles: ['latissimus_dorsi', 'biceps_brachii'] },
  
  // --- SHOULDERS ---
  'shoulder press': { groups: ['Shoulders', 'Arms'], muscles: ['deltoid_anterior', 'deltoid_lateral', 'triceps_brachii'] },
  'converging shoulder press': { groups: ['Shoulders', 'Arms'], muscles: ['deltoid_anterior', 'deltoid_lateral', 'triceps_brachii'] },
  'independent shoulder press': { groups: ['Shoulders', 'Arms'], muscles: ['deltoid_anterior', 'deltoid_lateral', 'triceps_brachii'] },
  'lateral raise': { groups: ['Shoulders'], muscles: ['deltoid_lateral'] },
  'shoulder raise': { groups: ['Shoulders'], muscles: ['deltoid_lateral', 'deltoid_anterior'] },
  
  // --- ARMS ---
  'bicep curl': { groups: ['Arms'], muscles: ['biceps_brachii', 'brachialis'] },
  'biceps curl': { groups: ['Arms'], muscles: ['biceps_brachii', 'brachialis'] },
  'arm curl': { groups: ['Arms'], muscles: ['biceps_brachii', 'brachialis'] },
  'cable curl': { groups: ['Arms'], muscles: ['biceps_brachii'] },
  'independent bicep curl': { groups: ['Arms'], muscles: ['biceps_brachii', 'brachialis'] },
  'tricep press': { groups: ['Arms', 'Shoulders', 'Chest'], muscles: ['triceps_brachii', 'deltoid_anterior', 'pectoralis_major'] },
  'triceps press': { groups: ['Arms', 'Shoulders', 'Chest'], muscles: ['triceps_brachii', 'deltoid_anterior', 'pectoralis_major'] },
  'dip assist': { groups: ['Arms', 'Chest', 'Shoulders'], muscles: ['triceps_brachii', 'pectoralis_major', 'deltoid_anterior'] },
  'dips assist': { groups: ['Arms', 'Chest', 'Shoulders'], muscles: ['triceps_brachii', 'pectoralis_major', 'deltoid_anterior'] },
  'assisted dip': { groups: ['Arms', 'Chest', 'Shoulders'], muscles: ['triceps_brachii', 'pectoralis_major', 'deltoid_anterior'] },
  'assisted dips': { groups: ['Arms', 'Chest', 'Shoulders'], muscles: ['triceps_brachii', 'pectoralis_major', 'deltoid_anterior'] },
  'seated dip': { groups: ['Arms', 'Chest', 'Shoulders'], muscles: ['triceps_brachii', 'pectoralis_major', 'deltoid_anterior'] },
  'tricep extension': { groups: ['Arms'], muscles: ['triceps_brachii'] },
  'triceps extension': { groups: ['Arms'], muscles: ['triceps_brachii'] },
  'independent tricep extension': { groups: ['Arms'], muscles: ['triceps_brachii'] },
  'independent triceps extension': { groups: ['Arms'], muscles: ['triceps_brachii'] },
  
  // --- LEGS ---
  'leg press': { groups: ['Legs', 'Glutes'], muscles: ['quadriceps_femoris', 'gluteus_maximus', 'hamstrings'] },
  'perfect squat': { groups: ['Legs', 'Glutes'], muscles: ['quadriceps_femoris', 'gluteus_maximus', 'hamstrings'] },
  'hack squat': { groups: ['Legs', 'Glutes'], muscles: ['quadriceps_femoris', 'gluteus_maximus', 'hamstrings'] },
  'v-squat': { groups: ['Legs', 'Glutes'], muscles: ['quadriceps_femoris', 'gluteus_maximus', 'hamstrings'] },
  'squat': { groups: ['Legs', 'Glutes'], muscles: ['quadriceps_femoris', 'gluteus_maximus', 'hamstrings'] },
  'front squat': { groups: ['Legs'], muscles: ['quadriceps_femoris', 'gluteus_maximus'] },
  'deadlift': { groups: ['Legs', 'Glutes', 'Back'], muscles: ['gluteus_maximus', 'hamstrings', 'erector_spinae'] },
  'romanian deadlift': { groups: ['Legs', 'Glutes', 'Back'], muscles: ['hamstrings', 'gluteus_maximus', 'erector_spinae'] },
  'rdl': { groups: ['Legs', 'Glutes', 'Back'], muscles: ['hamstrings', 'gluteus_maximus', 'erector_spinae'] },
  'leg expansion': { groups: ['Legs'], muscles: ['quadriceps_femoris'] },
  'leg extension': { groups: ['Legs'], muscles: ['quadriceps_femoris'] },
  'leg curl': { groups: ['Legs'], muscles: ['hamstrings'] },
  'seated leg curl': { groups: ['Legs'], muscles: ['hamstrings'] },
  'prone leg curl': { groups: ['Legs'], muscles: ['hamstrings'] },
  'calf press': { groups: ['Legs'], muscles: ['gastrocnemius', 'soleus'] },
  'calf extension': { groups: ['Legs'], muscles: ['gastrocnemius', 'soleus'] },
  'rotary calf': { groups: ['Legs'], muscles: ['gastrocnemius', 'soleus'] },
  'seated calf': { groups: ['Legs'], muscles: ['soleus'] }, // Soleus target
  'standing calf': { groups: ['Legs'], muscles: ['gastrocnemius'] },
  
  // --- GLUTES / HIPS ---
  'glute': { groups: ['Glutes'], muscles: ['gluteus_maximus', 'gluteus_medius'] },
  'glute press': { groups: ['Glutes'], muscles: ['gluteus_maximus'] },
  'glute trainer': { groups: ['Glutes'], muscles: ['gluteus_maximus'] },
  'glute drive': { groups: ['Glutes'], muscles: ['gluteus_maximus'] },
  'hip abductor': { groups: ['Glutes'], muscles: ['gluteus_medius', 'gluteus_minimus'] },
  'outer thigh': { groups: ['Glutes'], muscles: ['gluteus_medius', 'gluteus_minimus'] },
  'hip adductor': { groups: ['Legs'], muscles: [] }, // Using 'Legs'
  'inner thigh': { groups: ['Legs'], muscles: [] },
  'rotary hip': { groups: ['Glutes', 'Legs'], muscles: ['gluteus_maximus', 'gluteus_medius'] },
  
  // --- CORE ---
  'abdominal': { groups: ['Core'], muscles: ['rectus_abdominis'] },
  'abdominal crunch': { groups: ['Core'], muscles: ['rectus_abdominis'] },
  'ab crunch': { groups: ['Core'], muscles: ['rectus_abdominis'] },
  'crunch': { groups: ['Core'], muscles: ['rectus_abdominis'] },
  'rotary torso': { groups: ['Core'], muscles: ['obliques', 'rectus_abdominis'] },
  'torso rotation': { groups: ['Core'], muscles: ['obliques', 'rectus_abdominis'] },
  'leg raise': { groups: ['Core'], muscles: ['rectus_abdominis'] },
  'hanging leg raise': { groups: ['Core'], muscles: ['rectus_abdominis'] },
};

export function getPresetsForMachine(machineName: string) {
  const normalizedName = machineName.toLowerCase().trim();
  
  // Direct match
  if (MACHINE_PRESETS[normalizedName]) {
    return MACHINE_PRESETS[normalizedName];
  }
  
  // Partial matches (e.g. "Matrix Leg Press" -> "leg press")
  // Sort keys by length descending so we match the most specific preset string first
  // e.g. "independent chest press" before "chest press"
  const sortedKeys = Object.keys(MACHINE_PRESETS).sort((a, b) => b.length - a.length);
  for (const key of sortedKeys) {
    if (normalizedName.includes(key)) {
      return MACHINE_PRESETS[key];
    }
  }
  
  return null;
}
