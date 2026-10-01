import { useGame } from '../store/GameContext.jsx';

// 开场页：一句话定位 + 开始/继续按钮
export default function Intro() {
  const { state, dispatch, track } = useGame();

  // 已有进度 → 显示「继续闯关」，直达下一个未通关
  const doneLevels = Object.keys(state.done).map(Number);
  const next = doneLevels.length ? Math.min(7, Math.max(...doneLevels) + 1) : 1;
  const hasProgress = doneLevels.length > 0;

  return (
    <div style={{ textAlign: 'center', maxWidth: 560 }}>
      <div style={{ fontSize: 64, marginBottom: 8 }}>🔌</div>
      <h1 style={{ margin: '0 0 12px', fontSize: 30 }}>嵌入式实验室</h1>
      <p style={{ color: 'var(--ink-dim)', fontSize: 16, lineHeight: 1.8, margin: '0 0 28px' }}>
        你身边的台灯、空调、倒车雷达、红绿灯……<br />
        它们都会「思考」。怎么做到的？<br />
        <b>亲手做出 7 个小器件，你就懂了。</b>
      </p>
      <button
        className="btn btn-primary"
        style={{ fontSize: 18, padding: '12px 40px' }}
        onClick={() => {
          track('start_press');
          dispatch({ type: 'GOTO', page: next });
        }}
      >
        {hasProgress ? `继续闯关 · 第 ${next} 关 →` : '开始制作 →'}
      </button>
      {hasProgress && (
        <div style={{ marginTop: 14, fontSize: 13, color: 'var(--ink-dim)' }}>
          也可以用顶部的关卡点跳到任意已解锁的关
        </div>
      )}
    </div>
  );
}
