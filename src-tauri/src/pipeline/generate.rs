use crate::models::config::{GameConfig, MenuItem, MenuItems, MenuOption};
use crate::models::module::ModuleDefinition;
use crate::pipeline::config_gen::resolve_config_template;
use std::collections::{HashMap, HashSet};
use std::fmt::Write;


/// Strip the .gpc extension from a path for import directives.
fn strip_gpc_ext(path: &str) -> &str {
    path.strip_suffix(".gpc").unwrap_or(path)
}

// Layout constants
const ITEMS_PER_PAGE: usize = 3;
const RECT_Y_POSITIONS: [i32; 3] = [12, 28, 44];
const TEXT_Y_POSITIONS: [i32; 3] = [11, 27, 43];
const TEXT_X_LABEL: i32 = 32;
const TEXT_X_TOGGLE: i32 = 110;
const TEXT_X_NUMBER: i32 = 98;

/// Persistence variable info
#[derive(Debug, Clone)]
struct PersistVar {
    var_access: String,
    var_name: String,
    index: Option<usize>,
    min: i32,
    max: i32,
    default: i64,
    bit_width: u32,
}

/// Analyzed module info
#[derive(Debug, Clone)]
struct AnalyzedModule {
    name: String,
    sanitized_name: String,
    file_id: String,
    item_type: String,
    is_data_module: bool,
    page: usize,
    slot: usize,
    y_pos: i32,
    rect_y: i32,
    menu_id: Option<u32>,
    bit_offset: u32,
    total_bits: u32,
    persist_vars: Vec<PersistVar>,
    item: MenuItem,
}

pub struct Generator {
    config: GameConfig,
    profile_count: u32,
    modules_metadata: HashMap<String, ModuleDefinition>,
    weapons_list: Vec<String>,
    module_params: HashMap<String, HashMap<String, String>>,
    analyzed: Vec<AnalyzedModule>,
    include_prefix: String,
    global_declared_vars: HashSet<String>,
}

/// Result of generation
pub struct GenerateResult {
    pub files: Vec<(String, String)>, // (relative path, content)
}

impl Generator {
    pub fn new(
        config: GameConfig,
        modules_metadata: HashMap<String, ModuleDefinition>,
        game_depth: usize, // depth from Games/ to game folder (1 for Games/Foo, 2 for Games/Cat/Foo)
    ) -> Self {
        let profile_count = config.profile_count.unwrap_or(0);
        let weapons_list = config.weapons.clone().unwrap_or_default();
        let module_params = config.module_params.clone().unwrap_or_default();
        let include_prefix = "../".repeat(game_depth + 1); // +1 for modules/ subfolder

        let mut gen = Self {
            config,
            profile_count,
            modules_metadata,
            weapons_list,
            module_params,
            analyzed: Vec::new(),
            include_prefix,
            global_declared_vars: HashSet::new(),
        };
        gen.analyze_modules();
        gen
    }

    fn analyze_modules(&mut self) {
        let mut menu_id: u32 = 2; // 0=state, 1=main
        let mut bit_offset: u32 = 1; // Start after data-exists marker

        for (idx, item) in self.config.menu.iter().enumerate() {
            let page = idx / ITEMS_PER_PAGE;
            let slot = idx % ITEMS_PER_PAGE;
            let y_pos = TEXT_Y_POSITIONS[slot];
            let rect_y = RECT_Y_POSITIONS[slot];

            let (persist_vars, total_bits) = self.analyze_item_persistence(item);

            let is_data_module = item.r#type == "data";
            let has_submenu = !is_data_module
                && (item.r#type == "clickable"
                    || (item.r#type == "custom" && item.render_function.is_some()));
            let assigned_menu_id = if has_submenu {
                let id = menu_id;
                menu_id += 1;
                Some(id)
            } else {
                None
            };

            let module_meta = self.find_module_metadata(&item.name, item.module.as_deref());
            let file_id = item
                .file_id
                .clone()
                .or_else(|| module_meta.map(|m| m.id.clone()))
                .unwrap_or_else(|| sanitize_var_name(&item.name).to_lowercase());

            let module = AnalyzedModule {
                name: item.name.clone(),
                sanitized_name: sanitize_var_name(&item.name),
                file_id,
                item_type: item.r#type.clone(),
                is_data_module,
                page,
                slot,
                y_pos,
                rect_y,
                menu_id: assigned_menu_id,
                bit_offset,
                total_bits,
                persist_vars,
                item: item.clone(),
            };

            self.analyzed.push(module);
            bit_offset += total_bits;
        }
    }

    fn analyze_item_persistence(&self, item: &MenuItem) -> (Vec<PersistVar>, u32) {
        match item.r#type.as_str() {
            "clickable" => {
                let mut all_vars = Vec::new();
                let mut total = 0u32;
                for opt in item.options.as_deref().unwrap_or(&[]) {
                    let (vars, bits) = self.analyze_option_persistence(opt);
                    all_vars.extend(vars);
                    total += bits;
                }
                (all_vars, total)
            }
            "selector" => {
                let max_idx = item
                    .items
                    .as_ref()
                    .and_then(|mi| mi.as_flat())
                    .map(|items| items.len().saturating_sub(1) as i32)
                    .unwrap_or(0);
                self.analyze_var_persistence(item, 0, max_idx)
            }
            "dependent_selector" => {
                let max_count = item
                    .items
                    .as_ref()
                    .map(|mi| match mi {
                        crate::models::config::MenuItems::Nested(groups) => {
                            groups.iter().map(|g| g.len()).max().unwrap_or(1) as i32 - 1
                        }
                        crate::models::config::MenuItems::Flat(items) => {
                            items.len().saturating_sub(1) as i32
                        }
                    })
                    .unwrap_or(0);
                self.analyze_var_persistence(item, 0, max_count)
            }
            "custom" if item.var.is_some() && item.min.is_some() && item.max.is_some() => {
                self.analyze_var_persistence(item, item.min.unwrap(), item.max.unwrap())
            }
            "value" | "toggle" => {
                let (min, max) = if item.r#type == "toggle" {
                    (0, 1)
                } else {
                    (item.min.unwrap_or(0), item.max.unwrap_or(100))
                };
                self.analyze_var_persistence(item, min, max)
            }
            _ => (Vec::new(), 0),
        }
    }

    fn analyze_option_persistence(&self, opt: &MenuOption) -> (Vec<PersistVar>, u32) {
        let (min, max) = if opt.r#type == "toggle" {
            (0, 1)
        } else {
            (opt.min.unwrap_or(0), opt.max.unwrap_or(100))
        };
        let default = opt
            .default
            .as_ref()
            .and_then(|v| v.as_i64())
            .unwrap_or(0);
        let bit_width = calculate_bit_width(min, max);
        let profile_aware = opt.profile_aware.unwrap_or(false);

        let mut vars = Vec::new();
        let mut total = 0u32;

        if profile_aware && self.profile_count > 0 {
            for p in 0..self.profile_count as usize {
                vars.push(PersistVar {
                    var_access: format!("{}[{}]", opt.var, p),
                    var_name: opt.var.clone(),
                    index: Some(p),
                    min,
                    max,
                    default,
                    bit_width,
                });
                total += bit_width;
            }
        } else {
            vars.push(PersistVar {
                var_access: opt.var.clone(),
                var_name: opt.var.clone(),
                index: None,
                min,
                max,
                default,
                bit_width,
            });
            total += bit_width;
        }

