// 第 6 关「示教机械臂」：拖动末端示教 → 记录姿势 → 循环回放 → 速度甩飞支线 → 通关一问
// 视觉：Wokwi 风（金属灰关节 + 深色臂段 + 橙色轴心）；架构：{state, render} 解耦（playground 验证过的模式）
// 知识层：执行器、运动控制、示教再现；关节角度 LIVE 徽章 + 执行日志面板
import { useEffect, useRef, useState } from 'react';
import { useGame } from '../store/GameContext.jsx';
import { track } from '../lib/track.js';
import ProjectCard from '../components/ProjectCard.jsx';
import PartInfo from '../components/PartInfo.jsx';

// ── 几何常量 ─────────────────────────────────
const BASE = { x: 180, y: 330 };           // 底座（侧视）
const L = [125, 98, 72];                   // 三段臂长（总长 295，目标点必须在可达半径内）
const BLOCK_HOME = { x: 330, y: 330 };     // 积木堆（抓取台）
const BOX = { x: 430, y: 336, w: 64, h: 30 }; // 目标盒
const PICK_ZONE = { x: 330, y: 288 };      // 抓取点上方（记录此处 = 抓起）
const DROP_ZONE = { x: 462, y: 300 };      // 盒子上方（记录此处 = 放下）
const SPEED_MIN = 0.012, SPEED_MAX = 0.09; // 循环插值速度范围（超过阈值会甩飞）
const FLING_AT = 0.075;                    // 甩飞阈值：速度过快 + 持有方块 + 到达放下点
// 舵机行程极限（限位，度）：真实舵机转不到行程外的角度，强转就是堵转
const LIMITS = [150, 120, 120];            // 每关节 ±极限（度）

const DEG = (r) => Math.round((r * 180) / Math.PI);

function fk(angles) {
  let x = BASE.x, y = BASE.y, a = -Math.PI / 2;   // 初始竖直向上
  const pts = [{ x, y }];
  for (let i = 0; i < 3; i++) {
    a += angles[i];
    x += L[i] * Math.cos(a);
    y += L[i] * Math.sin(a);
    pts.push({ x, y });
  }
  return pts;
}

// 角度跟随 IK：末端被拖向目标 → 每关节朝目标旋转一点（demo 级，无逆解）
function follow(angles, target, step = 0.16) {
  const next = [...angles];
  for (let i = 0; i < 3; i++) {
    const pts = fk(next);
    const end = pts[3], j = pts[i + 1];
    let want = Math.atan2(target.y - j.y, target.x - j.x) - Math.atan2(end.y - j.y, end.x - j.x);
    while (want > Math.PI) want -= 2 * Math.PI;
    while (want < -Math.PI) want += 2 * Math.PI;
    next[i] += want * step;
  }
  return next;
}

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

