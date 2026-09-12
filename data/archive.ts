export type ModeKey = "keep" | "release" | "wait";

export interface ModeConfig {
  label: string;
  kicker: string;
  title: string;
  number: string;
  community: string;
  wallTitle: string;
  background: string;
}

export interface Story {
  id?: string;
  userId?: string;
  authorName?: string;
  authorAvatar?: string;
  isAnonymous?: boolean;
  category?: ModeKey;
  createdAt?: string;
  source?: string;
  mood: string;
  time: string;
  empathy: number;
  likes: number;
  featured?: boolean;
  text: string;
  replies: string[];
  quick: string[];
}

export interface CommunityUser {
  id: string;
  username: string;
  token: string;
  avatar_url?: string;
  created_at: string;
}

export interface CommunityNote {
  id: string;
  user_id: string;
  author_name: string;
  author_avatar?: string;
  is_anonymous?: boolean;
  content: string;
  category: ModeKey;
  mood: string;
  likes_count: number;
  created_at: string;
}

export interface LikeRecord {
  note_id: string;
  user_id: string;
}

export interface CommunityReply {
  id: string;
  note_id: string;
  user_id: string;
  author_name: string;
  author_avatar?: string;
  content: string;
  created_at: string;
}

export interface SavedRecord {
  text: string;
  mode: "wait";
  mood: string;
  isPublic: boolean;
  createdAt: string;
}

export const modes: Record<ModeKey, ModeConfig> = {
  keep: {
    label: "挽留 · 第 7 次试探",
    kicker: "我一直在等待的一次机会，和你重新开始的机会",
    title: "你回我消息慢一点，我都觉得你在计划离开我；可你只要回一句，我又觉得我们还有以后。",
    number: "01",
    community: "那些迟迟没有发出的消息，也有人懂。",
    wallTitle: "还想靠近的人，\n把试探留在这里。",
    background: "/assets/theme-keep-ai.jpg"
  },
  release: {
    label: "告别 · 练习进行中",
    kicker: "写下一件关于TA、你决定今天开始不再提起的事。",
    title: "祝你岁岁平安，哪怕你的未来与我无关。",
    number: "02",
    community: "放下不是删除过去，是把生活重新还给自己。",
    wallTitle: "练习告别的人，\n正在拿回生活。",
    background: "/assets/theme-release-ai.jpg"
  },
  wait: {
    label: "等待 · 第 5 天",
    kicker: "你的信息出现在手机，将会变成我最开心的一天？",
    title: "我喜欢你，但我放不下我的自尊。我们的感情进展已经达到 80% 了，只要你主动踏出一步，我就敢陪你重走剩下的 99 步。",
    number: "03",
    community: "这一次没有追上去的人，也在等一个明确的答案。",
    wallTitle: "停在原地的人，\n也值得被走向。",
    background: "/assets/theme-wait-ai.jpg"
  }
};

