use serde_json::Value;
use std::fs::{self, File, OpenOptions};
use std::io::{self, Write};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Mutex;

static WRITE_LOCK: Mutex<()> = Mutex::new(());
static TEMP_COUNTER: AtomicU64 = AtomicU64::new(0);

pub fn write_json_file(path: &Path, value: &Value) -> io::Result<()> {
    write_json_file_with_replace(path, value, replace_file)
}

fn write_json_file_with_replace<F>(path: &Path, value: &Value, replace: F) -> io::Result<()>
where
    F: FnOnce(&Path, &Path) -> io::Result<()>,
{
    let bytes = serde_json::to_vec_pretty(value).map_err(io::Error::other)?;
    let _guard = WRITE_LOCK
        .lock()
        .map_err(|_| io::Error::other("JSON write lock poisoned"))?;
    let parent = path
        .parent()
        .ok_or_else(|| io::Error::other("JSON destination has no parent directory"))?;
    fs::create_dir_all(parent)?;
    let (temporary, mut file) = create_unique_temporary(path)?;

    let result = (|| {
        file.write_all(&bytes)?;
        file.sync_all()?;
        drop(file);
        replace(&temporary, path)?;
        sync_parent_directory(parent)
    })();

    if result.is_err() {
        let _ = fs::remove_file(&temporary);
    }
    result
}

fn create_unique_temporary(path: &Path) -> io::Result<(PathBuf, File)> {
    let parent = path
        .parent()
        .ok_or_else(|| io::Error::other("JSON destination has no parent directory"))?;
    let file_name = path
        .file_name()
        .ok_or_else(|| io::Error::other("JSON destination has no filename"))?
        .to_string_lossy();

    loop {
        let counter = TEMP_COUNTER.fetch_add(1, Ordering::Relaxed);
        let temporary = parent.join(format!(
            ".{file_name}.concourse-tmp-{}-{counter}",
            std::process::id()
        ));
        match OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&temporary)
        {
            Ok(file) => return Ok((temporary, file)),
            Err(error) if error.kind() == io::ErrorKind::AlreadyExists => continue,
            Err(error) => return Err(error),
        }
    }
}

#[cfg(unix)]
fn replace_file(source: &Path, destination: &Path) -> io::Result<()> {
    fs::rename(source, destination)
}

#[cfg(windows)]
fn replace_file(source: &Path, destination: &Path) -> io::Result<()> {
    use std::os::windows::ffi::OsStrExt;
    use std::ptr::null;
    use windows_sys::Win32::Storage::FileSystem::{
        MoveFileExW, ReplaceFileW, MOVEFILE_WRITE_THROUGH, REPLACEFILE_WRITE_THROUGH,
    };

    fn wide(path: &Path) -> Vec<u16> {
        path.as_os_str().encode_wide().chain(Some(0)).collect()
    }

    let source = wide(source);
    let destination_wide = wide(destination);
    let replaced = unsafe {
        if destination.exists() {
            ReplaceFileW(
                destination_wide.as_ptr(),
                source.as_ptr(),
                null(),
                REPLACEFILE_WRITE_THROUGH,
                null(),
                null(),
            )
        } else {
            MoveFileExW(
                source.as_ptr(),
                destination_wide.as_ptr(),
                MOVEFILE_WRITE_THROUGH,
            )
        }
    };

    if replaced == 0 {
        return Err(io::Error::last_os_error());
    }
    Ok(())
}

#[cfg(unix)]
fn sync_parent_directory(parent: &Path) -> io::Result<()> {
    File::open(parent)?.sync_all()
}

