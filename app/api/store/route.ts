import { env } from 'cloudflare:workers';
import { getAppUser } from '../../auth';
import { analyzeRows, keys } from '../../../lib/stats';
import { tactics } from '../../../lib/tactics';
import { z } from 'zod';
export const dynamic='force-dynamic';
const db=()=>env.DB!;
const bucket=()=>env.BUCKET!;
const now=()=>new Date().toISOString();
function out(data:any,status=200){return Response.json(data,{status,headers:{'Cache-Control':'no-store'}});}
async function identity(){const user=await getAppUser();const admin=user?await db().prepare('SELECT id FROM admins WHERE id=?').bind(user.userId).first():null;return {user,admin:!!admin};}
function sameOrigin(req:Request){const origin=req.headers.get('origin');if(origin&&origin!==new URL(req.url).origin)throw Error('禁止跨站写入');}
function shape(row:any){return {...JSON.parse(row.data),id:row.id,kind:row.kind,status:row.status,createdAt:row.created_at,updatedAt:row.updated_at};}
const short=z.string().max(300);const long=z.string().max(15000);const optional=short.optional().default('');
const schemas:Record<string,z.ZodTypeAny>={
 player:z.object({name:short.min(1),number:optional,position:optional,bio:long.optional().default('')}),
 opponent:z.object({name:short.min(1),team:short.min(1),number:optional,position:optional,height:optional,hand:optional,shooting:optional,driving:optional,passing:optional,rebounding:optional,defense:optional,strengths:long,weaknesses:long,advice:long,source:short.min(1),date:short.min(1),certainty:z.enum(['观察判断','未经确认','客观资料']),gameId:optional,videoId:optional}),
 game:z.object({title:short.min(1),date:short.min(1),season:short.min(1),opponent:short.min(1),score:z.number().int().min(0).nullable(),opponentScore:z.number().int().min(0).nullable(),review:long.optional().default(''),quarterMinutes:z.number().int().min(1).max(30).default(10)}),
 tactic:z.object({title:short.min(1),baseId:z.string().refine(v=>tactics.some(t=>t.id===v)),description:long,bindings:z.record(z.string(),short).default({})}),
 video:z.object({title:short.min(1),description:long,gameId:optional,season:optional,opponent:optional,duration:z.number().min(0).nullable().optional()}),
 image:z.object({title:short.min(1),description:long.optional().default(''),gameId:optional}),
 team:z.object({name:short.min(1),description:long,color:z.string().regex(/^#[0-9a-fA-F]{6}$/),quarterMinutes:z.number().int().min(1).max(30),badgeId:optional}),
};
function stmtSave(id:string,kind:string,status:string,data:any,created=now()){return db().prepare('INSERT INTO records(id,kind,status,data,created_at,updated_at) VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET status=excluded.status,data=excluded.data,updated_at=excluded.updated_at').bind(id,kind,status,JSON.stringify(data),created,now());}
async function record(id:string){return await db().prepare('SELECT * FROM records WHERE id=?').bind(id).first<any>();}
async function hash(value:string){const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));return Array.from(new Uint8Array(bytes),x=>x.toString(16).padStart(2,'0')).join('');}
export async function GET(req:Request){try{
 const who=await identity();const url=new URL(req.url);const action=url.searchParams.get('action');
 if(action==='session'){const count=await db().prepare('SELECT count(*) n FROM admins').first<any>();return out({...who,setupAvailable:!count?.n&&!!env.ADMIN_SETUP_TOKEN});}
 if(action==='assistant')return out({enabled:false,message:'定制战术分析助手尚未启用。请先维护对手观察资料。'});
 if(action==='imports'){if(!who.admin)return out({error:'需要管理员权限'},403);const r=await db().prepare('SELECT * FROM imports ORDER BY created_at DESC').all();return out(r.results.map((r:any)=>({...r,data:JSON.parse(r.data)})));}
 const adminView=url.searchParams.get('admin')==='1';if(adminView&&!who.admin)return out({error:'需要管理员权限'},403);
 const data=await db().prepare(adminView?'SELECT * FROM records ORDER BY created_at DESC':"SELECT * FROM records WHERE status='published' ORDER BY created_at DESC").all();
 const rows=data.results.map(shape).map((r:any)=>{if(!adminView&&r.kind==='game'){const {official,rawRows,mapping,importId,resolution,...safe}=r;return {...safe,official,players:r.players?.map(({raw,...p}:any)=>p)};}return r;});
 return out(rows);
 }catch(e){return out({error:'读取失败：'+(e as Error).message},500);}}
export async function POST(req:Request){try{
 sameOrigin(req);const who=await identity();
 if(Number(req.headers.get('content-length')||0)>4*1024*1024)return out({error:'请求过大'},413);
 const b:any=await req.json();
 if(b.action==='setup'){
  if(!who.user)return out({error:'请先登录'},401);
  if(!env.ADMIN_SETUP_TOKEN||typeof b.token!=='string'||await hash(b.token)!==await hash(env.ADMIN_SETUP_TOKEN))return out({error:'初始化口令不正确'},403);
  const r=await db().prepare('INSERT INTO admins(id,email,created_at) SELECT ?,?,? WHERE NOT EXISTS(SELECT 1 FROM admins)').bind(who.user.userId,who.user.email,now()).run();
  return r.meta.changes?out({ok:true}):out({error:'管理员已初始化'},409);
 }
 if(!who.admin)return out({error:'需要管理员权限'},403);
 if(b.action==='save'){
  if(!schemas[b.kind])return out({error:'不支持的内容类型'},400);
  const status=z.enum(['draft','published']).parse(b.status||'draft');const data=schemas[b.kind].parse(b.data);
  const id=b.id||crypto.randomUUID();const old=b.id?await record(id):null;
  if(b.id&&!old)return out({error:'记录不存在'},404);
  if(old&&old.kind!==b.kind)return out({error:'内容类型不匹配'},400);
  if(['video','image'].includes(b.kind)&&!old)return out({error:'请先上传文件'},400);
  const merged={...(old?JSON.parse(old.data):{}),...data};
  await stmtSave(id,b.kind,status,merged,old?.created_at).run();return out({id});
 }
 if(b.action==='status'){
  const status=z.enum(['draft','published']).parse(b.status);const r=await record(b.id);if(!r)return out({error:'记录不存在'},404);
  const data=JSON.parse(r.data);if(r.kind==='video'&&!data.key)return out({error:'录像尚未上传完成'},400);
  const commands=[db().prepare('UPDATE records SET status=?,updated_at=? WHERE id=?').bind(status,now(),b.id)];
  // Imported player cards must be explicitly published, independently of a match.
  await db().batch(commands);return out({ok:true});
 }
 if(b.action==='delete'){
  const r=await record(b.id);if(!r)return out({error:'记录不存在'},404);
  if(r.kind==='player') {const games=await db().prepare("SELECT data FROM records WHERE kind='game'").all();if(games.results.some((g:any)=>JSON.parse(g.data).players?.some((p:any)=>p.playerId===b.id)))return out({error:'球员已有比赛关联，可改为草稿，不能删除'},409);}
  const d=JSON.parse(r.data);await db().prepare('DELETE FROM records WHERE id=?').bind(b.id).run();if(d.key)await bucket().delete(d.key);return out({ok:true});
 }
 if(b.action==='import'){
  if(!Array.isArray(b.rows)||b.rows.length>1000)return out({error:'每批最多1000行'},400);
  const mapping=z.record(z.string(),z.number().int().min(-1).max(100)).parse(b.mapping);
  if(mapping.name==null||mapping.name<0)return out({error:'请映射姓名字段'},400);
  const analysis=analyzeRows(b.rows,mapping,!!b.reverse);if(analysis.errors.length)return out({error:analysis.errors.join('；')},400);
  const resolution=String(b.resolution||'').trim();if(analysis.warnings.length&&!resolution)return out({error:'请记录汇总差异的处理说明'},400);
  const info=schemas.game.parse(b.info);const fingerprint=await hash(JSON.stringify({rows:b.rows,mapping,reverse:!!b.reverse}));
  const existing=await db().prepare('SELECT * FROM imports WHERE fingerprint=?').bind(fingerprint).first<any>();
  if(existing&&existing.state==='active')return out({error:'该数据已导入。请先撤销原批次，再重新导入。',gameId:existing.game_id},409);
  const known=await db().prepare("SELECT * FROM records WHERE kind='player'").all<any>();
  const newCards:any[]=[];const seen=new Set<string>();
  for(let i=0;i<analysis.players.length;i++){
   const p=analysis.players[i];const chosen=b.playerIds?.[i];
   if(chosen&&chosen!=='new') {if(!known.results.some(r=>r.id===chosen))return out({error:'匹配的球员不存在'},400);p.playerId=chosen;}
   else {const matches=known.results.filter(r=>JSON.parse(r.data).name===p.name);
    if(!chosen&&matches.length>1)return out({error:`${p.name}存在多个档案，请指定球员ID`},400);
    if(!chosen&&matches.length===1)p.playerId=matches[0].id;
    else {p.playerId=crypto.randomUUID();newCards.push({id:p.playerId,name:p.name});}}
   if(seen.has(p.playerId!))return out({error:'同一比赛同一球员不能重复记录'},400);seen.add(p.playerId!);
   const state=b.appearances?.[i];p.appeared=state==='yes'?true:state==='no'?false:null;
   if(p.appeared===false&&keys.slice(1).some(k=>typeof p[k]==='number'&&p[k]>0))return out({error:`${p.name}有比赛统计，不能标为未出场`},400);
  }
  const gameId=crypto.randomUUID(),importId=existing?.id||crypto.randomUUID();
  const saved={...info,players:analysis.players,official:analysis.official,importId,resolution};
  const batch=[...newCards.map(p=>stmtSave(p.id,'player','draft',{name:p.name,number:'',position:'',bio:''})),stmtSave(gameId,'game','draft',saved),db().prepare('INSERT INTO imports(id,fingerprint,game_id,data,state,created_at) VALUES(?,?,?,?,?,?) ON CONFLICT(fingerprint) DO UPDATE SET game_id=excluded.game_id,data=excluded.data,state=excluded.state,created_at=excluded.created_at').bind(importId,fingerprint,gameId,JSON.stringify({fileName:String(b.fileName||''),sheet:String(b.sheet||''),rows:b.rows,mapping,reverse:!!b.reverse,warnings:analysis.warnings,resolution}), 'active',now())];
  await db().batch(batch);return out({id:gameId,importId});
 }
 if(b.action==='undo'){
  const imp=await db().prepare("SELECT * FROM imports WHERE id=? AND state='active'").bind(b.id).first<any>();if(!imp)return out({error:'批次不存在或已撤销'},404);
  await db().batch([db().prepare('DELETE FROM records WHERE id=?').bind(imp.game_id),db().prepare("UPDATE imports SET state='undone' WHERE id=?").bind(b.id)]);return out({ok:true});
 }
 return out({error:'未知操作'},400);
 }catch(e){return out({error:e instanceof z.ZodError?'字段校验失败：'+e.issues.map(i=>i.path.join('.')+' '+i.message).join('；'):(e as Error).message},400);}}
