# 部署指南 · 免费公网平台(微信朋友一起玩)

目标:把联机服务器部署到一个公网地址,微信好友点开链接就能进房间一起玩。

> 需要动手部署的人:您自己。账号注册需要手机号/邮箱验证,请按下面的步骤操作,卡住时把界面截图发给我,我一步步指导。
> 平台是免费的(免费额度足够日常玩),但免费实例空闲一段时间会休眠,第一次访问可能需要等 30~60 秒唤醒,属正常现象。

## 方案 A:Render(推荐,长期稳定)

1. 打开 https://render.com 注册账号(邮箱或 GitHub 登录)。
2. 右上角 **New +** → **Web Service**。
3. 选择 **Connect a repository**:需要先把这个项目推到 GitHub/GitLab 仓库(见下方「先决条件:把项目推到 GitHub」)。
4. 仓库选好后,Render 会自动识别,填写:
   - **Name**:任意,如 `yuanbao-mine`
   - **Region**:选离你近的(如 Singapore)
   - **Branch**:main
   - **Root Directory**:yuanbao-mine
   - **Runtime**:Node
   - **Build Command**:`npm install`
   - **Start Command**:`npm start`
   - **Instance Type**:Free
5. 点 **Create Web Service**,等 1~3 分钟部署完成。
6. 完成后页面顶部有你的公网地址,形如 `https://yuanbao-mine.onrender.com`。
7. 把 `https://yuanbao-mine.onrender.com` 发给微信朋友,点开 → 输入昵称 → 创建房间 → 把房间码/链接再发给其他朋友,即可开玩。

## 方案 B:Glitch(更简单,免命令行)

1. 打开 https://glitch.com 注册(建议 GitHub 登录)。
2. 点 **New Project** → **Import from GitHub**,输入你的仓库地址,等待导入。
3. 打开项目 → 左侧 **Tools** → **Terminal**,依次输入:
   ```
   cd yuanbao-mine
   npm install
   ```
4. 打开 `server/server.js`,把 `server.listen(...)` 前的 `var PORT = process.env.PORT || 3000;` 保持不动(Glitch 会自动注入 PORT)。
5. 项目会自动部署,地址形如 `https://你的项目名.glitch.me`(项目名在项目设置里可改)。
6. 把该地址发给微信朋友即可开玩。

## 先决条件:把项目推到 GitHub(两种方案都需要)

1. 打开 https://github.com 注册/登录。
2. 右上角 **+** → **New repository**,名称随意(如 `yuanbao-mine`),选 **Public**,创建。
3. 在本地项目目录执行(需要先安装 Git):

```bash
cd yuanbao-mine
git init
git add .
git commit -m "元宝地雷桌游"
git branch -M main
git remote add origin https://github.com/你的用户名/yuanbao-mine.git
git push -u origin main
```

> 注意:不要把 `node_modules` 推上去。项目里已准备 `.gitignore`。

## 微信内打开注意事项

- 微信内置浏览器对 `http://` 支持有限,**公网部署请务必走 HTTPS**(Render/Glitch 默认自带 HTTPS,无需配置)。
- 局域网内临时测试时,手机浏览器直接访问 `http://电脑IP:3000` 即可(需同一 WiFi,电脑防火墙放行 3000 端口),微信里可能打不开 http,此时用浏览器试玩更稳。
