import {env} from 'cloudflare:workers';
import {cookies} from 'next/headers';
import {CODE_TTL,SESSION_TTL,SESSION_COOKIE,randomToken,randomCode,digest,codeDigest,normalizeEmail,sessionCookie,consumeLimit,sendLoginEmail} from '../../../lib/email-auth';
export const dynamic='force-dynamic';
const enabled=()=>!!(env.RESEND_API_KEY&&env.EMAIL_FROM&&env.EMAIL_AUTH_SECRET&&env.EMAIL_AUTH_SECRET.length>=32);
const out=(data:any,status=200,headers:Record<string,string>={})=>Response.json(data,{status,headers:{'Cache-Control':'no-store',...headers}});
export async function GET(){return out({enabled:enabled(),method:'email-code',message:enabled()?'使用邮箱验证码登录':'邮箱验证码服务尚未配置，请暂用原管理员登录'});}
export async function POST(req:Request){
 try{
  if(req.headers.get('origin')!==new URL(req.url).origin)return out({error:'禁止跨站认证请求'},403);
  if(!req.headers.get('content-type')?.startsWith('application/json'))return out({error:'请求格式错误'},415);
  const raw=await req.text();if(raw.length>4096)return out({error:'请求过大'},413);const b=JSON.parse(raw);
  const db=env.DB!,time=Date.now(),secure=new URL(req.url).protocol==='https:';
  if(b.action==='logout'){
   const token=(await cookies()).get(SESSION_COOKIE)?.value;
   if(token)await db.prepare('DELETE FROM email_sessions WHERE token_hash=?').bind(await digest(token)).run();
   return out({ok:true},200,{'Set-Cookie':sessionCookie('',secure,true)});
  }
  if(!enabled())return out({error:'邮箱验证码服务尚未配置，请暂用原管理员登录'},503);
  const email=normalizeEmail(b.email);
  const ip=req.headers.get('cf-connecting-ip')||'unknown';
  if(b.action==='send'){
   const limits=await Promise.all([
    consumeLimit(db,'mail-minute:'+await digest(email),60000,1,time),
    consumeLimit(db,'mail-hour:'+await digest(email),3600000,5,time),
    consumeLimit(db,'ip-hour:'+await digest(ip),3600000,20,time),
    consumeLimit(db,'global-hour',3600000,100,time),
   ]);
   if(limits.some(ok=>!ok))return out({error:'发送过于频繁，请稍后再试'},429,{'Retry-After':'60'});
   const id=crypto.randomUUID(),code=randomCode();
   await db.prepare('INSERT INTO email_codes(id,email,code_hash,expires_at,attempts,used_at,created_at) VALUES(?,?,?,?,0,NULL,?)').bind(id,email,await codeDigest(env.EMAIL_AUTH_SECRET!,id,email,code),time+CODE_TTL,time).run();
   try{await sendLoginEmail(env.RESEND_API_KEY!,env.EMAIL_FROM!,email,code,id);}catch{
    await db.prepare('UPDATE email_codes SET used_at=? WHERE id=?').bind(time,id).run();
    return out({error:'邮件发送失败，请稍后重试或联系管理员检查发信配置'},502);
   }
   // Old challenges are invalidated only after the new email has been accepted.
   await db.batch([
    db.prepare('UPDATE email_codes SET used_at=? WHERE email=? AND id<>? AND used_at IS NULL').bind(time,email,id),
    db.prepare('DELETE FROM email_codes WHERE expires_at<?').bind(time-86400000),
    db.prepare('DELETE FROM email_sessions WHERE expires_at<?').bind(time),
    db.prepare('DELETE FROM auth_limits WHERE window_start<?').bind(time-86400000),
   ]);
   return out({challengeId:id,expiresIn:CODE_TTL/1000,retryAfter:60});
  }
  if(b.action==='verify'){
   if(typeof b.challengeId!=='string'||b.challengeId.length>80||typeof b.code!=='string'||!/^\d{6}$/.test(b.code))return out({error:'请输入6位验证码'},400);
   if(!await consumeLimit(db,'verify-ip:'+await digest(ip),600000,50,time))return out({error:'尝试次数过多，请稍后再试'},429);
   const challenge=await db.prepare('UPDATE email_codes SET attempts=attempts+1 WHERE id=? AND email=? AND used_at IS NULL AND expires_at>? AND attempts<5 RETURNING code_hash').bind(b.challengeId,email,time).first<{code_hash:string}>();
   const hash=await codeDigest(env.EMAIL_AUTH_SECRET!,b.challengeId,email,b.code);
   if(!challenge||challenge.code_hash!==hash)return out({error:'验证码错误、已过期或已达到尝试上限，请重新获取'},400);
   const consumed=await db.prepare('UPDATE email_codes SET used_at=? WHERE id=? AND code_hash=? AND used_at IS NULL AND expires_at>? RETURNING email').bind(time,b.challengeId,hash,time).first();
   if(!consumed)return out({error:'验证码已使用或过期，请重新获取'},400);
   const candidate='email:'+crypto.randomUUID(),created=new Date(time).toISOString();
   const token=randomToken();
   // D1 batch is transactional; the singleton primary key grants exactly one email admin.
   await db.batch([
    db.prepare('INSERT OR IGNORE INTO email_users(id,email,created_at) VALUES(?,?,?)').bind(candidate,email,created),
    db.prepare("INSERT OR IGNORE INTO auth_bootstrap(id,user_id) SELECT 'first-email-admin',id FROM email_users WHERE email=?").bind(email),
    db.prepare("INSERT OR IGNORE INTO admins(id,email,created_at) SELECT u.id,u.email,? FROM email_users u JOIN auth_bootstrap b ON b.user_id=u.id WHERE b.id='first-email-admin' AND u.email=?").bind(created,email),
    db.prepare('INSERT INTO email_sessions(token_hash,user_id,expires_at,created_at) SELECT ?,id,?,? FROM email_users WHERE email=?').bind(await digest(token),time+SESSION_TTL,time,email),
   ]);
   return out({ok:true},200,{'Set-Cookie':sessionCookie(token,secure)});
  }
  return out({error:'未知认证操作'},400);
 }catch{return out({error:'认证请求失败，请检查输入或稍后重试'},400);}
}
