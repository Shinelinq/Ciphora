//! 浏览器扩展本地桥接。
//!
//! 设计原则（安全优先）:
//! - 默认关闭，需用户在「设置 → 浏览器扩展」中显式开启。
//! - 仅监听 `127.0.0.1`，不对外网暴露。
//! - 不持久化任何访问令牌：数据接口需要**短期会话令牌**，
//!   由用户在**桌面端确认**后换取短期会话，仅存于内存，过期/锁定即失效。
//! - 主密码仅在本次解锁会话内保留在内存中，登出/锁定即清空。
//! - 数据接口仅在库处于解锁状态时返回明文；锁定后立即返回 401。

#![cfg(not(any(target_os = "android", target_os = "ios")))]

use std::collections::HashMap;
use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

use serde_json::{json, Value};
use tauri::{AppHandle, Emitter, Manager};

use crate::{
    dao::storage,
    model::{AppState, BridgeSession, PasswordEntry, PendingBridgeAuth},
    service::mfa,
    util::{constants::PASSWORD_FILE, crypto},
};

/// 桥接短期会话有效期（滑动续期）。
const SESSION_TTL: Duration = Duration::from_secs(15 * 60);
/// 授权请求等待用户在桌面端确认的有效期。
const AUTH_REQUEST_TTL: Duration = Duration::from_secs(120);
/// 授权失败限流窗口与阈值。
const AUTH_WINDOW: Duration = Duration::from_secs(60);
const AUTH_MAX_FAILURES: usize = 5;

/// 用途: 启动桥接守护线程; 输入: AppHandle; 输出: (); 必要性: 设置开启后可访问本地库。
pub fn start(app: AppHandle) {
    std::thread::spawn(move || watch_loop(app));
}

/// 轮询设置并在需要时绑定 / 解绑监听端口。
fn watch_loop(app: AppHandle) {
    let mut listener: Option<TcpListener> = None;
    let mut bound_port: u16 = 0;

    loop {
        let (enabled, port) = {
            let state = app.state::<AppState>();
            let settings = state.settings.lock().unwrap();
            (settings.browser_bridge.enabled, settings.browser_bridge.port)
        };

        if !enabled {
            // 关闭时释放端口并作废会话与待处理授权
            listener = None;
            bound_port = 0;
            *app.state::<AppState>().bridge_session.lock().unwrap() = None;
            *app.state::<AppState>().bridge_auth_request.lock().unwrap() = None;
            set_bridge_status(&app, false, None);
            std::thread::sleep(Duration::from_millis(500));
            continue;
        }

        if listener.is_none() || bound_port != port {
            listener = None;
            match TcpListener::bind(("127.0.0.1", port)) {
                Ok(l) => {
                    let _ = l.set_nonblocking(true);
                    listener = Some(l);
                    bound_port = port;
                    set_bridge_status(&app, true, None);
                    println!("[bridge] listening on 127.0.0.1:{}", port);
                }
                Err(e) => {
                    eprintln!("[bridge] failed to bind 127.0.0.1:{}: {}", port, e);
                    set_bridge_status(
                        &app,
                        false,
                        Some(format!("无法监听 127.0.0.1:{}（端口可能已被占用）", port)),
                    );
                    std::thread::sleep(Duration::from_secs(3));
                    continue;
                }
            }
        }

        if let Some(l) = listener.as_ref() {
            match l.accept() {
                Ok((stream, _)) => {
                    let app_handle = app.clone();
                    std::thread::spawn(move || {
                        let _ = handle_connection(stream, &app_handle);
                    });
                }
                Err(ref e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                    std::thread::sleep(Duration::from_millis(200));
                }
                Err(_) => std::thread::sleep(Duration::from_millis(500)),
            }
        }
    }
}

/// 用途: 更新桥接运行状态供设置页展示; 输入: AppHandle、是否运行、错误信息; 输出: ()。
fn set_bridge_status(app: &AppHandle, running: bool, error: Option<String>) {
    let state = app.state::<AppState>();
    *state.bridge_running.lock().unwrap() = running;
    *state.bridge_last_error.lock().unwrap() = error;
}

