use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Complete flow graph definition stored as flow.json in game directories
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FlowGraph {
    pub id: String,
    pub name: String,
    pub version: u32,
    pub nodes: Vec<FlowNode>,
    pub edges: Vec<FlowEdge>,
    #[serde(default)]
    pub global_variables: Vec<FlowVariable>,
    #[serde(default)]
    pub global_code: String,
    pub settings: FlowSettings,
    #[serde(default)]
    pub created_at: u64,
    #[serde(default)]
    pub updated_at: u64,
}

/// A node in the flow graph representing a state/screen
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FlowNode {
    pub id: String,
    pub r#type: String, // intro, home, menu, submenu, custom, screensaver
    pub label: String,
    pub position: Position,
    #[serde(default)]
    pub gpc_code: String,
    #[serde(default)]
    pub oled_scene: Option<SerializedScene>,
    #[serde(default)]
    pub oled_widgets: Vec<WidgetPlacement>,
    #[serde(default)]
    pub combo_code: String,
    #[serde(default)]
    pub is_initial_state: bool,
    #[serde(default)]
    pub variables: Vec<FlowVariable>,
    #[serde(default)]
    pub on_enter: String,
    #[serde(default)]
    pub on_exit: String,
    #[serde(default)]
    pub chunk_ref: Option<String>,
}

/// An edge connecting two nodes representing a transition
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FlowEdge {
    pub id: String,
    pub source_node_id: String,
    pub target_node_id: String,
    #[serde(default = "default_port")]
    pub source_port: String,
    #[serde(default = "default_port")]
    pub target_port: String,
    #[serde(default)]
    pub label: String,
    pub condition: FlowCondition,
}

fn default_port() -> String {
    "right".to_string()
}

/// Transition condition for an edge
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FlowCondition {
    pub r#type: String, // button_press, button_hold, timeout, variable, custom
    #[serde(default)]
    pub button: Option<String>,
    #[serde(default)]
    pub timeout_ms: Option<u32>,
    #[serde(default)]
    pub variable: Option<String>,
    #[serde(default)]
    pub comparison: Option<String>,
    #[serde(default)]
    pub value: Option<i32>,
    #[serde(default)]
    pub custom_code: Option<String>,
}

/// A variable used in the flow
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FlowVariable {
    pub name: String,
    pub r#type: String, // int, int8, int16, int32
    #[serde(default)]
    pub default_value: i32,
    #[serde(default)]
    pub persist: bool,
    #[serde(default)]
    pub min: Option<i32>,
    #[serde(default)]
    pub max: Option<i32>,
}

/// OLED scene data (matches frontend SerializedScene)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SerializedScene {
    pub id: String,
    pub name: String,
    pub pixels: String, // Base64-encoded Uint8Array
}

/// Widget placement within a node's OLED area
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WidgetPlacement {
    pub widget_id: String,
    pub x: i32,
    pub y: i32,
    #[serde(default)]
    pub config: HashMap<String, serde_json::Value>,
    #[serde(default)]
    pub bound_variable: Option<String>,
}

/// Position on the canvas
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Position {
    pub x: f64,
    pub y: f64,
}

/// Flow settings
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FlowSettings {
    #[serde(default = "default_timeout")]
    pub screen_timeout_ms: u32,
    #[serde(default = "default_font")]
    pub default_font: String,
    #[serde(default = "default_true")]
    pub include_common_utils: bool,
    #[serde(default = "default_true")]
    pub persistence_enabled: bool,
    #[serde(default)]
    pub button_mapping: FlowButtonMapping,
}

fn default_timeout() -> u32 {
    5000
}
fn default_font() -> String {
    "OLED_FONT_SMALL".to_string()
}
fn default_true() -> bool {
    true
}

/// Button mapping for flow navigation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FlowButtonMapping {
    #[serde(default = "default_confirm")]
    pub confirm: String,
    #[serde(default = "default_cancel")]
    pub cancel: String,
    #[serde(default = "default_up")]
    pub up: String,
    #[serde(default = "default_down")]
    pub down: String,
    #[serde(default = "default_left")]
    pub left: String,
    #[serde(default = "default_right")]
    pub right: String,
}

impl Default for FlowButtonMapping {
    fn default() -> Self {
        Self {
            confirm: default_confirm(),
            cancel: default_cancel(),
            up: default_up(),
            down: default_down(),
            left: default_left(),
            right: default_right(),
        }
    }
}

fn default_confirm() -> String {
    "CONFIRM_BTN".to_string()
}
fn default_cancel() -> String {
    "CANCEL_BTN".to_string()
}
fn default_up() -> String {
    "UP_BTN".to_string()
}
fn default_down() -> String {
    "DOWN_BTN".to_string()
}
fn default_left() -> String {
    "LEFT_BTN".to_string()
}
fn default_right() -> String {
    "RIGHT_BTN".to_string()
}

/// Reusable chunk stored in workspace chunks/ directory
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FlowChunk {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub description: String,
    #[serde(default)]
    pub category: String,
    #[serde(default)]
    pub tags: Vec<String>,
    pub node_template: serde_json::Value, // Partial FlowNode as JSON
    #[serde(default)]
    pub edge_templates: Vec<ChunkEdgeTemplate>,
    #[serde(default)]
    pub parameters: Vec<ChunkParameter>,
    #[serde(default)]
    pub created_at: u64,
    #[serde(default)]
    pub updated_at: u64,
}

/// Edge template for a chunk
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChunkEdgeTemplate {
    pub label: String,
    pub condition: FlowCondition,
    pub direction: String, // "outgoing" | "incoming"
}

/// Configurable parameter for a chunk
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChunkParameter {
    pub key: String,
    pub label: String,
    pub r#type: String, // string, number, boolean, button, code
    pub default_value: String,
    #[serde(default)]
    pub description: String,
}
