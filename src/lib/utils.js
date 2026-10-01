import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs) {
    return twMerge(clsx(inputs));
}

/**
 * 触发轻量触感反馈。
 * 仅在支持 Vibration API 的移动设备生效，桌面端与不支持时静默忽略。
 */
export function haptic(duration = 10) {
    try {
        if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
            navigator.vibrate(duration);
        }
    } catch {
        // 忽略：不支持触感反馈的环境
    }
}

/**
 * 跨平台复制文本。
 * 移动端 WebView 中 navigator.clipboard 可能不可用或被拒绝，
 * 因此提供 execCommand 兜底，保证移动端复制能力可用。
 */
export async function copyToClipboard(text) {
    if (text === undefined || text === null) return false;
    const value = String(text);

    try {
        if (typeof navigator !== 'undefined' && navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(value);
            return true;
        }
    } catch (error) {
        // 继续尝试兜底方案
    }

    try {
        const textarea = document.createElement('textarea');
        textarea.value = value;
        textarea.setAttribute('readonly', '');
        textarea.style.position = 'fixed';
        textarea.style.top = '-1000px';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        textarea.setSelectionRange(0, value.length);
        const ok = document.execCommand('copy');
        document.body.removeChild(textarea);
        return ok;
    } catch (error) {
        console.error('复制失败:', error);
        return false;
    }
}