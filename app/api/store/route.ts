import { env } from 'cloudflare:workers';
import { getAppUser } from '../../auth';
import { analyzeRows, keys, aggregate } from '../../../lib/stats';
import { tactics } from '../../../lib/tactics';
import { aggregateRatings, buildAdvicePrompt, DIM_KEYS, RATING_MIN, RATING_MAX } from '../../../lib/player-analysis';
import { askDeepSeek } from '../../../lib/deepseek';
import { extractBvid } from '../../../lib/bilibili';
import { z } from 'zod';
export const dynamic='force-dynamic';
const db=()=>env.DB!;
const bucket=()=>env.BUCKET!;
const now=()=>new Date().toISOString();
function out(data:any,status=200,cache='no-store'){return Response.json(data,{status,headers:{'Cache-Control':cache}});}
async function identity(){const user=await getAppUser();const admin=user?await db().prepare('SELECT id,role FROM admins WHERE id=?').bind(user.userId).first<{id:string;role:string}>():null;return {user,admin:!!admin,role:admin?.role||null};}
function sameOrigin(req:Request){const origin=req.headers.get('origin');if(origin&&origin!==new URL(req.url).origin)return out({error:'禁止跨站写入'},403);return null;}
function shape(row:any){return {...JSON.parse(row.data),id:row.id,kind:row.kind,status:row.status,createdAt:row.created_at,updatedAt:row.updated_at};}
const short=z.string().max(300);const long=z.string().max(15000);const optional=short.optional().default('');
const schemas:Record<string,z.ZodTypeAny>={
 player:z.object({name:short.min(1),number:optional,position:optional,bio:long.optional().default(''),avatarId:optional,height:optional,weight:optional,birth:optional,hand:optional,hometown:optional}),
 opponent:z.object({name:short.min(1),team:short.min(1),number:optional,position:optional,height:optional,hand:optional,shooting:optional,driving:optional,passing:optional,rebounding:optional,defense:optional,strengths:long,weaknesses:long,advice:long,source:short.min(1),date:short.min(1),certainty:z.enum(['观察判断','未经确认','客观资料']),gameId:optional,videoId:optional}),
 game:z.object({title:short.min(1),date:short.min(1),season:short.min(1),opponent:short.min(1),score:z.number().int().min(0).nullable(),opponentScore:z.number().int().min(0).nullable(),review:long.optional().default(''),quarterMinutes:z.number().int().min(1).max(30).default(10),starters:z.array(short).max(5).optional()}),
 tactic:z.object({title:short.min(1),baseId:z.string().refine(v=>tactics.some(t=>t.id===v)),description:long,bindings:z.record(z.string(),short).default({})}),
 video:z.object({title:short.min(1),description:long,gameId:optional,season:optional,opponent:optional,bilibiliId:short.min(1),category:z.enum(['official','training','learning']).default('official')}),
 image:z.object({title:short.min(1),description:long.optional().default(''),gameId:optional,albumId:optional}),
 album:z.object({title:short.min(1),description:long.optional().default(''),coverId:optional}),
 event:z.object({type:z.enum(['match','training']),title:short.min(1),date:short.min(1),time:optional,location:short.min(1),dressCode:optional,opponent:optional,note:long.optional().default('')}),
 team:z.object({name:short.min(1),description:long,color:z.string().regex(/^#[0-9a-fA-F]{6}$/),quarterMinutes:z.number().int().min(1).max(30),badgeId:optional,starters:z.array(short).max(5).optional(),trainingFocus:optional}),
};
function stmtSave(id:string,kind:string,status:string,data:any,created=now()){return db().prepare('INSERT INTO records(id,kind,status,data,created_at,updated_at) VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET status=excluded.status,data=excluded.data,updated_at=excluded.updated_at').bind(id,kind,status,JSON.stringify(data),created,now());}
async function record(id:string){return await db().prepare('SELECT * FROM records WHERE id=?').bind(id).first<any>();}
async function hash(value:string){const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));return Array.from(new Uint8Array(bytes),x=>x.toString(16).padStart(2,'0')).join('');}
function clientIp(req:Request){return req.headers.get('cf-connecting-ip')||'local';}
async function rateLimited(key:string,limit:number){const w=Math.floor(Date.now()/3600000);const row=await db().prepare('SELECT * FROM auth_limits WHERE key=?').bind(key).first<any>();if(row&&row.window_start===w){if(row.count>=limit)return true;await db().prepare('UPDATE auth_limits SET count=? WHERE key=?').bind(row.count+1,key).run();return false;}await db().prepare('INSERT INTO auth_limits(key,window_start,count) VALUES(?,?,1) ON CONFLICT(key) DO UPDATE SET window_start=?,count=1').bind(key,w,w).run();return false;}
export async function GET(req:Request){try{
 const who=await identity();const url=new URL(req.url);const action=url.searchParams.get('action');
 if(action==='session'){const count=await db().prepare('SELECT count(*) n FROM admins').first<any>();return out({...who,setupAvailable:!count?.n&&!!env.ADMIN_SETUP_TOKEN});}
 if(action==='assistant')return out({enabled:false,message:'定制战术分析助手尚未启用。请先维护对手观察资料。'});
 if(action==='imports'){if(!who.admin)return out({error:'需要管理员权限'},403);const r=await db().prepare('SELECT * FROM imports ORDER BY created_at DESC').all();return out(r.results.map((r:any)=>({...r,data:JSON.parse(r.data)})));}
 if(action==='ratings'){const pid=url.searchParams.get('playerId');if(!pid)return out({error:'缺少球员'},400);const rows=await db().prepare('SELECT dims FROM ratings WHERE player_id=?').bind(pid).all<any>();return out(aggregateRatings(rows.results.map((r:any)=>({dims:JSON.parse(r.dims)}))),200,'public, max-age=30');}
 if(action==='advice'){const pid=url.searchParams.get('playerId');if(!pid)return out({error:'缺少球员'},400);const r=await db().prepare("SELECT data FROM records WHERE id=?").bind('advice:'+pid).first<any>();const d=r?JSON.parse(r.data):null;return out({advice:d?.advice||null},200,'public, max-age=30');}
 if(action==='reviews'){const gid=url.searchParams.get('gameId');if(!gid)return out({error:'缺少比赛'},400);const rows=await db().prepare("SELECT data,created_at FROM records WHERE kind='review' ORDER BY created_at DESC").all<any>();return out(rows.results.map((r:any)=>({...JSON.parse(r.data),createdAt:r.created_at})).filter((r:any)=>r.gameId===gid),200,'public, max-age=30');}
 if(action==='messages'){const pid=url.searchParams.get('playerId');if(!pid)return out({error:'缺少球员'},400);const rows=await db().prepare("SELECT data,created_at FROM records WHERE kind='message' ORDER BY created_at DESC").all<any>();return out(rows.results.map((r:any)=>({...JSON.parse(r.data),createdAt:r.created_at})).filter((r:any)=>r.playerId===pid),200,'public, max-age=30');}
 if(action==='applications'){if(who.role!=='super')return out({error:'需要超级管理员权限'},403);const rows=await db().prepare("SELECT * FROM records WHERE kind='application' AND status='pending' ORDER BY created_at DESC").all<any>();return out(rows.results.map((r:any)=>({id:r.id,...JSON.parse(r.data),createdAt:r.created_at})));}
 if(action==='recommendation'){
  const teamRow=await db().prepare("SELECT data FROM records WHERE kind='team'").first<any>();
  const focus=teamRow?String(JSON.parse(teamRow.data).trainingFocus||'').trim():'';
  const vids=await db().prepare("SELECT id,data FROM records WHERE kind='video' AND status='published'").all<any>();
  const pool=vids.results.map((r:any)=>({id:r.id,...JSON.parse(r.data)})).filter((v:any)=>(v.category||'official')==='learning');
  if(!focus||!pool.length)return out({focus,items:[]},200,'public, max-age=60');
  const date=new Date().toISOString().slice(0,10);
  const rec=await db().prepare("SELECT data FROM records WHERE id='recommendation:today'").first<any>();
  const cached=rec?JSON.parse(rec.data):null;
  if(cached&&cached.date===date&&cached.focus===focus){if(cached.items?.length)return out({focus,items:cached.items},200,'public, max-age=60');if(cached.failedAt&&Date.now()-cached.failedAt<30*60*1000)return out({focus,items:[]},200,'public, max-age=60');}
  try{
   if(!env.DEEPSEEK_API_KEY)throw Error('未配置 AI 密钥');
   if(await rateLimited('recommend:'+clientIp(req),5))return out({focus,items:[]},200,'public, max-age=60');
   const list=pool.map((v:any)=>`- id:${v.id} | ${v.title}${v.description?' | '+String(v.description).slice(0,80):''}`).join('\n');
   const raw=await askDeepSeek(env,[{role:'system',content:'你是篮球训练助手。根据训练方向，从给定的学习视频列表里选出 3-5 个最相关的视频，返回 JSON：{"items":[{"id":"视频id","reason":"一句话推荐理由"}]}。只返回 JSON，不要其他内容。'},{role:'user',content:`训练方向：${focus}\n\n学习视频列表：\n${list}`}],true);
   const parsed=JSON.parse(raw.replace(/```(?:json)?/g,'').trim());
   const items=(Array.isArray(parsed?.items)?parsed.items:[]).filter((it:any)=>it&&typeof it.id==='string'&&pool.some((v:any)=>v.id===it.id)).slice(0,5).map((it:any)=>{const v=pool.find((p:any)=>p.id===it.id);return {title:v.title,bvid:extractBvid(v.bilibiliId),reason:String(it.reason||'').slice(0,200)};});
   const data={date,focus,items};
   await db().prepare("INSERT INTO records(id,kind,status,data,created_at,updated_at) VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data,updated_at=excluded.updated_at").bind('recommendation:today','recommendation','published',JSON.stringify(data),now(),now()).run();
   return out({focus,items},200,'public, max-age=60');
  }catch(e){await db().prepare("INSERT INTO records(id,kind,status,data,created_at,updated_at) VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data,updated_at=excluded.updated_at").bind('recommendation:today','recommendation','published',JSON.stringify({date,focus,items:[],failedAt:Date.now()}),now(),now()).run();return out({focus,items:[]},200,'public, max-age=60');}
 }
 const adminView=url.searchParams.get('admin')==='1';if(adminView&&!who.admin)return out({error:'需要管理员权限'},403);
 const data=await db().prepare(adminView?"SELECT * FROM records WHERE kind != 'advice' AND kind != 'review' AND kind != 'message' AND kind != 'application' AND kind != 'recommendation' ORDER BY created_at DESC":"SELECT * FROM records WHERE status='published' AND kind != 'advice' AND kind != 'review' AND kind != 'message' AND kind != 'application' AND kind != 'recommendation' ORDER BY created_at DESC").all();
 const rows=data.results.map(shape).map((r:any)=>{if(!adminView&&r.kind==='game'){const {official,rawRows,mapping,importId,resolution,...safe}=r;return {...safe,official,players:r.players?.map(({raw,...p}:any)=>p)};}return r;});
 return out(rows,200,adminView?'no-store':'public, max-age=60, stale-while-revalidate=300');
 }catch(e){return out({error:'读取失败：'+(e as Error).message},500);}}
export async function POST(req:Request){try{
 const o=sameOrigin(req);if(o)return o;const who=await identity();
 if(Number(req.headers.get('content-length')||0)>4*1024*1024)return out({error:'请求过大'},413);
 const b:any=await req.json();
 if(b.action==='setup'){
  if(!who.user)return out({error:'请先登录'},401);
  if(!env.ADMIN_SETUP_TOKEN||typeof b.token!=='string'||await hash(b.token)!==await hash(env.ADMIN_SETUP_TOKEN))return out({error:'初始化口令不正确'},403);
  const r=await db().prepare('INSERT INTO admins(id,email,created_at) SELECT ?,?,? WHERE NOT EXISTS(SELECT 1 FROM admins)').bind(who.user.userId,who.user.email,now()).run();
  return r.meta.changes?out({ok:true}):out({error:'管理员已初始化'},409);
 }
 if(b.action==='rate'){
  const dims=z.record(z.string(),z.number().int().min(RATING_MIN).max(RATING_MAX)).parse(b.dims||{});
  if(DIM_KEYS.some(k=>typeof dims[k]!=='number'))return out({error:'评分不完整'},400);
  const pid=String(b.playerId||'');const pr=await record(pid);if(!pr||pr.kind!=='player'||pr.status!=='published')return out({error:'球员不存在'},404);
  if(await rateLimited('rate:'+clientIp(req),20))return out({error:'评分太频繁，请稍后再试'},429);
  const trimmed=Object.fromEntries(DIM_KEYS.map(k=>[k,dims[k]]));
  await db().prepare('INSERT INTO ratings(id,player_id,dims,created_at) VALUES(?,?,?,?)').bind(crypto.randomUUID(),pid,JSON.stringify(trimmed),now()).run();
  const rows=await db().prepare('SELECT dims FROM ratings WHERE player_id=?').bind(pid).all<any>();
  return out(aggregateRatings(rows.results.map((r:any)=>({dims:JSON.parse(r.dims)}))));
 }
 if(b.action==='review'){
  const gameId=String(b.gameId||'');const gr=await record(gameId);if(!gr||gr.kind!=='game'||gr.status!=='published')return out({error:'比赛不存在'},404);
  const name=String(b.name||'').trim(),content=String(b.content||'').trim();
  if(!name)return out({error:'请填写姓名'},400);
  if(!content)return out({error:'请填写复盘内容'},400);
  if(name.length>300||content.length>15000)return out({error:'内容过长'},400);
  if(await rateLimited('review:'+clientIp(req),10))return out({error:'提交太频繁，请稍后再试'},429);
  await db().prepare('INSERT INTO records(id,kind,status,data,created_at,updated_at) VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(),'review','published',JSON.stringify({gameId,name,content}),now(),now()).run();
  return out({ok:true});
 }
 if(b.action==='message'){
  const pid=String(b.playerId||'');const pr=await record(pid);if(!pr||pr.kind!=='player'||pr.status!=='published')return out({error:'球员不存在'},404);
  const name=String(b.name||'').trim(),content=String(b.content||'').trim();
  if(!name)return out({error:'请填写姓名'},400);
  if(!content)return out({error:'请填写留言内容'},400);
  if(name.length>300||content.length>15000)return out({error:'内容过长'},400);
  if(await rateLimited('message:'+clientIp(req),10))return out({error:'提交太频繁，请稍后再试'},429);
  await db().prepare('INSERT INTO records(id,kind,status,data,created_at,updated_at) VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(),'message','published',JSON.stringify({playerId:pid,name,content}),now(),now()).run();
  return out({ok:true});
 }
 if(b.action==='apply-admin'){
  if(!who.user)return out({error:'请先登录'},401);
  if(who.admin)return out({error:'你已是管理员'},400);
  const userId=who.user.userId,email=who.user.email||'';
  const note=String(b.note||'').trim().slice(0,500);
  const pend=await db().prepare("SELECT data FROM records WHERE kind='application' AND status='pending'").all<any>();
  if(pend.results.some((r:any)=>JSON.parse(r.data).userId===userId))return out({error:'你已有待审核的申请'},409);
  if(await rateLimited('apply:'+clientIp(req),5))return out({error:'申请太频繁，请稍后再试'},429);
  await db().prepare('INSERT INTO records(id,kind,status,data,created_at,updated_at) VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(),'application','pending',JSON.stringify({userId,email,note}),now(),now()).run();
  return out({ok:true});
 }
 if(b.action==='suggest'){
  const pid=String(b.playerId||'');const pr=await record(pid);if(!pr||pr.kind!=='player'||pr.status!=='published')return out({error:'球员不存在'},404);
  const p=JSON.parse(pr.data);
  const games=await db().prepare("SELECT data FROM records WHERE kind='game' AND status='published'").all<any>();
  const statRows=games.results.map((r:any)=>JSON.parse(r.data)).flatMap((g:any)=>g.players||[]).filter((x:any)=>x.playerId===pid);
  const stats=aggregate(statRows);
  const ratingRows=await db().prepare('SELECT dims FROM ratings WHERE player_id=?').bind(pid).all<any>();
  const agg=aggregateRatings(ratingRows.results.map((r:any)=>({dims:JSON.parse(r.dims)})));
  const missing=[];if(!p.position)missing.push('位置');if(!p.height&&!p.weight)missing.push('身高/体重');if(!statRows.length)missing.push('比赛数据');if(!agg.count)missing.push('六维评分');if(missing.length>=2)return out({error:'该球员资料不完整，暂不生成建议。请先补充：'+missing.join('、')},400);
  const fingerprint=await hash(JSON.stringify({v:2,pid,position:p.position,stats,ratings:agg.dims}));
  const adviceRow=await db().prepare("SELECT data FROM records WHERE id=?").bind('advice:'+pid).first<any>();
  const cached=adviceRow?JSON.parse(adviceRow.data):null;
  if(cached&&cached.fingerprint===fingerprint&&cached.advice)return out({advice:cached.advice,cached:true});
  if(await rateLimited('suggest:'+clientIp(req),10))return out({error:'生成太频繁，请稍后再试'},429);
  const advice=await askDeepSeek(env,buildAdvicePrompt(p,stats,agg,statRows.length));
  await db().prepare('INSERT INTO records(id,kind,status,data,created_at,updated_at) VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data,updated_at=excluded.updated_at').bind('advice:'+pid,'advice','published',JSON.stringify({playerId:pid,advice,fingerprint}),now(),now()).run();
  return out({advice,cached:false});
 }
 if(!who.admin)return out({error:'需要管理员权限'},403);
 if(b.action==='approve-admin'){
  if(who.role!=='super')return out({error:'需要超级管理员权限'},403);
  const app=await db().prepare("SELECT * FROM records WHERE id=? AND kind='application' AND status='pending'").bind(String(b.id||'')).first<any>();
  if(!app)return out({error:'申请不存在或已处理'},404);
  const d=JSON.parse(app.data);
  await db().batch([db().prepare('INSERT OR IGNORE INTO admins(id,email,role,created_at) VALUES(?,?,?,?)').bind(d.userId,d.email||'','admin',now()),db().prepare('UPDATE records SET status=?,updated_at=? WHERE id=?').bind('approved',now(),app.id)]);
  return out({ok:true});
 }
 if(b.action==='reject-admin'){
  if(who.role!=='super')return out({error:'需要超级管理员权限'},403);
  const app=await db().prepare("SELECT * FROM records WHERE id=? AND kind='application' AND status='pending'").bind(String(b.id||'')).first<any>();
  if(!app)return out({error:'申请不存在或已处理'},404);
  await db().prepare('UPDATE records SET status=?,updated_at=? WHERE id=?').bind('rejected',now(),app.id).run();
  return out({ok:true});
 }
 if(b.action==='save'){
  if(!schemas[b.kind])return out({error:'不支持的内容类型'},400);
  const status=z.enum(['draft','published']).parse(b.status||'draft');const data=schemas[b.kind].parse(b.data);
  const id=b.id||crypto.randomUUID();const old=b.id?await record(id):null;
  if(b.id&&!old)return out({error:'记录不存在'},404);
  if(old&&old.kind!==b.kind)return out({error:'内容类型不匹配'},400);
  if(b.kind==='image'&&!old)return out({error:'请先上传文件'},400);
  const merged={...(old?JSON.parse(old.data):{}),...data};
  await stmtSave(id,b.kind,status,merged,old?.created_at).run();return out({id});
 }
 if(b.action==='status'){
  const status=z.enum(['draft','published']).parse(b.status);const r=await record(b.id);if(!r)return out({error:'记录不存在'},404);
  const data=JSON.parse(r.data);if(r.kind==='video'&&!data.bilibiliId)return out({error:'请先填写B站视频链接'},400);
  const commands=[db().prepare('UPDATE records SET status=?,updated_at=? WHERE id=?').bind(status,now(),b.id)];
  // Imported player cards must be explicitly published, independently of a match.
  await db().batch(commands);return out({ok:true});
 }
 if(b.action==='delete'){
  const r=await record(b.id);if(!r)return out({error:'记录不存在'},404);
  if(r.kind==='player') {const games=await db().prepare("SELECT data FROM records WHERE kind='game'").all();if(games.results.some((g:any)=>JSON.parse(g.data).players?.some((p:any)=>p.playerId===b.id)))return out({error:'球员已有比赛关联，可改为草稿，不能删除'},409);await db().prepare('DELETE FROM ratings WHERE player_id=?').bind(b.id).run();await db().prepare("DELETE FROM records WHERE id=?").bind('advice:'+b.id).run();}
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
 }catch(e){if(e instanceof z.ZodError)return out({error:'字段校验失败：'+e.issues.map(i=>i.path.join('.')+' '+i.message).join('；')},400);return out({error:(e as Error).message||'服务器错误'},500);}}
