import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {chromium} from 'file:///C:/Users/30629/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {codeDigest,consumeLimit,digest} from '../lib/email-auth.ts';
const origin='http://127.0.0.1:5173';
const base='.wrangler/state/v3/d1/miniflare-D1DatabaseObject';
const db=new DatabaseSync(path.join(base,fs.readdirSync(base).find(n=>n.endsWith('.sqlite')&&n!=='metadata.sqlite')));
assert.equal(db.prepare('SELECT count(*) n FROM email_users').get().n,0,'此测试只在无邮箱用户的本地数据库运行');
const secret=fs.readFileSync('.dev.vars','utf8').match(/^EMAIL_AUTH_SECRET=(.+)$/m)[1].trim();
const browser=await chromium.launch({channel:'msedge',headless:true});
const checks=[];const ids=[];
async function challenge(email,code='123456',expires=Date.now()+600000){const id=crypto.randomUUID();ids.push(id);db.prepare('INSERT INTO email_codes(id,email,code_hash,expires_at,attempts,created_at) VALUES(?,?,?,?,0,?)').run(id,email,await codeDigest(secret,id,email,code),expires,Date.now());return {action:'verify',email,code,challengeId:id};}
try{
 const a=await browser.newContext(),b=await browser.newContext(),anon=await browser.newContext();
 const post=(ctx,data,headers={})=>ctx.request.post(origin+'/api/auth',{data,headers:{Origin:origin,...headers}});
 const existingAdmins=db.prepare('SELECT count(*) n FROM admins').get().n;
 assert.equal((await post(a,{action:'send',email:'no-email'},{Origin:'https://foreign.example'})).status(),403);
 assert.equal((await post(a,{action:'send',email:'no-email'})).status(),400);
 const ca=await challenge('first@example.test'),cb=await challenge('second@example.test');
 const both=await Promise.all([post(a,ca),post(b,cb)]);both.forEach(r=>assert.equal(r.status(),200));
 const sessions=await Promise.all([a,b].map(async ctx=>(await ctx.request.get(origin+'/api/store?action=session')).json()));
 assert.equal(sessions.filter(s=>s.admin).length,1);assert.equal(db.prepare('SELECT count(*) n FROM admins').get().n,existingAdmins+1);
 checks.push('两个邮箱并发首次验证，只分配一个新管理员，原管理员保留');
 const admin=sessions[0].admin?a:b,viewer=sessions[0].admin?b:a,adminBody=sessions[0].admin?ca:cb;
 assert.equal((await post(a,ca)).status(),400);checks.push('验证码不可重复使用');
 const expired=await challenge('expired@example.test','123456',Date.now()-1);assert.equal((await post(anon,expired)).status(),400);
 const wrong=await challenge('wrong@example.test');for(let i=0;i<5;i++)assert.equal((await post(anon,{...wrong,code:'000000'})).status(),400);assert.equal((await post(anon,wrong)).status(),400);checks.push('过期验证码拒绝，连续5次错误后正确码也失效');
 assert.equal((await viewer.request.post(origin+'/api/store',{data:{action:'save',kind:'player',data:{name:'不得创建'}}})).status(),403);
 assert.equal((await viewer.request.post(origin+'/api/media?action=init',{data:{}})).status(),403);
 assert.equal((await admin.request.get(origin+'/api/store?admin=1')).status(),200);checks.push('邮箱管理员可读取后台，后续邮箱用户无法写入或上传');
 const page=await admin.newPage();await page.goto(origin+'/#admin');await page.getByRole('button',{name:'导入数据',exact:true}).waitFor();await page.reload();await page.getByRole('button',{name:'导入数据',exact:true}).waitFor();checks.push('邮箱登录会话刷新后仍可进入后台');
 await post(admin,{action:'logout'});assert.equal((await(await admin.request.get(origin+'/api/store?action=session')).json()).admin,false);checks.push('退出后服务端会话立即失效');
 // UI uses an intercepted send response backed by a local challenge; no email is sent.
 const uiCode=await challenge(adminBody.email);
 await page.route('**/api/auth',async route=>{const req=route.request();if(req.method()==='POST'&&req.postDataJSON().action==='send')await route.fulfill({json:{challengeId:uiCode.challengeId,retryAfter:60,expiresIn:600}});else await route.continue();});
 await page.reload();await page.getByLabel('邮箱地址',{exact:true}).fill(adminBody.email);await page.getByRole('button',{name:'发送验证码',exact:true}).click();await page.getByLabel('6位验证码',{exact:true}).fill(uiCode.code);await page.screenshot({path:'outputs/email-login-desktop.png',fullPage:true});await page.getByRole('button',{name:'验证并登录',exact:true}).click();await page.getByRole('button',{name:'导入数据',exact:true}).waitFor();
 assert.equal(db.prepare('SELECT count(*) n FROM admins').get().n,existingAdmins+1);checks.push('邮箱输入/验证码输入/验证登录界面闭环（发信已模拟），再次登录不新增管理员');
 await post(admin,{action:'logout'});await page.reload();await page.setViewportSize({width:390,height:844});await page.getByLabel('邮箱地址',{exact:true}).waitFor();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:'outputs/email-login-mobile.png',fullPage:true});
 const adapter={prepare(sql){let values=[];return{bind(...v){values=v;return this;},async first(){return db.prepare(sql).get(...values);}};}};
 assert.equal(await consumeLimit(adapter,'test-limit',60000,1,Date.now()),true);assert.equal(await consumeLimit(adapter,'test-limit',60000,1,Date.now()),false);assert.equal(await consumeLimit(adapter,'test-limit',60000,1,Date.now()+60001),true);checks.push('发送频率按时间窗口限制并恢复，手机登录页面无横向溢出');
 console.log(checks.map(s=>'PASS: '+s).join('\n'));fs.writeFileSync('outputs/email-auth-checks.json',JSON.stringify({checks,mailDelivery:'NOT TESTED: mail provider simulated'},null,2));
} catch(e){console.error('FAIL: '+String(e.message).split('\n').slice(0,2).join(' '));process.exitCode=1;}
finally{
 await browser.close();
 db.prepare("DELETE FROM admins WHERE id IN (SELECT id FROM email_users WHERE email LIKE '%@example.test')").run();
 db.prepare('DELETE FROM email_sessions').run();db.prepare('DELETE FROM auth_bootstrap').run();db.prepare('DELETE FROM email_users').run();for(const id of ids)db.prepare('DELETE FROM email_codes WHERE id=?').run(id);db.prepare('DELETE FROM auth_limits').run();db.close();
}
