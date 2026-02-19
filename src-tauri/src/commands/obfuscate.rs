use crate::pipeline::obfuscate::{self, ObfuscateResult};

#[tauri::command]
pub fn obfuscate_gpc(source: String, level: u8) -> Result<ObfuscateResult, String> {
    if !(1..=5).contains(&level) {
        return Err("Obfuscation level must be between 1 and 5".to_string());
    }
    Ok(obfuscate::obfuscate(&source, level))
}
