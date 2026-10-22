import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {stripTypeScriptTypes} from 'node:module';
import assert from 'node:assert/strict';
const runtime=process.env.PLAYWRIGHT_MODULE||path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const {chromium}=await import(pathToFileURL(runtime));
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const page=await browser.newPage();await page.goto('about:blank');
 const code=stripTypeScriptTypes(await fs.readFile('lib/read-sheet.ts','utf8')).replaceAll('export ','');
 await page.addScriptTag({content:code+';window.readSheet=readSheet;'});
 const source=process.argv[2];if(!source)throw Error('Pass the source workbook path');
 const bytes=await fs.readFile(source);const sheets=await page.evaluate(async b=>await window.readSheet(new File([new Uint8Array(b)],'sample.xlsx')),Array.from(bytes));
 assert.equal(sheets.length,1);assert.equal(sheets[0].rows.length,13);
 const {analyzeRows,keys}=await import('../lib/stats.ts');
 const result=analyzeRows(sheets[0].rows.slice(1),Object.fromEntries(keys.map((k,i)=>[k,i])));
 assert.equal(result.players.length,11);assert.equal(result.total.points,38);assert.equal(result.total.assists,9);assert.equal(result.total.fta,11);assert.equal(result.errors.length,0);assert.deepEqual(result.warnings,['助攻：明细合计 9，原表总计 10','罚球出手：明细合计 11，原表总计 10']);
 console.log('PASS: 实际XLSX浏览器读取；空表排除；11名球员；38分；准确发现助攻与罚球差异。');
}finally{await browser.close();}