#[cfg(windows)]
fn sync_parent_directory(_parent: &Path) -> io::Result<()> {
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{write_json_file, write_json_file_with_replace};
    use serde_json::{json, Value};
    use std::collections::HashSet;
    use std::fs;
    use std::io;
    use std::path::{Path, PathBuf};
    use std::sync::{Arc, Mutex};
    use std::thread;
    use std::time::{SystemTime, UNIX_EPOCH};

    #[test]
    fn replacement_failure_preserves_the_previous_destination() {
        let root = temp_root("preserve-destination");
        fs::create_dir_all(&root).expect("create fixture root");
        let destination = root.join("record.json");
        let original = br#"{"version":1}"#;
        fs::write(&destination, original).expect("write original destination");

        let error = write_json_file_with_replace(
            &destination,
            &json!({ "version": 2 }),
            |_temporary, _destination| {
                Err(io::Error::new(
                    io::ErrorKind::Other,
                    "injected replacement failure",
                ))
            },
        )
        .expect_err("replacement should fail");

        assert_eq!(error.to_string(), "injected replacement failure");
        assert_eq!(fs::read(&destination).expect("read destination"), original);
        assert!(temporary_siblings(&root).is_empty());
        fs::remove_dir_all(root).expect("remove fixture root");
    }

    #[test]
    fn first_write_failure_leaves_no_destination_or_temporary_file() {
        let root = temp_root("failed-first-write");
        fs::create_dir_all(&root).expect("create fixture root");
        let destination = root.join("record.json");

        write_json_file_with_replace(
            &destination,
            &json!({ "version": 1 }),
            |_temporary, _destination| {
                Err(io::Error::new(
                    io::ErrorKind::Other,
                    "injected first-write failure",
                ))
            },
        )
        .expect_err("first write should fail");

        assert!(!destination.exists());
        assert!(temporary_siblings(&root).is_empty());
        fs::remove_dir_all(root).expect("remove fixture root");
    }

    #[test]
    fn temporary_sibling_names_are_unique_and_cleaned_after_failure() {
        let root = temp_root("unique-temporaries");
        fs::create_dir_all(&root).expect("create fixture root");
        let destination = root.join("record.json");
        let observed = Arc::new(Mutex::new(Vec::<PathBuf>::new()));

        for version in 0..8 {
            let observed = Arc::clone(&observed);
            write_json_file_with_replace(
                &destination,
                &json!({ "version": version }),
                move |temporary, _destination| {
                    observed
                        .lock()
                        .expect("lock observed paths")
                        .push(temporary.to_path_buf());
                    Err(io::Error::new(io::ErrorKind::Other, "injected failure"))
                },
            )
            .expect_err("replacement should fail");
        }

        let observed = observed.lock().expect("lock observed paths");
        assert_eq!(observed.len(), 8);
        assert_eq!(observed.iter().collect::<HashSet<_>>().len(), 8);
        assert!(temporary_siblings(&root).is_empty());
        fs::remove_dir_all(root).expect("remove fixture root");
    }

    #[test]
    fn concurrent_writes_leave_one_complete_json_value() {
        let root = temp_root("concurrent-writes");
        fs::create_dir_all(&root).expect("create fixture root");
        let destination = root.join("record.json");

        let handles = (0..16)
            .map(|version| {
                let destination = destination.clone();
                thread::spawn(move || write_json_file(&destination, &json!({ "version": version })))
            })
            .collect::<Vec<_>>();

        for handle in handles {
            handle
                .join()
                .expect("writer thread should not panic")
                .expect("writer should succeed");
        }

        let value: Value =
            serde_json::from_slice(&fs::read(&destination).expect("read final destination"))
                .expect("final destination should contain complete JSON");
        let version = value
            .get("version")
            .and_then(Value::as_u64)
            .expect("read final version");
        assert!(version < 16);
        assert!(temporary_siblings(&root).is_empty());
        fs::remove_dir_all(root).expect("remove fixture root");
    }

    fn temporary_siblings(root: &Path) -> Vec<PathBuf> {
        fs::read_dir(root)
            .expect("read fixture root")
            .map(|entry| entry.expect("read fixture entry").path())
            .filter(|path| {
                path.file_name()
                    .is_some_and(|name| name.to_string_lossy().contains(".concourse-tmp-"))
            })
            .collect()
    }

    fn temp_root(label: &str) -> PathBuf {
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("read current time")
            .as_nanos();
        std::env::temp_dir().join(format!(
            "concourse-atomic-json-{label}-{}-{nanos}",
            std::process::id()
        ))
    }
}
