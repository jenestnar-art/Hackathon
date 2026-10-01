import { useEffect, useRef, useState } from 'react';
import { useGame } from '../store/GameContext.jsx';
import { track } from '../lib/track.js';
import ProjectCard from '../components/ProjectCard.jsx';
import PartInfo from '../components/PartInfo.jsx';
import CodePeek from '../components/CodePeek.jsx';
import { HoverTip } from '../components/PartInfo.jsx';

const ARDUINO_CODE = `// 声控小夜灯 · 真实代码长这样
const int micPin = 2;   // 声音传感器
const int ledPin = 13;  // LED（串着 220Ω 电阻！）

void setup() {
  pinMode(micPin, INPUT);
  pinMode(ledPin, OUTPUT);
  Serial.begin(115200);
}

void loop() {
  if (digitalRead(micPin) == HIGH) {
    digitalWrite(ledPin, HIGH);  // 拍手 → 亮
    Serial.println("clap! LED ON");
    delay(3000);                 // 亮 3 秒
  } else {
    digitalWrite(ledPin, LOW);
  }
}`;

const SERIAL_LINES = [
  'clap! LED ON',
  'clap! LED ON',
  '...',
];

// ---- 第 1 关：声控小夜灯（Wokwi 拟真重制版） ----
// 学：电路 / 正负极 / 电阻。玩法：拖线接通电路 → 拍手亮灯。
// 刻意教学：LED 接反不亮；不接电阻灯会烧。
// 视觉参考：wokwi-elements (MIT) —— led-element.ts 的多层透明罩+发光滤镜、
// resistor 色环、sensor 模块的 PCB+麦克风+排针丝印。

// 引脚定义（坐标即最终位置，渲染在元件本体金属引脚上）
const SOCKETS = [
  { id: 'bat+', label: '电池 +', x: 72, y: 175, wire: 'bat+' },
  { id: 'bat-', label: '电池 −', x: 72, y: 265, wire: 'bat-' },
  { id: 'led+', label: 'LED 正极(A)', x: 330, y: 148, wire: 'led+' },
  { id: 'led-', label: 'LED 负极(C)', x: 330, y: 238, wire: 'led-' },
  { id: 'resA', label: '电阻 1脚', x: 345, y: 352, wire: 'resA' },
  { id: 'resB', label: '电阻 2脚', x: 505, y: 352, wire: 'resB' },
  { id: 'snd+', label: '声控 VCC', x: 625, y: 150, wire: 'snd+' },
  { id: 'snd-', label: '声控 GND', x: 625, y: 250, wire: 'snd-' },
  { id: 'sw1', label: '开关 1', x: 148, y: 410, wire: 'sw1' },
  { id: 'sw2', label: '开关 2', x: 216, y: 410, wire: 'sw2' },
];

const S = Object.fromEntries(SOCKETS.map((s) => [s.id, s]));

// 主回路（缺一不可）：电池+ → 开关 → LED+ → LED− → 电阻 → 电池−
const REQUIRED = [
  ['bat+', 'sw1'],
  ['sw2', 'led+'],
  ['led-', 'resB'],
  ['resA', 'bat-'],
];
// 声音传感器（可选：不接也能手动开关灯，但拍手无效）
const SOUND_WIRES = [['snd+', 'led+'], ['snd-', 'bat-']];

const wireLabel = { 'bat+': '电池+', 'sw1': '开关1', 'sw2': '开关2', 'led+': 'LED正极', 'led-': 'LED负极', 'resB': '电阻2脚', 'resA': '电阻1脚', 'bat-': '电池−' };

// 陷阱配对（用于错误状态标记与红色虚线显示）
const TRAP_REVERSED = ['bat-|led+', 'led+|bat-'];
const TRAP_NORES = ['bat+|led-', 'led-|bat+'];
const isPair = (list, a, b) => list.includes(`${a}|${b}`) || list.includes(`${b}|${a}`);

