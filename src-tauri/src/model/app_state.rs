use std::sync::Mutex;
use std::time::Instant;

use super::AppSettings;

/// 浏览器扩展桥接的短期授权会话（仅内存，进程退出即失效）。
pub struct BridgeSession {
    pub token: String,
    pub expires_at: Instant,
}

/// 浏览器扩展的待处理授权请求。
pub struct PendingBridgeAuth {
    pub id: String,
    pub created: Instant,
    pub decision: Option<bool>,
}

/// 用途: 保存应用运行时状态; 输入: 由 Tauri 状态管理注入; 输出: 服务层共享的线程安全数据; 必要性: 所有命令都依赖它判断认证及配置。
pub struct AppState {
    pub master_password_hash: Mutex<Option<String>>,
    /// 仅在本次解锁会话内保留的主密码，用于浏览器扩展桥接按需解密。
    /// 登出 / 锁定 / 重置时会被清空。
    pub session_master_password: Mutex<Option<String>>,
    /// 浏览器扩展桥接监听是否已成功绑定（用于设置页展示真实状态）。
    pub bridge_running: Mutex<bool>,
    /// 桥接最近一次启动失败的原因（如端口被占用）。
    pub bridge_last_error: Mutex<Option<String>>,
    /// 当前有效的桥接短期会话；为空表示扩展尚未授权或会话已过期。
    pub bridge_session: Mutex<Option<BridgeSession>>,
    /// 待处理的扩展授权请求（等待用户在桌面端确认）。
    pub bridge_auth_request: Mutex<Option<PendingBridgeAuth>>,
    /// 桥接授权失败的最近时间点，用于失败限流。
    pub bridge_auth_failures: Mutex<Vec<Instant>>,
    pub is_authenticated: Mutex<bool>,
    pub device_id: Mutex<Option<String>>,
    pub settings: Mutex<AppSettings>,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            master_password_hash: Mutex::new(None),
            session_master_password: Mutex::new(None),
            bridge_running: Mutex::new(false),
            bridge_last_error: Mutex::new(None),
            bridge_session: Mutex::new(None),
            bridge_auth_request: Mutex::new(None),
            bridge_auth_failures: Mutex::new(Vec::new()),
            is_authenticated: Mutex::new(false),
            device_id: Mutex::new(None),
            settings: Mutex::new(AppSettings::default()),
        }
    }
}

