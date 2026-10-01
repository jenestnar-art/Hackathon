// 第 2 关「迷你温控风扇」：拼积木 → RUN → 看到自己的逻辑让房间降温
// 排版对齐第 1 关：竖向 760px 居中列（SVG 台面 → 积木区 → RUN → 通关行 → 知识点 → CodePeek）
import { useEffect, useRef, useState } from 'react';
import { useGame } from '../store/GameContext.jsx';
import { track } from '../lib/track.js';
import ProjectCard from '../components/ProjectCard.jsx';
import PartInfo from '../components/PartInfo.jsx';
import CodePeek from '../components/CodePeek.jsx';

const CHAIN = [
  { id: 'sense', label: '🌡️ 温度传感器', desc: '每 0.2 秒读一次温度', kind: '感知' },
  { id: 'judge', label: '❓ 温度 > 30℃ ？', desc: '真 → 往下传；假 → 停', kind: '判断', threshold: 30 },
  { id: 'act', label: '⚙️ 风扇转动', desc: 'GPIO 输出 HIGH', kind: '执行' },
];

// 真实 Arduino 代码（LM35 温控风扇）
const ARDUINO_CODE = `// 温控风扇：感知 → 判断 → 执行
const int TEMP_PIN = A0;   // 温度传感器（LM35）
const int FAN_PIN  = 9;    // 风扇接在 GPIO 9
const int LIMIT    = 30;   // 判断阈值：30℃

void setup() {
  pinMode(FAN_PIN, OUTPUT);
  Serial.begin(115200);
}

void loop() {
  // 感知：读温度（LM35 每 10mV = 1℃）
  int raw = analogRead(TEMP_PIN);
  float temp = raw * 5.0 / 1023.0 * 100.0;

  // 判断：超过阈值吗？
  if (temp > LIMIT) {
    // 执行：GPIO 输出 HIGH，风扇转
    digitalWrite(FAN_PIN, HIGH);
  } else {
    digitalWrite(FAN_PIN, LOW);
  }

  Serial.print("temp=");
  Serial.print(temp, 1);
  Serial.print("C fan=");
  Serial.println(digitalRead(FAN_PIN) == HIGH ? "ON" : "OFF");
  delay(200);
}`;

