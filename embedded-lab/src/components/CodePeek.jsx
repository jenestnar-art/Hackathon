import { useEffect, useRef, useState } from 'react';

// 混合模式核心组件：「看真实代码」抽屉
// 积木/接线的背后是真实的 Arduino C 代码 + 模拟串口输出滚屏
// 用法：<CodePeek code={...} serial={...} autoOpen={lit} />
//   code: 多行字符串（Arduino C 代码）
//   serial: 字符串数组。默认逐行"打印"（数组变化时重放）；
//           live=true 时由父组件持续追加、直接渲染（用于运行中的实时串口）
//   autoOpen: 为 true 时自动展开一次；用户手动收起后不再自动

export default function CodePeek({ code, serial = [], label = '🔍 看看这段电路对应的真实代码', autoOpen = false, live = false }) {
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false); // 用户手动收起后，autoOpen 失效
  const [lines, setLines] = useState([]);
  const timerRef = useRef(null);
  const serialRef = useRef(null);

  // live 模式直接渲染父组件给的行（最多 14 行）；否则用内部重放缓冲
  const shown = live ? serial.slice(-14) : lines;

  // 首次亮灯等高光时刻：自动展开一次（可中断的 transition 负责动画）
  useEffect(() => {
    if (autoOpen && !dismissed) setOpen(true);
  }, [autoOpen, dismissed]);

  const toggle = () => {
    setOpen((o) => {
      if (o) setDismissed(true);
      return !o;
    });
  };

  // 打开时逐行滚动串口输出（live 模式跳过：由父组件直接给全量行）
  useEffect(() => {
    if (!open || live || serial.length === 0) return;
    setLines([]);
    let i = 0;
    timerRef.current = setInterval(() => {
      setLines((prev) => {
        const next = [...prev, serial[i % serial.length]];
        return next.slice(-14); // 最多保留 14 行
      });
      i += 1;
      if (i >= serial.length) clearInterval(timerRef.current);
    }, 450);
    return () => clearInterval(timerRef.current);
  }, [open, serial]);

  // 自动滚到底（live 模式下 serial 持续变化，也要滚）
  useEffect(() => {
    if (serialRef.current) serialRef.current.scrollTop = serialRef.current.scrollHeight;
  }, [lines, serial]);

  return (
    <div style={{ width: '100%', maxWidth: 760, marginTop: 12, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <button
        className="btn"
        style={{ fontSize: 13, padding: '6px 16px' }}
        onClick={toggle}
      >
        {label}{open ? ' ▲' : ' ▼'}
      </button>
      {/* 展开区：max-height + opacity 过渡（可中断，比条件渲染平滑） */}
      <div
        style={{
          width: '100%',
          overflow: 'hidden',
          maxHeight: open ? 560 : 0,
          opacity: open ? 1 : 0,
          transition: `max-height 220ms var(--ease-out), opacity 200ms var(--ease-out)`,
          visibility: open ? 'visible' : 'hidden',
        }}
      >
        <div style={{
          paddingTop: 8, display: 'flex', gap: 10, alignItems: 'stretch',
          flexWrap: 'wrap', textAlign: 'left',
        }}>
          {/* 代码区 */}
          <pre style={{
            flex: '1 1 320px', margin: 0, background: '#0d1117', color: '#c9d1d9',
            border: '1px solid #30363d', borderRadius: 10, padding: '12px 14px',
            fontSize: 12.5, lineHeight: 1.6, overflowY: 'auto', maxHeight: 500,
            fontFamily: 'Consolas, "Courier New", monospace',
          }}>
            {code.split('\n').map((l, i) => (
              <div key={i}>
                <span style={{ color: '#484f58', userSelect: 'none', display: 'inline-block', width: 22 }}>{i + 1}</span>
                {highlight(l)}
              </div>
            ))}
          </pre>
          {/* 串口监视器 */}
          {serial.length > 0 && (
            <div style={{
              flex: '1 1 220px', background: '#0a0e14', border: '1px solid #1f6feb',
              borderRadius: 10, overflow: 'hidden', display: 'flex', flexDirection: 'column',
              minWidth: 220,
            }}>
              <div style={{
                background: '#1f6feb', color: '#fff', fontSize: 11, padding: '4px 10px',
                fontWeight: 700, letterSpacing: 1,
              }}>
                SERIAL MONITOR · 115200 baud
              </div>
              <div ref={serialRef} style={{
                flex: 1, padding: '8px 10px', fontSize: 12, color: '#4ade80',
                fontFamily: 'Consolas, monospace', minHeight: 120, maxHeight: 200,
                overflowY: 'auto', lineHeight: 1.7,
              }}>
                {shown.length === 0 && (
                  <div style={{ color: '#3d4a5c' }}>等待运行…（拍手后这里会打印真实串口输出）</div>
                )}
                {shown.map((l, i) => <div key={i}>{l}</div>)}
                <span style={{ opacity: 0.8 }}>▌</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// 极简 C 语法高亮：关键字 / 类型 / 数字 / 注释 / 字符串
const KEYWORDS = /\b(void|int|float|const|if|else|for|while|return|true|false|HIGH|LOW|INPUT|OUTPUT|INPUT_PULLUP)\b/;
const FUNCS = /\b(setup|loop|pinMode|digitalWrite|digitalRead|analogRead|analogWrite|delay|Serial|map|constrain|tone|noTone|millis)\b/;

function highlight(line) {
  // 注释整行
  if (line.trim().startsWith('//')) {
    return <span style={{ color: '#8b949e', fontStyle: 'italic' }}>{line}</span>;
  }
  // 简单分词着色
  const parts = line.split(/(\s+|[(),;{}])/);
  return parts.map((p, i) => {
    if (!p) return null;
    if (KEYWORDS.test(p)) return <span key={i} style={{ color: '#ff7b72' }}>{p}</span>;
    if (FUNCS.test(p)) return <span key={i} style={{ color: '#d2a8ff' }}>{p}</span>;
    if (/^\d+(\.\d+)?$/.test(p)) return <span key={i} style={{ color: '#79c0ff' }}>{p}</span>;
    if (/^["']/.test(p)) return <span key={i} style={{ color: '#a5d6ff' }}>{p}</span>;
    return <span key={i}>{p}</span>;
  });
}
