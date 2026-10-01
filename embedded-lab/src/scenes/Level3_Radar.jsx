// 第 3 关「倒车雷达」：Wokwi 风 HC-SR04 四脚接线 + 按住倒车（你来开）+ 三段式蜂鸣 + 撞车/停位判定
import { useEffect, useRef, useState } from 'react';
import { useGame } from '../store/GameContext.jsx';
import { track } from '../lib/track.js';
import ProjectCard from '../components/ProjectCard.jsx';
import PartInfo from '../components/PartInfo.jsx';
import CodePeek from '../components/CodePeek.jsx';

// 真实 Arduino 代码（HC-SR04 超声波倒车雷达）
const ARDUINO_CODE = `// 倒车雷达：超声波测距 → 判断 → 蜂鸣
const TRIG_PIN = 5;   // Trig：主控发一声超声波
const ECHO_PIN = 6;   // Echo：收回声（输入脚）
const BUZZ_PIN = 9;   // 蜂鸣器（输出脚）
const LIMIT    = 50;  // 报警距离(cm)

void setup() {
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  pinMode(BUZZ_PIN, OUTPUT);
  Serial.begin(115200);
}

void loop() {
  // 感知：Trig 拉高 10 微秒，发一声超声波
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);

  // Echo 高电平时长 = 声波往返时间
  long t = pulseIn(ECHO_PIN, HIGH);
  int dist = t * 0.034 / 2;  // 声速 0.034cm/us，除以 2 是往返

  // 判断：三段式报警（和真实倒车雷达一样）
  if (dist > 0 && dist < 15) {
    tone(BUZZ_PIN, 1200);          // 长鸣：马上撞了！
  } else if (dist < 30) {
    tone(BUZZ_PIN, 1000, 80);      // 急促滴滴
  } else if (dist < LIMIT) {
    tone(BUZZ_PIN, 800, 60);       // 缓慢滴滴
  } else {
    noTone(BUZZ_PIN);              // 安全距离：闭嘴
  }

  Serial.print("dist=");
  Serial.print(dist);
  Serial.println("cm");
  delay(80);
}`;

// 积木链（本关预置好，重心在接线 + 开车）
const CHAIN = [
  { label: '📡 超声波测距', kind: '感知' },
  { label: '❓ 距离 < 50cm ？', kind: '判断' },
  { label: '📢 蜂鸣器响', kind: '执行' },
];

// 蜂鸣三段式：远=不响 / <80 缓慢滴滴 / <30 急促 / <15 长鸣
function beepStage(dist) {
  if (dist < 15) return { on: true, gap: 120, freq: 1200, name: '长鸣' };
  if (dist < 30) return { on: true, gap: 200, freq: 1000, name: '急促' };
  if (dist < 80) return { on: true, gap: 600, freq: 800, name: '缓慢' };
  return { on: false, gap: 0, freq: 0, name: '静音' };
}

