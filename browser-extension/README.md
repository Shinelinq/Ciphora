# Ciphora Autofill 浏览器扩展

Ciphora 的配套浏览器扩展（Manifest V3，支持 Chrome / Edge / Brave 等 Chromium 内核浏览器）。
它与本地运行的 Ciphora 桌面应用通过 **回环桥接（loopback bridge）** 通信，
实现账号 / 密码 / MFA 验证码的自动填充。

> 扩展自身 **不存储** 任何密码或密钥，所有数据都按需从桌面应用读取。

## 功能

- 🌐 打开即按当前网站自动匹配条目（唯一匹配时自动展开）
- 🔍 按网站 / 用户名搜索本地密码库
- ⌨️ 一键填充账号与密码（支持 Shadow DOM 登录组件）
- 🔐 读取并填充 TOTP / MFA 六位验证码（含倒计时）
- 🎲 调用桌面端密码生成器生成强密码
- 🪟 页面内**悬浮填充入口**（可开关，仅在含登录框的页面出现）
- 🔓 每次会话由**桌面端确认授权**（应用自动弹到前台），主密码不进入浏览器，不保存任何长期令牌
- 🔔 复制 / 填充 / 生成均有即时反馈
- 🧩 密码库锁定时自动拒绝读取，并提供重试入口

## 安装（开发者模式）

1. 打开 `chrome://extensions/`
2. 打开右上角「开发者模式」
3. 点击「加载已解压的扩展程序」，选择本目录 `browser-extension/`
4. 打开扩展的「选项」页

## 配置

1. 启动 Ciphora 桌面应用
2. 进入 **设置 → 基本设置 → 浏览器扩展桥接**，开启开关
3. 在扩展选项页填写与桌面端一致的 **监听端口** 并保存
4. 点击工具栏的扩展图标 → 「请求授权」，然后在弹出的桌面应用中点击「允许」

> 扩展**不保存任何长期令牌**，也不接触主密码：授权时桌面应用弹到前台由你确认，
> 批准后拿到仅存于浏览器内存的短期会话。关闭浏览器、库锁定或应用重启后需重新授权。

## 安全模型

| 措施 | 说明 |
| --- | --- |
| 默认关闭 | 需要用户在桌面端显式开启 |
| 仅回环监听 | 只绑定 `127.0.0.1`，不对局域网 / 外网开放 |
| 不持久化令牌 | 无长期令牌；数据接口需短期会话令牌，仅存内存，过期 / 锁定即失效 |
| 短期授权 | 在扩展点击授权 → 桌面应用弹到前台由用户确认 → 发放会话令牌（默认 15 分钟滑动过期） |
| 失败限流 | 授权请求与拒绝均受限流，60 秒内最多 5 次失败，超限返回 `429` |
| 来源白名单 | 仅接受浏览器扩展来源（或无 Origin 的本机调用），拒绝普通网页跨域读取 |
| 锁定即拒绝 | 密码库锁定时所有数据接口返回 `401` |
| 内存态主密码 | 主密码仅在本次解锁会话内保留，登出 / 锁定 / 重置即清空 |
| 扩展零持久化 | 会话令牌存于 `chrome.storage.session`（内存态，关闭浏览器即清除） |

若你的威胁模型不接受任何本地网络端口，请不要开启此功能。
桌面端的桥接实现位于 `src-tauri/src/service/bridge.rs`。

## 本地桥接协议（v1）

所有响应均为 JSON，错误统一为 `{ "error": string, "message": string }`。

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/status` | 公开。`{ app, version, locked, authorized }` |
| `POST` | `/authorize/start` | 公开。发起授权请求（桌面端弹到前台确认），返回 `{ requestId }` |
| `GET` | `/authorize/result?request=` | 公开。`{ status: pending\|approved\|denied\|expired, sessionToken? }` |
| `GET` | `/entries?q=` | 条目列表（不含密码 / 密钥） |
| `GET` | `/entry?id=` | 单条数据（含密码；不返回 TOTP 密钥，仅 `hasTotp`） |
| `GET` | `/totp?id=` | `{ totp, remaining }`（按 id 查询，密钥不出现在 URL 中） |
| `POST` | `/generate` | 生成密码，body：`{ length, includeUppercase, includeNumbers, includeSymbols }` |
| `POST` | `/lock` | 作废当前会话 |

除 `/status` 与 `/authorize/*` 外，请求头必须包含 `x-ciphora-session: <会话令牌>`。

## 目录结构

```
browser-extension/
├── manifest.json
├── icons/
└── src/
    ├── background.js   # service worker：代理所有桥接请求
    ├── content.js      # 内容脚本：识别并填充表单
    ├── popup.html/js/css
    ├── options.html/js
    └── shared.js
```