fn find_header_end(buf: &[u8]) -> Option<usize> {
    buf.windows(4).position(|w| w == b"\r\n\r\n").map(|p| p + 4)
}

fn split_target(target: &str) -> (String, HashMap<String, String>) {
    let (path, query) = match target.split_once('?') {
        Some((p, q)) => (p.to_string(), q),
        None => (target.to_string(), ""),
    };
    let mut params = HashMap::new();
    for pair in query.split('&').filter(|s| !s.is_empty()) {
        if let Some((k, v)) = pair.split_once('=') {
            params.insert(k.to_string(), url_decode(v));
        } else {
            params.insert(pair.to_string(), String::new());
        }
    }
    (path, params)
}

fn url_decode(input: &str) -> String {
    let bytes = input.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        match bytes[i] {
            b'%' if i + 2 < bytes.len() => {
                let hex = std::str::from_utf8(&bytes[i + 1..i + 3]).unwrap_or("");
                if let Ok(byte) = u8::from_str_radix(hex, 16) {
                    out.push(byte);
                    i += 3;
                    continue;
                }
                out.push(bytes[i]);
                i += 1;
            }
            b'+' => {
                out.push(b' ');
                i += 1;
            }
            b => {
                out.push(b);
                i += 1;
            }
        }
    }
    String::from_utf8_lossy(&out).to_string()
}

/// 用途: 校验请求来源; 输入: Origin 头; 输出: 是否允许; 必要性: 防止任意网页跨域读取本地库。
fn origin_allowed(origin: Option<&str>) -> bool {
    match origin {
        // 非浏览器调用（如 curl、本机脚本）不带 Origin
        None => true,
        Some(o) => {
            let o = o.trim();
            o.is_empty()
                || o == "null"
                || o.starts_with("chrome-extension://")
                || o.starts_with("moz-extension://")
                || o.starts_with("edge-extension://")
                || o.starts_with("safari-web-extension://")
        }
    }
}

/// 用途: 常量时间比较令牌; 输入: 请求令牌与真实令牌; 输出: 是否匹配; 必要性: 避免计时侧信道。
fn token_matches(provided: &str, expected: &str) -> bool {
    let a = provided.as_bytes();
    let b = expected.as_bytes();
    if a.len() != b.len() {
        return false;
    }
    let mut diff: u8 = 0;
    for (x, y) in a.iter().zip(b.iter()) {
        diff |= x ^ y;
    }
    diff == 0
}

/// 用途: 评估请求并返回响应体; 输入: AppHandle、连接流; 输出: IO 结果。
fn handle_connection(mut stream: TcpStream, app: &AppHandle) -> std::io::Result<()> {
    let _ = stream.set_read_timeout(Some(Duration::from_secs(5)));

    let mut buf: Vec<u8> = Vec::new();
    let mut tmp = [0u8; 4096];
    let header_end;

    loop {
        let n = stream.read(&mut tmp)?;
        if n == 0 {
            return Ok(());
        }
        buf.extend_from_slice(&tmp[..n]);
        if let Some(pos) = find_header_end(&buf) {
            header_end = pos;
            break;
        }
        if buf.len() > 64 * 1024 {
            return Ok(());
        }
    }

    let header_str = String::from_utf8_lossy(&buf[..header_end]).to_string();
    let mut lines = header_str.lines();
    let request_line = lines.next().unwrap_or("");
    let mut parts = request_line.split_whitespace();
    let method = parts.next().unwrap_or("").to_ascii_uppercase();
    let target = parts.next().unwrap_or("/").to_string();

    let mut headers: HashMap<String, String> = HashMap::new();
    for line in lines {
        if let Some((k, v)) = line.split_once(':') {
            headers.insert(k.trim().to_ascii_lowercase(), v.trim().to_string());
        }
    }

    let content_length: usize = headers
        .get("content-length")
        .and_then(|v| v.parse().ok())
        .unwrap_or(0);
    let mut body = buf[header_end..].to_vec();
    while body.len() < content_length {
        let n = stream.read(&mut tmp)?;
        if n == 0 {
            break;
        }
        body.extend_from_slice(&tmp[..n]);
    }

    // 仅允许浏览器扩展来源（或无 Origin 的本机调用），拒绝普通网页跨域读取
    let origin = headers.get("origin").map(|s| s.as_str());
    if !origin_allowed(origin) {
        return write_response(
            &mut stream,
            403,
            Some(json!({ "error": "forbidden", "message": "origin not allowed" })),
        );
    }

    if method == "OPTIONS" {
        return write_response(&mut stream, 204, None);
    }

    let (path, query) = split_target(&target);

    // 公共端点：无需会话
    let public = match (method.as_str(), path.as_str()) {
        ("GET", "/status") => Some(status(app)),
        ("POST", "/authorize/start") => Some(start_authorization(app)),
        ("GET", "/authorize/result") => Some(poll_authorization(
            app,
            query.get("request").map(String::as_str).unwrap_or(""),
        )),
        _ => None,
    };
    if let Some(result) = public {
        return respond(&mut stream, result);
    }

    // 其余端点需要有效的短期会话
    let provided = headers
        .get("x-ciphora-session")
        .cloned()
        .unwrap_or_default();
    if !validate_session(app, &provided) {
        return write_response(
            &mut stream,
            401,
            Some(json!({ "error": "unauthorized", "message": "扩展未授权或会话已过期，请重新输入主密码" })),
        );
    }

    let result = match (method.as_str(), path.as_str()) {
        ("GET", "/entries") => entries(app, &query),
        ("GET", "/entry") => entry(app, &query),
        ("GET", "/totp") => totp(app, &query),
        ("POST", "/generate") => generate(app, &body),
        ("POST", "/lock") => {
            revoke_session(app);
            Ok(json!({ "success": true }))
        }
        _ => {
            return write_response(&mut stream, 404, Some(json!({ "error": "not_found" })));
        }
    };

    respond(&mut stream, result)
}

