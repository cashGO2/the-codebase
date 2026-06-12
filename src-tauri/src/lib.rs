fn should_open_in_app(url: &tauri::Url) -> bool {
  let scheme = url.scheme();
  if scheme == "tauri" || scheme == "about" || scheme == "data" || scheme == "blob" || scheme == "file" {
    return true;
  }
  if let Some(host) = url.host_str() {
    if host == "localhost" || host == "127.0.0.1" {
      return true;
    }
    let host_lower = host.to_lowercase();
    if host_lower == "getmaterio.app" || host_lower.ends_with(".getmaterio.app") {
      return true;
    }
    if host_lower == "materioa.github.io" || host_lower.ends_with(".materioa.github.io") {
      return true;
    }
    if host_lower.ends_with("vercel.app") && host_lower.contains("materio") {
      return true;
    }
  }
  false
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }

      app.handle().plugin(
        tauri::plugin::Builder::<tauri::Wry, ()>::new("navigation-interceptor")
          .on_navigation(|_window, url| {
            if should_open_in_app(url) {
              true
            } else {
              let url_str = url.as_str().to_string();
              #[cfg(target_os = "windows")]
              let _ = std::process::Command::new("cmd").args(["/c", "start", "", &url_str]).spawn();
              #[cfg(target_os = "macos")]
              let _ = std::process::Command::new("open").arg(&url_str).spawn();
              #[cfg(target_os = "linux")]
              let _ = std::process::Command::new("xdg-open").arg(&url_str).spawn();
              false
            }
          })
          .build()
      )?;

      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