export default function Level3_Radar() {
  const { state, dispatch } = useGame();
  const [started, setStarted] = useState(false);
  const [running, setRunning] = useState(false);
  const [holding, setHolding] = useState(false);   // 按住「倒车」= 踩着倒车
  const [dist, setDist] = useState(200);           // 车尾离墙 cm
  const [hover, setHover] = useState(null);
  const [serial, setSerial] = useState([]);
  const [drag, setDrag] = useState(null);
  const [wires, setWires] = useState([]);
  const [crash, setCrash] = useState(false);
  const [parked, setParked] = useState(false);     // 停进车位（完美入位）
  const [challengeOn, setChallengeOn] = useState(false);  // 限时泊车挑战进行中
  const [challengeDone, setChallengeDone] = useState(false);
  const [parkCount, setParkCount] = useState(0);   // 挑战内已入位次数
  const [attempts, setAttempts] = useState(0);     // 本次 RUN 内停车尝试次数（松开踏板=一次尝试）
  const [timeLeft, setTimeLeft] = useState(60);    // 挑战倒计时
  const [zone, setZone] = useState(15);            // 车位下缘（cm），挑战中随机换位
  const sawBeepRef = useRef(false);
  const stageRef = useRef('');
  const audioRef = useRef(null);
  const beepTimer = useRef(null);
  const svgRef = useRef(null);
  const driveRef = useRef(null);

  // 引脚 id：HC-SR04 四脚（VCC/TRIG/ECHO/GND）· 主控板一排引脚（5V/3V3/GND + D5/D6 + D9）· 蜂鸣器
  // 迷惑项：3V3 —— 接它供电不足，RUN 后测距乱跳
  const PAIRS = {
    vcc: ['u_vcc', 'm_5v'],
    trig: ['u_trig', 'm_d5'],
    echo: ['u_echo', 'm_d6'],
    gnd: ['u_gnd', 'm_gnd'],
    buz: ['m_d9', 'b_sig'],
  };
  const hasWire = (a, b) => wires.some((w) => (w.a === a && w.b === b) || (w.a === b && w.b === a));
  const isWrong = (a, b) => !Object.values(PAIRS).some(([x, y]) => (x === a && y === b) || (x === b && y === a));
  const pinGroup = (id) => Object.keys(PAIRS).find((g) => PAIRS[g].includes(id));

  // 引脚坐标（与台面渲染一致；改渲染必须同步这里）
  const PIN_POS = {
    u_vcc: [52, 158], u_trig: [77, 158], u_echo: [102, 158], u_gnd: [127, 158],
    m_5v: [306, 26], m_3v3: [338, 26], m_gnd: [370, 26],
    m_d5: [296, 96], m_d6: [296, 118],
    m_d9: [498, 66], b_sig: [553, 72],
  };

  const wiredOK = Object.values(PAIRS).every(([a, b]) => hasWire(a, b));
  const wiredCount = Object.values(PAIRS).filter(([a, b]) => hasWire(a, b)).length;
  const done3 = !!state.done[3];
  const stage = beepStage(dist);
  const beeping = running && !crash && stage.on;

  // 接线：按住引脚拖到目标引脚
  const startDrag = (k) => (e) => {
    const g = pinGroup(k);
    if (g && hasWire(...PAIRS[g])) return;
    e.preventDefault();
    const r = svgRef.current.getBoundingClientRect();
    const toSvg = (cx, cy) => [(cx - r.left) * 760 / r.width, (cy - r.top) * 216 / r.height];
    const [sx, sy] = toSvg(e.clientX, e.clientY);
    setDrag({ from: k, x: sx, y: sy });
    const move = (ev) => {
      const [x, y] = toSvg(ev.clientX, ev.clientY);
      setDrag({ from: k, x, y });
    };
    const up = (ev) => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      setDrag(null);
      const [px, py] = toSvg(ev.clientX, ev.clientY);
      const to = Object.keys(PIN_POS).find((id) => Math.hypot(PIN_POS[id][0] - px, PIN_POS[id][1] - py) < 20);
      if (!to || to === k || hasWire(k, to)) return;
      setWires((w) => [...w, { a: k, b: to }]);
      if (isWrong(k, to)) {
        track('reject', 3, { reason: 'mismatch', a: k, b: to });
        dispatch({
          type: 'SAY',
          text: to === 'm_3v3' || k === 'm_3v3'
            ? '3V3 是 3.3V 电源——HC-SR04 要 5V 才够劲，接这里测距会不稳。想想 VCC 该去哪'
            : '咦，这样接不通。看引脚名：电源找电源（5V/GND），信号找信号（D5/D6/D9）',
          mood: 'think',
        });
      } else {
        track('connect', 3, { wire: pinGroup(k) });
        const MSG = {
          vcc: 'VCC 接上 5V 了——模块通电',
          gnd: 'GND 接好了——电路有了回路',
          trig: 'Trig → D5——主控可以发超声波了',
          echo: 'Echo → D6——回声进得来',
          buz: '蜂鸣器接到 D9 了！',
        };
        dispatch({ type: 'SAY', text: MSG[pinGroup(k)], mood: 'happy' });
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

  // 开车：按住「倒车」才往后退；撞墙判定；松开时判定是否停进车位
  useEffect(() => {
    if (!running || crash || !holding) return;
    const iv = setInterval(() => {
      setDist((d) => {
        const next = Math.max(0, d - 2);
        if (next <= 8) {
          setCrash(true);
          setHolding(false);
          track('crash', 3, { dist: next });
          dispatch({ type: 'SAY', text: '咣！！撞墙了——长鸣就是最后警告，听到长鸣要立刻停。重新 RUN 再试', mood: 'panic' });
          return 8;
        }
        return next;
      });
    }, 80);
    return () => clearInterval(iv);
  }, [running, holding, crash]);

  // 松开踏板瞬间才算"一次尝试"：用 ref 记录"刚才在按"，避免 RUN 初始/其他渲染误计数
  const wasHoldingRef = useRef(false);
  useEffect(() => {
    if (!running || crash) { wasHoldingRef.current = false; return; }
    if (holding) { wasHoldingRef.current = true; return; }
    if (!wasHoldingRef.current) return;      // 没按过就松开 = 不算尝试
    wasHoldingRef.current = false;
    const tryNo = attempts + 1;
    setAttempts(tryNo);
    if (dist >= zone && dist <= zone + 10) {
      if (challengeOn) {
        setParked(true);
        // 挑战：入位成功 → 换随机车位，60 秒内凑 2 次
        const count = parkCount + 1;
        setParkCount(count);
        if (count >= 2) {
          setChallengeDone(true);
          setChallengeOn(false);
          track('challenge_complete', 3, { dist, secondsLeft: Math.round(timeLeft), attempts: tryNo });
          dispatch({ type: 'SAY', text: `两次完美入位，只用了 ${60 - timeLeft} 秒、${tryNo} 次尝试——这手稳，真司机了 🚕`, mood: 'cheer' });
        } else {
          const spot = 30 + Math.floor(Math.random() * 8) * 5; // 30~65cm 随机新车位
          setZone(spot);
          setDist(200);
          setParked(false);
          track('challenge_park', 3, { dist, attempt: tryNo, secondsLeft: Math.round(timeLeft) });
          dispatch({ type: 'SAY', text: `第 ${tryNo} 次尝试入库成功（${dist}cm）！车位换到 ${spot}~${spot + 10}cm，还有 ${Math.ceil(timeLeft)} 秒——继续`, mood: 'happy' });
        }
      } else if (!state.done[3]) {
        setParked(true);
        track('challenge_complete', 3, { dist });
        dispatch({ type: 'SAY', text: `稳稳停在 ${dist}cm——完美入位！你全程靠耳朵把车停进了车位，这就是倒车雷达的全部意义`, mood: 'cheer' });
      } else if (dist < zone) {
        dispatch({ type: 'SAY', text: `第 ${tryNo} 次尝试：停在 ${dist}cm，离车位 ${zone}~${zone + 10}cm 还远了 ${zone - dist}cm——胆子再大点，听到急促滴滴也别急着刹`, mood: 'think' });
      } else {
        dispatch({ type: 'SAY', text: `第 ${tryNo} 次尝试：停在 ${dist}cm，冲过头了！车位在 ${zone}~${zone + 10}cm——长鸣前要提前收油`, mood: 'think' });
      }
    } else if (challengeOn) {
      // 挑战中停歪了也算一次尝试，立刻给反馈（车留在原地，可以继续微调）
      if (dist < zone) {
        dispatch({ type: 'SAY', text: `第 ${tryNo} 次尝试：还差 ${zone - dist}cm 才到车位——听滴滴节奏，还能再退`, mood: 'think' });
      } else {
        dispatch({ type: 'SAY', text: `第 ${tryNo} 次尝试：冲过头 ${dist - (zone + 10)}cm，差点亲墙！点重置从头来`, mood: 'panic' });
      }
    }
  }, [holding, crash, running, dist]);

  // 挑战计时：60 秒倒计时
  useEffect(() => {
    if (!challengeOn || challengeDone) return;
    const iv = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(iv);
          setChallengeOn(false);
          setParkCount(0);
          setZone(15);
          dispatch({ type: 'SAY', text: '时间到！点「再试一次」重来——先在缓慢滴滴段多退快些，给急促段留时间', mood: 'think' });
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(iv);
  }, [challengeOn, challengeDone]);

  // 挑战音效：最后 10 秒滴答（比蜂鸣更让人手心出汗）
  useEffect(() => {
    if (!challengeOn || challengeDone || timeLeft > 10 || timeLeft <= 0) return;
    try {
      if (!audioRef.current) audioRef.current = new (window.AudioContext || window.webkitAudioContext)();
      const ctx = audioRef.current;
      if (ctx.state === 'suspended') ctx.resume();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = 1500;
      osc.type = 'square';
      gain.gain.setValueAtTime(0.05, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.06);
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.06);
    } catch (e) { /* 静默 */ }
  }, [timeLeft, challengeOn, challengeDone]);

  // 空格 = 倒车踏板（按住倒车，松开刹车）
  useEffect(() => {
    const down = (e) => {
      if (e.code !== 'Space' || !running || crash) return;
      e.preventDefault();
      setHolding(true);
    };
    const up = (e) => {
      if (e.code === 'Space') setHolding(false);
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, [running, crash]);

  // 蜂鸣（三段式）
  useEffect(() => {
    if (!beeping) {
      clearTimeout(beepTimer.current);
      return;
    }
    const beep = () => {
      try {
        if (!audioRef.current) audioRef.current = new (window.AudioContext || window.webkitAudioContext)();
        const ctx = audioRef.current;
        if (ctx.state === 'suspended') ctx.resume(); // 浏览器 autoplay 策略：非手势回调里创建的音频上下文要手动唤醒
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.value = stage.freq;
        osc.type = 'square';
        const dur = stage.gap <= 120 ? 0.5 : 0.1; // 长鸣拖长
        gain.gain.setValueAtTime(0.08, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
        osc.connect(gain).connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + dur);
      } catch (e) { /* 静默 */ }
      beepTimer.current = setTimeout(beep, stage.gap);
    };
    beep();
    return () => clearTimeout(beepTimer.current);
  }, [beeping, stage.freq, stage.gap]);

  // 通关：第一次听到滴滴声
  useEffect(() => {
    if (running && wiredOK && dist <= 80 && !sawBeepRef.current) {
      sawBeepRef.current = true;
    }
    if (running && wiredOK && stage.on && !state.done[3]) {
      track('level_complete', 3);
      dispatch({ type: 'COMPLETE_LEVEL', level: 3, device: '倒车雷达', badge: '雷达兵' });
      dispatch({ type: 'SAY', text: '听到了吗？越近越急——爸妈倒车时的滴滴声就是这套！机器就是这样感知距离的 📡', mood: 'cheer' });
    }
  }, [dist, running, wiredOK]);

  // 串口：倒车中每 8 帧打一行
  useEffect(() => {
    if (!running || !wiredOK) return;
    setSerial((prev) => [...prev, `dist=${dist}cm beep=${stage.on ? stage.name : 'OFF'}`].slice(-30));
  }, [dist]);

  // RUN 时 3V3 误接的后果
  useEffect(() => {
    if (!running) return;
    const badVcc = wires.some((w) => w.a === 'm_3v3' || w.b === 'm_3v3');
    if (badVcc) {
      dispatch({ type: 'SAY', text: '测距数字在乱跳——你把超声波的 VCC 接到 3V3 了，供电不足。停掉，把那根红线拆了改接 5V', mood: 'panic' });
    }
  }, [running]);

  if (!started) {
    return (
      <ProjectCard
        level={3} title="倒车雷达" icon="📡" difficulty={3} minutes={4}
        parts={[
          { key: 'mcu', icon: '🧠', name: '主控板', count: 1 },
          { icon: '📡', name: '超声波模块', count: 1 },
          { key: 'buzzer', icon: '📢', name: '蜂鸣器', count: 1 },
        ]}
        goal="HC-SR04 有 4 个脚：VCC 供电、GND 回路、Trig 发声、Echo 收声——给它们在主控板引脚排上找到各自的位置。烧录后按住「倒车」把车停进车位：这一关，你的耳朵就是眼睛。"
        onStart={() => { setStarted(true); track('level_start', 3); }}
      />
    );
  }

  const TIPS = {
    sonar: {
      icon: '📡', name: '超声波模块 HC-SR04',
      lines: ['像蝙蝠：发一声超声波，听回声算距离', 'VCC 供电 · Trig 发声 · Echo 收声 · GND 回路'],
    },
    mcu: {
      icon: '🧠', name: '主控板（单片机）',
      lines: ['上面一排是电源脚：5V / 3V3 / GND', '左边 D5、D6 是信号脚，右边 D9 接执行器'],
    },
    buzzer: {
      icon: '📢', name: '蜂鸣器',
      lines: ['通电就响的小喇叭', '提醒人类：「注意，要撞了！」'],
    },
  };

  // 引脚渲染
  const Pin = ({ k, label, dx = 0, dy = 22 }) => {
    const [x, y] = PIN_POS[k];
    const g = pinGroup(k);
    const wired = g && hasWire(...PAIRS[g]);
    const active = drag?.from === k;
    return (
      <g onPointerDown={startDrag(k)} style={{ cursor: wired ? 'default' : 'grab' }}>
        <circle cx={x} cy={y} r={8}
          fill={wired ? 'var(--live)' : active ? 'var(--accent)' : 'var(--card)'}
          stroke={wired ? 'var(--live)' : active ? 'var(--accent)' : 'var(--card-edge)'} strokeWidth={1.5}
          style={{ transition: 'fill 120ms var(--ease-out)' }} />
        {label && (
          <text x={x + dx} y={y + dy} textAnchor="middle" fill="var(--ink-dim)" fontSize={9.5}>{label}</text>
        )}
      </g>
    );
  };

  // 俯视小车（Wokwi 风：叠层 + 渐变，玩具模型质感）
  const Car = ({ x, y }) => (
    <g transform={`translate(${x}, ${y})`}>
      <defs>
        <linearGradient id="carBody" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#e94f4f" />
          <stop offset="0.5" stopColor="#c73e3e" />
          <stop offset="1" stopColor="#9c3030" />
        </linearGradient>
      </defs>
      {/* 车轮（从车身下露出一截） */}
      <rect x={4} y={-16} width={18} height={9} rx={3} fill="#1a1d22" />
      <rect x={4} y={44} width={18} height={9} rx={3} fill="#1a1d22" />
      <rect x={64} y={-16} width={18} height={9} rx={3} fill="#1a1d22" />
      <rect x={64} y={44} width={18} height={9} rx={3} fill="#1a1d22" />
      {/* 车身 */}
      <rect x={0} y={-20} width={88} height={77} rx={16} fill="url(#carBody)" stroke="#7a2626" strokeWidth={1.5} />
      {/* 车身高光 */}
      <rect x={5} y={-16} width={78} height={12} rx={8} fill="#ffffff" opacity={0.18} />
      {/* 挡风玻璃（前=右，倒车朝左退）+ 后窗 */}
      <rect x={62} y={-12} width={14} height={61} rx={5} fill="#26313d" />
      <rect x={12} y={-12} width={10} height={61} rx={5} fill="#26313d" opacity={0.85} />
      {/* 车顶 */}
      <rect x={26} y={-8} width={34} height={53} rx={7} fill="none" stroke="#ffffff" strokeOpacity={0.25} strokeWidth={1.5} />
      {/* 后视镜 */}
      <rect x={54} y={-23} width={9} height={6} rx={2.5} fill="#7a2626" />
      <rect x={54} y={54} width={9} height={6} rx={2.5} fill="#7a2626" />
      {/* 倒车灯（车尾=左）：倒车时常亮，撞车闪 */}
      <rect x={-2} y={-6} width={5} height={10} rx={2}
        fill={crash ? '#fff' : '#ffe08a'} stroke="#8a6d1f" strokeWidth={0.8}
        style={crash ? { animation: 'l3blink 0.2s infinite' } : undefined} />
      <rect x={-2} y={33} width={5} height={10} rx={2}
        fill={crash ? '#fff' : '#ffe08a'} stroke="#8a6d1f" strokeWidth={0.8}
        style={crash ? { animation: 'l3blink 0.2s infinite' } : undefined} />
    </g>
  );

  // 车位置：dist(0~200) → 车尾 x。dist 200 → 车尾 120，dist 8 → 车尾 584（墙在 600）
  const carRearX = 120 + (200 - dist) * (464 / 192);
  const carX = carRearX + 2; // 车尾即车左缘
  const inZone = dist >= zone && dist <= zone + 10;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
      <div style={{ width: '100%', maxWidth: 860, display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* 顶部提示 */}
        <div style={{ fontSize: 13, color: 'var(--ink-dim)', textAlign: 'center' }}>
          给 HC-SR04 的 4 个脚 + 蜂鸣器接好线（电源找电源、信号找信号）· RUN 烧录 · 按住「倒车」把车停进车位——用耳朵开
        </div>

        {/* 台面：接线 SVG */}
        <svg ref={svgRef} viewBox="0 0 760 216" className="bench-grid fade-up" style={{
          width: '100%', background: 'var(--bench)', borderRadius: 14,
          border: '1px solid var(--card-edge)', touchAction: 'none', userSelect: 'none',
        }} onMouseLeave={() => setHover(null)}>
          {/* 已接导线 */}
          {wires.map((w, i) => {
            const wrong = isWrong(w.a, w.b);
            return (
              <g key={i} style={{ cursor: 'pointer' }}
                onClick={(e) => {
                  e.stopPropagation();
                  setWires((ws) => ws.filter((_, k) => k !== i));
                  track('wire_remove', 3, { wire: `${w.a}->${w.b}` });
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
          {drag && (
            <line
              x1={PIN_POS[drag.from][0]} y1={PIN_POS[drag.from][1]} x2={drag.x} y2={drag.y}
              stroke="var(--accent)" strokeWidth={2} strokeDasharray="6,5" opacity={0.7}
            />
          )}

          {/* 超声波模块 HC-SR04（Wokwi 风：特征蓝 PCB + 双喇叭同心圆网纹） */}
          <g onMouseEnter={() => setHover(TIPS.sonar)} style={{ cursor: 'help' }}>
            <defs>
              <radialGradient id="sonarCore" cx="0.4" cy="0.35" r="0.9">
                <stop offset="0" stopColor="#b9b9b9" />
                <stop offset="1" stopColor="#777" />
              </radialGradient>
              <pattern patternUnits="userSpaceOnUse" width="2.4" height="2.4" id="sonarMesh">
                <path d="M0 0h1.2v1.2H0zM1.2 1.2h1.2v1.2H1.2z" fill="#555" />
              </pattern>
            </defs>
            {/* PCB */}
            <rect x={20} y={30} width={140} height={118} rx={8} fill="#456f93" stroke="#35597a" strokeWidth={1.5} />
            {/* 四角安装孔 */}
            {[[30, 40], [150, 40], [30, 138], [150, 138]].map(([cx, cy], i) => (
              <circle key={i} cx={cx} cy={cy} r={3.5} fill="var(--bench)" stroke="#2f4d68" strokeWidth={1.5} />
            ))}
            {/* 双喇叭：T(左上) R(左下)——Wokwi 同款四层同心圆 + 网纹 */}
            {[[62, 72], [62, 116]].map(([cx, cy], i) => (
              <g key={i}>
                <circle cx={cx} cy={cy} r={21} fill="#dcdcdc" />
                <circle cx={cx} cy={cy} r={17.5} fill="#222" />
                <circle cx={cx} cy={cy} r={13.5} fill="#777" />
                <circle cx={cx} cy={cy} r={8.8} fill="url(#sonarCore)" />
                <circle cx={cx} cy={cy} r={13.5} fill="url(#sonarMesh)" opacity={0.4} />
              </g>
            ))}
            <text x={62} y={48} textAnchor="middle" fill="#e6e6e6" fontSize={8} fontFamily="Consolas, monospace">T</text>
            <text x={62} y={138} textAnchor="middle" fill="#e6e6e6" fontSize={8} fontFamily="Consolas, monospace">R</text>
            {/* 丝印 */}
            <text x={104} y={68} fill="#e6e6e6" fontSize={11} fontFamily="Consolas, monospace">HC-SR04</text>
            <text x={100} y={92} fill="#cfe3f5" fontSize={8} fontFamily="Consolas, monospace">VCC TRIG</text>
            <text x={100} y={104} fill="#cfe3f5" fontSize={8} fontFamily="Consolas, monospace">ECHO GND</text>
            {/* 晶振 */}
            <rect x={100} y={112} width={26} height={11} rx={2} fill="#878787" stroke="#424242" strokeWidth={0.8} />
            {/* 排针（丝印下方 4 根） */}
            {[0, 1, 2, 3].map((i) => (
              <rect key={i} x={100 + i * 8} y={122} width={1.8} height={9} fill="#ccc" />
            ))}
          </g>
          {/* 超声波引脚（PCB 下缘一排） */}
          <Pin k="u_vcc" label="VCC" dy={20} />
          <Pin k="u_trig" label="Trig" dy={20} />
          <Pin k="u_echo" label="Echo" dy={20} />
          <Pin k="u_gnd" label="GND" dy={20} />

          {/* 主控板：上缘电源排 5V/3V3/GND · 左侧信号 D5/D6 · 右侧 D9 */}
          <g onMouseEnter={() => setHover(TIPS.mcu)} style={{ cursor: 'help' }}>
            <rect x={278} y={40} width={210} height={120} rx={10} fill="#1f6feb" opacity={0.12} stroke="var(--card-edge)" strokeWidth={1.5} />
            <rect x={300} y={62} width={91} height={57} rx={5} fill="#2d333b" stroke="#666" strokeWidth={1} />
            {[0, 1, 2, 3].map((i) => (
              <rect key={i} x={307 + i * 22} y={55} width={6} height={9} fill="#8a929c" />
            ))}
            {[0, 1, 2, 3].map((i) => (
              <rect key={i} x={307 + i * 22} y={117} width={6} height={9} fill="#8a929c" />
            ))}
            <circle cx={366} cy={70} r={4} fill="#666" />
            <text x={311} y={96} fill="#c9d1d9" fontSize={11.5} fontFamily="Consolas, monospace">STM32</text>
            <text x={383} y={152} textAnchor="middle" fill="var(--ink-dim)" fontSize={12}>主控板</text>
            {/* 电源排丝印（引脚上方） */}
            <text x={306} y={14} textAnchor="middle" fill="var(--ink-dim)" fontSize={9} fontFamily="Consolas, monospace">5V</text>
            <text x={338} y={14} textAnchor="middle" fill="var(--ink-dim)" fontSize={9} fontFamily="Consolas, monospace">3V3</text>
            <text x={370} y={14} textAnchor="middle" fill="var(--ink-dim)" fontSize={9} fontFamily="Consolas, monospace">GND</text>
            {/* 信号脚丝印 */}
            <text x={286} y={100} textAnchor="end" fill="var(--ink-dim)" fontSize={9} fontFamily="Consolas, monospace">D5</text>
            <text x={286} y={122} textAnchor="end" fill="var(--ink-dim)" fontSize={9} fontFamily="Consolas, monospace">D6</text>
            <text x={486} y={70} textAnchor="end" fill="var(--ink-dim)" fontSize={9} fontFamily="Consolas, monospace">D9</text>
          </g>
          <Pin k="m_5v" dy={-12} />
          <Pin k="m_3v3" dy={-12} />
          <Pin k="m_gnd" dy={-12} />
          <Pin k="m_d5" />
          <Pin k="m_d6" />
          <Pin k="m_d9" />

          {/* 蜂鸣器 */}
          <g onMouseEnter={() => setHover(TIPS.buzzer)} style={{ cursor: 'help' }}>
            <circle cx={610} cy={72} r={46} fill="var(--card)" stroke="var(--card-edge)" strokeWidth={1.5} />
            <circle cx={610} cy={72} r={29} fill="none" stroke="var(--card-edge)" strokeWidth={1} opacity={0.6} />
            <circle cx={610} cy={72} r={12} fill={beeping ? 'var(--accent)' : '#8a929c'}
              style={{ transition: 'fill 120ms var(--ease-out)' }} />
            <circle cx={610} cy={72} r={4} fill="#1f2933" />
            {beeping && [0, 1, 2].map((i) => (
              <circle key={i} cx={610} cy={72} r={33 + i * 8} fill="none" stroke="var(--accent)"
                strokeWidth={1.5} opacity={0.5 - i * 0.15}
                style={{ animation: `ping 0.9s ${i * 0.3}s infinite` }} />
            ))}
            <text x={610} y={140} textAnchor="middle" fill="var(--ink-dim)" fontSize={12}>
              {beeping ? `蜂鸣中 · ${stage.name}` : '蜂鸣器'}
            </text>
          </g>
          <Pin k="b_sig" />

          {/* GPIO 徽章 */}
          <g>
            <rect x={424} y={88} width={52} height={26} rx={6}
              fill={beeping ? 'var(--live)' : 'var(--bench)'}
              stroke={beeping ? 'var(--live)' : 'var(--card-edge)'} strokeWidth={1}
              style={{ transition: 'fill 120ms var(--ease-out), stroke 120ms var(--ease-out)' }} />
            <text x={450} y={106} textAnchor="middle" fontSize={13} fontWeight={700}
              fill={beeping ? '#111' : 'var(--ink-dim)'} fontFamily="Consolas, monospace"
              style={{ transition: 'fill 120ms var(--ease-out)' }}>
              {beeping ? 'HIGH' : 'LOW'}
            </text>
            <text x={450} y={128} textAnchor="middle" fill="var(--ink-dim)" fontSize={11}>GPIO 9</text>
          </g>

          <style>{`@keyframes ping { 0% { opacity: .6 } 100% { opacity: 0 } }
            @keyframes l3blink { 50% { opacity: 0.2 } }`}</style>
        </svg>

        {/* 悬浮说明栏 */}
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
            <span style={{ color: 'var(--ink-dim)' }}>鼠标移到元件上看介绍——电源脚有 3 个，别接错</span>
          )}
        </div>

        {/* 接线进度 + RUN + 倒车踏板 */}
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          {/* 预置积木链（静态展示） */}
          <div style={{ flex: 1, display: 'flex', gap: 8, alignItems: 'center' }}>
            {CHAIN.map((b, i) => (
              <div key={b.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{
                  background: 'var(--card)', border: '1px solid var(--live)', borderRadius: 8,
                  padding: '8px 10px', fontSize: 12.5, whiteSpace: 'nowrap',
                }}>
                  <span style={{ color: 'var(--accent)', fontSize: 10, marginRight: 6 }}>{b.kind}</span>
                  {b.label}
                </div>
                {i < CHAIN.length - 1 && <span style={{ color: 'var(--live)' }}>→</span>}
              </div>
            ))}
            <PartInfo partKey="buzzer" /><PartInfo partKey="mcu" />
          </div>
          {/* RUN / 倒车踏板 */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              className="btn btn-primary"
              disabled={!wiredOK}
              onClick={() => {
                if (crash || parked || running) {
                  // 重置：清串口、回起点，但不再弹"烧录完成"提示
                  setCrash(false); setDist(200); setParked(false); setAttempts(0);
                  setSerial([]);
                  setRunning(wiredOK);
                } else {
                  setAttempts(0);
                  setRunning(true);
                  dispatch({ type: 'SAY', text: '烧录完成！按住右边「倒车」踏板往后退——松开就刹车', mood: 'think' });
                }
                track('run_press', 3);
              }}
            >
              {running ? '🔄 重置' : '▶ RUN（烧录）'}
            </button>
            <button
              className="btn" style={{
                width: 96, fontWeight: 800, fontSize: 15,
                background: holding ? 'var(--accent)' : 'var(--card)',
                color: holding ? '#1c2128' : 'var(--ink)',
                touchAction: 'none', userSelect: 'none',
              }}
              disabled={!running || crash}
              onPointerDown={(e) => { e.preventDefault(); setHolding(true); }}
              onPointerUp={() => setHolding(false)}
            >
              ◀ 倒车<br />
              <span style={{ fontSize: 10, fontWeight: 400, opacity: 0.65 }}>按住不放（或空格）</span>
            </button>
          </div>
        </div>
        {!wiredOK && (
          <div style={{ fontSize: 12, color: 'var(--danger)', textAlign: 'center' }}>
            接线 {wiredCount}/5 —— VCC、Trig、Echo、GND、蜂鸣器（红虚线点一下拆除）
          </div>
        )}

        {/* 开车区：俯视街道 */}
        <svg ref={driveRef} viewBox="0 0 760 190" className="fade-up" style={{
          width: '100%', background: 'var(--bench)', borderRadius: 14,
          border: '1px solid var(--card-edge)', userSelect: 'none',
        }}>
          {/* 地面车道纹理 */}
          {[40, 95, 150].map((y) => (
            <line key={y} x1={0} y1={y} x2={760} y2={y} stroke="var(--grid-line)" strokeWidth={1} strokeDasharray="14,10" />
          ))}
          {/* 车位框（zone~zone+10cm 区域，挑战中随机换位） */}
          <rect x={120 + (200 - (zone + 10)) * (464 / 192)} y={8} width={10 * (464 / 192)} height={174} rx={6}
            fill={inZone ? 'var(--live)' : 'var(--accent)'} opacity={inZone ? 0.12 : 0.05}
            style={{ transition: 'fill 150ms, opacity 150ms, x 200ms' }} />
          <line x1={120 + (200 - (zone + 10)) * (464 / 192)} y1={8} x2={120 + (200 - (zone + 10)) * (464 / 192)} y2={182}
            stroke="var(--live)" strokeWidth={1.5} strokeDasharray="6,5" opacity={0.5} />
          <line x1={120 + (200 - zone) * (464 / 192)} y1={8} x2={120 + (200 - zone) * (464 / 192)} y2={182}
            stroke="var(--live)" strokeWidth={1.5} strokeDasharray="6,5" opacity={0.5} />
          <text x={120 + (200 - (zone + 5)) * (464 / 192)} y={20} textAnchor="middle" fill="var(--live)" fontSize={10} opacity={0.8}>车位 {zone}~{zone + 10}cm</text>
          {/* 墙 */}
          <rect x={600} y={0} width={16} height={190} fill="var(--card-edge)" />
          <rect x={600} y={0} width={5} height={190} fill="var(--ink-dim)" opacity={0.4} />
          {/* 超声波扇形声波 */}
          {running && holding && !crash && (
            <path d={`M ${carRearX} 95 L ${carRearX + 46} ${95 - 26 - (200 - dist) * 0.05} A 52 52 0 0 1 ${carRearX + 46} ${95 + 26 + (200 - dist) * 0.05} Z`}
              fill="none" stroke="var(--accent)" strokeWidth={1.5} opacity={0.5}
              style={{ animation: 'ping 0.5s infinite' }} />
          )}
          {/* 小车 */}
          <g style={crash ? { animation: 'shake 0.3s 2' } : undefined}>
            <Car x={carX} y={57} />
          </g>
          {/* 距离数字（车与墙之间） */}
          <text x={(carRearX + 600) / 2} y={175} textAnchor="middle"
            fill={stage.on ? 'var(--danger)' : 'var(--live)'} fontSize={15} fontWeight={800} fontFamily="Consolas, monospace">
            {dist} cm
          </text>
          {/* 蜂鸣档位提示 */}
          <text x={20} y={24} fill="var(--ink-dim)" fontSize={11}>
            {stage.on ? `🔊 ${stage.name}` : '🔊 静音（安全）'} · {crash ? '💥 已撞墙' : parked ? '✅ 已入位' : holding ? '倒车中…' : '已刹车'} · 第 {attempts} 次尝试
          </text>
          <style>{`@keyframes shake { 25% { transform: translateX(-4px) } 75% { transform: translateX(4px) } }`}</style>
        </svg>

        {/* 事故报告 */}
        {crash && (
          <div className="fade-up" style={{
            border: '1px solid var(--danger)', borderRadius: 12, padding: '10px 16px',
            background: 'var(--card)', fontSize: 13,
          }}>
            <b style={{ color: 'var(--danger)' }}>💥 事故报告</b>　车尾撞上墙体，保险杠凹陷。
            <span style={{ color: 'var(--ink-dim)' }}>原因：听到长鸣没有立刻松开踏板。点 RUN 重置，再试一次</span>
          </div>
        )}

        {/* 通关行 */}
        {done3 && (
          <div className="fade-up" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 15, fontWeight: 700 }}>
              🏅 通关！<span style={{ color: 'var(--accent)' }}>倒车雷达</span> 已放上作品架
            </div>
            <button
              className="btn btn-primary"
              onClick={() => { track('goto_next', 3, { to: 4 }); dispatch({ type: 'GOTO', page: 4 }); }}
            >
              下一关 →
            </button>
          </div>
        )}

        {/* 知识点行 */}
        {done3 && (
          <div className="fade-up" style={{ fontSize: 13, color: 'var(--ink-dim)', textAlign: 'center' }}>
            本关认识：<b style={{ color: 'var(--ink)' }}>传感器</b> · <b style={{ color: 'var(--ink)' }}>信号</b> · <b style={{ color: 'var(--ink)' }}>电源脚 / 信号脚</b>
          </div>
        )}

        {/* 挑战横幅（通关后）——限时泊车 */}
        {done3 && !challengeOn && !challengeDone && (
          <div className="fade-up" style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
            border: '1px dashed var(--accent)', borderRadius: 12, padding: '10px 16px',
          }}>
            <div style={{ fontSize: 13.5 }}>
              🎯 <b>限时泊车挑战</b>：60 秒内完美入位 2 次，每次成功后车位随机换位置
            </div>
            <button className="btn btn-primary" style={{ whiteSpace: 'nowrap' }}
              onClick={() => {
                setChallengeOn(true); setParkCount(0); setTimeLeft(60); setZone(15);
                setCrash(false); setDist(200); setParked(false);
                if (!running) setRunning(true);
                track('challenge_start', 3);
                dispatch({ type: 'SAY', text: '限时泊车开始！60 秒 2 次——缓慢滴滴放心退，急促点点刹车，长鸣必停', mood: 'think' });
              }}>
              接受挑战
            </button>
          </div>
        )}
        {/* 挑战进行中：计时条 */}
        {challengeOn && !challengeDone && (
          <div className="fade-up" style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
            border: `1px solid ${timeLeft <= 10 ? 'var(--danger)' : 'var(--accent)'}`, borderRadius: 12, padding: '10px 16px',
          }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: timeLeft <= 10 ? 'var(--danger)' : 'var(--ink)' }}>
              ⏱ {timeLeft}s　·　入库 {parkCount}/2　·　第 {attempts} 次尝试
            </div>
            <div style={{ flex: 1, height: 8, borderRadius: 4, background: 'var(--bench)', overflow: 'hidden' }}>
              <div style={{
                height: '100%', width: `${(timeLeft / 60) * 100}%`,
                background: timeLeft <= 10 ? 'var(--danger)' : 'var(--accent)',
                transition: 'width 1s linear',
              }} />
            </div>
            <button className="btn" style={{ whiteSpace: 'nowrap', fontSize: 13 }}
              onClick={() => {
                setChallengeOn(false); setParkCount(0); setZone(15); setParked(false);
                dispatch({ type: 'SAY', text: '挑战退出，随时可以再来', mood: 'think' });
              }}>
              放弃
            </button>
          </div>
        )}
        {/* 挑战完成 */}
        {challengeDone && (
          <div className="fade-up" style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
            border: '1px solid var(--live)', borderRadius: 12, padding: '10px 16px',
            background: 'var(--card)',
          }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--live)' }}>
                ✨ 限时泊车达成！
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--ink-dim)', marginTop: 4 }}>
                用时 {60 - timeLeft}s（剩 {timeLeft}s）· 共 {attempts} 次尝试 · 首次尝试入库率 {attempts ? Math.round((2 / attempts) * 100) : 100}%
                {attempts <= 2 ? ' —— 一次不撞，老司机认证 🚕' : attempts <= 4 ? ' —— 手感不错，稳' : ' —— 撞了几次但没放弃，这就是调试精神'}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn" style={{ whiteSpace: 'nowrap', fontSize: 13 }}
                onClick={() => {
                  setChallengeDone(false); setChallengeOn(true); setParkCount(0);
                  setAttempts(0); setTimeLeft(60); setZone(15);
                  setCrash(false); setDist(200); setParked(false);
                  track('challenge_start', 3, { retry: true });
                }}>
                再来一把
              </button>
              <button className="btn btn-primary" style={{ whiteSpace: 'nowrap' }}
                onClick={() => { track('goto_next', 3, { to: 4 }); dispatch({ type: 'GOTO', page: 4 }); }}>
                下一关 →
              </button>
            </div>
          </div>
        )}
        {parked && !challengeOn && (
          <div className="fade-up" style={{
            fontSize: 14, fontWeight: 700, color: 'var(--live)',
            border: '1px solid var(--live)', borderRadius: 12, padding: '10px 16px', textAlign: 'center',
          }}>
            ✨ 完美入位（{dist}cm，第 {attempts} 次尝试）——耳朵替眼睛干活，这就是传感器存在的意义
          </div>
        )}
      </div>

      {/* CodePeek */}
      <CodePeek
        code={ARDUINO_CODE}
        serial={serial}
        live
        autoOpen={beeping}
        label="🔍 看看这段逻辑对应的真实代码"
      />
    </div>
  );
}
