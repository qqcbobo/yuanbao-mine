/**
 * 元宝地雷 · 联机服务器
 * Express 提供静态页面 + ws WebSocket 房间同步(服务端权威)
 * 用法:
 *   - 直接运行:node server/server.js(端口 env.PORT 或 3000)
 *   - 测试复用:var srv = require('./server.js'); srv.start(port)
 */
'use strict';
var path = require('path');
var http = require('http');
var express = require('express');
var WebSocket = require('ws');
var G = require('../shared/gamelogic.js');

/* ---------------- 房间管理 ---------------- */
var rooms = new Map(); // roomCode -> { code, game, sockets: Map<playerId, ws>, hostId, started }

function genCode() {
  var code;
  do { code = String(Math.floor(1000 + Math.random() * 9000)); } while (rooms.has(code));
  return code;
}

function roomState(room) {
  var g = room.game;
  return {
    code: room.code,
    hostId: room.hostId,
    started: room.started,
    min: g.min, max: g.max,
    treasure: g.treasure,
    mine: g.mine,
    low: g.low, high: g.high,
    status: g.status,
    players: g.players,
    current: g.current,
    history: g.history,
    winnerId: g.winnerId,
    loserId: g.loserId,
    result: g.result
  };
}

function broadcast(room, msg) {
  var data = JSON.stringify(msg);
  room.sockets.forEach(function (ws) {
    if (ws.readyState === WebSocket.OPEN) ws.send(data);
  });
}

function broadcastExcept(room, exceptWs, msg) {
  var data = JSON.stringify(msg);
  room.sockets.forEach(function (ws) {
    if (ws !== exceptWs && ws.readyState === WebSocket.OPEN) ws.send(data);
  });
}

function sendErr(ws, message) {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'error', message: message }));
}

function sendOk(ws, obj) {
  obj.type = 'ok';
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj));
}

/* 创建房间 */
function onCreate(ws, msg) {
  var name = String(msg.name || '').trim().slice(0, 10);
  if (!name) return sendErr(ws, '昵称不能为空');
  var code = genCode();
  var game = G.createGame();
  var r = G.addPlayer(game, name);
  if (!r.ok) return sendErr(ws, r.error);

  var room = { code: code, game: game, sockets: new Map(), hostId: r.player.id, started: false };
  room.sockets.set(r.player.id, ws);
  rooms.set(code, room);
  ws.roomCode = code;
  ws.playerId = r.player.id;

  sendOk(ws, { code: code, playerId: r.player.id, state: roomState(room) });
}

/* 加入房间 */
function onJoin(ws, msg) {
  var code = String(msg.code || '').trim();
  var name = String(msg.name || '').trim().slice(0, 10);
  if (!name) return sendErr(ws, '昵称不能为空');
  var room = rooms.get(code);
  if (!room) return sendErr(ws, '房间不存在,请检查房间码');
  if (room.sockets.size >= 20) return sendErr(ws, '房间已满(20人)');
  // 游戏进行中禁止中途加入(规则:游戏期间不允许玩家进来,一局结束后可以进)
  if (room.started && room.game.status === 'playing') {
    return sendErr(ws, '本局已在进行中,请等这局结束(房主开新局)后再加入');
  }
  var r = G.addPlayer(room.game, name);
  if (!r.ok) return sendErr(ws, r.error);

  room.sockets.set(r.player.id, ws);
  ws.roomCode = code;
  ws.playerId = r.player.id;

  sendOk(ws, { code: code, playerId: r.player.id, state: roomState(room) });
  broadcastExcept(room, ws, { type: 'state', state: roomState(room) });
}

/* 开始游戏:仅房主,可自定义元宝 */
function onStart(ws, msg) {
  if (!ws.roomCode) return sendErr(ws, '请先加入房间');
  var room = rooms.get(ws.roomCode);
  if (!room) return sendErr(ws, '房间不存在');
  if (ws.playerId !== room.hostId) return sendErr(ws, '只有房主可以开始游戏');
  if (room.game.players.length < 1) return sendErr(ws, '至少需要 1 名玩家');

  var players = room.game.players.slice();
  var opts = {};
  if (msg && typeof msg.seed === 'number' && msg.seed >= 1 && msg.seed <= 100) opts.seed = msg.seed;
  if (msg && (msg.mineSide === '+1' || msg.mineSide === '-1')) opts.mineSide = msg.mineSide;

  var game;
  try { game = G.createGame(opts); } catch (e) { return sendErr(ws, e.message); }
  game.players = players;
  room.game = game;
  room.started = true;
  broadcast(room, { type: 'state', state: roomState(room) });
}

