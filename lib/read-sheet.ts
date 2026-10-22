export type Sheet={name:string;rows:string[][]};
export function parseCSV(text:string):string[][] {
 const rows:string[][]=[];let row:string[]=[],field='',quoted=false;
 for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){field+='"';i++;}else quoted=!quoted;}
 else if(c===','&&!quoted){row.push(field);field='';}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(field);rows.push(row);row=[];field='';}else field+=c;}
 if(quoted)throw Error('CSV引号未闭合');if(field||row.length){row.push(field);rows.push(row);}return rows;
}
export async function readSheet(file:File):Promise<Sheet[]>{
 if(file.size>10*1024*1024)throw Error('统计表最大10MB');
 if(/\.csv$/i.test(file.name))return[{name:'CSV',rows:parseCSV((await file.text()).replace(/^\uFEFF/,''))}];
 if(!/\.xlsx$/i.test(file.name))throw Error('支持.xlsx和UTF-8编码的.csv文件');
 const bytes=new Uint8Array(await file.arrayBuffer()),v=new DataView(bytes.buffer);let end=-1;
 for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--)if(v.getUint32(i,true)===0x06054b50){end=i;break;}
 if(end<0)throw Error('Excel文件结构无效');const count=v.getUint16(end+10,true);if(count>2000)throw Error('Excel内容过多');let cursor=v.getUint32(end+16,true);
 const files=new Map<string,{at:number;size:number;method:number;expanded:number}>();const decoder=new TextDecoder();
 for(let i=0;i<count;i++){if(v.getUint32(cursor,true)!==0x02014b50)throw Error('Excel目录损坏');const len=v.getUint16(cursor+28,true),extra=v.getUint16(cursor+30,true),comment=v.getUint16(cursor+32,true);files.set(decoder.decode(bytes.slice(cursor+46,cursor+46+len)),{at:v.getUint32(cursor+42,true),size:v.getUint32(cursor+20,true),expanded:v.getUint32(cursor+24,true),method:v.getUint16(cursor+10,true)});cursor+=46+len+extra+comment;}
 let total=0;
 async function xml(name:string){const f=files.get(name);if(!f)return null;if(f.expanded>20*1024*1024)throw Error('工作表解压后过大');const start=f.at+30+v.getUint16(f.at+26,true)+v.getUint16(f.at+28,true);let data=bytes.slice(start,start+f.size);
  if(f.method===8){const reader=new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw')).getReader();const chunks:Uint8Array[]=[];let size=0;while(true){const r=await reader.read();if(r.done)break;size+=r.value.length;if(size>20*1024*1024){await reader.cancel();throw Error('工作表过大');}chunks.push(r.value);}data=new Uint8Array(size);let offset=0;for(const c of chunks){data.set(c,offset);offset+=c.length;}}
  else if(f.method!==0)throw Error('不支持该Excel压缩方式');total+=data.length;if(total>40*1024*1024)throw Error('工作簿过大');const text=decoder.decode(data);if(/<!DOCTYPE|<!ENTITY/i.test(text))throw Error('不支持包含实体定义的表格');const parsed=new DOMParser().parseFromString(text,'application/xml');if(parsed.querySelector('parsererror'))throw Error('表格XML无效');return parsed;
 }
 const shared=await xml('xl/sharedStrings.xml');const strings=shared?Array.from(shared.getElementsByTagName('si'),n=>n.textContent||''):[];
 const workbook=await xml('xl/workbook.xml'),rels=await xml('xl/_rels/workbook.xml.rels');if(!workbook||!rels)throw Error('缺少工作簿信息');
 const targets=new Map(Array.from(rels.getElementsByTagName('Relationship'),n=>[n.getAttribute('Id'),n.getAttribute('Target')||'']));const sheets:Sheet[]=[];
 for(const sheet of Array.from(workbook.getElementsByTagName('sheet'))){const target=targets.get(sheet.getAttribute('r:id'))||'';const doc=await xml(target.startsWith('/')?target.slice(1):'xl/'+target);if(!doc)continue;const rows:string[][]=[];
  for(const row of Array.from(doc.getElementsByTagName('row'))){const values:string[]=[];for(const c of Array.from(row.getElementsByTagName('c'))){const ref=c.getAttribute('r')||'A1';let col=0;for(const char of ref.replace(/\d/g,''))col=col*26+char.charCodeAt(0)-64;if(col>100)continue;const value=c.getElementsByTagName('v')[0]?.textContent||'';values[col-1]=c.getAttribute('t')==='s'?(strings[Number(value)]||''):c.getAttribute('t')==='inlineStr'?(c.getElementsByTagName('is')[0]?.textContent||''):value;}if(values.some(v=>v.trim()))rows.push(values);if(rows.length>1001)throw Error('每张表最多1000条数据');}
  if(rows.length)sheets.push({name:sheet.getAttribute('name')||'工作表',rows});
 }if(!sheets.length)throw Error('没有非空工作表');return sheets;
}
