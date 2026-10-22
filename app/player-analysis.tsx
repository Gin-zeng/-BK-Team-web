'use client';
import { useEffect, useState } from 'react';
import { RATING_DIMS, RATING_MIN, RATING_MAX } from '../lib/player-analysis';
import { Radar } from './radar';

const RATED_KEY = 'mech-hoops-rated';

export function PlayerAnalysis({ playerId }: { playerId: string }) {
  const [dims, setDims] = useState<Record<string, number>>({});
  const [agg, setAgg] = useState<{ dims: Record<string, number | null>; count: number } | null>(null);
  const [advice, setAdvice] = useState<string | null>(null);
  const [genState, setGenState] = useState<'idle' | 'loading' | 'error'>('idle');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    setDims({}); setAgg(null); setAdvice(null); setGenState('idle'); setMsg('');
    (async () => {
      try {
        const r = await fetch('/api/store?action=ratings&playerId=' + encodeURIComponent(playerId));
        const d: any = await r.json(); if (r.ok) setAgg(d);
      } catch {}
      try {
        const a = await fetch('/api/store?action=advice&playerId=' + encodeURIComponent(playerId));
        const ad: any = await a.json(); if (a.ok && ad.advice) setAdvice(ad.advice);
      } catch {}
    })();
  }, [playerId]);

  const rated = (() => { try { return JSON.parse(localStorage.getItem(RATED_KEY) || '[]') as string[]; } catch { return []; } })();
  const alreadyRated = rated.includes(playerId);
  const complete = RATING_DIMS.every((d) => typeof dims[d.key] === 'number');

  async function submit() {
    setBusy(true); setMsg('');
    try {
      const r = await fetch('/api/store', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'rate', playerId, dims }) });
      const d: any = await r.json();
      if (!r.ok) throw new Error(d.error || '评分失败');
      setAgg(d);
      try { localStorage.setItem(RATED_KEY, JSON.stringify([...rated, playerId])); } catch {}
      setDims({});
    } catch (e) { setMsg((e as Error).message); }
    finally { setBusy(false); }
  }

  async function generate() {
    setGenState('loading'); setMsg('');
    try {
      const r = await fetch('/api/store', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'suggest', playerId }) });
      const d: any = await r.json();
      if (!r.ok) throw new Error(d.error || '生成失败');
      setAdvice(d.advice); setGenState('idle');
    } catch (e) { setMsg((e as Error).message); setGenState('error'); }
  }

  return (
    <>
      <section className="panel">
        <div className="section-heading"><h3>能力评价</h3><span className="muted">{agg?.count ? agg.count + ' 人评价' : '暂无评分'}</span></div>
        <div className="analysis-grid">
          <Radar values={agg?.dims || {}} />
          <div className="rating-form">
            {alreadyRated
              ? <p className="muted">你已评价过该球员，感谢反馈。下方为当前平均。</p>
              : <p className="muted">从六个维度打分（1–5），提交后计入平均。</p>}
            {RATING_DIMS.map((d) => (
              <label className="rating-row" key={d.key}>
                <span>{d.label}</span>
                <div className="rating-options">
                  {Array.from({ length: RATING_MAX - RATING_MIN + 1 }, (_, i) => RATING_MIN + i).map((v) => (
                    <button key={v} type="button" className={dims[d.key] === v ? 'selected' : ''} onClick={() => setDims({ ...dims, [d.key]: v })}>{v}</button>
                  ))}
                </div>
              </label>
            ))}
            {!alreadyRated && <button className="primary" disabled={!complete || busy} onClick={submit}>{busy ? '提交中…' : '提交评分'}</button>}
            {msg && <div className="alert">{msg}</div>}
          </div>
        </div>
      </section>
      <PlayerMessages playerId={playerId}/>
      <section className="panel advice-card">
        <div className="section-heading"><h3>打法建议</h3>{advice && <button className="text-button" onClick={generate}>重新生成</button>}</div>
        {advice
          ? <p className="prose">{advice}</p>
          : genState === 'loading'
            ? <p className="muted">正在生成建议…</p>
            : <>
                <p className="muted">根据比赛数据、能力评价与所打位置，用 AI 生成个性化打法建议。</p>
                <button className="primary" onClick={generate}>{genState === 'error' ? '重试生成' : '生成打法建议'}</button>
              </>}
      </section>
    </>
  );
}

export function PlayerMessages({ playerId }: { playerId: string }) {
  const [messages, setMessages] = useState<any[]>([]);
  const [name, setName] = useState('');
  const [content, setContent] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    (async () => {
      try { const r = await fetch('/api/store?action=messages&playerId=' + encodeURIComponent(playerId)); const d: any = await r.json(); if (r.ok) setMessages(d); } catch {}
    })();
  }, [playerId]);

  async function submit() {
    setBusy(true); setMsg('');
    try {
      const r = await fetch('/api/store', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'message', playerId, name, content }) });
      const d: any = await r.json();
      if (!r.ok) throw new Error(d.error || '提交失败');
      setMessages([{ name: name.trim(), content: content.trim(), createdAt: new Date().toISOString() }, ...messages]);
      setName(''); setContent('');
    } catch (e) { setMsg((e as Error).message); }
    finally { setBusy(false); }
  }

  return (
    <section className="panel">
      <div className="section-heading"><h3>队员有话</h3><span className="muted">{messages.length} 条</span></div>
      <div className="review-form">
        <label>填写人姓名<input value={name} onChange={e => setName(e.target.value)} placeholder="必填" maxLength={300} /></label>
        <label>留言内容<textarea value={content} onChange={e => setContent(e.target.value)} placeholder="给这位队员说句话吧…" rows={3} maxLength={15000} /></label>
        <button className="primary" disabled={busy || !name.trim() || !content.trim()} onClick={submit}>{busy ? '提交中…' : '提交留言'}</button>
        {msg && <div className="alert">{msg}</div>}
      </div>
      {messages.length
        ? <div className="review-list">{messages.map((m, i) => <div className="review-item" key={i}><div className="review-head"><strong>{m.name}</strong><span className="muted">{m.createdAt?.slice(0, 10)}</span></div><p>{m.content}</p></div>)}</div>
        : <p className="muted">还没有留言，来写第一条吧。</p>}
    </section>
  );
}