/// 用途: 统一把处理结果写成 HTTP 响应; 输入: 流与结果; 输出: IO 结果。
fn respond(stream: &mut TcpStream, result: Result<Value, String>) -> std::io::Result<()> {
    match result {
        Ok(value) => write_response(stream, 200, Some(value)),
        Err(message) if message == "locked" => write_response(
            stream,
            401,
            Some(json!({ "error": "locked", "message": "库已锁定，请先在 Ciphora 中解锁" })),
        ),
        Err(message) if message == "unauthorized" => write_response(
            stream,
            401,
            Some(json!({ "error": "unauthorized", "message": "扩展未授权或会话已过期" })),
        ),
        Err(message) if message == "rate_limited" => write_response(
            stream,
            429,
            Some(json!({ "error": "rate_limited", "message": "尝试过于频繁，请稍后再试" })),
        ),
        Err(message) => write_response(stream, 400, Some(json!({ "error": message }))),
    }
}

fn write_response(
    stream: &mut TcpStream,
    status: u16,
    body: Option<Value>,
) -> std::io::Result<()> {
    let payload = body.map(|v| v.to_string()).unwrap_or_default();
    let reason = match status {
        200 => "OK",
        204 => "No Content",
        400 => "Bad Request",
        401 => "Unauthorized",
        403 => "Forbidden",
        404 => "Not Found",
        429 => "Too Many Requests",
        _ => "OK",
    };
    let response = format!(
        "HTTP/1.1 {status} {reason}\r\n\
         Content-Type: application/json; charset=utf-8\r\n\
         Access-Control-Allow-Origin: *\r\n\
         Access-Control-Allow-Headers: content-type, x-ciphora-session\r\n\
         Access-Control-Allow-Methods: GET, POST, OPTIONS\r\n\
         Cache-Control: no-store\r\n\
         Content-Length: {len}\r\n\
         Connection: close\r\n\r\n{payload}",
        status = status,
        reason = reason,
        len = payload.len(),
        payload = payload
    );
    stream.write_all(response.as_bytes())?;
    stream.flush()
}

// ==================== 会话管理 ====================

/// 用途: 生成并登记一个短期会话; 输入: AppHandle; 输出: 会话令牌。
fn issue_session(app: &AppHandle) -> String {
    let token = crypto::generate_random_password(48, true, true, true, false, false, None)
        .unwrap_or_else(|_| uuid::Uuid::new_v4().simple().to_string());
    let state = app.state::<AppState>();
    *state.bridge_session.lock().unwrap() = Some(BridgeSession {
        token: token.clone(),
        expires_at: Instant::now() + SESSION_TTL,
    });
    token
}

