// 终局：作品架 + 徽章墙 + 探索卡（可截图分享）
import { useGame } from '../store/GameContext.jsx';
import { PARTS } from '../data/components.js';

const BADGE_ICONS = {
  接线员: '🔌', 程序员: '🧩', 雷达兵: '📡', 指挥官: '⏰', 通信兵: '📶', 工程师: '🦾', '入门者': '🎓',
};

const LEVEL_NAMES = {
  1: '🪔 声控小夜灯', 2: '🌀 迷你温控风扇', 3: '📡 倒车雷达', 4: '⏰ 电子时钟',
  5: '🚙 遥控小车', 6: '🦾 示教机械臂', 7: '🎓 阶段总结',
};

export default function Final() {
  const { state } = useGame();
  const doneCount = Object.keys(state.done).length;
  const collectCount = state.collected.length;

  return (
    <div style={{ width: '100%', maxWidth: 720, textAlign: 'center' }}>
      <h2 style={{ margin: '0 0 6px' }}>🏆 你的作品架</h2>
      <div style={{ color: 'var(--ink-dim)', fontSize: 14, marginBottom: 20 }}>
        今天你亲手做出了 {doneCount}/7 个嵌入式器件
      </div>

      {/* 作品架 */}
      <div style={{
        display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center',
        background: 'var(--bench)', borderRadius: 14, border: '1px solid var(--card-edge)',
        padding: 20, marginBottom: 20,
      }}>
        {[1, 2, 3, 4, 5, 6, 7].map((n) => (
          <div key={n} style={{
            width: 84, height: 84, borderRadius: 10,
            background: state.done[n] ? 'var(--card)' : 'transparent',
            border: state.done[n] ? '1px solid var(--live)' : '1px dashed var(--card-edge)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            fontSize: 12, opacity: state.done[n] ? 1 : 0.4,
          }}>
            <span style={{ fontSize: 26 }}>{state.done[n] ? LEVEL_NAMES[n].split(' ')[0] : '❔'}</span>
            {state.done[n] ? LEVEL_NAMES[n].split(' ')[1] : '未解锁'}
          </div>
        ))}
      </div>

      {/* 徽章墙 */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 13, color: 'var(--ink-dim)', marginBottom: 8 }}>徽章墙</div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
          {Object.keys(BADGE_ICONS).map((b) => (
            <span key={b} style={{
              padding: '6px 12px', borderRadius: 999, fontSize: 13,
              background: state.badges.includes(b) ? 'var(--card)' : 'transparent',
              border: state.badges.includes(b) ? '1px solid var(--accent)' : '1px dashed var(--card-edge)',
              opacity: state.badges.includes(b) ? 1 : 0.35,
            }}>
              {BADGE_ICONS[b]} {b}
            </span>
          ))}
        </div>
      </div>

      {/* 图鉴收集 */}
      <div style={{ fontSize: 13, color: 'var(--ink-dim)', marginBottom: 8 }}>
        你认识的元件 {collectCount}/{Object.keys(PARTS).length}
      </div>

      <div style={{
        background: 'var(--card)', border: '1px solid var(--card-edge)', borderRadius: 12,
        padding: '16px 20px', fontSize: 14, lineHeight: 1.9, textAlign: 'left',
      }}>
        <b>一句话总结：</b>嵌入式就是<b>让电路听懂世界、替人做事</b>——
        感知（传感器）→ 判断（单片机跑你的逻辑）→ 执行（灯/电机/屏幕）。
        <br />
        <span style={{ color: 'var(--ink-dim)' }}>
          你的下一关：想知道灯怎么自己知道 1 秒到了？去查查「定时器」和「中断」——那是嵌入式真正的深海 🌊
        </span>
      </div>
    </div>
  );
}