/* 重置房间(仅房主):回等待室,保留玩家,可开新局 */
function onReset(ws) {
  if (!ws.roomCode) return sendErr(ws, '请先加入房间');
  var room = rooms.get(ws.roomCode);
  if (!room) return sendErr(ws, '房间不存在');
  if (ws.playerId !== room.hostId) return sendErr(ws, '只有房主可以重置房间');
  var oldPlayers = room.game.players.slice();
  room.game = G.createGame();
  // 保留仍在线玩家的身份(id 不变,socket 映射保持有效)
  room.game.players = oldPlayers.filter(function (p) { return room.sockets.has(p.id); });
  room.game.current = 0;
  room.started = false;
  broadcast(room, { type: 'state', state: roomState(room) });
}

/* 猜数字 */
function onGuess(ws, msg) {
  if (!ws.roomCode) return sendErr(ws, '请先加入房间');
  var room = rooms.get(ws.roomCode);
  if (!room) return sendErr(ws, '房间不存在');
  if (!room.started || room.game.status !== 'playing') return sendErr(ws, '游戏未在进行中');
  var n = parseInt(msg.n, 10);
  if (isNaN(n)) return sendErr(ws, '请输入整数');

  var r = G.guess(room.game, ws.playerId, n);
  if (!r.ok) return sendErr(ws, r.error);
  broadcast(room, { type: 'state', state: roomState(room) });
}

/* 离开 / 断线 */
function onLeave(ws) {
  if (!ws.roomCode) return;
  var room = rooms.get(ws.roomCode);
  if (!room) { ws.roomCode = null; return; }
  var pid = ws.playerId;
  room.sockets.delete(pid);
  if (pid === room.hostId) {
    // 房主离开:转移房主给最先加入者,或解散房间
    var next = room.sockets.keys().next();
    if (!next.done) room.hostId = next.value;
    else { rooms.delete(room.code); ws.roomCode = null; return; }
  }
  G.removePlayer(room.game, pid);
  if (room.sockets.size === 0) { rooms.delete(room.code); ws.roomCode = null; return; }
  broadcast(room, { type: 'state', state: roomState(room), notice: '玩家离开了房间' });
  ws.roomCode = null;
}

/* ---------------- 服务构建 ---------------- */
function createServer() {
  var app = express();
  app.use(express.static(path.join(__dirname, '..', 'public')));
  var server = http.createServer(app);
  var wss = new WebSocket.Server({ server: server });

  wss.on('connection', function (ws) {
    ws.roomCode = null;
    ws.playerId = null;

    ws.on('message', function (raw) {
      var msg;
      try { msg = JSON.parse(raw.toString()); } catch (e) { return sendErr(ws, '消息格式错误'); }

      switch (msg.type) {
        case 'createRoom': return onCreate(ws, msg);
        case 'joinRoom': return onJoin(ws, msg);
        case 'startGame': return onStart(ws, msg);
        case 'resetRoom': return onReset(ws);
        case 'guess': return onGuess(ws, msg);
        case 'leave': return onLeave(ws);
        default: sendErr(ws, '未知消息类型');
      }
    });

    ws.on('close', function () { onLeave(ws); });
  });

  return { app: app, server: server, wss: wss };
}

/* ---------------- 启动 ---------------- */
function start(port) {
  var s = createServer();
  s.server.listen(port || process.env.PORT || 3000, function () {
    var p = s.server.address().port;
    console.log('元宝地雷联机服务器已启动: http://localhost:' + p);
    console.log('本机局域网访问: http://<本机IP>:' + p + ' (同一WiFi可用)');
  });
  return s;
}

if (require.main === module) {
  start();
}

module.exports = { createServer: createServer, start: start };
