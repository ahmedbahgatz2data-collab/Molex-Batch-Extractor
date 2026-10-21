import * as XLSX from 'xlsx';
import { ExtractedRecord, ExcelExportOptions, UrlJob } from '../types/extractor';

export function exportRecordsToExcel(
  records: ExtractedRecord[],
  options: ExcelExportOptions,
  urlJobs: UrlJob[] = []
): { success: boolean; filename: string; rowCount: number } {
  const wb = XLSX.utils.book_new();

  // 1. Prepare Final Status Report Sheet
  // Maps all submitted URLs to their extraction status
  const statusHeaders = [
    '#',
    'Molex URL',
    'Link HTTP Status',
    'Extraction Status',
    'Parts Count',
    'Extracted Part Numbers',
    'Product Status',
    'Datasheet / Product Link',
    'Response Time (ms)',
    'Audit Notes & Details'
  ];

  const statusRows: (string | number)[][] = [statusHeaders];

  // If urlJobs exist, use them as source of truth for all links tested
  if (urlJobs.length > 0) {
    urlJobs.forEach((job, idx) => {
      const jobRecords = records.filter((r) => r.sourceUrl === job.url);
      const isExtracted = jobRecords.length > 0;
      
      let linkStatus = 'SUCCESS (200 OK)';
      let notes = 'Data retrieved and parsed successfully';

      if (job.status === 'error') {
        linkStatus = `ERROR: ${job.error || 'Failed'}`;
        notes = job.error || 'Network or firewall issue';
      } else if (job.status === 'loading') {
        linkStatus = 'IN PROGRESS';
        notes = 'Fetching in progress';
      } else if (!isExtracted) {
        linkStatus = 'EMPTY RESPONSE (No Data)';
        notes = 'Target API returned 0 parts or empty response';
      }

      const extractedStatus = isExtracted ? 'Extracted Successfully (YES)' : 'Not Extracted / Empty (NO)';
      const partNumbers = jobRecords.map(r => r.productNumberDisplay).filter(Boolean).join(', ') || '-';
      const partStatuses = jobRecords.map(r => r.productStatus).filter(Boolean).join(', ') || '-';
      const partPdfs = jobRecords.map(r => r.datasourcePdf).filter(Boolean).join(', ') || '-';

      statusRows.push([
        idx + 1,
        job.url,
        linkStatus,
        extractedStatus,
        jobRecords.length,
        partNumbers,
        partStatuses,
        partPdfs,
        job.durationMs ?? '-',
        notes
      ]);
    });
  } else {
    // If no jobs tracked, group records by sourceUrl
    const urlMap = new Map<string, ExtractedRecord[]>();
    records.forEach(r => {
      const list = urlMap.get(r.sourceUrl) || [];
      list.push(r);
      urlMap.set(r.sourceUrl, list);
    });

    let idx = 1;
    urlMap.forEach((recs, sourceUrl) => {
      statusRows.push([
        idx++,
        sourceUrl,
        'SUCCESS (200 OK)',
        'Extracted Successfully (YES)',
        recs.length,
        recs.map(r => r.productNumberDisplay).join(', '),
        recs.map(r => r.productStatus).join(', '),
        recs.map(r => r.datasourcePdf).join(', '),
        '-',
        'Extracted from session data'
      ]);
    });
  }

  const statusWs = XLSX.utils.aoa_to_sheet(statusRows);
  statusWs['!cols'] = [
    { wch: 6 },   // #
    { wch: 65 },  // URL
    { wch: 26 },  // Status
    { wch: 30 },  // Extracted?
    { wch: 14 },  // Count
    { wch: 32 },  // Part Numbers
    { wch: 22 },  // Product Status
    { wch: 55 },  // Datasheet / Link
    { wch: 18 },  // Response Time
    { wch: 42 },  // Notes
  ];

  // Auto-filter for status sheet
  if (statusRows.length > 1) {
    statusWs['!autofilter'] = { ref: `A1:J${statusRows.length}` };
  }

  // Hyperlinks in Status sheet
  statusRows.slice(1).forEach((row, i) => {
    const url = String(row[1] || '');
    if (url.startsWith('http://') || url.startsWith('https://')) {
      const cellRef = XLSX.utils.encode_cell({ r: i + 1, c: 1 });
      if (statusWs[cellRef]) {
        statusWs[cellRef].l = { Target: url, Tooltip: 'Open source Molex URL' };
      }
    }

    const detailUrl = String(row[7] || '');
    if (detailUrl.startsWith('http://') || detailUrl.startsWith('https://')) {
      const cellRef = XLSX.utils.encode_cell({ r: i + 1, c: 7 });
      if (statusWs[cellRef]) {
        statusWs[cellRef].l = { Target: detailUrl, Tooltip: 'Open Product Datasheet / Detail' };
      }
    }
  });

  XLSX.utils.book_append_sheet(wb, statusWs, 'Final Status Report');

  // 2. Prepare Detailed Molex Parts Catalog Sheet
  const headers: string[] = [];
  if (options.includeIndex) headers.push('#');
  if (options.includeInputLink) headers.push('Input Molex Link');
  headers.push('Product Number Display');
  headers.push('Product Number Hyphen');
  headers.push('Product Number SAP');
  headers.push('Product Status');
  headers.push('Datasheet PDF');
  headers.push('Extraction Status');
  if (options.includeTimestamp) headers.push('Extracted At');

  const rows: (string | number)[][] = [headers];

  records.forEach((rec, idx) => {
    const row: (string | number)[] = [];
    if (options.includeIndex) row.push(idx + 1);
    if (options.includeInputLink) row.push(rec.sourceUrl);
    row.push(rec.productNumberDisplay || '(Not Provided)');
    row.push(rec.productNumberHyphen || '');
    row.push(rec.productNumberSap || '');
    row.push(rec.productStatus || 'Not Specified');
    row.push(rec.datasourcePdf || '');
    row.push('Extracted Successfully');
    if (options.includeTimestamp) row.push(new Date(rec.extractedAt).toLocaleString());
    rows.push(row);
  });

  const ws = XLSX.utils.aoa_to_sheet(rows);

  // Column widths for parts sheet
  const colWidths = headers.map((header, colIdx) => {
    let maxLen = header.length;
    for (let r = 1; r < rows.length; r++) {
      const val = rows[r][colIdx];
      if (val !== undefined && val !== null) {
        const len = String(val).length;
        if (len > maxLen) maxLen = len;
      }
    }
    return { wch: Math.min(Math.max(maxLen + 3, 14), 65) };
  });
  ws['!cols'] = colWidths;

  if (rows.length > 1) {
    const lastColIndex = headers.length - 1;
    const lastColLetter = XLSX.utils.encode_col(lastColIndex);
    ws['!autofilter'] = { ref: `A1:${lastColLetter}${rows.length}` };
  }

  // Hyperlinks in Parts sheet
  records.forEach((rec, idx) => {
    const rowIndex = idx + 2;
    let colIdx = 0;
    if (options.includeIndex) colIdx++;
    if (options.includeInputLink) {
      if (rec.sourceUrl.startsWith('http://') || rec.sourceUrl.startsWith('https://')) {
        const cellRef = XLSX.utils.encode_cell({ r: rowIndex - 1, c: colIdx });
        if (ws[cellRef]) {
          ws[cellRef].l = { Target: rec.sourceUrl, Tooltip: 'Open source Molex JSON URL' };
        }
      }
      colIdx++;
    }

    colIdx += 4; // Skip Display, Hyphen, SAP, Status

    // Datasheet PDF hyperlink
    if (rec.datasourcePdf && (rec.datasourcePdf.startsWith('http://') || rec.datasourcePdf.startsWith('https://'))) {
      const pdfCellRef = XLSX.utils.encode_cell({ r: rowIndex - 1, c: colIdx });
      if (ws[pdfCellRef]) {
        ws[pdfCellRef].l = { Target: rec.datasourcePdf, Tooltip: 'Open Product Datasheet / Detail' };
      }
    }
  });

  const partsSheetTitle = (options.sheetName || 'Extracted Parts').slice(0, 31);
  XLSX.utils.book_append_sheet(wb, ws, partsSheetTitle);

  let filename = options.filename.trim();
  if (!filename.toLowerCase().endsWith('.xlsx')) {
    filename += '.xlsx';
  }

  XLSX.writeFile(wb, filename);

  return {
    success: true,
    filename,
    rowCount: records.length,
  };
}

