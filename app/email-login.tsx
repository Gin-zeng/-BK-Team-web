'use client';
import {useEffect,useState} from 'react';
export async function logout(){
 const r=await fetch('/api/auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'logout'})});
 if(!r.ok)throw Error('退出失败，请重试');
 window.location.href='/signout-with-chatgpt?return_to=/%23admin';
}
export function EmailLogin({onSuccess}:{onSuccess:()=>void}){
 const [enabled,setEnabled]=useState<boolean|null>(null),[email,setEmail]=useState(''),[code,setCode]=useState(''),[challenge,setChallenge]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[remaining,setRemaining]=useState(0);
 useEffect(()=>{fetch('/api/auth').then(r=>{if(!r.ok)throw Error();return r.json();}).then((d:any)=>setEnabled(!!d.enabled)).catch(()=>{setEnabled(false);setMessage('无法读取邮箱服务状态，请刷新重试');});},[]);
 useEffect(()=>{if(!remaining)return;const id=setTimeout(()=>setRemaining(n=>Math.max(0,n-1)),1000);return()=>clearTimeout(id);},[remaining]);
 async function submit(action:'send'|'verify'){
  setBusy(true);setMessage('');try{
   const r=await fetch('/api/auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,email,code,challengeId:challenge})});const d:any=await r.json();if(!r.ok)throw Error(d.error||'操作失败');
   if(action==='send'){setChallenge(d.challengeId);setRemaining(d.retryAfter);setMessage('验证码已发送，10分钟内有效，请检查收件箱或垃圾邮件。');}
   else{setCode('');setMessage('登录成功');onSuccess();}
  }catch(e){setMessage((e as Error).message);}finally{setBusy(false);}
 }
 return <div className="email-login"><h3>邮箱验证码登录</h3><p className="muted">首次验证邮箱会自动创建账号。首个完成验证的邮箱账号获得管理员权限，之后的账号仅可浏览。</p>
 {enabled===null?<p>正在检查邮件服务…</p>:!enabled?<p className="alert warning">邮箱验证码服务尚未配置，请暂用下方原管理员登录入口。</p>:<form onSubmit={e=>{e.preventDefault();submit(challenge?'verify':'send');}}>
 <label>邮箱地址<input type="email" autoComplete="email" required maxLength={254} value={email} disabled={busy} onChange={e=>{setEmail(e.target.value);setChallenge('');setCode('');}} placeholder="请输入你的邮箱"/></label>
 <div className="actions"><button type="button" disabled={busy||remaining>0||!email.trim()} onClick={()=>submit('send')}>{remaining>0?`${remaining}秒后可重新发送`:challenge?'重新发送验证码':'发送验证码'}</button></div>
 {challenge&&<><label>6位验证码<input value={code} inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} onChange={e=>setCode(e.target.value.replace(/\D/g,''))} required/></label><button className="primary" type="submit" disabled={busy||code.length!==6}>{busy?'验证中…':'验证并登录'}</button></>}
 </form>}{message&&<p role="status" className="alert">{message}</p>}</div>;
}