        (vars, total)
    }

    fn analyze_var_persistence(
        &self,
        item: &MenuItem,
        min: i32,
        max: i32,
    ) -> (Vec<PersistVar>, u32) {
        let var_name = item
            .var
            .as_ref()
            .cloned()
            .unwrap_or_else(|| sanitize_var_name(&item.name));
        let default = item
            .default
            .as_ref()
            .and_then(|v| v.as_i64())
            .unwrap_or(0);
        let bit_width = calculate_bit_width(min, max);
        let profile_aware = item.profile_aware.unwrap_or(false);

        let mut vars = Vec::new();
        let mut total = 0u32;

        if profile_aware && self.profile_count > 0 {
            for p in 0..self.profile_count as usize {
                vars.push(PersistVar {
                    var_access: format!("{}[{}]", var_name, p),
                    var_name: var_name.clone(),
                    index: Some(p),
                    min,
                    max,
                    default,
                    bit_width,
                });
                total += bit_width;
            }
        } else {
            vars.push(PersistVar {
                var_access: var_name.clone(),
                var_name,
                index: None,
                min,
                max,
                default,
                bit_width,
            });
            total += bit_width;
        }

        (vars, total)
    }

    fn find_module_metadata(
        &self,
        menu_name: &str,
        explicit_module: Option<&str>,
    ) -> Option<&ModuleDefinition> {
        if let Some(module_key) = explicit_module {
            if let Some(meta) = self.modules_metadata.get(module_key) {
                return Some(meta);
            }
        }
        let menu_lower = menu_name.to_lowercase().replace(' ', "");
        for (mod_id, mod_data) in &self.modules_metadata {
            if mod_data.display_name.to_lowercase().replace(' ', "") == menu_lower {
                return Some(mod_data);
            }
            if mod_id.to_lowercase().replace('_', "") == menu_lower.replace('_', "") {
                return Some(mod_data);
            }
        }
        None
    }

    fn has_module(&self, module_id: &str) -> bool {
        self.analyzed.iter().any(|m| {
            let meta = self.find_module_metadata(&m.item.name, m.item.module.as_deref());
            meta.map(|m| m.id.as_str()) == Some(module_id)
        })
    }

    fn get_menu_modules(&self) -> Vec<&AnalyzedModule> {
        self.analyzed.iter().filter(|m| !m.is_data_module).collect()
    }

    fn get_weapon_count(&self, for_adp: bool) -> usize {
        if !self.weapons_list.is_empty() {
            return self.weapons_list.len();
        }
        // Fallback to parsing extra_vars array size
        if let Some(extra_vars) = &self.config.extra_vars {
            if let Some(array_def) = extra_vars.get("Weapons_RecoilValues") {
                if let Some(bracket_pos) = array_def.find('[') {
                    let size_str = &array_def[bracket_pos + 1..array_def.find(']').unwrap_or(array_def.len())];
                    if let Ok(total_size) = size_str.trim().parse::<usize>() {
                        let count = total_size / 2;
                        return if for_adp { count - 1 } else { count };
                    }
                }
            }
        }
        30 // Default
    }

    /// Generate all files. Returns list of (path, content) pairs.
    pub fn generate_all(&mut self) -> GenerateResult {
        let mut files = Vec::new();

        // Generate per-module files
        for i in 0..self.analyzed.len() {
            let (filename, content) = self.generate_module(i);
            files.push((format!("modules/{}", filename), content));
        }

        // Generate core.gpc
        let core = self.generate_core();
        files.push(("modules/core.gpc".to_string(), core));

        // Generate main.gpc
        let main = self.generate_main();
        files.push(("main.gpc".to_string(), main));

        // Generate recoiltable if needed
        if self.has_module("antirecoil_timeline") {
            let recoil = self.generate_recoiltable();
            files.push(("recoiltable.gpc".to_string(), recoil));
        }

        GenerateResult { files }
    }

    fn generate_module(&mut self, idx: usize) -> (String, String) {
        let module = self.analyzed[idx].clone();
        let item = &module.item;
        let name = &module.sanitized_name;
        let module_meta = self.find_module_metadata(&item.name, item.module.as_deref()).cloned();

        let mut out = String::with_capacity(4096);

        // Header
        writeln!(out, "// ===================== MODULE: {} =====================", module.name).unwrap();
        writeln!(out, "// Generated by generate.py - Edit freely, changes won't be overwritten").unwrap();
        if let Some(ref meta) = module_meta {
            if let Some(ref desc) = meta.description {
                for line in desc.lines() {
                    writeln!(out, "// {}", line).unwrap();
                }
            }
        }
        writeln!(out).unwrap();

        // Metadata defines
        writeln!(out, "// Module metadata").unwrap();
        writeln!(out, "define {}_PAGE = {};", name, module.page).unwrap();
        writeln!(out, "define {}_Y = {};", name, module.y_pos).unwrap();
        writeln!(out, "define {}_RECT_Y = {};", name, module.rect_y).unwrap();
        if let Some(mid) = module.menu_id {
            writeln!(out, "define {}_MENU_ID = {};", name, mid).unwrap();
        }
        writeln!(out, "define {}_BIT_OFFSET = {};", name, module.bit_offset).unwrap();
        writeln!(out, "define {}_TOTAL_BITS = {};", name, module.total_bits).unwrap();
        writeln!(out).unwrap();

        // String constants
        writeln!(out, "// String constants").unwrap();
        writeln!(out, "const string {}_Text[] = {{\"{}\"}};", name, item.name).unwrap();

        if let Some(ref sd) = item.state_display {
            writeln!(out, "const string {}_StateLabel[] = {{\"{}\"}};", name, sd).unwrap();
        }

        // Option labels
        if let Some(ref labels) = item.option_labels {
            let labels_str = labels.iter().map(|s| format!("\"{}\"", s)).collect::<Vec<_>>().join(", ");
            writeln!(out, "const string {}_OptionText[] = {{{}}};", name, labels_str).unwrap();
        } else if item.r#type == "clickable" {
            if let Some(ref opts) = item.options {
                if !opts.is_empty() {
                    let labels_str = opts.iter().map(|o| format!("\"{}\"", o.name)).collect::<Vec<_>>().join(", ");
                    writeln!(out, "const string {}_OptionText[] = {{{}}};", name, labels_str).unwrap();
                }
            } else if let Some(ref meta) = module_meta {
                // Fallback: use option names from module metadata
                if !meta.options.is_empty() {
                    let labels_str = meta.options.iter().map(|o| format!("\"{}\"", o.name)).collect::<Vec<_>>().join(", ");
                    writeln!(out, "const string {}_OptionText[] = {{{}}};", name, labels_str).unwrap();
                }
            }
        }

        // Selector items
        if item.r#type == "selector" {
            if let Some(MenuItems::Flat(ref items)) = item.items {
                let items_str = items.iter().map(|s| format!("\"{}\"", s)).collect::<Vec<_>>().join(", ");
                writeln!(out, "const string {}_Items[] = {{{}}};", name, items_str).unwrap();
                writeln!(out, "define {}_MAX_INDEX = {};", name, items.len() - 1).unwrap();
            }
        }

        // Dependent selector items
        if item.r#type == "dependent_selector" {
            if let Some(MenuItems::Nested(ref groups)) = item.items {
                let mut all_items = Vec::new();
                let mut offsets = Vec::new();
                let mut counts = Vec::new();
                for group in groups {
                    offsets.push(all_items.len());
                    counts.push(group.len());
                    all_items.extend(group.iter().cloned());
                }
                let items_str = all_items.iter().map(|s| format!("\"{}\"", s)).collect::<Vec<_>>().join(", ");
                writeln!(out, "const string {}_Items[] = {{{}}};", name, items_str).unwrap();
                let offsets_str = offsets.iter().map(|o| o.to_string()).collect::<Vec<_>>().join(", ");
                let counts_str = counts.iter().map(|c| c.to_string()).collect::<Vec<_>>().join(", ");
                writeln!(out, "const int8 {}_Offsets[] = {{{}}};", name, offsets_str).unwrap();
                writeln!(out, "const int8 {}_Counts[] = {{{}}};", name, counts_str).unwrap();
                writeln!(out, "define {}_MAX_COUNT = {};", name, counts.iter().max().unwrap_or(&1)).unwrap();
            }
        }

        writeln!(out).unwrap();

        // Variable declarations
        self.write_module_variables(&mut out, &module, module_meta.as_ref());

        // Pagination variable
        if item.r#type == "clickable" {
            writeln!(out, "int {}_Page, {}_DrawnPage;", name, name).unwrap();
            writeln!(out).unwrap();
        }

        // Helper functions (display, edit, render)
        self.write_module_functions(&mut out, &module);

        // Persistence functions
        self.write_module_persistence(&mut out, &module);

        // Special weapon/ADP data
        let has_adp = self.has_module("adp");
        let is_adp = module_meta.as_ref().map(|m| m.id == "adp").unwrap_or(false);
        let is_weapondata = module_meta.as_ref().map(|m| m.id == "weapondata").unwrap_or(false);

        if is_adp {
            writeln!(out).unwrap();
            self.write_weapon_data(&mut out, true);
            self.write_adp_data(&mut out);
            writeln!(out).unwrap();
        } else if is_weapondata && !has_adp {
            writeln!(out).unwrap();
            self.write_weapon_data(&mut out, false);
            writeln!(out).unwrap();
        }

        // Combo code from module metadata
        let filter_weapondata = is_weapondata && has_adp;
        if let Some(ref meta) = module_meta {
            if let Some(ref combo) = meta.combo {
                let mut combo_code = combo.trim().to_string();
                if !combo_code.is_empty() {
                    // Inject ADP checks
                    if meta.id == "adp" && combo_code.contains("INJECT_ADP_CHECKS_HERE") {
                        let weapon_count = self.get_weapon_count(true);
                        let adp_checks = self.generate_adp_weapon_checks(weapon_count);
                        combo_code = combo_code.replace("// INJECT_ADP_CHECKS_HERE", &adp_checks);
                    }

                    // Filter duplicate functions from weapondata when ADP present
                    if filter_weapondata {
                        for func in &["Weapon_DisplayName", "Weapon_Edit", "GetActiveWeapon"] {
                            combo_code = remove_function(&combo_code, func);
                        }
                    }

                    // Profile-aware transforms
                    if self.profile_count > 0 {
                        combo_code = self.make_profile_aware(&combo_code, &module);
                    }

                    writeln!(out).unwrap();
                    writeln!(out, "// Combo definitions").unwrap();
                    writeln!(out, "{}", combo_code).unwrap();
                    writeln!(out).unwrap();
                }
            }
        }

        // Main block - gameplay logic
        writeln!(out, "main {{").unwrap();
        self.write_module_main(&mut out, &module, module_meta.as_ref());
        writeln!(out, "}}").unwrap();

        let filename = format!("{}.gpc", module.file_id);
        (filename, out)
    }

    fn write_module_variables(
        &mut self,
        out: &mut String,
        module: &AnalyzedModule,
        module_meta: Option<&ModuleDefinition>,
    ) {
        let mut has_module_vars = false;
        for pvar in &module.persist_vars {
            if !self.global_declared_vars.contains(&pvar.var_name) {
                if !has_module_vars {
                    writeln!(out, "// Module variables").unwrap();
                    has_module_vars = true;
                }
                self.global_declared_vars.insert(pvar.var_name.clone());
                if pvar.index.is_some() {
                    writeln!(out, "int {}[{}];", pvar.var_name, self.profile_count).unwrap();
                } else {
                    writeln!(out, "int {};", pvar.var_name).unwrap();
                }
            }
        }
        if has_module_vars {
            writeln!(out).unwrap();
        }

        // Declare status_var from module metadata if not already declared
        if let Some(meta) = module_meta {
            if let Some(ref sv) = meta.status_var {
                if !self.global_declared_vars.contains(sv) {
                    if !has_module_vars {
                        writeln!(out, "// Module variables").unwrap();
                    }
                    self.global_declared_vars.insert(sv.clone());
                    writeln!(out, "int {};", sv).unwrap();
                    writeln!(out).unwrap();
                }
            }
        }

        // Extra variables from module metadata
        if let Some(meta) = module_meta {
            let mut has_extra = false;
            for (var_name, var_type) in &meta.extra_vars {
                if !self.global_declared_vars.contains(var_name) {
                    if !has_extra {
                        writeln!(out, "// Extra module variables").unwrap();
                        has_extra = true;
                    }
                    self.global_declared_vars.insert(var_name.clone());
                    if var_type.to_lowercase().contains("[profile]") {
                        let base_type = var_type.split('[').next().unwrap_or("int").trim();
                        if self.profile_count > 0 {
                            writeln!(out, "{} {}[{}];", base_type, var_name, self.profile_count).unwrap();
                        } else {
                            writeln!(out, "{} {};", base_type, var_name).unwrap();
                        }
                    } else if var_type.contains('[') {
                        let parts: Vec<&str> = var_type.splitn(2, '[').collect();
                        let base_type = parts[0].trim();
                        writeln!(out, "{} {}[{}", base_type, var_name, parts[1]).unwrap();
                    } else {
                        writeln!(out, "{} {};", var_type, var_name).unwrap();
                    }
                }
            }
            if has_extra {
                writeln!(out).unwrap();
            }
        }
    }

    fn write_module_functions(&self, out: &mut String, module: &AnalyzedModule) {
        let item = &module.item;
        let name = &module.sanitized_name;

        // Display function
        let display_func = item.display_function.as_deref().unwrap_or("");
        if display_func != format!("{}_Display", name) {
            writeln!(out, "function {}_Display(x, y) {{", name).unwrap();
            if item.r#type == "custom" && !display_func.is_empty() {
                writeln!(out, "    {}(x, y);", display_func).unwrap();
            } else {
                let val_x = item.value_x.unwrap_or(TEXT_X_TOGGLE as u32);
                let num_x = item.value_x.unwrap_or(TEXT_X_NUMBER as u32);
                writeln!(out, "    print(x, y, OLED_FONT_SMALL, OLED_WHITE, {}_Text[0]);", name).unwrap();

                match item.r#type.as_str() {
                    "toggle" => {
                        let var = get_var_name(item);
                        writeln!(out, "    drawing_toggle({}, y, {});", val_x, var).unwrap();
                    }
                    "value" => {
                        let var = get_var_name(item);
                        writeln!(out, "    PrintNumber({v}, find_digits({v}), {x}, y, OLED_FONT_SMALL);", v = var, x = num_x).unwrap();
                    }
                    "selector" => {
                        let var = get_var_name(item);
                        writeln!(out, "    print({}, y, OLED_FONT_SMALL, OLED_WHITE, {}_Items[{}]);", val_x, name, var).unwrap();
                    }
                    "dependent_selector" => {
                        let var = get_var_name(item);
                        let parent = item.depends_on.as_deref().unwrap_or("Profile");
                        let var_access = self.var_access(&var, item.profile_aware.unwrap_or(false));
                        writeln!(out, "    print({}, y, OLED_FONT_SMALL, OLED_WHITE, {}_Items[{}_Offsets[{}] + {}]);", val_x, name, name, parent, var_access).unwrap();
                    }
                    "clickable" if item.status_var.is_some() => {
                        let sv = item.status_var.as_ref().unwrap();
                        let var_access = self.var_access(sv, item.profile_aware.unwrap_or(false));
                        writeln!(out, "    drawing_toggle({}, y, {});", val_x, var_access).unwrap();
                    }
                    _ => {}
                }
            }
            writeln!(out, "}}").unwrap();
            writeln!(out).unwrap();
        }

        // Edit function
        let edit_func = item.edit_function.as_deref().unwrap_or("");
        let needs_edit = matches!(item.r#type.as_str(), "value" | "toggle" | "selector" | "dependent_selector")
            || (item.r#type == "custom" && !edit_func.is_empty());
        if needs_edit && edit_func != format!("{}_Edit", name) {
            writeln!(out, "function {}_Edit() {{", name).unwrap();
            if item.r#type == "custom" && !edit_func.is_empty() {
                writeln!(out, "    {}();", edit_func).unwrap();
            } else {
                match item.r#type.as_str() {
                    "toggle" => {
                        let var = get_var_name(item);
                        writeln!(out, "    if (event_press(RIGHT_BTN) || event_press(LEFT_BTN)) {{").unwrap();
                        writeln!(out, "        {} = !{};", var, var).unwrap();
                        writeln!(out, "    }}").unwrap();
                    }
                    "value" => {
                        let var = get_var_name(item);
                        writeln!(out, "    if (event_press(RIGHT_BTN)) {{ {}++; }}", var).unwrap();
                        writeln!(out, "    if (event_press(LEFT_BTN)) {{ {}--; }}", var).unwrap();
                    }
                    "selector" => {
                        let var = get_var_name(item);
                        writeln!(out, "    if (event_press(RIGHT_BTN)) {{").unwrap();
                        writeln!(out, "        {}++;", var).unwrap();
                        writeln!(out, "        if ({} > {}_MAX_INDEX) {{ {} = 0; }}", var, name, var).unwrap();
                        writeln!(out, "    }}").unwrap();
                        writeln!(out, "    if (event_press(LEFT_BTN)) {{").unwrap();
                        writeln!(out, "        {}--;", var).unwrap();
                        writeln!(out, "        if ({} < 0) {{ {} = {}_MAX_INDEX; }}", var, var, name).unwrap();
                        writeln!(out, "    }}").unwrap();
                    }
                    "dependent_selector" => {
                        let var = get_var_name(item);
                        let parent = item.depends_on.as_deref().unwrap_or("Profile");
                        let var_access = self.var_access(&var, item.profile_aware.unwrap_or(false));
                        let resets = item.resets.as_deref().unwrap_or(&[]);
                        if !resets.is_empty() {
                            writeln!(out, "    _prev = {};", var_access).unwrap();
                        }
                        writeln!(out, "    if (event_press(RIGHT_BTN)) {{").unwrap();
                        writeln!(out, "        {}++;", var_access).unwrap();
                        writeln!(out, "        if ({} >= {}_Counts[{}]) {{ {} = 0; }}", var_access, name, parent, var_access).unwrap();
                        writeln!(out, "    }}").unwrap();
                        writeln!(out, "    if (event_press(LEFT_BTN)) {{").unwrap();
                        writeln!(out, "        {}--;", var_access).unwrap();
                        writeln!(out, "        if ({} < 0) {{ {} = {}_Counts[{}] - 1; }}", var_access, var_access, name, parent).unwrap();
                        writeln!(out, "    }}").unwrap();
                        if !resets.is_empty() {
                            writeln!(out, "    if ({} != _prev) {{", var_access).unwrap();
                            for rv in resets {
                                let ra = if self.profile_count > 0 { format!("{}[Profile]", rv) } else { rv.clone() };
                                writeln!(out, "        {} = 0;", ra).unwrap();
                            }
                            writeln!(out, "    }}").unwrap();
                        }
                    }
                    _ => {}
                }
            }
            writeln!(out, "}}").unwrap();
            writeln!(out).unwrap();
        }

        // Render function
        if let Some(ref render_func) = item.render_function {
            writeln!(out, "function {}_Render() {{", name).unwrap();
            writeln!(out, "    {}();", render_func).unwrap();
            writeln!(out, "}}").unwrap();
            writeln!(out).unwrap();
        } else if item.r#type == "clickable" {
            self.write_clickable_submenu(out, module);
        }
    }

    fn write_clickable_submenu(&self, out: &mut String, module: &AnalyzedModule) {
        let item = &module.item;
        let name = &module.sanitized_name;
        let options = item.options.as_deref().unwrap_or(&[]);
        let pages = calculate_pages(options.len());

        writeln!(out, "function {}_Render() {{", name).unwrap();
        writeln!(out, "    Clear();").unwrap();
        writeln!(out, "    draw_scroll_dynamic({}_Page, {});", name, pages).unwrap();
        writeln!(out, "    XSelect(rect_y);").unwrap();
        writeln!(out).unwrap();
        writeln!(out, "    if (event_press(UP_BTN)) {{ rect_y -= 16; }}").unwrap();
        writeln!(out, "    if (event_press(DOWN_BTN)) {{ rect_y += 16; }}").unwrap();
        writeln!(out).unwrap();

        for page in 0..pages {
            let start = page * ITEMS_PER_PAGE;
            let end = (start + ITEMS_PER_PAGE).min(options.len());

            let indent = if pages > 1 {
                writeln!(out, "    if ({}_Page == {}) {{", name, page).unwrap();
                "        "
            } else {
                "    "
            };

            for i in start..end {
                let opt = &options[i];
                let pos = i % ITEMS_PER_PAGE;
                let text_y = TEXT_Y_POSITIONS[pos];
                let rect_y_pos = RECT_Y_POSITIONS[pos];
                let var_access = self.opt_var_access(opt);

                writeln!(out, "{}print({}, {}, OLED_FONT_SMALL, OLED_WHITE, {}_OptionText[{}]);",
                    indent, TEXT_X_LABEL, text_y, name, i).unwrap();

                if opt.r#type == "value" {
                    writeln!(out, "{}PrintNumber({v}, find_digits({v}), {x}, {y}, OLED_FONT_SMALL);",
                        indent, v = var_access, x = TEXT_X_NUMBER, y = text_y).unwrap();
                    writeln!(out, "{}if (rect_y == {}) {{", indent, rect_y_pos).unwrap();
                    writeln!(out, "{}    if (get_val(ADS_BTN) && event_press(RIGHT_BTN)) {{ {} += 10; }}", indent, var_access).unwrap();
                    writeln!(out, "{}    else if (event_press(RIGHT_BTN)) {{ {}++; }}", indent, var_access).unwrap();
                    writeln!(out, "{}    if (get_val(ADS_BTN) && event_press(LEFT_BTN)) {{ {} -= 10; }}", indent, var_access).unwrap();
                    writeln!(out, "{}    else if (event_press(LEFT_BTN)) {{ {}--; }}", indent, var_access).unwrap();
                    writeln!(out, "{}}}", indent).unwrap();
                } else if opt.r#type == "toggle" {
                    writeln!(out, "{}drawing_toggle({}, {}, {});", indent, TEXT_X_TOGGLE, text_y, var_access).unwrap();
                    writeln!(out, "{}if (rect_y == {}) {{", indent, rect_y_pos).unwrap();
                    writeln!(out, "{}    if (event_press(RIGHT_BTN) || event_press(LEFT_BTN)) {{", indent).unwrap();
                    writeln!(out, "{}        {} = !{};", indent, var_access, var_access).unwrap();
                    writeln!(out, "{}    }}", indent).unwrap();
                    writeln!(out, "{}}}", indent).unwrap();
                }
            }

            if pages > 1 {
                writeln!(out, "    }}").unwrap();
            }
        }
        writeln!(out).unwrap();

        // Exit
        writeln!(out, "    if (event_press(CANCEL_BTN)) {{").unwrap();
        writeln!(out, "        Menu = 1;").unwrap();
        writeln!(out, "        rect_y = 12;").unwrap();
        writeln!(out, "        _CoreSave();").unwrap();
        writeln!(out, "    }}").unwrap();
        writeln!(out).unwrap();

        // Pagination bounds
        if pages > 1 {
            writeln!(out, "    // Pagination bounds").unwrap();
            for page in 0..pages {
                let start = page * ITEMS_PER_PAGE;
                let end = (start + ITEMS_PER_PAGE).min(options.len());
                let items_on_page = end - start;
                let max_rect_y = RECT_Y_POSITIONS[items_on_page - 1];
                writeln!(out, "    if ({}_Page == {}) {{", name, page).unwrap();
                writeln!(out, "        if (rect_y < 12) {{ rect_y = 12; }}").unwrap();
                writeln!(out, "        if (rect_y > {}) {{ rect_y = {}; }}", max_rect_y, max_rect_y).unwrap();
                writeln!(out, "    }}").unwrap();
            }
        } else {
            let items_on_page = options.len().min(ITEMS_PER_PAGE);
            if items_on_page > 0 {
                let max_rect_y = RECT_Y_POSITIONS[items_on_page - 1];
                writeln!(out, "    // Bounds").unwrap();
                writeln!(out, "    if (rect_y < 12) {{ rect_y = 12; }}").unwrap();
                writeln!(out, "    if (rect_y > {}) {{ rect_y = {}; }}", max_rect_y, max_rect_y).unwrap();
            }
        }
        writeln!(out).unwrap();

        // Value clamping
        writeln!(out, "    // Value bounds").unwrap();
        for opt in options {
            if opt.r#type == "value" {
                let var_access = self.opt_var_access(opt);
                let min = opt.min.unwrap_or(0);
                let max = opt.max.unwrap_or(100);
                writeln!(out, "    if ({} < {}) {{ {} = {}; }}", var_access, min, var_access, min).unwrap();
                writeln!(out, "    if ({} > {}) {{ {} = {}; }}", var_access, max, var_access, max).unwrap();
            }
        }

        writeln!(out, "}}").unwrap();
        writeln!(out).unwrap();
    }

    fn write_module_persistence(&self, out: &mut String, module: &AnalyzedModule) {
        let name = &module.sanitized_name;

        writeln!(out, "function {}_Save() {{", name).unwrap();
        if module.persist_vars.is_empty() {
            writeln!(out, "    return;").unwrap();
        } else {
            for pvar in &module.persist_vars {
                writeln!(out, "    save_spvar({}, {}, {});", pvar.var_access, pvar.min, pvar.max).unwrap();
            }
        }
        writeln!(out, "}}").unwrap();
        writeln!(out).unwrap();

        writeln!(out, "function {}_Load(has_data) {{", name).unwrap();
        if module.persist_vars.is_empty() {
            writeln!(out, "    return;").unwrap();
        } else {
            writeln!(out, "    if (!has_data) {{").unwrap();
            writeln!(out, "        // No saved data - use defaults").unwrap();
            for pvar in &module.persist_vars {
                writeln!(out, "        {} = {};", pvar.var_access, pvar.default).unwrap();
            }
            writeln!(out, "        return;").unwrap();
            writeln!(out, "    }}").unwrap();
            writeln!(out).unwrap();
            for pvar in &module.persist_vars {
                writeln!(out, "    {} = read_spvar({}, {}, {});", pvar.var_access, pvar.min, pvar.max, pvar.default).unwrap();
            }
        }
        writeln!(out, "}}").unwrap();
        writeln!(out).unwrap();
    }

    fn write_module_main(
        &self,
        out: &mut String,
        module: &AnalyzedModule,
        module_meta: Option<&ModuleDefinition>,
    ) {
        let name = &module.sanitized_name;
        let item = &module.item;

        writeln!(out, "    // ===== GAMEPLAY ACTIVATION =====").unwrap();
        if item.custom_trigger.unwrap_or(false) {
            writeln!(out, "    // Custom trigger defined in adapters.gpc").unwrap();
        } else if let Some(ref meta) = module_meta {
            if let Some(ref trigger) = meta.trigger {
                let mut trigger_code = trigger.trim().to_string();
                if self.profile_count > 0 {
                    trigger_code = self.make_profile_aware(&trigger_code, module);
                }
                writeln!(out, "    if (Menu == 0) {{").unwrap();
                for line in trigger_code.lines() {
                    if line.trim().is_empty() {
                        writeln!(out).unwrap();
                    } else {
                        writeln!(out, "        {}", line).unwrap();
                    }
                }
                writeln!(out, "    }}").unwrap();
            }
        } else {
            writeln!(out, "    // TODO: Add activation logic here").unwrap();
        }
        writeln!(out).unwrap();

        // Quick toggle
        let keyboard = &self.config.keyboard;
        let config_module_id = item.module.as_deref().unwrap_or("");
        let meta_module_id = module_meta.map(|m| m.id.as_str()).unwrap_or("");

        let keyboard_key = keyboard.iter().find_map(|(key, _value)| {
            let key_lower = key.to_lowercase();
            if (!config_module_id.is_empty() && key_lower.contains(&config_module_id.to_lowercase()))
                || (!meta_module_id.is_empty() && key_lower.contains(&meta_module_id.to_lowercase()))
                || key_lower.contains(&name.to_lowercase())
            {
                Some(format!("KB_{}", key.to_uppercase()))
            } else {
                None
            }
        });

        if let Some(kb_key) = keyboard_key {
            let status_var = item.status_var.as_deref().or_else(|| {
                if item.r#type == "clickable" {
                    item.options.as_ref().and_then(|opts| {
                        opts.iter()
                            .find(|o| o.name.to_lowercase().contains("status"))
                            .map(|o| o.var.as_str())
                    })
                } else {
                    None
                }
            });

            if let Some(sv) = status_var {
                let profile_aware = item
                    .options
                    .as_ref()
                    .and_then(|opts| opts.iter().find(|o| o.var == sv))
                    .and_then(|o| o.profile_aware)
                    .unwrap_or(false);
                let var_access = self.var_access(sv, profile_aware);

                writeln!(out, "    // Quick toggle").unwrap();
                writeln!(out, "    if (QuickToggleTimeout <= 0 && GetKeyboardKey({})) {{", kb_key).unwrap();
                writeln!(out, "        {} = !{};", var_access, var_access).unwrap();
                writeln!(out, "        _CoreSave();").unwrap();
                writeln!(out, "        DrewStates = FALSE;").unwrap();
                writeln!(out, "        ScreenTimeout = 0;").unwrap();
                writeln!(out, "        QuickToggleTimeout = QUICKTOGGLE_DELAY;").unwrap();
                writeln!(out, "    }}").unwrap();
                writeln!(out).unwrap();
            }
        }
    }

    fn generate_core(&self) -> String {
        let mut out = String::with_capacity(8192);
        let menu_modules = self.get_menu_modules();

        writeln!(out, "// ===================== CORE MENU FRAMEWORK =====================").unwrap();
        writeln!(out, "// Generated by generate.py - Edit freely, changes won't be overwritten").unwrap();
        writeln!(out).unwrap();
        writeln!(out, "// Loops").unwrap();
        writeln!(out, "int i;").unwrap();
        writeln!(out).unwrap();
        writeln!(out, "// Menu state").unwrap();
        writeln!(out, "int Menu, Menu_Page, rect_y;").unwrap();
        writeln!(out, "int DrewStates, MenuIsOpen, ScreenTimeout;").unwrap();
        writeln!(out, "define ScreenTimeoutLimit = 3000;").unwrap();
        writeln!(out).unwrap();
        writeln!(out, "// Quick toggle debounce").unwrap();
        writeln!(out, "int QuickToggleTimeout;").unwrap();
        writeln!(out, "define QUICKTOGGLE_DELAY = 20;").unwrap();
        writeln!(out).unwrap();

        // Profile support
        if self.profile_count > 0 {
            writeln!(out, "// Profile").unwrap();
            writeln!(out, "int Profile;").unwrap();
            if let Some(ref labels) = self.config.state_screen.profile_labels {
                let labels_str = labels.iter().map(|s| format!("\"{}\"", s)).collect::<Vec<_>>().join(", ");
                writeln!(out, "const string ProfileLabels[] = {{{}}};", labels_str).unwrap();
            }
            writeln!(out).unwrap();
        }

        // Temp var for cascade resets
        let has_resets = self.config.menu.iter().any(|item| {
            item.r#type == "dependent_selector" && item.resets.as_ref().map(|r| !r.is_empty()).unwrap_or(false)
        });
        if has_resets {
            writeln!(out, "int _prev;").unwrap();
            writeln!(out).unwrap();
        }

        // Module counts
        writeln!(out, "// Module metadata").unwrap();
        writeln!(out, "define MENU_ITEM_COUNT = {};", menu_modules.len()).unwrap();
        writeln!(out, "define MENU_PAGE_COUNT = {};", calculate_pages(menu_modules.len())).unwrap();
        let total_bits: u32 = 1 + self.analyzed.iter().map(|m| m.total_bits).sum::<u32>();
        writeln!(out, "define TOTAL_PERSIST_BITS = {};", total_bits).unwrap();
        writeln!(out).unwrap();

        // Extra variables from config
        self.write_extra_vars(&mut out);

        // SPVAR definition
        writeln!(out, "// Persistence").unwrap();
        writeln!(out, "define SPVAR_BITPACK_START = SPVAR_1;").unwrap();
        writeln!(out).unwrap();

        // Button definitions
        self.write_button_defines(&mut out);

        // Keyboard definitions
        if !self.config.keyboard.is_empty() {
            writeln!(out, "// Keyboard definitions").unwrap();
            for (key, value) in &self.config.keyboard {
                writeln!(out, "define KB_{} = {};", key.to_uppercase(), value).unwrap();
            }
            writeln!(out).unwrap();
        }

        // Module param definitions
        self.write_module_param_defines(&mut out);

        // State screen title
        let title = resolve_config_template(&self.config.state_screen.title, &self.config);
        writeln!(out, "const string StateTitle[] = {{\"{}\"}};", title).unwrap();
        if self.has_module("adp") {
            writeln!(out, "const string WaitingText[] = {{\"Waiting...\"}};").unwrap();
        }
        writeln!(out).unwrap();

        // _CoreSave
        writeln!(out, "function _CoreSave() {{").unwrap();
        writeln!(out, "    spvar_current_slot = SPVAR_BITPACK_START;").unwrap();
        writeln!(out, "    spvar_current_bit = 0;").unwrap();
        writeln!(out, "    spvar_current_value = 0;").unwrap();
        writeln!(out, "    spvar_total_bits = 0;").unwrap();
        writeln!(out).unwrap();
        writeln!(out, "    save_spvar(1, 0, 1);  // data-exists marker").unwrap();
        for module in &self.analyzed {
            if !module.persist_vars.is_empty() {
                writeln!(out, "    {}_Save();", module.sanitized_name).unwrap();
            }
        }
        writeln!(out, "    flush_spvar();").unwrap();
        writeln!(out, "}}").unwrap();
        writeln!(out).unwrap();

        // _CoreLoad
        writeln!(out, "function _CoreLoad() {{").unwrap();
        writeln!(out, "    spvar_current_slot = SPVAR_BITPACK_START;").unwrap();
        writeln!(out, "    spvar_current_bit = 0;").unwrap();
        writeln!(out, "    spvar_current_value = 0;").unwrap();
        writeln!(out, "    spvar_total_bits = 0;").unwrap();
        writeln!(out).unwrap();
        writeln!(out, "    // Check data-exists marker").unwrap();
        writeln!(out, "    if (read_spvar(0, 1, 0) == 0) {{").unwrap();
        writeln!(out, "        // No data - load defaults").unwrap();
        for module in &self.analyzed {
            if !module.persist_vars.is_empty() {
                writeln!(out, "        {}_Load(FALSE);", module.sanitized_name).unwrap();
            }
        }
        writeln!(out, "        return;").unwrap();
        writeln!(out, "    }}").unwrap();
        writeln!(out).unwrap();
        writeln!(out, "    // Data exists - load sequentially").unwrap();
        for module in &self.analyzed {
            if !module.persist_vars.is_empty() {
                writeln!(out, "    {}_Load(TRUE);", module.sanitized_name).unwrap();
            }
        }
        writeln!(out, "}}").unwrap();
        writeln!(out).unwrap();

        // _MenuOpen
        writeln!(out, "function _MenuOpen() {{").unwrap();
        writeln!(out, "    if (get_val(MENU_MOD_BTN) && event_press(MENU_BTN_BTN) ||").unwrap();
        writeln!(out, "        get_val(MENU_BTN_BTN) && event_press(MENU_MOD_BTN)) {{").unwrap();
        writeln!(out, "        Menu = 1;").unwrap();
        writeln!(out, "        Menu_Page = 0;").unwrap();
        writeln!(out, "        rect_y = 12;").unwrap();
        writeln!(out, "        DrewStates = FALSE;").unwrap();
        writeln!(out, "        MenuIsOpen = TRUE;").unwrap();
        writeln!(out, "        ScreenTimeout = 0;").unwrap();
        writeln!(out, "    }}").unwrap();
        writeln!(out, "}}").unwrap();
        writeln!(out).unwrap();

        // _CoreMainMenu
        self.write_core_main_menu(&mut out, &menu_modules);

        // _CoreMainMenuInteraction
        self.write_core_main_menu_interaction(&mut out, &menu_modules);

        // _CoreStateScreen
        self.write_core_state_screen(&mut out);

        // init block
        writeln!(out, "init {{").unwrap();
        writeln!(out, "    Clear();").unwrap();
        writeln!(out, "    _CoreLoad();").unwrap();
        writeln!(out, "    MenuIsOpen = FALSE;").unwrap();
        writeln!(out, "}}").unwrap();
        writeln!(out).unwrap();

        // main block
        writeln!(out, "main {{").unwrap();
        writeln!(out, "    _MenuOpen();").unwrap();
        writeln!(out).unwrap();
        writeln!(out, "    if (Menu == 0) {{").unwrap();
        writeln!(out, "        _CoreStateScreen();").unwrap();
        writeln!(out, "    }}").unwrap();
        writeln!(out).unwrap();
        writeln!(out, "    if (Menu == 1) {{").unwrap();
        writeln!(out, "        _CoreMainMenu();").unwrap();
        writeln!(out, "        _CoreMainMenuInteraction();").unwrap();
        writeln!(out, "    }}").unwrap();
        writeln!(out).unwrap();

        for module in &self.analyzed {
            if let Some(mid) = module.menu_id {
                writeln!(out, "    if (Menu == {}) {{", mid).unwrap();
                writeln!(out, "        {}_Render();", module.sanitized_name).unwrap();
                writeln!(out, "    }}").unwrap();
                writeln!(out).unwrap();
            }
        }

        writeln!(out, "    // Quick toggle debounce").unwrap();
        writeln!(out, "    if (QuickToggleTimeout > 0) {{").unwrap();
        writeln!(out, "        QuickToggleTimeout--;").unwrap();
        writeln!(out, "    }}").unwrap();
        writeln!(out).unwrap();
        writeln!(out, "    // Screen timeout").unwrap();
        writeln!(out, "    if (MenuIsOpen) {{").unwrap();
        writeln!(out, "        block_all_inputs();").unwrap();
        writeln!(out, "        ScreenTimeout = 0;").unwrap();
        writeln!(out, "    }} else {{").unwrap();
        writeln!(out, "        ScreenTimeout++;").unwrap();
        writeln!(out, "    }}").unwrap();
        writeln!(out).unwrap();
        writeln!(out, "    if (ScreenTimeout > ScreenTimeoutLimit) {{").unwrap();
        writeln!(out, "        Clear();").unwrap();
        writeln!(out, "    }}").unwrap();
        writeln!(out, "}}").unwrap();

        out
    }

    fn write_core_main_menu(&self, out: &mut String, menu_modules: &[&AnalyzedModule]) {
        let main_pages = calculate_pages(menu_modules.len());

        writeln!(out, "function _CoreMainMenu() {{").unwrap();
        writeln!(out, "    Clear();").unwrap();
        writeln!(out, "    draw_scroll_dynamic(Menu_Page, {});", main_pages).unwrap();
        writeln!(out, "    XSelect(rect_y);").unwrap();
        writeln!(out).unwrap();
        writeln!(out, "    // Navigation").unwrap();
        writeln!(out, "    if (event_press(UP_BTN)) {{ rect_y -= 16; }}").unwrap();
        writeln!(out, "    if (event_press(DOWN_BTN)) {{ rect_y += 16; }}").unwrap();
        writeln!(out).unwrap();

        if main_pages > 1 {
            writeln!(out, "    // Pagination").unwrap();
            for page in 0..main_pages {
                let start = page * ITEMS_PER_PAGE;
                let end = (start + ITEMS_PER_PAGE).min(menu_modules.len());
                let items_on_page = end - start;
                let max_rect_y = RECT_Y_POSITIONS[items_on_page - 1];
                let prev_page = if page == 0 { main_pages - 1 } else { page - 1 };
                let next_page = (page + 1) % main_pages;

                let prev_start = prev_page * ITEMS_PER_PAGE;
                let prev_end = (prev_start + ITEMS_PER_PAGE).min(menu_modules.len());
                let prev_items = prev_end - prev_start;
                let prev_max_rect_y = RECT_Y_POSITIONS[prev_items - 1];

                writeln!(out, "    if (Menu_Page == {}) {{", page).unwrap();
                writeln!(out, "        if (rect_y < 12) {{ Menu_Page = {}; rect_y = {}; }}", prev_page, prev_max_rect_y).unwrap();
                writeln!(out, "        else if (rect_y > {}) {{ Menu_Page = {}; rect_y = 12; }}", max_rect_y, next_page).unwrap();
                writeln!(out, "    }}").unwrap();
            }
        } else {
            let items_on_page = menu_modules.len().min(ITEMS_PER_PAGE);
            if items_on_page > 0 {
                let max_rect_y = RECT_Y_POSITIONS[items_on_page - 1];
                writeln!(out, "    // Bounds").unwrap();
                writeln!(out, "    if (rect_y < 12) {{ rect_y = 12; }}").unwrap();
                writeln!(out, "    if (rect_y > {}) {{ rect_y = {}; }}", max_rect_y, max_rect_y).unwrap();
            }
        }

        writeln!(out).unwrap();
        writeln!(out, "    // Exit").unwrap();
        writeln!(out, "    if (event_press(CANCEL_BTN)) {{").unwrap();
        writeln!(out, "        Menu = 0;").unwrap();
        writeln!(out, "        _CoreSave();").unwrap();
        writeln!(out, "        MenuIsOpen = FALSE;").unwrap();
        writeln!(out, "        ScreenTimeout = 0;").unwrap();
        writeln!(out, "    }}").unwrap();
        writeln!(out, "}}").unwrap();
        writeln!(out).unwrap();
    }

    fn write_core_main_menu_interaction(&self, out: &mut String, menu_modules: &[&AnalyzedModule]) {
        let main_pages = calculate_pages(menu_modules.len());

        writeln!(out, "function _CoreMainMenuInteraction() {{").unwrap();
        writeln!(out, "    // Draw items and handle interaction").unwrap();

        for page in 0..main_pages {
            let start = page * ITEMS_PER_PAGE;
            let end = (start + ITEMS_PER_PAGE).min(menu_modules.len());

            let indent = if main_pages > 1 {
                writeln!(out, "    if (Menu_Page == {}) {{", page).unwrap();
                "        "
            } else {
                "    "
            };

            for i in start..end {
                let module = menu_modules[i];
                let name = &module.sanitized_name;
                let item = &module.item;
                let pos = i % ITEMS_PER_PAGE;
                let text_y = TEXT_Y_POSITIONS[pos];
                let rect_y_pos = RECT_Y_POSITIONS[pos];

                writeln!(out, "{}// {}", indent, item.name).unwrap();
                writeln!(out, "{}{}_Display({}, {});", indent, name, TEXT_X_LABEL, text_y).unwrap();
                writeln!(out, "{}if (rect_y == {}) {{", indent, rect_y_pos).unwrap();

                if let Some(mid) = module.menu_id {
                    writeln!(out, "{}    if (event_press(CONFIRM_BTN)) {{", indent).unwrap();
                    writeln!(out, "{}        Menu = {};", indent, mid).unwrap();
                    writeln!(out, "{}        rect_y = 12;", indent).unwrap();
                    writeln!(out, "{}    }}", indent).unwrap();
                }

                let editable = matches!(item.r#type.as_str(), "value" | "toggle" | "selector" | "dependent_selector")
                    || (item.r#type == "custom" && item.edit_function.is_some());
                if editable {
                    writeln!(out, "{}    {}_Edit();", indent, name).unwrap();
                } else if item.r#type == "clickable" && item.status_var.is_some() {
                    let sv = item.status_var.as_ref().unwrap();
                    let var_access = self.var_access(sv, item.profile_aware.unwrap_or(false));
                    writeln!(out, "{}    if (event_press(RIGHT_BTN) || event_press(LEFT_BTN)) {{", indent).unwrap();
                    writeln!(out, "{}        {} = !{};", indent, var_access, var_access).unwrap();
                    writeln!(out, "{}        DrewStates = FALSE;", indent).unwrap();
                    writeln!(out, "{}    }}", indent).unwrap();
                }

                writeln!(out, "{}}}", indent).unwrap();
                writeln!(out).unwrap();
            }

            if main_pages > 1 {
                writeln!(out, "    }}").unwrap();
            }
        }

        writeln!(out, "}}").unwrap();
        writeln!(out).unwrap();
    }

    fn write_core_state_screen(&self, out: &mut String) {
        writeln!(out, "function _CoreStateScreen() {{").unwrap();
        writeln!(out, "    if (!DrewStates) {{").unwrap();
        writeln!(out, "        Clear();").unwrap();
        writeln!(out, "        if (ScreenTimeout <= ScreenTimeoutLimit) {{").unwrap();
        writeln!(out, "            print(10, 0, OLED_FONT_SMALL, OLED_WHITE, StateTitle[0]);").unwrap();

        if self.profile_count > 0 {
            if self.config.state_screen.profile_labels.is_some() {
                writeln!(out, "            print(80, 0, OLED_FONT_SMALL, OLED_WHITE, ProfileLabels[Profile]);").unwrap();
            } else {
                writeln!(out, "            PrintNumber(Profile, find_digits(Profile), 72, 0, OLED_FONT_SMALL);").unwrap();
            }
        }

        // State display grid
        self.write_state_display(out);

        writeln!(out, "        }}").unwrap();
        writeln!(out, "        MenuIsOpen = FALSE;").unwrap();
        writeln!(out, "        DrewStates = TRUE;").unwrap();
        writeln!(out, "    }}").unwrap();
        writeln!(out, "}}").unwrap();
        writeln!(out).unwrap();
    }

    fn write_state_display(&self, out: &mut String) {
        let col_x = [0, 42, 84];
        let toggle_offset = 26;

        let mut weapon_module = None;
        let mut state_func_modules = Vec::new();
        let mut other_modules = Vec::new();

        for module in &self.analyzed {
            let item = &module.item;
            if item.state_function.is_some() {
                state_func_modules.push(module);
            } else if item.state_display.is_some() {
                let meta = self.find_module_metadata(&item.name, item.module.as_deref());
                let is_weapon = meta.map(|m| m.id == "adp" || m.id == "weapondata").unwrap_or(false);
                if is_weapon {
                    weapon_module = Some(module);
                } else {
                    other_modules.push(module);
                }
            }
        }

        let mut state_row_y = 12i32;

        if !state_func_modules.is_empty() {
            writeln!(out).unwrap();
            writeln!(out, "            // Custom state rows").unwrap();
            for module in &state_func_modules {
                let func = module.item.state_function.as_ref().unwrap();
                writeln!(out, "            {}({});", func, state_row_y).unwrap();
                state_row_y += 12;
            }
        }

        if let Some(wm) = weapon_module {
            let has_adp = self.has_module("adp");
            let weapon_y = state_row_y;
            state_row_y += 12;

            writeln!(out).unwrap();
            writeln!(out, "            // Weapon display (full line)").unwrap();
            if has_adp {
                writeln!(out, "            if (CurrentWeapon == 0) {{").unwrap();
                writeln!(out, "                if (ADP_DetectedWeapon == 0) {{").unwrap();
                writeln!(out, "                    print(10, {}, OLED_FONT_SMALL, OLED_WHITE, WaitingText[0]);", weapon_y).unwrap();
                writeln!(out, "                }} else {{").unwrap();
                writeln!(out, "                    print(10, {}, OLED_FONT_SMALL, OLED_WHITE, Weapons[ADP_DetectedWeapon]);", weapon_y).unwrap();
                writeln!(out, "                }}").unwrap();
                writeln!(out, "            }} else {{").unwrap();
                writeln!(out, "                print(10, {}, OLED_FONT_SMALL, OLED_WHITE, Weapons[CurrentWeapon]);", weapon_y).unwrap();
                writeln!(out, "            }}").unwrap();
            } else {
                writeln!(out, "            print(10, {}, OLED_FONT_SMALL, OLED_WHITE, Weapons[CurrentWeapon]);", weapon_y).unwrap();
            }
            let _ = wm; // suppress unused warning
        }

        let row_y = [state_row_y, state_row_y + 12, state_row_y + 24];

        if !other_modules.is_empty() {
            writeln!(out).unwrap();
            writeln!(out, "            // Module states (3-col grid)").unwrap();
            let mut slot = 0usize;
            for module in &other_modules {
                if slot >= 3 * row_y.len() {
                    break;
                }
                let item = &module.item;
                let mname = &module.sanitized_name;

                let status_var = if item.r#type == "clickable" {
                    item.options.as_ref().and_then(|opts| {
                        opts.iter()
                            .find(|o| o.name.to_lowercase().contains("status"))
                            .map(|o| o.var.as_str())
                    })
                } else {
                    None
                };

                let col = slot % 3;
                let row = slot / 3;
                if row >= row_y.len() {
                    break;
                }
                let label_x = col_x[col];
                let y = row_y[row];

                match item.r#type.as_str() {
                    "selector" => {
                        let var = get_var_name(item);
                        writeln!(out, "            print({}, {}, OLED_FONT_SMALL, OLED_WHITE, {}_Items[{}]);", label_x, y, mname, var).unwrap();
                        slot += 1;
                    }
                    "dependent_selector" => {
                        let var = get_var_name(item);
                        let parent = item.depends_on.as_deref().unwrap_or("Profile");
                        let var_access = self.var_access(&var, item.profile_aware.unwrap_or(false));
                        writeln!(out, "            print({}, {}, OLED_FONT_SMALL, OLED_WHITE, {}_Items[{}_Offsets[{}] + {}]);", label_x, y, mname, mname, parent, var_access).unwrap();
                        slot += 1;
                    }
                    _ if status_var.is_some() => {
                        let sv = status_var.unwrap();
                        let toggle_x = label_x + toggle_offset;
                        let profile_aware = item
                            .options
                            .as_ref()
                            .and_then(|opts| opts.iter().find(|o| o.var == sv))
                            .and_then(|o| o.profile_aware)
                            .unwrap_or(false);
                        let var_access = self.var_access(sv, profile_aware);
                        writeln!(out, "            print({}, {}, OLED_FONT_SMALL, OLED_WHITE, {}_StateLabel[0]);", label_x, y, mname).unwrap();
                        writeln!(out, "            drawing_toggle({}, {}, {});", toggle_x, y, var_access).unwrap();
                        slot += 1;
                    }
                    _ => {}
                }
            }
        }
    }

    fn generate_main(&self) -> String {
        let mut out = String::with_capacity(2048);
        let game_name = resolve_config_template(&self.config.filename, &self.config);

        let mut data_includes = Vec::new();
        let mut post_includes = Vec::new();
        let mut seen = HashSet::new();

        if let Some(ref ci) = self.config.custom_includes {
            if let Some(ref data) = ci.data {
                for file in data {
                    if seen.insert(file.clone()) {
                        data_includes.push(file.clone());
                    }
                }
            }
            if let Some(ref menu) = ci.menu {
                for file in menu {
                    if seen.insert(file.clone()) {
                        post_includes.push(file.clone());
                    }
                }
            }
        }

        if self.has_module("antirecoil_timeline") && seen.insert("recoiltable.gpc".to_string()) {
            data_includes.push("recoiltable.gpc".to_string());
        }

        writeln!(out, "// {} - Main Entry Point (Modular Architecture)", game_name).unwrap();
        writeln!(out, "// Generated by generate.py - Edit freely to add custom code").unwrap();
        writeln!(out, "// Uses modular architecture with self-contained modules").unwrap();
        writeln!(out).unwrap();
        writeln!(out, "// ===== COMMON UTILITIES =====").unwrap();
        writeln!(out, "import common/helper;").unwrap();
        writeln!(out, "import common/text;").unwrap();
        writeln!(out, "import common/scroll;").unwrap();
        writeln!(out, "import common/bitpack;").unwrap();
        writeln!(out, "import common/oled;").unwrap();
        writeln!(out, "import common/control;").unwrap();

        // FGS games need fighting game common utilities
        if self.config.r#type.as_deref() == Some("fgs") {
            writeln!(out, "import common/fgc;").unwrap();
        }

        writeln!(out).unwrap();
        writeln!(out, "// ===== DRAWING UTILITIES =====").unwrap();
        writeln!(out, "import drawings/scroll_outer;").unwrap();
        writeln!(out, "import drawings/scroll_current;").unwrap();
        writeln!(out, "import drawings/selector;").unwrap();
        writeln!(out, "import drawings/toggle;").unwrap();
        writeln!(out).unwrap();

        if !data_includes.is_empty() {
            writeln!(out, "// ===== GAME DATA =====").unwrap();
            for file in &data_includes {
                writeln!(out, "import {};", strip_gpc_ext(file)).unwrap();
            }
            writeln!(out).unwrap();
        }

        writeln!(out, "// ===== CORE FRAMEWORK =====").unwrap();
        writeln!(out, "import modules/core;").unwrap();
        writeln!(out).unwrap();
        writeln!(out, "// ===== MODULES =====").unwrap();
        for module in &self.analyzed {
            writeln!(out, "import modules/{};", module.file_id).unwrap();
        }

        if !post_includes.is_empty() {
            writeln!(out).unwrap();
            writeln!(out, "// ===== CUSTOM MANUAL INTEGRATION FILES =====").unwrap();
            for file in &post_includes {
                writeln!(out, "import {};", strip_gpc_ext(file)).unwrap();
            }
        }

        writeln!(out).unwrap();
        writeln!(out, "// ===== GAME-SPECIFIC CODE =====").unwrap();
        writeln!(out, "// Add any game-specific combos, functions, or additional logic here").unwrap();
        writeln!(out, "// Custom init {{}} and main {{}} blocks will be merged with generated ones").unwrap();

        out
    }

    fn generate_recoiltable(&self) -> String {
        let weapon_count = self.get_weapon_count(false);
        let mut out = String::with_capacity(4096);

        writeln!(out, "// ===================== RECOIL TABLE =====================").unwrap();
        writeln!(out, "// Per-weapon recoil curves with 10 time phases").unwrap();
        writeln!(out, "define RECOIL_PHASES = 10;").unwrap();
        writeln!(out, "define RECOIL_PHASE_0_END = 8;").unwrap();
        writeln!(out, "define RECOIL_PHASE_1_END = 16;").unwrap();
        writeln!(out, "define RECOIL_PHASE_2_END = 28;").unwrap();
        writeln!(out, "define RECOIL_PHASE_3_END = 42;").unwrap();
        writeln!(out, "define RECOIL_PHASE_4_END = 60;").unwrap();
        writeln!(out, "define RECOIL_PHASE_5_END = 80;").unwrap();
        writeln!(out, "define RECOIL_PHASE_6_END = 105;").unwrap();
        writeln!(out, "define RECOIL_PHASE_7_END = 135;").unwrap();
        writeln!(out, "define RECOIL_PHASE_8_END = 175;").unwrap();
        writeln!(out).unwrap();
        writeln!(out, "const int8 WeaponRecoilTable[][] = {{").unwrap();
        writeln!(out, "//  V0  H0  V1  H1  V2  H2  V3  H3  V4  H4  V5  H5  V6  H6  V7  H7  V8  H8  V9  H9").unwrap();

        let zeroes = "0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0";
        for i in 0..weapon_count {
            let name = self.weapons_list.get(i).map(|s| s.as_str()).unwrap_or("Weapon");
            let display_name = &format!("{:<14}", &name[..name.len().min(14)]);
            let comma = if i < weapon_count - 1 { "," } else { " " };
            writeln!(out, "    {{{}}}{} /* {:3}  {} */", zeroes, comma, i, display_name).unwrap();
        }

        writeln!(out, "}};").unwrap();

        out
    }

    // Helper methods

    fn var_access(&self, var: &str, profile_aware: bool) -> String {
        if profile_aware && self.profile_count > 0 {
            format!("{}[Profile]", var)
        } else {
            var.to_string()
        }
    }

    fn opt_var_access(&self, opt: &MenuOption) -> String {
        let profile_aware = opt.profile_aware.unwrap_or(false);
        self.var_access(&opt.var, profile_aware)
    }

    fn write_extra_vars(&self, out: &mut String) {
        if let Some(ref extra_vars) = self.config.extra_vars {
            let mut lines = Vec::new();
            for (var_name, var_type) in extra_vars {
                if !self.global_declared_vars.contains(var_name) {
                    if var_type.to_lowercase().contains("[profile]") {
                        let base_type = var_type.split('[').next().unwrap_or("int").trim();
                        if self.profile_count > 0 {
                            lines.push(format!("{} {}[{}];", base_type, var_name, self.profile_count));
                        } else {
                            lines.push(format!("{} {};", base_type, var_name));
                        }
                    } else if var_type.contains('[') {
                        let parts: Vec<&str> = var_type.splitn(2, '[').collect();
                        let base_type = parts[0].trim();
                        lines.push(format!("{} {}[{}", base_type, var_name, parts[1]));
                    } else {
                        lines.push(format!("{} {};", var_type, var_name));
                    }
                }
            }
            if !lines.is_empty() {
                writeln!(out, "// Extra variables (from config.toml)").unwrap();
                for line in lines {
                    writeln!(out, "{}", line).unwrap();
                }
                writeln!(out).unwrap();
            }
        }
    }

    fn write_button_defines(&self, out: &mut String) {
        let ct = self.config.console_type.as_deref().unwrap_or("ps5");
        let cd = crate::pipeline::config_gen::default_buttons(ct);

        writeln!(out, "// Button definitions").unwrap();
        let defaults = [
            ("fire", cd.fire), ("ads", cd.ads),
            ("menu_mod", cd.menu_mod), ("menu_btn", cd.menu_btn),
            ("confirm", cd.confirm), ("cancel", cd.cancel),
            ("up", cd.up), ("down", cd.down),
            ("left", cd.left), ("right", cd.right),
        ];
        let buttons = &self.config.buttons;
        for (key, default) in defaults {
            let value = match key {
                "fire" => buttons.fire.as_deref().unwrap_or(default),
                "ads" => buttons.ads.as_deref().unwrap_or(default),
                "menu_mod" => &buttons.menu_mod,
                "menu_btn" => &buttons.menu_btn,
                "confirm" => &buttons.confirm,
                "cancel" => &buttons.cancel,
                "up" => &buttons.up,
                "down" => &buttons.down,
                "left" => &buttons.left,
                "right" => &buttons.right,
                _ => default,
            };
            writeln!(out, "define {}_BTN = {};", key.to_uppercase(), value).unwrap();
        }
        writeln!(out, "define RX_AXIS = {};", cd.rx).unwrap();
        writeln!(out, "define RY_AXIS = {};", cd.ry).unwrap();
        writeln!(out, "define LX_AXIS = {};", cd.lx).unwrap();
        writeln!(out, "define LY_AXIS = {};", cd.ly).unwrap();
        writeln!(out).unwrap();
    }

    fn write_module_param_defines(&self, out: &mut String) {
        if !self.module_params.is_empty() {
            writeln!(out, "// Module param definitions").unwrap();
            for (module_id, params) in &self.module_params {
                for (key, value) in params {
                    writeln!(out, "define {}_{} = {};", module_id.to_uppercase(), key.to_uppercase(), value).unwrap();
                }
            }
            writeln!(out).unwrap();
        }

        // Default defines for params not in config
        let mut defaults_emitted = false;
        for module in &self.analyzed {
            let meta = self.find_module_metadata(&module.item.name, module.item.module.as_deref());
            if let Some(meta) = meta {
                let mod_params = self.module_params.get(&meta.id);
                for param in &meta.params {
                    let already_set = mod_params.map(|p| p.contains_key(&param.key)).unwrap_or(false);
                    if !already_set {
                        if let Some(ref default) = param.default {
                            writeln!(out, "define {}_{} = {};  // default", meta.id.to_uppercase(), param.key.to_uppercase(), default).unwrap();
                            defaults_emitted = true;
                        }
                    }
                }
            }
        }
        if defaults_emitted {
            writeln!(out).unwrap();
        }
    }

    fn write_weapon_data(&self, out: &mut String, for_adp: bool) {
        let weapon_count = self.get_weapon_count(for_adp);

        writeln!(out, "// Weapon data arrays (dynamically generated)").unwrap();
        if for_adp {
            writeln!(out, "define WEAPON_COUNT = {};  // +1 for Auto/Waiting", weapon_count + 1).unwrap();
            writeln!(out, "define WEAPON_MAX_INDEX = {};", weapon_count).unwrap();
        } else {
            writeln!(out, "define WEAPON_COUNT = {};", weapon_count).unwrap();
            writeln!(out, "define WEAPON_MAX_INDEX = {};", weapon_count - 1).unwrap();
        }
        writeln!(out).unwrap();

        writeln!(out, "const string Weapons[] = {{").unwrap();
        if for_adp {
            writeln!(out, "    \"Waiting..\",  // 0: Auto mode (ADP detection)").unwrap();
            for i in 0..weapon_count {
                let fallback = format!("Weapon {}", i + 1);
                let name = self.weapons_list.get(i).map(|s| s.as_str()).unwrap_or(&fallback);
                let comma = if i < weapon_count - 1 { "," } else { "" };
                writeln!(out, "    \"{}\"{}  // {}", name, comma, i + 1).unwrap();
            }
        } else {
            for i in 0..weapon_count {
                let fallback = format!("Weapon {}", i + 1);
                let name = self.weapons_list.get(i).map(|s| s.as_str()).unwrap_or(&fallback);
                let comma = if i < weapon_count - 1 { "," } else { "" };
                writeln!(out, "    \"{}\"{}  // {}", name, comma, i).unwrap();
            }
        }
        writeln!(out, "}};").unwrap();
        writeln!(out).unwrap();
    }

    fn write_adp_data(&self, out: &mut String) {
        let weapon_count = self.get_weapon_count(true);

        writeln!(out, "// ADP trigger signature arrays (dynamically generated)").unwrap();
        writeln!(out, "// TODO: Fill in real adaptive trigger signatures from Zen Studio").unwrap();
        writeln!(out, "const uint8 ADP_Values[][] = {{").unwrap();
        writeln!(out, "    //  Mode  Start  F1    F2   StrL  StrM  StrH   0  0  Freq  0").unwrap();
        writeln!(out, "    {{ 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0, 0, 0x00, 0 }},  // 0: Automatic").unwrap();

        for i in 1..=weapon_count {
            let fallback = format!("Weapon {}", i);
            let name = self.weapons_list.get(i - 1).map(|s| s.as_str()).unwrap_or(&fallback);
            let comma = if i < weapon_count { "," } else { "" };
            writeln!(out, "    {{ 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0, 0, 0x00, 0 }}{}  // {}: {}", comma, i, name).unwrap();
        }

        writeln!(out, "}};").unwrap();
        writeln!(out).unwrap();
    }

    fn generate_adp_weapon_checks(&self, weapon_count: usize) -> String {
        let mut out = String::new();
        for i in 1..=weapon_count {
            let prefix = if i == 1 { "if" } else { "else if" };
            writeln!(out, "    {} (adt_cmp(PS5_R2, addr(ADP_Values[{}][0]))) {{ detected = {}; }}", prefix, i, i).unwrap();
        }
        out
    }

    fn make_profile_aware(&self, code: &str, module: &AnalyzedModule) -> String {
        let mut result = code.to_string();
        let item = &module.item;

        if item.r#type == "clickable" {
            if let Some(ref opts) = item.options {
                for opt in opts {
                    if opt.profile_aware.unwrap_or(false) {
                        result = regex_replace_var(&result, &opt.var, &format!("{}[Profile]", opt.var));
                    }
                }
            }
        }

        let meta = self.find_module_metadata(&item.name, item.module.as_deref());
        if let Some(meta) = meta {
            for (var_name, var_type) in &meta.extra_vars {
                if var_type.to_lowercase().contains("[profile]") {
                    result = regex_replace_var(&result, var_name, &format!("{}[Profile]", var_name));
                }
            }
        }

        result
    }
}

