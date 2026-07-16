use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::fs;
use std::io::{self, Read};
use std::path::{Path, PathBuf};

mod atomic_file;
mod atomic_json;
mod pack_asset;

const INSTALLED_PACK_RECORDS_FILE: &str = "installed-pack-records.json";
const REQUIRED_PACK_FILES: [&str; 5] = [
    "pack.json",
    "catalog.json",
    "courses.json",
    "items.json",
    "sets.json",
];

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CourseFolderFileSnapshot {
    pub relative_path: String,
    pub bytes: Vec<u8>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CourseFolderPackCandidate {
    pub directory_name: String,
    pub files: Vec<CourseFolderFileSnapshot>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CourseFolderDiagnostic {
    pub code: String,
    pub message: String,
    pub path: String,
}

#[derive(Clone, Copy, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CourseFolderReadLimits {
    pub max_total_bytes: u64,
    pub max_file_count: usize,
    pub max_file_bytes: u64,
}

#[derive(Default)]
struct CourseFolderReadState {
    file_count: usize,
    total_bytes: u64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CourseFolderScan {
    pub source_name: String,
    pub scanned_directory_count: usize,
    pub candidates: Vec<CourseFolderPackCandidate>,
    pub diagnostics: Vec<CourseFolderDiagnostic>,
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            desktop_commands::read_course_folder_candidates,
            desktop_commands::load_selected_course_folder,
            desktop_commands::save_selected_course_folder,
            desktop_commands::read_installed_pack_records,
            desktop_commands::write_installed_pack_record,
            desktop_commands::write_pack_asset,
        ])
        .run(tauri::generate_context!())
        .expect("Concourse desktop shell failed to start");
}

fn scan_course_folder_command(
    selected_root: String,
    limits: CourseFolderReadLimits,
) -> Result<CourseFolderScan, CourseFolderDiagnostic> {
    scan_course_folder(Path::new(&selected_root), limits)
}

pub mod desktop_commands {
    use super::{
        app_configuration_directory, load_selected_course_folder_from_directory,
        read_installed_pack_records_from_directory, save_selected_course_folder_in_directory,
        scan_course_folder_command, write_installed_pack_record_in_directory,
        CourseFolderDiagnostic, CourseFolderReadLimits, CourseFolderScan, Path,
    };
    use serde_json::Value;
    use tauri::{AppHandle, Wry};

    #[tauri::command]
    pub fn read_course_folder_candidates(
        selected_root: String,
        limits: CourseFolderReadLimits,
    ) -> Result<CourseFolderScan, CourseFolderDiagnostic> {
        scan_course_folder_command(selected_root, limits)
    }

    #[tauri::command]
    pub fn load_selected_course_folder(
        app: AppHandle<Wry>,
    ) -> Result<Option<String>, CourseFolderDiagnostic> {
        load_selected_course_folder_from_directory(&app_configuration_directory(&app)?)
    }

    #[tauri::command]
    pub fn save_selected_course_folder(
        app: AppHandle<Wry>,
        selected_root: String,
    ) -> Result<(), CourseFolderDiagnostic> {
        save_selected_course_folder_in_directory(
            &app_configuration_directory(&app)?,
            &selected_root,
        )
    }

    #[tauri::command]
    pub fn read_installed_pack_records(
        app: AppHandle<Wry>,
    ) -> Result<Value, CourseFolderDiagnostic> {
        read_installed_pack_records_from_directory(&app_configuration_directory(&app)?)
    }

    #[tauri::command]
    pub fn write_installed_pack_record(
        app: AppHandle<Wry>,
        record: Value,
    ) -> Result<(), CourseFolderDiagnostic> {
        write_installed_pack_record_in_directory(&app_configuration_directory(&app)?, record)
    }

    #[tauri::command]
    pub fn write_pack_asset(destination_path: String, bytes: Vec<u8>) -> Result<(), String> {
        super::pack_asset::write_validated_pack_asset(Path::new(&destination_path), &bytes)
            .map_err(|error| error.to_string())
    }
}

