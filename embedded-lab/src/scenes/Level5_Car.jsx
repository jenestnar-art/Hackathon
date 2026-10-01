// 第 5 关「遥控小车」：接线 → 指令包飞行动画 → 剧本丢包 ×2 → 重发机制 → 开到旗子通关
// 知识层：无线通信、指令包、丢包/确认重发（ARQ）；执行日志面板首次落地
import { useEffect, useRef, useState } from 'react';
import { useGame } from '../store/GameContext.jsx';
import { track } from '../lib/track.js';
import ProjectCard from '../components/ProjectCard.jsx';
import PartInfo from '../components/PartInfo.jsx';

const DIRS = { up: '↑', down: '↓', left: '←', right: '→' };
const DXY = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const ROT = { up: 0, right: 90, down: 180, left: 270 };   // 车头朝向 → SVG 旋转角
const GOAL = { x: 8, y: 1 };
const START = { x: 1, y: 4 };
// 剧本：这两个序号的包必丢（第 10 个让用户第一次撞见丢包；第 18 个在重发开启后……不丢了，改为电量事件）
const LOSS_AT = [10, 14];

export default function Level5_Car() {
  const { state, dispatch } = useGame();
  const [started, setStarted] = useState(false);
  const [stage, setStage] = useState('wire');          // wire → drive
  const [garbled, setGarbled] = useState(false);
  const [hotPart, setHotPart] = useState(null);

  // ── 接线台状态 ─────────────────────────────
  const [wires, setWires] = useState([]);
  const [drag, setDrag] = useState(null);
  const svgRef = useRef(null);

  // 接收器 → 主控（2 根），主控 → 左/右电机（各 2 根）
  const PAIRS = {
    rx_v: ['rx_v', 'm_5v'],
    rx_g: ['rx_g', 'm_gnd'],
    rx_s: ['rx_s', 'm_d2'],
    ml1: ['ml_a', 'm_d5'], ml2: ['ml_b', 'm_d6'],
    mr1: ['mr_a', 'm_d3'], mr2: ['mr_b', 'm_d4'],
  };
  const allPins = Object.values(PAIRS);
  const hasWire = (a, b) => wires.some((w) => (w.a === a && w.b === b) || (w.a === b && w.b === a));
  const isWrong = (a, b) => !allPins.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
  const pinGroup = (id) => Object.keys(PAIRS).find((g) => PAIRS[g].includes(id));

  const PIN_POS = {
    rx_v: [306, 122], rx_g: [306, 146], rx_s: [306, 170],       // 接收器右缘
    m_5v: [430, 70], m_gnd: [430, 94], m_d2: [430, 118], m_d3: [430, 142],
    m_d4: [430, 166], m_d5: [430, 190], m_d6: [430, 214],       // 主控板左缘
    ml_a: [692, 82], ml_b: [714, 82],                            // 左电机两脚（电机盒上方）
    mr_a: [794, 82], mr_b: [816, 82],                            // 右电机两脚
  };
  const PIN_NAME = {
    rx_v: 'VCC', rx_g: 'GND', rx_s: 'DATA',
    m_5v: '5V', m_gnd: 'GND', m_d2: 'D2', m_d3: 'D3', m_d4: 'D4', m_d5: 'D5', m_d6: 'D6',
    ml_a: '左电+', ml_b: '左电−', mr_a: '右电+', mr_b: '右电−',
  };

  const wiredCount = Object.values(PAIRS).filter(([a, b]) => hasWire(a, b)).length;
  const wiredOK = wiredCount === Object.keys(PAIRS).length;

  // ── 连线交互（与第 4 关同款：点选 + 拖动，最近脚命中）──
  const [sel, setSel] = useState(null);
  const [hover, setHover] = useState(null);
  const pressRef = useRef(null);

  const toSvg = (cx, cy) => {
    const r = svgRef.current.getBoundingClientRect();
    return [(cx - r.left) * 880 / r.width, (cy - r.top) * 250 / r.height];
  };
  const findPinAt = (px, py) => {
    let best = null, bestD = 20;
    for (const id of Object.keys(PIN_POS)) {
      const d = Math.hypot(PIN_POS[id][0] - px, PIN_POS[id][1] - py);
      if (d < bestD) { bestD = d; best = id; }
    }
    return best;
  };

  const tryConnect = (a, b) => {
    if (!b || b === a || hasWire(a, b)) return;
    setWires((w) => [...w, { a, b }]);
    setSel(null);
    if (isWrong(a, b)) {
      track('reject', 5, { reason: 'mismatch', a, b });
      dispatch({ type: 'SAY', text: '接不通——电源找电源（5V/GND），信号找信号（DATA→D2，电机→D3~D6）', mood: 'think' });
    } else {
      track('connect', 5, { wire: pinGroup(a) });
      const MSG = {
        rx_v: '接收器通电',
        rx_g: '接收器接地，回路有了',
        rx_s: 'DATA → D2——接收器收到什么，都从这根线告诉主控',
        ml1: '左电机正极接 D5', ml2: '左电机负极接 D6——左右各一个电机，车才能转向',
        mr1: '右电机正极接 D3', mr2: '右电机负极接 D4——两个轮子转速不同，车就拐弯',
      };
      dispatch({ type: 'SAY', text: MSG[pinGroup(a)], mood: 'happy' });
    }
  };

  const pinDown = (id) => (e) => {
    const g = pinGroup(id);
    if (g && PAIRS[g] && hasWire(...PAIRS[g])) return;
    e.preventDefault();
    e.stopPropagation();
    const [sx, sy] = toSvg(e.clientX, e.clientY);
    pressRef.current = { id, sx, sy, moved: false };
    setDrag({ from: id, x: sx, y: sy });
    const move = (ev) => {
      const [x, y] = toSvg(ev.clientX, ev.clientY);
      if (pressRef.current && Math.hypot(x - pressRef.current.sx, y - pressRef.current.sy) > 5) {
        pressRef.current.moved = true;
      }
      setDrag({ from: id, x, y });
    };
    const up = (ev) => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      setDrag(null);
      const wasClick = !pressRef.current?.moved;
      pressRef.current = null;
      const [px, py] = toSvg(ev.clientX, ev.clientY);
      const to = findPinAt(px, py);
      if (wasClick) {
        if (sel === id) setSel(null);
        else if (sel) tryConnect(sel, id);
        else setSel(id);
      } else if (to) {
        tryConnect(id, to);
        setSel(null);
      }
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const wirePath = (a, b) => {
    const [x1, y1] = PIN_POS[a], [x2, y2] = PIN_POS[b];
    const mx = (x1 + x2) / 2;
    return `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`;
  };
  const removeWire = (i) => setWires((w) => w.filter((_, j) => j !== i));

  const Pin = ({ id, label, dx = 0, dy = 0 }) => {
    const [x, y] = PIN_POS[id];
    const g = pinGroup(id);
    const wired = g && PAIRS[g] && hasWire(...PAIRS[g]);
    const active = drag?.from === id;
    const selected = sel === id;
    const isRx = x < 400;          // 接收器脚：板在左，标签朝右
    const isMotor = y < 100;       // 电机脚：标签放脚上方
    return (
      <g onPointerDown={pinDown(id)}
        onPointerEnter={() => sel && !wired && setHover(id)}
        onPointerLeave={() => setHover((h) => (h === id ? null : h))}
        style={{ cursor: wired ? 'default' : 'grab' }}>
        {selected && <circle cx={x} cy={y} r="12" fill="none" stroke="var(--accent)" strokeWidth="2" strokeDasharray="4 3" />}
        <circle cx={x} cy={y} r="7"
          fill={wired ? 'var(--live)' : active || selected ? 'var(--accent)' : 'var(--card)'}
          stroke={wired ? 'var(--live)' : active || selected ? 'var(--accent)' : 'var(--card-edge)'} strokeWidth="1.5"
          style={{ transition: 'fill 120ms var(--ease-out)' }} />
        {label && !isMotor && (
          <text x={x + (isRx ? 16 : -16) + dx} y={y + 4 + dy}
            textAnchor={isRx ? 'start' : 'end'} fontSize="9.5" fontFamily="Consolas, monospace" fill="var(--ink-dim)">{label}</text>
        )}
        {label && isMotor && (
          <text x={x} y={y - 14 + dy} textAnchor="middle" fontSize="9.5" fontFamily="Consolas, monospace" fill="var(--ink-dim)">{label}</text>
        )}
      </g>
    );
  };

  // ── 行车阶段状态 ───────────────────────────
  const [pos, setPos] = useState(START);
  const [heading, setHeading] = useState('up');        // 车头朝向（控制 SVG 小车旋转）
  const [packets, setPackets] = useState([]);          // {id, dir, lost, arriveAt}
  const [sentCount, setSentCount] = useState(0);
  const [retryOn, setRetryOn] = useState(false);
  const [battery, setBattery] = useState(100);         // 电量 %
  const [log, setLog] = useState([]);                  // 执行日志
  const [quizOpen, setQuizOpen] = useState(false);
  const [quizPick, setQuizPick] = useState(null);
  const [reactionAt, setReactionAt] = useState(null);  // 丢包时刻（测反应）
  const idRef = useRef(0);
  const posRef = useRef(pos);
  posRef.current = pos;

  const addLog = (line) => setLog((l) => [...l.slice(-5), line]);

  // ── 烧录 ───────────────────────────────────
  const burn = () => {
    setStage('drive');
    dispatch({ type: 'SAY', text: '烧录完成！用方向键发指令包，把车开到 🏁——注意看日志，每条指令都被"收到"才执行', mood: 'think' });
  };

  // ── 发送指令包 ─────────────────────────────
  const send = (dir) => {
    if (battery <= 0) return;
    const id = ++idRef.current;
    const n = sentCount + 1;
    setSentCount(n);
    const willLose = !retryOn && LOSS_AT.includes(n);
    track('cmd_sent', 5, { dir, n });
    setPackets((p) => [...p, { id, dir, lost: willLose }]);
    addLog(`↑ 发送 [${DIRS[dir]}] 包 #${n}`);

    // 包飞行 300ms 后到达（或丢失）
    setTimeout(() => {
      setPackets((p) => p.filter((pk) => pk.id !== id));
      if (willLose) {
        addLog(`✗ 包 #${n} 在空中丢了……车没收到`);
        setReactionAt(Date.now());
        track('packet_loss', 5, { n, dir });
        dispatch({ type: 'SAY', text: '车没动？这个指令包在半路丢了——WiFi、蓝牙都会这样，通信没有百分之百', mood: 'panic' });
      } else {
        addLog(`✓ 收到 [${DIRS[dir]}] → 电机执行 → 车移动`);
        setBattery((b) => Math.max(0, b - 2));
        move(dir);
      }
    }, 300);
  };

  const move = (dir) => {
    setHeading(dir);
    setPos((v) => {
      const [dx, dy] = DXY[dir];
      return { x: Math.max(0, Math.min(9, v.x + dx)), y: Math.max(0, Math.min(5, v.y + dy)) };
    });
  };

  // 电量低于 30%：一次支线事件
  useEffect(() => {
    if (battery === 28 && !state.done[5]) {
      dispatch({ type: 'SAY', text: '日志显示电量 28% 了——嵌入式设备天天算这笔账：算力、内存、电，都是有限的资源 🔋', mood: 'think' });
    }
  }, [battery]);

  // 通关判定：到旗子 → 弹通关一问（已通关也弹，做庆祝反馈）
  useEffect(() => {
    if (pos.x === GOAL.x && pos.y === GOAL.y && stage === 'drive' && !quizOpen) {
      setQuizOpen(true);
    }
  }, [pos, stage]);

  const finish = () => {
    track('level_complete', 5);
    track('quiz_answer', 5, { correct: true });
    dispatch({ type: 'COMPLETE_LEVEL', level: 5, device: '遥控小车', badge: '通信兵' });
    dispatch({ type: 'SAY', text: '车到位！WiFi、蓝牙、无人机遥控——通信就是机器之间互传指令，丢了就重发 📶', mood: 'cheer' });
    setQuizOpen(false);
  };

  // ── 元件悬浮提示 ───────────────────────────
  const PART_INFO = {
    remote: { name: '遥控器', tip: '指令的起点——你按的每个键都被打包成一条指令' },
    rx: { name: '无线接收器', tip: '收无线信号，转成电信号喂给主控——天线越大收得越稳' },
    mcu: { name: '主控板 STM32', tip: '解码指令包，决定哪个电机转、往哪转' },
    car: { name: '小车（双电机）', tip: '左右轮各一个电机——两边转速不同就能拐弯' },
  };
  const hotGlow = (key) => hotPart === key
    ? { filter: 'drop-shadow(0 0 6px var(--accent))', cursor: 'pointer' }
    : { transition: 'filter 150ms var(--ease-out)', cursor: 'pointer' };
  const partTip = hotPart && PART_INFO[hotPart];

  if (!started) {
    return (
      <ProjectCard
        level={5} title="遥控小车" icon="🚙" difficulty={3} minutes={4}
        parts={[
          { icon: '📱', name: '遥控器', count: 1 },
          { icon: '📶', name: '接收器', count: 1 },
          { key: 'mcu', icon: '🧠', name: '主控板', count: 1 },
          { key: 'motor', icon: '⚙️', name: '电机', count: 2 },
        ]}
        goal="接好接收器和双电机，用方向键发指令包把车开到 🏁。路上指令包可能会丢——工程师的解法等你亲手解锁。"
        onStart={() => { setStarted(true); track('level_start', 5); }}
      />
    );
  }

  // ── 接线台视图 ─────────────────────────────
  const wiringView = (
    <div className="fade-up" style={{ width: '100%' }}>
      <div style={{ fontSize: 14, color: 'var(--ink-dim)', marginBottom: 8 }}>
        把接收器和两个电机接到主控板——注意左右电机各占两个脚：
      </div>
      <svg ref={svgRef} width={880} height={250} viewBox="0 0 880 250" className="bench-grid fade-up" style={{
        maxWidth: '100%', background: 'var(--bench)', borderRadius: 14,
        border: '1px solid var(--card-edge)', touchAction: 'none', userSelect: 'none',
      }}>
        {/* 遥控器（左上：手柄 + 方向键 + 天线） */}
        <g onMouseEnter={() => setHotPart('remote')} onMouseLeave={() => setHotPart((h) => (h === 'remote' ? null : h))} style={hotGlow('remote')}>
          <rect x="40" y="70" width="100" height="150" rx="16" fill="var(--card)" stroke="var(--card-edge)" strokeWidth="2" />
          <rect x="52" y="82" width="76" height="26" rx="6" fill="var(--bench)" stroke="var(--card-edge)" strokeWidth="1" />
          <text x="90" y="99" textAnchor="middle" fontSize="9" fill="var(--ink-dim)" fontFamily="Consolas, monospace">CH·2.4G</text>
          {[[90, 138, 'up'], [62, 172, 'left'], [90, 172, 'down'], [118, 172, 'right']].map(([cx, cy, d]) => (
            <g key={d}>
              <circle cx={cx} cy={cy} r="13" fill="var(--bench)" stroke="var(--card-edge)" strokeWidth="1.5" />
              <text x={cx} y={cy + 5} textAnchor="middle" fontSize="13" fill="var(--ink)" fontWeight="700">{DIRS[d]}</text>
            </g>
          ))}
          <rect x="140" y="78" width="4" height="44" rx="2" fill="#8a929c" transform="rotate(26 140 78)" />
          <text x="90" y="208" textAnchor="middle" fontSize="10" fill="var(--ink-dim)">遥控器</text>
        </g>
        {/* 无线涟漪：遥控器 → 接收器（虚线弧，非实体线） */}
        {[[0], [1]].map(([, i]) => (
          <path key={i} d={`M 172 ${108 + i * 18} Q 205 ${96 + i * 18}, 212 ${118 + i * 18}`}
            fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeDasharray="3 4" opacity={0.5 - i * 0.2} />
        ))}
        {/* 接收器（蓝板 + 天线，Wokwi 风格） */}
        <g onMouseEnter={() => setHotPart('rx')} onMouseLeave={() => setHotPart((h) => (h === 'rx' ? null : h))} style={hotGlow('rx')}>
          <rect x="212" y="96" width="94" height="100" rx="8" fill="#1a2b4a" stroke="#0f1c33" strokeWidth="2" />
          <rect x="196" y="84" width="4" height="38" rx="2" fill="#8a929c" transform="rotate(-28 196 84)" />
          <text x="259" y="118" textAnchor="middle" fontSize="11" fill="#cfe3f5" fontFamily="Consolas, monospace">RX-2.4G</text>
          <text x="259" y="132" textAnchor="middle" fontSize="8.5" fill="#8ca6cc">无线接收器</text>
          <circle cx="232" cy="158" r="3.5" fill="var(--live)">
            <animate attributeName="opacity" values="1;0.2;1" dur="1.2s" repeatCount="indefinite" />
          </circle>
          <text x="259" y="162" textAnchor="middle" fontSize="7.5" fill="#6c88b0" fontFamily="Consolas, monospace">LINK</text>
        </g>
        <Pin id="rx_v" label="VCC" dx={2} /><Pin id="rx_g" label="GND" dx={2} /><Pin id="rx_s" label="DATA" dx={2} />
        {/* 主控板（Wokwi 风格：蓝板 + 黑芯片 + 上下引脚排） */}
        <g onMouseEnter={() => setHotPart('mcu')} onMouseLeave={() => setHotPart((h) => (h === 'mcu' ? null : h))} style={hotGlow('mcu')}>
          <rect x="430" y="50" width="170" height="190" rx="10" fill="#1f6feb" opacity="0.14" stroke="#3b82d6" strokeWidth="2" />
          {/* USB 口（顶部） */}
          <rect x="488" y="40" width="54" height="16" rx="3" fill="#8b95a1" stroke="#6a7480" strokeWidth="1" />
          <rect x="493" y="43" width="44" height="8" rx="2" fill="#5c6670" />
          {/* 芯片 */}
          <rect x="486" y="112" width="90" height="70" rx="6" fill="#2d333b" stroke="#555" strokeWidth="1.5" />
          {/* 芯片两侧引脚（小凸起） */}
          {[0, 1, 2, 3, 4].map((i) => (
            <rect key={i} x={492 + i * 18} y="104" width="5" height="9" fill="#8a929c" />
          ))}
          {[0, 1, 2, 3, 4].map((i) => (
            <rect key={i} x={492 + i * 18} y="180" width="5" height="9" fill="#8a929c" />
          ))}
          <text x="531" y="142" textAnchor="middle" fill="#c9d1d9" fontSize="12" fontFamily="Consolas, monospace" fontWeight="700">STM32</text>
          <text x="531" y="157" textAnchor="middle" fill="#8a929c" fontSize="8.5" fontFamily="Consolas, monospace">F103C8T6</text>
          {/* 晶振小件 */}
          <rect x="498" y="196" width="20" height="9" rx="2" fill="#8a929c" opacity="0.7" />
          <text x="515" y="228" textAnchor="middle" fill="var(--ink-dim)" fontSize="11">主控板</text>
        </g>
        <Pin id="m_5v" label="5V" dx={-2} /><Pin id="m_gnd" label="GND" dx={-2} />
        <Pin id="m_d2" label="D2" dx={-2} /><Pin id="m_d3" label="D3" dx={-2} />
        <Pin id="m_d4" label="D4" dx={-2} /><Pin id="m_d5" label="D5" dx={-2} />
        <Pin id="m_d6" label="D6" dx={-2} />
        {/* 小车底盘 + 双电机（Wokwi 风格：底盘板 + 轮子 + 两个电机盒） */}
        <g onMouseEnter={() => setHotPart('car')} onMouseLeave={() => setHotPart((h) => (h === 'car' ? null : h))} style={hotGlow('car')}>
          {/* 底盘板 */}
          <rect x="676" y="86" width="160" height="120" rx="10" fill="#2d3a4a" stroke="#1d2733" strokeWidth="2" />
          {/* 万向轮（上下中） */}
          <circle cx="756" cy="92" r="7" fill="#22262e" />
          <circle cx="756" cy="200" r="7" fill="#22262e" />
          {/* 左右驱动轮（大圆，黄色轮毂风） */}
          <circle cx="676" cy="146" r="22" fill="#1d222b" stroke="#0f1319" strokeWidth="2" />
          <circle cx="676" cy="146" r="9" fill="#e6b83c" />
          <circle cx="836" cy="146" r="22" fill="#1d222b" stroke="#0f1319" strokeWidth="2" />
          <circle cx="836" cy="146" r="9" fill="#e6b83c" />
          {/* 两个电机盒（驱动轮上方） */}
          <rect x="688" y="98" width="34" height="22" rx="4" fill="#3a4656" stroke="#27303d" strokeWidth="1.5" />
          <text x="705" y="113" textAnchor="middle" fontSize="7.5" fill="#cfe3f5" fontFamily="Consolas, monospace">M-L</text>
          <rect x="790" y="98" width="34" height="22" rx="4" fill="#3a4656" stroke="#27303d" strokeWidth="1.5" />
          <text x="807" y="113" textAnchor="middle" fontSize="7.5" fill="#cfe3f5" fontFamily="Consolas, monospace">M-R</text>
          {/* 车名 */}
          <text x="756" y="172" textAnchor="middle" fontSize="10" fill="#cfe3f5">遥控车</text>
        </g>
        <Pin id="ml_a" label="左电+" /><Pin id="ml_b" label="左电−" />
        <Pin id="mr_a" label="右电+" /><Pin id="mr_b" label="右电−" />
        {/* 导线 */}
        {wires.map((w, i) => {
          const wrong = isWrong(w.a, w.b);
          const color = wrong ? 'var(--danger)' : 'var(--live)';
          return (
            <g key={i} onClick={() => removeWire(i)} style={{ cursor: 'pointer' }}>
              <path d={wirePath(w.a, w.b)} stroke="var(--bg)" strokeWidth="7" fill="none" opacity="0.5" />
              <path d={wirePath(w.a, w.b)} stroke={color} strokeWidth="4" fill="none"
                strokeDasharray={wrong ? '6 4' : undefined} opacity="0.9" />
              {wrong && (
                <text x={(PIN_POS[w.a][0] + PIN_POS[w.b][0]) / 2} y={(PIN_POS[w.a][1] + PIN_POS[w.b][1]) / 2 - 8}
                  textAnchor="middle" fontSize="12">⚠️</text>
              )}
            </g>
          );
        })}
        {drag && (
          <line x1={PIN_POS[drag.from][0]} y1={PIN_POS[drag.from][1]} x2={drag.x} y2={drag.y}
            stroke="var(--accent)" strokeWidth="3" strokeDasharray="5 4" opacity="0.7" />
        )}
        {!drag && sel && hover && hover !== sel && (
          <line x1={PIN_POS[sel][0]} y1={PIN_POS[sel][1]} x2={PIN_POS[hover][0]} y2={PIN_POS[hover][1]}
            stroke="var(--accent)" strokeWidth="3" strokeDasharray="5 4" opacity="0.5" />
        )}
        {sel && !drag && (
          <text x="380" y="266" textAnchor="middle" fontSize="12" fill="var(--accent)">
            已选中 {PIN_NAME[sel] || sel}——再点目标引脚完成连线，再点它取消
          </text>
        )}
        {partTip && (
          <g>
            <rect x="380" y="6" width={partTip.name.length * 13 + partTip.tip.length * 11 + 40} height="22" rx="6"
              fill="var(--card)" stroke="var(--accent)" strokeWidth="1" opacity="0.95" />
            <text x="396" y="21" fontSize="11" fill="var(--ink)">
              <tspan fontWeight="700" fill="var(--accent)">{partTip.name}</tspan>
              <tspan fill="var(--ink-dim)" fontSize="10">  {partTip.tip}</tspan>
            </text>
          </g>
        )}
      </svg>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 12 }}>
        <span style={{ fontSize: 13, color: wiredOK ? 'var(--live)' : 'var(--ink-dim)' }}>
          {wiredOK ? '✓ 已接 7/7' : `已接 ${wiredCount}/7`}
        </span>
        <span style={{ fontSize: 12, color: 'var(--ink-dim)' }}>（点引脚 A 再点引脚 B 连线；红线点一下可拆掉）</span>
        {!wiredOK && wiredCount >= 4 && (
          <span style={{ fontSize: 12, color: 'var(--accent)' }}>
            还差：{Object.entries(PAIRS).filter(([g, [a, b]]) => !hasWire(a, b)).map(([, [a]]) => PIN_NAME[a]).join('、')}
          </span>
        )}
        <button className="btn btn-primary" disabled={!wiredOK} onClick={burn}
          title={wiredOK ? '' : '还有线没接完，接满 7 根才能烧录'}>▶ 烧录</button>
      </div>
    </div>
  );

  // ── 行车视图 ───────────────────────────────
  const driveView = (
    <div className="fade-up" style={{ display: 'flex', gap: 24, alignItems: 'flex-start', width: 760, maxWidth: '100%' }}>
      {/* 左：遥控器 + 日志 */}
      <div style={{ width: 320 }}>
        <div style={{
          background: 'var(--card)', border: '1px solid var(--card-edge)', borderRadius: 14,
          padding: '14px 16px', textAlign: 'center',
        }}>
          <div style={{ fontSize: 12, color: 'var(--ink-dim)', marginBottom: 10 }}>
            遥控器（每次点击 = 发一个指令包）
          </div>
          {[['up'], ['left', 'down', 'right']].map((row, ri) => (
            <div key={ri} style={{ display: 'flex', gap: 6, justifyContent: 'center', marginBottom: 6 }}>
              {row.map((d) => (
                <button key={d} className="btn btn-primary" style={{ width: 52, fontSize: 20, padding: '9px 0' }}
                  onClick={() => send(d)} disabled={battery <= 0}>
                  {DIRS[d]}
                </button>
              ))}
            </div>
          ))}
          {/* 空中的指令包 */}
          <div style={{ height: 34, position: 'relative', marginTop: 4 }}>
            {packets.map((p) => (
              <span key={p.id} style={{
                position: 'absolute', left: '30%', top: 2, fontSize: 16,
                animation: 'flyRight 300ms linear both', opacity: p.lost ? 0.35 : 1,
              }}>
                📦{DIRS[p.dir]}
              </span>
            ))}
          </div>
          <style>{`@keyframes flyRight { from { transform: translateX(0); opacity: 1 } to { transform: translateX(140px); opacity: .2 } }`}</style>
          {/* 电量表 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
            <span style={{ fontSize: 11, color: 'var(--ink-dim)' }}>🔋</span>
            <div style={{ flex: 1, height: 8, borderRadius: 4, background: 'var(--bg)', overflow: 'hidden' }}>
              <div style={{
                width: `${battery}%`, height: '100%', borderRadius: 4,
                background: battery > 30 ? 'var(--live)' : 'var(--danger)', transition: 'width 300ms',
              }} />
            </div>
            <span style={{ fontSize: 11, color: battery > 30 ? 'var(--ink-dim)' : 'var(--danger)' }}>{battery}%</span>
          </div>
          {/* 加装重发积木 */}
          {!retryOn && sentCount >= 10 && (
            <button className="btn" style={{ width: '100%', marginTop: 10, borderColor: 'var(--accent)', color: 'var(--accent)', fontSize: 13 }}
              onClick={() => {
                setRetryOn(true);
                addLog('🧩 已加装「重发」积木');
                track('retry_toggle', 5);
              }}>
              🧩 加装「重发」积木
            </button>
          )}
          {retryOn && (
            <div style={{ fontSize: 11.5, color: 'var(--live)', marginTop: 8 }}>✓ 重发机制运行中——丢的包会自动补发</div>
          )}
        </div>

        {/* 执行日志面板（嵌入式知识层：机器收到指令→解码→执行） */}
        <div style={{
          marginTop: 12, background: '#0a0e14', borderRadius: 10, border: '1px solid var(--card-edge)',
          padding: '10px 12px', fontFamily: 'ui-monospace, Consolas, monospace', fontSize: 11.5, lineHeight: 1.9,
          minHeight: 150,
        }}>
          <div style={{ color: '#3a4656', fontSize: 10.5, marginBottom: 4 }}>小车接收日志 · 每 300ms 一条</div>
          {log.map((l, i) => (
            <div key={i} style={{
              color: l.startsWith('✓') ? '#4ade80' : l.startsWith('✗') ? '#f87171' : l.startsWith('🧩') ? '#ffc857' : '#8a929c',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>{l}</div>
          ))}
        </div>
      </div>

      {/* 右：房间网格（俯视房间，Wokwi 风格 SVG 小车） */}
      <div style={{
        background: 'var(--bench)', padding: 12, borderRadius: 14, border: '1px solid var(--card-edge)',
      }}>
        <svg width="418" height="258" viewBox="0 0 418 258" style={{ display: 'block' }}>
          {/* 地板格 */}
          {Array.from({ length: 60 }).map((_, i) => {
            const x = i % 10, y = Math.floor(i / 10);
            const isGoal = GOAL.x === x && GOAL.y === y;
            return (
              <rect key={i} x={x * 41 + 2} y={y * 41 + 2} width="37" height="37" rx="6"
                fill="var(--bg)" stroke={isGoal ? 'var(--accent)' : 'var(--card-edge)'}
                strokeWidth={isGoal ? 1.6 : 1} strokeDasharray={isGoal ? '4 3' : undefined} />
            );
          })}
          {/* 终点旗 */}
          <g transform={`translate(${GOAL.x * 41 + 20.5}, ${GOAL.y * 41 + 20.5})`}>
            <line x1="-3" y1="12" x2="-3" y2="-11" stroke="var(--ink-dim)" strokeWidth="2" />
            <path d="M -3 -11 L 10 -6.5 L -3 -2 Z" fill="var(--accent)" />
          </g>
          {/* 小车（俯视 SVG，随朝向旋转） */}
          <g transform={`translate(${pos.x * 41 + 20.5}, ${pos.y * 41 + 20.5})`}
            style={{
              transition: 'transform 300ms cubic-bezier(.22,1,.36,1)',
              transform: `translate(${pos.x * 41 + 20.5}px, ${pos.y * 41 + 20.5}px) rotate(${ROT[heading]}deg)`,
            }}>
            <g transform="translate(-20.5, -20.5)">
              {/* 车轮（四个，深色） */}
              <rect x="3" y="6" width="7" height="10" rx="2" fill="#22262e" />
              <rect x="24" y="6" width="7" height="10" rx="2" fill="#22262e" />
              <rect x="3" y="25" width="7" height="10" rx="2" fill="#22262e" />
              <rect x="24" y="25" width="7" height="10" rx="2" fill="#22262e" />
              {/* 底盘 */}
              <rect x="4" y="5" width="26" height="31" rx="5" fill="#2d3a4a" stroke="#1d2733" strokeWidth="1.5" />
              {/* 顶部传感器圆（雷达风） */}
              <circle cx="17" cy="20" r="5.5" fill="#1d222b" stroke="#e6b83c" strokeWidth="1.5" />
              <circle cx="17" cy="20" r="1.8" fill="#e6b83c" />
              {/* 前灯（车头方向） */}
              <circle cx="10" cy="6.5" r="1.8" fill="#ffe9a8" />
              <circle cx="24" cy="6.5" r="1.8" fill="#ffe9a8" />
            </g>
          </g>
        </svg>
      </div>
    </div>
  );

  // ── 通关一问 ───────────────────────────────
  const quizView = quizOpen && (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 100,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: 'var(--card)', border: '1px solid var(--accent)', borderRadius: 16,
        padding: '28px 32px', maxWidth: 420, boxShadow: 'var(--shadow)',
      }}>
        <div style={{ fontWeight: 800, fontSize: 17, marginBottom: 14 }}>
          🏁 车到位了！最后一问：
        </div>
        <div style={{ fontSize: 14.5, marginBottom: 16, lineHeight: 1.7 }}>
          指令包在半路丢了，遥控就不灵了。真实工程师的解法是？
        </div>
        {[
          { t: 'A．换一根更粗更好的线', ok: false },
          { t: 'B．收到包回一句"收到了"，没回就重发（确认 + 重发）', ok: true },
          { t: 'C．多按几次总会好的，不加机制', ok: false },
        ].map((o) => (
          <button key={o.t} className="btn" style={{
            display: 'block', width: '100%', textAlign: 'left', marginBottom: 10, fontSize: 13.5,
            borderColor: quizPick === o.t ? (o.ok ? 'var(--live)' : 'var(--danger)') : undefined,
            color: quizPick === o.t ? (o.ok ? 'var(--live)' : 'var(--danger)') : undefined,
          }}
            onClick={() => {
              setQuizPick(o.t);
              if (o.ok) setTimeout(finish, 650);
              else {
                track('quiz_wrong', 5);
                dispatch({ type: 'SAY', text: o.t.startsWith('A') ? '无线的，没有线可换——想想收快递：没收到会怎样？' : '碰运气可不行——快递没送到会怎么样？', mood: 'think' });
              }
            }}>
            {o.t}
          </button>
        ))}
        {quizPick && !quizPick.startsWith('B') && (
          <div style={{ fontSize: 12, color: 'var(--ink-dim)' }}>再想想——快递没送到会怎么样？</div>
        )}
      </div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'flex-start', width: '100%', maxWidth: 860, margin: '0 auto' }}>
      {wiringView}
      {stage === 'drive' && driveView}
      <div style={{ fontSize: 13, color: 'var(--ink-dim)' }}>
        知识点：通信 · 指令包 · 丢包与重发
        <PartInfo partKey="motor" /><PartInfo partKey="mcu" />
      </div>
      {quizView}
    </div>
  );
}