/// 用途: 校验会话令牌并在有效时滑动续期; 输入: AppHandle、令牌; 输出: 是否有效。
fn validate_session(app: &AppHandle, provided: &str) -> bool {
    if provided.is_empty() {
        return false;
    }
    let state = app.state::<AppState>();
    let mut guard = state.bridge_session.lock().unwrap();
    match guard.as_mut() {
        Some(session) => {
            if session.expires_at <= Instant::now() {
                *guard = None;
                return false;
            }
            if !token_matches(provided, &session.token) {
                return false;
            }
            session.expires_at = Instant::now() + SESSION_TTL;
            true
        }
        None => false,
    }
}

/// 用途: 判断当前是否存在有效会话; 输入: AppHandle; 输出: 是否已授权。
fn session_active(app: &AppHandle) -> bool {
    let state = app.state::<AppState>();
    let guard = state.bridge_session.lock().unwrap();
    match guard.as_ref() {
        Some(session) => session.expires_at > Instant::now(),
        None => false,
    }
}

/// 用途: 作废当前会话; 输入: AppHandle; 输出: ()。
fn revoke_session(app: &AppHandle) {
    *app.state::<AppState>().bridge_session.lock().unwrap() = None;
}

/// 用途: 针对 `/authorize` 的失败限流检查; 输入: AppHandle; 输出: 是否已被限流。
fn auth_rate_limited(app: &AppHandle) -> bool {
    let state = app.state::<AppState>();
    let mut failures = state.bridge_auth_failures.lock().unwrap();
    let now = Instant::now();
    failures.retain(|t| now.duration_since(*t) < AUTH_WINDOW);
    failures.len() >= AUTH_MAX_FAILURES
}

/// 用途: 记录一次授权失败; 输入: AppHandle; 输出: ()。
fn record_auth_failure(app: &AppHandle) {
    let state = app.state::<AppState>();
    let mut failures = state.bridge_auth_failures.lock().unwrap();
    failures.push(Instant::now());
    if failures.len() > 100 {
        let drop = failures.len() - 100;
        failures.drain(0..drop);
    }
}

/// 用途: 授权成功后清空失败计数; 输入: AppHandle; 输出: ()。
fn clear_auth_failures(app: &AppHandle) {
    app.state::<AppState>().bridge_auth_failures.lock().unwrap().clear();
}

/// 用途: 发起一次授权请求，等待用户在桌面端确认; 输入: AppHandle; 输出: 请求信息。
///       主密码不会经过桥接；通过将桌面窗口带到前台并弹出确认。
fn start_authorization(app: &AppHandle) -> Result<Value, String> {
    if auth_rate_limited(app) {
        return Err("rate_limited".to_string());
    }

    // 必须先解锁桌面端，授权只授予“读取已解锁库”的会话
    if !is_unlocked(app) {
        return Err("locked".to_string());
    }

    let state = app.state::<AppState>();
    // 已有尚未过期的请求：直接复用，避免重复弹窗
    {
        let guard = state.bridge_auth_request.lock().unwrap();
        if let Some(req) = guard.as_ref() {
            if req.created.elapsed() < AUTH_REQUEST_TTL {
                return Ok(json!({
                    "success": true,
                    "requestId": req.id,
                    "expiresIn": AUTH_REQUEST_TTL.as_secs(),
                }));
            }
        }
    }

    let id = uuid::Uuid::new_v4().simple().to_string();
    *state.bridge_auth_request.lock().unwrap() = Some(PendingBridgeAuth {
        id: id.clone(),
        created: Instant::now(),
        decision: None,
    });

    // 将桌面主窗口带到前台，让用户确认
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
    let _ = app.emit("bridge-auth-request", json!({ "id": id }));

    Ok(json!({
        "success": true,
        "requestId": id,
        "expiresIn": AUTH_REQUEST_TTL.as_secs(),
    }))
}