fn scan_course_folder(
    selected_root: &Path,
    limits: CourseFolderReadLimits,
) -> Result<CourseFolderScan, CourseFolderDiagnostic> {
    validate_read_limits(limits, selected_root)?;
    let root = canonicalize_directory(selected_root)?;
    let source_name = directory_name(&root);

    if is_pack_directory(&root) {
        let candidate = scan_candidate_path(&root, &root, limits)?;
        let diagnostics = partial_candidate_diagnostics(&candidate);
        return Ok(CourseFolderScan {
            source_name,
            scanned_directory_count: 1,
            candidates: vec![candidate],
            diagnostics,
        });
    }

    let child_directories = immediate_child_directories(&root)?;
    let mut candidates = Vec::new();
    let mut diagnostics = Vec::new();

    for child in &child_directories {
        if !is_pack_directory(child) {
            continue;
        }

        match scan_candidate_path(&root, child, limits) {
            Ok(candidate) => {
                diagnostics.extend(partial_candidate_diagnostics(&candidate));
                candidates.push(candidate);
            }
            Err(diagnostic) => diagnostics.push(diagnostic),
        }
    }

    Ok(CourseFolderScan {
        source_name,
        scanned_directory_count: child_directories.len(),
        candidates,
        diagnostics,
    })
}

fn scan_candidate_path(
    selected_root: &Path,
    requested_candidate: &Path,
    limits: CourseFolderReadLimits,
) -> Result<CourseFolderPackCandidate, CourseFolderDiagnostic> {
    let mut read_file = |path: &Path, size: u64| read_file_bounded(path, size);
    scan_candidate_path_with_reader(selected_root, requested_candidate, limits, &mut read_file)
}

fn scan_candidate_path_with_reader<F>(
    selected_root: &Path,
    requested_candidate: &Path,
    limits: CourseFolderReadLimits,
    read_file: &mut F,
) -> Result<CourseFolderPackCandidate, CourseFolderDiagnostic>
where
    F: FnMut(&Path, u64) -> io::Result<Vec<u8>>,
{
    let root = canonicalize_directory(selected_root)?;
    let candidate = canonicalize_directory(requested_candidate)?;

    if !candidate.starts_with(&root) {
        return Err(diagnostic(
            "path-outside-selected-root",
            format!(
                "Candidate {} resolves outside selected root {}.",
                requested_candidate.display(),
                root.display()
            ),
            requested_candidate.display().to_string(),
        ));
    }

    let mut files = Vec::new();
    let mut state = CourseFolderReadState::default();
    read_candidate_files(
        &root, &candidate, &candidate, &mut files, &mut state, limits, read_file,
    )?;
    files.sort_by(|left, right| left.relative_path.cmp(&right.relative_path));

    Ok(CourseFolderPackCandidate {
        directory_name: directory_name(&candidate),
        files,
    })
}

fn canonicalize_directory(path: &Path) -> Result<PathBuf, CourseFolderDiagnostic> {
    let canonical_path = fs::canonicalize(path).map_err(|error| {
        diagnostic(
            "read-failed",
            format!("Could not read {}: {error}", path.display()),
            path.display().to_string(),
        )
    })?;

    if !canonical_path.is_dir() {
        return Err(diagnostic(
            "read-failed",
            format!("{} is not a directory.", path.display()),
            path.display().to_string(),
        ));
    }

    Ok(canonical_path)
}

fn immediate_child_directories(root: &Path) -> Result<Vec<PathBuf>, CourseFolderDiagnostic> {
    let entries = fs::read_dir(root).map_err(|error| {
        diagnostic(
            "read-failed",
            format!("Could not list {}: {error}", root.display()),
            root.display().to_string(),
        )
    })?;
    let mut directories = Vec::new();

    for entry in entries {
        let entry = entry.map_err(|error| {
            diagnostic(
                "read-failed",
                format!("Could not enumerate {}: {error}", root.display()),
                root.display().to_string(),
            )
        })?;
        let path = entry.path();
        if path.is_dir() {
            directories.push(path);
        }
    }

    directories.sort();
    Ok(directories)
}

fn is_pack_directory(path: &Path) -> bool {
    path.join("pack.json").is_file()
}

