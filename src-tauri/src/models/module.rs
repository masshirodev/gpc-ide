use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Raw module definition as it appears in Pipeline/Modules/*.toml
/// Each TOML file has a single top-level key (module name) containing these fields.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModuleDefinition {
    pub display_name: String,
    pub id: String,
    pub r#type: String,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub state_display: Option<String>,
    #[serde(default)]
    pub status_var: Option<String>,
    #[serde(default)]
    pub has_quick_toggle: Option<bool>,
    #[serde(default)]
    pub trigger: Option<String>,
    #[serde(default)]
    pub combo: Option<String>,
    #[serde(default)]
    pub options: Vec<ModuleOption>,
    #[serde(default)]
    pub extra_vars: HashMap<String, String>,
    #[serde(default)]
    pub params: Vec<ModuleParam>,
    #[serde(default)]
    pub conflicts: Vec<String>,
    #[serde(default)]
    pub menu_priority: Option<i32>,
    #[serde(default)]
    pub needs_weapondata: Option<bool>,
    #[serde(default)]
    pub requires_keyboard_file: Option<bool>,
    #[serde(default)]
    pub config_menu: Option<ConfigMenu>,
    #[serde(default)]
    pub is_user_module: bool,
}

/// Custom menu configuration for data modules (weapondata, adp)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConfigMenu {
    pub name: String,
    pub r#type: String,
    #[serde(default)]
    pub display_function: Option<String>,
    #[serde(default)]
    pub edit_function: Option<String>,
    #[serde(default)]
    pub render_function: Option<String>,
    #[serde(default)]
    pub profile_aware: Option<bool>,
    #[serde(default)]
    pub options: Vec<ModuleOption>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModuleOption {
    pub name: String,
    pub var: String,
    pub r#type: String,
    #[serde(default)]
    pub default: Option<serde_json::Value>,
    #[serde(default)]
    pub min: Option<i32>,
    #[serde(default)]
    pub max: Option<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModuleParam {
    pub key: String,
    pub prompt: String,
    pub r#type: String,
    #[serde(default)]
    pub default: Option<String>,
}

/// Summary for the module list UI
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModuleSummary {
    pub id: String,
    pub display_name: String,
    pub module_type: String,
    pub description: Option<String>,
    pub has_quick_toggle: bool,
    pub param_count: usize,
    pub option_count: usize,
    pub conflicts: Vec<String>,
    pub needs_weapondata: bool,
    pub is_user_module: bool,
}

impl ModuleDefinition {
    pub fn to_summary(&self) -> ModuleSummary {
        ModuleSummary {
            id: self.id.clone(),
            display_name: self.display_name.clone(),
            module_type: self.r#type.clone(),
            description: self.description.clone(),
            has_quick_toggle: self.has_quick_toggle.unwrap_or(false),
            param_count: self.params.len(),
            option_count: self.options.len(),
            conflicts: self.conflicts.clone(),
            needs_weapondata: self.needs_weapondata.unwrap_or(false),
            is_user_module: self.is_user_module,
        }
    }
}
