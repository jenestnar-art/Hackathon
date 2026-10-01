// 第 4 关「电子时钟」：接线（I2C 总线）→ 填空式中文积木 → OLED 像素屏走真实系统时间
import { useEffect, useRef, useState } from 'react';
import { useGame } from '../store/GameContext.jsx';
import { track } from '../lib/track.js';
import ProjectCard from '../components/ProjectCard.jsx';
import PartInfo from '../components/PartInfo.jsx';

const LINES = [
  { id: 'tick', prompt: '每 1 秒 ▢', options: ['秒数 + 1', '灯泡点亮', '电机全速转'], answer: 0 },
  { id: 'show', prompt: '屏幕显示 ▢', options: ['随机噪音', '时 : 分 : 秒', '温度曲线'], answer: 1 },
];

export default function Level4_Clock() {
  const { state, dispatch } = useGame();
  const [started, setStarted] = useState(false);
  const [stage, setStage] = useState('wire');   // wire → code
  const [garbled, setGarbled] = useState(false);   // SDA/SCL 接反 → 烧录后乱码
  const [fills, setFills] = useState({});
  const [confirmed, setConfirmed] = useState(false);   // 选完两行点「确认运行」才生效
  const [sec, setSec] = useState(0);
  const [holding, setHolding] = useState(false);
  const [hotPart, setHotPart] = useState(null);   // 悬浮高亮的元件

  // ── 接线台状态 ─────────────────────────────
  const [wires, setWires] = useState([]);
  const [drag, setDrag] = useState(null);
  const svgRef = useRef(null);

  // OLED 四脚 + 两个按键 → 主控板。SDA/SCL 允许插反（SWAP），烧录时才会暴露
  const PAIRS = {
    vcc: ['o_vcc', 'm_5v'],
    gnd: ['o_gnd', 'm_gnd'],
    sda: ['o_sda', 'm_d4'],
    scl: ['o_scl', 'm_d3'],
    k1: ['k1_sig', 'm_d2'],
    k2: ['k2_sig', 'm_d7'],
    // 可选件：接不接都行——不接时程序照样跑，只是"命令落空"
    led: ['led_a', 'm_d5'],
    led_gnd: ['led_k', 'm_gnd'],
    motor: ['motor_in', 'm_d6'],
    motor_gnd: ['motor_g', 'm_gnd'],
  };
  const OPTIONAL = ['led', 'led_gnd', 'motor', 'motor_gnd'];
  const SWAP = { sda: ['o_sda', 'm_d3'], scl: ['o_scl', 'm_d4'] };
  const allPins = [...Object.values(PAIRS), ...Object.values(SWAP)];
  const hasWire = (a, b) => wires.some((w) => (w.a === a && w.b === b) || (w.a === b && w.b === a));
  const isSwap = (a, b) => allPins.some(([x, y]) => (x === a && y === b) || (x === b && y === a)) &&
    !Object.values(PAIRS).some(([x, y]) => (x === a && y === b) || (x === b && y === a));
  const isWrong = (a, b) => !allPins.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
  const pinGroup = (id) => Object.keys(PAIRS).find((g) => PAIRS[g].includes(id)) ||
    Object.keys(SWAP).find((g) => SWAP[g].includes(id));

  const PIN_POS = {
    o_vcc: [178, 58], o_gnd: [178, 82], o_sda: [178, 106], o_scl: [178, 130],
    m_5v: [412, 52], m_gnd: [412, 76], m_d3: [412, 100], m_d4: [412, 124], m_d2: [412, 148], m_d7: [412, 172], m_d5: [412, 196], m_d6: [412, 220],
    k1_sig: [262, 248], k2_sig: [330, 248],
    led_a: [560, 252], led_k: [610, 252],
    motor_in: [686, 252], motor_g: [736, 252],
  };

  const PIN_NAME = {
    o_vcc: 'VCC', o_gnd: 'GND', o_sda: 'SDA', o_scl: 'SCL',
    m_5v: '5V', m_gnd: 'GND', m_d3: 'D3', m_d4: 'D4', m_d2: 'D2', m_d7: 'D7', m_d5: 'D5', m_d6: 'D6',
    k1_sig: 'K1', k2_sig: 'K2',
    led_a: 'LED+', led_k: 'LED−', motor_in: '电机IN', motor_g: '电机GND',
  };

  const swapBad = hasWire('o_sda', 'm_d3') || hasWire('o_scl', 'm_d4');
  const requiredPairs = Object.entries(PAIRS).filter(([k]) => !OPTIONAL.includes(k));
  const wiredOK = requiredPairs.every(([, [a, b]]) => hasWire(a, b));
  const wiredCount = requiredPairs.filter(([, [a, b]]) => hasWire(a, b)).length;
  const ledConnected = hasWire(...PAIRS.led) && hasWire(...PAIRS.led_gnd);
  const motorConnected = hasWire(...PAIRS.motor) && hasWire(...PAIRS.motor_gnd);

  // ── 连线交互：点引脚 A 再点引脚 B（Wokwi 式），也支持按住拖动 ──
  const toSvg = (cx, cy) => {
    const r = svgRef.current.getBoundingClientRect();
    return [(cx - r.left) * 760 / r.width, (cy - r.top) * 310 / r.height];
  };
  const findPinAt = (px, py) => {
    let best = null, bestD = 20;
    for (const id of Object.keys(PIN_POS)) {
      const d = Math.hypot(PIN_POS[id][0] - px, PIN_POS[id][1] - py);
      if (d < bestD) { bestD = d; best = id; }   // 取最近的，而不是第一个命中的
    }
    return best;
  };

  const tryConnect = (a, b) => {
    if (!b || b === a || hasWire(a, b)) return;
    setWires((w) => [...w, { a, b }]);
    setSel(null);
    if (isWrong(a, b)) {
      track('reject', 4, { reason: 'mismatch', a, b });
      dispatch({ type: 'SAY', text: '咦，这样接不通。看引脚名：电源找电源（5V/GND），信号找信号（D2/D3/D4/D7）', mood: 'think' });
    } else if (isSwap(a, b)) {
      track('i2c_swap', 4, { a, b });
      dispatch({ type: 'SAY', text: '插是插进去了……不过 SDA 和 SCL 长得像，最容易插反。先记着，等下烧录见分晓', mood: 'think' });
    } else {
      track('connect', 4, { wire: pinGroup(a) });
      const MSG = {
        vcc: 'VCC 接上 5V——屏幕通电',
        gnd: 'GND 接好——回路有了',
        sda: 'SDA → D4——数据线，屏幕说的话从这走',
        scl: 'SCL → D3——时钟线，规定"什么时候说话"',
        k1: '按键 1 接到 D2！',
        k2: '按键 2 接到 D7！',
        led: 'LED 正极接到 D5——这是可选件，接上它程序里的「灯泡点亮」才有东西可点',
        led_gnd: 'LED 负极接 GND——回路补全，灯具备发光条件',
        motor: '电机 IN 接到 D6——同样可选，接上后「电机全速转」才能转起来',
        motor_gnd: '电机 GND 接好——电机就位',
      };
      dispatch({ type: 'SAY', text: MSG[pinGroup(a)], mood: 'happy' });
      if (pinGroup(a) === 'sda' || pinGroup(a) === 'scl') {
        dispatch({ type: 'SAY', text: 'SDA + SCL 这两根就是 I2C 总线——只占两个脚，屏幕就能跟主控聊天', mood: 'happy' });
      }
    }
  };

  const [sel, setSel] = useState(null);   // 点选模式：已选中的起点引脚
  const [hover, setHover] = useState(null); // 点选模式下鼠标位置（画预览线）
  const pressRef = useRef(null);

  const pinDown = (id) => (e) => {
    const g = pinGroup(id);
    if (g && PAIRS[g] && hasWire(...PAIRS[g])) return;   // 正确线已接，不重复
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
        // 点按：进入/完成点选连线
        if (sel === id) setSel(null);            // 再点同一个 = 取消
        else if (sel) tryConnect(sel, id);       // 已有选中 → 连线
        else setSel(id);                          // 选中起点
      } else if (to) {
        tryConnect(id, to);                       // 拖到目标脚上松手
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

  // ── 烧录：抓住 SDA/SCL 插反 ─────────────────
  const burn = () => {
    if (swapBad) {
      setGarbled(true);
      track('burn_fail', 4, { reason: 'i2c_swap' });
      dispatch({ type: 'SAY', text: '屏幕全是乱码？八成是 SDA 和 SCL 插反了——点红色虚线拆掉那两根，对调重接', mood: 'panic' });
      return;
    }
    setGarbled(false);
    setStage('code');
    setSec(0);
    dispatch({ type: 'SAY', text: '烧录完成！把下面程序补完整，屏幕就活过来了', mood: 'think' });
  };

  // ── 时钟：真实系统时间，每秒刷新 ─────────────
  const [now, setNow] = useState(() => new Date());
  const codeOK = confirmed && LINES.every((l) => fills[l.id] === l.answer);
  // 程序跑起来 = 显示行选对并确认；第一行选什么屏幕都走时（真实程序：每秒做事+刷新显示并行）
  const progOn = stage === 'code' && confirmed && fills.show === LINES[1].answer && !garbled;
  const clockOn = progOn;   // 通关仍要求全部答对
  // 程序行为：只有对应积木被选中且元件已接线，才真的动
  const pickedLed = fills.tick === 1;
  const pickedMotor = fills.tick === 2;
  const ledLit = progOn && ledConnected && (pickedLed || holding);
  const motorSpin = progOn && motorConnected && pickedMotor;
  // 错误显示分支：选了也真跑（程序忠实执行你写的逻辑），只是显示的不是时间、不通关
  const showNoise = progOn && fills.show === 0;
  const showCurve = progOn && fills.show === 2;
  const [noise, setNoise] = useState('37.42');
  useEffect(() => {
    if (!showNoise) return;
    const iv = setInterval(() => setNoise((Math.random() * 100).toFixed(2)), 300);
    return () => clearInterval(iv);
  }, [showNoise]);
  const curvePts = [42, 38, 45, 40, 52, 47, 55, 50, 44, 48, 41, 46];   // 假温度折线

  useEffect(() => {
    if (!progOn) return;
    const iv = setInterval(() => {
      setNow(new Date());
      setSec((s) => s + 1);
    }, 1000);
    return () => clearInterval(iv);
  }, [progOn]);

  // 电机音效：程序选了「电机全速转」且已接线 → 低频嗡嗡声（复用第 3 关 Web Audio 思路）
  const audioRef = useRef(null);
  useEffect(() => {
    if (motorSpin && !audioRef.current) {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.value = 85;
      gain.gain.value = 0.04;
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      audioRef.current = { ctx, osc };
    } else if (!motorSpin && audioRef.current) {
      const { ctx, osc } = audioRef.current;
      osc.stop();
      ctx.close();
      audioRef.current = null;
    }
  }, [motorSpin]);

  useEffect(() => {
    if (clockOn && codeOK && sec >= 3 && !state.done[4]) {
      track('level_complete', 4);
      dispatch({ type: 'COMPLETE_LEVEL', level: 4, device: '电子时钟', badge: '指挥官' });
      dispatch({ type: 'SAY', text: '屏幕在跟你说话了！电梯楼层屏、微波炉面板——嵌入式机器靠屏幕跟人沟通 🖥️', mood: 'cheer' });
    }
  }, [sec, clockOn]);

  const pad = (n) => String(n).padStart(2, '0');
  const timeStr = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

  const Pin = ({ id, label, dx = 0, dy = 0 }) => {
    const [x, y] = PIN_POS[id];
    const g = pinGroup(id);
    const wired = g && PAIRS[g] && hasWire(...PAIRS[g]);
    const active = drag?.from === id;
    const selected = sel === id;
    const leftSide = x < 300;   // OLED/按键脚：标签放左边（朝元件外）；主控脚：标签放右边
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
        {label && (
          <text x={x + (leftSide ? 16 : -16) + dx} y={y + 4 + dy}
            textAnchor={leftSide ? 'start' : 'end'} fontSize="9.5" fontFamily="Consolas, monospace" fill="var(--ink-dim)">{label}</text>
        )}
      </g>
    );
  };

  if (!started) {
    return (
      <ProjectCard
        level={4} title="电子时钟" icon="⏰" difficulty={1} minutes={3}
        parts={[
          { key: 'mcu', icon: '🧠', name: '主控板', count: 1 },
          { key: 'oled', icon: '🖥️', name: 'OLED 屏', count: 1 },
          { icon: '🔘', name: '按键', count: 2 },
        ]}
        goal="先给 OLED 屏接上 I2C 总线，再用中文积木写出时钟程序——屏幕会显示你电脑的真实时间；按住按键数字变红。"
        onStart={() => { setStarted(true); track('level_start', 4); }}
      />
    );
  }

  // ── 元件悬浮提示：高亮 + 名称/说明 ──────────
  const PART_INFO = {
    oled: { name: 'OLED 显示屏', tip: '显示输出元件，走 I2C 总线，只占 2 根信号线' },
    mcu: { name: '主控板 STM32', tip: '单片机 = 机器的大脑，跑你写的程序' },
    btn: { name: '轻触按键', tip: '输入元件——人能给机器发信号的最简单方式' },
    led: { name: 'LED（可选）', tip: '输出元件，正极接 D5 负极接 GND 才会亮' },
    motor: { name: '电机（可选）', tip: '输出元件，IN 接 D6——接上才能转' },
  };
  const hotGlow = (key) => hotPart === key
    ? { filter: 'drop-shadow(0 0 6px var(--accent))', cursor: 'pointer' }
    : { transition: 'filter 150ms var(--ease-out)', cursor: 'pointer' };
  const partTip = hotPart && PART_INFO[hotPart];

  // ── 接线台视图 ─────────────────────────────
  const wiringView = (
    <div className="fade-up" style={{ width: '100%' }}>
      <div style={{ fontSize: 14, color: 'var(--ink-dim)', marginBottom: 8 }}>
        把 OLED 屏和按键接到主控板——注意 SDA / SCL 别插反；台面右下角的 LED 和电机是可选件，接上才玩得到：
      </div>
      <svg ref={svgRef} width={760} height={310} viewBox="0 0 760 310" className="bench-grid fade-up" style={{
        maxWidth: '100%', background: 'var(--bench)', borderRadius: 14,
        border: '1px solid var(--card-edge)', touchAction: 'none', userSelect: 'none',
      }}>
        {/* OLED 屏（Wokwi SSD1306 风：深蓝 PCB + 屏窗 + 丝印，引脚朝右） */}
        <g onMouseEnter={() => setHotPart('oled')} onMouseLeave={() => setHotPart((h) => (h === 'oled' ? null : h))} style={hotGlow('oled')}>
          <rect x="50" y="34" width="128" height="112" rx="8" fill="#1a2b4a" stroke="#0f1c33" strokeWidth="1.5" />
          {/* 四角安装孔 */}
          {[[60, 44], [168, 44], [60, 136], [168, 136]].map(([cx, cy], i) => (
            <circle key={i} cx={cx} cy={cy} r="3" fill="var(--bench)" stroke="#2f4d68" strokeWidth="1.5" />
          ))}
          <rect x="62" y="44" width="100" height="58" rx="3" fill="#0a0e14" />
          <text x="112" y="78" textAnchor="middle" fontSize="13" fontFamily="Consolas, monospace" fill="#2a3240">--:--</text>
          <text x="112" y="118" textAnchor="middle" fontSize="8" fill="#cfe3f5" fontFamily="Consolas, monospace">0.96" OLED</text>
          <text x="112" y="130" textAnchor="middle" fontSize="7" fill="#8ca6cc" fontFamily="Consolas, monospace">SSD1306</text>
        </g>
        <Pin id="o_vcc" label="VCC" dx={-2} /><Pin id="o_gnd" label="GND" dx={-2} />
        <Pin id="o_sda" label="SDA" dx={-2} /><Pin id="o_scl" label="SCL" dx={-2} />
        {/* 主控板（与第 3 关同款：半透明蓝底 + 黑色 STM32 芯片） */}
        <g onMouseEnter={() => setHotPart('mcu')} onMouseLeave={() => setHotPart((h) => (h === 'mcu' ? null : h))} style={hotGlow('mcu')}>
          <rect x="412" y="40" width="180" height="196" rx="10" fill="#1f6feb" opacity="0.12" stroke="var(--card-edge)" strokeWidth="1.5" />
          {/* USB 口（顶部） */}
          <rect x="462" y="32" width="52" height="14" rx="3" fill="#8b95a1" stroke="#6a7480" />
          <rect x="468" y="35" width="40" height="7" rx="2" fill="#b8c0c8" />
          {/* MCU 黑色芯片 */}
          <rect x="452" y="108" width="96" height="80" rx="5" fill="#2d333b" stroke="#666" strokeWidth="1" />
          {/* 芯片上下排针 */}
          {[0, 1, 2, 3].map((i) => (
            <rect key={i} x={462 + i * 24} y="101" width="6" height="9" fill="#8a929c" />
          ))}
          {[0, 1, 2, 3].map((i) => (
            <rect key={i} x={462 + i * 24} y="186" width="6" height="9" fill="#8a929c" />
          ))}
          <circle cx="532" cy="118" r="4" fill="#666" />
          <text x="462" y="142" fill="#c9d1d9" fontSize="10.5" fontFamily="Consolas, monospace">STM32</text>
          <text x="462" y="156" fill="#8a929c" fontSize="8" fontFamily="Consolas, monospace">F103C8T6</text>
          <text x="502" y="226" textAnchor="middle" fill="var(--ink-dim)" fontSize="11">主控板</text>
        </g>
        {/* 板载电源指示灯 */}
        <circle cx="580" cy="50" r="3" fill="var(--live)" opacity="0.8" />
        {/* 电源/信号排：全部在板左缘，引脚朝左 */}
        <Pin id="m_5v" label="5V" dx={-2} /><Pin id="m_gnd" label="GND" dx={-2} />
        <Pin id="m_d3" label="D3" dx={-2} /><Pin id="m_d4" label="D4" dx={-2} />
        <Pin id="m_d2" label="D2" dx={-2} /><Pin id="m_d7" label="D7" dx={-2} />
        <Pin id="m_d5" label="D5" dx={-2} /><Pin id="m_d6" label="D6" dx={-2} />
        {/* 按键 ×2（tact switch：灰色底座 + 圆形白帽） */}
        {[{ id: 'k1_sig', x: 238, name: 'K1' }, { id: 'k2_sig', x: 306, name: 'K2' }].map((b) => (
          <g key={b.id} onMouseEnter={() => setHotPart('btn')} onMouseLeave={() => setHotPart((h) => (h === 'btn' ? null : h))} style={hotGlow('btn')}>
            <rect x={b.x} y="230" width="40" height="36" rx="5" fill="#3a3f4a" stroke="#252a33" strokeWidth="1.5" />
            <circle cx={b.x + 20} cy="248" r="11" fill="#d0d4da" stroke="#9aa0aa" strokeWidth="2" />
            <text x={b.x + 20} y="260" textAnchor="middle" fontSize="7" fill="#8ca6cc" fontFamily="Consolas, monospace">{b.name}</text>
          </g>
        ))}
        <Pin id="k1_sig" label="" /><Pin id="k2_sig" label="" />
        {/* 可选件：LED + 电机（Wokwi 风，本体在引脚上方，引脚水平朝下）——不接也不影响通关 */}
        <g onMouseEnter={() => setHotPart('led')} onMouseLeave={() => setHotPart((h) => (h === 'led' ? null : h))} style={hotGlow('led')}>
          {/* LED：红色圆顶 + 金属底座（LED 灯珠样式） */}
          <path d="M 546 216 A 14 14 0 0 1 574 216 L 574 228 L 546 228 Z"
            fill={ledLit ? '#ff6b6b' : '#e05252'} stroke={ledLit ? '#ff9b9b' : '#b03a3a'} strokeWidth="1.5"
            style={{ filter: ledLit ? 'drop-shadow(0 0 10px rgba(255,107,107,.9))' : 'none', transition: 'fill 120ms' }} />
          <rect x="543" y="228" width="34" height="6" rx="2" fill="#8a929c" stroke="#6a7480" strokeWidth="1" />
          <text x="560" y="206" textAnchor="middle" fontSize="9" fill="var(--ink-dim)">LED</text>
        </g>
        <Pin id="led_a" label="LED+" /><Pin id="led_k" label="LED−" />
        <g onMouseEnter={() => setHotPart('motor')} onMouseLeave={() => setHotPart((h) => (h === 'motor' ? null : h))} style={hotGlow('motor')}>
          {/* 电机：深灰圆机身 + 中心轴 + 转动指示点 */}
          <circle cx="711" cy="230" r="16"
            fill={motorSpin ? '#4a5568' : '#3a3f4a'}
            stroke={motorSpin ? 'var(--accent)' : '#252a33'} strokeWidth="1.5"
            style={{ transition: 'stroke 200ms' }} />
          <circle cx="711" cy="230" r="10" fill="#2a2f38" stroke="#4a5058" strokeWidth="1" />
          {/* 转轴 + 旋转十字标记：sec 每秒 +1，用短间隔时钟驱动更顺滑 */}
          <g style={{ transformOrigin: '711px 230px', transform: motorSpin ? `rotate(${(sec % 4) * 90}deg)` : 'none', transition: motorSpin ? 'transform 1s linear' : 'none' }}>
            <path d="M 711 221 L 711 239 M 702 230 L 720 230" stroke="#8a929c" strokeWidth="2.5" strokeLinecap="round" />
          </g>
          {motorSpin && (
            <circle cx="711" cy="212" r="2.5" fill="var(--accent)" opacity={0.5 + 0.5 * Math.sin(Date.now() / 120)}>
            </circle>
          )}
          <text x="711" y="206" textAnchor="middle" fontSize="9" fill="var(--ink-dim)">电机</text>
        </g>
        <Pin id="motor_in" label="IN" /><Pin id="motor_g" label="GND" />
        {/* 导线：正确绿实线 / 插反黄色虚线⚠ / 错误红虚线 */}
        {wires.map((w, i) => {
          const wrong = isWrong(w.a, w.b);
          const swap = isSwap(w.a, w.b);
          const color = wrong ? 'var(--danger)' : swap ? 'var(--accent)' : 'var(--live)';
          return (
            <g key={i} onClick={() => removeWire(i)} style={{ cursor: 'pointer' }}>
              <path d={wirePath(w.a, w.b)} stroke="var(--bg)" strokeWidth="7" fill="none" opacity="0.5" />
              <path d={wirePath(w.a, w.b)} stroke={color} strokeWidth="4" fill="none"
                strokeDasharray={wrong || swap ? '6 4' : undefined} opacity="0.9" />
              {(wrong || swap) && (
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
        {/* 点选模式：从选中脚到当前悬停脚的预览线 */}
        {!drag && sel && hover && hover !== sel && (
          <line x1={PIN_POS[sel][0]} y1={PIN_POS[sel][1]} x2={PIN_POS[hover][0]} y2={PIN_POS[hover][1]}
            stroke="var(--accent)" strokeWidth="3" strokeDasharray="5 4" opacity="0.5" />
        )}
        {/* 点选模式提示 */}
        {sel && !drag && (
          <text x="380" y="22" textAnchor="middle" fontSize="12" fill="var(--accent)">
            已选中 {PIN_NAME[sel] || sel}——再点目标引脚完成连线，再点它取消
          </text>
        )}
        {/* 元件悬浮说明牌 */}
        {partTip && (
          <g>
            <rect x="380" y="190" width={partTip.name.length * 13 + partTip.tip.length * 11 + 40} height="22" rx="6"
              fill="var(--card)" stroke="var(--accent)" strokeWidth="1" opacity="0.95" />
            <text x="396" y="205" fontSize="11" fill="var(--ink)">
              <tspan fontWeight="700" fill="var(--accent)">{partTip.name}</tspan>
              <tspan fill="var(--ink-dim)" fontSize="10">  {partTip.tip}</tspan>
            </text>
          </g>
        )}
      </svg>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 12 }}>
        <span style={{ fontSize: 13, color: wiredOK && !swapBad ? 'var(--live)' : 'var(--ink-dim)' }}>
          {wiredOK ? (swapBad ? '⚠ 已接 6/6，但有插反的线' : `✓ 已接 ${wiredCount}/6`) : `已接 ${wiredCount}/6`}
        </span>
        <span style={{ fontSize: 12, color: 'var(--ink-dim)' }}>（点引脚 A 再点引脚 B 连线；黄/红虚线点一下可拆掉）</span>
        <button className="btn btn-primary" disabled={!wiredOK} onClick={burn}>
          ▶ 烧录
        </button>
      </div>
    </div>
  );

  // ── 代码 + OLED 视图 ───────────────────────
  const codeView = (
    <div className="fade-up" style={{ display: 'flex', gap: 28, alignItems: 'flex-start', width: 760, maxWidth: '100%' }}>
      {/* 左：代码卡 */}
      <div style={{ width: 360 }}>
        <div style={{ fontSize: 14, color: 'var(--ink-dim)', marginBottom: 10 }}>
          点选项，把程序补完整{!codeOK ? '（选完两行点「确认运行」）' : ''}：
        </div>
        {LINES.map((l) => (
          <div key={l.id} style={{
            background: 'var(--card)', border: '1px solid var(--card-edge)', borderRadius: 10,
            padding: '10px 14px', marginBottom: 12, fontSize: 15,
          }}>
            {l.prompt}
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              {l.options.map((o, i) => (
                <button
                  key={i}
                  className="btn"
                  style={{
                    fontSize: 12.5, padding: '5px 10px',
                    borderColor: fills[l.id] === i ? 'var(--live)' : undefined,
                    color: fills[l.id] === i ? 'var(--live)' : undefined,
                  }}
                  onClick={() => {
                    setFills((f) => ({ ...f, [l.id]: i }));
                    if (i === l.answer) track('blank_fill', 4, { line: l.id });
                    else track('wrong_fill', 4, { line: l.id, picked: o });
                  }}
                >
                  {o}
                </button>
              ))}
            </div>
          </div>
        ))}
        {!codeOK && (
          <button
            className="btn btn-primary"
            disabled={!(fills.tick !== undefined && fills.show !== undefined)}
            onClick={() => {
              setConfirmed(true);
              const ok = fills.tick === LINES[0].answer && fills.show === LINES[1].answer;
              if (fills.show === 0) {
                dispatch({ type: 'SAY', text: '程序跑起来了……但屏幕上全是乱跳的数字。随机噪音不是给人看的信息，换成「时 : 分 : 秒」试试', mood: 'think' });
              } else if (fills.show === 2) {
                dispatch({ type: 'SAY', text: '温度曲线是画出来了，可这是时钟不是温度计——显示什么，取决于你写的程序', mood: 'think' });
              } else if (ok && fills.tick === 1 && !ledConnected) {
                dispatch({ type: 'SAY', text: '你让程序每秒点灯，可台面上还没有 LED——把它接上 D5 和 GND，灯才真的会亮', mood: 'think' });
              } else if (ok && fills.tick === 2 && !motorConnected) {
                dispatch({ type: 'SAY', text: '你让程序全速转电机，可台面上还没接电机——IN 接 D6、GND 接好，它才转得起来', mood: 'think' });
              } else {
                dispatch({ type: 'SAY', text: ok ? '程序跑起来了，看屏幕！' : '每 1 秒做什么选对了吗？想想时钟的特性——它得会数秒', mood: 'think' });
              }
            }}
            style={{ opacity: fills.tick !== undefined && fills.show !== undefined ? 1 : 0.5 }}
          >
            ▶ 确认运行
          </button>
        )}
        {codeOK && (
          <div style={{ fontSize: 13, marginTop: 4 }}>
            <button
              className="btn"
              onPointerDown={() => { setHolding(true); track('btn_hold', 4); }}
              onPointerUp={() => setHolding(false)}
              onPointerLeave={() => setHolding(false)}
            >
              🔘 按住这个按键（数字变红 = 人对机器发号施令）
            </button>
          </div>
        )}
      </div>

      {/* 右：OLED 像素屏（放大版） */}
      <div style={{
        background: '#0a0e14', border: '3px solid var(--card-edge)', borderRadius: 14,
        padding: '24px 34px', fontFamily: 'ui-monospace, Consolas, monospace',
        flex: 1, minWidth: 380, display: 'flex', flexDirection: 'column', justifyContent: 'center',
      }}>
        <div style={{ fontSize: 13, color: '#3a4656', marginBottom: 10 }}>OLED 128×64</div>
        {garbled ? (
          <>
            <div style={{
              fontSize: 56, letterSpacing: 4, textAlign: 'center', lineHeight: 1.2,
              color: '#f87171', textShadow: '0 0 10px rgba(248,113,113,.4)',
            }}>?#%@*!</div>
            <div style={{ fontSize: 13, color: '#f87171', textAlign: 'center', marginTop: 8 }}>
              乱码——SDA/SCL 插反了，回上面拆掉重接，再点「▶ 烧录」
            </div>
          </>
        ) : showNoise ? (
          <>
            {/* 随机噪音：程序忠实执行了，但显示的是没用的原始数据 */}
            <div style={{
              fontSize: 44, letterSpacing: 2, textAlign: 'center', lineHeight: 1.2,
              fontFamily: 'ui-monospace, Consolas, monospace', color: '#e8c35a',
            }}>{noise}</div>
            <div style={{ fontSize: 13, color: '#8a6d3b', textAlign: 'center', marginTop: 10 }}>
              数字在乱跳——这是传感器的原始噪音，不是给人看的时间
            </div>
          </>
        ) : showCurve ? (
          <>
            {/* 温度曲线：画得出来，但时钟屏显示温度就是走错程序了 */}
            <svg width="100%" height="110" viewBox="0 0 300 110" preserveAspectRatio="none">
              <polyline
                points={curvePts.map((v, i) => `${10 + i * 25},${100 - (v - 30) * 2.2}`).join(' ')}
                fill="none" stroke="#5ab0e8" strokeWidth="2.5" strokeLinejoin="round"
              />
              {curvePts.map((v, i) => (
                <circle key={i} cx={10 + i * 25} cy={100 - (v - 30) * 2.2} r="3" fill="#5ab0e8" />
              ))}
            </svg>
            <div style={{ fontSize: 13, color: '#8a6d3b', textAlign: 'center', marginTop: 10 }}>
              曲线画出来了——可这是温度计的活儿，时钟屏要显示的是时间
            </div>
          </>
        ) : (
          <>
            <div style={{
              fontSize: 50, letterSpacing: 3, textAlign: 'center', lineHeight: 1.1,
              color: holding ? '#ff5252' : confirmed ? (clockOn ? '#4ade80' : '#2a3240') : '#2a3240',
              textShadow: holding ? '0 0 12px rgba(255,80,80,.6)' : confirmed && clockOn ? '0 0 14px rgba(74,222,128,.4)' : 'none',
              transition: 'color .2s',
            }}>
              {confirmed && clockOn ? timeStr : '--:--'}
            </div>
            {/* 外设状态行：程序点了灯/电机的名，但元件没接 → 命令落空 */}
            {progOn && (pickedLed || pickedMotor) && (
              <div style={{
                fontSize: 13, textAlign: 'center', marginTop: 10, minHeight: 18,
                color: (pickedLed ? ledConnected : motorConnected) ? '#4ade80' : '#8a6d3b',
              }}>
                {pickedLed && (ledConnected
                  ? (holding ? '● LED 点亮中（D5 HIGH）' : '○ LED 熄灭（D5 LOW）——按住按键试试')
                  : '程序在控制 D5 脚……可你什么都没接上去')}
                {pickedMotor && (motorConnected
                  ? '⟳ 电机全速旋转中（D6 HIGH）'
                  : '程序在控制 D6 脚……可你什么都没接上去')}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'flex-start', width: '100%', maxWidth: 860, margin: '0 auto' }}>
      {/* 接线台始终在场：烧录前是主任务，烧录后是成品实况 */}
      {wiringView}
      {/* 烧录后：代码卡 + OLED 出现在下方，不跳转 */}
      {stage === 'code' && codeView}
      <div style={{ fontSize: 13, color: 'var(--ink-dim)' }}>
        知识点：人机交互 · 显示 · I2C 总线
        <PartInfo partKey="oled" /><PartInfo partKey="mcu" />
      </div>
    </div>
  );
}
