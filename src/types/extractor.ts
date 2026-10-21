export interface ExtractedRecord {
  id: string;
  sourceUrl: string; // The input Molex JSON link
  productNumberDisplay: string;
  productNumberHyphen: string;
  productNumberSap: string;
  productStatus: string;
  datasourcePdf: string; // Added datasheetPDF field
  description?: string;
  extractedAt: string;
  rawItem?: Record<string, unknown>;
  fieldFlags: {
    hasDisplay: boolean;
    hasHyphen: boolean;
    hasSap: boolean;
    hasStatus: boolean;
    hasDatasheet: boolean;
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
  customCookies?: string;
  customProxyUrl?: string;
}

export interface ExtractionConfig {
  strictMode: boolean;
  resolveRelativeUrls: boolean;
  includeInputLinkInExcel: boolean;
  includeTimestampInExcel: boolean;
  includeIndexInExcel: boolean;
  customHeaders: Record<string, string>;
  stealthMode: boolean;
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
