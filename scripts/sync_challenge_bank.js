/**
 * 同步题库脚本:从 shared/gamelogic.js 提取 TRUTHS/DARES,替换两个 HTML 内嵌数组
 * 用法:node scripts/sync_challenge_bank.js
 */
'use strict';
var fs = require('fs');
var path = require('path');

var root = path.join(__dirname, '..');
var core = fs.readFileSync(path.join(root, 'shared', 'gamelogic.js'), 'utf8');

function extractArray(src, varName) {
  var start = src.indexOf('var ' + varName + ' = [');
  if (start === -1) throw new Error('未找到 ' + varName);
  var end = src.indexOf('\n  ];', start);
  if (end === -1) throw new Error('未找到 ' + varName + ' 结束');
  return src.slice(start, end + 5); // 包含 'var X = [...]' 到 '  ];'
}

var truthsBlock = extractArray(core, 'TRUTHS');
var daresBlock = extractArray(core, 'DARES');

function countItems(block) {
  var m = block.match(/'[^']*'/g);
  return m ? m.length : 0;
}
console.log('核心题库: TRUTHS=' + countItems(truthsBlock) + ', DARES=' + countItems(daresBlock));

var targets = ['public/face-to-face.html', 'public/index.html'];
targets.forEach(function (rel) {
  var p = path.join(root, rel);
  var html = fs.readFileSync(p, 'utf8');
  var reTruths = /var TRUTHS = \[[\s\S]*?\n  \];/;
  var reDares = /var DARES = \[[\s\S]*?\n  \];/;
  if (!reTruths.test(html) || !reDares.test(html)) {
    console.error('FAIL ' + rel + ': 未匹配到数组(注意 index.html 可能不含题库)');
    return;
  }
  var out = html.replace(reTruths, truthsBlock).replace(reDares, daresBlock);
  fs.writeFileSync(p, out, 'utf8');
  console.log('OK   ' + rel + ' 题库已同步');
});