fn read_candidate_files(
    selected_root: &Path,
    candidate_root: &Path,
    current_directory: &Path,
    files: &mut Vec<CourseFolderFileSnapshot>,
    state: &mut CourseFolderReadState,
    limits: CourseFolderReadLimits,
    read_file: &mut impl FnMut(&Path, u64) -> io::Result<Vec<u8>>,
) -> Result<(), CourseFolderDiagnostic> {
    let entries = fs::read_dir(current_directory).map_err(|error| {
        diagnostic(
            "read-failed",
            format!("Could not list {}: {error}", current_directory.display()),
            current_directory.display().to_string(),
        )
    })?;

    for entry in entries {
        let entry = entry.map_err(|error| {
            diagnostic(
                "read-failed",
                format!(
                    "Could not enumerate {}: {error}",
                    current_directory.display()
                ),
                current_directory.display().to_string(),
            )
        })?;
        let path = entry.path();
        let canonical_path = fs::canonicalize(&path).map_err(|error| {
            diagnostic(
                "read-failed",
                format!("Could not resolve {}: {error}", path.display()),
                path.display().to_string(),
            )
        })?;

        if !canonical_path.starts_with(selected_root) || !canonical_path.starts_with(candidate_root)
        {
            return Err(diagnostic(
                "path-outside-selected-root",
                format!(
                    "Entry {} resolves outside selected root {}.",
                    path.display(),
                    selected_root.display()
                ),
                path.display().to_string(),
            ));
        }

        if canonical_path.is_dir() {
            read_candidate_files(
                selected_root,
                candidate_root,
                &canonical_path,
                files,
                state,
                limits,
                read_file,
            )?;
            continue;
        }

        if canonical_path.is_file() {
            let metadata = fs::metadata(&canonical_path).map_err(|error| {
                diagnostic(
                    "read-failed",
                    format!("Could not inspect {}: {error}", canonical_path.display()),
                    canonical_path.display().to_string(),
                )
            })?;
            state.file_count = state.file_count.checked_add(1).ok_or_else(|| {
                resource_limit_diagnostic(
                    "File count overflowed while scanning the learning pack.",
                    &canonical_path,
                )
            })?;
            if state.file_count > limits.max_file_count {
                return Err(resource_limit_diagnostic(
                    format!(
                        "File count {} exceeds limit {}.",
                        state.file_count, limits.max_file_count
                    ),
                    &canonical_path,
                ));
            }
            let size = metadata.len();
            if size > limits.max_file_bytes {
                return Err(resource_limit_diagnostic(
                    format!(
                        "File size {size} exceeds per-file limit {}.",
                        limits.max_file_bytes
                    ),
                    &canonical_path,
                ));
            }
            let projected_total = state.total_bytes.checked_add(size).ok_or_else(|| {
                resource_limit_diagnostic(
                    "Total file bytes overflowed while scanning the learning pack.",
                    &canonical_path,
                )
            })?;
            if projected_total > limits.max_total_bytes {
                return Err(resource_limit_diagnostic(
                    format!(
                        "Total file bytes {projected_total} exceed limit {}.",
                        limits.max_total_bytes
                    ),
                    &canonical_path,
                ));
            }
            state.total_bytes = projected_total;
            let bytes = read_file(&canonical_path, size).map_err(|error| {
                diagnostic(
                    "read-failed",
                    format!("Could not read {}: {error}", canonical_path.display()),
                    canonical_path.display().to_string(),
                )
            })?;
            if u64::try_from(bytes.len()).ok() != Some(size) {
                return Err(diagnostic(
                    "read-failed",
                    format!(
                        "File size changed while reading {}: expected {size}, read {}.",
                        canonical_path.display(),
                        bytes.len()
                    ),
                    canonical_path.display().to_string(),
                ));
            }
            let relative_path = canonical_path.strip_prefix(candidate_root).map_err(|_| {
                diagnostic(
                    "path-outside-selected-root",
                    format!(
                        "Entry {} resolves outside candidate {}.",
                        canonical_path.display(),
                        candidate_root.display()
                    ),
                    canonical_path.display().to_string(),
                )
            })?;
            files.push(CourseFolderFileSnapshot {
                relative_path: relative_path_to_slash_path(relative_path),
                bytes,
            });
        }
    }

    Ok(())
}

