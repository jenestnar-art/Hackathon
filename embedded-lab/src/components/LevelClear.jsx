import { useGame } from '../store/GameContext.jsx';
import { track } from '../lib/track.js';

// 通关演出卡：徽章 + 下一关按钮（用户自己点击去下一关，不自动跳）
export default function LevelClear({ level, device, badge, badgeIcon, insight }) {
  const { state, dispatch } = useGame();
  const last = level >= 7;
  const nextPage = last ? 8 : level + 1;

  return (
    <div style={{
      width: '100%', maxWidth: 520, textAlign: 'center',
      background: 'var(--card)', border: '1px solid var(--live)', borderRadius: 16,
      padding: '28px 32px', boxShadow: '0 0 40px rgba(74,222,128,.15)',
    }}>
      <div style={{ fontSize: 44, marginBottom: 8 }}>{badgeIcon}</div>
      <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 4 }}>
        🎉 「{device}」制作完成！
      </div>
      <div style={{ marginBottom: 16 }}>
        <span style={{
          display: 'inline-block', padding: '4px 14px', borderRadius: 999,
          background: 'var(--bench)', border: '1px solid var(--accent)',
          fontSize: 13, color: 'var(--accent)', fontWeight: 700,
        }}>
          🏅 获得徽章：{badge}
        </span>
      </div>
      <div style={{ fontSize: 14, lineHeight: 1.9, color: 'var(--ink)', marginBottom: 20, textAlign: 'left' }}>
        {insight}
      </div>
      <button
        className="btn btn-primary"
        style={{ fontSize: 16 }}
        onClick={() => {
          track('goto_next', level, { to: nextPage });
          dispatch({ type: 'GOTO', page: nextPage });
        }}
      >
        {last ? '🏆 去看我的作品架' : '▶ 去第 ' + (level + 1) + ' 关'}
      </button>
      <div style={{ marginTop: 10, fontSize: 12, color: 'var(--ink-dim)' }}>
        也可以留在本关继续玩
      </div>
    </div>
  );
}
