'use client';
import { useState, useRef } from 'react';
import { X, Trash2, RotateCcw, MousePointer2, PenLine, Shield, MoveDown, Send } from 'lucide-react';

type Team = 'attack' | 'defense';
type Tool = 'select' | 'draw' | 'screen' | 'roll' | 'pass';
type Player = { x: number; y: number; team: Team };
type Symbol = { type: 'screen' | 'roll' | 'pass'; x: number; y: number; x2?: number; y2?: number };

const HALF_H = 470;
const FULL_H = 820;

const defaultPlayers: Player[] = [
  { x: 250, y: 380, team: 'attack' },
  { x: 70, y: 250, team: 'attack' },
  { x: 430, y: 250, team: 'attack' },
  { x: 145, y: 160, team: 'attack' },
  { x: 355, y: 160, team: 'attack' },
  { x: 250, y: 330, team: 'defense' },
  { x: 115, y: 220, team: 'defense' },
  { x: 385, y: 220, team: 'defense' },
  { x: 180, y: 120, team: 'defense' },
  { x: 320, y: 120, team: 'defense' },
];

const TOOLS: [Tool, string, any][] = [
  ['select', '选择', MousePointer2],
  ['draw', '画线', PenLine],
  ['screen', '挡拆', Shield],
  ['roll', '下顺', MoveDown],
  ['pass', '传球', Send],
];

function pathToD(points: [number, number][]): string {
  return points.map((p, i) => (i === 0 ? `M${p[0]},${p[1]}` : `L${p[0]},${p[1]}`)).join(' ');
}

