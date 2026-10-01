// 第 7 关「阶段总结」：不再出新玩法，而是收束整个闯关——
// 用一张 51 vs STM32 的 Wokwi 风格对比图告诉新生「嵌入式到底学什么」，
// 再把 7 关映射到真实知识体系，最后给出三条可执行的下一步路线
import { useEffect, useRef, useState } from 'react';
import { useGame } from '../store/GameContext.jsx';
import { track } from '../lib/track.js';
import ProjectCard from '../components/ProjectCard.jsx';

// ── 闯关 → 真实知识体系映射 ──
const MAP = [
  { lv: 1, icon: '🪔', name: '声控小夜灯', topic: 'GPIO 与电路基础', next: '上拉/下拉电阻、推挽/开漏输出' },
  { lv: 2, icon: '🌀', name: '迷你温控风扇', topic: '传感器采集 + 条件逻辑', next: 'ADC 模拟量采集、滤波' },
  { lv: 3, icon: '📡', name: '倒车雷达', topic: '测距与事件响应', next: '外部中断、定时器捕获' },
  { lv: 4, icon: '⏰', name: '电子时钟', topic: '代码结构与时序', next: '寄存器、HAL 库、模块化编程' },
  { lv: 5, icon: '🚙', name: '遥控小车', topic: '设备间通信', next: 'UART / I2C / SPI 协议细节' },
  { lv: 6, icon: '🦾', name: '示教机械臂', topic: '执行器精确控制', next: 'PWM、舵机、PID 调参' },
  { lv: 7, icon: '🎓', name: '阶段总结', topic: '把元件组合成系统', next: '真硬件 + 真项目' },
];

const NEXT_CARDS = [
  {
    icon: '🔩', title: '打地基：51 单片机',
    body: '便宜（开发板十几块钱）、资料多、结构简单，适合第一次摸真板子。先把点灯、按键、数码管玩熟，理解「代码怎么控制硬件」。',
    tags: ['十几块钱', '资料最多', '理解底层'],
  },
  {
    icon: '📡', title: '玩联网：ESP32',
    body: '自带 WiFi 和蓝牙，几十块钱就能做出能联网的设备——远程控制宿舍灯、手机看温度。想玩物联网、智能家居，从它入门最快。',
    tags: ['自带 WiFi', '物联网首选', '几十块钱'],
  },
  {
    icon: '🚀', title: '上主流：STM32',
    body: '企业项目里用得最多。功能强、教程全，学完能做智能小车、环境监测这些真项目，也是嵌入式岗位招聘里的高频词。',
    tags: ['行业主流', '生态全', '好就业'],
  },
  {
    icon: '🛠️', title: '做出来：找个真问题解决',
    body: '前面 6 关你已经会看电路、拼逻辑、接线了——挑一个宿舍里的烦心事（忘关灯？太热？），用一块开发板把它解决掉。做过一个真项目，比看十节课都管用。',
    tags: ['学以致用', '简历素材', '最有成就感'],
  },
];

