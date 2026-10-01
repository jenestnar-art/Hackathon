import React, { createContext, useContext, useEffect, useReducer } from 'react';
import { track } from '../lib/track.js';

// 全局游戏状态：进度 / 主题 / 图鉴收集 / 伙伴消息
const GameContext = createContext(null);

const TOTAL_LEVELS = 7;

function reducer(state, action) {
  switch (action.type) {
    case 'SET_THEME':
      return { ...state, theme: action.theme };
    case 'TOGGLE_THEME':
      return { ...state, theme: state.theme === 'dark' ? 'light' : 'dark' };
    case 'COMPLETE_LEVEL': {
      const { level, device } = action;
      if (state.done[level]) return state;
      return {
        ...state,
        done: { ...state.done, [level]: device },
        badges: [...state.badges, action.badge],
        // 停在本关展示通关演出，由用户自己点「下一关」
      };
    }
    case 'GOTO':
      return { ...state, page: action.page };
    case 'COLLECT': // 元件用过后点亮图鉴
      if (state.collected.includes(action.part)) return state;
      return { ...state, collected: [...state.collected, action.part] };
    case 'SAY': // 伙伴说话
      return { ...state, companion: { text: action.text, mood: action.mood || 'normal', ts: Date.now() } };
    default:
      return state;
  }
}

const initial = {
  theme: window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark',
  page: 0, // 0=Intro, 1..7=关卡, 8=Final, 9=Secret
  done: {}, // { levelIndex: deviceName }
  badges: [],
  collected: [], // 已点亮图鉴的元件
  companion: { text: '你好呀！我是你的实验搭档 ⚡', mood: 'happy', ts: Date.now() },
};

export function GameProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initial);

  useEffect(() => {
    document.documentElement.dataset.theme = state.theme;
  }, [state.theme]);

  const value = { state, dispatch, track };
  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame() {
  return useContext(GameContext);
}
