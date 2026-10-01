/* =============================================================================
   petLines.ts —— 台词库
   ---------------------------------------------------------------------------
   ★ 这是整个模块"有趣"的主要来源，比动画重要。
   写台词的三个原则：
     1. 它要说人话、要贫嘴，不要像说明书
     2. 它犯错的时候要嘴硬（嘴硬才好笑）
     3. 每一句都要让人能"看懂它现在的毛病"，但不用术语
   ========================================================================== */

import type { Mood } from '@/features/ai/pet/petState'

export interface Line {
  mood: Mood
  text: string
  /** 小字补充，可以是"数据"而非台词 */
  note?: string
}

/** 开场：它第一次出场 */
export const INTRO_LINES: Line[] = [
  { mood: 'confused', text: '……我是谁？我要干什么？' },
  { mood: 'confused', text: '哦对，我要认数字。来吧，放马过来。' },
  { mood: 'smug', text: '这个我会！这是 7！', note: '（你给它看的是 3）' },
  { mood: 'smug', text: '……不对吗？' },
  { mood: 'confused', text: '好吧，我承认我现在什么都不懂。你教我吧。' },
]

/** 第 0 章 · 喂食 */
export const CH0 = {
  title: '开局一只啥也不会的',
  subtitle: '它连 1 和 7 都分不清',
  goal: '喂它足够的样本，让它第一次认出你自己写的字',
  enter: { mood: 'confused' as Mood, text: '我饿了。你是要喂我数字吃吗？' },
  firstFeed: { mood: 'happy' as Mood, text: '唔……这个味道我记住了。' },
  progress: [
    { mood: 'idle' as Mood, text: '再来几个，我还不太确定。' },
    { mood: 'idle' as Mood, text: '有感觉了，我脑子里好像有东西在成形。' },
    { mood: 'happy' as Mood, text: '我好像……能认出你写的字了？' },
  ],
  /** 还没吃够就让它考试时，它的反应 */
  notReady: { mood: 'confused' as Mood, text: '别考我，我还没吃饱呢。' },
  boss: {
    name: '五五开',
    taunt: '你连 1 和 7 都分不清，也好意思出来混？',
    win: { mood: 'happy' as Mood, text: '我赢了！我认出 1 和 7 了！' },
    lose: { mood: 'hurt' as Mood, text: '……我再多吃点。' },
  },
  clear: { mood: 'happy' as Mood, text: '我长出来了！你看我的眼睛，是眼睛不是问号了。' },
}

/** 第 1 章 · 偏食 */
export const CH1 = {
  title: '它偏食了',
  subtitle: '6 和 8 它一口没吃过',
  goal: '把它认不出的数字喂饱',
  enter: { mood: 'smug' as Mood, text: '我吃得很饱，我现在很厉害。' },
  /** 连出 6 和 8 时的连续翻车 */
  fail: [
    { mood: 'smug' as Mood, text: '8！', note: '它看到的：6' },
    { mood: 'smug' as Mood, text: '还是 8！', note: '它看到的：6' },
    { mood: 'confused' as Mood, text: '8……8……都是 8 吧？' },
    { mood: 'confused' as Mood, text: '这两个数字我没吃过几口嘛。' },
  ],
  /** 点了"玄学按钮"（调参死路） */
  paramTrap: [
    { mood: 'idle' as Mood, text: '（原地转了一圈）', note: '准确率没有变化' },
    { mood: 'idle' as Mood, text: '（又转了一圈）', note: '准确率还是没有变化' },
    { mood: 'smug' as Mood, text: '再转一次说不定就有用了？' },
  ],
  paramTrapHint: {
    mood: 'confused' as Mood,
    text: '你转了它好几圈了。它好像不是"没练够"，是"没吃过"。',
  },
  feedWrong: { mood: 'hurt' as Mood, text: '呕——这个我吃太多了，撑着了。' },
  /** 被戳（点宠物）时的反应 —— 它会道歉 */
  poke: [
    '对不起……我一看到 6 就想到 8。',
    '别戳了，我知道我错了。',
    '这两类我几乎没吃过，真的记不住。',
    '不是我不想认，是没人教我。',
    '你多喂我几个 6 和 8，我保证改。',
    '我错得挺离谱的吧……',
    '我也很无奈，我脑子里就没这两个数字。',
    '再给我一点样本，行不行？',
  ],
  /** 开窍之后被戳 —— 它会得意 */
  pokeProud: [
    '6 是 6，8 是 8！我再也不会搞混了。',
    '哼哼，我现在可厉害了。',
    '谢谢你喂我那么多 6 和 8。',
    '看！成绩单全是绿的。',
    '我早就说我能学会的（才没有）。',
    '别戳了，再戳我要飘起来了。',
    '那个六八不分的 BOSS，我准备好了！',
  ],
  boss: {
    name: '六八不分',
    taunt: '我出十个 6 和 8，看它能接住几个。',
    win: { mood: 'happy' as Mood, text: '6 是 6！8 是 8！我分得清了！' },
    lose: { mood: 'confused' as Mood, text: '它们俩……长得不是一样吗？' },
  },
  clear: { mood: 'proud' as Mood, text: '肚子消下去了。原来我不是笨，是饿着。' },
}