export default function Level7_Invent() {
  const { state, dispatch } = useGame();
  const [started, setStarted] = useState(false);
  const doneRef = useRef(false);

  // 进入本页即通关（总结页不设玩法门槛）
  useEffect(() => {
    if (!started || doneRef.current) return;
    doneRef.current = true;
    track('level_start', 7);
    if (!state.done[7]) {
      track('level_complete', 7);
      dispatch({ type: 'COMPLETE_LEVEL', level: 7, device: '阶段总结', badge: '入门者' });
    }
    dispatch({
      type: 'SAY',
      text: '7 关走完了！你现在的位置是「刚入门」——这只是嵌入式的起点，后面还有真板子、真代码、真项目等着你。地图已经给你画好了，慢慢走，别停 🔥',
      mood: 'cheer',
    });
  }, [started]);

  if (!started) {
    return (
      <ProjectCard
        level={7} title="阶段总结" icon="🎓" difficulty={0} minutes={3}
        parts={[{ key: 'mcu', icon: '🎓', name: '知识地图 + 路线图', count: '' }]}
        goal="不考新东西——把 7 关学到的元件和积木串成一张地图，看看嵌入式到底要学什么，下一步往哪走。"
        onStart={() => setStarted(true)}
      />
    );
  }

  const done7 = !!state.done[7];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
      <div style={{ width: '100%', maxWidth: 760, display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* ── ① 51 vs ESP32 vs STM32 对比板（Wokwi 风格 SVG）── */}
        <svg viewBox="0 0 760 280" className="bench-grid fade-up" style={{
          width: '100%', background: 'var(--bench)', borderRadius: 14,
          border: '1px solid var(--card-edge)', userSelect: 'none',
        }}>
          <defs>
            <linearGradient id="g51pcb" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#2e7d4f" />
              <stop offset="1" stopColor="#1d5c38" />
            </linearGradient>
            <linearGradient id="g32pcb" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#1f6feb" />
              <stop offset="1" stopColor="#154a9e" />
            </linearGradient>
            <linearGradient id="gesppcb" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#2b2f36" />
              <stop offset="1" stopColor="#191c21" />
            </linearGradient>
            <linearGradient id="gdip" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#3a4048" />
              <stop offset="1" stopColor="#22262c" />
            </linearGradient>
            <linearGradient id="gcan" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#c8cfd8" />
              <stop offset="0.5" stopColor="#9aa3ad" />
              <stop offset="1" stopColor="#6b747e" />
            </linearGradient>
            <linearGradient id="gos" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#d8dee6" />
              <stop offset="1" stopColor="#8a929c" />
            </linearGradient>
          </defs>

          {/* ══ 左：51 单片机（绿色 PCB + DIP-40 黑芯片 + 晶振）══ */}
          <g>
            <rect x={20} y={36} width={220} height={190} rx={10} fill="url(#g51pcb)" stroke="#124026" strokeWidth={2.5} />
            {[[34, 50], [226, 50], [34, 212], [226, 212]].map(([cx, cy], i) => (
              <circle key={i} cx={cx} cy={cy} r={4} fill="#124026" stroke="#c9a227" strokeWidth={1.2} />
            ))}
            <text x={130} y={58} textAnchor="middle" fill="#d8f3e0" fontSize={10.5} fontWeight={700} fontFamily="Consolas, monospace">AT89C52 · 8051</text>

            {/* DIP 黑色长芯片 */}
            <rect x={52} y={92} width={156} height={70} rx={4} fill="url(#gdip)" stroke="#111" strokeWidth={1} />
            {Array.from({ length: 8 }).map((_, i) => (
              <rect key={`l${i}`} x={44} y={98 + i * 8} width={9} height={4} rx={1} fill="url(#gos)" />
            ))}
            {Array.from({ length: 8 }).map((_, i) => (
              <rect key={`r${i}`} x={207} y={98 + i * 8} width={9} height={4} rx={1} fill="url(#gos)" />
            ))}
            <circle cx={64} cy={127} r={4} fill="#111" />
            <text x={130} y={124} textAnchor="middle" fill="#c9d1d9" fontSize={10.5} fontFamily="Consolas, monospace">AT89C52</text>
            <text x={130} y={140} textAnchor="middle" fill="#9aa5b1" fontSize={8.5} fontFamily="Consolas, monospace">24PC · 2019</text>

            {/* 金色晶振圆柱 */}
            <rect x={72} y={176} width={40} height={12} rx={6} fill="#c9a227" stroke="#8a6d1a" strokeWidth={1} />
            <text x={92} y={202} textAnchor="middle" fill="#bfe3cc" fontSize={7.5} fontFamily="Consolas, monospace">11.0592MHz</text>
            <text x={196} y={98} fill="#bfe3cc" fontSize={7.5} fontFamily="Consolas, monospace">P1</text>
            <text x={50} y={88} fill="#bfe3cc" fontSize={7.5} fontFamily="Consolas, monospace">P0</text>
          </g>

          {/* 51 → ESP32 箭头 */}
          <path d="M244 131 l10 -6 v12 Z" fill="var(--accent)" />

          {/* ══ 中：ESP32（黑色 PCB + 金属屏蔽罩 + 天线）══ */}
          <g>
            <rect x={268} y={36} width={224} height={190} rx={10} fill="url(#gesppcb)" stroke="#0c0e11" strokeWidth={2.5} />
            {[[282, 50], [478, 50], [282, 212], [478, 212]].map(([cx, cy], i) => (
              <circle key={i} cx={cx} cy={cy} r={4} fill="#0c0e11" stroke="#c9a227" strokeWidth={1.2} />
            ))}
            <text x={380} y={58} textAnchor="middle" fill="#e0e6ee" fontSize={10.5} fontWeight={700} fontFamily="Consolas, monospace">ESP32-WROOM · WIFI+BT</text>

            {/* 顶部天线区（波浪走线） */}
            <path d="M282 70 h196 M282 76 h196" stroke="#3a4048" strokeWidth={2} fill="none" />
            {/* 金属屏蔽罩（模组核心） */}
            <rect x={312} y={88} width={136} height={62} rx={5} fill="url(#gcan)" stroke="#5a626c" strokeWidth={1.5} />
            <text x={380} y={124} textAnchor="middle" fill="#3a4048" fontSize={10.5} fontWeight={700} fontFamily="Consolas, monospace">ESP32</text>
            {/* 屏蔽罩旁小元件 */}
            <rect x={286} y={100} width={18} height={12} rx={2} fill="#8a6d1a" />
            <rect x={456} y={100} width={18} height={12} rx={2} fill="#5a3232" />

            {/* USB 口 + 两个按钮 + 排针 */}
            <rect x={362} y={166} width={36} height={22} rx={3} fill="#c0c7cf" stroke="#7a828c" strokeWidth={1.5} />
            <rect x={367} y={171} width={26} height={12} rx={2} fill="#2d333b" />
            <text x={380} y={200} textAnchor="middle" fill="#bfe3cc" fontSize={7.5} fontFamily="Consolas, monospace">USB</text>
            <rect x={296} y={168} width={20} height={14} rx={2.5} fill="#3a4048" stroke="#555" strokeWidth={1} />
            <rect x={444} y={168} width={20} height={14} rx={2.5} fill="#3a4048" stroke="#555" strokeWidth={1} />
            <text x={306} y={196} textAnchor="middle" fill="#bfe3cc" fontSize={7} fontFamily="Consolas, monospace">EN</text>
            <text x={454} y={196} textAnchor="middle" fill="#bfe3cc" fontSize={7} fontFamily="Consolas, monospace">BOOT</text>
            {/* 两侧排针 */}
            {Array.from({ length: 7 }).map((_, i) => (
              <g key={`el${i}`}>
                <rect x={276} y={92 + i * 14} width={8} height={9} rx={1.5} fill="#3a4048" />
                <circle cx={280} cy={96.5 + i * 14} r={2.2} fill="#8a929c" />
              </g>
            ))}
            {Array.from({ length: 7 }).map((_, i) => (
              <g key={`er${i}`}>
                <rect x={476} y={92 + i * 14} width={8} height={9} rx={1.5} fill="#3a4048" />
                <circle cx={480} cy={96.5 + i * 14} r={2.2} fill="#8a929c" />
              </g>
            ))}
          </g>

          {/* ESP32 → STM32 箭头 */}
          <path d="M496 131 l10 -6 v12 Z" fill="var(--accent)" />

          {/* ══ 右：STM32（蓝色 PCB）══ */}
          <g>
            <rect x={520} y={36} width={220} height={190} rx={10} fill="url(#g32pcb)" stroke="#0d2c50" strokeWidth={2.5} />
            {[[534, 50], [726, 50], [534, 212], [726, 212]].map(([cx, cy], i) => (
              <circle key={i} cx={cx} cy={cy} r={4} fill="#0d2c50" stroke="#c9a227" strokeWidth={1.2} />
            ))}
            <text x={630} y={58} textAnchor="middle" fill="#cfe3ff" fontSize={10.5} fontWeight={700} fontFamily="Consolas, monospace">STM32F103 · M3</text>

            {/* LQFP 方形芯片（四边引脚） */}
            <rect x={596} y={92} width={70} height={70} rx={5} fill="#2d333b" stroke="#666" strokeWidth={1} />
            {[0, 1, 2, 3, 4].map((i) => (
              <rect key={`lw${i}`} x={588} y={98 + i * 14} width={8} height={5.5} fill="url(#gos)" />
            ))}
            {[0, 1, 2, 3, 4].map((i) => (
              <rect key={`rw${i}`} x={666} y={98 + i * 14} width={8} height={5.5} fill="url(#gos)" />
            ))}
            {[0, 1, 2, 3].map((i) => (
              <rect key={`uw${i}`} x={604 + i * 14} y={84} width={5.5} height={8} fill="url(#gos)" />
            ))}
            {[0, 1, 2, 3].map((i) => (
              <rect key={`dw${i}`} x={604 + i * 14} y={162} width={5.5} height={8} fill="url(#gos)" />
            ))}
            <circle cx={656} cy={102} r={3} fill="#666" />
            <text x={631} y={130} textAnchor="middle" fill="#c9d1d9" fontSize={9.5} fontFamily="Consolas, monospace">STM32</text>
            <text x={631} y={143} textAnchor="middle" fill="#9aa5b1" fontSize={7.5} fontFamily="Consolas, monospace">F103C8T6</text>

            {/* USB 口 + 晶振 */}
            <rect x={534} y={96} width={30} height={24} rx={3} fill="#c0c7cf" stroke="#7a828c" strokeWidth={1.5} />
            <rect x={538} y={101} width={22} height={13} rx={2} fill="#2d333b" />
            <text x={549} y={132} textAnchor="middle" fill="#bfe3cc" fontSize={7} fontFamily="Consolas, monospace">USB</text>
            <rect x={544} y={166} width={26} height={10} rx={5} fill="#c9a227" stroke="#8a6d1a" strokeWidth={1} />
            <text x={557} y={188} textAnchor="middle" fill="#bfe3cc" fontSize={7} fontFamily="Consolas, monospace">8MHz</text>
            {/* 右侧排针 */}
            {Array.from({ length: 7 }).map((_, i) => (
              <g key={i}>
                <rect x={710} y={96 + i * 14} width={8} height={9} rx={1.5} fill="#0d2c50" />
                <circle cx={714} cy={100.5 + i * 14} r={2.2} fill="#8a929c" />
              </g>
            ))}
            <text x={686} y={210} fill="#bfe3cc" fontSize={7.5} fontFamily="Consolas, monospace">GPIO</text>
          </g>

          {/* 底部标注 */}
          <text x={130} y={252} textAnchor="middle" fill="var(--ink-dim)" fontSize={11}>入门经典 · 十几块钱 · 学底层</text>
          <text x={380} y={252} textAnchor="middle" fill="var(--ink-dim)" fontSize={11}>物联网明星 · 自带 WiFi 蓝牙 · 好玩</text>
          <text x={630} y={252} textAnchor="middle" fill="var(--ink-dim)" fontSize={11}>行业主流 · 做真项目 · 好就业</text>
          <text x={380} y={272} textAnchor="middle" fill="var(--accent)" fontSize={11}>
            7 关游戏教会你「思路」，真本事要从这些板子上长出来
          </text>
        </svg>

        {/* ── ② 知识地图：7 关 → 真实知识体系 ── */}
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8, color: 'var(--ink)' }}>
            🗺️ 你这 7 关学到的，对应这些真本事
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {MAP.map((m) => {
              const done = !!state.done[m.lv];
              return (
                <div key={m.lv} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  background: 'var(--card)', border: `1px solid ${done ? 'var(--live)' : 'var(--card-edge)'}`,
                  borderRadius: 10, padding: '8px 12px', fontSize: 13,
                  opacity: done ? 1 : 0.45,
                }}>
                  <span style={{ fontSize: 17 }}>{done ? m.icon : '🔒'}</span>
                  <span style={{ minWidth: 108, color: 'var(--ink-dim)' }}>{m.name}</span>
                  <span style={{ color: 'var(--live)', fontSize: 12 }}>→</span>
                  <b style={{ minWidth: 150 }}>{m.topic}</b>
                  <span style={{ color: 'var(--ink-dim)', fontSize: 12, marginLeft: 'auto', textAlign: 'right' }}>
                    进阶：{m.next}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── ③ 接下来学什么：三张卡片 ── */}
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8, color: 'var(--ink)' }}>
            🧭 接下来学什么？
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
            {NEXT_CARDS.map((c) => (
              <div key={c.title} style={{
                background: 'var(--card)', border: '1px solid var(--card-edge)', borderRadius: 12,
                padding: '14px 14px', textAlign: 'left',
              }}>
                <div style={{ fontSize: 24, marginBottom: 6 }}>{c.icon}</div>
                <div style={{ fontWeight: 700, fontSize: 13.5, marginBottom: 6 }}>{c.title}</div>
                <div style={{ fontSize: 12.5, color: 'var(--ink-dim)', lineHeight: 1.65 }}>{c.body}</div>
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 8 }}>
                  {c.tags.map((t) => (
                    <span key={t} style={{
                      fontSize: 10.5, color: 'var(--accent)', border: '1px solid var(--accent)',
                      borderRadius: 99, padding: '1px 8px', opacity: 0.85,
                    }}>{t}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 通关行 */}
        {done7 && (
          <div className="fade-up" style={{ fontSize: 13, color: 'var(--ink-dim)', textAlign: 'center', paddingBottom: 20 }}>
            🧭 7 关走完，徽章墙集齐 —— 去「作品架」看看你的 7 件作品和探索卡
            <button className="btn btn-primary" style={{ marginLeft: 12 }}
              onClick={() => { track('goto_next', 7, { to: 8 }); dispatch({ type: 'GOTO', page: 8 }); }}>
              看我的作品架 →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