fn validate_read_limits(
    limits: CourseFolderReadLimits,
    path: &Path,
) -> Result<(), CourseFolderDiagnostic> {
    if limits.max_total_bytes == 0 || limits.max_file_count == 0 || limits.max_file_bytes == 0 {
        return Err(diagnostic(
            "resource-limit-invalid",
            "Course-folder read limits must all be greater than zero.",
            path.display().to_string(),
        ));
    }
    usize::try_from(limits.max_file_bytes).map_err(|_| {
        diagnostic(
            "resource-limit-invalid",
            "The per-file read limit does not fit this platform.",
            path.display().to_string(),
        )
    })?;
    Ok(())
}

fn read_file_bounded(path: &Path, expected_size: u64) -> io::Result<Vec<u8>> {
    let capacity = usize::try_from(expected_size)
        .map_err(|_| io::Error::other("file size does not fit this platform"))?;
    let file = fs::File::open(path)?;
    let mut bytes = Vec::with_capacity(capacity.saturating_add(1));
    file.take(expected_size.saturating_add(1))
        .read_to_end(&mut bytes)?;
    Ok(bytes)
}

fn resource_limit_diagnostic(message: impl Into<String>, path: &Path) -> CourseFolderDiagnostic {
    diagnostic(
        "resource-limit-exceeded",
        message,
        path.display().to_string(),
    )
}

fn partial_candidate_diagnostics(
    candidate: &CourseFolderPackCandidate,
) -> Vec<CourseFolderDiagnostic> {
    let missing_files = REQUIRED_PACK_FILES
        .iter()
        .filter(|required_path| {
            !candidate
                .files
                .iter()
                .any(|file| file.relative_path == **required_path)
        })
        .copied()
        .collect::<Vec<_>>();

    if missing_files.is_empty() {
        return Vec::new();
    }

    vec![diagnostic(
        "partial-candidate",
        format!(
            "{} is missing required pack files: {}.",
            candidate.directory_name,
            missing_files.join(", ")
        ),
        candidate.directory_name.clone(),
    )]
}

fn directory_name(path: &Path) -> String {
    path.file_name()
        .map(|name| name.to_string_lossy().into_owned())
        .unwrap_or_else(|| path.display().to_string())
}

fn relative_path_to_slash_path(path: &Path) -> String {
    path.components()
        .map(|component| component.as_os_str().to_string_lossy().into_owned())
        .collect::<Vec<_>>()
        .join("/")
}

fn diagnostic(
    code: impl Into<String>,
    message: impl Into<String>,
    path: impl Into<String>,
) -> CourseFolderDiagnostic {
    CourseFolderDiagnostic {
        code: code.into(),
        message: message.into(),
        path: path.into(),
    }
}

fn save_selected_course_folder_in_directory(
    configuration_directory: &Path,
    selected_root: &str,
) -> Result<(), CourseFolderDiagnostic> {
    if selected_root.is_empty() {
        return Err(storage_diagnostic(
            "storage-write-failed",
            "The selected course folder cannot be empty.",
            configuration_directory,
        ));
    }

    write_json_file(
        &configuration_directory.join("selected-course-folder.json"),
        &json!({ "selectedRoot": selected_root }),
    )
}

fn load_selected_course_folder_from_directory(
    configuration_directory: &Path,
) -> Result<Option<String>, CourseFolderDiagnostic> {
    let path = configuration_directory.join("selected-course-folder.json");
    if !path.exists() {
        return Ok(None);
    }

    let value = read_json_file(&path)?;
    let selected_root = value
        .get("selectedRoot")
        .and_then(Value::as_str)
        .filter(|value| !value.is_empty())
        .ok_or_else(|| {
            storage_diagnostic(
                "storage-read-failed",
                "The selected course folder configuration has an invalid shape.",
                &path,
            )
        })?;

    Ok(Some(selected_root.to_string()))
}

fn read_installed_pack_records_from_directory(
    configuration_directory: &Path,
) -> Result<Value, CourseFolderDiagnostic> {
    let path = configuration_directory.join(INSTALLED_PACK_RECORDS_FILE);
    if !path.exists() {
        return Ok(json!([]));
    }

    let records = read_json_file(&path)?;
    if !records.is_array() {
        return Err(storage_diagnostic(
            "storage-read-failed",
            "The installed-pack record collection must be a JSON array.",
            &path,
        ));
    }

    Ok(records)
}

