import fs from 'node:fs/promises';
import { SpreadsheetFile, Workbook } from '@oai/artifact-tool';

const outDir = 'outputs/orcamento_dispositivos';
await fs.mkdir(outDir, { recursive: true });
const wb = Workbook.create();
const ws = wb.worksheets.add('Orçamento');
ws.showGridLines = false;

ws.getRange('A1:E1').merge();
ws.getRange('A1').values = [['ORÇAMENTO DE INSTALAÇÃO — DISPOSITIVOS INTELIGENTES']];
ws.getRange('A2:E2').merge();
ws.getRange('A2').values = [['Preencha o valor unitário de cada item; o total por item e o total geral são calculados automaticamente.']];
ws.getRange('A4:E4').values = [['Dispositivo', 'Quantidade', 'Valor unitário (R$)', 'Total (R$)', 'Observações']];
ws.getRange('A5:E12').values = [
  ['Placa 2x4', null, null, null, 'Quantidade não visível no print'],
  ['Placa p/ 1 função', 16, null, null, ''],
  ['Placa p/ 2 funções', 3, null, null, ''],
  ['S/ placa', null, null, null, 'Quantidade não visível no print'],
  ['Interruptor 1 tecla paralela e tomada hexagonal (NBR 14136)', 1, null, null, ''],
  ['Tomada hexagonal (NBR 14136) (2) 2P+T 10A', 2, null, null, ''],
  ['Tomada hexagonal (NBR 14136) 2P+T 10A', 11, null, null, ''],
  ['Tomada hexagonal (NBR 14136) 2P+T 20A', 5, null, null, ''],
];
ws.getRange('D5').formulas = [['=IF(OR(B5="",C5=""),"",B5*C5)']];
ws.getRange('D5:D12').fillDown();
ws.getRange('A14:C14').merge();
ws.getRange('A14').values = [['TOTAL GERAL']];
ws.getRange('D14').formulas = [['=SUM(D5:D12)']];

ws.getRange('A1:E1').format = { fill: '#17365D', font: { bold: true, color: '#FFFFFF', size: 15 }, horizontalAlignment: 'center', verticalAlignment: 'center' };
ws.getRange('A2:E2').format = { fill: '#D9EAF7', font: { italic: true, color: '#404040' }, wrapText: true };
ws.getRange('A4:E4').format = { fill: '#2F75B5', font: { bold: true, color: '#FFFFFF' }, horizontalAlignment: 'center', verticalAlignment: 'center', wrapText: true };
ws.getRange('A5:A12').format = { font: { color: '#1F1F1F' }, wrapText: true };
ws.getRange('B5:C12').format = { fill: '#FFF2CC', horizontalAlignment: 'right' };
ws.getRange('D5:D12').format = { fill: '#E2F0D9', horizontalAlignment: 'right' };
ws.getRange('E5:E12').format = { font: { italic: true, color: '#666666' }, wrapText: true };
ws.getRange('A14:D14').format = { fill: '#D9EAD3', font: { bold: true, color: '#1F1F1F' }, borders: { preset: 'doubleBottom', style: 'double', color: '#548235' } };
ws.getRange('B5:B12').format.numberFormat = '#,##0';
ws.getRange('C5:D14').format.numberFormat = 'R$ #,##0.00';
ws.getRange('A4:E12').format.borders = { insideHorizontal: { style: 'thin', color: '#D9E2F3' }, bottom: { style: 'thin', color: '#D9E2F3' } };
ws.getRange('A1:E1').format.rowHeight = 30;
ws.getRange('A2:E2').format.rowHeight = 28;
ws.getRange('A4:E4').format.rowHeight = 30;
ws.getRange('A5:E12').format.rowHeight = 24;
ws.getRange('A:A').format.columnWidth = 58;
ws.getRange('B:B').format.columnWidth = 12;
ws.getRange('C:D').format.columnWidth = 18;
ws.getRange('E:E').format.columnWidth = 34;
ws.freezePanes.freezeRows(4);

const check = await wb.inspect({ kind: 'table', range: 'Orçamento!A1:E14', include: 'values,formulas', tableMaxRows: 20, tableMaxCols: 8 });
console.log(check.ndjson);
const errors = await wb.inspect({ kind: 'match', searchTerm: '#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A', options: { useRegex: true, maxResults: 100 }, summary: 'formula error scan' });
console.log(errors.ndjson);
const preview = await wb.render({ sheetName: 'Orçamento', range: 'A1:E14', scale: 1.5, format: 'png' });
await fs.writeFile(`${outDir}/preview.png`, new Uint8Array(await preview.arrayBuffer()));
const xlsx = await SpreadsheetFile.exportXlsx(wb);
await xlsx.save(`${outDir}/orcamento_dispositivos.xlsx`);
