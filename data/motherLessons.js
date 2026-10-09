// 教学内容独立于训练题目。自检只检查这一题的结构理解，不评价口语掌握度。
module.exports = {
  A01: {
    plain:
      "想说“最近这阵子，我一直在……”时，可以调出这个结构。它不只是说某个动作现在正在发生。",
    slots: [
      { label: "谁", en: "I / She / We", zh: "先选说的是谁", tone: "blue" },
      {
        label: "持续到最近",
        en: "have / has been",
        zh: "I、you、we、they 用 have；he、she、it 用 has",
        tone: "green",
      },
      {
        label: "在做什么",
        en: "V-ing + 内容",
        zh: "把动作换成 -ing 形式，再补具体内容",
        tone: "pink",
      },
    ],
    thought: "最近我一直在学做饭。",
    build: [
      {
        label: "先找自己真正想说的事",
        text: "这阵子在学做饭，不是只说今天这一刻。",
      },
      { label: "填进结构", text: "I + have been + learning to cook" },
      { label: "合成一句自然的话", text: "I’ve been learning to cook." },
    ],
    worked: "I’ve been learning to cook.",
    workedZh: "最近我一直在学做饭。",
    exampleNotes: [
      "聊自己的近况：重点是最近持续投入的活动。",
      "把主语换成 she：She’s 在这里是 She has。",
      "最近持续的状态也可以用否定表达。",
    ],
    contrasts: [
      {
        title: "和“现在正在做”区分",
        a: "I’m cooking now.",
        aZh: "我现在正在做饭。",
        b: "I’ve been learning to cook.",
        bZh: "最近这段时间一直在学做饭。",
        why: "前一句聚焦此刻，后一句聚焦最近持续或反复的过程。",
      },
      {
        title: "不必每一秒都在做",
        a: "I’ve been reading more lately.",
        aZh: "最近我读书更多了。",
        b: "I’ve been running every morning.",
        bZh: "最近我每天早上都跑步。",
        why: "它也可以表达这阵子反复发生的活动，不等于从未停过。",
      },
    ],
    rules: [
      {
        title: "动作要用 -ing",
        wrong: "I’ve been learn to cook.",
        right: "I’ve been learning to cook.",
        why: "been 后面的动作使用 -ing 形式。常见变化：work → working；make → making；run → running。",
      },
      {
        title: "主语变化时调整 have / has",
        wrong: "She have been working at home.",
        right: "She has been working at home.",
        why: "she 是第三人称单数，用 has；缩写为 She’s been…",
      },
      {
        title: "否定与提问",
        right:
          "I haven’t been sleeping well. / What have you been doing lately?",
        why: "否定放在 have / has 后；提问把 have / has 移到主语前。",
      },
    ],
    chunks: [
      { en: "learning to cook", zh: "学做饭" },
      { en: "working on a project", zh: "投入一个项目" },
      { en: "trying to sleep earlier", zh: "试着早点睡" },
    ],
    personal: "想一件你最近持续做的真实事情。只找自己的内容，不需要照抄例句。",
    check: {
      prompt: "你想说“她最近一直在家工作”，哪一句结构合适？",
      options: [
        {
          id: "a",
          text: "She has been working from home.",
          correct: true,
          why: "she 用 has，work 变成 working；表达近期持续的活动。",
        },
        {
          id: "b",
          text: "She have been work from home.",
          correct: false,
          why: "she 需要 has；been 后的动作需要 working。",
        },
      ],
    },
  },
  E02: {
    plain:
      "先想“是什么带来了可能”，再说“谁因此能做什么”。这里的 X 是工具、条件或环境，sb 是某个人，V 是动作原形；它们都要换成你的实际内容。",
    slots: [
      {
        label: "什么提供了条件",
        en: "X",
        zh: "例如弹性时间、一个工具、安静的环境",
        tone: "blue",
      },
      {
        label: "让谁能够",
        en: "allows / enables + sb",
        zh: "sb 换成 me、you、us、people 等实际对象",
        tone: "green",
      },
      {
        label: "去做什么",
        en: "to + 动词原形",
        zh: "例如 to learn、to focus、to spend time",
        tone: "pink",
      },
    ],
    thought: "弹性时间让我能陪家人。",
    build: [
      { label: "找出带来帮助的条件", text: "弹性时间 → a flexible schedule" },
      {
        label: "找出受益的人和动作",
        text: "我 → me；陪家人 → spend time with my family",
      },
      {
        label: "把三部分接起来",
        text: "A flexible schedule + allows me + to spend time with my family.",
      },
    ],
    worked: "A flexible schedule allows me to spend time with my family.",
    workedZh: "弹性时间让我能陪家人。",
    exampleNotes: [
      "时间安排是条件；me 是受益者；spend 是动词原形。",
      "工具是主语；people 是对象；learn 不用变成 learning。",
      "library 是单数，allow 加 s；students 不影响 allow 的形式。",
    ],
    contrasts: [
      {
        title: "allow 和 enable 怎么选",
        a: "My parents allow me to go out.",
        aZh: "父母允许我出门。",
        b: "Online classes enable me to study at home.",
        bZh: "网课让我能够在家学习。",
        why: "allow 既可表示“允许”，也可表示“提供条件”；enable 更强调让事情变得可行。说条件带来的帮助时，两者常都可用。",
      },
      {
        title: "从“我能”到“什么让我能”",
        a: "I can study at home.",
        aZh: "我可以在家学习。",
        b: "Online classes allow me to study at home.",
        bZh: "网课让我能够在家学习。",
        why: "第二句多说出了带来这种可能的条件。不是更高级，而是你想表达的信息不同。",
      },
    ],
    rules: [
      {
        title: "to 后用动词原形",
        wrong: "This app allows me to learning at home.",
        right: "This app allows me to learn at home.",
        why: "这里是 to + 动词原形，不是 to learning。",
      },
      {
        title: "人称代词用宾格",
        wrong: "This tool enables I to work faster.",
        right: "This tool enables me to work faster.",
        why: "工具让“我”能做事，这里的对象用 me，不用 I。其他常见对象有 him、her、us、them。",
      },
      {
        title: "谓语跟着前面的条件变",
        right:
          "This tool allows us to share ideas. / These tools allow us to share ideas.",
        why: "单数 this tool 用 allows；复数 these tools 用 allow。若说过去的帮助，可用 allowed / enabled。",
      },
    ],
    chunks: [
      { en: "focus on my work", zh: "专注于工作" },
      { en: "learn at my own pace", zh: "按自己的节奏学习" },
      { en: "spend time with my family", zh: "陪家人" },
    ],
    personal:
      "想一个真正帮助你的工具或条件，再想“它让我能做什么”。可以很简单，不必说它改变了整个生活。",
    check: {
      prompt: "你想说“这个工具让我们能更快分享想法”，哪一句结构合适？",
      options: [
        {
          id: "a",
          text: "This tool allows us to sharing ideas faster.",
          correct: false,
          why: "to 后要用动词原形 share，不是 sharing。",
        },
        {
          id: "b",
          text: "This tool allows us to share ideas faster.",
          correct: true,
          why: "This tool 是单数，所以用 allows；us 是对象，to 后用 share。",
        },
      ],
    },
  },
  E03: {
    plain:
      "先说“是什么形成了阻碍”，再说“谁因此没法做什么”。也能描述一种措施避免了不好的结果，不一定都是消极的阻碍。",
    slots: [
      {
        label: "什么造成阻碍",
        en: "X",
        zh: "例如噪音、天气、时间安排；也可以是预防措施",
        tone: "blue",
      },
      {
        label: "阻止谁",
        en: "prevents / stops + sb",
        zh: "把 sb 换成 me、us、her、people 等对象",
        tone: "green",
      },
      {
        label: "无法做什么",
        en: "from + V-ing",
        zh: "from 后面的动作使用 -ing 形式",
        tone: "pink",
      },
    ],
    thought: "噪音让我没法集中注意力。",
    build: [
      { label: "先找出阻碍", text: "噪音 → noise" },
      {
        label: "找出受影响的人和动作",
        text: "我 → me；集中注意力 → concentrate → concentrating",
      },
      {
        label: "接上 from 和动作",
        text: "Noise + prevents me + from concentrating.",
      },
    ],
    worked: "Noise prevents me from concentrating.",
    workedZh: "噪音让我没法集中注意力。",
    exampleNotes: [
      "噪音是阻碍，me 是对象，from 后用 concentrating。",
      "也可以表达“防止受伤”这种有益的预防。",
      "说过去发生的阻碍，用 stopped；going 仍保留 -ing。",
    ],
    contrasts: [
      {
        title: "与“让人能做”对照",
        a: "A quiet room allows me to focus.",
        aZh: "安静的房间让我可以集中注意力。",
        b: "Noise prevents me from focusing.",
        bZh: "噪音让我没法集中注意力。",
        why: "前者用 to + 原形，表达提供条件；后者用 from + -ing，表达阻碍或避免。",
      },
      {
        title: "阻止做事，也能避免坏结果",
        a: "The rain stopped us from going out.",
        aZh: "雨让我们没能出门。",
        b: "Planning meals prevents us from wasting food.",
        bZh: "规划饭菜能避免我们浪费食物。",
        why: "这个结构不限定好坏，要看后面说的是哪件事。",
      },
    ],
    rules: [
      {
        title: "保留 from，后面用 -ing",
        wrong: "Noise prevents me to concentrate.",
        right: "Noise prevents me from concentrating.",
        why: "本课使用 prevent / stop + 对象 + from + -ing，不是 to + 原形。",
      },
      {
        title: "别把“停止做”与“阻止谁做”混淆",
        right:
          "I stopped checking my phone. / The meeting stopped me from checking my phone.",
        why: "前一句是我停止看手机；后一句是会议让我没法看手机。后者要有受影响的人。",
      },
      {
        title: "过去、否定也能用",
        right:
          "The rain stopped us from going out. / The cold didn’t stop me from running.",
        why: "过去用 stopped；didn’t 后面的 stop 回到原形，from 后仍是 running。",
      },
    ],
    chunks: [
      { en: "getting started", zh: "开始行动" },
      { en: "wasting time", zh: "浪费时间" },
      { en: "sleeping well", zh: "睡好觉" },
    ],
    personal:
      "想一件你想做的事，再找一个具体阻碍；或想一个帮你避免麻烦的小措施。",
    check: {
      prompt: "你想说“噪音让我没法睡好”，哪一句结构合适？",
      options: [
        {
          id: "a",
          text: "Noise stops me from sleeping well.",
          correct: true,
          why: "stop + 对象 me + from + sleeping，结构符合这个意思。",
        },
        {
          id: "b",
          text: "Noise stops me to sleep well.",
          correct: false,
          why: "这里需要 from sleeping，不是 to sleep。",
        },
      ],
    },
  },
};
