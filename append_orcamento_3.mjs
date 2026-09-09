import fs from 'node:fs/promises';
import { FileBlob, SpreadsheetFile } from '@oai/artifact-tool';
const path='outputs/orcamento_dispositivos/orcamento_dispositivos.xlsx';
const wb=await SpreadsheetFile.importXlsx(await FileBlob.load(path)); const ws=wb.worksheets.getItem('Orçamento');
ws.getRange('A40:E52').values=[
 ['Placa 2x4"',null,null,null,'Quantidade não visível no print'],
 ['Interruptor paralelo - 1 tecla',5,null,null,''],
 ['Interruptor simples - 1 tecla',6,null,null,''],
 ['Interruptor simples - 2 teclas',2,null,null,''],
 ['Placa c/ furo',3,null,null,''],
 ['Placa cega',1,null,null,''],
 ['Placa p/ 1 função',12,null,null,''],
 ['Placa p/ 2 funções',2,null,null,''],
 ['Placa p/ 3 funções',1,null,null,''],
 ['S/ placa',null,null,null,'Quantidade não visível no print'],
 ['Tomada hexagonal (NBR 14136) (2) 2P+T 10A',2,null,null,''],
 ['Tomada hexagonal (NBR 14136) (3) 2P+T 20A',1,null,null,''],
 ['Tomada hexagonal (NBR 14136) 2P+T 10A',12,null,null,''],
];
ws.getRange('D40').formulas=[['=IF(OR(B40="",C40=""),"",B40*C40)']]; ws.getRange('D40:D52').fillDown();
ws.getRange('A54:C54').merge(); ws.getRange('A54').values=[['TOTAL GERAL']]; ws.getRange('D54').formulas=[['=SUM(D5:D52)']];
ws.getRange('A40:A52').format={fill:'#FFFFFF',font:{bold:false,color:'#1F1F1F'},wrapText:true}; ws.getRange('B40:C52').format={fill:'#FFF2CC',horizontalAlignment:'right'}; ws.getRange('D40:D52').format={fill:'#E2F0D9',horizontalAlignment:'right'}; ws.getRange('E40:E52').format={font:{italic:true,color:'#666666'},wrapText:true};
ws.getRange('B40:B52').format.numberFormat='#,##0'; ws.getRange('C40:D52').format.numberFormat='R$ #,##0.00'; ws.getRange('A40:E52').format.borders={insideHorizontal:{style:'thin',color:'#D9E2F3'},bottom:{style:'thin',color:'#D9E2F3'}}; ws.getRange('A40:E52').format.rowHeight=24; ws.getRange('A54:D54').format={fill:'#D9EAD3',font:{bold:true,color:'#1F1F1F'},borders:{preset:'doubleBottom',style:'double',color:'#548235'}};
const e=await wb.inspect({kind:'match',searchTerm:'#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A',options:{useRegex:true,maxResults:100},summary:'formula error scan'}); console.log(e.ndjson);
const p=await wb.render({sheetName:'Orçamento',range:'A1:E54',scale:1.2,format:'png'}); await fs.writeFile('outputs/orcamento_dispositivos/preview.png',new Uint8Array(await p.arrayBuffer())); await (await SpreadsheetFile.exportXlsx(wb)).save(path);
