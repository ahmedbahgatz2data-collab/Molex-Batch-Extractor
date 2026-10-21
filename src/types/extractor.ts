export interface ExtractedRecord {
  id: string;
  sourceUrl: string; // The input Molex JSON link
  productNumberDisplay: string;
  productNumberHyphen: string;
  productNumberSap: string;
  productStatus: string;
  description?: string;
  extractedAt: string;
  rawItem?: Record<string, unknown>;
  fieldFlags: {
    hasDisplay: boolean;
    hasHyphen: boolean;
    hasSap: boolean;
    hasStatus: boolean;
  };
}

export type FetchStatus = 'idle' | 'loading' | 'success' | 'error';

export interface UrlJob {
  id: string;
  url: string;
  status: FetchStatus;
  itemsFound: number;
  error?: string;
  durationMs?: number;
  rawJson?: unknown;
  isBotProtected?: boolean;
  firewallType?: string;
  domain?: string;
}

export interface StealthOptions {
  browserProfile: 'chrome-131' | 'edge-131' | 'safari-mac';
  autoReferer: boolean;
  customCookies?: string; // e.g. Molex/Akamai session cookies (_abck, bm_sv, ak_bmsc)
  customProxyUrl?: string; // Optional custom upstream residential/CORS proxy URL
}

export interface ExtractionConfig {
  strictMode: boolean; // strict exact "productNumberDisplay", "productNumberHyphen", etc. vs aliases
  resolveRelativeUrls: boolean;
  includeInputLinkInExcel: boolean; // include "Input Molex Link" column
  includeTimestampInExcel: boolean;
  includeIndexInExcel: boolean;
  customHeaders: Record<string, string>;
  stealthMode: boolean; // 🕵️ Stealth Mode toggle
  stealthOptions: StealthOptions;
}

export interface ExcelExportOptions {
  filename: string;
  sheetName: string;
  selectedOnly: boolean;
  includeInputLink: boolean;
  includeTimestamp: boolean;
  includeIndex: boolean;
}