// 导线颜色：正极红 / 负极黑 / 信号黄
const WIRE_COLOR = {
  'bat+|led+': '#e5484d', 'bat-|led-': '#1a1d21', 'bat-|resA': '#1a1d21',
  'resB|led-': '#d29922', 'snd+|led+': '#d29922', 'snd-|bat-': '#1a1d21',
  'bat-|led+': '#e5484d', 'bat+|led-': '#e5484d',
};
const wireColor = (a, b) =>
  WIRE_COLOR[`${a}|${b}`] || WIRE_COLOR[`${b}|${a}`] || '#93a1b3';

const isTrap = (a, b) => isPair(TRAP_REVERSED, a, b) || isPair(TRAP_NORES, a, b);

// 拨动开关在台面上的位置（本体 + 两个引脚）
const SW = { x: 182, y: 352 };

// SVG 内悬浮介绍卡内容（HoverTip 渲染在台面右上角，不遮挡元件）
const TIPS = {
  battery: { icon: '🔋', name: '电池盒', x: 470, y: 20, lines: ['提供 3.3V 电压，是电路的「水泵」', '正极流出电流，负极收回'] },
  led: { icon: '💡', name: 'LED', x: 60, y: 20, lines: ['发光二极管：电流只能单向走', '必须串电阻限流，否则烧毁'] },
  resistor: { icon: '🚧', name: '电阻 220Ω', x: 60, y: 20, lines: ['电流的「阀门」，限制电流大小', '色环 红-红-棕-金 = 220Ω'] },
  snd: { icon: '👂', name: '声音传感器', x: 60, y: 20, lines: ['驻极体麦克风「听」到响声就输出信号', '楼道声控灯的耳朵'] },
  sw: { icon: '🎚️', name: '拨动开关', x: 60, y: 20, lines: ['电路的「门」：断开就没电流', '合上 = 通电，这就是手动的开关'] },
};

