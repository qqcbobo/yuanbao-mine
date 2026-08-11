/**
 * 检查 public/*.html 内嵌 <script> 的 JS 语法(无 DOM 环境,仅语法级校验)
 * 运行:node test/html_check.js(由 npm test 统一调用)
 */
'use strict';
var fs = require('fs');
var path = require('path');
var vm = require('vm');

var files = ['public/face-to-face.html', 'public/index.html'];
var failed = 0;

files.forEach(function (rel) {
  var p = path.join(__dirname, '..', rel);
  if (!fs.existsSync(p)) {
    console.log('SKIP ' + rel + ' (不存在)');
    return;
  }
  var src = fs.readFileSync(p, 'utf8');
  var m = src.match(/<script>([\s\S]*?)<\/script>/g) || [];
  m.forEach(function (block, i) {
    var code = block.replace(/^<script>/, '').replace(/<\/script>$/, '');
    try {
      new vm.Script(code, { filename: rel + '#script' + (i + 1) });
      console.log('OK   ' + rel + ' script#' + (i + 1) + ' (' + code.length + ' chars)');
    } catch (e) {
      failed++;
      console.error('FAIL ' + rel + ' script#' + (i + 1) + ': ' + e.message);
    }
  });
});

if (failed > 0) { console.error('\nHTML 内嵌脚本检查失败: ' + failed + ' 处'); process.exit(1); }
console.log('\nHTML 内嵌脚本全部通过语法检查');
