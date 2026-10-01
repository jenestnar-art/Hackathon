import { useEffect, useRef, useState } from 'react';
import { useGame } from '../store/GameContext.jsx';

// 20 秒无操作主动提示（防卡死）
const IDLE_MS = 20000;

const MOOD_EMOJI = {
  happy: '😄',
  normal: '🙂',
  think: '🤔',
  panic: '😰',
  cheer: '🥳',
};

// Q版伙伴：emoji 表情 + 气泡；后续在说到的词上加图鉴直达
export default function Companion({ hint }) {
  const { state } = useGame();
  const { text, mood } = state.companion;
  const [idleTip, setIdleTip] = useState(false);
  const lastEvent = useRef(Date.now());

  useEffect(() => {
    lastEvent.current = Date.now();
    setIdleTip(false);
    const t = setInterval(() => {
      if (Date.now() - lastEvent.current > IDLE_MS) {
        setIdleTip(true);
      }
    }, 3000);
    const bump = () => (lastEvent.current = Date.now());
    window.addEventListener('pointerdown', bump);
    window.addEventListener('keydown', bump);
    return () => {
      clearInterval(t);
      window.removeEventListener('pointerdown', bump);
      window.removeEventListener('keydown', bump);
    };
  }, [text]);

  const shown = idleTip && hint ? hint : text;

  return (
    <div className="companion" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ fontSize: 42, lineHeight: 1 }}>{MOOD_EMOJI[mood] || MOOD_EMOJI.normal}</div>
      <div
        style={{
          background: 'var(--card)',
          border: '1px solid var(--card-edge)',
          borderRadius: 12,
          padding: '10px 14px',
          maxWidth: 340,
          boxShadow: 'var(--shadow)',
          fontSize: 14,
        }}
      >
        {shown}
      </div>
    </div>
  );
}
