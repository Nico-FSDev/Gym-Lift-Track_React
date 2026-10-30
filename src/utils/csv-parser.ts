import { WorkoutSet, MachineConfig } from '../types';

export interface ParsedSet {
  exercise: string;
  date: Date;
  reps: number;
  weightLbs: number;
  weightKg: number;
  degrees?: number;
  variant?: string;
}

export interface ParsedImportResult {
  sets: ParsedSet[];
  configs: Omit<MachineConfig, 'id' | 'createdAt' | 'updatedAt' | 'userId'>[];
}

/**
 * Parses a CSV line respecting matching double quotes (for cell values containing commas/newlines).
 */
function parseCSVLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === delimiter && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

/**
 * Detects if a list of date strings is in MM/DD/YYYY or DD/MM/YYYY format.
 * It looks for values > 12 to determine which position represents the day.
 */
function detectDateFormat(lines: string[], delimiter: string, dateIndices: number[]): 'MM/DD' | 'DD/MM' {
  let mmCount = 0; // count of times first segment > 12 (proving DD/MM)
  let ddCount = 0; // count of times second segment > 12 (proving MM/DD)
  
  for (let r = 2; r < lines.length; r++) {
    const rowCells = parseCSVLine(lines[r], delimiter);
    for (const idx of dateIndices) {
      if (idx >= rowCells.length) continue;
      const clean = rowCells[idx].replace(/["']/g, '').trim();
      if (!clean) continue;
      
      const match = clean.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})/);
      if (match) {
        const first = parseInt(match[1], 10);
        const second = parseInt(match[2], 10);
        
        if (first > 12 && second <= 12) {
          mmCount++; // First segment is > 12, so it MUST be Day. Hence format is DD/MM/YYYY.
        } else if (second > 12 && first <= 12) {
          ddCount++; // Second segment is > 12, so it MUST be Day. Hence format is MM/DD/YYYY.
        }
      }
    }
  }
  
  // Default to DD/MM unless MM/DD is clearly detected
  return ddCount > mmCount ? 'MM/DD' : 'DD/MM';
}

/**
 * Robust date parser that handles formats like DD/MM/YYYY, DD/MM/YY, YYYY-MM-DD.
 */
function parseDate(dateStr: string, formatPreference: 'MM/DD' | 'DD/MM' = 'DD/MM'): Date | null {
  if (!dateStr) return null;
  const clean = dateStr.replace(/["']/g, '').trim();
  if (!clean) return null;

  // 1. Try DD/MM/YYYY or DD/MM/YY format (with optional time portion e.g. "12/06/2026 14:32")
  let match = clean.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/);
  if (match) {
    let d = parseInt(match[1], 10);
    let m = parseInt(match[2], 10) - 1;
    
    if (formatPreference === 'MM/DD') {
      // Swap date segments if MM/DD/YYYY is detected/preferred
      d = parseInt(match[2], 10);
      m = parseInt(match[1], 10) - 1;
    }

    let y = parseInt(match[3], 10);
    if (y < 100) {
      y += 2000; // assume 20xx
    }
    const hh = match[4] ? parseInt(match[4], 10) : 12;
    const mm = match[5] ? parseInt(match[5], 10) : 0;
    const ss = match[6] ? parseInt(match[6], 10) : 0;
    return new Date(y, m, d, hh, mm, ss);
  }

  // 2. Try standard YYYY-MM-DD or YYYY/MM/DD (with optional time portion)
  match = clean.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/);
  if (match) {
    const y = parseInt(match[1], 10);
    const m = parseInt(match[2], 10) - 1;
    const d = parseInt(match[3], 10);
    const hh = match[4] ? parseInt(match[4], 10) : 12;
    const mm = match[5] ? parseInt(match[5], 10) : 0;
    const ss = match[6] ? parseInt(match[6], 10) : 0;
    return new Date(y, m, d, hh, mm, ss);
  }

  const parsed = new Date(clean);
  if (!isNaN(parsed.getTime())) {
    return parsed;
  }
  return null;
}

