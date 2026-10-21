import { ExtractedRecord } from '../types/extractor';

// Keys to search for exact match
const EXACT_DISPLAY_KEYS = ['productNumberDisplay'];
const EXACT_HYPHEN_KEYS = ['productNumberHyphen'];
const EXACT_SAP_KEYS = ['productNumberSap'];
const EXACT_STATUS_KEYS = ['productStatus'];

// Fallback alias variations
const ALIAS_DISPLAY_KEYS = [
  'productNumberDisplay', 'product_number_display', 'displayPartNumber', 'partNumberDisplay',
  'partNumber', 'productNumber', 'part_number', 'product_number', 'displayNumber', 'itemNumber'
];
const ALIAS_HYPHEN_KEYS = [
  'productNumberHyphen', 'product_number_hyphen', 'hyphenPartNumber', 'partNumberHyphen',
  'hyphenatedPartNumber', 'hyphenatedNumber', 'hyphenNumber'
];
const ALIAS_SAP_KEYS = [
  'productNumberSap', 'product_number_sap', 'sapPartNumber', 'partNumberSap',
  'materialNumber', 'sapNumber', 'productSapNumber', 'sapMaterialNumber', 'sap_number'
];
const ALIAS_STATUS_KEYS = [
  'productStatus', 'product_status', 'partStatus', 'part_status', 'status',
  'Status', 'state', 'availability', 'statusCode', 'statusBadge', 'lifecycleStatus'
];

function extractStringValue(val: unknown): string {
  if (val === null || val === undefined) return '';
  if (typeof val === 'string') return val.trim();
  if (typeof val === 'number') return String(val);
  if (typeof val === 'boolean') return val ? 'Active' : 'Inactive';

  if (typeof val === 'object') {
    const obj = val as Record<string, unknown>;
    const subKeys = ['value', 'label', 'text', 'name', 'code', 'status', 'display'];
    for (const k of subKeys) {
      if (typeof obj[k] === 'string' && obj[k]) {
        return (obj[k] as string).trim();
      }
    }
  }

  return String(val).trim();
}

/**
 * Extracts partNumber query parameter from the URL if available (e.g. ?partNumber=855055114)
 */
function getPartNumberFromUrl(urlStr: string): string {
  try {
    if (urlStr.startsWith('http://') || urlStr.startsWith('https://')) {
      const parsed = new URL(urlStr);
      return parsed.searchParams.get('partNumber') || parsed.searchParams.get('part') || '';
    }
  } catch {
    // ignore
  }
  return '';
}

/**
 * Derives standard Molex hyphenated format if only digits are available (e.g. 855055114 -> 85505-5114)
 */
function deriveHyphenFormat(numStr: string): string {
  const clean = numStr.replace(/\D/g, '');
  if (clean.length === 9) {
    // 5 digits + 4 digits
    return `${clean.slice(0, 5)}-${clean.slice(5)}`;
  }
  if (clean.length === 10) {
    if (clean.startsWith('0')) {
      // 0 + 5 digits + 4 digits
      const trimmed = clean.slice(1);
      return `${trimmed.slice(0, 5)}-${trimmed.slice(5)}`;
    }
    // 5 digits + 5 digits or 6 + 4
    return `${clean.slice(0, 5)}-${clean.slice(5)}`;
  }
  return '';
}