export function TacticsBoard({ onClose }: { onClose: () => void }) {
  const [full, setFull] = useState(false);
  const [tool, setTool] = useState<Tool>('select');
  const [players, setPlayers] = useState<Player[]>(defaultPlayers);
  const [paths, setPaths] = useState<[number, number][][]>([]);
  const [symbols, setSymbols] = useState<Symbol[]>([]);
  const [dragging, setDragging] = useState<number | null>(null);
  const [drawing, setDrawing] = useState<[number, number][] | null>(null);
  const [passStart, setPassStart] = useState<[number, number] | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const H = full ? FULL_H : HALF_H;

  function toSvg(evt: React.PointerEvent): [number, number] {
    const svg = svgRef.current!;
    const rect = svg.getBoundingClientRect();
    const scale = Math.min(rect.width / 500, rect.height / H);
    const ox = (rect.width - 500 * scale) / 2;
    const oy = (rect.height - H * scale) / 2;
    return [(evt.clientX - rect.left - ox) / scale, (evt.clientY - rect.top - oy) / scale];
  }

  function onPointerDown(evt: React.PointerEvent) {
    svgRef.current?.setPointerCapture(evt.pointerId);
    const [x, y] = toSvg(evt);
    if (tool === 'select') {
      const idx = players.findIndex((p) => Math.hypot(p.x - x, p.y - y) < 22);
      if (idx >= 0) setDragging(idx);
    } else if (tool === 'draw') {
      setDrawing([[x, y]]);
    } else if (tool === 'screen' || tool === 'roll') {
      setSymbols((s) => [...s, { type: tool, x, y }]);
    } else if (tool === 'pass') {
      if (!passStart) setPassStart([x, y]);
      else {
        setSymbols((s) => [...s, { type: 'pass', x: passStart[0], y: passStart[1], x2: x, y2: y }]);
        setPassStart(null);
      }
    }
  }

  function onPointerMove(evt: React.PointerEvent) {
    const [x, y] = toSvg(evt);
    if (dragging != null) {
      setPlayers((ps) => ps.map((p, i) => (i === dragging ? { ...p, x, y } : p)));
    } else if (drawing) {
      setDrawing((d) => (d ? [...d, [x, y]] : d));
    }
  }

  function onPointerUp() {
    if (dragging != null) setDragging(null);
    if (drawing) {
      setPaths((ps) => [...ps, drawing]);
      setDrawing(null);
    }
  }

  function reset() {
    setPlayers(defaultPlayers);
    setPaths([]);
    setSymbols([]);
    setPassStart(null);
  }

  function clear() {
    setPaths([]);
    setSymbols([]);
    setPassStart(null);
  }

  function toggleCourt() {
    setFull((f) => !f);
    reset();
  }

  return (
    <div className="tactics-board">
      <div className="board-toolbar">
        <div className="board-group">
          <button className="board-btn" onClick={toggleCourt}>{full ? '全场' : '半场'} ⇄</button>
        </div>
        <div className="board-group">
          {TOOLS.map(([t, label, Icon]) => (
            <button key={t} className={'board-btn' + (tool === t ? ' active' : '')} onClick={() => setTool(t)}>
              <Icon size={16} /> {label}
            </button>
          ))}
        </div>
        <div className="board-group">
          <button className="board-btn" onClick={clear}><Trash2 size={16} /> 清除标注</button>
          <button className="board-btn" onClick={reset}><RotateCcw size={16} /> 重置</button>
          <button className="board-btn" onClick={onClose}><X size={16} /> 关闭</button>
        </div>
      </div>
      <div className="board-stage">
        <svg
          ref={svgRef}
          className="board-court"
          viewBox={`0 0 500 ${H}`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
        >
          <rect x="0" y="0" width="500" height={H} className="board-floor" />
          {/* 界线 */}
          <g className="board-lines">
            <rect x="28" y="22" width="444" height={H - 44} />
            {full && <line x1="28" y1={H / 2} x2="472" y2={H / 2} />}
            {full && <circle cx="250" cy={H / 2} r="20" />}
            {/* 上半场（进攻） */}
            <rect x="174" y="22" width="152" height="179" />
            <rect x="193" y="22" width="114" height="179" />
            <circle cx="250" cy="201" r="57" />
            <path d="M67 22V112 C67 365 433 365 433 112V22" />
            <path d="M216 66h68" />
            <circle cx="250" cy="78" r="10" />
            <path d="M220 92a30 30 0 0 0 60 0" />
            {/* 下半场（全场时镜像） */}
            {full && (
              <>
                <rect x="174" y={H - 22 - 179} width="152" height="179" />
                <rect x="193" y={H - 22 - 179} width="114" height="179" />
                <circle cx="250" cy={H - 201} r="57" />
                <path d={`M67 ${H - 22}V${H - 112} C67 ${H - 365} 433 ${H - 365} 433 ${H - 112}V${H - 22}`} />
                <path d={`M216 ${H - 66}h68`} />
                <circle cx="250" cy={H - 78} r="10" />
                <path d={`M220 ${H - 92}a30 30 0 0 1 60 0`} />
              </>
            )}
          </g>
          {/* 跑位线 */}
          {paths.map((p, i) => (
            <path key={'p' + i} d={pathToD(p)} className="board-path" />
          ))}
          {drawing && <path d={pathToD(drawing)} className="board-path" />}
          {/* 符号 */}
          {symbols.map((s, i) => {
            if (s.type === 'screen') {
              return (
                <g key={'s' + i} transform={`translate(${s.x},${s.y})`} className="board-symbol">
                  <line x1="0" y1="-14" x2="0" y2="14" />
                  <line x1="-9" y1="0" x2="9" y2="0" />
                </g>
              );
            }
            if (s.type === 'roll') {
              return (
                <g key={'s' + i} transform={`translate(${s.x},${s.y})`} className="board-symbol">
                  <line x1="0" y1="-12" x2="0" y2="12" />
                  <path d="M-6 6L0 14L6 6" fill="none" />
                </g>
              );
            }
            return (
              <g key={'s' + i} className="board-symbol">
                <line x1={s.x} y1={s.y} x2={s.x2} y2={s.y2} strokeDasharray="6 5" />
                <path d={`M${s.x2} ${s.y2}l-7 -5M${s.x2} ${s.y2}l-7 5`} fill="none" />
              </g>
            );
          })}
          {passStart && <circle cx={passStart[0]} cy={passStart[1]} r="6" className="board-pass-dot" />}
          {/* 球员 */}
          {players.map((p, i) => (
            <g
              key={'pl' + i}
              transform={`translate(${p.x},${p.y})`}
              className="board-player"
              style={{ cursor: tool === 'select' ? 'grab' : 'default' }}
            >
              <rect x="-11" y="-11" width="22" height="22" rx="4" className={p.team === 'attack' ? 'board-attack' : 'board-defense'} />
              <text y="4" textAnchor="middle" className="board-number">{(i % 5) + 1}</text>
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
}
