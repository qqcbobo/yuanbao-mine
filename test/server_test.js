/**
 * 联机服务器集成测试:复用真实 server.js,模拟多客户端 WebSocket 全流程
 * 创建房间 → 加入 → 开局 → 轮流猜 → 结算 → 重置 → 离开
 * 运行:node test/server_test.js(由 npm test 统一调用)
 */
'use strict';
var WebSocket = require('ws');
var srv = require('../server/server.js');

var passed = 0, failed = 0;
function assert(cond, msg) {
  if (cond) { passed++; }
  else { failed++; console.error('FAIL: ' + msg); }
}
function eq(a, b, msg) {
  if (a === b) { passed++; }
  else { failed++; console.error('FAIL: ' + msg + ' (got ' + a + ', want ' + b + ')'); }
}

var inst = srv.createServer();
inst.server.listen(0, function () {
  var port = inst.server.address().port;
  run(port).then(function () {
    inst.server.close();
    console.log('\n联机集成测试: ' + passed + ' 通过, ' + failed + ' 失败');
    if (failed > 0) process.exit(1);
  }).catch(function (e) {
    console.error('测试异常: ' + e.stack);
    inst.server.close();
    process.exit(1);
  });
});

/* ---------- 测试客户端工具 ---------- */
function client(port) {
  var c = {
    ws: new WebSocket('ws://127.0.0.1:' + port),
    queue: [], waiters: [], playerId: null
  };
  c.ws.on('message', function (raw) {
    var msg = JSON.parse(raw.toString());
    if (msg.type === 'ok' && msg.playerId) c.playerId = msg.playerId;
    if (c.waiters.length) c.waiters.shift()(msg);
    else c.queue.push(msg);
  });
  c.send = function (obj) { c.ws.send(JSON.stringify(obj)); };
  c.next = function (timeout) {
    return new Promise(function (resolve, reject) {
      if (c.queue.length) resolve(c.queue.shift());
      else {
        var t = setTimeout(function () { reject(new Error('等待消息超时 @ ' + (c._tag || ''))); }, timeout || 3000);
        c.waiters.push(function (m) { clearTimeout(t); resolve(m); });
      }
    });
  };
  c.tag = function (t) { c._tag = t; return c; };
  c.nextT = function (label, timeout) {
    return c.next(timeout).then(function (m) {
      console.log('[' + c._tag + ':' + label + '] got ' + m.type + (m.state ? ' status=' + m.state.status + ' players=' + m.state.players.length + ' low=' + m.state.low + ' high=' + m.state.high : '') + (m.message ? ' msg=' + m.message : ''));
      return m;
    });
  };
  return new Promise(function (resolve, reject) {
    c.ws.on('open', function () { resolve(c); });
    c.ws.on('error', reject);
  });
}

