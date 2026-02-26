use serde::{Deserialize, Serialize};
use std::path::PathBuf;

/// Plugin manifest structure (plugin.toml)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginManifest {
    pub id: String,
    pub name: String,
    pub version: String,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub author: Option<String>,
    #[serde(default)]
    pub homepage: Option<String>,
    /// Hooks this plugin provides
    #[serde(default)]
    pub hooks: PluginHooks,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct PluginHooks {
    /// GPC code to include before main code
    #[serde(default)]
    pub pre_build: Option<String>,
    /// GPC code to include after main code
    #[serde(default)]
    pub post_build: Option<String>,
    /// GPC include files to add
    #[serde(default)]
    pub includes: Option<Vec<String>>,
    /// Extra variables to define
    #[serde(default)]
    pub extra_vars: Option<std::collections::HashMap<String, String>>,
    /// Extra defines
    #[serde(default)]
    pub extra_defines: Option<std::collections::HashMap<String, String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginInfo {
    pub manifest: PluginManifest,
    pub path: String,
    pub enabled: bool,
}

fn plugins_dir(workspace_path: &str) -> PathBuf {
    PathBuf::from(workspace_path).join("plugins")
}

fn enabled_file(workspace_path: &str) -> PathBuf {
    plugins_dir(workspace_path).join(".enabled.json")
}

fn load_enabled(workspace_path: &str) -> Vec<String> {
    let path = enabled_file(workspace_path);
    if path.exists() {
        let content = std::fs::read_to_string(&path).unwrap_or_default();
        serde_json::from_str(&content).unwrap_or_default()
    } else {
        vec![]
    }
}

fn save_enabled(workspace_path: &str, ids: &[String]) -> Result<(), String> {
    let dir = plugins_dir(workspace_path);
    std::fs::create_dir_all(&dir)
        .map_err(|e| format!("Failed to create plugins directory: {}", e))?;
    let content = serde_json::to_string_pretty(ids)
        .map_err(|e| format!("Failed to serialize: {}", e))?;
    std::fs::write(enabled_file(workspace_path), content)
        .map_err(|e| format!("Failed to write: {}", e))?;
    Ok(())
}

/// List all plugins in the workspace's plugins/ directory
#[tauri::command]
pub fn list_plugins(workspace_paths: Option<Vec<String>>) -> Result<Vec<PluginInfo>, String> {
    let mut result = vec![];

    let paths = workspace_paths.unwrap_or_default();
    for ws in &paths {
        let dir = plugins_dir(ws);
        if !dir.exists() {
            continue;
        }

        let enabled = load_enabled(ws);

        let entries = std::fs::read_dir(&dir)
            .map_err(|e| format!("Failed to read plugins dir: {}", e))?;

        for entry in entries {
            let entry = entry.map_err(|e| format!("Read error: {}", e))?;
            let path = entry.path();

            if path.is_dir() {
                let manifest_path = path.join("plugin.toml");
                if manifest_path.exists() {
                    match load_manifest(&manifest_path) {
                        Ok(manifest) => {
                            let is_enabled = enabled.contains(&manifest.id);
                            result.push(PluginInfo {
                                path: path.to_string_lossy().to_string(),
                                enabled: is_enabled,
                                manifest,
                            });
                        }
                        Err(e) => {
                            log::warn!(
                                "Failed to load plugin manifest at {:?}: {}",
                                manifest_path,
                                e
                            );
                        }
                    }
                }
            }
        }
    }

    result.sort_by(|a, b| a.manifest.name.cmp(&b.manifest.name));
    Ok(result)
}

fn load_manifest(path: &PathBuf) -> Result<PluginManifest, String> {
    let content = std::fs::read_to_string(path)
        .map_err(|e| format!("Failed to read: {}", e))?;
    toml::from_str(&content)
        .map_err(|e| format!("Invalid TOML: {}", e))
}

/// Enable or disable a plugin
#[tauri::command]
pub fn toggle_plugin(
    workspace_path: String,
    plugin_id: String,
    enabled: bool,
) -> Result<(), String> {
    let mut ids = load_enabled(&workspace_path);
    if enabled {
        if !ids.contains(&plugin_id) {
            ids.push(plugin_id);
        }
    } else {
        ids.retain(|id| id != &plugin_id);
    }
    save_enabled(&workspace_path, &ids)
}

/// Get the content of a specific plugin file
#[tauri::command]
pub fn read_plugin_file(plugin_path: String, file_name: String) -> Result<String, String> {
    let path = PathBuf::from(&plugin_path).join(&file_name);
    std::fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read plugin file: {}", e))
}

/// Create a new plugin scaffold
#[tauri::command]
pub fn create_plugin(
    workspace_path: String,
    plugin_id: String,
    plugin_name: String,
    description: Option<String>,
) -> Result<String, String> {
    let dir = plugins_dir(&workspace_path).join(&plugin_id);
    if dir.exists() {
        return Err(format!("Plugin directory already exists: {}", plugin_id));
    }
    std::fs::create_dir_all(&dir)
        .map_err(|e| format!("Failed to create plugin directory: {}", e))?;

    let manifest = format!(
        r#"id = "{}"
name = "{}"
version = "1.0.0"
description = "{}"
author = ""

[hooks]
# pre_build = "// Code to add before main"
# post_build = "// Code to add after main"
# includes = ["my_include.gpc"]

# [hooks.extra_vars]
# MyVar = "int"

# [hooks.extra_defines]
# MY_DEFINE = "1"
"#,
        plugin_id,
        plugin_name,
        description.unwrap_or_default()
    );

    std::fs::write(dir.join("plugin.toml"), manifest)
        .map_err(|e| format!("Failed to write manifest: {}", e))?;

    Ok(dir.to_string_lossy().to_string())
}

/// Collect merged hooks from all enabled plugins in a workspace.
/// Used by the build pipeline to inject plugin code.
pub fn collect_enabled_hooks(workspace_path: &str) -> PluginHooks {
    let enabled_ids = load_enabled(workspace_path);
    if enabled_ids.is_empty() {
        return PluginHooks::default();
    }

    let dir = plugins_dir(workspace_path);
    if !dir.exists() {
        return PluginHooks::default();
    }

    let mut merged = PluginHooks::default();

    for entry in std::fs::read_dir(&dir).into_iter().flatten().flatten() {
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }
        let manifest_path = path.join("plugin.toml");
        if !manifest_path.exists() {
            continue;
        }
        let manifest = match load_manifest(&manifest_path) {
            Ok(m) => m,
            Err(_) => continue,
        };
        if !enabled_ids.contains(&manifest.id) {
            continue;
        }

        let hooks = &manifest.hooks;
        if let Some(ref code) = hooks.pre_build {
            let existing = merged.pre_build.get_or_insert_with(String::new);
            if !existing.is_empty() {
                existing.push('\n');
            }
            existing.push_str(code);
        }
        if let Some(ref code) = hooks.post_build {
            let existing = merged.post_build.get_or_insert_with(String::new);
            if !existing.is_empty() {
                existing.push('\n');
            }
            existing.push_str(code);
        }
        if let Some(ref includes) = hooks.includes {
            let plugin_dir_str = path.to_string_lossy().to_string();
            let existing = merged.includes.get_or_insert_with(Vec::new);
            for inc in includes {
                // Resolve include path relative to plugin directory
                let resolved = format!("{}/{}", plugin_dir_str, inc);
                existing.push(resolved);
            }
        }
        if let Some(ref vars) = hooks.extra_vars {
            let existing = merged.extra_vars.get_or_insert_with(std::collections::HashMap::new);
            existing.extend(vars.iter().map(|(k, v)| (k.clone(), v.clone())));
        }
        if let Some(ref defines) = hooks.extra_defines {
            let existing = merged.extra_defines.get_or_insert_with(std::collections::HashMap::new);
            existing.extend(defines.iter().map(|(k, v)| (k.clone(), v.clone())));
        }
    }

    merged
}

/// Delete a plugin
#[tauri::command]
pub fn delete_plugin(plugin_path: String) -> Result<(), String> {
    let path = PathBuf::from(&plugin_path);
    if path.exists() {
        std::fs::remove_dir_all(&path)
            .map_err(|e| format!("Failed to delete plugin: {}", e))?;
    }
    Ok(())
}