export default function Level1_Lamp() {
  const { state, dispatch } = useGame();
  const [started, setStarted] = useState(false);
  const [wires, setWires] = useState([]);
  const [drag, setDrag] = useState(null);
  const [swOn, setSwOn] = useState(false); // 拨动开关 = 通电
  const [reversed, setReversed] = useState(false);
  const [noResistor, setNoResistor] = useState(false);
  const [burnt, setBurnt] = useState(false);
  const [lit, setLit] = useState(false);
  const [msg, setMsg] = useState('按住元件上的金属引脚，拖到另一个引脚上接线');
  const [hover, setHover] = useState(null); // SVG 内元件悬浮提示
  const [currentT, setCurrentT] = useState(0);
  const svgRef = useRef(null);
  const burnTimerRef = useRef(null); // 烧灯倒计时：及时拆线可取消

  const hasWire = (a, b) =>
    wires.some((w) => (w.a === a && w.b === b) || (w.a === b && w.b === a));

  // 主回路是否接全（不管对错，先看完整性）
  const mainComplete = REQUIRED.every(([a, b]) => hasWire(a, b));

  // 电路通了 = 通电 + 主回路全接对 + 无陷阱
  const circuitOK = swOn && mainComplete && !reversed && !noResistor && !burnt;

  // 陷阱状态从当前导线实时推导；通电且短路 → 1.2 秒后烧灯（断电/拆线可救）
  useEffect(() => {
    const noRes = wires.some((w) => isPair(TRAP_NORES, w.a, w.b));
    setReversed(wires.some((w) => isPair(TRAP_REVERSED, w.a, w.b)));
    setNoResistor(noRes);
    if (swOn && noRes && !burnt && !burnTimerRef.current) {
      burnTimerRef.current = setTimeout(() => {
        burnTimerRef.current = null;
        setBurnt(true);
        setSwOn(false);
        track('led_burn', 1);
        dispatch({ type: 'SAY', text: '💥 灯烧了！没有电阻限流，电流太大。断电拆掉那根红线，让它经过电阻再通电。', mood: 'panic' });
      }, 1200);
    }
    if ((!swOn || !noRes) && burnTimerRef.current) {
      clearTimeout(burnTimerRef.current);
      burnTimerRef.current = null;
    }
  }, [wires, swOn, burnt]);

  // 电流光点动画（电路通+亮灯时流动）
  useEffect(() => {
    if (!lit) return;
    let raf;
    const tick = () => { setCurrentT((t) => (t + 0.012) % 1); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [lit]);

  // 连线完成时刻：提示合上开关（不跳关，用户自己体验）
  const [wireDone, setWireDone] = useState(false);
  useEffect(() => {
    if (!wireDone && mainComplete && !reversed && !noResistor) {
      setWireDone(true);
      setMsg('✓ 主回路接好了！拨动开关通电试试');
      dispatch({ type: 'SAY', text: '线路齐了！现在拨动台面上的开关——合上 = 通电，灯就亮了 🎚️', mood: 'happy' });
    }
    if (!mainComplete || reversed || noResistor) setWireDone(false);
  }, [mainComplete, reversed, noResistor, wireDone]);

  // 通电瞬间的判定（拨开关时触发，四种结果）
  const flipSwitch = () => {
    if (burnt) {
      setSwOn(false);
      dispatch({ type: 'SAY', text: '灯已经烧了，点「重来」重新接，这次让它经过电阻。', mood: 'panic' });
      return;
    }
    if (!swOn) {
      // 要合闸
      if (!mainComplete) {
        track('power_on_fail', 1, { reason: 'incomplete' });
        setMsg('⚠ 电路没接全，电流走不通一圈');
        dispatch({
          type: 'SAY',
          text: `合不上哦——先照顺序接：电池+ → 开关 → LED正极，LED负极 → 电阻 → 电池−。现在缺：${REQUIRED.filter(([a, b]) => !hasWire(a, b)).map(([a, b]) => `${wireLabel[a]}—${wireLabel[b]}`).join('、')}`,
          mood: 'think',
        });
        return; // 拨杆弹回
      }
      setSwOn(true);
      track('power_on', 1);
      if (reversed) {
        setMsg('⚠ 通电了但不亮：LED 接反了');
        dispatch({ type: 'SAY', text: '通电了，灯却不亮？LED 是二极管，电流只能从正极进。断电后点那根红线拆掉换个方向。', mood: 'think' });
        track('power_reverse', 1);
      } else if (noResistor) {
        setMsg('⚠ 短路！快断电或拆线！');
        dispatch({ type: 'SAY', text: '⚠ 短路了！没经过电阻直接连电池——快拨回去断电，或点那根红线拆掉！', mood: 'panic' });
        track('power_short', 1);
      } else {
        setMsg('✓ 通电成功！现在拍手（点台面/空格）开关灯');
        dispatch({ type: 'SAY', text: '咔哒——通电了！现在点击台面任意处或按空格（= 拍手），灯就亮 👏', mood: 'happy' });
      }
    } else {
      // 断电
      setSwOn(false);
      if (burnTimerRef.current) { clearTimeout(burnTimerRef.current); burnTimerRef.current = null; }
      setMsg('已断电，可以放心改线');
      dispatch({ type: 'SAY', text: '断电了，改线安全。改完记得再合上开关。', mood: 'normal' });
    }
  };

  // 拍手 = 切换灯亮/灭（真·声控：亮着再拍一下就灭）
  const clap = () => {
    if (!started || drag) return;
    track('clap_count', 1);
    if (burnt) {
      dispatch({ type: 'SAY', text: '灯已经烧了，断电后点「重来」重新接，这次记得经过电阻！', mood: 'panic' });
      return;
    }
    if (!swOn) {
      dispatch({ type: 'SAY', text: '还没通电呢——先拨动台面上的开关合闸。', mood: 'normal' });
      return;
    }
    if (circuitOK) {
      setLit((v) => {
        const next = !v;
        dispatch({
          type: 'SAY',
          text: next
            ? '👏 亮了！再拍一下试试——灯会灭。楼道声控灯就是这个原理'
            : '灭了！声音就是开关。真实电路里，声音传感器把这个信号送给主控判断',
          mood: next ? 'cheer' : 'normal',
        });
        return next;
      });
      if (!state.done[1]) {
        track('level_complete', 1);
        dispatch({ type: 'COMPLETE_LEVEL', level: 1, device: '声控小夜灯', badge: '接线员' });
      }
    } else if (reversed) {
      dispatch({ type: 'SAY', text: '拍了但没反应？LED 是二极管，电流只能从正极进、负极出——检查接法。', mood: 'think' });
      track('clap_reject', 1, { reason: 'reversed' });
    } else {
      setMsg('电路还没通。照着提示：电池+ → LED正极 → LED负极 → 电阻 → 电池−');
      dispatch({ type: 'SAY', text: '电路还没通哦。先连 电池+ → LED正极 试试？', mood: 'normal' });
    }
  };

  // 断电 = 灯灭（真实：开关断开电流消失）
  useEffect(() => {
    if (!swOn) setLit(false);
  }, [swOn]);

  // 可选：真麦克风听掌声（浏览器授权后，检测音量突增 = 拍手）
  const [micOn, setMicOn] = useState(false);
  const micRef = useRef(null);
  const toggleMic = async () => {
    if (micOn) {
      micRef.current?.stop();
      setMicOn(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      src.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      let armed = true; // 防止一次掌声触发多次
      const tick = () => {
        analyser.getByteTimeDomainData(data);
        let peak = 0;
        for (let i = 0; i < data.length; i++) peak = Math.max(peak, Math.abs(data[i] - 128));
        if (peak > 40 && armed) {  // 音量突增 = 拍手
          armed = false;
          clap();
          setTimeout(() => { armed = true; }, 600); // 600ms 冷却
        }
      };
      const raf = setInterval(tick, 50);
      micRef.current = { stop: () => { clearInterval(raf); stream.getTracks().forEach((t) => t.stop()); ctx.close(); } };
      setMicOn(true);
      dispatch({ type: 'SAY', text: '麦克风已开启！现在对着电脑拍手/跺脚，灯真的会响应你的声音 🎤', mood: 'happy' });
    } catch {
      dispatch({ type: 'SAY', text: '麦克风没授权也没关系——点台面/按空格就是拍手。', mood: 'normal' });
    }
  };
  useEffect(() => () => micRef.current?.stop(), []); // 离开关页时关麦克风
  useEffect(() => () => { if (burnTimerRef.current) clearTimeout(burnTimerRef.current); }, []); // 离页取消烧灯

  useEffect(() => {
    const onKey = (e) => {
      if (e.code === 'Space') { e.preventDefault(); clap(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const startDrag = (id) => (e) => {
    e.preventDefault();
    e.stopPropagation();
    const move = (ev) => {
      const r = svgRef.current.getBoundingClientRect();
      setDrag({ from: id, x: ev.clientX - r.left, y: ev.clientY - r.top });
    };
    const up = (ev) => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      setDrag(null);
      const r = svgRef.current.getBoundingClientRect();
      const px = ev.clientX - r.left, py = ev.clientY - r.top;
      const to = SOCKETS.find((s) => Math.hypot(s.x - px, s.y - py) < 25);
      if (!to || to.id === id) return;
      if (swOn) {
        // 带电不能改线（真实安全规则）：断电后再改
        track('reject', 1, { reason: 'powered' });
        setMsg('⚠ 通电中不能改线！先拨回开关断电');
        dispatch({ type: 'SAY', text: '带电接线很危险的！先把开关拨回去断电，再改线。', mood: 'panic' });
        return;
      }
      if (hasWire(id, to.id)) return;
      // 任意两脚都能连（真实接线自由度），对错由电路检查反馈
      setWires((w) => [...w, { a: id, b: to.id }]);
      track('connect', 1, { from: id, to: to.id });

      const key1 = `${id}|${to.id}`, key2 = `${to.id}|${id}`;
      const kReversed = TRAP_REVERSED.includes(key1) || TRAP_REVERSED.includes(key2);
      const kNoRes = TRAP_NORES.includes(key1) || TRAP_NORES.includes(key2);
      if (kReversed) {
        setMsg('⚠ LED 接反了：电流只能单向走（点这根红线拆掉）');
        dispatch({ type: 'SAY', text: '咦？LED 是二极管，正负极反了可点不亮。点那根红导线拆掉，把 LED 负极改接到电阻上。', mood: 'think' });
        return;
      }
      if (kNoRes) {
        setMsg('⚠ 没经过电阻直连……（通电后会烧灯，点这根红线拆掉！）');
        dispatch({ type: 'SAY', text: '直接接上了？电阻是保护 LED 的阀门——这根线通电就会烧灯！快点它拆掉，或换到电阻上。', mood: 'panic' });
        return;
      }
      setMsg('✓ 接上了一根！继续');
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const removeWire = (i) => {
    setWires((w) => w.filter((_, k) => k !== i));
    track('wire_remove', 1);
    setMsg('拆掉一根。重新接，注意经过电阻！');
  };

  const reset = () => {
    if (burnTimerRef.current) { clearTimeout(burnTimerRef.current); burnTimerRef.current = null; }
    setWires([]); setReversed(false); setNoResistor(false); setBurnt(false); setLit(false); setWireDone(false); setSwOn(false);
    setMsg('重新来，这次记得先经过电阻！');
    dispatch({ type: 'SAY', text: '重来一次，电阻别忘了。', mood: 'normal' });
  };

  if (!started) {
    return (
      <ProjectCard
        level={1} title="声控小夜灯" icon="🪔" difficulty={1} minutes={3}
        parts={[
          { key: 'battery', icon: '🔋', name: '电池', count: 1 },
          { key: 'switch', icon: '🎚️', name: '拨动开关', count: 1 },
          { key: 'soundSensor', icon: '👂', name: '声音传感器', count: 1 },
          { key: 'led', icon: '💡', name: 'LED', count: 1 },
          { key: 'resistor', icon: '🚧', name: '电阻', count: 1 },
        ]}
        goal="拖动导线把电路接通（电池 → 开关 → LED → 电阻 → 电池），然后拨动开关通电，拍手（点击台面/按空格）控制灯亮灭。"
        onStart={() => { setStarted(true); track('level_start', 1); }}
      />
    );
  }

  const pathOf = (a, b) => {
    const p1 = S[a], p2 = S[b];
    const mid = (p1.x + p2.x) / 2;
    return `M${p1.x},${p1.y} C${mid},${p1.y} ${mid},${p2.y} ${p2.x},${p2.y}`;
  };

  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ color: 'var(--ink-dim)', fontSize: 14, marginBottom: 6 }}>
        按住元件<b style={{ color: 'var(--accent)' }}>金属引脚</b>拖到另一个引脚接线 · 点导线可拆除 · 接好后<b style={{ color: 'var(--accent)' }}>拨动开关</b>通电，再拍手
        <button className="btn" style={{ marginLeft: 12, fontSize: 12, padding: '3px 10px' }} onClick={reset}>重来</button>
      </div>
      <div style={{ fontSize: 13.5, marginBottom: 8, color: burnt ? 'var(--danger)' : 'var(--ink)' }}>{msg}</div>

      {/* 真麦克风开关（可选增强）：授权后拍手/跺脚真的控制灯 */}
      <button
        className="btn"
        style={{ fontSize: 12, padding: '3px 12px', marginBottom: 8, borderColor: micOn ? 'var(--live)' : undefined, color: micOn ? 'var(--live)' : undefined }}
        onClick={(e) => { e.stopPropagation(); toggleMic(); }}
      >
        {micOn ? '🎤 麦克风监听中（点此关闭）' : '🎤 用真声音控制（可选）'}
      </button>

      <svg
        ref={svgRef}
        onClick={clap}
        width={760} height={430} viewBox="0 0 760 430"
        style={{ background: 'var(--bench)', borderRadius: 14, border: '1px solid var(--card-edge)', cursor: 'pointer', userSelect: 'none', touchAction: 'none' }}
      >
        <defs>
          {/* LED 发光：wokwi led-element 同款高斯模糊滤镜 */}
          <filter id="ledGlow" x="-120%" y="-120%" width="340%" height="340%">
            <feGaussianBlur stdDeviation="9" />
          </filter>
          <filter id="ledGlowBig" x="-200%" y="-200%" width="500%" height="500%">
            <feGaussianBlur stdDeviation="18" />
          </filter>
          {/* 台面金属质感渐变 */}
          <linearGradient id="metal" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#d8dee6" />
            <stop offset="0.5" stopColor="#9aa5b1" />
            <stop offset="1" stopColor="#6b7684" />
          </linearGradient>
          <linearGradient id="ledDome" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#ffffff" stopOpacity="0.85" />
            <stop offset="0.35" stopColor="#ff8080" stopOpacity="0.55" />
            <stop offset="1" stopColor="#e02020" stopOpacity="0.75" />
          </linearGradient>
        </defs>

        {/* ── 导线（点击拆除）── */}
        {wires.map((w, i) => {
          const trap = isTrap(w.a, w.b);
          return (
            <g key={i} onClick={(e) => { e.stopPropagation(); removeWire(i); }} style={{ cursor: 'pointer' }}>
              <path d={pathOf(w.a, w.b)} stroke="#000" strokeOpacity={0.35} strokeWidth={8} fill="none" strokeLinecap="round" />
              <path
                d={pathOf(w.a, w.b)}
                stroke={trap ? 'var(--danger)' : wireColor(w.a, w.b)}
                strokeWidth={4.5} fill="none" strokeLinecap="round"
                strokeDasharray={trap ? '9,6' : undefined}
              />
              {trap && (
                <text
                  x={(S[w.a].x + S[w.b].x) / 2} y={(S[w.a].y + S[w.b].y) / 2 - 10}
                  textAnchor="middle" fontSize={13}
                >⚠️</text>
              )}
            </g>
          );
        })}
        {drag && (
          <line
            x1={S[drag.from].x} y1={S[drag.from].y} x2={drag.x} y2={drag.y}
            stroke="#93a1b3" strokeWidth={2.5} strokeDasharray="6,5"
          />
        )}

        {/* ── 电池盒（拟真：黑色盒体+弹簧+引出线）── */}
        <g
          onMouseEnter={() => setHover(TIPS.battery)} onMouseLeave={() => setHover(null)}
          style={{ cursor: 'help' }}
        >
          <rect x={20} y={130} width={104} height={180} rx={8} fill="var(--card)" stroke={hover?.name === '电池盒' ? 'var(--accent)' : '#0c0e11'} strokeWidth={2} />
          <rect x={26} y={136} width={92} height={168} rx={6} fill="none" stroke="#3a424c" strokeWidth={1.5} />
          <text x={72} y={155} textAnchor="middle" fill="var(--ink)" fontSize={13} fontWeight="700">电池盒</text>
          <text x={72} y={170} textAnchor="middle" fill="var(--ink-dim)" fontSize={10}>2 × AA · 3.3V</text>
          {/* 内部电池 */}
          <rect x={38} y={186} width={68} height={30} rx={3} fill="#c0392b" />
          <rect x={38} y={222} width={68} height={30} rx={3} fill="#b8c2cc" />
          <circle cx={102} cy={201} r={3} fill="#7a2018" />
          {/* 正负极金属弹片 */}
          <rect x={60} y={168} width={24} height={7} rx={2} fill="url(#metal)" />
          <rect x={60} y={258} width={24} height={7} rx={2} fill="url(#metal)" />
        </g>

        {/* ── LED（wokwi 多层透明罩 + 发光滤镜）── */}
        <g onMouseEnter={() => setHover(TIPS.led)} onMouseLeave={() => setHover(null)} style={{ cursor: 'help' }}>
          {/* 长引脚(+) 左，短引脚(-) 右 */}
          <rect x={286} y={148} width={44} height={5} rx={2} fill="url(#metal)" />
          <rect x={286} y={235} width={44} height={4} rx={2} fill="url(#metal)" />
          {/* 发光层（最先渲染，在灯罩底下） */}
          {lit && !burnt && (
            <>
              <circle cx={330} cy={192} r={42} fill="#ff5252" opacity={0.5} filter="url(#ledGlowBig)" />
              <circle cx={330} cy={192} r={24} fill="#ffb3b3" opacity={0.75} filter="url(#ledGlow)" />
            </>
          )}
          {/* 灯罩主体：水滴形多层透明 */}
          <path
            d="M330 148 C314 158 306 172 306 190 C306 212 316 226 330 226 C344 226 354 212 354 190 C354 172 346 158 330 148 Z"
            fill="#e02020" opacity={burnt ? 0.25 : 0.35}
          />
          <path
            d="M330 148 C314 158 306 172 306 190 C306 212 316 226 330 226 C344 226 354 212 354 190 C354 172 346 158 330 148 Z"
            fill={burnt ? '#3a3a3a' : '#e02020'} opacity={burnt ? 0.5 : 0.55}
          />
          <path
            d="M330 190 L330 226 C344 226 354 212 354 190 Z"
            fill="#a01414" opacity={burnt ? 0.5 : 0.7}
          />
          {/* 内部芯片支架（wokwi 的 #666666 polygon） */}
          <path d="M324 214 L327 214 L327 200 L333 200 L338 193 L327 193 L324 195 Z" fill="#666" />
          <path d="M336 194 L332 200 L336 200 L336 214 L339 214 L339 193 L336 191 Z" fill="#666" />
          {/* 高光 */}
          {!burnt && <path d="M320 160 C316 166 314 172 314 178" stroke="#fff" strokeWidth={3} strokeLinecap="round" opacity={0.6} fill="none" />}
          {burnt && <text x={330} y={198} textAnchor="middle" fontSize={16}>💀</text>}
        </g>

        {/* ── 拨动开关（拟真：底座 + 可拨杆，点击 = 合闸/断电）── */}
        <g
          onClick={(e) => { e.stopPropagation(); flipSwitch(); }}
          onMouseEnter={() => setHover(TIPS.sw)} onMouseLeave={() => setHover(null)}
          style={{ cursor: 'pointer' }}
        >
          <rect x={128} y={326} width={108} height={58} rx={8} fill="var(--card)" stroke={hover?.name === '拨动开关' ? 'var(--accent)' : '#0c0e11'} strokeWidth={2} />
          <text x={182} y={343} textAnchor="middle" fill="var(--ink)" fontSize={11.5} fontWeight="700">电源开关</text>
          {/* 滑槽 */}
          <rect x={162} y={352} width={40} height={16} rx={8} fill="#23282e" stroke="#3a424c" strokeWidth={1} />
          {/* 拨杆：合闸时滑向右侧并变绿（CSS transition，可中断） */}
          <circle
            cx={swOn ? 192 : 172} cy={360} r={7}
            fill={swOn ? '#4ade80' : '#8a929c'} stroke={swOn ? '#22c55e' : '#5a626c'} strokeWidth={2}
            style={{ transition: 'cx 120ms var(--ease-out), fill 120ms, stroke 120ms' }}
          />
          <text x={236} y={364} fill={swOn ? 'var(--live)' : 'var(--ink-dim)'} fontSize={10} fontWeight={swOn ? 700 : 400}>
            {swOn ? 'ON' : 'OFF'}
          </text>
        </g>

        {/* ── 电阻（米色本体 + 四道色环 红-红-棕-金）── */}
        <g onMouseEnter={() => setHover(TIPS.resistor)} onMouseLeave={() => setHover(null)} style={{ cursor: 'help' }}>
          <rect x={280} y={349} width={65} height={5} rx={2} fill="url(#metal)" />
          <rect x={505} y={349} width={65} height={5} rx={2} fill="url(#metal)" />
          <rect x={345} y={337} width={160} height={28} rx={13} fill="#d9c9a3" stroke="#b3a37f" strokeWidth={1.5} />
          {/* 色环：220Ω = 红 红 棕 + 金 */}
          <rect x={368} y={337} width={7} height={28} fill="#c0392b" />
          <rect x={384} y={337} width={7} height={28} fill="#c0392b" />
          <rect x={400} y={337} width={7} height={28} fill="#8a5a2b" />
          <rect x={470} y={337} width={7} height={28} fill="#d4af37" />
          <text x={445} y={355} textAnchor="middle" fill="#5a4a2b" fontSize={11} fontWeight="700">220Ω</text>
        </g>

        {/* ── 声音传感器模块（蓝色 PCB + 驻极体麦克风 + 排针丝印）── */}
        <g onMouseEnter={() => setHover(TIPS.snd)} onMouseLeave={() => setHover(null)} style={{ cursor: 'help' }}>
          <rect x={565} y={110} width={120} height={200} rx={6} fill="#1a4f8a" stroke="#0d2c50" strokeWidth={2} />
          {/* PCB 四角螺丝孔 */}
          {[[578, 122], [672, 122], [578, 298], [672, 298]].map(([cx, cy], i) => (
            <circle key={i} cx={cx} cy={cy} r={4.5} fill="#0d2c50" stroke="#c9a227" strokeWidth={1.2} />
          ))}
          <text x={625} y={130} textAnchor="middle" fill="#cfe3ff" fontSize={11} fontWeight="700">SOUND SENSOR</text>
          {/* 驻极体麦克风：金属圆筒 */}
          <circle cx={625} cy={185} r={26} fill="#8a929c" stroke="#5a626c" strokeWidth={2} />
          <circle cx={625} cy={185} r={20} fill="#b8c0ca" />
          <circle cx={625} cy={185} r={13} fill="#5a626c" />
          <circle cx={625} cy={185} r={9} fill="#23282e" />
          {/* 灵敏度电位器 */}
          <rect x={600} y={222} width={50} height={18} rx={3} fill="#3a424c" />
          <circle cx={625} cy={231} r={5} fill="#c9a227" />
          <text x={625} y={252} textAnchor="middle" fill="#cfe3ff" fontSize={8.5}>LM393 比较器</text>
        </g>

        {/* ── 引脚（金属质感，渲染在元件之上可直接拖）── */}
        {SOCKETS.map((s) => {
          const pos = !s.label.includes('−') && !s.label.includes('负') && !s.label.includes('GND');
          return (
            <g key={s.id} onPointerDown={startDrag(s.id)} style={{ cursor: 'crosshair' }}>
              <circle cx={s.x} cy={s.y} r={16} fill="transparent" />
              {/* 引脚本体：小金属矩形 */}
              <rect x={s.x - 4} y={s.y - 10} width={8} height={20} rx={2} fill="url(#metal)" stroke="#4a5460" strokeWidth={1} />
              {/* 接线帽状态圈 */}
              <circle cx={s.x} cy={s.y} r={7} fill="none"
                stroke={pos ? '#e5484d' : '#3b82f6'} strokeWidth={2.5} />
              <text x={s.x} y={s.y - 15} textAnchor="middle" fill="var(--ink-dim)" fontSize={10}>{s.label}</text>
            </g>
          );
        })}

        {/* ── 电流光点（电路通+亮灯时沿主回路流动）── */}
        {lit && REQUIRED.map(([a, b], i) => {
          const p1 = S[a], p2 = S[b];
          const t = (currentT + i / REQUIRED.length) % 1;
          const mx = p1.x + (p2.x - p1.x) * t;
          const my = p1.y + (p2.y - p1.y) * t + Math.sin(t * Math.PI) * 12;
          return <circle key={i} cx={mx} cy={my} r={3.5} fill="#ffe082" opacity={0.9} filter="url(#ledGlow)" />;
        })}

        {/* ── 悬浮介绍卡（台面内渲染，不遮挡元件）── */}
        <HoverTip tip={hover} />

        {/* ── 声波纹（拍手反馈）── */}
        <text x={380} y={400} textAnchor="middle" fill="var(--ink-dim)" fontSize={12}>
          👏 点击台面任意处 / 按空格 = 拍手
        </text>
      </svg>

      {/* 通关态：台面下方常驻「下一关」按钮（浮入入场，不弹窗、不遮挡台面） */}
      {lit && !burnt && (
        <div
          className="fade-up"
          style={{
            marginTop: 12, display: 'flex', alignItems: 'center', gap: 14,
          }}
        >
          <span style={{ fontSize: 14, color: 'var(--live)', fontWeight: 700 }}>
            🎉 声控小夜灯完成！楼道声控灯就是这个原理——嵌入式 = 让电路听懂世界
          </span>
          <button
            className="btn btn-primary"
            style={{ fontSize: 15 }}
            onClick={() => {
              track('goto_next', 1, { to: 2 });
              dispatch({ type: 'GOTO', page: 2 });
            }}
          >
            下一关 →
          </button>
        </div>
      )}

      <div style={{ marginTop: 10, fontSize: 13, color: 'var(--ink-dim)' }}>
        知识点：电路 · 正负极 · 电阻
        <PartInfo partKey="battery" /><PartInfo partKey="led" /><PartInfo partKey="resistor" /><PartInfo partKey="soundSensor" />
      </div>

      <CodePeek code={ARDUINO_CODE} serial={lit ? SERIAL_LINES : []} autoOpen={lit && !burnt} label="🔍 看看这段电路对应的真实代码" />
    </div>
  );
}
