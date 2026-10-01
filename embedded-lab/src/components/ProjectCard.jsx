// Instructables 式项目卡：每关开场的“拆快递”清单
export default function ProjectCard({ level, title, icon, difficulty, minutes, parts, goal, onStart }) {
  return (
    <div
      style={{
        width: 420, background: 'var(--card)', border: '1px solid var(--card-edge)',
        borderRadius: 16, padding: '22px 24px', boxShadow: 'var(--shadow)', textAlign: 'left',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <div style={{ fontSize: 13, color: 'var(--ink-dim)' }}>第 {level} 关 · 新物件运到了</div>
        <div style={{ fontSize: 13, color: 'var(--ink-dim)' }}>⏱ 约 {minutes} 分钟</div>
      </div>
      <div style={{ fontSize: 24, fontWeight: 800, margin: '6px 0 2px' }}>
        {icon} {title}
      </div>
      <div style={{ fontSize: 13, color: 'var(--accent)', marginBottom: 14 }}>
        难度 {'★'.repeat(difficulty)}{'☆'.repeat(5 - difficulty)}
      </div>

      <div style={{ fontSize: 13, color: 'var(--ink-dim)', marginBottom: 6 }}>元件清单</div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
        {parts.map((p) => (
          <span
            key={p.key}
            style={{
              background: 'var(--bench)', border: '1px solid var(--card-edge)',
              borderRadius: 8, padding: '5px 10px', fontSize: 13,
            }}
          >
            {p.icon} {p.name} ×{p.count}
          </span>
        ))}
      </div>

      <div style={{ fontSize: 13.5, lineHeight: 1.7, marginBottom: 18 }}>
        <span style={{ color: 'var(--ink-dim)' }}>目标：</span>
        {goal}
      </div>

      <button className="btn btn-primary" style={{ width: '100%', fontSize: 16 }} onClick={onStart}>
        📦 开始制作
      </button>
    </div>
  );
}
