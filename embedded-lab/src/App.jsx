import { useGame } from './store/GameContext.jsx';
import TopBar from './components/TopBar.jsx';
import Companion from './components/Companion.jsx';
import Intro from './scenes/Intro.jsx';
import Level1_Lamp from './scenes/Level1_Lamp.jsx';
import Level2_AC from './scenes/Level2_AC.jsx';
import Level3_Radar from './scenes/Level3_Radar.jsx';
import Level4_Clock from './scenes/Level4_Clock.jsx';
import Level5_Car from './scenes/Level5_Car.jsx';
import Level6_Arm from './scenes/Level6_Arm.jsx';
import Level7_Invent from './scenes/Level7_Invent.jsx';
import Final from './scenes/Final.jsx';

// 骨架期路由：page 0 → Intro；后续每关一个 scene
export default function App() {
  const { state } = useGame();

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <TopBar />
      <div
        className="bench-grid"
        style={{
          flex: 1,
          margin: '0 20px 20px',
          borderRadius: 16,
          border: '1px solid var(--card-edge)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 28,
        }}
      >
        {state.page === 0 && <Intro />}
        {state.page === 1 && <Level1_Lamp />}
        {state.page === 2 && <Level2_AC />}
        {state.page === 3 && <Level3_Radar />}
        {state.page === 4 && <Level4_Clock />}
        {state.page === 5 && <Level5_Car />}
        {state.page === 6 && <Level6_Arm />}
        {state.page === 7 && <Level7_Invent />}
        {state.page === 8 && <Final />}
      </div>
      <div style={{ padding: '0 20px 16px' }}>
        <Companion hint="点这里试试看？" />
      </div>
    </div>
  );
}
