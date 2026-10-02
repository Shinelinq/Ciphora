# Ciphora 浏览器扩展使用指南

配套的 **Manifest V3** 扩展（Chrome / Edge / Brave）让你在浏览器里直接使用本地 Ciphora 密码库。
密码不离开你的电脑，也**不会进入浏览器存储**。

---

## 它能做什么

| 功能 | 说明 |
| --- | --- |
| 🔎 登录页自动填充 | 域名与某条记录**精确匹配且唯一**时，自动填入账号密码 |
| 🪟 悬浮填充按钮 | 页面右下角的一键填充入口（可选开启） |
| 🔐 MFA / TOTP | 显示并填充当前 6 位验证码（含倒计时） |
| 🔔 站点匹配搜索 | 打开弹窗自动匹配当前网站，唯一匹配时自动展开 |
| 🎲 密码生成器 | 一键生成强密码并复制 |
| 🌐 中英双语 | 跟随浏览器语言 |

---

## 快速开始（3 步）

### 1. 桌面端开启桥接
打开 Ciphora 桌面应用 → **设置 → 基本设置 → 浏览器扩展桥接** → 打开开关。
（**默认关闭**，端口默认 `37123`；开启后该栏会显示 🟢「运行中」）

### 2. 浏览器加载扩展
**方式 A（源码）**
1. 打开 `chrome://extensions`
2. 打开右上角 **开发者模式**
3. 点 **加载已解压的扩展程序**，选择仓库中的 `browser-extension/` 目录

**方式 B（发布包）**
下载 `ciphora-extension-*.zip` → 解压 → 同样用「加载已解压的扩展程序」选择解压出的目录

### 3. 授权
点工具栏的 Ciphora 图标 → **请求授权** → 桌面应用会自动弹到前台 → 点 **允许**。

> 授权前请先在桌面应用解锁密码库。

---

## 日常使用

- **打开弹窗**：自动按当前网站匹配条目；只匹配到一条时自动展开详情。
- **自动填充**：进入登录页时，若域名与唯一一条记录精确匹配，自动填入账号密码，并提示「Ciphora 已自动填充」。
- **悬浮按钮**：在扩展 **选项** 中开启「在网页显示悬浮填充按钮」；含登录框的页面右下角会出现箭头，点击展开匹配条目。
- **复制 / 填充**：密码、用户名、验证码均可一键复制；验证码/密码可填充到当前页面。
- **退出授权**：弹窗右上角 ⏻ 按钮。

---

## 相关设置（扩展「选项」页）

| 设置 | 说明 |
| --- | --- |
| 桥接端口 | 需与桌面端「监听端口」一致（默认 `37123`） |
| 登录页按域名自动填充 | 默认开启；仅精确域名匹配且唯一时生效 |
| 在网页显示悬浮填充按钮 | 默认关闭 |

---

## 安全说明

- 桥接**仅监听 `127.0.0.1`**，且**默认关闭**，不对局域网 / 外网开放。
- **不保存任何长期令牌**：授权得到的是短期会话，**仅存于浏览器内存**，关闭浏览器、锁定库或重启应用后需重新授权。
- **主密码不会进入浏览器**：授权在桌面应用中确认。
- 网页发起的请求会被 **Origin 来源白名单** 拒绝；授权失败有限流保护。
- 库锁定时，所有数据接口立即返回 `401`。
- 自动填充采用**精确可注册域名**匹配，绝不做模糊匹配。

---

## 常见问题

**连不上 / 一直显示未授权？**
- 确认桌面应用正在运行，且桥接已开启；
- 确认扩展选项里的端口与桌面端一致；
- 确认密码库已在桌面端解锁。

**登录页没有自动填充？**
- 该记录的**域名**需可识别：请在条目里填写 `网址`（如 `https://github.com`），或让 `网站名` 就是域名；
- 同一域名下需**只有一条**匹配记录，多条时会交给悬浮按钮/弹窗手动选择。

**授权后关闭浏览器又要重新授权？**
- 这是设计如此：会话只存于浏览器内存，不落盘。

---

## English (Summary)

A Manifest V3 extension (Chrome/Edge/Brave) that autofills logins and TOTP from your local Ciphora vault.

1. **Desktop**: Settings → General → Browser extension bridge → enable (off by default, port `37123`).
2. **Browser**: `chrome://extensions` → Developer mode → Load unpacked → select `browser-extension/` (or unzip `ciphora-extension-*.zip`).
3. **Authorize**: click the extension icon → *Request authorization* → click **Allow** in the desktop app.

Features: domain-matched autofill, optional floating fill button, TOTP fill, site-aware search, password generator, zh/en UI.

Security: loopback-only and off by default; no long-lived token (short-lived in-memory session); master password never enters the browser; web-page requests blocked by an Origin allowlist; `401` whenever the vault is locked; exact registrable-domain matching only.