export default function Level2_AC() {
  const { state, dispatch } = useGame();
  const [started, setStarted] = useState(false);
  const [placed, setPlaced] = useState([]); // 已放入链槽的积木 id（顺序由用户自己排，RUN 检验）
  const [runError, setRunError] = useState(false); // 顺序排错 → 烧录失败提示
  const [running, setRunning] = useState(false);
  const [temp, setTemp] = useState(27);
  const [fanOn, setFanOn] = useState(false);
  const [threshold, setThreshold] = useState(30);
  const [hover, setHover] = useState(null);
  const [serial, setSerial] = useState([]); // 实时串口行（live 模式）
  const [drag, setDrag] = useState(null);   // 接线中：{ from, x, y }（null = 没在接线）
  const [wires, setWires] = useState([]);   // 已接的线 [{a, b}]（允许接错的线，红的虚线）
  // 通关后挑战：调阈值让风扇「智能启停」——既不能一直转（费电），也不能一直停（热）
  const [challengeOn, setChallengeOn] = useState(false);   // 是否接受了挑战
  const [challengeDone, setChallengeDone] = useState(false);
  const sawOnRef = useRef(false);   // 挑战期间见过风扇转
  const sawOffRef = useRef(false);  // 挑战期间见过风扇停
  const svgRef = useRef(null);
  // 引脚 id：传感器侧 s_vout/s_gnd，主控板侧 m_vout/m_gnd/fan_out，风扇侧 fan_in
  // 正确配对（REQUIRED）：Vout→主控输入、GND→主控地、主控输出→风扇
  const PAIRS = { vout: ['s_vout', 'm_vout'], gnd: ['s_gnd', 'm_gnd'], fan: ['fan_out', 'fan_in'] };
  const hasWire = (a, b) => wires.some((w) => (w.a === a && w.b === b) || (w.a === b && w.b === a));
  const isWrong = (a, b) => !Object.values(PAIRS).some(([x, y]) => (x === a && y === b) || (x === b && y === a));
  const tempRef = useRef(temp);
  tempRef.current = temp;
  const fanRef = useRef(fanOn);
  fanRef.current = fanOn;

  const chainOK = placed.length === CHAIN.length;
  // 三根正确的线都接好（接错的线不算，会显示红虚线，点一下可拆除）
  const wiredOK = Object.values(PAIRS).every(([a, b]) => hasWire(a, b));
  // 顺序对不对由 RUN 检验（不放箭头提示，用户自己排）
  const orderOK = placed.every((id, i) => id === CHAIN[i].id);

  // 世界：温度正弦漂移 + 噪声；风扇转时持续降温（单一 interval，ref 防重建）
  useEffect(() => {
    if (!running) return;
    let tick = 0;
    const iv = setInterval(() => {
      tick += 1;
      setTemp((v) => {
        let next;
        if (fanRef.current) {
          next = Math.max(27, v - 0.08); // 风扇让房间降温（每 200ms -0.08 ≈ 每秒 -0.4℃）
          // 降到 28℃ 附近时世界自然回升，形成启停边界
          if (next <= 28) next = 28 + Math.random() * 0.2;
        } else {
          next = 31 + 2 * Math.sin(tick / 18) + (Math.random() - 0.5) * 0.4; // 起始 31℃：RUN 后约 2 秒内必破 30℃，首次成功更快
        }
        return Math.round(next * 10) / 10;
      });
    }, 200);
    return () => clearInterval(iv);
  }, [running]);

  // 链执行（每 200ms 由温度变化驱动）
  useEffect(() => {
    if (!running || !chainOK || !wiredOK) return;
    setFanOn(temp > threshold);
  }, [temp, running, chainOK, threshold, wiredOK]);

  // 实时串口输出：温度/风扇状态变化时追加一行
  useEffect(() => {
    if (!running || !chainOK || !wiredOK) return;
    setSerial((prev) => [
      ...prev,
      `temp=${temp.toFixed(1)}C fan=${fanOn ? 'ON' : 'OFF'}`,
    ].slice(-30));
  }, [temp, fanOn, running, chainOK, wiredOK]);

  // 通关：第一次亲眼看到降温（风扇转起来）
  useEffect(() => {
    if (running && chainOK && wiredOK && fanOn && !state.done[2]) {
      track('level_complete', 2);
      dispatch({ type: 'COMPLETE_LEVEL', level: 2, device: '迷你温控风扇', badge: '程序员' });
      dispatch({ type: 'SAY', text: '看到了吗？温度降下来了——你写的「感知→判断→执行」让房间变凉快了！GPIO 就是单片机的手和耳朵 👐', mood: 'cheer' });
    }
  }, [fanOn, running, chainOK]);

  // 通关后挑战：风扇转/停都见过 + 维持 2 秒不切换 = 阈值合理，挑战成功
  useEffect(() => {
    if (!challengeOn || challengeDone || !running) return;
    if (fanOn) sawOnRef.current = true; else sawOffRef.current = true;
    if (!sawOnRef.current || !sawOffRef.current) return;
    const t = setTimeout(() => {
      setChallengeDone(true);
      track('challenge_complete', 2, { threshold });
      dispatch({ type: 'SAY', text: `完美！${threshold}℃ 这个阈值刚刚好——热了自动转，凉了自动歇。真实的空调、冰箱里就是这样的逻辑，只是阈值由工程师标定`, mood: 'cheer' });
    }, 2000);
    return () => clearTimeout(t);
  }, [fanOn, challengeOn, challengeDone, running, threshold]);

  if (!started) {
    return (
      <ProjectCard
        level={2} title="迷你温控风扇" icon="🌀" difficulty={2} minutes={3}
        parts={[
          { key: 'tempSensor', icon: '🌡️', name: '温度传感器', count: 1 },
          { key: 'mcu', icon: '🧠', name: '主控板', count: 1 },
          { key: 'motor', icon: '⚙️', name: '电机(风扇)', count: 1 },
        ]}
        goal="把 3 块积木拼成「感知 → 判断 → 执行」，点 RUN 烧录，看温度超过 30℃ 时风扇自动转起来。"
        onStart={() => { setStarted(true); track('level_start', 2); }}
      />
    );
  }

  const TIPS = {
    sensor: {
      icon: '🌡️', name: '温度传感器', x: 20, y: 2,
      lines: ['把温度变成电信号——单片机的「皮肤」', 'LM35：每升高 1℃，输出多 10mV'],
    },
    mcu: {
      icon: '🧠', name: '主控板（单片机）', x: 280, y: 2,
      lines: ['一颗小电脑：读传感器、做判断、发指令', '旁边的引脚就是 GPIO——手和耳朵'],
    },
    fan: {
      icon: '⚙️', name: '直流电机（风扇）', x: 500, y: 2,
      lines: ['GPIO 给 HIGH 就转、LOW 就停', '真正「看得见」的执行器'],
    },
  };

  const done2 = !!state.done[2];

  // 引脚坐标（画线用，与台面上画出来的圆点一致）
  const PIN_POS = {
    s_vout: [49, 134], s_gnd: [101, 134],
    m_vout: [298, 139], m_gnd: [298, 157], fan_out: [498, 66], fan_in: [553, 72],
  };
  // 线的分组归属（拆线用）：id → groupKey
  const pinGroup = (id) => Object.keys(PAIRS).find((key) => PAIRS[key].includes(id));

  // 两引脚间的贝塞尔导线（比直线圆润，同 1 关气质）
  const wirePath = (a, b) => {
    const [x1, y1] = PIN_POS[a], [x2, y2] = PIN_POS[b];
    const mx = (x1 + x2) / 2;
    return `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`;
  };

  // 接线（与第 1 关同手势）：按住引脚拖到任意引脚松手
  // 接对了变黄线；接错了也接上（显示红色虚线，点一下拆除）——和 1 关一样由电路反馈对错
  const startDrag = (k) => (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (hasWire(k, k)) return;
    const move = (ev) => {
      const r = svgRef.current.getBoundingClientRect();
      // SVG 用 viewBox 缩放，换算成 viewBox 坐标
      setDrag({ from: k, x: (ev.clientX - r.left) * 760 / r.width, y: (ev.clientY - r.top) * 216 / r.height });
    };
    const up = (ev) => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      setDrag(null);
      const r = svgRef.current.getBoundingClientRect();
      const px = (ev.clientX - r.left) * 760 / r.width, py = (ev.clientY - r.top) * 216 / r.height;
      // 找落点附近的引脚
      const to = Object.keys(PIN_POS).find((id) => Math.hypot(PIN_POS[id][0] - px, PIN_POS[id][1] - py) < 20);
      if (!to || to === k || hasWire(k, to)) return;
      setWires((w) => [...w, { a: k, b: to }]);
      if (isWrong(k, to)) {
        track('reject', 2, { reason: 'mismatch', a: k, b: to });
        dispatch({ type: 'SAY', text: '咦，这样接不通——传感器脚要接主控板的输入脚，风扇接 GPIO 输出脚。点红线拆掉重接', mood: 'think' });
      } else {
        track('connect', 2, { wire: pinGroup(k) });
        dispatch({ type: 'SAY', text: pinGroup(k) === 'fan' ? '风扇接到 GPIO 9 了！' : '传感器接好了——单片机现在能「读到」温度', mood: 'happy' });
      }
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
      <div style={{ width: '100%', maxWidth: 760, display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* 顶部提示 */}
        <div style={{ fontSize: 13, color: 'var(--ink-dim)', textAlign: 'center' }}>
          先点引脚把传感器和风扇接到主控板 · 再把积木按顺序拖进链槽 · 点 RUN 烧录 · 盯着温度，看你的逻辑让风扇转起来
        </div>

        {/* 台面：SVG 元件舞台 + 接线 */}
        <svg ref={svgRef} viewBox="0 0 760 216" className="bench-grid fade-up" style={{
          width: '100%', background: 'var(--bench)', borderRadius: 14,
          border: '1px solid var(--card-edge)', touchAction: 'none', userSelect: 'none',
        }} onMouseLeave={() => setHover(null)}>
          <defs>
            <filter id="fanBlur" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="1.6" />
            </filter>
          </defs>

          {/* 已接好的导线（贝塞尔，点一下拆除；接错的显示红虚线） */}
          {wires.map((w, i) => {
            const wrong = isWrong(w.a, w.b);
            return (
              <g key={i} style={{ cursor: 'pointer' }}
                onClick={(e) => {
                  e.stopPropagation();
                  setWires((ws) => ws.filter((_, k) => k !== i));
                  track('wire_remove', 2, { wire: `${w.a}->${w.b}` });
                }}>
                <path d={wirePath(w.a, w.b)} stroke="#000" strokeOpacity={0.3} strokeWidth={7} fill="none" strokeLinecap="round" />
                <path d={wirePath(w.a, w.b)}
                  stroke={wrong ? 'var(--danger)' : 'var(--accent)'} strokeWidth={4}
                  fill="none" strokeLinecap="round" opacity={0.9}
                  strokeDasharray={wrong ? '9,6' : undefined} />
                {wrong && (
                  <text x={(PIN_POS[w.a][0] + PIN_POS[w.b][0]) / 2} y={(PIN_POS[w.a][1] + PIN_POS[w.b][1]) / 2 - 10}
                    textAnchor="middle" fontSize={12}>⚠️</text>
                )}
              </g>
            );
          })}
          {/* 正在拖的预览线（虚线，跟随鼠标） */}
          {drag && (
            <line
              x1={PIN_POS[drag.from][0]} y1={PIN_POS[drag.from][1]} x2={drag.x} y2={drag.y}
              stroke="var(--accent)" strokeWidth={2} strokeDasharray="6,5" opacity={0.7}
            />
          )}

          {/* 温度传感器（放大版） */}
          <g onMouseEnter={() => setHover(TIPS.sensor)} style={{ cursor: 'help' }}>
            <rect x={16} y={31} width={117} height={81} rx={10} fill="var(--card)" stroke="var(--card-edge)" strokeWidth={1.5} />
            <rect x={42} y={2} width={70} height={32} rx={5} fill="#5a6472" />
            <rect x={52} y={10} width={50} height={18} rx={3} fill="#1f2933" />
            {/* LIVE 数值徽章 */}
            <text x={77} y={24} textAnchor="middle" fill={temp > threshold ? 'var(--danger)' : 'var(--live)'} fontSize={14} fontWeight={700} fontFamily="Consolas, monospace">
              {temp.toFixed(1)}℃
            </text>
            <text x={75} y={105} textAnchor="middle" fill="var(--ink-dim)" fontSize={13}>LM35</text>
          </g>

          {/* 传感器引脚：Vout / GND（按住拖到主控板引脚接线） */}
          {['s_vout', 's_gnd'].map((k, i) => {
            const px = i === 0 ? 45 : 97;
            const g = pinGroup(k);
            const wired = g && hasWire(...PAIRS[g]);
            const active = drag?.from === k;
            return (
              <g key={k} onPointerDown={startDrag(k)} style={{ cursor: wired ? 'default' : 'grab' }}>
                <circle cx={px + 4} cy={134} r={9}
                  fill={wired ? 'var(--live)' : active ? 'var(--accent)' : 'var(--card)'}
                  stroke={wired ? 'var(--live)' : active ? 'var(--accent)' : 'var(--card-edge)'} strokeWidth={1.5}
                  style={{ transition: 'fill 120ms var(--ease-out)' }} />
                <text x={px + 4} y={157} textAnchor="middle" fill="var(--ink-dim)" fontSize={10.5}>{i === 0 ? 'Vout' : 'GND'}</text>
              </g>
            );
          })}

          {/* 主控板（放大版） */}
          <g onMouseEnter={() => setHover(TIPS.mcu)} style={{ cursor: 'help' }}>
            <rect x={278} y={17} width={195} height={114} rx={10} fill="#1f6feb" opacity={0.12} stroke="var(--card-edge)" strokeWidth={1.5} />
            <rect x={305} y={37} width={91} height={57} rx={5} fill="#2d333b" stroke="#666" strokeWidth={1} />
            {/* 芯片引脚 */}
            {[0, 1, 2, 3].map((i) => (
              <rect key={i} x={312 + i * 22} y={30} width={6} height={9} fill="#8a929c" />
            ))}
            {[0, 1, 2, 3].map((i) => (
              <rect key={i} x={312 + i * 22} y={92} width={6} height={9} fill="#8a929c" />
            ))}
            <circle cx={371} cy={45} r={4} fill="#666" />
            <text x={316} y={71} fill="#c9d1d9" fontSize={11.5} fontFamily="Consolas, monospace">STM32</text>
            <text x={375} y={123} textAnchor="middle" fill="var(--ink-dim)" fontSize={12}>主控板</text>
            {/* 主控板引脚：Vout入 / GND入 / 风扇出（按住拖动接线） */}
            {[
              { k: 'm_vout', x: 298, y: 139 },
              { k: 'm_gnd', x: 298, y: 157 },
              { k: 'fan_out', x: 498, y: 66 },
            ].map(({ k, x, y }) => {
              const g = pinGroup(k);
              const wired = g && hasWire(...PAIRS[g]);
              const active = drag?.from === k;
              return (
                <g key={k} onPointerDown={startDrag(k)} style={{ cursor: wired ? 'default' : 'grab' }}>
                  <circle cx={x} cy={y} r={9}
                    fill={wired ? 'var(--live)' : active ? 'var(--accent)' : 'var(--card)'}
                    stroke={wired ? 'var(--live)' : active ? 'var(--accent)' : 'var(--card-edge)'} strokeWidth={1.5}
                    style={{ transition: 'fill 120ms var(--ease-out)' }} />
                </g>
              );
            })}
            {/* GPIO 徽章：风扇脚（在 fan_out 引脚左侧，别压住引脚） */}
            <rect x={424} y={52} width={52} height={26} rx={6}
              fill={fanOn ? 'var(--live)' : 'var(--bench)'}
              stroke={fanOn ? 'var(--live)' : 'var(--card-edge)'} strokeWidth={1}
              style={{ transition: 'fill 120ms var(--ease-out), stroke 120ms var(--ease-out)' }} />
            <text x={450} y={70} textAnchor="middle" fontSize={13} fontWeight={700}
              fill={fanOn ? '#111' : 'var(--ink-dim)'}
              style={{ transition: 'fill 120ms var(--ease-out)' }} fontFamily="Consolas, monospace">
              {fanOn ? 'HIGH' : 'LOW'}
            </text>
            <text x={450} y={95} textAnchor="middle" fill="var(--ink-dim)" fontSize={11}>GPIO 9</text>
          </g>

          {/* 风扇（放大版）：外圈 + 三叶片真旋转 + 残影 */}
          <g onMouseEnter={() => setHover(TIPS.fan)} style={{ cursor: 'help' }}>
            <circle cx={610} cy={72} r={57} fill="var(--card)" stroke="var(--card-edge)" strokeWidth={1.5} />
            <circle cx={610} cy={72} r={44} fill="none" stroke="var(--card-edge)" strokeWidth={1} opacity={0.6} />
            {/* 风扇接线引脚 */}
            {(() => {
              const wired = hasWire(...PAIRS.fan);
              const active = drag?.from === 'fan_in';
              return (
                <g style={{ cursor: wired ? 'default' : 'grab' }} onPointerDown={startDrag('fan_in')}>
                  <circle cx={553} cy={72} r={9}
                    fill={wired ? 'var(--live)' : active ? 'var(--accent)' : 'var(--card)'}
                    stroke={wired ? 'var(--live)' : active ? 'var(--accent)' : 'var(--card-edge)'} strokeWidth={1.5}
                    style={{ transition: 'fill 120ms var(--ease-out)' }} />
                </g>
              );
            })()}
            {/* 残影层（转起来才出现） */}
            {fanOn && (
              <g opacity={0.3} filter="url(#fanBlur)">
                <g style={{ animation: 'l2spin 0.5s linear infinite', transformOrigin: '610px 72px' }}>
                  <path d="M610 72 L610 33 A39 39 0 0 1 644 52 Z" fill="var(--accent)" />
                  <path d="M610 72 L576 92 A39 39 0 0 1 576 52 Z" fill="var(--accent)" />
                  <path d="M610 72 L644 92 A39 39 0 0 1 610 111 Z" fill="var(--accent)" />
                </g>
              </g>
            )}
            {/* 主叶片 */}
            <g style={{ animation: fanOn ? 'l2spin 0.5s linear infinite' : 'none', transformOrigin: '610px 72px' }}>
              <path d="M610 72 L610 33 A39 39 0 0 1 644 52 Z" fill="var(--accent)" />
              <path d="M610 72 L576 92 A39 39 0 0 1 576 52 Z" fill="var(--accent)" />
              <path d="M610 72 L644 92 A39 39 0 0 1 610 111 Z" fill="var(--accent)" />
            </g>
            <circle cx={610} cy={72} r={9} fill="#8a929c" stroke="#5a626c" strokeWidth={2} />
            <text x={610} y={147} textAnchor="middle" fill="var(--ink-dim)" fontSize={12}>
              {fanOn ? '风扇转动中' : '风扇停止'}
            </text>
          </g>

          <style>{`@keyframes l2spin { to { transform: rotate(360deg) } }`}</style>
        </svg>

        {/* 悬浮说明栏：固定在台面下方，不遮元件 */}
        <div style={{
          minHeight: 44, display: 'flex', alignItems: 'center', gap: 10,
          background: 'var(--card)', border: '1px solid var(--card-edge)', borderRadius: 10,
          padding: '6px 14px', fontSize: 13,
        }}>
          {hover ? (
            <>
              <span style={{ fontWeight: 700, color: 'var(--accent)', whiteSpace: 'nowrap' }}>{hover.icon} {hover.name}</span>
              <span style={{ color: 'var(--ink-dim)' }}>{hover.lines.join('　·　')}</span>
            </>
          ) : (
            <span style={{ color: 'var(--ink-dim)' }}>鼠标移到元件上看介绍</span>
          )}
        </div>

        {/* 中段：积木区 + RUN（760px 内左右分栏，宽度对齐） */}
        <div style={{ display: 'flex', gap: 16, alignItems: 'stretch' }}>
          {/* 积木链 */}
          <div style={{ flex: 1 }}>
            {CHAIN.map((b, i) => (
              <div key={b.id} style={{ marginBottom: 10 }}>
                <div
                  className={placed.includes(b.id) ? '' : 'fade-up'}
                  draggable={!placed.includes(b.id)}
                  onDragStart={(e) => e.dataTransfer.setData('text/plain', `pool:${i}`)}
                  style={{
                    background: placed.includes(b.id) ? 'var(--bench)' : 'var(--card)',
                    border: '1px solid var(--card-edge)', borderRadius: 10, padding: '10px 14px',
                    cursor: placed.includes(b.id) ? 'default' : 'grab', opacity: placed.includes(b.id) ? 0.4 : 1,
                    fontSize: 14,
                  }}
                >
                  <span style={{ color: 'var(--accent)', fontSize: 11, marginRight: 8 }}>{b.kind}</span>
                  {b.label}
                  <PartInfo partKey={b.id === 'sense' ? 'tempSensor' : b.id === 'act' ? 'motor' : 'mcu'} />
                </div>
              </div>
            ))}

            {/* 链槽：任意顺序放入，对错由 RUN 检验；已放入的可用 ↑↓ 调序 */}
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                const data = e.dataTransfer.getData('text/plain');
                if (!data.startsWith('pool:')) return; // 忽略池内调序拖拽
                const i = Number(data.slice(5));
                if (placed.includes(CHAIN[i].id) || placed.length >= CHAIN.length) return;
                setPlaced((p) => [...p, CHAIN[i].id]);
                track('block_place', 2, { block: CHAIN[i].id, pos: placed.length });
              }}
              style={{
                minHeight: 120, border: `2px dashed ${chainOK ? (orderOK ? 'var(--live)' : 'var(--danger)') : 'var(--card-edge)'}`,
                borderRadius: 12, padding: 10, marginTop: 8,
              }}
            >
              {placed.length === 0 && (
                <div style={{ color: 'var(--ink-dim)', fontSize: 13, textAlign: 'center', paddingTop: 40 }}>
                  把上面的积木拖进来（顺序自己排，RUN 会检验）
                </div>
              )}
              {placed.map((id, i) => (
                <div key={id} className="fade-up" style={{
                  background: 'var(--card)', border: '1px solid var(--live)', borderRadius: 8,
                  padding: '8px 12px', marginBottom: i < placed.length - 1 ? 18 : 0,
                  fontSize: 13.5, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                  <span>{CHAIN.find((b) => b.id === id).label}</span>
                  <span style={{ display: 'flex', gap: 4 }}>
                    <button
                      disabled={i === 0}
                      onClick={() => setPlaced((p) => { const n = [...p]; [n[i - 1], n[i]] = [n[i], n[i - 1]]; return n; })}
                      style={{ border: 'none', background: 'transparent', cursor: i === 0 ? 'default' : 'pointer', opacity: i === 0 ? 0.25 : 0.7, fontSize: 12 }}
                    >↑</button>
                    <button
                      disabled={i === placed.length - 1}
                      onClick={() => setPlaced((p) => { const n = [...p]; [n[i + 1], n[i]] = [n[i], n[i + 1]]; return n; })}
                      style={{ border: 'none', background: 'transparent', cursor: i === placed.length - 1 ? 'default' : 'pointer', opacity: i === placed.length - 1 ? 0.25 : 0.7, fontSize: 12 }}
                    >↓</button>
                    <button
                      onClick={() => { setPlaced((p) => p.filter((x) => x !== id)); track('block_remove', 2, { block: id }); }}
                      style={{ border: 'none', background: 'transparent', cursor: 'pointer', opacity: 0.5, fontSize: 12, marginLeft: 4 }}
                    >✕</button>
                  </span>
                  {i < placed.length - 1 && (
                    <div style={{ position: 'absolute', left: '50%', bottom: -16, color: 'var(--live)' }}>↓</div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* RUN + 阈值 */}
          <div style={{ width: 190, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button
              className="btn btn-primary" style={{ width: '100%' }}
              disabled={!chainOK || !wiredOK}
              onClick={() => {
                if (!orderOK) {
                  // 顺序错：烧录失败，世界不启动
                  track('run_fail', 2, { order: placed.join(',') });
                  setRunError(true);
                  dispatch({ type: 'SAY', text: '烧录失败——程序逻辑不对。想想：不先「感知」温度，怎么判断？不判断，风扇听谁的？调整顺序再来', mood: 'panic' });
                  return;
                }
                setRunError(false);
                setRunning(true);
                track('run_press', 2);
                dispatch({ type: 'SAY', text: '烧录中… ⏳（1秒）把逻辑写进单片机', mood: 'think' });
                setTimeout(() => dispatch({ type: 'SAY', text: '运行中！盯着温度数字，超过 30℃ 会发生什么？', mood: 'happy' }), 1200);
              }}
            >
              {running ? '🟢 运行中' : '▶ RUN（烧录）'}
            </button>
            {running && (
              <button
                className="btn" style={{ width: '100%' }}
                onClick={() => {
                  setRunning(false);
                  setFanOn(false);
                  track('run_stop', 2);
                  dispatch({ type: 'SAY', text: '已停止。单片机断电了，风扇停转——改完线或积木再重新烧录', mood: 'normal' });
                }}
              >
                ⏹ 停止
              </button>
            )}
            {runError && (
              <div style={{ fontSize: 12, color: 'var(--danger)', textAlign: 'center' }}>
                ❌ 顺序不对，烧录失败——用 ↑↓ 调整后再 RUN
              </div>
            )}
            {!wiredOK && (
              <div style={{ fontSize: 12, color: 'var(--danger)', textAlign: 'center' }}>
                接线 {Object.values(PAIRS).filter(([a, b]) => hasWire(a, b)).length}/3 ——
                {(!hasWire(...PAIRS.vout) || !hasWire(...PAIRS.gnd)) && '传感器两根线还没接对'}
                {(!hasWire(...PAIRS.vout) || !hasWire(...PAIRS.gnd)) && !hasWire(...PAIRS.fan) && '，'}
                {!hasWire(...PAIRS.fan) && '风扇线还没接对'}（红虚线点一下拆除）
              </div>
            )}
            {wiredOK && !chainOK && (
              <div style={{ fontSize: 12, color: 'var(--danger)', textAlign: 'center' }}>
                线接好了！再把 {CHAIN.length - placed.length} 块积木拖进虚线框
              </div>
            )}

            {running && chainOK && (
              <div className="fade-up" style={{ fontSize: 13 }}>
                改判断阈值：{threshold}℃
                <input type="range" min={27} max={33} value={threshold} step={1}
                  onChange={(e) => { setThreshold(Number(e.target.value)); track('threshold_adjust', 2, { v: e.target.value }); }}
                  style={{ width: '100%' }} />
              </div>
            )}
          </div>
        </div>

        {/* 通关行 */}
        {done2 && (
          <div className="fade-up" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 15, fontWeight: 700 }}>
              🏅 通关！<span style={{ color: 'var(--accent)' }}>迷你温控风扇</span> 已放上作品架
            </div>
            <button
              className="btn btn-primary"
              onClick={() => { track('goto_next', 2, { to: 3 }); dispatch({ type: 'GOTO', page: 3 }); }}
            >
              下一关 →
            </button>
          </div>
        )}

        {/* 知识点行 */}
        {done2 && (
          <div className="fade-up" style={{ fontSize: 13, color: 'var(--ink-dim)', textAlign: 'center' }}>
            本关认识：<b style={{ color: 'var(--ink)' }}>感知→判断→执行</b> · <b style={{ color: 'var(--ink)' }}>GPIO</b> · <b style={{ color: 'var(--ink)' }}>单片机</b>
          </div>
        )}

        {/* 通关后挑战：调阈值让风扇「智能启停」 */}
        {done2 && !challengeDone && !challengeOn && (
          <div className="fade-up" style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
            border: '1px dashed var(--accent)', borderRadius: 12, padding: '10px 16px',
          }}>
            <div style={{ fontSize: 13.5 }}>
              🎯 <b>完美通关挑战</b>：房间在 27~33℃ 波动，把阈值调到一个让风扇<b>智能启停</b>的温度——既不能一直转（浪费电），也不能一直停（热）。盯紧串口和风扇，找那个刚刚好的值
            </div>
            <button
              className="btn btn-primary" style={{ whiteSpace: 'nowrap' }}
              onClick={() => {
                setChallengeOn(true);
                track('challenge_start', 2);
                dispatch({ type: 'SAY', text: '挑战开始！提示：看串口里 temp= 多少时你希望它转？阈值就设在它附近', mood: 'think' });
              }}
            >
              接受挑战
            </button>
          </div>
        )}
        {done2 && challengeOn && !challengeDone && (
          <div className="fade-up" style={{
            fontSize: 13.5, border: '1px dashed var(--accent)', borderRadius: 12,
            padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
          }}>
            <div>
              🎯 挑战中：让风扇<b style={{ color: 'var(--live)' }}>转一转、停一停</b>，并稳定保持几秒——
              <span style={{ color: 'var(--ink-dim)' }}> 一直转 = 太费电 ✗ · 一直停 = 太热 ✗</span>
            </div>
            <button className="btn" style={{ whiteSpace: 'nowrap' }} onClick={() => setChallengeOn(false)}>
              放弃
            </button>
          </div>
        )}
        {challengeDone && (
          <div className="fade-up" style={{
            fontSize: 14, fontWeight: 700, color: 'var(--live)',
            border: '1px solid var(--live)', borderRadius: 12, padding: '10px 16px', textAlign: 'center',
          }}>
            ✨ 挑战完成！阈值 {threshold}℃ 刚刚好——你已经在做工程师做的事：标定
          </div>
        )}
      </div>

      {/* CodePeek：第一次风扇转起来自动展开；运行中实时串口 */}
      <CodePeek
        code={ARDUINO_CODE}
        serial={serial}
        live
        autoOpen={fanOn && running}
        label="🔍 看看这段逻辑对应的真实代码"
      />
    </div>
  );
}