// Standalone helpers

fn sanitize_var_name(name: &str) -> String {
    name.replace(' ', "")
        .replace('-', "_")
        .replace('(', "")
        .replace(')', "")
        .replace('[', "")
        .replace(']', "")
        .replace('.', "")
}

fn get_var_name(item: &MenuItem) -> String {
    item.var
        .as_ref()
        .cloned()
        .unwrap_or_else(|| sanitize_var_name(&item.name))
}

fn calculate_bit_width(min: i32, max: i32) -> u32 {
    let range = (max - min + 1) as u32;
    let mut bits = 0u32;
    while (1u32 << bits) < range {
        bits += 1;
    }
    bits
}

fn calculate_pages(item_count: usize) -> usize {
    if item_count == 0 {
        1
    } else {
        (item_count + ITEMS_PER_PAGE - 1) / ITEMS_PER_PAGE
    }
}

fn remove_function(code: &str, func_name: &str) -> String {
    let pattern = format!("function {}", func_name);
    if let Some(start_pos) = code.find(&pattern) {
        // Find the opening brace
        if let Some(brace_pos) = code[start_pos..].find('{') {
            let abs_brace = start_pos + brace_pos;
            let mut depth = 1;
            let mut pos = abs_brace + 1;
            let bytes = code.as_bytes();
            while pos < bytes.len() && depth > 0 {
                if bytes[pos] == b'{' {
                    depth += 1;
                } else if bytes[pos] == b'}' {
                    depth -= 1;
                }
                pos += 1;
            }
            // Remove the function (and leading newlines)
            let mut actual_start = start_pos;
            while actual_start > 0 && code.as_bytes()[actual_start - 1] == b'\n' {
                actual_start -= 1;
            }
            let result = format!("{}{}", &code[..actual_start], &code[pos..]);
            // Clean up extra blank lines
            result
                .lines()
                .collect::<Vec<_>>()
                .join("\n")
        } else {
            code.to_string()
        }
    } else {
        code.to_string()
    }
}

