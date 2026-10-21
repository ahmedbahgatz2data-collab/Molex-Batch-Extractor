import * as XLSX from 'xlsx';
import { ExtractedRecord, ExcelExportOptions, UrlJob } from '../types/extractor';

export function exportRecordsToExcel(
  records: ExtractedRecord[],
  options: ExcelExportOptions,
  urlJobs: UrlJob[] = []
): { success: boolean; filename: string; rowCount: number } {
  const wb = XLSX.utils.book_new();

  // 1. Prepare Main Molex Data Sheet with datasourcePdf
  const headers: string[] = [];
  if (options.includeIndex) headers.push('#');
  if (options.includeInputLink) headers.push('Input Molex Link');
  headers.push('Product Number Display');
  headers.push('Product Number Hyphen');
  headers.push('Product Number SAP');
  headers.push('Product Status');
  headers.push('Datasheet PDF');
  if (options.includeTimestamp) headers.push('Extracted At');

  const rows: (string | number)[][] = [headers];

  records.forEach((rec, idx) => {
    const row: (string | number)[] = [];
    if (options.includeIndex) row.push(idx + 1);
    if (options.includeInputLink) row.push(rec.sourceUrl);
    row.push(rec.productNumberDisplay || '(Not Provided)');
    row.push(rec.productNumberHyphen || '');
    row.push(rec.productNumberSap || '');
    row.push(rec.productStatus || 'Unpublished');
    row.push(rec.datasourcePdf || '');
    if (options.includeTimestamp) row.push(new Date(rec.extractedAt).toLocaleString());
    rows.push(row);
  });

  const ws = XLSX.utils.aoa_to_sheet(rows);

  // Calculate auto column widths
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

  // Add autofilter range for Excel table filtering
  if (rows.length > 1) {
    const lastColIndex = headers.length - 1;
    const lastColLetter = XLSX.utils.encode_col(lastColIndex);
    ws['!autofilter'] = { ref: `A1:${lastColLetter}${rows.length}` };
  }

  // Add hyperlinks for Molex URLs and Datasheet PDFs in the sheet
  records.forEach((rec, idx) => {
    const rowIndex = idx + 2; // 1-indexed, row 1 is header
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

    // Skip Display, Hyphen, SAP, Status columns (4 columns)
    colIdx += 4;

    // Datasheet PDF hyperlink
    if (rec.datasourcePdf && (rec.datasourcePdf.startsWith('http://') || rec.datasourcePdf.startsWith('https://'))) {
      const pdfCellRef = XLSX.utils.encode_cell({ r: rowIndex - 1, c: colIdx });
      if (ws[pdfCellRef]) {
        ws[pdfCellRef].l = { Target: rec.datasourcePdf, Tooltip: 'Open Datasheet PDF' };
      }
    }
  });

  const sheetTitle = (options.sheetName || 'Molex Parts').slice(0, 31);
  XLSX.utils.book_append_sheet(wb, ws, sheetTitle);

  // 2. Prepare Source Audit Summary Sheet
  if (urlJobs.length > 0) {
    const summaryHeaders = ['Source Molex Link', 'Fetch Status', 'Records Found', 'Latency (ms)', 'Error / Protection Details'];
    const summaryRows: (string | number)[][] = [summaryHeaders];

    urlJobs.forEach((job) => {
      summaryRows.push([
        job.url,
        job.status.toUpperCase(),
        job.itemsFound,
        job.durationMs ?? '-',
        job.error || 'None'
      ]);
    });

    const summaryWs = XLSX.utils.aoa_to_sheet(summaryRows);
    summaryWs['!cols'] = [
      { wch: 55 },
      { wch: 14 },
      { wch: 16 },
      { wch: 14 },
      { wch: 35 }
    ];
    XLSX.utils.book_append_sheet(wb, summaryWs, 'Source Links Audit');
  }

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

export function exportRecordsToCsv(records: ExtractedRecord[], filename = 'molex_parts_extracted.csv'): void {
  const headers = ['Input Molex Link', 'Product Number Display', 'Product Number Hyphen', 'Product Number SAP', 'Product Status', 'Datasheet PDF', 'Extracted At'];
  const rows = records.map((r) => [
    `"${(r.sourceUrl || '').replace(/"/g, '""')}"`,
    `"${(r.productNumberDisplay || '').replace(/"/g, '""')}"`,
    `"${(r.productNumberHyphen || '').replace(/"/g, '""')}"`,
    `"${(r.productNumberSap || '').replace(/"/g, '""')}"`,
    `"${(r.productStatus || '').replace(/"/g, '""')}"`,
    `"${(r.datasourcePdf || '').replace(/"/g, '""')}"`,
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
  const headers = ['Input Molex Link', 'Product Number Display', 'Product Number Hyphen', 'Product Number SAP', 'Product Status', 'Datasheet PDF'];
  const rows = records.map((r) => [
    r.sourceUrl,
    r.productNumberDisplay,
    r.productNumberHyphen,
    r.productNumberSap,
    r.productStatus,
    r.datasourcePdf,
  ]);
  const tsvContent = [headers.join('\t'), ...rows.map((row) => row.join('\t'))].join('\n');
  return navigator.clipboard.writeText(tsvContent).then(() => true).catch(() => false);
}
