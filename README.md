# 健康日记 — 偏头痛与经期记录

一款轻量级 PWA 应用，帮助你在手机上便捷记录偏头痛发作和生理期，查看统计趋势与关联分析。

**在线体验**：[https://161mubi.github.io/CareforHealth/](https://161mubi.github.io/CareforHealth/)

## 功能特色

### 记录偏头痛

分步表单设计，减少单屏信息量：

- **第 1 步（核心）**：发作时间、结束时间、疼痛部位、严重程度 — 着急时可直接保存
- **第 2 步（症状）**：伴随症状、前驱症状、可能诱因、天气、睡眠、饮食
- **第 3 步（用药）**：缓解方法、止痛药（支持多种药物）、头痛后症状、备注

### 记录经期

记录经期开始/结束日期、持续天数、周期天数等。

### 日历视图

- 按月查看偏头痛和经期的分布
- 紫色标记偏头痛日、粉色标记经期日
- 支持快速跳转到指定年月

### 历史记录

- 按时间倒序浏览所有记录
- 支持关键词搜索（部位、诱因、药物名等）
- 支持按日期范围、严重程度筛选
- 点击记录可查看详情、编辑或删除（删除后 5 秒内可撤销）

### 统计分析

- **偏头痛年度统计**：月度发作趋势、严重程度分布、疼痛部位分布、常见诱因
- **年度变化对比**：选择多个年份对比发作次数、严重程度等
- **关联分析**：按星期几统计、按天气统计、经期关联分析、持续时长统计
- **经期周期年度统计**：经期持续天数、周期天数趋势

### 云端同步（可选）

- 支持邮箱注册/登录，数据自动同步到 Firebase 云端
- 注册时可设置昵称，登录后在设置页随时修改
- 跨设备访问：手机、平板、电脑数据自动同步
- 退出登录后自动清除本地缓存，保护隐私
- 也可纯本地使用，无需注册

### 其他功能

- 暗色模式
- 数据导出/导入（JSON 格式）
- 自定义选项（伴随症状、诱因、缓解方法等均可添加/删除选项）
- 定期备份提醒

## 在手机上使用

### 方式一：直接访问（推荐）

用手机浏览器打开在线地址即可使用，无需安装。

### 方式二：添加到主屏幕（PWA）

添加后可像原生 App 一样全屏使用，并支持离线访问。

**iPhone / iPad**：
1. 用 Safari 打开在线地址
2. 点击底部分享按钮（方框+箭头图标）
3. 选择「添加到主屏幕」
4. 点击「添加」

**Android**：
1. 用 Chrome 打开在线地址
2. 点击右上角菜单（三个点）
3. 选择「添加到主屏幕」或「安装应用」
4. 确认安装

### 方式三：自行部署

如果你想拥有自己的独立实例：

1. Fork 本仓库
2. 进入仓库 Settings → Pages → Source 选择 "GitHub Actions"
3. 推送任意提交后会自动部署到 `https://你的用户名.github.io/CareforHealth/`

如需启用云端同步，还需：

4. 在 [Firebase Console](https://console.firebase.google.com/) 创建项目
5. 启用 Authentication（邮箱/密码登录）和 Cloud Firestore
6. 注册 Web 应用，将 `firebaseConfig` 填入 `app/firebase-config.js` 顶部的 `FIREBASE_CONFIG`

或在本地运行：

```bash
cd app
python3 -m http.server 8765
# 打开 http://localhost:8765
```

## 数据说明

- **本地模式**：数据存储在浏览器本地（localStorage），不会上传到任何服务器，不同设备/浏览器的数据相互独立
- **云端模式**：注册登录后，数据自动同步到 Firebase Cloud Firestore（服务器位于亚太地区），支持跨设备访问
- 建议定期通过「设置 → 导出数据」备份为 JSON 文件
- 换设备时可通过「设置 → 导入数据」恢复，或登录同一账号自动同步

## 技术栈

- HTML + CSS + JavaScript（原生，无框架依赖）
- PWA（Service Worker + Web App Manifest）
- Firebase Authentication + Cloud Firestore（可选云端同步）
- GitHub Actions 自动部署到 GitHub Pages

## 项目结构

```
app/
├── index.html          # 页面结构
├── style.css           # 样式
├── app.js              # 应用逻辑
├── firebase-config.js  # Firebase 配置与云端同步
├── manifest.json       # PWA 配置
└── sw.js               # Service Worker
```

## 许可

MIT License
