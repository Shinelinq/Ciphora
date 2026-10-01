#!/usr/bin/env bash
# 验证构建出的 AppImage 是否正确内嵌了应用图标。
#
# AppImage 桌面集成（appimaged / AppImageLauncher / AppImageHub）依赖
# AppDir 根目录下的 .DirIcon 以及 .desktop 文件中的 Icon= 字段。
# 若缺失，集成后的应用将显示为通用图标。
#
# 用法:
#   ./scripts/verify-appimage-icon.sh path/to/Ciphora_x.y.z_amd64.AppImage

set -euo pipefail

APPIMAGE="${1:-}"
if [[ -z "${APPIMAGE}" || ! -f "${APPIMAGE}" ]]; then
  echo "用法: $0 <path-to-AppImage>" >&2
  exit 2
fi

APPIMAGE="$(cd "$(dirname "${APPIMAGE}")" && pwd)/$(basename "${APPIMAGE}")"
EXTRACT_DIR="$(mktemp -d)"
cleanup() { rm -rf "${EXTRACT_DIR}"; }
trap cleanup EXIT

echo "==> 解包 $(basename "${APPIMAGE}")"
(
  cd "${EXTRACT_DIR}"
  "${APPIMAGE}" --appimage-extract >/dev/null 2>&1
)

ROOT="${EXTRACT_DIR}/squashfs-root"
if [[ ! -d "${ROOT}" ]]; then
  echo "❌ 未能找到解包后的 squashfs-root 目录" >&2
  exit 1
fi

status=0

if [[ -e "${ROOT}/.DirIcon" ]]; then
  echo "✅ 找到 .DirIcon -> $(readlink "${ROOT}/.DirIcon" 2>/dev/null || echo '<file>')"
else
  echo "❌ 缺少 .DirIcon，AppImage 集成将无法显示图标" >&2
  status=1
fi

DESKTOP_FILE="$(find "${ROOT}" -maxdepth 1 -name '*.desktop' | head -n1)"
if [[ -n "${DESKTOP_FILE}" ]]; then
  echo "✅ 找到桌面文件: $(basename "${DESKTOP_FILE}")"
  ICON_NAME="$(grep -E '^Icon=' "${DESKTOP_FILE}" | head -n1 | cut -d= -f2-)"
  echo "   Icon=${ICON_NAME}"
  if [[ -z "${ICON_NAME}" ]]; then
    echo "❌ 桌面文件缺少 Icon= 字段" >&2
    status=1
  fi
else
  echo "❌ 未找到 .desktop 文件" >&2
  status=1
fi

ICON_COUNT="$(find "${ROOT}/usr/share/icons" -name '*.png' 2>/dev/null | wc -l | tr -d ' ')"
echo "✅ hicolor 图标数量: ${ICON_COUNT}"
if [[ "${ICON_COUNT}" -eq 0 ]]; then
  echo "❌ usr/share/icons 下没有 PNG 图标" >&2
  status=1
fi

if [[ "${status}" -eq 0 ]]; then
  echo "🎉 AppImage 图标校验通过"
else
  echo "AppImage 图标校验失败" >&2
fi
exit "${status}"