fn regex_replace_var(code: &str, var_name: &str, replacement: &str) -> String {
    // Simple word-boundary replacement: replace `VarName` with `VarName[Profile]`
    // but not if already followed by `[`
    let mut result = String::with_capacity(code.len());
    let var_bytes = var_name.as_bytes();
    let code_bytes = code.as_bytes();
    let mut i = 0;

    while i < code_bytes.len() {
        if i + var_bytes.len() <= code_bytes.len()
            && &code_bytes[i..i + var_bytes.len()] == var_bytes
        {
            // Check word boundary before
            let before_ok = i == 0 || !code_bytes[i - 1].is_ascii_alphanumeric() && code_bytes[i - 1] != b'_';
            // Check word boundary after and not followed by [
            let after_pos = i + var_bytes.len();
            let after_ok = after_pos >= code_bytes.len()
                || (!code_bytes[after_pos].is_ascii_alphanumeric()
                    && code_bytes[after_pos] != b'_');
            let not_array = after_pos >= code_bytes.len() || code_bytes[after_pos] != b'[';

            if before_ok && after_ok && not_array {
                result.push_str(replacement);
                i += var_bytes.len();
                continue;
            }
        }
        result.push(code_bytes[i] as char);
        i += 1;
    }

    result
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::config::*;

    fn minimal_config() -> GameConfig {
        GameConfig {
            filename: "Mash-Test-v".to_string(),
            version: 1,
            name: Some("Test".to_string()),
            username: Some("Mash".to_string()),
            r#type: Some("fps".to_string()),
            console_type: None,
            profile_count: Some(0),
            weapons: None,
            state_screen: StateScreen {
                title: "Test v1".to_string(),
                profile_labels: None,
            },
            buttons: ButtonConfig {
                menu_mod: "PS5_L2".to_string(),
                menu_btn: "PS5_OPTIONS".to_string(),
                confirm: "PS5_CROSS".to_string(),
                cancel: "PS5_CIRCLE".to_string(),
                up: "PS5_UP".to_string(),
                down: "PS5_DOWN".to_string(),
                left: "PS5_LEFT".to_string(),
                right: "PS5_RIGHT".to_string(),
                fire: None,
                ads: None,
            },
            keyboard: std::collections::HashMap::new(),
            custom_includes: None,
            menu: vec![
                MenuItem {
                    name: "Rapid Fire".to_string(),
                    r#type: "clickable".to_string(),
                    var: None,
                    state_display: Some("RF".to_string()),
                    display_function: None,
                    edit_function: None,
                    render_function: None,
                    state_function: None,
                    status_var: Some("RapidFireStatus".to_string()),
                    module: None,
                    custom_trigger: None,
                    file_id: None,
                    display_type: None,
                    profile_aware: None,
                    depends_on: None,
                    value_x: None,
                    default: Some(serde_json::json!(0)),
                    min: None,
                    max: None,
                    option_labels: None,
                    resets: None,
                    items: None,
                    options: Some(vec![
                        MenuOption {
                            name: "Status".to_string(),
                            var: "RapidFireStatus".to_string(),
                            r#type: "toggle".to_string(),
                            default: Some(serde_json::json!(0)),
                            min: None,
                            max: None,
                            state_display: None,
                            profile_aware: None,
                            items: None,
                        },
                        MenuOption {
                            name: "Speed".to_string(),
                            var: "RapidFireSpeed".to_string(),
                            r#type: "value".to_string(),
                            default: Some(serde_json::json!(5)),
                            min: Some(1),
                            max: Some(10),
                            state_display: None,
                            profile_aware: None,
                            items: None,
                        },
                    ]),
                },
            ],
            extra_vars: None,
            extra_defines: None,
            module_params: None,
        }
    }

    #[test]
    fn test_generator_produces_files() {
        let config = minimal_config();
        let modules_metadata = HashMap::new();
        let mut gen = Generator::new(config, modules_metadata, 1);
        let result = gen.generate_all();

        // Should produce: modules/rapidfire.gpc, modules/core.gpc, main.gpc
        assert!(result.files.len() >= 3, "Expected at least 3 files, got {}", result.files.len());

        let filenames: Vec<&str> = result.files.iter().map(|(p, _)| p.as_str()).collect();
        assert!(filenames.contains(&"modules/core.gpc"), "Missing core.gpc");
        assert!(filenames.contains(&"main.gpc"), "Missing main.gpc");
        assert!(filenames.iter().any(|f| f.starts_with("modules/") && f != &"modules/core.gpc"),
            "Missing module .gpc file");
    }

    #[test]
    fn test_core_has_menu_framework() {
        let config = minimal_config();
        let mut gen = Generator::new(config, HashMap::new(), 1);
        let result = gen.generate_all();

        let core = result.files.iter().find(|(p, _)| p == "modules/core.gpc").unwrap();
        let content = &core.1;

        assert!(content.contains("function _CoreMainMenu()"), "Missing _CoreMainMenu");
        assert!(content.contains("function _CoreSave()"), "Missing _CoreSave");
        assert!(content.contains("function _CoreLoad()"), "Missing _CoreLoad");
        assert!(content.contains("function _CoreStateScreen()"), "Missing _CoreStateScreen");
        assert!(content.contains("init {"), "Missing init block");
        assert!(content.contains("main {"), "Missing main block");
    }

    #[test]
    fn test_module_has_persistence() {
        let config = minimal_config();
        let mut gen = Generator::new(config, HashMap::new(), 1);
        let result = gen.generate_all();

        let module_file = result.files.iter()
            .find(|(p, _)| p.starts_with("modules/") && p != "modules/core.gpc")
            .unwrap();
        let content = &module_file.1;

        assert!(content.contains("_Save"), "Missing Save function");
        assert!(content.contains("_Load"), "Missing Load function");
        assert!(content.contains("save_spvar"), "Missing save_spvar call");
        assert!(content.contains("read_spvar"), "Missing read_spvar call");
    }

    #[test]
    fn test_main_has_includes() {
        let config = minimal_config();
        let mut gen = Generator::new(config, HashMap::new(), 1);
        let result = gen.generate_all();

        let main = result.files.iter().find(|(p, _)| p == "main.gpc").unwrap();
        let content = &main.1;

        assert!(content.contains("import "), "Missing import directives");
        assert!(content.contains("import common/helper;"), "Missing common/helper import");
        assert!(content.contains("import modules/core;"), "Missing modules/core import");
    }

    #[test]
    fn test_sanitize_var_name() {
        assert_eq!(sanitize_var_name("Anti Recoil"), "AntiRecoil");
        assert_eq!(sanitize_var_name("Weapon (ADP)"), "WeaponADP");
        assert_eq!(sanitize_var_name("H. Breath"), "HBreath");
        assert_eq!(sanitize_var_name("simple"), "simple");
    }

    #[test]
    fn test_calculate_bit_width() {
        assert_eq!(calculate_bit_width(0, 1), 1);   // toggle: 2 values = 1 bit
        assert_eq!(calculate_bit_width(0, 10), 4);   // 0-10: 11 values = 4 bits
        assert_eq!(calculate_bit_width(1, 10), 4);   // 1-10: 10 values = 4 bits
        assert_eq!(calculate_bit_width(0, 255), 8);  // full byte
        assert_eq!(calculate_bit_width(100, 1000), 10); // 901 values
    }

    #[test]
    fn test_real_config_r6s() {
        // Parse the actual R6S config.toml
        let config_path = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("../../Games/Shooter/R6S/config.toml");

        if !config_path.exists() {
            eprintln!("Skipping R6S test - config not found at {:?}", config_path);
            return;
        }

        let config_str = std::fs::read_to_string(&config_path).unwrap();
        let config: GameConfig = toml::from_str(&config_str).unwrap();

        // Verify config parsed correctly
        assert_eq!(config.filename, "Mash-R6S-v");
        assert_eq!(config.version, 2);
        assert_eq!(config.profile_count, Some(2));
        assert_eq!(config.menu.len(), 8);

        // Generate
        let mut gen = Generator::new(config, HashMap::new(), 2); // depth=2 for Games/Shooter/R6S
        let result = gen.generate_all();

        let filenames: Vec<&str> = result.files.iter().map(|(p, _)| p.as_str()).collect();
        eprintln!("Generated files: {:?}", filenames);

        // Should have: core.gpc, main.gpc, + 8 module files
        assert!(filenames.contains(&"modules/core.gpc"));
        assert!(filenames.contains(&"main.gpc"));

        // Verify core.gpc has expected content
        let core = &result.files.iter().find(|(p, _)| p == "modules/core.gpc").unwrap().1;
        assert!(core.contains("MENU_ITEM_COUNT = 8"), "Expected 8 menu items");
        assert!(core.contains("MENU_PAGE_COUNT = 3"), "Expected 3 pages");
        assert!(core.contains("function _CoreSave()"));
        assert!(core.contains("function _CoreLoad()"));
        assert!(core.contains("function _CoreMainMenu()"));
        assert!(core.contains("function _CoreStateScreen()"));
        // Check profile labels
        assert!(core.contains("ProfileLabels"), "Expected profile labels");
        // Check button defines
        assert!(core.contains("define FIRE_BTN"), "Expected button defines");
        // Check keyboard defines
        assert!(core.contains("KB_QUICK_TOGGLE_AIMASSIST"), "Expected keyboard defines");

        // Verify main.gpc has import directives
        let main = &result.files.iter().find(|(p, _)| p == "main.gpc").unwrap().1;
        assert!(main.contains("import "));
        assert!(main.contains("import common/helper;"));
        assert!(main.contains("import common/bitpack;"));
        assert!(main.contains("import modules/core;"));

        // Verify module files have Save/Load
        for (path, content) in &result.files {
            if path.starts_with("modules/") && path != "modules/core.gpc" {
                assert!(content.contains("_Save"), "Module {} missing _Save", path);
                assert!(content.contains("_Load"), "Module {} missing _Load", path);
            }
        }
    }
}
