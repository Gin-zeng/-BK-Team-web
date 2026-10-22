export const fields = ['姓名','得分','篮板','助攻','盖帽','抢断','失误','投篮','三分','罚球','犯规'];
export const keys = ['name','points','rebounds','assists','blocks','steals','turnovers','fg','three','ft','fouls'];
export type Stat = {name:string; playerId?:string; appeared?:boolean|null; [key:string]:any};
export function pair(value:unknown, reverse=false) {
  if(value===null || value===undefined || String(value).trim()==='') return {a:null,m:null};
  const p=String(value).trim().split(/[\\/／]/).map(s=>s.trim());
  if(p.length!==2 || p.some(s=>!/^\d+$/.test(s))) throw Error('请使用出手/命中，例如10/2');
  const [a,m]=p.map(Number); return reverse?{a:m,m:a}:{a,m};
}
export function analyzeRows(rows:unknown[][], mapping:Record<string,number>, reverse=false) {
  const errors:string[]=[], warnings:string[]=[], players:Stat[]=[]; let official:Stat|null=null;
  rows.forEach((row,i)=>{
    if(!row?.some(v=>v!==null&&v!==undefined&&String(v).trim()!==''))return;
    const name=String(row[mapping.name]??'').trim(); if(!name){errors.push(`第${i+2}行：姓名为空`);return;}
    const stat:Stat={name,appeared:null,raw:row};
    for(const k of keys.slice(1)){
      const raw=row[mapping[k]];
      if(['fg','three','ft'].includes(k)){
        try{ const p=pair(raw,reverse); stat[k+'a']=p.a;stat[k+'m']=p.m; if(p.a!==null&&p.m!>p.a)errors.push(`第${i+2}行 ${name}：${fields[keys.indexOf(k)]}命中超过出手`);}
        catch(e){errors.push(`第${i+2}行 ${name}：${(e as Error).message}`);}
      } else {if(raw===null||raw===undefined||String(raw).trim()==='')stat[k]=null;
        else if(!/^\d+$/.test(String(raw).trim()))errors.push(`第${i+2}行 ${name}：${fields[keys.indexOf(k)]}必须为非负整数`);
        else stat[k]=Number(raw);}
    }
    if(/^(总计|合计|全队)$/.test(name)){official=stat;return;}
    if(stat.threea!=null&&stat.fga!=null&&stat.threea>stat.fga)errors.push(`${name}：三分出手超过总投篮`);
    if(stat.threem!=null&&stat.fgm!=null&&stat.threem>stat.fgm)errors.push(`${name}：三分命中超过总投篮`);
    if([stat.fga,stat.fgm,stat.threea,stat.threem].every(v=>v!=null)&&stat.fgm-stat.threem>stat.fga-stat.threea)errors.push(`${name}：两分命中超过两分出手`);
    if([stat.points,stat.fgm,stat.threem,stat.ftm].every(v=>v!=null)&&stat.points!==2*stat.fgm+stat.threem+stat.ftm)errors.push(`${name}：得分与投篮、罚球不一致`);
    if(players.some(p=>p.name===name))warnings.push(`${name}：存在同名记录，请匹配不同球员ID`);
    players.push(stat);
  });
  const total=aggregate(players);
  if(official) for(const [k,v] of Object.entries(total)) if(k!=='name'&&typeof v==='number'&&(official as Stat)[k]!=null&&v!==(official as Stat)[k]){
    const labels:Record<string,string>={assists:'助攻',fta:'罚球出手',ftm:'罚球命中',fga:'投篮出手',fgm:'投篮命中',threea:'三分出手',threem:'三分命中',points:'得分',rebounds:'篮板',steals:'抢断',turnovers:'失误',blocks:'盖帽',fouls:'犯规'};
    warnings.push(`${labels[k]||k}：明细合计 ${v}，原表总计 ${(official as Stat)[k]}`);
  }
  if(!players.length)errors.push('未识别到球员数据');
  return {players,official,total,errors,warnings};
}
export function aggregate(rows:Stat[]) {
  const result:Stat={name:'明细汇总'};
  for(const k of ['points','rebounds','assists','blocks','steals','turnovers','fga','fgm','threea','threem','fta','ftm','fouls'])result[k]=rows.length&&rows.every(r=>r[k]!=null)?rows.reduce((a,r)=>a+Number(r[k]),0):null;
  return result;
}
export function rate(m:number|null,a:number|null){return m==null||a==null?'—':a===0?'无出手':`${(m/a*100).toFixed(1)}%`;}