async function run(port) {
  /* --- 场景 1:创建房间 --- */
  var host = await client(port); host.tag('host');
  host.send({ type: 'createRoom', name: '房主' });
  var m1 = await host.next();
  assert(m1.type === 'ok' && m1.code, '创建房间成功');
  var code = m1.code;
  eq(m1.state.players.length, 1, '创建后 1 名玩家');
  eq(m1.state.hostId, m1.playerId, '创建者是房主');

  /* --- 场景 2:两个玩家加入 --- */
  var p2 = await client(port); p2.tag('p2');
  p2.send({ type: 'joinRoom', code: code, name: '小明' });
  var m2 = await p2.next();
  assert(m2.type === 'ok', '玩家2加入成功');
  var m2b = await host.next();
  assert(m2b.type === 'state' && m2b.state.players.length === 2, '房主收到玩家2加入的状态广播');

  var p3 = await client(port); p3.tag('p3');
  p3.send({ type: 'joinRoom', code: code, name: '小红' });
  await p3.next();
  await host.next();
  await p2.next();

  /* --- 场景 3:非房主开局被拒 --- */
  p2.send({ type: 'startGame' });
  var m3 = await p2.next();
  assert(m3.type === 'error', '非房主开局被拒');

  /* --- 场景 4:房主固定元宝开局 --- */
  host.send({ type: 'startGame', seed: 78, mineSide: '+1' });
  var m4 = await host.next();
  assert(m4.type === 'state' && m4.state.started, '房主开局成功');
  eq(m4.state.treasure, 78, '元宝=78');
  eq(m4.state.mine, 79, '地雷=79');
  eq(m4.state.status, 'playing', '游戏进行中');
  eq(m4.state.players[0].name, '房主', '玩家顺序保留');
  await p2.next();
  await p3.next();

  /* --- 场景 5:轮流猜数 --- */
  // 当前轮到 host。非当前玩家猜被拒。
  p2.send({ type: 'guess', n: 25 });
  var m5 = await p2.next();
  assert(m5.type === 'error', '未轮到的人猜被拒');
  // host 猜 25 → 25~100
  host.send({ type: 'guess', n: 25 });
  var m6 = await host.next();
  assert(m6.type === 'state', 'host 猜 25 成功');
  eq(m6.state.low, 25, '范围下界=25');
  eq(m6.state.high, 100, '范围上界=100');
  eq(m6.state.players[m6.state.current].name, '小明', '轮到小明');
  await p2.next();
  await p3.next();

  // 小明猜 85 → 25~85
  p2.send({ type: 'guess', n: 85 });
  var m7 = await p2.next();
  assert(m7.type === 'state', '小明猜 85 成功');
  eq(m7.state.high, 85, '范围上界=85');
  eq(m7.state.players[m7.state.current].name, '小红', '轮到小红');
  await host.next();
  await p3.next();

  // 小红猜 78 → 命中元宝
  p3.send({ type: 'guess', n: 78 });
  var m8 = await p3.next();
  assert(m8.type === 'state' && m8.state.status === 'finished', '小红猜中元宝,游戏结束');
  assert(m8.state.result.type === 'treasure', '结果是元宝');
  eq(m8.state.winnerId, p3.playerId, '赢家是小红');
  await host.next();
  await p2.next();

  /* --- 场景 6:结束后不能再猜 --- */
  host.send({ type: 'guess', n: 60 });
  var m9 = await host.next();
  assert(m9.type === 'error', '结束后猜被拒');

  /* --- 场景 7:非房主重置被拒,房主重置成功 --- */
  p2.send({ type: 'resetRoom' });
  var m10 = await p2.next();
  assert(m10.type === 'error', '非房主重置被拒');
  host.send({ type: 'resetRoom' });
  var m11 = await host.next();
  assert(m11.type === 'state' && m11.state.started === false, '房主重置成功');
  eq(m11.state.players.length, 3, '重置后保留 3 名玩家');
  assert(m11.state.status === 'playing' && m11.state.history.length === 0, '重置后回到等待态');
  await p2.next();
  await p3.next();

  /* --- 场景 8:加入不存在的房间被拒 --- */
  var p4 = await client(port); p4.tag('p4');
  p4.send({ type: 'joinRoom', code: '9999', name: '路人' });
  var m12 = await p4.next();
  assert(m12.type === 'error', '加入不存在房间被拒');
  p4.ws.close();

  /* --- 场景 9:玩家离开后轮到逻辑 --- */
  // 固定元宝78/地雷79:猜50 → 50~100 仍含宝藏,必然成功
  host.send({ type: 'startGame', seed: 78, mineSide: '+1' });
  await host.next();
  await p2.next();
  await p3.next();
  // 当前轮到 host。host 猜一次 → 轮到小明。小明离开 → 应轮到小红。
  host.send({ type: 'guess', n: 50 });
  await host.next();
  await p2.next();
  await p3.next();
  p2.ws.close();
  await new Promise(function (r) { setTimeout(r, 600); });
  var m13 = await host.next();
  assert(m13.type === 'state', '离开广播到达');
  eq(m13.state.players.length, 2, '离开后剩 2 人');
  eq(m13.state.players[m13.state.current].name, '小红', '离开后轮到小红');

  p3.ws.close();
  host.ws.close();
}