/** 第 2 章 · 只会做原题 */
export const CH2 = {
  title: '它只会做原题',
  subtitle: '换个写法它就不认了',
  goal: '让它认得各种写法的同一个数字',
  enter: { mood: 'proud' as Mood, text: '我现在训练集 96%，我很满意。' },
  /** 用户自己写一个 → 翻车 */
  fail: [
    { mood: 'smug' as Mood, text: '这不是 7。', note: '你写的确实是 7' },
    { mood: 'smug' as Mood, text: '我见过的 7 不是这样的。你的太歪了。' },
    { mood: 'smug' as Mood, text: '你的也太细了。这个根本不是 7。' },
    { mood: 'confused' as Mood, text: '……等等，难道 7 可以有很多种写法？' },
  ],
  /** 点了"猛练一晚上" */
  overdo: [
    { mood: 'dead' as Mood, text: '（僵成一块砖）', note: '训练集 99.5%，但它谁都不认识了' },
    { mood: 'dead' as Mood, text: '……', note: '这就是"背下来了"' },
  ],
  /** 被戳（还没见过各种写法）—— 它嘴硬，把锅甩给你的字 */
  poke: [
    '这不是 7。',
    '我见过的 7 不是这样的。你的太歪了。',
    '你这个也太潦草了，根本不是数字。',
    '我只认那一种写法，别的我不管。',
    '你写得不标准，怪我咯？',
    '（僵成一块砖，不理你）',
    '训练集上我 96%，是你写得有问题。',
  ],
  /** 被戳（已经见过各种写法）—— 它服气了 */
  pokeProud: [
    '歪的我认得了，潦草的我也认得了！',
    '原来 7 可以有一百种写法。',
    '以前是我把"一种写法"当成了"7"。',
    '再写几个，我还能认。',
    '（挺起胸）现在随便写，我不怕。',
  ],
  widen: { mood: 'happy' as Mood, text: '原来 7 可以歪着写、粗着写、还带毛边！' },
  boss: {
    name: '歪七扭八',
    taunt: '我出十个手写体的 7、4、9，字写得丑你别怪我。',
    win: { mood: 'proud' as Mood, text: '丑的字我也认得了！' },
    lose: { mood: 'dead' as Mood, text: '我……只认工整的。' },
  },
  clear: { mood: 'proud' as Mood, text: '我身体舒展开了。原来"学得死"是这种感觉。' },
}

