import path from 'node:path';
import {pathToFileURL} from 'node:url';
const runtime=process.env.PLAYWRIGHT_MODULE||path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const {chromium}=await import(pathToFileURL(runtime));
const browser=await chromium.launch({channel:'msedge',headless:true});
try{const page=await browser.newPage();for(const [name,width,height,route] of [['home-desktop',1440,1000,'home'],['home-mobile',390,844,'home'],['tactic-mobile',390,844,'tactics/zone-23'],['tactic-desktop',1440,1000,'tactics/horns-roll']]){await page.setViewportSize({width,height});await page.goto('http://127.0.0.1:5173/#'+route);await page.waitForTimeout(700);await page.screenshot({path:'outputs/'+name+'.png',fullPage:true});}console.log('四张最终预览截图已更新。');}finally{await browser.close();}
