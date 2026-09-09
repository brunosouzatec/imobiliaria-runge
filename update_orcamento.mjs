import fs from 'node:fs/promises';
import { FileBlob, SpreadsheetFile } from '@oai/artifact-tool';

const path = 'outputs/orcamento_dispositivos/orcamento_dispositivos.xlsx';
const input = await FileBlob.load(path);
const wb = await SpreadsheetFile.importXlsx(input);
const ws = wb.worksheets.getItem('Orçamento');

ws.getRange('A13:E19').values = [
  ['Placa 2x4"', null, null, null, 'Quantidade não visível no print'],
  ['Interruptor paralelo - 1 tecla', 1, null, null, ''],
  ['Interruptor paralelo - 3 teclas', 1, null, null, ''],
  ['Interruptor simples - 2 teclas', 16, null, null, ''],
  ['Pulsador campainha - 2 teclas', 1, null, null, ''],
  ['Placa 4x4"', null, null, null, 'Quantidade não visível no print'],
  ['Interruptor 2 teclas simples', 10, null, null, ''],
];
ws.getRange('D13').formulas = [['=IF(OR(B13="",C13=""),"",B13*C13)']];
ws.getRange('D13:D19').fillDown();
ws.getRange('A21:C21').merge();
ws.getRange('A21').values = [['TOTAL GERAL']];
ws.getRange('D21').formulas = [['=SUM(D5:D19)']];

ws.getRange('A13:A19').format = { font: { color: '#1F1F1F' }, wrapText: true };
ws.getRange('A13:A19').format.fill = '#FFFFFF';
ws.getRange('A13:A19').format.font = { bold: false, color: '#1F1F1F' };
ws.getRange('B13:C19').format = { fill: '#FFF2CC', horizontalAlignment: 'right' };
ws.getRange('D13:D19').format = { fill: '#E2F0D9', horizontalAlignment: 'right' };
ws.getRange('E13:E19').format = { font: { italic: true, color: '#666666' }, wrapText: true };
ws.getRange('B13:B19').format.numberFormat = '#,##0';
ws.getRange('C13:D19').format.numberFormat = 'R$ #,##0.00';
ws.getRange('A13:E19').format.borders = { insideHorizontal: { style: 'thin', color: '#D9E2F3' }, bottom: { style: 'thin', color: '#D9E2F3' } };
ws.getRange('A13:E19').format.rowHeight = 24;
ws.getRange('A21:D21').format = { fill: '#D9EAD3', font: { bold: true, color: '#1F1F1F' }, borders: { preset: 'doubleBottom', style: 'double', color: '#548235' } };

const check = await wb.inspect({ kind: 'table', range: 'Orçamento!A13:E21', include: 'values,formulas', tableMaxRows: 12, tableMaxCols: 8 });
console.log(check.ndjson);
const errors = await wb.inspect({ kind: 'match', searchTerm: '#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A', options: { useRegex: true, maxResults: 100 }, summary: 'formula error scan' });
console.log(errors.ndjson);
const preview = await wb.render({ sheetName: 'Orçamento', range: 'A1:E21', scale: 1.5, format: 'png' });
await fs.writeFile('outputs/orcamento_dispositivos/preview.png', new Uint8Array(await preview.arrayBuffer()));
const xlsx = await SpreadsheetFile.exportXlsx(wb);
await xlsx.save(path);