export function exportFinalReportOnlyToExcel(
  urlJobs: UrlJob[],
  records: ExtractedRecord[],
  filename = 'molex_final_status_report.xlsx'
): { success: boolean; filename: string; totalUrls: number } {
  const wb = XLSX.utils.book_new();

  const statusHeaders = [
    '#',
    'Molex URL',
    'Link HTTP Status',
    'Extraction Status',
    'Parts Count',
    'Extracted Part Numbers',
    'Product Status',
    'Datasheet / Product Link',
    'Response Time (ms)',
    'Audit Notes & Error Details'
  ];

  const statusRows: (string | number)[][] = [statusHeaders];

  urlJobs.forEach((job, idx) => {
    const jobRecords = records.filter((r) => r.sourceUrl === job.url);
    const isExtracted = jobRecords.length > 0;
    
    let linkStatus = 'SUCCESS (200 OK)';
    let notes = 'Data retrieved and parsed successfully';

    if (job.status === 'error') {
      linkStatus = `ERROR: ${job.error || 'Failed'}`;
      notes = job.error || 'Network or firewall issue';
    } else if (job.status === 'loading') {
      linkStatus = 'IN PROGRESS';
      notes = 'Fetching in progress';
    } else if (!isExtracted) {
      linkStatus = 'EMPTY (No Data Found)';
      notes = 'Target API returned 0 parts or empty response';
    }

    const extractedStatus = isExtracted ? 'Extracted Successfully (YES)' : 'Not Extracted / Empty (NO)';
    const partNumbers = jobRecords.map(r => r.productNumberDisplay).filter(Boolean).join(', ') || '-';
    const partStatuses = jobRecords.map(r => r.productStatus).filter(Boolean).join(', ') || '-';
    const partPdfs = jobRecords.map(r => r.datasourcePdf).filter(Boolean).join(', ') || '-';

    statusRows.push([
      idx + 1,
      job.url,
      linkStatus,
      extractedStatus,
      jobRecords.length,
      partNumbers,
      partStatuses,
      partPdfs,
      job.durationMs ?? '-',
      notes
    ]);
  });

  const ws = XLSX.utils.aoa_to_sheet(statusRows);
  ws['!cols'] = [
    { wch: 6 },
    { wch: 65 },
    { wch: 28 },
    { wch: 30 },
    { wch: 14 },
    { wch: 32 },
    { wch: 22 },
    { wch: 55 },
    { wch: 18 },
    { wch: 42 },
  ];

  if (statusRows.length > 1) {
    ws['!autofilter'] = { ref: `A1:J${statusRows.length}` };
  }

  statusRows.slice(1).forEach((row, i) => {
    const url = String(row[1] || '');
    if (url.startsWith('http://') || url.startsWith('https://')) {
      const cellRef = XLSX.utils.encode_cell({ r: i + 1, c: 1 });
      if (ws[cellRef]) {
        ws[cellRef].l = { Target: url, Tooltip: 'Open source Molex link' };
      }
    }
    const detailUrl = String(row[7] || '');
    if (detailUrl.startsWith('http://') || detailUrl.startsWith('https://')) {
      const cellRef = XLSX.utils.encode_cell({ r: i + 1, c: 7 });
      if (ws[cellRef]) {
        ws[cellRef].l = { Target: detailUrl, Tooltip: 'Open Product Datasheet / Detail' };
      }
    }
  });

  XLSX.utils.book_append_sheet(wb, ws, 'Final Status Report');

  let cleanName = filename.trim();
  if (!cleanName.toLowerCase().endsWith('.xlsx')) {
    cleanName += '.xlsx';
  }

  XLSX.writeFile(wb, cleanName);

  return {
    success: true,
    filename: cleanName,
    totalUrls: urlJobs.length,
  };
}

