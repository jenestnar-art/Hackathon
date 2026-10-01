import { useState } from 'react';
import { PARTS } from '../data/components.js';

// SVG 内嵌悬浮介绍卡：hover 元件时在台面内显示（自定义样式，跟随主题）
// 用法：<g onMouseEnter={() => setHover(TIPS.battery)} ...>  +  <HoverTip tip={hover} />
export function HoverTip({ tip }) {
  if (!tip) return null;
  return (
    <g pointerEvents="none">
      <rect
        x={tip.x} y={tip.y} width={tip.w || 220} height={tip.h || 64} rx={10}
        fill="var(--card)" stroke="var(--accent)" strokeWidth={1.5}
        opacity={0.97}
      />
      <text x={tip.x + 12} y={tip.y + 22} fill="var(--accent)" fontSize={13} fontWeight="700">
        {tip.icon} {tip.name}
      </text>
      {tip.lines.map((l, i) => (
        <text key={i} x={tip.x + 12} y={tip.y + 41 + i * 17} fill="var(--ink)" fontSize={11.5}>
          {l}
        </text>
      ))}
    </g>
  );
}

// 元件图鉴弹层：ⓘ 点击开关（弹层内嵌开关按钮，避免 hover 抖动）
export default function PartInfo({ partKey }) {
  const [open, setOpen] = useState(false);
  if (!partKey || !PARTS[partKey]) return null;
  const p = PARTS[partKey];

  return (
    <span style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          border: 'none', background: open ? 'var(--card)' : 'transparent', cursor: 'pointer',
          fontSize: 13, color: open ? 'var(--accent)' : 'var(--ink-dim)', padding: 2,
          borderRadius: 6,
        }}
        title={`图鉴：${p.name}`}
      >ⓘ</button>
      {open && (
        <div
          style={{
            position: 'absolute', top: 22, right: 0, zIndex: 50,
            width: 240, background: 'var(--card)', border: '1px solid var(--card-edge)',
            borderRadius: 10, padding: '10px 12px', boxShadow: 'var(--shadow)',
            fontSize: 12.5, lineHeight: 1.7, textAlign: 'left',
          }}
        >
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>{p.icon} {p.name}</div>
          <div>{p.what}</div>
          <div style={{ color: 'var(--ink-dim)' }}>{p.job}</div>
          <div style={{ color: 'var(--accent)' }}>{p.life}</div>
        </div>
      )}
    </span>
  );
}