export default function Level6_Arm() {
  const { state, dispatch } = useGame();
  const [started, setStarted] = useState(false);
  const [angles, setAngles] = useState([-0.15, 0.55, 0.65]);
  const [dragTarget, setDragTarget] = useState(null);
  const [poses, setPoses] = useState([]);            // [{angles, gripper}]
  const [looping, setLooping] = useState(false);
  const [speed, setSpeed] = useState(0.03);          // 插值速度（滑块）
  const [holding, setHolding] = useState(false);     // 夹爪持有方块
  const [blockPos, setBlockPos] = useState(BLOCK_HOME); // 方块位置（被夹住时跟末端）
  const [flung, setFlung] = useState(false);         // 甩飞演出
  const [log, setLog] = useState([]);
  const [quizOpen, setQuizOpen] = useState(false);
  const [manualOk, setManualOk] = useState(false);   // 示教模式手动放入盒（只提示一次）
  const [quizPick, setQuizPick] = useState(null);
  const [servoInfo, setServoInfo] = useState(null);   // 点舵机盒 → 器件说明气泡
  const [servoHover, setServoHover] = useState(null); // 悬浮高亮
  const svgRef = useRef(null);
  const loopFrame = useRef(0);
  const holdRef = useRef(false);
  holdRef.current = holding;

  const pts = fk(angles);
  const end = pts[3];
  const WRIST_DEG = (angles[0] + angles[1] + angles[2]) * 180 / Math.PI;   // 末端切线方向（夹爪朝向）
  const addLog = (l) => setLog((arr) => [...arr.slice(-5), l]);
  const [warned, setWarned] = useState([false, false, false]);   // 每关节只报一次限位警告

  // 限位 clamp（纯函数，滑块/拖动/回放共用）
  const clampJoint = (a, i) => {
    const lim = (LIMITS[i] * Math.PI) / 180;
    return Math.abs(a) > lim ? Math.sign(a) * lim : a;
  };

  // ── 手动调角度（滑块允许推过行程，撞线即 clamp + 警告）──
  const driveJoint = (i, deg) => {
    setAngles((a) => a.map((v, k) => (k === i ? clampJoint((deg * Math.PI) / 180, i) : v)));
  };

  // 限位警告：角度贴住极限即触发（一次撞线提示一次，退回行程内后重置）
  useEffect(() => {
    angles.forEach((a, i) => {
      const lim = LIMITS[i];
      const deg = Math.abs((a * 180) / Math.PI);
      if (deg >= lim - 0.5 && !warned[i]) {
        setWarned((w) => w.map((v, k) => (k === i ? true : v)));
        addLog(`⚠ θ${i + 1} 撞到行程极限 ±${lim}°——强转就堵转了`);
        dispatch({
          type: 'SAY',
          text: `θ${i + 1} 到头了！舵机内部齿轮和电位器只允许它转 ±${lim}°，这个范围叫行程极限（限位）。程序里写超了它会死顶在那里堵转、发热甚至烧电机——所以代码一定要 clamp 住`,
          mood: 'panic',
        });
        track('limit_warn', 6, { joint: i, deg: Math.round(deg) });
      } else if (deg < lim - 2 && warned[i]) {
        setWarned((w) => w.map((v, k) => (k === i ? false : v)));
      }
    });
  }, [angles]);

  // ── 拖动示教 ───────────────────────────────
  useEffect(() => {
    if (!dragTarget || looping) return;
    let raf;
    const tick = () => {
      setAngles((a) => follow(a, dragTarget).map((v, i) => clampJoint(v, i)));   // 拖动同样 clamp 到限位
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [dragTarget, looping]);

  // 方块跟随夹爪（示教/回放通用）
  useEffect(() => {
    if (holding) setBlockPos({ x: end.x, y: end.y + 8 });
  }, [end.x, end.y, holding]);

  // 自动抓取：仅回放中爪经过方块时夹住（示教时以 CLAW 按钮为准）
  useEffect(() => {
    if (!looping || holding || flung) return;
    if (dist(end, blockPos) < 20) {
      setHolding(true);
      addLog('🦾 夹爪闭合——抓到方块');
      track('claw_grab', 6);
    }
  }, [end.x, end.y, holding, looping, flung, blockPos]);

  // 松爪：方块落到台面（重力）
  const dropBlock = () => {
    setHolding(false);
    setBlockPos({ x: Math.min(Math.max(end.x, 20), 600), y: 348 });
    addLog('🦾 夹爪张开——方块落下');
  };

  // ── 循环回放：姿势间插值 ─────────────────────
  useEffect(() => {
    if (!looping || poses.length < 2) return;
    let raf;
    const tick = () => {
      loopFrame.current += speed;
      const t = loopFrame.current;
      const i = Math.floor(t) % poses.length;
      const f = t - Math.floor(t);
      const from = poses[i], to = poses[(i + 1) % poses.length];
      setAngles(from.angles.map((a, k) => a + (to.angles[k] - a) * f));
      // 夹爪状态跟随"离开的姿势"
      if (f < 0.5) setHolding(from.gripper);
      else setHolding(to.gripper);
      // 甩飞判定：高速 + 到达放下点附近 + 持有方块
      const endNow = fk(from.angles.map((a, k) => a + (to.angles[k] - a) * f))[3];
      if (speed > FLING_AT && holdRef.current && dist(endNow, DROP_ZONE) < 30 && !flung) {
        setFlung(true);
        setHolding(false);
        setLooping(false);
        setBlockPos({ x: endNow.x + 90, y: endNow.y - 60 });   // 方块飞出去
        track('crash_event', 6, { speed });
        addLog('✗ 速度过快——方块被甩飞了（惯性）');
        dispatch({ type: 'SAY', text: '甩飞了！高速运动要考虑惯性——工程师会调运动参数，慢一点、稳一点', mood: 'panic' });
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [looping, poses, speed, flung]);

  // ── 方块入盒判定：示教模式手动放入也给反馈，循环回放入盒才通关 ──
  useEffect(() => {
    if (quizOpen || holding || flung) return;
    const inBox = dist(blockPos, { x: BOX.x + BOX.w / 2, y: BOX.y + BOX.h / 2 }) < 40;
    if (!inBox) { setManualOk(false); return; }
    if (looping) {
      setLooping(false);
      setQuizOpen(true);
      addLog('✓ 方块入盒——任务完成');
    } else if (!manualOk) {
      setManualOk(true);
      addLog('✓ 方块放进目标盒了——手放成功！');
      dispatch({ type: 'SAY', text: '手放对了！但这只是"手动挡"。把这套动作记录成姿势，再 ▶ 循环运行，让机械臂自己完成——那才叫示教再现', mood: 'think' });
    }
  }, [blockPos, holding, looping, flung, quizOpen, manualOk]);

  const toSvg = (e) => {
    const r = svgRef.current.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * 620, y: ((e.clientY - r.top) / r.height) * 370 };
  };

  // ── 记录姿势：夹爪开合自动判定 ────────────────
  const record = () => {
    const nearPick = dist(end, PICK_ZONE) < 34;
    const nearDrop = dist(end, DROP_ZONE) < 34;
    const gripper = nearPick ? true : nearDrop ? false : holding;
    setPoses((p) => [...p, { angles: [...angles], gripper }]);
    setHolding(gripper);
    track('teach_pose', 6, { n: poses.length + 1, at: nearPick ? 'pick' : nearDrop ? 'drop' : 'mid' });
    addLog(`📍 记录姿势 ${poses.length + 1}：[${angles.map(DEG).join('°, ')}°]${gripper ? ' + 夹紧' : ''}`);
    const n = poses.length + 1;
    dispatch({
      type: 'SAY',
      text: nearPick
        ? `姿势 ${n} 已记录（这里是抓取点，夹爪会自动夹紧）——再去盒子上方记一个放下的姿势`
        : nearDrop
          ? `姿势 ${n} 已记录（放下的位置，夹爪会自动松开）——记够 2 个就能 ▶ 循环运行了`
          : `姿势 ${n} 已记录！提示：在积木上方或盒子上方记录，夹爪会自动开合`,
      mood: 'happy',
    });
  };

  const startLoop = () => {
    setLooping(true);
    loopFrame.current = 0;
    // 方块复位：回放必须从抓取台重新抓起，不能蹭上一次手动放进盒里的残留位置
    if (dist(blockPos, BLOCK_HOME) >= 2) {
      setBlockPos(BLOCK_HOME);
      setHolding(false);
      addLog('↺ 方块复位到抓取台——回放从抓取开始');
    }
    track('loop_play', 6, { poses: poses.length, speed });
    addLog('▶ 循环回放开始——控制器逐帧执行记录的姿势');
    dispatch({ type: 'SAY', text: '开工！看日志——每个关节的角度都在被逐帧控制，这就是运动控制', mood: 'think' });
  };

  const finish = () => {
    track('level_complete', 6);
    track('quiz_answer', 6, { correct: true });
    dispatch({ type: 'COMPLETE_LEVEL', level: 6, device: '示教机械臂', badge: '工程师' });
    dispatch({ type: 'SAY', text: '你的小工厂开工了！工厂里 80% 的机械臂就这么教：拖一遍、记下来、重复做 🦾', mood: 'cheer' });
    setQuizOpen(false);
  };

  if (!started) {
    return (
      <ProjectCard
        level={6} title="示教机械臂" icon="🦾" difficulty={3} minutes={4}
        parts={[
          { key: 'mcu', icon: '🧠', name: '主控板', count: 1 },
          { icon: '⚙️', name: '舵机', count: 3 },
        ]}
        goal="像工人带徒弟：直接拖机械臂末端比划姿势 → 在积木上方和盒子上方各记录一个姿势 → 循环运行，看它自己抓取入盒。"
        onStart={() => { setStarted(true); track('level_start', 6); }}
      />
    );
  }

  // ── 关节数值徽章（playground LIVE 风格）──
  const jointBadge = (i, x, y) => (
    <g>
      <rect x={x} y={y} width="58" height="16" rx="4" fill="#0a0e14" opacity="0.85" />
      <text x={x + 6} y={y + 11.5} fontSize="9" fontFamily="Consolas, monospace" fill="#4ade80">
        θ{i + 1} {String(DEG(angles[i])).padStart(4)}°
      </text>
    </g>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'flex-start', width: '100%', maxWidth: 1220, margin: '0 auto' }}>
      <div style={{ fontSize: 13.5, color: 'var(--ink-dim)' }}>
        ① 拖动末端 🎯 到 <b style={{ color: 'var(--accent)' }}>积木上方</b> → 📍记录 → 拖到 <b style={{ color: 'var(--accent)' }}>盒子（虚线框）上方</b> → 📍记录（记 2~3 个姿势）→ ② ▶ 循环运行
      </div>

      <div style={{ display: 'flex', gap: 18, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        {/* ── 左：机械臂舞台 ── */}
        <svg
          ref={svgRef}
          width={620} height={370} viewBox="0 0 620 370"
          className="bench-grid"
          style={{ background: 'var(--bench)', borderRadius: 14, border: '1px solid var(--card-edge)', touchAction: 'none', userSelect: 'none' }}
          onPointerMove={(e) => dragTarget && !looping && setDragTarget(toSvg(e))}
          onPointerUp={() => setDragTarget(null)}
          onPointerLeave={() => setDragTarget(null)}
        >
          {/* 工作台面 */}
          <rect x="0" y="356" width="620" height="14" fill="var(--card)" stroke="var(--card-edge)" />
          {/* 抓取台（积木堆底座） */}
          <rect x={BLOCK_HOME.x - 30} y={BLOCK_HOME.y - 4} width="60" height="18" rx="3" fill="#3a4656" stroke="#27303d" />
          <text x={BLOCK_HOME.x} y={BLOCK_HOME.y + 26} textAnchor="middle" fontSize="9.5" fill="var(--ink-dim)">抓取台</text>
          {/* 目标盒（虚线）：位于台面上的放置区 */}
          <rect x={BOX.x} y={BOX.y} width={BOX.w} height={BOX.h} rx="3" fill="var(--card)" stroke="var(--accent)" strokeWidth="1.5" strokeDasharray="5 4" />
          <text x={BOX.x + BOX.w / 2} y={BOX.y + BOX.h + 14} textAnchor="middle" fontSize="9.5" fill="var(--ink-dim)">目标盒（放这儿）</text>
          {/* 抓取/放置提示圈（拖动时显示） */}
          {dragTarget && !holding && dist(end, PICK_ZONE) < 34 && (
            <circle cx={PICK_ZONE.x} cy={PICK_ZONE.y} r="26" fill="none" stroke="var(--live)" strokeWidth="1.5" strokeDasharray="3 3" />
          )}
          {dragTarget && holding && dist(end, DROP_ZONE) < 34 && (
            <circle cx={DROP_ZONE.x} cy={DROP_ZONE.y} r="26" fill="none" stroke="var(--live)" strokeWidth="1.5" strokeDasharray="3 3" />
          )}

          {/* 地面阴影（随臂姿态伸缩，伪 3D 落地感） */}
          {(() => {
            const spread = Math.abs(end.x - BASE.x) + Math.abs(end.y - BASE.y) * 0.3;
            return <ellipse cx={BASE.x + (end.x - BASE.x) * 0.35} cy="354" rx={44 + spread * 0.22} ry="7" fill="#000" opacity="0.18" />;
          })()}

          <defs>
            <linearGradient id="armTube" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#2c3644" />
              <stop offset="45%" stopColor="#46536a" />
              <stop offset="100%" stopColor="#28313e" />
            </linearGradient>
            <radialGradient id="jointDisc" cx="0.35" cy="0.3" r="1">
              <stop offset="0%" stopColor="#6b7a8f" />
              <stop offset="70%" stopColor="#414d5e" />
              <stop offset="100%" stopColor="#2c3542" />
            </radialGradient>
          </defs>

          {/* 机械臂（参照 playground genkiarm：Base→yao→jian→wan→zhua）——金属管臂段 */}
          {pts.slice(0, 3).map((p, i) => (
            <line key={i} x1={p.x} y1={p.y} x2={pts[i + 1].x} y2={pts[i + 1].y}
              stroke="url(#armTube)" strokeWidth={15 - i * 3} strokeLinecap="round" />
          ))}
          {pts.slice(0, 3).map((p, i) => (
            <line key={`h${i}`} x1={p.x} y1={p.y} x2={pts[i + 1].x} y2={pts[i + 1].y}
              stroke="#7d8ca0" strokeWidth={1.5} strokeLinecap="round" opacity="0.5"
              transform={`translate(${-2 + i}, ${-2.5 - i * 0.5})`} />
          ))}

          {/* 关节：金属圆盘 + 橙轴 + 舵机机身盒（点击看说明） */}
          {pts.slice(0, 3).map((p, i) => {
            const nxt = pts[i + 1];
            const mid = { x: (p.x + nxt.x) / 2, y: (p.y + nxt.y) / 2 };
            const ang = (Math.atan2(nxt.y - p.y, nxt.x - p.x) * 180) / Math.PI;
            const side = mid.x >= BASE.x ? 1 : -1;   // 盒子挂在臂段外侧
            return (
              <g key={`j${i}`}>
                <circle cx={p.x} cy={p.y} r={10 - i} fill="url(#jointDisc)" stroke="#27303d" strokeWidth="2" />
                <circle cx={p.x} cy={p.y} r={3.5 - i * 0.5} fill="#e6b83c" />
                {/* 舵机机身盒：贴着关节、随臂段旋转；hover 高亮 + 提示，点击看说明 */}
                <g transform={`translate(${mid.x + side * 10}, ${mid.y}) rotate(${ang})`}
                  style={{ cursor: 'pointer' }}
                  onMouseEnter={() => setServoHover(i)}
                  onMouseLeave={() => setServoHover((h) => (h === i ? null : h))}
                  onClick={() => { setServoInfo(i); track('servo_info', 6, { joint: i }); }}>
                  <title>{`舵机 ${i + 1} · 点击查看说明`}</title>
                  <rect x="-7" y="-9" width="14" height="18" rx="2.5"
                    fill={servoHover === i ? '#3d5a7a' : '#2d3a4a'}
                    stroke={servoHover === i ? 'var(--accent)' : '#1e2833'} strokeWidth={servoHover === i ? 1.6 : 1.2} />
                  <line x1="-4" y1="-9" x2="-4" y2="9" stroke="#1e2833" strokeWidth="0.8" />
                  <line x1="0" y1="-9" x2="0" y2="9" stroke="#1e2833" strokeWidth="0.8" />
                  <line x1="4" y1="-9" x2="4" y2="9" stroke="#1e2833" strokeWidth="0.8" />
                  <circle cx="0" cy="-11" r="3" fill={servoHover === i ? 'var(--accent)' : '#4d5a6b'} stroke="#27303d" strokeWidth="1" />
                  {servoHover === i && (
                    <text x="0" y="-18" textAnchor="middle" fontSize="9" fontWeight="700"
                      fill="var(--accent)" style={{ pointerEvents: 'none' }}>⚙ 舵机{i + 1}</text>
                  )}
                </g>
              </g>
            );
          })}
          {/* 底座：梯形座 + 旋转转盘（θ1 刻度） */}
          <path d={`M ${BASE.x - 30} 356 L ${BASE.x - 19} ${BASE.y - 7} L ${BASE.x + 19} ${BASE.y - 7} L ${BASE.x + 30} 356 Z`}
            fill="url(#armTube)" stroke="#27303d" strokeWidth="1.5" />
          <ellipse cx={BASE.x} cy={BASE.y} rx="16" ry="9" fill="url(#jointDisc)" stroke="#27303d" strokeWidth="2" />
          <g transform={`rotate(${DEG(angles[0])} ${BASE.x} ${BASE.y})`}>
            <line x1={BASE.x - 12} y1={BASE.y} x2={BASE.x + 12} y2={BASE.y} stroke="#e6b83c" strokeWidth="1.5" />
            <circle cx={BASE.x} cy={BASE.y} r="4" fill="#e6b83c" stroke="#27303d" strokeWidth="1" />
          </g>

          {/* 腕 + 夹爪 zhua（参照 playground：掌板 + 两指绕掌轴开合），手指沿臂方向伸出 */}
          <g transform={`translate(${end.x}, ${end.y}) rotate(${WRIST_DEG - 180})`}>
            {/* 腕段 */}
            <rect x="-4" y="-14" width="8" height="16" rx="3" fill="#3a4656" stroke="#27303d" strokeWidth="1.2" />
            {/* 掌板 */}
            <rect x="-9" y="0" width="18" height="7" rx="2" fill="#4d5a6b" stroke="#27303d" strokeWidth="1.2" />
            {/* 左指（绕掌轴旋转开合） */}
            <g transform={`rotate(${holding ? 0 : -26} 0 7)`}>
              <rect x="-8" y="7" width="4.5" height="14" rx="1.5" fill="#8a929c" stroke="#27303d" strokeWidth="1.2" />
              <rect x="-8" y="19.5" width="4.5" height="3" rx="1" fill="#e6b83c" />
            </g>
            {/* 右指 */}
            <g transform={`rotate(${holding ? 0 : 26} 0 7)`}>
              <rect x="3.5" y="7" width="4.5" height="14" rx="1.5" fill="#8a929c" stroke="#27303d" strokeWidth="1.2" />
              <rect x="3.5" y="19.5" width="4.5" height="3" rx="1" fill="#e6b83c" />
            </g>
            {/* 驱动楔（爪根部的舵机轴细节） */}
            <circle cx="0" cy="7" r="2.4" fill="#e6b83c" stroke="#27303d" strokeWidth="0.8" />
          </g>

          {/* 方块（被夹住时跟随，甩飞后飞出） */}
          {(!holding || dist(blockPos, end) < 30) && !(flung && blockPos === BLOCK_HOME) && (
            <rect
              x={blockPos.x - 8} y={blockPos.y - 8} width="16" height="16" rx="2"
              fill="#e6b83c" stroke="#b8922e" strokeWidth="1.5"
              style={{ transition: flung ? 'x 600ms, y 600ms' : 'none' }}
            />
          )}
          {!holding && !flung && dist(blockPos, BLOCK_HOME) < 2 && (
            <text x={BLOCK_HOME.x} y={BLOCK_HOME.y - 14} textAnchor="middle" fontSize="9" fill="var(--ink-dim)">▢ 待抓取</text>
          )}

          {/* 末端拖点 */}
          {!looping && (
            <circle
              cx={end.x} cy={end.y} r="11" fill="var(--accent)" opacity="0.85"
              style={{ cursor: 'grab', transition: 'r 120ms' }}
              onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); setDragTarget(toSvg(e)); track('teach_start', 6); }}
            />
          )}
          {!looping && <text x={end.x + 14} y={end.y - 10} fontSize="12" style={{ pointerEvents: 'none' }}>🎯</text>}

          {/* 已记录姿势的末端位置标记 */}
          {poses.map((p, i) => {
            const e2 = fk(p.angles)[3];
            return (
              <g key={i}>
                <circle cx={e2.x} cy={e2.y} r="5" fill="none" stroke="var(--live)" strokeWidth="1.5" />
                <text x={e2.x} y={e2.y - 9} textAnchor="middle" fontSize="8" fill="var(--live)" fontFamily="Consolas, monospace">{i + 1}</text>
              </g>
            );
          })}

          {/* 关节角度 LIVE 徽章（playground 风） */}
          {jointBadge(0, 8, 10)}
          {jointBadge(1, 8, 30)}
          {jointBadge(2, 8, 50)}
          <rect x="8" y="70" width="58" height="16" rx="4" fill="#0a0e14" opacity="0.85" />
          <text x="14" y="81.5" fontSize="9" fontFamily="Consolas, monospace" fill={holding ? '#4ade80' : '#8a929c'}>
            {holding ? 'CLAW 关' : 'CLAW 开'}
          </text>

          {/* 甩飞警示 */}
          {flung && (
            <text x="270" y="60" fontSize="13" fill="var(--danger)" fontWeight="700">⚠ 方块被甩飞！</text>
          )}
        </svg>

        {/* ── 右：控制台 + 日志 ── */}
        <div style={{ width: 290, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{
            background: 'var(--card)', border: '1px solid var(--card-edge)', borderRadius: 14, padding: '14px 16px',
          }}>
            <div style={{ fontSize: 12, color: 'var(--ink-dim)', marginBottom: 10 }}>示教控制台</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn" disabled={looping} onClick={record}>
                📍 记录姿势（{poses.length}）
              </button>
              {looping ? (
                <button className="btn btn-primary" onClick={() => { setLooping(false); addLog('⏹ 已停止'); }}>⏹ 停止</button>
              ) : (
                <button className="btn btn-primary" disabled={poses.length < 2} onClick={startLoop}>▶ 循环运行</button>
              )}
            </div>
            {/* 关节角度手动滑块（限位 = 舵机行程极限） */}
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 11, color: 'var(--ink-dim)', marginBottom: 6 }}>手动调关节（撞头 = 限位）</div>
              {angles.map((a, i) => {
                const deg = Math.round(DEG(a));
                const lim = LIMITS[i];
                const atLimit = Math.abs(deg) >= lim - 1;
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 11, fontFamily: 'Consolas, monospace', width: 28, color: atLimit ? 'var(--danger)' : 'var(--ink)' }}>
                      θ{i + 1}
                    </span>
                    <input type="range" min={-lim} max={lim} step="1" value={deg} disabled={looping}
                      onChange={(e) => driveJoint(i, +e.target.value)}
                      style={{ flex: 1, accentColor: atLimit ? 'var(--danger)' : 'var(--accent)' }} />
                    <span style={{ fontSize: 11, fontFamily: 'Consolas, monospace', width: 56, textAlign: 'right', color: atLimit ? 'var(--danger)' : 'var(--ink-dim)' }}>
                      {atLimit ? '⚠限位 ' : ''}{deg}°
                    </span>
                  </div>
                );
              })}
            </div>
            {/* 夹爪手动开关：点了就抓/放，靠近方块才抓得到 */}
            <button className="btn" disabled={looping} style={{ width: '100%', marginTop: 12 }}
              onClick={() => {
                if (holding) { dropBlock(); track('claw_toggle', 6, { holding: false }); }
                else if (dist(end, blockPos) < 34) {
                  setHolding(true);
                  addLog('🦾 夹爪闭合——抓到方块');
                  track('claw_toggle', 6, { holding: true, got: true });
                } else {
                  addLog('🦾 夹爪闭合——但爪下没有方块');
                  dispatch({ type: 'SAY', text: '爪是合上了，可爪下没东西——先把末端移到积木上方再点夹紧', mood: 'think' });
                  track('claw_toggle', 6, { holding: true, got: false });
                }
              }}>
              {holding ? '🦾 CLAW：关（点它松爪）' : '🦾 CLAW：开（点它夹紧）'}
            </button>
            {/* 速度滑块 */}
            <div style={{ marginTop: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--ink-dim)', marginBottom: 4 }}>
                <span>🐢 慢</span><span>回放速度</span><span style={{ color: speed > FLING_AT ? 'var(--danger)' : undefined }}>快 🐇</span>
              </div>
              <input type="range" min={SPEED_MIN} max={SPEED_MAX} step="0.002" value={speed}
                onChange={(e) => { setSpeed(+e.target.value); track('speed_adjust', 6, { speed: +e.target.value }); }}
                style={{ width: '100%', accentColor: 'var(--accent)' }} />
            </div>
            {/* 姿势列表 */}
            {poses.length > 0 && (
              <div style={{ marginTop: 10, fontSize: 11, fontFamily: 'Consolas, monospace', color: 'var(--ink-dim)', lineHeight: 1.8 }}>
                {poses.map((p, i) => (
                  <div key={i}>姿势{i + 1}: θ={p.angles.map(DEG).join('°/')}°{p.gripper ? ' �_CLAW' : ''}</div>
                ))}
              </div>
            )}
            {flung && (
              <button className="btn" style={{ width: '100%', marginTop: 10 }}
                onClick={() => { setFlung(false); setBlockPos(BLOCK_HOME); setHolding(false); }}>
                ↩ 把方块捡回来
              </button>
            )}
          </div>

          {/* 执行日志（与示教控制台同宽，排在其下） */}
          <div style={{
            background: '#0a0e14', borderRadius: 14, border: '1px solid var(--card-edge)',
            padding: '10px 12px', fontFamily: 'ui-monospace, Consolas, monospace', fontSize: 11.5, lineHeight: 1.9,
            minHeight: 130,
          }}>
            <div style={{ color: '#3a4656', fontSize: 10.5, marginBottom: 4 }}>关节控制器日志 · 逐帧执行</div>
            {log.length === 0 && <div style={{ color: '#3a4656' }}>— 暂无 —</div>}
            {log.map((l, i) => (
              <div key={i} style={{
                color: l.startsWith('✓') ? '#4ade80' : l.startsWith('✗') ? '#f87171' : l.startsWith('⚠') ? '#f87171' : l.startsWith('📍') ? '#ffc857' : '#8a929c',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>{l}</div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ fontSize: 13, color: 'var(--ink-dim)' }}>
        知识点：执行器 · 运动控制 · 示教再现
        <PartInfo partKey="motor" /><PartInfo partKey="mcu" />
      </div>

      {/* 舵机说明气泡（点击臂上舵机盒弹出） */}
      {servoInfo !== null && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 90, background: 'rgba(0,0,0,.25)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }} onClick={() => setServoInfo(null)}>
          <div style={{
            background: 'var(--card)', border: '1px solid var(--accent)', borderRadius: 14,
            padding: '20px 24px', maxWidth: 380, boxShadow: 'var(--shadow)',
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 10 }}>
              ⚙️ 舵机 MG996R · 关节 {servoInfo + 1}/3
            </div>
            <div style={{ fontSize: 13.5, lineHeight: 1.8, color: 'var(--ink)' }}>
              {[
                '底座关节（θ1）：让整条臂水平旋转。舵机 = 电机 + 减速齿轮 + 角度传感器——你说转到 90° 它就停在 90°，不像普通马达通电狂转。',
                '肩关节（θ2）：抬起/放下大臂。舵机内部有个电位器实时汇报"我现在几度"，主控才能精确指挥——这叫闭环控制。',
                '肘关节（θ3）：伸出/收回小臂。3 个关节 = 3 个自由度（3-DOF）；真实工业臂 6 轴就是 6 个舵机，手腕还能任意转向。',
              ][servoInfo]}
            </div>
            <div style={{ fontSize: 12, color: 'var(--ink-dim)', marginTop: 10 }}>
              行程 ±{LIMITS[servoInfo]}°（限位）· 撞头强转 = 堵转发热
            </div>
            <button className="btn" style={{ marginTop: 12 }} onClick={() => setServoInfo(null)}>知道了</button>
          </div>
        </div>
      )}

      {/* ── 通关一问 ── */}
      {quizOpen && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 100,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            background: 'var(--card)', border: '1px solid var(--accent)', borderRadius: 16,
            padding: '28px 32px', maxWidth: 430, boxShadow: 'var(--shadow)',
          }}>
            <div style={{ fontWeight: 800, fontSize: 17, marginBottom: 14 }}>
              🦾 方块入盒！最后一问：
            </div>
            <div style={{ fontSize: 14.5, marginBottom: 16, lineHeight: 1.7 }}>
              工厂里大多数机械臂是怎么"学会"动作的？
            </div>
            {[
              { t: 'A．程序员给每一台都写一大堆复杂代码', ok: false },
              { t: 'B．工人带着它摆一遍、记录点位、重复播放（示教再现）', ok: true },
              { t: 'C．机械臂看别的机械臂做一遍就自己会了', ok: false },
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
                    track('quiz_wrong', 6);
                    dispatch({ type: 'SAY', text: o.t.startsWith('A') ? '复杂代码是少数——想想你刚才做了什么：拖、记录、回放' : '那可是科幻——再想想你刚才的操作步骤', mood: 'think' });
                  }
                }}>
                {o.t}
              </button>
            ))}
            {quizPick && !quizPick.startsWith('B') && (
              <div style={{ fontSize: 12, color: 'var(--ink-dim)' }}>再想想——你刚才教它的步骤是什么？</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