function extractFromObject(
  obj: Record<string, unknown>,
  sourceUrl: string,
  strictMode: boolean
): ExtractedRecord | null {
  const displayKeys = strictMode ? EXACT_DISPLAY_KEYS : ALIAS_DISPLAY_KEYS;
  const hyphenKeys = strictMode ? EXACT_HYPHEN_KEYS : ALIAS_HYPHEN_KEYS;
  const sapKeys = strictMode ? EXACT_SAP_KEYS : ALIAS_SAP_KEYS;
  const statusKeys = strictMode ? EXACT_STATUS_KEYS : ALIAS_STATUS_KEYS;

  let foundDisplay = '';
  let hasDisplay = false;
  let foundHyphen = '';
  let hasHyphen = false;
  let foundSap = '';
  let hasSap = false;
  let foundStatus = '';
  let hasStatus = false;
  let foundDescription = '';

  // 1. Search for productNumberDisplay
  for (const k of displayKeys) {
    if (k in obj && obj[k] !== undefined && obj[k] !== null) {
      const str = extractStringValue(obj[k]);
      if (str) {
        foundDisplay = str;
        hasDisplay = true;
        break;
      }
    }
  }

  // Fallback to query parameter if display key wasn't explicitly inside the object
  if (!hasDisplay && sourceUrl) {
    const urlPart = getPartNumberFromUrl(sourceUrl);
    if (urlPart) {
      foundDisplay = urlPart;
      hasDisplay = true;
    }
  }

  // 2. Search for productNumberHyphen
  for (const k of hyphenKeys) {
    if (k in obj && obj[k] !== undefined && obj[k] !== null) {
      const str = extractStringValue(obj[k]);
      if (str) {
        foundHyphen = str;
        hasHyphen = true;
        break;
      }
    }
  }

  // Smart fallback for hyphen if not strictly disabled and we have display
  if (!hasHyphen && foundDisplay && !strictMode) {
    const autoHyphen = deriveHyphenFormat(foundDisplay);
    if (autoHyphen) {
      foundHyphen = autoHyphen;
      hasHyphen = true;
    }
  }

  // 3. Search for productNumberSap
  for (const k of sapKeys) {
    if (k in obj && obj[k] !== undefined && obj[k] !== null) {
      const str = extractStringValue(obj[k]);
      if (str) {
        foundSap = str;
        hasSap = true;
        break;
      }
    }
  }

  // Smart fallback for SAP number (often Molex SAP number is 10 digits padded with leading zero)
  if (!hasSap && foundDisplay && !strictMode) {
    const digits = foundDisplay.replace(/\D/g, '');
    if (digits.length === 9) {
      foundSap = `0${digits}`;
      hasSap = true;
    }
  }

  // 4. Search for productStatus
  for (const k of statusKeys) {
    if (k in obj && obj[k] !== undefined && obj[k] !== null) {
      const str = extractStringValue(obj[k]);
      if (str) {
        foundStatus = str;
        hasStatus = true;
        break;
      }
    }
  }

  // Optional description if available
  if (typeof obj.description === 'string') {
    foundDescription = obj.description;
  } else if (typeof obj.productDescription === 'string') {
    foundDescription = obj.productDescription;
  }

  // Qualification: must have at least one of the 4 requested Molex fields
  const isQualified = hasDisplay || hasHyphen || hasSap || hasStatus;

  if (isQualified) {
    const id = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    return {
      id,
      sourceUrl,
      productNumberDisplay: foundDisplay || (getPartNumberFromUrl(sourceUrl) || '(Not Provided)'),
      productNumberHyphen: foundHyphen || '',
      productNumberSap: foundSap || '',
      productStatus: foundStatus || 'Unpublished',
      description: foundDescription,
      extractedAt: new Date().toISOString(),
      rawItem: obj,
      fieldFlags: {
        hasDisplay,
        hasHyphen,
        hasSap,
        hasStatus,
      },
    };
  }

  return null;
}

/**
 * Recursively inspects a parsed JSON structure (object or array)
 * and extracts all records that contain:
 * 1- productNumberDisplay
 * 2- productNumberHyphen
 * 3- productNumberSap
 * 4- productStatus
 */
