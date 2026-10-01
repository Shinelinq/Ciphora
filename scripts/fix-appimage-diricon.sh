#!/usr/bin/env bash
# 为 Tauri 生成的 AppImage 补上 AppDir 根目录的 .DirIcon。
#
# AppImage 规范要求 AppDir 顶层存在 .DirIcon（通常为 256×256 PNG）；
# 缺失时 appimagetool / appimaged / AppImageHub 无法显示应用图标，收录测试会失败。
# Tauri 的打包器不生成该文件，因此这里在构建后解包、写入再重新打包。
#
# 用法:
#   ./scripts/fix-appimage-diricon.sh path/to/Ciphora_x.y.z_amd64.AppImage
#
# 依赖: curl（下载 appimagetool）。无 FUSE 环境会自动使用 --appimage-extract-and-run。

set -euo pipefail

APPIMAGE="${1:-}"
if [[ -z "${APPIMAGE}" || ! -f "${APPIMAGE}" ]]; then
  echo "用法: $0 <path-to-AppImage>" >&2
  exit 2
fi

APPIMAGE="$(cd "$(dirname "${APPIMAGE}")" && pwd)/$(basename "${APPIMAGE}")"
WORKDIR="$(mktemp -d)"
trap 'rm -rf "${WORKDIR}"' EXIT
cd "${WORKDIR}"

echo "==> 解包 $(basename "${APPIMAGE}")"
"${APPIMAGE}" --appimage-extract >/dev/null 2>&1

ROOT="${WORKDIR}/squashfs-root"
if [[ ! -d "${ROOT}" ]]; then
  echo "❌ 未找到解包后的 squashfs-root" >&2
  exit 1
fi

if [[ -e "${ROOT}/.DirIcon" ]]; then
  echo "✅ 已存在 .DirIcon，无需修补"
  exit 0
fi

# 优先 256×256 图标，否则取最大的 PNG
ICON="$(find "${ROOT}/usr/share/icons" -path '*256x256*' -name '*.png' 2>/dev/null | head -n1 || true)"
if [[ -z "${ICON}" ]]; then
  ICON="$(find "${ROOT}/usr/share/icons" -name '*.png' 2>/dev/null | sort | tail -n1 || true)"
fi
if [[ -z "${ICON}" ]]; then
  echo "❌ 未找到可用的 PNG 图标" >&2
  exit 1
fi

cp "${ICON}" "${ROOT}/.DirIcon"
echo "==> 已写入 .DirIcon（来源 ${ICON#"${ROOT}"/}）"

# 获取 appimagetool
TOOL="${APPIMAGETOOL:-}"
if [[ -z "${TOOL}" ]]; then
  case "$(uname -m)" in
    x86_64|amd64) TOOL_ARCH=x86_64 ;;
    aarch64|arm64) TOOL_ARCH=aarch64 ;;
    *) echo "❌ 不支持的架构 $(uname -m)" >&2; exit 1 ;;
  esac
  TOOL="${WORKDIR}/appimagetool"
  echo "==> 下载 appimagetool (${TOOL_ARCH})"
  curl -fsSL -o "${TOOL}" \
    "https://github.com/AppImage/appimagetool/releases/download/continuous/appimagetool-${TOOL_ARCH}.AppImage"
  chmod +x "${TOOL}"
fi

echo "==> 用 appimagetool 重新打包"
OUT="${APPIMAGE}.patched"
# 无 FUSE 时需 extract-and-run；extract-and-run 由 AppImage 运行时环境变量控制
APPIMAGE_EXTRACT_AND_RUN=1 "${TOOL}" --no-appstream "${ROOT}" "${OUT}"

if [[ ! -f "${OUT}" ]]; then
  echo "❌ 重新打包失败" >&2
  exit 1
fi

mv -f "${OUT}" "${APPIMAGE}"
chmod +x "${APPIMAGE}"
echo "✅ 已修补: ${APPIMAGE}"