/// 用途: 查询授权请求的处理结果; 输入: AppHandle 与请求 ID; 输出: 状态（可能带会话令牌）。
fn poll_authorization(app: &AppHandle, request_id: &str) -> Result<Value, String> {
    if request_id.is_empty() {
        return Ok(json!({ "status": "expired" }));
    }

    let decision = {
        let state = app.state::<AppState>();
        let mut guard = state.bridge_auth_request.lock().unwrap();
        let Some(req) = guard.as_ref() else {
            return Ok(json!({ "status": "expired" }));
        };
        if req.id != request_id || req.created.elapsed() > AUTH_REQUEST_TTL {
            *guard = None;
            return Ok(json!({ "status": "expired" }));
        }
        match req.decision {
            None => return Ok(json!({ "status": "pending" })),
            Some(decision) => {
                *guard = None;
                decision
            }
        }
    };

    if !decision {
        record_auth_failure(app);
        return Ok(json!({ "status": "denied" }));
    }

    clear_auth_failures(app);
    let token = issue_session(app);
    Ok(json!({
        "status": "approved",
        "sessionToken": token,
        "expiresIn": SESSION_TTL.as_secs(),
    }))
}

// ==================== 数据端点 ====================

fn is_unlocked(app: &AppHandle) -> bool {
    let state = app.state::<AppState>();
    let unlocked = *state.is_authenticated.lock().unwrap();
    unlocked
}

fn session_password(app: &AppHandle) -> Option<String> {
    let state = app.state::<AppState>();
    crate::service::app_state::session_password(state.inner())
}

fn status(app: &AppHandle) -> Result<Value, String> {
    Ok(json!({
        "app": "ciphora",
        "version": env!("CARGO_PKG_VERSION"),
        "locked": !is_unlocked(app),
        "authorized": session_active(app),
    }))
}

fn load_entries(app: &AppHandle) -> Result<Vec<PasswordEntry>, String> {
    if !is_unlocked(app) {
        return Err("locked".to_string());
    }
    let master = session_password(app).ok_or_else(|| "locked".to_string())?;

    let encrypted = tauri::async_runtime::block_on(storage::load_from_file(app, PASSWORD_FILE))?;
    if encrypted.trim().is_empty() {
        return Ok(Vec::new());
    }

    let decrypted = crypto::decrypt_data(&encrypted, &master)
        .map_err(|e| format!("decryption_failed: {}", e))?;
    if decrypted.trim().is_empty() {
        return Ok(Vec::new());
    }

    let parsed: Value = serde_json::from_str(&decrypted)
        .map_err(|e| format!("deserialization_failed: {}", e))?;

    let entries = match parsed {
        Value::Array(arr) => arr,
        Value::Object(mut obj) => obj
            .remove("passwords")
            .and_then(|v| v.as_array().cloned())
            .unwrap_or_default(),
        _ => Vec::new(),
    };

    Ok(entries)
}

fn str_field(entry: &Value, key: &str) -> String {
    entry
        .get(key)
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string()
}

fn entries(app: &AppHandle, query: &HashMap<String, String>) -> Result<Value, String> {
    let list = load_entries(app)?;
    let q = query.get("q").map(|s| s.to_lowercase()).unwrap_or_default();

    let result: Vec<Value> = list
        .iter()
        .filter(|entry| {
            if q.is_empty() {
                return true;
            }
            let haystack = format!(
                "{} {} {} {}",
                str_field(entry, "website"),
                str_field(entry, "username"),
                str_field(entry, "description"),
                str_field(entry, "dataType")
            )
            .to_lowercase();
            haystack.contains(&q)
        })
        .map(|entry| {
            json!({
                "id": str_field(entry, "id"),
                "website": str_field(entry, "website"),
                "username": str_field(entry, "username"),
                "type": str_field(entry, "dataType"),
                "groupId": str_field(entry, "groupId"),
                "description": str_field(entry, "description"),
                "url": str_field(entry, "url"),
                "hasPassword": !str_field(entry, "password").is_empty(),
                "hasTotp": !str_field(entry, "secret").is_empty(),
                "updatedAt": str_field(entry, "updatedAt"),
            })
        })
        .collect();

    Ok(json!({ "entries": result }))
}

