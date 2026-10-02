#!/usr/bin/env bash
# 为 Tauri 生成的 Android / iOS 工程注入移动端所需的系统权限。
#
# 由于 `src-tauri/gen` 由 `tauri android/ios init` 生成且不入库，
# 相机等权限必须在每次生成后重新注入。此脚本可安全重复执行。
#
# 用法:
#   ./scripts/patch-mobile-permissions.sh

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CHANGED=0

# ── Android: 相机权限（用于 Cimbar / 二维码扫描） ────────────────────────────
ANDROID_MANIFESTS="$(find "${ROOT_DIR}/src-tauri/gen/android" -name 'AndroidManifest.xml' 2>/dev/null || true)"
if [[ -n "${ANDROID_MANIFESTS}" ]]; then
  while IFS= read -r manifest; do
    [[ -z "${manifest}" ]] && continue
    if grep -q 'android.permission.CAMERA' "${manifest}"; then
      echo "✅ Android 相机权限已存在: ${manifest}"
    else
      # 在 <manifest ...> 标签之后插入权限声明
      python3 - "${manifest}" <<'PY'
import sys
path = sys.argv[1]
with open(path, "r", encoding="utf-8") as f:
    content = f.read()

if "android.permission.CAMERA" in content:
    sys.exit(0)

marker = ">"
idx = content.find("<manifest")
if idx == -1:
    sys.exit(0)
close = content.find(">", idx)
insert = (
    "\n    <uses-permission android:name=\"android.permission.CAMERA\" />"
    "\n    <uses-feature android:name=\"android.hardware.camera\" android:required=\"false\" />"
)
content = content[:close + 1] + insert + content[close + 1:]
with open(path, "w", encoding="utf-8") as f:
    f.write(content)
print(f"➕ 已注入 Android 相机权限: {path}")
PY
      CHANGED=1
    fi
  done <<< "${ANDROID_MANIFESTS}"
else
  echo "ℹ️  未找到 Android 工程（跳过，先运行 tauri android init）"
fi

# ── iOS: 相机用途说明（否则调用相机会被系统终止） ────────────────────────────
IOS_PLISTS="$(find "${ROOT_DIR}/src-tauri/gen/apple" -path '*/build/*' -prune -o -name 'Info.plist' -print 2>/dev/null || true)"
if [[ -n "${IOS_PLISTS}" ]]; then
  while IFS= read -r plist; do
    [[ -z "${plist}" ]] && continue
    if grep -q 'NSCameraUsageDescription' "${plist}"; then
      echo "✅ iOS 相机用途说明已存在: ${plist}"
    else
      python3 - "${plist}" <<'PY'
import sys
path = sys.argv[1]
with open(path, "r", encoding="utf-8") as f:
    content = f.read()

key = "NSCameraUsageDescription"
if key in content:
    sys.exit(0)

# 优先插入到 CFBundleShortVersionString 之后；否则插到最后一个 </dict> 之前
insert = (
    "\t<key>NSCameraUsageDescription</key>\n"
    "\t<string>Ciphora 需要使用相机扫描二维码以导入或传输加密数据。</string>\n"
)
anchor = content.rfind("</dict>")
if anchor == -1:
    sys.exit(0)
content = content[:anchor] + insert + content[anchor:]
with open(path, "w", encoding="utf-8") as f:
    f.write(content)
print(f"➕ 已注入 iOS 相机用途说明: {path}")
PY
      CHANGED=1
    fi
  done <<< "${IOS_PLISTS}"
else
  echo "ℹ️  未找到 iOS 工程（跳过，先运行 tauri ios init）"
fi

# ── iOS: 应用图标 ────────────────────────────────────────────────────────────
# `tauri ios init` 生成的 AppIcon.appiconset 不会采用 src-tauri/icons/ios 下的图标，
# 导致打包出的 App 使用错误的图标。这里在 init 后强制写入正确的图标。
IOS_APPICON_DIR="${ROOT_DIR}/src-tauri/gen/apple/Assets.xcassets/AppIcon.appiconset"
IOS_ICON_SRC="${ROOT_DIR}/src-tauri/icons/ios"
if [[ -d "${IOS_APPICON_DIR}" && -d "${IOS_ICON_SRC}" ]]; then
  if cmp -s "${IOS_ICON_SRC}/AppIcon-512@2x.png" "${IOS_APPICON_DIR}/AppIcon-512@2x.png" 2>/dev/null; then
    echo "✅ iOS 应用图标已就绪: ${IOS_APPICON_DIR}"
  else
    cp "${IOS_ICON_SRC}"/*.png "${IOS_APPICON_DIR}/"
    echo "➕ 已写入正确的 iOS 应用图标: ${IOS_APPICON_DIR}"
    CHANGED=1
  fi
else
  echo "ℹ️  未找到 iOS AppIcon.appiconset（跳过，先运行 tauri ios init）"
fi

if [[ "${CHANGED}" -eq 0 ]]; then
  echo "所有移动端权限均已就绪。"
fi