export function extractDataFromJson(
  jsonData: unknown,
  sourceUrl: string,
  options: { strictMode?: boolean; resolveRelativeUrls?: boolean } = {}
): ExtractedRecord[] {
  const strictMode = options.strictMode ?? false;
  const results: ExtractedRecord[] = [];
  const seenKeys = new Set<string>();

  if (!jsonData || typeof jsonData !== 'object') {
    // If the remote server returned a plain number/string or null, check if sourceUrl has partNumber
    const partNum = getPartNumberFromUrl(sourceUrl);
    if (partNum) {
      return [{
        id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        sourceUrl,
        productNumberDisplay: partNum,
        productNumberHyphen: deriveHyphenFormat(partNum),
        productNumberSap: partNum.length === 9 ? `0${partNum}` : partNum,
        productStatus: 'Unpublished',
        extractedAt: new Date().toISOString(),
        fieldFlags: {
          hasDisplay: true,
          hasHyphen: true,
          hasSap: true,
          hasStatus: false,
        }
      }];
    }
    return [];
  }

  // Check if root object is a direct Molex part object (e.g. single unpublished-part response)
  if (!Array.isArray(jsonData) && typeof jsonData === 'object') {
    const directRecord = extractFromObject(jsonData as Record<string, unknown>, sourceUrl, strictMode);
    // If directRecord has any of the primary keys
    if (directRecord && (directRecord.fieldFlags.hasDisplay || directRecord.fieldFlags.hasHyphen || directRecord.fieldFlags.hasSap || directRecord.fieldFlags.hasStatus)) {
      results.push(directRecord);
      return results;
    }
  }

  function traverse(current: unknown, depth = 0) {
    if (depth > 12 || current === null || current === undefined) return;

    if (Array.isArray(current)) {
      for (const item of current) {
        if (typeof item === 'object' && item !== null && !Array.isArray(item)) {
          const record = extractFromObject(item as Record<string, unknown>, sourceUrl, strictMode);
          if (record && (record.fieldFlags.hasDisplay || record.fieldFlags.hasHyphen || record.fieldFlags.hasSap || record.fieldFlags.hasStatus)) {
            const signature = `${record.productNumberDisplay}|${record.productNumberHyphen}|${record.productNumberSap}|${record.productStatus}`;
            if (!seenKeys.has(signature)) {
              seenKeys.add(signature);
              results.push(record);
            }
            continue;
          }
        }
        traverse(item, depth + 1);
      }
    } else if (typeof current === 'object') {
      const obj = current as Record<string, unknown>;

      // Check if this nested object itself qualifies
      const record = extractFromObject(obj, sourceUrl, strictMode);
      if (record && (record.fieldFlags.hasDisplay || record.fieldFlags.hasHyphen || record.fieldFlags.hasSap || record.fieldFlags.hasStatus)) {
        // If it looks like a distinct part node
        const hasSpecificPartKeys = 'productNumberDisplay' in obj || 'productNumberHyphen' in obj || 'productNumberSap' in obj || 'productStatus' in obj || 'partNumber' in obj;
        if (hasSpecificPartKeys) {
          const signature = `${record.productNumberDisplay}|${record.productNumberHyphen}|${record.productNumberSap}|${record.productStatus}`;
          if (!seenKeys.has(signature)) {
            seenKeys.add(signature);
            results.push(record);
          }
        }
      }

      for (const key of Object.keys(obj)) {
        const val = obj[key];
        if (typeof val === 'object' && val !== null) {
          traverse(val, depth + 1);
        }
      }
    }
  }

  traverse(jsonData);

  // If no records were found in the json, but we have a valid partNumber query in sourceUrl
  if (results.length === 0) {
    const partNum = getPartNumberFromUrl(sourceUrl);
    if (partNum) {
      results.push({
        id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        sourceUrl,
        productNumberDisplay: partNum,
        productNumberHyphen: deriveHyphenFormat(partNum),
        productNumberSap: partNum.length === 9 ? `0${partNum}` : partNum,
        productStatus: 'Unpublished',
        extractedAt: new Date().toISOString(),
        rawItem: typeof jsonData === 'object' ? (jsonData as Record<string, unknown>) : undefined,
        fieldFlags: {
          hasDisplay: true,
          hasHyphen: true,
          hasSap: true,
          hasStatus: false,
        }
      });
    }
  }

  return results;
}