fn entry(app: &AppHandle, query: &HashMap<String, String>) -> Result<Value, String> {
    let id = query.get("id").cloned().unwrap_or_default();
    if id.is_empty() {
        return Err("missing_id".to_string());
    }
    let list = load_entries(app)?;
    let found = list
        .into_iter()
        .find(|e| str_field(e, "id") == id)
        .ok_or_else(|| "not_found".to_string())?;

    Ok(json!({
        "id": id,
        "website": str_field(&found, "website"),
        "username": str_field(&found, "username"),
        "password": str_field(&found, "password"),
        "type": str_field(&found, "dataType"),
        "description": str_field(&found, "description"),
        // 不返回明文 TOTP 密钥，验证码由 /totp?id= 按需生成
        "hasTotp": !str_field(&found, "secret").is_empty(),
    }))
}

fn totp(app: &AppHandle, query: &HashMap<String, String>) -> Result<Value, String> {
    let secret = if let Some(secret) = query.get("secret").filter(|s| !s.is_empty()) {
        secret.clone()
    } else if let Some(id) = query.get("id").filter(|s| !s.is_empty()) {
        let list = load_entries(app)?;
        let found = list
            .into_iter()
            .find(|e| str_field(e, "id") == *id)
            .ok_or_else(|| "not_found".to_string())?;
        str_field(&found, "secret")
    } else {
        return Err("missing_secret".to_string());
    };

    if secret.is_empty() {
        return Err("missing_secret".to_string());
    }

    let code = mfa::generate_totp(&secret)?;
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);

    Ok(json!({
        "totp": code,
        "remaining": 30 - (now % 30),
    }))
}

fn generate(app: &AppHandle, body: &[u8]) -> Result<Value, String> {
    let parsed: Value = if body.is_empty() {
        json!({})
    } else {
        serde_json::from_slice(body).map_err(|e| format!("invalid_body: {}", e))?
    };

    // 未显式指定的项，回退到用户在桌面端的生成器设置
    let pg = app
        .state::<AppState>()
        .settings
        .lock()
        .unwrap()
        .password_generator
        .clone();

    let length = parsed
        .get("length")
        .and_then(|v| v.as_u64())
        .map(|v| v as usize)
        .unwrap_or(pg.default_length)
        .clamp(4, 128);
    let uppercase = parsed
        .get("includeUppercase")
        .and_then(|v| v.as_bool())
        .unwrap_or(pg.include_uppercase);
    let lowercase = parsed
        .get("includeLowercase")
        .and_then(|v| v.as_bool())
        .unwrap_or(pg.include_lowercase);
    let numbers = parsed
        .get("includeNumbers")
        .and_then(|v| v.as_bool())
        .unwrap_or(pg.include_numbers);
    let symbols = parsed
        .get("includeSymbols")
        .and_then(|v| v.as_bool())
        .unwrap_or(pg.include_symbols);
    let exclude_similar = parsed
        .get("excludeSimilar")
        .and_then(|v| v.as_bool())
        .unwrap_or(pg.exclude_similar);
    let custom_charset = parsed
        .get("customCharset")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
        .unwrap_or(pg.custom_charset);

    let password = crypto::generate_random_password(
        length,
        uppercase,
        lowercase,
        numbers,
        symbols,
        exclude_similar,
        Some(custom_charset.as_str()),
    )?;
    Ok(json!({ "password": password }))
}

#[cfg(test)]
mod tests {
    use super::{origin_allowed, token_matches};

    #[test]
    fn origin_allows_extensions_and_native() {
        assert!(origin_allowed(None));
        assert!(origin_allowed(Some("chrome-extension://abcdef")));
        assert!(origin_allowed(Some("moz-extension://abcdef")));
        assert!(origin_allowed(Some("null")));
    }

    #[test]
    fn origin_blocks_web_pages() {
        assert!(!origin_allowed(Some("https://evil.example")));
        assert!(!origin_allowed(Some("http://127.0.0.1:3000")));
    }

    #[test]
    fn token_compare_is_exact() {
        assert!(token_matches("abc123", "abc123"));
        assert!(!token_matches("abc124", "abc123"));
        assert!(!token_matches("abc12", "abc123"));
        assert!(!token_matches("", "abc123"));
    }
}