fn write_installed_pack_record_in_directory(
    configuration_directory: &Path,
    record: Value,
) -> Result<(), CourseFolderDiagnostic> {
    let pack_id = record
        .get("packId")
        .and_then(Value::as_str)
        .filter(|value| !value.is_empty())
        .ok_or_else(|| {
            storage_diagnostic(
                "storage-write-failed",
                "An installed-pack record must contain a non-empty packId.",
                configuration_directory,
            )
        })?
        .to_string();
    let mut records = read_installed_pack_records_from_directory(configuration_directory)?;
    let values = records.as_array_mut().expect("validated JSON array");

    if let Some(index) = values.iter().position(|value| {
        value
            .get("packId")
            .and_then(Value::as_str)
            .is_some_and(|value| value == pack_id)
    }) {
        values[index] = record;
    } else {
        values.push(record);
    }

    write_json_file(
        &configuration_directory.join(INSTALLED_PACK_RECORDS_FILE),
        &records,
    )
}

fn read_json_file(path: &Path) -> Result<Value, CourseFolderDiagnostic> {
    let bytes = fs::read(path).map_err(|error| {
        storage_diagnostic(
            "storage-read-failed",
            format!("Could not read {}: {error}", path.display()),
            path,
        )
    })?;
    serde_json::from_slice(&bytes).map_err(|error| {
        storage_diagnostic(
            "storage-read-failed",
            format!("Could not parse {}: {error}", path.display()),
            path,
        )
    })
}

fn write_json_file(path: &Path, value: &Value) -> Result<(), CourseFolderDiagnostic> {
    atomic_json::write_json_file(path, value).map_err(|error| {
        storage_diagnostic(
            "storage-write-failed",
            format!("Could not durably replace {}: {error}", path.display()),
            path,
        )
    })
}

fn storage_diagnostic(
    code: impl Into<String>,
    message: impl Into<String>,
    path: &Path,
) -> CourseFolderDiagnostic {
    diagnostic(code, message, path.display().to_string())
}