/**
 * Parses numeric helper capable of replacing commas with dots (e.g. 155,5555556 -> 155.5555556)
 */
function parseNumber(valStr: string): number {
  if (!valStr) return 0;
  const cleaned = valStr.replace(/,/g, '.').replace(/[^0-9.\-]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

export function parseGoogleSheetCSV(csvText: string): ParsedImportResult {
  // Normalize line endings
  const lines = csvText.split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length < 2) {
    throw new Error('Le document CSV est vide ou incomplet.');
  }

  // Detect delimiter: if there are tabs, it's tab-separated (standard Excel/Google Sheets copy paste)
  const firstLine = lines[0];
  const delimiter = firstLine.includes('\t') ? '\t' : ',';

  // Parse headers
  const headerRow1 = parseCSVLine(lines[0], delimiter);
  const headerRow2 = parseCSVLine(lines[1], delimiter);

  // Identify all "Date" column starts in row 2
  const dateIndices: number[] = [];
  for (let c = 0; c < headerRow2.length; c++) {
    if (headerRow2[c]?.toLowerCase() === 'date') {
      dateIndices.push(c);
    }
  }

  if (dateIndices.length === 0) {
    throw new Error('En-tête "Date" introuvable dans la deuxième ligne du fichier CSV.');
  }

  const sections: {
    name: string;
    type: 'Machine' | 'Exercise';
    startCol: number;
    endCol: number;
    colMap: {
      date?: number;
      reps?: number;
      weightLbs?: number;
      weightKg?: number;
      degrees?: number;
      variant?: number;
    };
  }[] = [];

  // Group columns into exercise blocks
  for (let k = 0; k < dateIndices.length; k++) {
    const startCol = dateIndices[k];
    const endCol = k + 1 < dateIndices.length ? dateIndices[k + 1] : headerRow2.length;

    // Scan headerRow1 inside this column range to find non-empty strings
    const cellsInHeaderRange: { index: number; val: string }[] = [];
    for (let c = startCol; c < endCol; c++) {
      if (headerRow1[c] && headerRow1[c].trim().length > 0) {
        cellsInHeaderRange.push({ index: c, val: headerRow1[c].trim() });
      }
    }

    let exerciseName = '';
    let exerciseType: 'Machine' | 'Exercise' = 'Machine';

    if (cellsInHeaderRange.length > 0) {
      const firstCell = cellsInHeaderRange[0];
      const normalizedFirst = firstCell.val.toUpperCase();
      
      if (normalizedFirst === 'MACHINE') {
        exerciseType = 'Machine';
        // The name is the next non-empty cell value
        if (cellsInHeaderRange.length > 1) {
          exerciseName = cellsInHeaderRange[1].val;
        } else {
          // If no second cell, look at the cells to the right even if empty
          exerciseName = headerRow1[firstCell.index + 1]?.trim() || `Machine_${startCol}`;
        }
      } else if (normalizedFirst === 'EXERCISE') {
        exerciseType = 'Exercise';
        if (cellsInHeaderRange.length > 1) {
          exerciseName = cellsInHeaderRange[1].val;
        } else {
          exerciseName = headerRow1[firstCell.index + 1]?.trim() || `Exercise_${startCol}`;
        }
      } else {
        // Just use the first non-empty value as the exercise name
        exerciseName = firstCell.val;
        exerciseType = 'Machine'; // default
      }
    } else {
      exerciseName = `Exercise_${startCol}`;
    }

    // Clean up name
    exerciseName = exerciseName.replace(/["']/g, '').trim();

    // Now map row 2 columns for this block
    const colMap: any = {};
    for (let c = startCol; c < endCol; c++) {
      const subHeader = (headerRow2[c] || '').toLowerCase().trim();
      if (subHeader === 'date') {
        colMap.date = c;
      } else if (subHeader === 'rep' || subHeader === 'reps') {
        colMap.reps = c;
      } else if (subHeader.includes('lbs') || subHeader.includes('pound')) {
        colMap.weightLbs = c;
      } else if (subHeader.includes('kg') || subHeader.includes('kilo')) {
        colMap.weightKg = c;
      } else if (subHeader.includes('degres') || subHeader.includes('degrés') || subHeader.includes('degrees')) {
        colMap.degrees = c;
      } else if (subHeader.includes('option') || subHeader.includes('variant') || subHeader.includes('variation')) {
        colMap.variant = c;
      }
    }

    sections.push({
      name: exerciseName,
      type: exerciseType,
      startCol,
      endCol,
      colMap
    });
  }

  const parsedSets: ParsedSet[] = [];
  const activeExNames = new Set<string>();
  const configs: Omit<MachineConfig, 'id' | 'createdAt' | 'updatedAt' | 'userId'>[] = [];

  // Auto-detect whether source file dates are formatted as MM/DD/YYYY or DD/MM/YYYY
  const formatPreference = detectDateFormat(lines, delimiter, dateIndices);

  // Parse data rows
  for (let r = 2; r < lines.length; r++) {
    const rowCells = parseCSVLine(lines[r], delimiter);
    
    for (const section of sections) {
      if (section.colMap.date === undefined || section.colMap.date >= rowCells.length) continue;

      const dateStr = rowCells[section.colMap.date];
      const parsedDt = parseDate(dateStr, formatPreference);
      
      // If there is no valid date, skip for this section
      if (!parsedDt) continue;

      // Extract details
      const repsVal = section.colMap.reps !== undefined && section.colMap.reps < rowCells.length
                        ? Math.round(parseNumber(rowCells[section.colMap.reps]))
                        : 0;
                        
      const lbsVal = section.colMap.weightLbs !== undefined && section.colMap.weightLbs < rowCells.length
                        ? parseNumber(rowCells[section.colMap.weightLbs])
                        : 0;
                        
      const kgVal = section.colMap.weightKg !== undefined && section.colMap.weightKg < rowCells.length
                        ? parseNumber(rowCells[section.colMap.weightKg])
                        : 0;

      // Skip sets that seem to have 0 reps and 0 weight (empty rows in that column block)
      if (repsVal === 0 && lbsVal === 0 && kgVal === 0) continue;

      let degreesVal: number | undefined = undefined;
      if (section.colMap.degrees !== undefined && section.colMap.degrees < rowCells.length) {
        const rawDeg = rowCells[section.colMap.degrees];
        if (rawDeg && rawDeg.trim().length > 0) {
          degreesVal = parseNumber(rawDeg);
        }
      }

      let variantVal: string | undefined = undefined;
      if (section.colMap.variant !== undefined && section.colMap.variant < rowCells.length) {
        const rawVar = rowCells[section.colMap.variant];
        if (rawVar && rawVar.trim().length > 0) {
          variantVal = rawVar.replace(/["']/g, '').trim();
        }
      }

      parsedSets.push({
        exercise: section.name,
        date: parsedDt,
        reps: repsVal,
        weightLbs: lbsVal,
        weightKg: kgVal,
        degrees: degreesVal,
        variant: variantVal
      });

      // Track machine configurations to generate if not exists
      if (!activeExNames.has(section.name.toLowerCase())) {
        activeExNames.add(section.name.toLowerCase());
        
        // Base weight comes from the loaded values or default
        configs.push({
          exercise: section.name,
          baseWeightLbs: lbsVal > 0 ? lbsVal : 0,
          baseWeightKg: kgVal > 0 ? kgVal : 0,
          brand: '',
          category: section.type === 'Machine' ? 'Gym Machine' : 'Bodyweight',
          type: section.type,
          variantCategories: {}
        });
      }
    }
  }

  return {
    sets: parsedSets,
    configs
  };
}
