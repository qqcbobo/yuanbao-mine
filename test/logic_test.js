/**
 * 元宝地雷 · 核心逻辑单元测试
 * 运行:node test/logic_test.js
 */
'use strict';
var G = require('../shared/gamelogic.js');

var passed = 0, failed = 0;
function assert(cond, msg) {
  if (cond) { passed++; }
  else { failed++; console.error('FAIL: ' + msg); }
}
function eq(a, b, msg) {
  if (a === b) { passed++; }
  else { failed++; console.error('FAIL: ' + msg + ' (got ' + a + ', want ' + b + ')'); }
}

/* --- 1. 创建游戏:元宝/地雷相邻 --- */
for (var i = 0; i < 200; i++) {
  var g0 = G.createGame();
  assert(Math.abs(g0.treasure - g0.mine) === 1, 'treasure/mine 必须相邻: ' + g0.treasure + '/' + g0.mine);
  assert(g0.treasure >= 1 && g0.treasure <= 100, '元宝在范围内');
  assert(g0.mine >= 1 && g0.mine <= 100, '地雷在范围内');
}

/* --- 2. 固定元宝 78(地雷默认随机一边,强制 +1 → 79) --- */
var g = G.createGame({ seed: 78, mineSide: '+1' });
eq(g.treasure, 78, '元宝=78');
eq(g.mine, 79, '地雷=79(相邻+1)');
eq(g.low, 1, '初始下界1');
eq(g.high, 100, '初始上界100');

var r1 = G.addPlayer(g, '小明');
var r2 = G.addPlayer(g, '小红');
var r3 = G.addPlayer(g, '小刚');
assert(r1.ok && r2.ok && r3.ok, '添加3个玩家');
var p1 = r1.player.id, p2 = r2.player.id, p3 = r3.player.id;

/* --- 3. 第一个人猜 25 → 范围 25~100 --- */
var g1 = G.guess(g, p1, 25);
assert(g1.ok, '猜25应成功');
eq(g.low, 25, '猜25后下界=25');
eq(g.high, 100, '猜25后上界=100');

/* --- 4. 第二个人猜 85 → 范围 25~85 --- */
var g2 = G.guess(g, p2, 85);
assert(g2.ok, '猜85应成功');
eq(g.low, 25, '猜85后下界=25');
eq(g.high, 85, '猜85后上界=85');

/* --- 5. 轮流顺序:接下来应轮到第三个人 --- */
eq(G.currentPlayer(g).id, p3, '第三位轮到小刚');

/* --- 6. 超范围拒绝 --- */
var bad1 = G.guess(g, p3, 10);
assert(!bad1.ok, '猜10(低于下界25)应被拒');
var bad2 = G.guess(g, p3, 90);
assert(!bad2.ok, '猜90(高于上界85)应被拒');

/* --- 7. 边界数字无收窄效果 → 拒绝 --- */
var bad3 = G.guess(g, p3, 25);
assert(!bad3.ok, '猜边界25应被拒(无收窄)');
var bad4 = G.guess(g, p3, 85);
assert(!bad4.ok, '猜边界85应被拒(无收窄)');

/* --- 8. 未轮到的人猜 → 拒绝 --- */
var bad5 = G.guess(g, p1, 60);
assert(!bad5.ok, '未轮到的玩家猜应被拒');

/* --- 9. 新规则:猜的数保留「包含地雷」的半边。范围 25~85(元宝78/地雷79) --- */
// 猜 60 → 60~85(60<79→新下界)
var g3 = G.guess(g, p3, 60);
assert(g3.ok, '猜60应成功(60<79→新下界)');
eq(g.low, 60, '猜60后下界=60');
eq(g.high, 85, '猜60后上界=85');
assert(g.mine >= g.low && g.mine <= g.high, '猜60后地雷仍在范围内');

/* --- 9b. 猜 70 → 70~85(仍含地雷);此时轮到 p1 --- */
var g3b = G.guess(g, p1, 70);
assert(g3b.ok, '猜70应成功');
eq(g.low, 70, '猜70后下界=70');
eq(g.high, 85, '猜70后上界=85');
assert(g.mine >= g.low && g.mine <= g.high, '猜70后地雷仍在范围内');

/* --- 9c. 用户核心场景:新局元宝78/地雷79,猜 58 → 58~100(地雷仍在) --- */
var g58 = G.createGame({ seed: 78, mineSide: '+1' });
G.addPlayer(g58, '甲');
var j = g58.players[0].id;
var r58 = G.guess(g58, j, 58);
assert(r58.ok, '猜58应成功(58<79→新下界58~100)');
eq(g58.low, 58, '猜58后下界=58');
eq(g58.high, 100, '猜58后上界=100');
assert(g58.mine >= g58.low && g58.mine <= g58.high, '猜58后地雷仍在范围内');
var r85b = G.guess(g58, j, 85);
assert(r85b.ok, '猜85应成功(85>79→新上界58~85)');
eq(g58.high, 85, '猜85后上界=85');
assert(g58.mine >= g58.low && g58.mine <= g58.high, '猜85后地雷仍在范围内');

