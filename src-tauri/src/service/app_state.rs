use tauri::AppHandle;
use zeroize::Zeroize;

use crate::{
    dao::{device, state},
    model::{AppSettings, AppState},
    service::settings,
    util::device as device_util,
};

/// 用途: 写入本次会话的主密码（明文，仅内存保留）; 输入: 状态与密码;
///       必要性: 覆盖旧值前先擦除，避免明文残留在堆内存。
pub fn set_session_password(state_ref: &AppState, password: &str) {
    let mut guard = state_ref.session_master_password.lock().unwrap();
    if let Some(existing) = guard.as_mut() {
        existing.zeroize();
    }
    *guard = Some(password.to_string());
}

/// 用途: 清空本次会话的主密码并擦除内存; 输入: 状态; 输出: ();
///       必要性: 登出 / 锁定 / 重置时销毁明文主密码。同时作废桥接短期会话。
pub fn clear_session_password(state_ref: &AppState) {
    let mut guard = state_ref.session_master_password.lock().unwrap();
    if let Some(mut existing) = guard.take() {
        existing.zeroize();
    }
    drop(guard);
    *state_ref.bridge_session.lock().unwrap() = None;
}

/// 用途: 读取本次会话主密码的临时副本; 输入: 状态; 输出: 可选密码。
pub fn session_password(state_ref: &AppState) -> Option<String> {
    state_ref.session_master_password.lock().unwrap().clone()
}

/// 用途: 擦除主密码哈希; 输入: 状态; 输出: (); 必要性: 重置初始化时销毁凭据。
pub fn clear_master_hash(state_ref: &AppState) {
    let mut guard = state_ref.master_password_hash.lock().unwrap();
    if let Some(mut existing) = guard.take() {
        existing.zeroize();
    }
}

/// 启动时同步加载状态
pub async fn initialize(app: &AppHandle, state_ref: &AppState) -> Result<(), String> {
    load_from_disk(app, state_ref, false).await
}

/// 确保状态已加载（仅在为空时加载）
pub async fn ensure_loaded(app: &AppHandle, state_ref: &AppState) -> Result<(), String> {
    load_from_disk(app, state_ref, false).await
}

/// 强制从磁盘重新加载所有状态（用于切换空间）
pub async fn reload(app: &AppHandle, state_ref: &AppState) -> Result<(), String> {
    load_from_disk(app, state_ref, true).await
}

/// 统一的加载逻辑
async fn load_from_disk(app: &AppHandle, state_ref: &AppState, force: bool) -> Result<(), String> {
    // 1. 加载主密码哈希
    if force || state_ref.master_password_hash.lock().unwrap().is_none() {
        let hash = state::load_master_hash(app).await?;
        *state_ref.master_password_hash.lock().unwrap() = hash;
    }

    // 2. 加载设备 ID
    if force || state_ref.device_id.lock().unwrap().is_none() {
        let device_id = match device::load_device_id(app).await? {
            Some(id) => id,
            None => {
                let new_id = device_util::generate_uuid();
                device::save_device_id(app, &new_id).await?;
                new_id
            }
        };
        *state_ref.device_id.lock().unwrap() = Some(device_id);
    }

    // 3. 加载设置（设置总是重新加载以确保同步）
    let loaded_settings: AppSettings = settings::load_settings(app).await?;
    *state_ref.settings.lock().unwrap() = loaded_settings;

    // 4. 重置认证状态（切换空间后必须重新登录）
    *state_ref.is_authenticated.lock().unwrap() = false;
    clear_session_password(state_ref);

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::AppState;

    #[test]
    fn session_password_set_replace_and_clear() {
        let state = AppState::default();
        assert!(session_password(&state).is_none());

        set_session_password(&state, "hunter2");
        assert_eq!(session_password(&state).as_deref(), Some("hunter2"));

        // 覆盖旧值（内部会先 zeroize 再写入）
        set_session_password(&state, "correct horse");
        assert_eq!(session_password(&state).as_deref(), Some("correct horse"));

        clear_session_password(&state);
        assert!(session_password(&state).is_none());
    }
}
