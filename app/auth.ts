import {env} from 'cloudflare:workers';
import {cookies} from 'next/headers';
import {digest,SESSION_COOKIE} from '../lib/email-auth';
export async function getAppUser(){
 const token=(await cookies()).get(SESSION_COOKIE)?.value;
 if(token&&/^[a-f0-9]{64}$/.test(token)){
  const user=await env.DB!.prepare('SELECT u.id,u.email FROM email_sessions s JOIN email_users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?').bind(await digest(token),Date.now()).first<{id:string;email:string}>();
  if(user)return {userId:user.id,email:user.email,displayName:user.email,fullName:null,provider:'email'};
 }
 return null;
}