/* --- 10. 猜中元宝 78 结束 --- */
// 现在范围 70~85,轮到 p2。78 在范围内。让 p2 猜 78。
var g4 = G.guess(g, p2, 78);
assert(g4.ok && g4.hit === 'treasure', '猜78应命中元宝');
eq(g.status, 'finished', '游戏结束');
eq(g.winnerId, p2, '赢家是小红');
assert(g.result.type === 'treasure', '结果类型=treasure');

/* --- 11. 结束后不能再猜 --- */
var after = G.guess(g, p2, 79);
assert(!after.ok, '结束后猜应被拒');

/* --- 12. 地雷命中:新开一局 元宝78/地雷77 --- */
var g5 = G.createGame({ seed: 78, mineSide: '-1' });
eq(g5.mine, 77, '地雷=77(相邻-1)');
G.addPlayer(g5, 'A');
G.addPlayer(g5, 'B');
var a = g5.players[0].id, b = g5.players[1].id;
G.guess(g5, a, 50);   // 50~100
G.guess(g5, b, 80);   // 50~80
G.guess(g5, a, 65);   // 65~80(仍含77/78)
G.guess(g5, b, 77);   // 命中地雷
eq(g5.status, 'finished', '地雷命中后结束');
eq(g5.loserId, b, '输家是B');
assert(g5.result.type === 'mine', '结果类型=mine');

/* --- 13. 极端情况:元宝=100,地雷=99 --- */
var g6 = G.createGame({ seed: 100, mineSide: '-1' });
eq(g6.mine, 99, '元宝100地雷99');
G.addPlayer(g6, 'X');
var x = g6.players[0].id;
var x1 = G.guess(g6, x, 50);   // 50~100
assert(x1.ok, '猜50应成功');
var x2 = G.guess(g6, x, 75);   // 75~100
assert(x2.ok, '猜75应成功');
eq(g6.low, 75, '猜75后下界75');
var x3 = G.guess(g6, x, 99);   // 命中地雷
assert(x3.ok && x3.hit === 'mine', '猜99应命中地雷');
eq(g6.status, 'finished', '极端局结束');

/* --- 14. 挑战抽取 --- */
var c1 = G.randomChallenge();
assert((c1.type === 'truth' || c1.type === 'dare') && c1.text, '挑战抽取有效');
assert(G.TRUTHS.length >= 10 && G.DARES.length >= 10, '题库不少于10条');

/* --- 15. 赢家指定目标(不能是自己,多人) --- */
var g7 = G.createGame({ seed: 50, mineSide: '+1' });
G.addPlayer(g7, 'A'); G.addPlayer(g7, 'B'); G.addPlayer(g7, 'C');
var wa = g7.players[0].id;
var tgt = G.pickRewardTarget(g7, wa);
assert(tgt.id !== wa, '奖励目标不能是赢家自己(有其他人时)');

/* --- 16. 移除玩家后轮到逻辑正确 --- */
var g8 = G.createGame({ seed: 30, mineSide: '+1' });
G.addPlayer(g8, 'A'); G.addPlayer(g8, 'B'); G.addPlayer(g8, 'C');
var ids = g8.players.map(function (p) { return p.id; });
G.guess(g8, ids[0], 10); // 现在轮到 B(ids[1])
G.removePlayer(g8, ids[1]); // 移除 B → 应轮到 C
eq(G.currentPlayer(g8).id, ids[2], '移除当前玩家后轮到C');

/* --- 17. 单人可玩:模拟直到结束 --- */
var g9 = G.createGame({ seed: 42, mineSide: '+1' });
G.addPlayer(g9, 'Solo');
var s = g9.players[0].id;
var steps = 0;
while (g9.status === 'playing' && steps < 100) {
  var cur = G.currentPlayer(g9).id;
  var lo = g9.low, hi = g9.high;
  var guessN = null;
  // 依次尝试范围内的非边界数,选第一个能成功(不排除宝藏)的
  for (var n = lo + 1; n <= hi - 1; n++) {
    var r = G.guess(g9, cur, n);
    if (r.ok) { guessN = n; break; }
  }
  if (guessN === null) {
    // 只剩元宝/地雷相邻:直接猜元宝
    var r0 = G.guess(g9, cur, g9.treasure);
    assert(r0.ok, '直接猜元宝应结束: ' + (r0.error || ''));
  }
  steps++;
}
assert(g9.status === 'finished', '单人局最终应结束');
assert(g9.history.length > 0, '单人局有历史记录');
console.log('\n测试完成: ' + passed + ' 通过, ' + failed + ' 失败');
if (failed > 0) process.exit(1);