/** 第 3 章 · 被教坏了 */
export const CH3 = {
  title: '它被人教坏了',
  subtitle: '有人在数据里动了手脚',
  goal: '把标错标签的样本揪出来',
  enter: { mood: 'smug' as Mood, text: '我又变强了！准确率 97% 呢！' },
  fail: [
    { mood: 'smug' as Mood, text: '8！！', note: '它看到的：3（置信度 91%）' },
    { mood: 'smug' as Mood, text: '这就是 8 啊，我学过。你别骗我。' },
    { mood: 'confused' as Mood, text: '等等……我为什么会这么确定？' },
  ],
  findHint: {
    mood: 'confused' as Mood,
    text: '看看你喂我的东西里，是不是有几个标签贴反了？',
  },
  cleanOne: { mood: 'happy' as Mood, text: '咦，这个我吃错了？难怪我老认错。' },
  wrongAccuse: { mood: 'hurt' as Mood, text: '这个没错啊！你冤枉好人了。' },
  /** 不清理就重新训练的反转 */
  poisonAgain: {
    mood: 'smug' as Mood,
    text: '分数更高了！',
    note: '准确率涨了，因为错的东西它学得更牢',
  },
  boss: {
    name: '内鬼样本',
    taunt: '我混在四十张图里，你找得出我吗？',
    win: { mood: 'proud' as Mood, text: '干净了！我脑子清爽多了。' },
    lose: { mood: 'confused' as Mood, text: '我还是分不清 3 和 8……' },
  },
  /** 被戳（还没清毒）—— 它委屈：错的不是我 */
  poke: [
    '3！！',
    '这明明就是 8，你们标的也是 8，我错哪了？',
    '我认真学的，我发誓。',
    '我身上这些斑……是不是吃坏东西了？',
    '我一直以为 3 长这样，是你们告诉我的。',
    '（斑块又大了一点）',
    '别戳了，我头疼。',
  ],
  /** 被戳（清干净了）—— 它松口气 */
  pokeProud: [
    '原来是有人把答案抄错了！',
    '我没错，是标签错了。',
    '斑块退了，脑子也清爽了。',
    '以后喂我之前，先把答案看一遍好不好。',
    '（转了个圈）我现在是个干净模型了。',
  ],
  clear: { mood: 'proud' as Mood, text: '斑块退了。原来我错，不全是我的错。' },
}

/** 第 4 章 · 出道 */
export const CH4 = {
  title: '出道',
  subtitle: '最后一次考试，题目它一道都没见过',
  goal: '通过真实现场测试',
  enter: { mood: 'idle' as Mood, text: '我准备好了。这次是真的新题。' },
  boss: {
    name: '真实现场',
    taunt: '这里没有工整的字，也没有你做过的题。',
    win: { mood: 'proud' as Mood, text: '我通过了！我是一只有用的模型了！' },
    lose: { mood: 'hurt' as Mood, text: '……我还要再学。' },
  },
  /** 被戳（还在模拟考阶段）—— 它有点紧张 */
  poke: [
    '别戳我，我在看卷子。',
    '这些都是新题……我有点慌。',
    '你多喂我几种写法，我就有底了。',
    '以前我只会背题，现在我想真的学会。',
    '（深吸一口气）来吧。',
  ],
  /** 被戳（过了真实现场）—— 它释然了 */
  pokeProud: [
    '没见过的手写体，我也认出来了。',
    '我不是背题机器了。',
    '谢谢你从头到尾没嫌我笨。',
    '（转了个圈）我可以出道了吧？',
    '把笔给我，这次我自己写。',
  ],
  clear: { mood: 'proud' as Mood, text: '谢谢你这几章没放弃我。' },
}

/* ---------------------------------------------------------------------------
   性格标签：由"你怎么养它"决定，不是随机给的
   这是最终模型卡片上最值钱的一行——它同时是一次复盘
   ------------------------------------------------------------------------ */

export interface Personality {
  id: string
  title: string
  catchphrase: string
  comment: string
}

export const PERSONALITIES: Record<string, Personality> = {
  dataDoctor: {
    id: 'dataDoctor',
    title: '数据医生',
    catchphrase: '让我先看看样本。',
    comment: '遇到问题你第一反应是去检查数据，不是去转旋钮。这是真实 AI 工程师的习惯。',
  },
  knobBeliever: {
    id: 'knobBeliever',
    title: '玄学信徒',
    catchphrase: '再练练就好了。',
    comment: '你转了好几次旋钮。参数不是不能调，但它是最后才该动的东西。',
  },
  grinder: {
    id: 'grinder',
    title: '卷王',
    catchphrase: '我还能学！',
    comment: '你试过把它往死里练。结果它背下了所有原题，然后一道新题都不会。',
  },
  rusher: {
    id: 'rusher',
    title: '莽夫',
    catchphrase: '差不多行了，下一个。',
    comment: '你出手很快。快是好事，但它有些毛病你还没收拾干净。',
  },
  detective: {
    id: 'detective',
    title: '侦探',
    catchphrase: '这里面有人贴错标签。',
    comment: '你愿意一条条翻数据找错标。这个耐心在真实工作里非常稀缺。',
  },
}