fn app_configuration_directory(
    app: &tauri::AppHandle<tauri::Wry>,
) -> Result<PathBuf, CourseFolderDiagnostic> {
    use tauri::Manager;

    app.path().app_config_dir().map_err(|error| {
        diagnostic(
            "storage-path-unavailable",
            format!("Could not resolve the application configuration directory: {error}"),
            "app-config-directory",
        )
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    use std::time::{SystemTime, UNIX_EPOCH};

    #[test]
    fn scan_valid_child_directory_returns_all_files_in_sorted_order() {
        let root = temp_root("valid-child");
        let pack = root.join("logic");
        fs::create_dir_all(pack.join("assets")).expect("create pack directories");
        write_file(&pack, "pack.json", b"{}");
        write_file(&pack, "catalog.json", b"{}");
        write_file(&pack, "courses.json", b"{}");
        write_file(&pack, "items.json", b"{}");
        write_file(&pack, "sets.json", b"{}");
        write_file(&pack, "assets/example.txt", b"asset");

        let result = desktop_commands::read_course_folder_candidates(
            root.to_string_lossy().into_owned(),
            test_read_limits(),
        )
        .expect("scan course folder");

        assert_eq!(result.candidates.len(), 1);
        assert_eq!(
            result.candidates[0]
                .files
                .iter()
                .map(|file| file.relative_path.as_str())
                .collect::<Vec<_>>(),
            vec![
                "assets/example.txt",
                "catalog.json",
                "courses.json",
                "items.json",
                "pack.json",
                "sets.json"
            ]
        );
        assert!(result.diagnostics.is_empty());

        fs::remove_dir_all(root).expect("remove fixture root");
    }

    #[test]
    fn scan_partial_child_directory_returns_structured_diagnostic() {
        let root = temp_root("partial-child");
        let pack = root.join("partial");
        fs::create_dir_all(&pack).expect("create partial pack directory");
        write_file(&pack, "pack.json", b"{}");
        write_file(&pack, "catalog.json", b"{}");

        let result =
            scan_course_folder(&root, test_read_limits()).expect("scan partial course folder");

        assert_eq!(result.candidates.len(), 1);
        assert!(result.diagnostics.iter().any(|diagnostic| {
            diagnostic.code == "partial-candidate" && diagnostic.path == "partial"
        }));

        fs::remove_dir_all(root).expect("remove fixture root");
    }

    #[test]
    fn scan_unreadable_root_returns_error() {
        let missing_root = temp_root("missing-root");

        let error =
            scan_course_folder(&missing_root, test_read_limits()).expect_err("reject missing root");

        assert_eq!(error.code, "read-failed");
    }

    #[test]
    fn scan_rejects_candidate_resolved_outside_selected_root() {
        let root = temp_root("contained-root");
        let outside = temp_root("outside-root");
        fs::create_dir_all(&root).expect("create root");
        fs::create_dir_all(&outside).expect("create outside root");
        write_file(&outside, "pack.json", b"{}");

        let diagnostic = scan_candidate_path(&root, &outside, test_read_limits())
            .expect_err("reject candidate outside selected root");

        assert_eq!(diagnostic.code, "path-outside-selected-root");

        fs::remove_dir_all(root).expect("remove root");
        fs::remove_dir_all(outside).expect("remove outside root");
    }

    #[test]
    fn scan_rejects_oversized_file_metadata_before_reading_bytes() {
        use std::cell::Cell;

        let root = temp_root("oversized-native-file");
        let pack = root.join("logic");
        fs::create_dir_all(&pack).expect("create pack root");
        write_file(&pack, "pack.json", b"12345678");
        let reads = Cell::new(0);
        let mut reader = |path: &Path, _size: u64| {
            reads.set(reads.get() + 1);
            fs::read(path)
        };

        let error = scan_candidate_path_with_reader(
            &root,
            &pack,
            CourseFolderReadLimits {
                max_total_bytes: 100,
                max_file_count: 10,
                max_file_bytes: 7,
            },
            &mut reader,
        )
        .expect_err("reject oversized file");

        assert_eq!(error.code, "resource-limit-exceeded");
        assert_eq!(reads.get(), 0);
        fs::remove_dir_all(root).expect("remove fixture root");
    }

    #[test]
    fn selected_course_folder_survives_native_config_reload() {
        let root = temp_root("selected-course-folder");
        fs::create_dir_all(&root).expect("create config root");

        save_selected_course_folder_in_directory(&root, "C:\\Courses")
            .expect("save selected course folder");

        assert_eq!(
            load_selected_course_folder_from_directory(&root).expect("load selected course folder"),
            Some("C:\\Courses".to_string())
        );

        fs::remove_dir_all(root).expect("remove config root");
    }

    #[test]
    fn installed_pack_record_replaces_previous_record_for_the_same_pack_id() {
        let root = temp_root("installed-pack-record");
        fs::create_dir_all(&root).expect("create config root");

        write_installed_pack_record_in_directory(
            &root,
            json!({ "packId": "learnt.logic-foundations", "release": "v1" }),
        )
        .expect("write v1 record");
        write_installed_pack_record_in_directory(
            &root,
            json!({ "packId": "learnt.logic-foundations", "release": "v2" }),
        )
        .expect("write v2 record");

        assert_eq!(
            read_installed_pack_records_from_directory(&root).expect("read installed-pack records"),
            json!([{ "packId": "learnt.logic-foundations", "release": "v2" }])
        );

        fs::remove_dir_all(root).expect("remove config root");
    }

    #[test]
    fn corrupt_installed_pack_record_file_returns_a_structured_storage_error() {
        let root = temp_root("corrupt-installed-pack-record");
        fs::create_dir_all(&root).expect("create config root");
        fs::write(root.join("installed-pack-records.json"), "not-json")
            .expect("write corrupt record file");

        let error = read_installed_pack_records_from_directory(&root)
            .expect_err("reject corrupt record file");

        assert_eq!(error.code, "storage-read-failed");

        fs::remove_dir_all(root).expect("remove config root");
    }

    fn temp_root(label: &str) -> PathBuf {
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("read current time")
            .as_nanos();
        std::env::temp_dir().join(format!("concourse-{label}-{nanos}"))
    }

    fn test_read_limits() -> CourseFolderReadLimits {
        CourseFolderReadLimits {
            max_total_bytes: 50 * 1024 * 1024,
            max_file_count: 512,
            max_file_bytes: 10 * 1024 * 1024,
        }
    }

    fn write_file(root: &Path, relative_path: &str, bytes: &[u8]) {
        let path = root.join(relative_path);
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).expect("create file parent directory");
        }
        fs::write(path, bytes).expect("write fixture file");
    }
}
