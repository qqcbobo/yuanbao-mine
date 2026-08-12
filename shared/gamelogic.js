/**
 * 元宝地雷 · 核心游戏逻辑(前后端共用)
 * 规则:
 *  1. 数字范围 1~100,每局随机设置一个「元宝」数字,以及一个与元宝相邻(±1)的「地雷」数字
 *  2. 玩家循环轮流猜数字,猜的数必须在当前范围内
 *  3. 猜的数比地雷小 → 成为新下界;比地雷大 → 成为新上界(范围收窄,永远包含地雷)
 *  4. 直到某人猜中元宝(得奖励)或地雷(受惩罚),游戏结束
 * 用法:node 环境 require;浏览器环境 window.GameLogic
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.GameLogic = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var MIN = 1;
  var MAX = 100;

  /* ---------------- 真心话 / 大冒险题库(各 50 条) ---------------- */
  var TRUTHS = [
    '你最近一次偷偷哭是因为什么?',
    '在场的人里,你觉得谁最有可能单身一辈子?为什么?',
    '你微信置顶聊天的人是谁(除家人外)?',
    '说出你做过最丢脸的一件事。',
    '你手机里最后一张照片是什么?给大家看看。',
    '你暗恋过在场的人吗?说真话。',
    '你一个月的生活费/零花钱大概多少?',
    '你上一次撒谎是什么时候?为了什么?',
    '你最想删除的手机联系人是谁?',
    '你觉得自己身上最自恋的一点是什么?',
    '如果必须在场的人里选一个当对象,你选谁?',
    '你收藏夹里最羞耻的东西是什么?',
    '你最长一次没洗澡是多久?',
    '说出你最近的体重或身高。',
    '你做过最冲动的一件事是什么?',
    '在场谁最有可能先脱单?理由。',
    '你上一次说"我爱你"是对谁?',
    '你曾经偷偷搜索过什么奇怪的东西?',
    '你觉得在场谁颜值最高?谁最低?',
    '你从小到大拿过几次奖学金/奖状?',
    '你最近一次熬夜是因为什么?',
    '你做过最尴尬的事是什么?',
    '你有过网恋经历吗?现在还有联系吗?',
    '你手机里存了多少张自拍?',
    '你最害怕什么东西?说真话。',
    '你上一次进医院是因为什么?',
    '你做过最抠门的一件事是什么?',
    '你的初吻还在吗?在什么情况下没的?',
    '你曾经偷偷哭过多少次?',
    '你最喜欢在场哪个人的性格?',
    '你见过最离谱的八卦是什么?',
    '你有没有偷偷看过别人的手机?',
    '你最想对过去的自己说什么?',
    '你晚上一个人在家会害怕吗?',
    '你做过最对不起朋友的一件事是什么?',
    '你现在最想和谁道歉?为什么?',
    '你上一次脸红是因为什么?',
    '你曾经追过星吗?为追星做过什么疯狂的事?',
    '你觉得自己颜值能打几分(满分10)?',
    '你有过把衣服穿反/穿倒的经历吗?',
    '你做过最幼稚的事是什么?',
    '你偷偷羡慕过在场谁?为什么?',
    '你最想穿越回人生的哪个阶段?',
    '你上一次生气到摔东西是什么时候?',
    '你的钱包/余额最多的时候有多少钱?',
    '你有没有悄悄许过愿?许的什么愿?',
    '你最想改掉自己哪个坏习惯?',
    '你曾经被家长/老师抓到过什么糗事?',
    '你现在最喜欢吃的一道菜是什么?',
    '如果明天是世界末日,你今天最想做什么?'
  ];
  var DARES = [
    '用方言朗读一首诗或一段话,大家满意为止。',
    '模仿在场一个人的经典动作,直到被猜出是谁。',
    '原地转 5 圈,然后走直线到门口再走回来。',
    '给通讯录里第 3 个人打电话,说"我想你了"。',
    '做一个你最不擅长的动物叫,比如学猪叫。',
    '用屁股写自己的名字(大家猜)。',
    '让在场的人轮流问你一个问题,必须如实回答。',
    '公主抱(或背)在场一个人绕一圈。',
    '学电视剧女主角撒娇说一句"讨厌"。',
    '吃一口柠檬/辣椒/芥末(如有),表情不许变。',
    '现场找一个人对视 30 秒,不许笑。',
    '用「哈哈哈」唱完一首歌的开头。',
    '把袜子穿在手上,做三个俯卧撑。',
    '模仿三种动物的走路姿势。',
    '对在场某个人说一句土味情话。',
    '倒立或靠墙倒立 10 秒(量力而行)。',
    '说出在场所有人的一个优点(每人至少一句)。',
    '用夸张的姿势走一个 T 台,摆 3 个造型。',
    '接受大家给你起的一个外号,并叫自己 3 次。',
    '做 10 个深蹲,边做边大声数数。',
    '给微信朋友圈发一条"我错了,我不该……",不许删。',
    '模仿海绵宝宝或蜡笔小新的声音说一段话。',
    '用一只手解自己的鞋带再系上。',
    '对镜子里的自己深情表白 30 秒。',
    '表演一段"哭戏",持续 10 秒以上。',
    '用头顶着书走 5 米不掉。',
    '学广场舞大妈跳 10 秒(扭起来)。',
    '把手机给在场的人,让 TA 帮你发一条朋友圈。',
    '说绕口令:"四是四,十是十",连说 3 遍。',
    '单脚站立 30 秒,另一只脚不许落地。',
    '用奇怪的腔调读一段新闻或广告词。',
    '模仿你老板/老师说话的样子。',
    '做一个"大力士"姿势,坚持 10 秒。',
    '让在场的人用手机给你拍一张最丑的自拍。',
    '学猫叫三声,再学狗叫三声。',
    '背起/抱起在场一个人(量力而行)。',
    '用嘴叼着笔写自己的名字。',
    '唱一首歌,歌词里必须有"我爱你"三个字。',
    '原地高抬腿跑 20 下,边跑边喊口号。',
    '给一个你很久没联系的人发"在吗?"。',
    '模仿电视剧里"霸道总裁"的台词。',
    '双手抱头做 5 个蹲起。',
    '用微信语音给朋友发一句土味情话。',
    '学机器人走路绕房间一圈。',
    '大声说出自己的一个秘密(在场人没听过的)。',
    '做"恭喜发财"的姿势 10 秒不许动。',
    '用三种不同语气说"你好讨厌"。',
    '模仿婴儿哭 5 秒。',
    '用身体摆出"大"字,坚持 10 秒。',
    '向在场每个人鞠躬说"您辛苦啦"。'
  ];

  /* ---------------- 工具 ---------------- */
  function randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  /* ---------------- 游戏创建 ---------------- */
  /**
   * 创建一局新游戏
   * @param {object} [opts] 可覆盖默认值:min, max, seed(测试用固定元宝), mineSide('+1'|'-1')
   */
  function createGame(opts) {
    opts = opts || {};
    var min = opts.min || MIN;
    var max = opts.max || MAX;
    // 元宝:默认真随机;测试可传入 seed
    var treasure = opts.seed !== undefined ? opts.seed : randInt(min, max);
    // 地雷:与元宝相邻。优先用户指定方向,否则随机选一边(须在范围内)
    var sides = [];
    if (treasure + 1 <= max) sides.push(1);
    if (treasure - 1 >= min) sides.push(-1);
    if (sides.length === 0) {
      throw new Error('元宝位置不合法:无法放置相邻地雷');
    }
    var dir = opts.mineSide === '+1' ? 1 : opts.mineSide === '-1' ? -1 : sides[randInt(0, sides.length - 1)];
    if (sides.indexOf(dir) === -1) dir = sides[0];
    var mine = treasure + dir;

    return {
      min: min,
      max: max,
      treasure: treasure,
      mine: mine,
      low: min,
      high: max,
      status: 'playing', // playing | finished
      players: [],       // {id, name}
      current: 0,        // 当前轮到 players[current]
      history: [],       // {playerId, name, guess, low, high, hit: 'treasure'|'mine'|null}
      winnerId: null,    // 猜中元宝者
      loserId: null,     // 猜中地雷者
      result: null       // {type:'treasure'|'mine', playerId, challenge:{type:'truth'|'dare', text, targetId?}}
    };
  }

  /* ---------------- 玩家管理 ---------------- */
  var _uid = 1;
  function addPlayer(game, name) {
    name = String(name || '').trim();
    if (!name) return { ok: false, error: '昵称不能为空' };
    var id = 'p' + (_uid++);
    game.players.push({ id: id, name: name });
    return { ok: true, player: { id: id, name: name } };
  }

  function removePlayer(game, playerId) {
    var idx = game.players.findIndex(function (p) { return p.id === playerId; });
    if (idx === -1) return { ok: false, error: '玩家不存在' };
    game.players.splice(idx, 1);
    // 修正当前指针
    if (game.players.length === 0) {
      game.current = 0;
    } else {
      if (idx < game.current) game.current--;
      if (game.current >= game.players.length) game.current = 0;
    }
    return { ok: true };
  }

  function currentPlayer(game) {
    if (game.players.length === 0) return null;
    return game.players[game.current] || null;
  }

  /* ---------------- 猜数字 ---------------- */
  /**
   * 玩家猜数字
   * @returns {object} {ok, hit?, result?, message?, state}
   */
  function guess(game, playerId, n) {
    if (game.status !== 'playing') return { ok: false, error: '本局已结束,请开始新一局' };
    if (!Number.isInteger(n)) return { ok: false, error: '请输入整数' };

    // 轮到谁
    var cur = currentPlayer(game);
    if (!cur) return { ok: false, error: '还没有玩家加入' };
    if (cur.id !== playerId) return { ok: false, error: '还没轮到你,当前轮到:' + cur.name };

    // 范围校验:必须在 [low, high] 内
    if (n < game.low || n > game.high) {
      return { ok: false, error: '超出范围,当前范围是 ' + game.low + ' ~ ' + game.high };
    }

    // 命中判定(优先):猜中元宝或地雷即结束
    var hit = null;
    if (n === game.treasure) hit = 'treasure';
    else if (n === game.mine) hit = 'mine';

    if (!hit) {
      // 边界数字(等于当前下界/上界)不是元宝/地雷 → 无法收窄,拒绝
      if (n === game.low || n === game.high) {
        return { ok: false, error: '数字 ' + n + ' 已是边界,没有收窄效果,请换个数字' };
      }
      // 收窄:猜的数保留「包含地雷」的半边(规则:只要不踩中地雷、不把地雷排除出范围就可以猜)。
      // 猜的数 < 地雷 → 成为新下界(范围 n~high,地雷仍在范围内)
      // 猜的数 > 地雷 → 成为新上界(范围 low~n,地雷仍在范围内)
      // 地雷与元宝相邻,范围包含地雷时元宝通常也在,游戏必然结束。
      if (n < game.mine) {
        game.low = n;
      } else {
        game.high = n;
      }
    }

    game.history.push({
      playerId: cur.id,
      name: cur.name,
      guess: n,
      low: game.low,
      high: game.high,
      hit: hit
    });

    if (hit === 'treasure') {
      game.status = 'finished';
      game.winnerId = cur.id;
      var tgt = pickRewardTarget(game, cur.id);  // 赢家指定一个参与者
      game.result = {
        type: 'treasure', playerId: cur.id, name: cur.name, guess: n,
        challenge: randomChallenge(),   // 服务端统一生成,所有人看到同一题目
        targetId: tgt.id,
        targetName: tgt.name
      };
    } else if (hit === 'mine') {
      game.status = 'finished';
      game.loserId = cur.id;
      game.result = {
        type: 'mine', playerId: cur.id, name: cur.name, guess: n,
        challenge: randomChallenge()   // 服务端统一生成,所有人看到同一题目
      };
    } else {
      // 轮到下一个人(循环)
      game.current = (game.current + 1) % game.players.length;
    }

    return { ok: true, hit: hit, game: game };
  }

  /* ---------------- 挑战(真心话/大冒险) ---------------- */
  /** 随机抽一个挑战(踩地雷惩罚 / 踩元宝给别人的题目) */
  function randomChallenge() {
    var type = Math.random() < 0.5 ? 'truth' : 'dare';
    var pool = type === 'truth' ? TRUTHS : DARES;
    return { type: type, text: pool[randInt(0, pool.length - 1)] };
  }

  /** 赢家随机指定一个参与人(不能是自己;人少时允许指定自己以外或退回自己) */
  function pickRewardTarget(game, winnerId) {
    var others = game.players.filter(function (p) { return p.id !== winnerId; });
    var pool = others.length > 0 ? others : game.players;
    return pool[randInt(0, pool.length - 1)];
  }

  /* ---------------- 导出 ---------------- */
  return {
    MIN: MIN,
    MAX: MAX,
    TRUTHS: TRUTHS,
    DARES: DARES,
    createGame: createGame,
    addPlayer: addPlayer,
    removePlayer: removePlayer,
    currentPlayer: currentPlayer,
    guess: guess,
    randomChallenge: randomChallenge,
    pickRewardTarget: pickRewardTarget,
    shuffle: shuffle,
    randInt: randInt
  };
});
