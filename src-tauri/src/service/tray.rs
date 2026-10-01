//! 系统托盘与「关闭 / 最小化到托盘」行为。
//!
//! 仅在桌面端编译（移动端没有系统托盘概念）。

#![cfg(not(any(target_os = "android", target_os = "ios")))]

use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager, WindowEvent, Wry,
};

use crate::model::AppState;

/// 托盘菜单 / 事件中用于区分操作的 ID。
const MENU_SHOW: &str = "ciphora_show";
const MENU_QUIT: &str = "ciphora_quit";
const TRAY_ID: &str = "ciphora-tray";

/// 用途: 根据语言返回托盘菜单文案; 输入: 语言标签; 输出: (显示, 退出)。
fn tray_labels(language: &str) -> (&'static str, &'static str) {
    if language.to_lowercase().starts_with("zh") {
        ("显示主界面", "彻底退出")
    } else {
        ("Show Ciphora", "Quit Ciphora")
    }
}

/// 用途: 获取系统语言; 输入: 无; 输出: 语言标签; 必要性: 启动时确定托盘文案。
fn system_language() -> String {
    tauri_plugin_os::locale().unwrap_or_else(|| "en-US".to_string())
}

/// 用途: 构建本地化的托盘菜单; 输入: AppHandle 与语言; 输出: 菜单。
fn build_menu(app: &AppHandle, language: &str) -> tauri::Result<Menu<Wry>> {
    let (show, quit) = tray_labels(language);
    let show_item = MenuItem::with_id(app, MENU_SHOW, show, true, None::<&str>)?;
    let quit_item = MenuItem::with_id(app, MENU_QUIT, quit, true, None::<&str>)?;
    Menu::with_items(app, &[&show_item, &quit_item])
}

/// 用途: 语言切换后重建托盘菜单; 输入: AppHandle 与语言; 输出: ()。
pub fn set_tray_language(app: &AppHandle, language: &str) {
    if let Some(tray) = app.tray_by_id(TRAY_ID) {
        if let Ok(menu) = build_menu(app, language) {
            let _ = tray.set_menu(Some(menu));
        }
    }
}

/// 用途: 读取当前托盘设置; 输入: AppHandle; 输出: (minimize_to_tray, close_to_tray)。
fn tray_flags(app: &AppHandle) -> (bool, bool) {
    let state = app.state::<AppState>();
    let settings = state.settings.lock().unwrap();
    (
        settings.tray.minimize_to_tray,
        settings.tray.close_to_tray,
    )
}

/// 用途: 显示并聚焦主窗口; 输入: AppHandle; 输出: (); 必要性: 托盘双击 / 菜单唤起。
pub fn show_main_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}

/// 用途: 创建系统托盘图标及菜单; 输入: AppHandle; 输出: Result;
///       必要性: 提供后台驻留、唤起主界面与彻底退出的入口。
pub fn setup_tray(app: &AppHandle) -> tauri::Result<()> {
    let menu = build_menu(app, &system_language())?;

    let mut builder = TrayIconBuilder::with_id(TRAY_ID)
        .tooltip("Ciphora")
        .menu(&menu)
        // 左键单击不弹出菜单，避免与双击唤起冲突
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id.as_ref() {
            MENU_SHOW => show_main_window(app),
            MENU_QUIT => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            // 双击（部分平台为左键单击）唤起主界面
            match event {
                TrayIconEvent::DoubleClick {
                    button: MouseButton::Left,
                    ..
                } => show_main_window(tray.app_handle()),
                TrayIconEvent::Click {
                    button: MouseButton::Left,
                    button_state: MouseButtonState::Up,
                    ..
                } => show_main_window(tray.app_handle()),
                _ => {}
            }
        });

    if let Some(icon) = app.default_window_icon().cloned() {
        builder = builder.icon(icon);
    }

    builder.build(app)?;
    Ok(())
}

/// 用途: 注册主窗口的关闭拦截; 输入: AppHandle; 输出: ();
///       必要性: 勾选「关闭到托盘」时阻止默认退出并隐藏窗口。
pub fn register_close_handler(app: &AppHandle) {
    let Some(window) = app.get_webview_window("main") else {
        return;
    };

    let app_handle = app.clone();
    window.on_window_event(move |event| {
        if let WindowEvent::CloseRequested { api, .. } = event {
            let (_, close_to_tray) = tray_flags(&app_handle);
            if close_to_tray {
                api.prevent_close();
                if let Some(win) = app_handle.get_webview_window("main") {
                    let _ = win.hide();
                }
            }
        }
    });
}

/// 用途: 启动后台轮询, 在勾选「最小化到托盘」时把最小化的窗口隐藏到托盘;
///       输入: AppHandle; 输出: (); 必要性: Tauri 没有原生 minimize 事件。
pub fn spawn_minimize_watcher(app: AppHandle) {
    std::thread::spawn(move || loop {
        std::thread::sleep(std::time::Duration::from_millis(400));

        let (minimize_to_tray, _) = tray_flags(&app);
        if !minimize_to_tray {
            continue;
        }

        if let Some(window) = app.get_webview_window("main") {
            if matches!(window.is_minimized(), Ok(true)) {
                let _ = window.hide();
            }
        }
    });
}