export const stories: Record<ModeKey, Story[]> = {
  keep: [
    {
      mood: "挽留 · 小心翼翼", time: "今天 23:17", empathy: 126, likes: 89, featured: true,
      text: "对话框里的“你睡了吗”写了三遍。第一遍怕打扰，第二遍怕显得纠缠，第三遍终于删掉。其实我不是没话说，只是害怕你的沉默替我们做决定。",
      replies: ["等待回复的每一分钟，都像在猜自己还有没有被爱。", "今晚先把手机放远一点，你也值得被坚定地走向。"],
      quick: ["我懂这种试探", "抱抱你"]
    },
    {
      mood: "挽留 · 不甘", time: "昨天", empathy: 84, likes: 57,
      text: "我曾经以为多解释一次、多道歉一次，我们就能回到原来的位置。后来才明白，真正想留下的人，不会让我独自完成两个人的修复。",
      replies: ["挽留可以是表达爱，但不该是一个人无止境地退让。", "你已经把能说的话都说完了，剩下的要看他的行动。"],
      quick: ["你已经尽力了", "先照顾自己"]
    },
    {
      mood: "挽留 · 想念", time: "2 天前", empathy: 103, likes: 71,
      text: "看到他的头像亮起，我还是会下意识点进去。没有新消息，却又把我们最后一段对话从头读了一遍，像在旧句子里找一个没有结束的证据。",
      replies: ["不是你看漏了答案，是有些答案本来就不在聊天记录里。"],
      quick: ["陪你等一会儿", "把手机放下吧"]
    },
    {
      source: "高赞乐评改写", mood: "挽留 · 最后一次", time: "3 天前", empathy: 196, likes: 143,
      text: "分开后的第十七天，我把那通电话拨了出去。响到自动挂断也没人接，我却忽然松了口气：不是因为不爱了，而是终于确认，这一次真的只有我想回到从前。",
      replies: ["最后一次努力不是丢脸，它让你不必再被“如果当时”困住。", "愿你下一次伸手时，对面的人也正好在向你靠近。"],
      quick: ["你已经给过答案", "别再责怪自己"]
    },
    {
      source: "高赞乐评改写", mood: "挽留 · 反复", time: "5 天前", empathy: 174, likes: 121,
      text: "收藏夹里的歌删了又加，置顶的聊天取消又恢复。我以为自己是在等你回头，后来发现，我只是舍不得承认那段最认真、最快乐的日子已经结束。",
      replies: ["舍不得的是那段日子，不一定还是现在的那个人。", "可以慢一点，但别让回忆替你决定余生。"],
      quick: ["我也反复过", "允许自己舍不得"]
    },
    {
      source: "高赞乐评改写", mood: "挽留 · 迟到", time: "1 周前", empathy: 221, likes: 167,
      text: "你说累的时候，我总以为睡一觉就好了；你不再争吵的时候，我还以为我们终于成熟了。直到你走远，我才明白，那些沉默其实是一封写了很久的告别信。",
      replies: ["看懂得太晚很遗憾，但这份明白会教会你以后怎样去爱。", "关系里的安静，有时不是平静，而是一个人已经耗尽了力气。"],
      quick: ["这句话说中了", "把遗憾留在这里"]
    }
  ],
  release: [
    {
      mood: "放下 · 归还", time: "今天 20:06", empathy: 152, likes: 118, featured: true,
      text: "今天把他留在我家的杯子收进了纸箱。没有砸碎，也没有扔掉，只是终于让它离开每天都会看见的位置。原来告别，也可以安静得像整理房间。",
      replies: ["腾出来的不只是桌面，还有以后可以放新生活的位置。", "不需要恨他，才能证明你真的放下。"],
      quick: ["替你松一口气", "继续向前"]
    },
    {
      mood: "放下 · 平静", time: "昨天", empathy: 97, likes: 76,
      text: "朋友提起他的名字，我第一次没有急着追问近况。那一刻没有胜利感，只觉得天气很好，手里的咖啡也刚好是我喜欢的温度。",
      replies: ["真正的放下，常常发生在一个再普通不过的瞬间。", "你正在重新成为自己生活里的主语。"],
      quick: ["为你开心", "今天很好"]
    },
    {
      mood: "放下 · 清醒", time: "3 天前", empathy: 131, likes: 94,
      text: "我承认那段快乐是真的，也承认我们不适合继续是真的。删除合照并没有抹掉过去，只是提醒我：故事发生过，也确实已经写完。",
      replies: ["结束不会让曾经的认真变得可笑。", "愿下一次相爱，不再需要你反复证明自己值得。"],
      quick: ["谢谢你的勇敢", "好好告别"]
    },
    {
      source: "高赞乐评改写", mood: "放下 · 不再回避", time: "4 天前", empathy: 209, likes: 158,
      text: "那首歌随机播放到副歌时，我第一次没有按下一首。听完以后照常洗衣、晾衣、关灯。原来放下不是再也不会想起，而是想起以后，仍然能把今天过完。",
      replies: ["能平静听完曾经不敢听的歌，就是生活正在回来。", "记得并不等于停留，你已经在向前了。"],
      quick: ["为你感到轻松", "今天也要好好的"]
    },
    {
      source: "高赞乐评改写", mood: "放下 · 体面", time: "6 天前", empathy: 187, likes: 136,
      text: "最后一次见面，我把他的书和外套装进袋子，没有追问有没有可能。回家的地铁很挤，我却第一次觉得肩膀是松的：有些答案不必再问，转身就是答案。",
      replies: ["体面不是没有眼泪，是不再用眼泪换一个人留下。", "你归还了他的东西，也把自己还给了自己。"],
      quick: ["替你松开手", "这次向前走"]
    },
    {
      source: "高赞乐评改写", mood: "放下 · 祝福", time: "8 天前", empathy: 243, likes: 191,
      text: "后来听说你过得不错，我没有难过，也没有打听身边的人是谁。只是想起我们年轻时说过的那些以后，然后认真祝你平安——从此祝福是真的，不联系也是真的。",
      replies: ["祝福不代表还在等待，它也可以是一段关系最后的温柔。", "不打扰，是你替这段故事写下的句号。"],
      quick: ["愿你也岁岁平安", "告别得很温柔"]
    }
  ],
  wait: [
    {
      mood: "等待 · 克制", time: "今天 18:42", empathy: 168, likes: 129, featured: true,
      text: "我没有发那句晚安。不是故意冷淡，也不是想惩罚谁，只是这一次，我想知道当我停在原地，你会不会发现我们之间少了一个一直向前走的人。",
      replies: ["停止主动不是博弈，是在看这段关系有没有双向的力气。", "真正的靠近，不该永远只有你在走。"],
      quick: ["我也在等", "守住你的边界"]
    },
    {
      mood: "等待 · 自尊", time: "昨晚 00:31", empathy: 116, likes: 82,
      text: "手机拿起来很多次，最后还是没有问“最近好吗”。如果你也想见我，我希望这一次不是靠我的暗示，而是你清清楚楚地走过来。",
      replies: ["你等的不是一句问候，是“我对你很重要”的证明。", "愿你等来的不是猜测，而是坦诚。"],
      quick: ["等一个明确答案", "今晚别熬夜"]
    },
    {
      mood: "等待 · 期待", time: "2 天前", empathy: 88, likes: 63,
      text: "提示音响起时，我还是会心跳一下。后来发现只是天气提醒，我笑了笑，把手机扣在桌上。喜欢没有消失，但我开始不让它支配每一个晚上。",
      replies: ["期待可以留着，生活也要继续向前。", "你不是拒绝爱，你是在给彼此一次主动选择的机会。"],
      quick: ["陪你等天亮", "先过好今天"]
    },
    {
      source: "高赞乐评改写", mood: "等待 · 双向", time: "3 天前", empathy: 232, likes: 181,
      text: "从前每次冷场都是我找新话题，每次见面也是我先问时间。这周我什么都没做，不是想用沉默惩罚你，只是想看看少了我的推动，我们之间还会不会继续发生。",
      replies: ["等待不是考验谁，而是确认这段关系是否真的有两个人。", "如果只有你在维持热度，那不是慢热，是单向消耗。"],
      quick: ["等一次他的主动", "别独自撑着"]
    },
    {
      source: "高赞乐评改写", mood: "等待 · 未读", time: "5 天前", empathy: 154, likes: 109,
      text: "我把手机铃声调到最大，洗澡也放在门边，怕错过你的消息。后来一整晚只有外卖和天气提醒。天亮时我突然明白，真正想找我的人，不会让我靠每一次震动来猜。",
      replies: ["让你安心的从来不是提示音，而是一个人明确的选择。", "今晚把手机调回静音，也把睡眠还给自己。"],
      quick: ["不再守着提示音", "先好好睡一觉"]
    },
    {
      source: "高赞乐评改写", mood: "等待 · 有期限", time: "1 周前", empathy: 201, likes: 149,
      text: "我依然期待你走过来，但不再把生活暂停在原地。我给这份等待一个期限：期限以内认真喜欢，期限以后认真生活。不是不深情，是终于学会也对自己负责。",
      replies: ["有期限的等待不是薄情，而是温柔地守住自己的边界。", "你可以期待重逢，也可以继续长成更完整的人。"],
      quick: ["等待也要有边界", "继续过好生活"]
    }
  ]
};
