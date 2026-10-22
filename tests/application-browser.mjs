import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {stripTypeScriptTypes} from 'node:module';
import assert from 'node:assert/strict';
const origin=process.argv[2]||'http://127.0.0.1:5173';
if(!['127.0.0.1','localhost'].includes(new URL(origin).hostname))throw Error('验收样例只允许写入本地预览');
const runtime=process.env.PLAYWRIGHT_MODULE||path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const {chromium}=await import(pathToFileURL(runtime));
const browser=await chromium.launch({channel:'msedge',headless:true});
await fs.mkdir('outputs',{recursive:true});
const failures=[];const checks=[];
try{
 const publicContext=await browser.newContext({viewport:{width:1440,height:1000}}),adminContext=await browser.newContext();
 const page=await publicContext.newPage(),adminPage=await adminContext.newPage();page.on('pageerror',e=>failures.push(e.message));
 await page.goto(origin);await page.getByRole('heading',{name:'每一次配合，都有章可循。'}).waitFor();await page.waitForTimeout(1000);
 assert.equal((await publicContext.request.post(origin+'/api/store',{data:{action:'save',kind:'player',data:{name:'unauthorized'}}})).status(),403);
 assert.equal((await publicContext.request.get(origin+'/api/store?admin=1')).status(),403);checks.push('匿名写入和后台数据均拒绝访问');
 await page.screenshot({path:'outputs/home-desktop.png',fullPage:true});
 await page.goto(origin+'/#tactics/horns-roll');await page.getByRole('heading',{name:'牛角 · 挡拆顺下',exact:true}).waitFor();
 await page.getByRole('button',{name:'下一步',exact:true}).click();const before=await page.locator('svg.court').innerHTML();
 await page.getByRole('button',{name:'播放',exact:true}).click();await page.waitForTimeout(1000);const after=await page.locator('svg.court').innerHTML();assert.notEqual(before,after);await page.getByRole('button',{name:'暂停',exact:true}).click();checks.push('战术逐步和播放实际改变球员位置');
 await page.screenshot({path:'outputs/tactic-desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});await page.goto(origin+'/#home');await page.waitForTimeout(400);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));await page.screenshot({path:'outputs/home-mobile.png',fullPage:true});
 await page.goto(origin+'/#tactics/zone-23');await page.waitForTimeout(300);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));await page.screenshot({path:'outputs/tactic-mobile.png',fullPage:true});checks.push('390px手机首页和教学页无横向溢出');
 await adminPage.goto(origin+'/signin-with-chatgpt?return_to=/%23admin');await adminPage.waitForTimeout(400);
 let session=await (await adminContext.request.get(origin+'/api/store?action=session')).json();assert.ok(session.user,'本地模拟登录');
 if(!session.admin){const secret=(await fs.readFile('.dev.vars','utf8')).match(/^ADMIN_SETUP_TOKEN=(.+)$/m)[1];const r=await adminContext.request.post(origin+'/api/store',{data:{action:'setup',token:secret}});assert.equal(r.status(),200,await r.text());}
 const post=async data=>await adminContext.request.post(origin+'/api/store',{data});
 const prior=await(await adminContext.request.get(origin+'/api/store?admin=1')).json();
 const priorBatches=await(await adminContext.request.get(origin+'/api/store?action=imports')).json();
 for(const batch of priorBatches.filter(b=>b.state==='active'&&b.data.fileName==='验收样例.xlsx')){
  const game=prior.find(r=>r.id===batch.game_id);await post({action:'undo',id:batch.id});
  for(const p of game?.players||[])await post({action:'delete',id:p.playerId});
 }
 for(const r of prior.filter(r=>r.title==='本地验收录像'))await post({action:'delete',id:r.id});
 const initial=await(await adminContext.request.get(origin+'/api/store?admin=1')).json();const initialIds=new Set(initial.map(r=>r.id));
 const code=stripTypeScriptTypes(await fs.readFile('lib/read-sheet.ts','utf8')).replaceAll('export ','');await adminPage.addScriptTag({content:code+';window.readSheet=readSheet;'});
 const bytes=await fs.readFile('../26机械VS化工(2).xlsx');const sheets=await adminPage.evaluate(async b=>await window.readSheet(new File([new Uint8Array(b)],'sample.xlsx')),Array.from(bytes));
 const {keys}=await import('../lib/stats.ts');const body={action:'import',rows:sheets[0].rows.slice(1),mapping:Object.fromEntries(keys.map((k,i)=>[k,i])),info:{title:'本地验收：机械 vs 化工',date:'2026-10-22',season:'本地验收',opponent:'化工',score:38,opponentScore:null,quarterMinutes:10},fileName:'验收样例.xlsx',sheet:'Sheet1'};
 assert.equal((await post(body)).status(),400,'有差异必须填写说明');
 const imported=await post({...body,resolution:'本地验收采用明细汇总，原表总计保留'});assert.equal(imported.status(),200,await imported.text());const imp=await imported.json();
 assert.equal((await post({...body,resolution:'重复'})).status(),409);
 let published=await(await publicContext.request.get(origin+'/api/store')).json();assert.ok(!published.some(r=>r.id===imp.id));
 await post({action:'status',id:imp.id,status:'published'});published=await(await publicContext.request.get(origin+'/api/store')).json();const game=published.find(r=>r.id===imp.id);assert.equal(game.players.length,11);assert.ok(!('raw' in game.players[0]));
 await page.goto(origin+'/#games/'+imp.id);await page.getByRole('heading',{name:body.info.title,exact:true}).waitFor();await page.reload();await page.getByRole('heading',{name:body.info.title,exact:true}).waitFor();checks.push('真实Excel导入、差异说明、重复检测、草稿过滤、发布、刷新持久化');
 // Generate a genuine playable test clip locally; no match video is uploaded by this test.
 const videoBytes=await adminPage.evaluate(async()=>{const c=document.createElement('canvas');c.width=320;c.height=180;const ctx=c.getContext('2d');const stream=c.captureStream(10),rec=new MediaRecorder(stream,{mimeType:'video/webm'}),chunks=[];const result=new Promise(resolve=>{rec.ondataavailable=e=>chunks.push(e.data);rec.onstop=async()=>resolve(Array.from(new Uint8Array(await new Blob(chunks).arrayBuffer())));});rec.start();for(let i=0;i<12;i++){ctx.fillStyle='#24463a';ctx.fillRect(0,0,320,180);ctx.fillStyle='#f6f5f0';ctx.font='24px sans-serif';ctx.fillText('LOCAL QA '+i,60,90);await new Promise(r=>setTimeout(r,100));}rec.stop();stream.getTracks().forEach(t=>t.stop());return await result;});
 const init=await adminContext.request.post(origin+'/api/media?action=init',{data:{title:'本地验收录像',mime:'video/webm',size:videoBytes.length,gameId:imp.id}});assert.equal(init.status(),200,await init.text());const media=await init.json();
 const part=await adminContext.request.post(origin+'/api/media?action=part&id='+media.id+'&part=1',{data:Buffer.from(videoBytes),headers:{'Content-Type':'application/octet-stream'}});assert.equal(part.status(),200,await part.text());
 const complete=await adminContext.request.post(origin+'/api/media?action=complete&id='+media.id);assert.equal(complete.status(),200,await complete.text());
 assert.equal((await publicContext.request.get(origin+'/api/media?id='+media.id)).status(),404);await post({action:'status',id:media.id,status:'published'});
 const range=await publicContext.request.get(origin+'/api/media?id='+media.id,{headers:{Range:'bytes=0-99'}});assert.equal(range.status(),206);assert.equal((await range.body()).length,100);
 await page.goto(origin+'/#videos');await page.getByRole('heading',{name:'本地验收录像',exact:true}).waitFor();await page.locator('video').first().evaluate(async v=>{await v.play();});await page.waitForTimeout(500);assert.ok(await page.locator('video').first().evaluate(v=>v.currentTime>0));checks.push('可播放WebM上传、草稿文件隔离、发布播放、Range跳转读取');
 await post({action:'delete',id:media.id});await post({action:'undo',id:imp.importId});published=await(await publicContext.request.get(origin+'/api/store')).json();assert.ok(!published.some(r=>r.id===imp.id));
 const remaining=await(await adminContext.request.get(origin+'/api/store?admin=1')).json();for(const r of remaining)if(!initialIds.has(r.id))await post({action:'delete',id:r.id});checks.push('导入撤销及测试数据清理');
 assert.deepEqual(failures,[],'无浏览器页面异常');
 console.log(checks.map(c=>'PASS: '+c).join('\n'));
 await fs.writeFile('outputs/browser-checks.json',JSON.stringify({checks,errors:failures},null,2));
}finally{await browser.close();}
