import { env } from 'cloudflare:workers';
import { getAppUser } from '../../auth';
export const dynamic='force-dynamic';
const json=(d:any,status=200)=>Response.json(d,{status,headers:{'Cache-Control':'no-store'}});
async function admin(){const u=await getAppUser();return u&&await env.DB!.prepare('SELECT id FROM admins WHERE id=?').bind(u.userId).first()?u:null;}
export async function GET(req:Request){try{
 const id=new URL(req.url).searchParams.get('id');const r=await env.DB!.prepare("SELECT * FROM records WHERE id=? AND kind IN ('video','image')").bind(id).first<any>();
 if(!r||(r.status!=='published'&&!await admin()))return new Response('未找到文件',{status:404});
 const d=JSON.parse(r.data);const range=req.headers.get('range');
 const object=await env.BUCKET!.get(d.key,range?{range:req.headers}:undefined);if(!object)return new Response('文件不存在',{status:404});
 const headers=new Headers({'Content-Type':d.mime,'Accept-Ranges':'bytes','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'});
 if(object.range&&'offset' in object.range){const offset=object.range.offset??0;const length=object.range.length??(object.size-offset);headers.set('Content-Range',`bytes ${offset}-${offset+length-1}/${object.size}`);headers.set('Content-Length',String(length));return new Response(object.body,{status:206,headers});}
 headers.set('Content-Length',String(object.size));return new Response(object.body,{headers});
 }catch{return new Response('无法读取录像',{status:416});}}
export async function POST(req:Request){try{
 const origin=req.headers.get('origin');if(origin&&origin!==new URL(req.url).origin)return json({error:'禁止跨站上传'},403);
 const u=await admin();if(!u)return json({error:'需要管理员权限'},403);
 const url=new URL(req.url),action=url.searchParams.get('action');
 if(action==='init'){
  const b:any=await req.json();if(!['video/mp4','video/webm','image/png','image/jpeg','image/webp'].includes(b.mime)||!Number.isSafeInteger(b.size)||b.size<1||b.size>5*1024**3)return json({error:'支持MP4/WebM及PNG/JPEG/WebP，单文件上限5GB'},400);
  if(!b.title?.trim()||b.title.length>300)return json({error:'请填写标题（最多300字）'},400);
  const id=crypto.randomUUID(),key='media/'+id;const upload=await env.BUCKET!.createMultipartUpload(key,{httpMetadata:{contentType:b.mime}});
  await env.DB!.prepare('INSERT INTO uploads(id,key,upload_id,owner,data,created_at) VALUES(?,?,?,?,?,?)').bind(id,key,upload.uploadId,u.userId,JSON.stringify({title:b.title,mime:b.mime,size:b.size,gameId:String(b.gameId||''),description:String(b.description||'').slice(0,15000),season:String(b.season||''),opponent:String(b.opponent||''),duration:typeof b.duration==='number'?b.duration:null,parts:[],received:0}),new Date().toISOString()).run();return json({id});
 }
 const r=await env.DB!.prepare('SELECT * FROM uploads WHERE id=? AND owner=?').bind(url.searchParams.get('id'),u.userId).first<any>();if(!r)return json({error:'上传会话不存在'},404);
 const d=JSON.parse(r.data);const upload=env.BUCKET!.resumeMultipartUpload(r.key,r.upload_id);
 if(action==='abort'){await upload.abort();await env.DB!.prepare('DELETE FROM uploads WHERE id=?').bind(r.id).run();return json({ok:true});}
 if(action==='part'){
  const n=Number(url.searchParams.get('part'));if(n!==d.parts.length+1)return json({error:'分片顺序不正确'},400);
  const data=await req.arrayBuffer();if(!data.byteLength||data.byteLength>8*1024*1024||d.received+data.byteLength>d.size)return json({error:'分片大小不正确'},400);
  if(n===1){const v=new Uint8Array(data);const mime=d.mime;
   const valid=mime==='video/mp4'?String.fromCharCode(...v.slice(4,8))==='ftyp':mime==='video/webm'?v[0]===26&&v[1]===69&&v[2]===223&&v[3]===163:mime==='image/png'?v[0]===137&&v[1]===80:mime==='image/jpeg'?v[0]===255&&v[1]===216:String.fromCharCode(...v.slice(0,4))==='RIFF'&&String.fromCharCode(...v.slice(8,12))==='WEBP';if(!valid)return json({error:'文件内容与格式不符'},400);}
  d.parts.push(await upload.uploadPart(n,data));d.received+=data.byteLength;await env.DB!.prepare('UPDATE uploads SET data=? WHERE id=?').bind(JSON.stringify(d),r.id).run();return json({ok:true,received:d.received});
 }
 if(action==='complete'){
  if(d.received!==d.size)return json({error:'文件尚未完整上传'},400);
  await upload.complete(d.parts);const {parts,received,...meta}=d;const time=new Date().toISOString();
  await env.DB!.batch([env.DB!.prepare('INSERT INTO records(id,kind,status,data,created_at,updated_at) VALUES(?,?,?,?,?,?)').bind(r.id,d.mime.startsWith('video/')?'video':'image','draft',JSON.stringify({...meta,key:r.key}),time,time),env.DB!.prepare('DELETE FROM uploads WHERE id=?').bind(r.id)]);return json({id:r.id});
 }return json({error:'未知上传操作'},400);
 }catch(e){return json({error:(e as Error).message},400);}}
