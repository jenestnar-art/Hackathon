import {
  BrainCircuit,
  CircuitBoard,
  Code2,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react'

export type TrackId = 'software' | 'security' | 'ai' | 'embedded'

export interface Track {
  id: TrackId
  order: string
  title: string
  subtitle: string
  description: string
  duration: string
  level: string
  signal: string
  outcome: string
  tools: string[]
  icon: LucideIcon
  color: string
  softColor: string
}

export const tracks: Track[] = [
  {
    id: 'software',
    order: '01',
    title: '软件工程',
    subtitle: '做出来，跑起来',
    description:
      '从一段会报错的代码开始，补完一个小型交互页面。你会经历修改、运行、继续修改的真实节奏。',
    duration: '5–8 分钟',
    level: '零基础可试',
    signal: '排错耐力 · 抽象偏好',
    outcome: '一个可以运行的 Todo Demo',
    tools: ['Monaco', '实时预览', '测试用例'],
    icon: Code2,
    color: '#7c5cff',
    softColor: '#f0ecff',
  },
  {
    id: 'security',
    order: '02',
    title: '网络安全',
    subtitle: '拿下这台服务器',
    description:
      '观察目标、收集线索、利用漏洞，拿到 root 权限并接管一台真实运行的靶机。不是背概念，而是亲手完成一次完整入侵。',
    duration: '6–10 分钟',
    level: '需要一点好奇',
    signal: '细节敏感 · 探索性',
    outcome: '一次完整的服务器接管',
    tools: ['终端界面', '漏洞分析', 'Root 接管'],
    icon: ShieldCheck,
    color: '#00a86b',
    softColor: '#e6f8f0',
  },
  {
    id: 'ai',
    order: '03',
    title: '人工智能',
    subtitle: '亲手训一个模型',
    description:
      '标注样本、启动训练、观察准确率变化。你会第一次直观看到“数据质量”如何影响模型表现。',
    duration: '5–8 分钟',
    level: '零基础可试',
    signal: '探索性 · 抽象偏好',
    outcome: '一条你自己的训练曲线',
    tools: ['TensorFlow.js', '样本标注', '训练曲线'],
    icon: BrainCircuit,
    color: '#ff6b35',
    softColor: '#fff0e8',
  },
  {
    id: 'embedded',
    order: '04',
    title: '嵌入式',
    subtitle: '点亮那颗灯',
    description:
      '写下一小段代码，连接虚拟引脚，让你的灯亮起来。硬件世界的反馈，会比想象中更直接。',
    duration: '5–8 分钟',
    level: '零基础可试',
    signal: '具象思维 · 排错耐力',
    outcome: '一块会呼吸的虚拟电路板',
    tools: ['Wokwi', 'ESP32', '串口输出'],
    icon: CircuitBoard,
    color: '#1389c8',
    softColor: '#e7f5fc',
  },
]

export function getTrack(id: string | undefined): Track | undefined {
  return tracks.find((track) => track.id === id)
}
