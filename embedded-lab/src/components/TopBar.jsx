import { useGame } from '../store/GameContext.jsx';
import { track } from '../lib/track.js';

// 顶部栏：返回/首页 + 关卡选择器 + 进度 + 主题开关
// 关卡点属高频导航：切换零动画（emil-design-eng 频率框架第一档）；
// hover 只做轻反馈（上浮+描边），气泡从触发点缩放展开
import { useState } from 'react';

const LEVELS = [
  { n: 1, name: '声控小夜灯' },
  { n: 2, name: '迷你温控风扇' },
  { n: 3, name: '倒车雷达' },
  { n: 4, name: '电子时钟' },
  { n: 5, name: '遥控小车' },
  { n: 6, name: '机械臂示教' },
  { n: 7, name: '自选发明' },
];

export default function TopBar() {
  const { state, dispatch } = useGame();
  const doneCount = Object.keys(state.done).length;
  const [hovered, setHovered] = useState(null);

  const go = (n) => {
    if (state.page === n) return;
    dispatch({ type: 'GOTO', page: n });
  };

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '12px 20px',
        gap: 12,
      }}
    >
      {/* 左：返回 + 首页 + 标题 */}
      <div style={{ fontWeight: 800, fontSize: 17, display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
        {state.page > 0 && state.page < 8 && (
          <button
            onClick={() => dispatch({ type: 'GOTO', page: state.page - 1 })}
            title="返回上一关"
            style={{
              border: 'none', background: 'transparent', cursor: 'pointer',
              fontSize: 18, color: 'var(--ink-dim)', padding: '2px 6px', borderRadius: 8,
              transition: 'color .15s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--accent)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--ink-dim)')}
          >
            ←
          </button>
        )}
        {state.page > 0 && (
          <button
            onClick={() => dispatch({ type: 'GOTO', page: 0 })}
            title="回到首页"
            style={{
              border: 'none', background: 'transparent', cursor: 'pointer',
              fontSize: 15, padding: '2px 4px', borderRadius: 8, opacity: 0.85,
              transition: 'transform .15s, opacity .15s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.15)'; e.currentTarget.style.opacity = 1; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.opacity = 0.85; }}
          >
            🏠
          </button>
        )}
        ⚡ 嵌入式实验室
        <span style={{ color: 'var(--ink-dim)', fontWeight: 400, fontSize: 13 }}>
          已完成 {doneCount}/7
        </span>
      </div>

      {/* 中：关卡选择器（1~7）——首页不显示 */}
      <div className="lvl-nav" style={{ display: 'flex', alignItems: 'center', gap: 8, visibility: state.page > 0 && state.page < 8 ? 'visible' : 'hidden' }}>
        {LEVELS.map(({ n, name }) => {
          const current = state.page === n;
          const cleared = !!state.done[n];
          return (
            <div key={n} style={{ position: 'relative' }}>
              <button
                className={current ? 'lvl-chip lvl-current' : cleared ? 'lvl-chip lvl-cleared' : 'lvl-chip'}
                onClick={() => { track('level_select', n, { from: state.page }); go(n); }}
                onMouseEnter={() => !current && setHovered(n)}
                onMouseLeave={() => setHovered((h) => (h === n ? null : h))}
              >
                <span className="lvl-num">{cleared && !current ? '✓' : n}</span>
              </button>
              {/* 关名气泡：从触发点缩放展开（origin 对准点） */}
              {hovered === n && !current && (
                <div className="lvl-tip" style={{ transformOrigin: 'top center' }}>
                  {n} · {name}{cleared ? ' · 已通关' : ''}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 右：主题开关 */}
      <button className="btn" onClick={() => dispatch({ type: 'TOGGLE_THEME' })}>
        {state.theme === 'dark' ? '☀️ 浅色' : '🌙 深色'}
      </button>
    </div>
  );
}