export function exportRecordsToCsv(records: ExtractedRecord[], filename = 'molex_parts_extracted.csv'): void {
  const headers = ['Input Molex Link', 'Product Number Display', 'Product Number Hyphen', 'Product Number SAP', 'Product Status', 'Datasheet PDF', 'Extraction Status', 'Extracted At'];
  const rows = records.map((r) => [
    `"${(r.sourceUrl || '').replace(/"/g, '""')}"`,
    `"${(r.productNumberDisplay || '').replace(/"/g, '""')}"`,
    `"${(r.productNumberHyphen || '').replace(/"/g, '""')}"`,
    `"${(r.productNumberSap || '').replace(/"/g, '""')}"`,
    `"${(r.productStatus || '').replace(/"/g, '""')}"`,
    `"${(r.datasourcePdf || '').replace(/"/g, '""')}"`,
    `"Extracted Successfully (YES)"`,
    `"${r.extractedAt}"`,
  ]);

  const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename.endsWith('.csv') ? filename : `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function copyRecordsToClipboard(records: ExtractedRecord[]): Promise<boolean> {
  const headers = ['Input Molex Link', 'Product Number Display', 'Product Number Hyphen', 'Product Number SAP', 'Product Status', 'Datasheet PDF', 'Extraction Status'];
  const rows = records.map((r) => [
    r.sourceUrl,
    r.productNumberDisplay,
    r.productNumberHyphen,
    r.productNumberSap,
    r.productStatus,
    r.datasourcePdf,
    'Extracted Successfully (YES)',
  ]);
  const tsvContent = [headers.join('\t'), ...rows.map((row) => row.join('\t'))].join('\n');
  return navigator.clipboard.writeText(tsvContent).then(() => true).catch(() => false);
}
