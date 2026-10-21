import { ExtractedRecord } from '../types/extractor';

function extractStringValue(val: unknown): string {
  if (val === null || val === undefined) return '';
  if (typeof val === 'string') return val.trim();
  if (typeof val === 'number') return String(val);
  if (typeof val === 'boolean') return val ? 'Active' : 'Inactive';
  return '';
}

function getPartNumberFromUrl(urlStr: string): string {
  try {
    if (urlStr.startsWith('http://') || urlStr.startsWith('https://')) {
      const parsed = new URL(urlStr);
      return parsed.searchParams.get('partNumber') || parsed.searchParams.get('part') || parsed.searchParams.get('q') || '';
    }
  } catch {
    // ignore
  }
  return '';
}

function deriveHyphenFormat(numStr: string): string {
  if (!numStr) return '';
  if (numStr.includes('-')) return numStr;
  const clean = numStr.replace(/\D/g, '');
  if (clean.length === 10) {
    return `${clean.slice(0, 6)}-${clean.slice(6)}`;
  }
  if (clean.length === 9) {
    return `${clean.slice(0, 5)}-${clean.slice(5)}`;
  }
  return numStr;
}

function deriveSapFormat(numStr: string): string {
  if (!numStr) return '';
  const clean = numStr.replace(/\D/g, '');
  if (clean.length === 9) {
    return `0${clean}`;
  }
  return clean;
}

/**
 * Inspects a single part object from either:
 * - unpublished-part API ([{ productNumberDisplay, productNumberHyphen, productNumberSap, productStatus, ... }])
 * - search/productdetails API ({ materialMaster: {...}, admin: {...} })
 */
function parsePartObject(
  item: Record<string, unknown>,
  sourceUrl: string,
  urlPartFallback = ''
): ExtractedRecord | null {
  if (!item || typeof item !== 'object') return null;

  const mm = (item.materialMaster as Record<string, unknown>) || {};
  const admin = (item.admin as Record<string, unknown>) || {};

  // 1. productNumberDisplay
  const display = extractStringValue(
    item.productNumberDisplay ||
    mm.productNumberDisplay ||
    item.partNumber ||
    mm.partNumber ||
    admin.productNumberDisplay ||
    item.engineeringNumber ||
    item.materialNumber ||
    urlPartFallback
  );

  // If no display number found at all, skip
  if (!display) return null;

  // 2. productNumberHyphen
  const rawHyphen = extractStringValue(
    item.productNumberHyphen ||
    mm.productNumberHyphen ||
    item.hyphenPartNumber ||
    mm.hyphenPartNumber
  );
  let hyphen = rawHyphen;
  if (!hyphen) {
    const engNum = extractStringValue(item.engineeringNumber || mm.engineeringNumber);
    if (engNum && engNum.includes('-')) {
      hyphen = engNum;
    } else {
      hyphen = deriveHyphenFormat(display);
    }
  }

  // 3. productNumberSap
  const rawSap = extractStringValue(
    item.productNumberSap ||
    mm.productNumberSap ||
    item.sapPartNumber ||
    mm.sapPartNumber ||
    item.materialNumber ||
    mm.materialNumber
  );
  const sap = rawSap || deriveSapFormat(display);

  // 4. productStatus
  const status = extractStringValue(
    item.productStatus ||
    mm.productStatus ||
    item.salesStatusDescription ||
    mm.salesStatusDescription ||
    item.status ||
    admin.status ||
    ''
  );

  // 5. datasourcePdf: prefer user requested URL format: https://www.molex.com/en-us/products/part-detail/productNumberDisplay
  // or actual datasheetPDF if available
  let datasheet = extractStringValue(admin.datasheetPDF || item.datasourcePdf || item.datasheetPdf);
  if (!datasheet && display) {
    datasheet = `https://www.molex.com/en-us/products/part-detail/${display}`;
  }

  // Description if available
  const description = extractStringValue(
    item.productDescription ||
    mm.productDescription ||
    item.description ||
    (item.general && typeof item.general === 'object' ? (item.general as Record<string, unknown>).webDescription : '')
  );

  return {
    id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    sourceUrl,
    productNumberDisplay: display,
    productNumberHyphen: hyphen,
    productNumberSap: sap,
    productStatus: status || 'Not Specified',
    datasourcePdf: datasheet,
    description,
    extractedAt: new Date().toISOString(),
    rawItem: item,
    fieldFlags: {
      hasDisplay: !!display,
      hasHyphen: !!hyphen,
      hasSap: !!sap,
      hasStatus: !!status,
      hasDatasheet: !!datasheet,
    },
  };
}

/**
 * Extracts accurate Molex part data ONLY when real information exists.
 * Accurately parses:
 * - Direct Arrays: [ { productNumberDisplay, productNumberHyphen, productNumberSap, productStatus, ... } ]
 * - Nested Objects: { products: [ { materialMaster, admin } ] }
 * - Direct single objects: { productNumberDisplay, ... }
 */
export function extractDataFromJson(
  jsonData: unknown,
  sourceUrl: string,
  _options: { strictMode?: boolean; resolveRelativeUrls?: boolean } = {}
): ExtractedRecord[] {
  const results: ExtractedRecord[] = [];
  const seenKeys = new Set<string>();
  const urlPartNumber = getPartNumberFromUrl(sourceUrl);

  const addIfUnique = (record: ExtractedRecord | null) => {
    if (!record) return;
    const signature = `${record.productNumberDisplay}|${record.productNumberHyphen}|${record.productNumberSap}|${record.productStatus}|${record.datasourcePdf}`;
    if (!seenKeys.has(signature)) {
      seenKeys.add(signature);
      results.push(record);
    }
  };

  if (!jsonData || typeof jsonData !== 'object') {
    return results;
  }

  // Case A: Root is an Array (e.g. unpublished-part API: [ { productNumberDisplay, ... } ])
  if (Array.isArray(jsonData)) {
    for (const item of jsonData) {
      if (item && typeof item === 'object') {
        const record = parsePartObject(item as Record<string, unknown>, sourceUrl, urlPartNumber);
        addIfUnique(record);
      }
    }
    return results;
  }

  // Case B: Root has `products` array (e.g. search.molex.com/api/search/productdetails: { products: [...] })
  const rootObj = jsonData as Record<string, unknown>;
  if (rootObj.products && Array.isArray(rootObj.products)) {
    for (const prodItem of rootObj.products) {
      if (prodItem && typeof prodItem === 'object') {
        const record = parsePartObject(prodItem as Record<string, unknown>, sourceUrl, urlPartNumber);
        addIfUnique(record);
      }
    }
    return results;
  }

  // Case C: Root has other common container arrays (e.g. items, parts, results, data)
  for (const arrayKey of ['items', 'parts', 'results', 'data']) {
    if (rootObj[arrayKey] && Array.isArray(rootObj[arrayKey])) {
      const arr = rootObj[arrayKey] as unknown[];
      for (const item of arr) {
        if (item && typeof item === 'object') {
          const record = parsePartObject(item as Record<string, unknown>, sourceUrl, urlPartNumber);
          addIfUnique(record);
        }
      }
      if (results.length > 0) return results;
    }
  }

  // Case D: Single direct object
  const singleRecord = parsePartObject(rootObj, sourceUrl, urlPartNumber);
  addIfUnique(singleRecord);

  return results;
}
