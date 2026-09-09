import fs from 'node:fs/promises';
import { FileBlob, SpreadsheetFile } from '@oai/artifact-tool';
const path='outputs/orcamento_dispositivos/orcamento_dispositivos.xlsx';
const wb=await SpreadsheetFile.importXlsx(await FileBlob.load(path));
const ws=wb.worksheets.getItem('Orçamento');
ws.getRange('A21:E21').clear({applyTo:'all'});
ws.getRange('A22:E36').values=[
 ['Placa 2x4"',null,null,null,'Quantidade não visível no print'],
 ['Placa c/ furo',4,null,null,''],
 ['Placa p/ 1 função',34,null,null,''],
 ['Placa p/ 2 funções',7,null,null,''],
 ['Placa p/ 3 funções',4,null,null,''],
 ['Pulsador campainha - 1 tecla',7,null,null,''],
 ['Pulsador campainha - 2 teclas',1,null,null,''],
 ['Tomada hexagonal (NBR 14136) 2P+T 10A',4,null,null,''],
 ['S/ placa',null,null,null,'Quantidade não visível no print'],
 ['Entrada USB',2,null,null,''],
 ['Interruptor 1 tecla simples e tomada hexagonal (NBR14136)',1,null,null,''],
 ['Tomada hexagonal (NBR 14136) (2) 2P+T 10A',4,null,null,''],
 ['Tomada hexagonal (NBR 14136) (3) 2P+T 20A',4,null,null,''],
 ['Tomada hexagonal (NBR 14136) 2P+T 10A',23,null,null,''],
 ['Tomada hexagonal (NBR 14136) 2P+T 20A',13,null,null,''],
];
ws.getRange('D22').formulas=[['=IF(OR(B22="",C22=""),"",B22*C22)']]; ws.getRange('D22:D36').fillDown();
ws.getRange('A38:C38').merge(); ws.getRange('A38').values=[['TOTAL GERAL']]; ws.getRange('D38').formulas=[['=SUM(D5:D36)']];
ws.getRange('A22:A36').format={fill:'#FFFFFF',font:{bold:false,color:'#1F1F1F'},wrapText:true};
ws.getRange('B22:C36').format={fill:'#FFF2CC',horizontalAlignment:'right'}; ws.getRange('D22:D36').format={fill:'#E2F0D9',horizontalAlignment:'right'}; ws.getRange('E22:E36').format={font:{italic:true,color:'#666666'},wrapText:true};
ws.getRange('B22:B36').format.numberFormat='#,##0'; ws.getRange('C22:D36').format.numberFormat='R$ #,##0.00'; ws.getRange('A22:E36').format.borders={insideHorizontal:{style:'thin',color:'#D9E2F3'},bottom:{style:'thin',color:'#D9E2F3'}}; ws.getRange('A22:E36').format.rowHeight=24;
ws.getRange('A38:D38').format={fill:'#D9EAD3',font:{bold:true,color:'#1F1F1F'},borders:{preset:'doubleBottom',style:'double',color:'#548235'}};
const errors=await wb.inspect({kind:'match',searchTerm:'#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A',options:{useRegex:true,maxResults:100},summary:'formula error scan'}); console.log(errors.ndjson);
const preview=await wb.render({sheetName:'Orçamento',range:'A1:E38',scale:1.5,format:'png'}); await fs.writeFile('outputs/orcamento_dispositivos/preview.png',new Uint8Array(await preview.arrayBuffer()));
await (await SpreadsheetFile.exportXlsx(wb)).save(path);
