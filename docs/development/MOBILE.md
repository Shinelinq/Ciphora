# 移动端开发与能力适配

本文说明 Ciphora 在 Android / iOS 上的布局适配与功能调用能力，
以及构建前必须完成的系统权限注入步骤。

## 平台探测

前端通过统一的平台层 `src/lib/platform.js` 判断运行环境：

- 启动时先用 User-Agent 做**同步兜底**，避免首屏布局闪烁
- 随后调用后端 `get_app_info`（基于 `tauri-plugin-os`）获取真实平台并广播 `ciphora:platform` 事件
- `useMobile()` 会监听该事件，`isMobilePlatform()` 为真时始终使用移动布局（含横屏）

```js
import { getPlatform, isMobilePlatform } from '@/lib/platform';

getPlatform();        // 'android' | 'ios' | 'macos' | 'windows' | 'linux'
isMobilePlatform();   // boolean
```

## 移动端布局约定

- `useMobile()` 在 `<html>` 上切换 `.ciphora-mobile` 类，CSS 不依赖单一宽度断点
- 顶部栏 `MobileTopBar`：移动端品牌信息 + 退出登录
- 底部导航 `MobileBottomNav`：多语言，固定于安全区底部
- 全屏模态框、安全区（`env(safe-area-inset-*)`）、16px 输入字号均由 `src/styles/mobile.css` 处理

## 功能调用能力

| 能力 | 实现 | 说明 |
| --- | --- | --- |
| 文件导入 | `dialog.open` + `plugin-fs` | Android 的 `content://` URI 与 iOS 的安全作用域文件均可直读 |
| 文件导出 | `dialog.save` + `plugin-fs` | 用户选择保存位置后写入 |
| 剪贴板 | `copyToClipboard`（`src/lib/utils.js`） | `navigator.clipboard` 不可用时回退 `execCommand` |
| 相机扫码 | WebView `getUserMedia` | 需要系统相机权限，见下文 |
| 屏幕录制解码 | `getDisplayMedia` | 移动端自动隐藏该入口 |
| 打开链接 | `plugin-shell` `open` | 支持 `http(s)://`、`tel:`、`mailto:` |

### 权限配置

`src-tauri/capabilities/mobile.json` 已为移动端开放：

- `dialog:allow-open` / `dialog:allow-save`
- `fs:allow-read-text-file` / `fs:allow-write-text-file` / `fs:allow-read-file` / `fs:allow-write-file`
- 读取作用域覆盖 `$APPDATA`、`$DOWNLOAD`、`$DOCUMENT`、`$HOME` 以及 `**`（用于 iOS 沙箱外的用户所选文件）

### 相机权限（构建前必做）

`src-tauri/gen/android` 与 `src-tauri/gen/apple` 由 `tauri android/ios init`
生成且不入库，因此每次初始化后都需要重新注入相机权限：

```bash
npm run tauri:android:init
npm run mobile:permissions     # 脚本: scripts/patch-mobile-permissions.sh

npm run tauri:ios:init
npm run mobile:permissions
```

脚本会幂等地：

- 向 `AndroidManifest.xml` 注入 `android.permission.CAMERA` 与相机 feature
- 向 `Info.plist` 注入 `NSCameraUsageDescription`

CI（`.github/workflows/release.yml`）已在该步骤后自动执行。

## 构建

```bash
# Android
npm run tauri:android:init
npm run mobile:permissions
npm run tauri:android:build

# iOS（需要 macOS + Xcode）
npm run tauri:ios:init
npm run mobile:permissions
npm run tauri:ios:build
```

## 注意事项

- Android 相机的实时预览依赖系统运行时授权，首次使用会弹出系统授权框
- 若拒绝授权，仍可通过「导入图片 / 视频」方式离线解码 Cimbar 与二维码
- 屏幕录制解码仅桌面端可用，移动端按钮已自动隐藏