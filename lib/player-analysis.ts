import type { Stat } from './stats';

export const RATING_DIMS = [
  { key: 'scoring', label: '得分' },
  { key: 'shooting', label: '投射' },
  { key: 'rebounding', label: '篮板' },
  { key: 'playmaking', label: '组织' },
  { key: 'defense', label: '防守' },
  { key: 'athleticism', label: '体能' },
] as const;
export type DimKey = (typeof RATING_DIMS)[number]['key'];
export const DIM_KEYS = RATING_DIMS.map((d) => d.key);
export const RATING_MIN = 1;
export const RATING_MAX = 5;

export type RatingAggregate = { dims: Record<string, number | null>; count: number };

/** 对同一球员的评分记录求各维度平均；无评分时该维度为 null。 */
export function aggregateRatings(rows: { dims: Record<string, number> }[]): RatingAggregate {
  const dims: Record<string, number | null> = {};
  for (const d of RATING_DIMS) {
    const vals = rows.map((r) => r.dims[d.key]).filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
    dims[d.key] = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  }
  return { dims, count: rows.length };
}

function fmt(n: number | null | undefined) {
  return n == null ? '—' : String(n);
}

/** 组装 DeepSeek 对话消息：基于比赛数据 + 六维评分 + 位置，按四段框架生成打法建议。 */
export function buildAdvicePrompt(
  p: { name: string; position?: string; height?: string; weight?: string; hand?: string; birth?: string },
  stats: Stat,
  agg: RatingAggregate,
  games = 0,
): { role: 'system' | 'user'; content: string }[] {
  const fg = stats.fga && stats.fgm != null ? ((stats.fgm / stats.fga) * 100).toFixed(1) + '%' : '—';
  const three = stats.threea && stats.threem != null ? ((stats.threem / stats.threea) * 100).toFixed(1) + '%' : '—';
  const ft = stats.fta && stats.ftm != null ? ((stats.ftm / stats.fta) * 100).toFixed(1) + '%' : '—';
  const dimsText = RATING_DIMS.map((d) => `${d.label} ${agg.dims[d.key] == null ? '—' : Number((agg.dims[d.key] as number).toFixed(1))}/5`).join('，');
  const strengths = RATING_DIMS.filter((d) => { const v = agg.dims[d.key]; return v != null && v >= 4; }).map((d) => d.label);
  const weaknesses = RATING_DIMS.filter((d) => { const v = agg.dims[d.key]; return v != null && v <= 2; }).map((d) => d.label);
  const sampleNote = agg.count < 3 ? '（评分人数较少，样本仅供参考）' : '';
  const info = [p.position, p.height && '身高 ' + p.height, p.weight && '体重 ' + p.weight, p.hand && '惯用手 ' + p.hand, p.birth && '生日 ' + p.birth].filter(Boolean).join('、') || '未填写';
  const user = [
    `球员：${p.name}`,
    `位置/身体：${info}`,
    `比赛数据（累计 ${games} 场，— 表示无）：得分 ${fmt(stats.points)}、篮板 ${fmt(stats.rebounds)}、助攻 ${fmt(stats.assists)}、抢断 ${fmt(stats.steals)}、盖帽 ${fmt(stats.blocks)}、失误 ${fmt(stats.turnovers)}、投篮命中率 ${fg}、三分命中率 ${three}、罚球命中率 ${ft}`,
    `六维评分（${agg.count} 人评价）${sampleNote}：${dimsText}`,
    `优势维度：${strengths.join('、') || '暂无（评分不足）'}；短板维度：${weaknesses.join('、') || '暂无（评分不足）'}`,
  ].join('\n');
  const system = [
    '你是机械学院男子篮球队的助理教练。根据球员的比赛数据、六维能力评分和所打位置，给出针对性打法建议。',
    '结合球队战术体系（持球挡拆、无球掩护、牛角顺下/外弹、三线快攻、传切、2-3/3-2 联防、人盯人、边线球）给出可落位的具体建议。',
    '按以下四段输出，每段 1–2 句、可直接执行、不空泛：',
    '1. 角色定位：',
    '2. 进攻：',
    '3. 防守：',
    '4. 训练重点：',
    '规则：数据缺失或评分为「—」时明确说明暂无数据，不编造；评分人数少于 3 人时注明样本少仅供参考；只讲打法，不评价球员本人。',
  ].join('\n');
  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ];
}
