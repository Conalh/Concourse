use std::fs::{self, File, OpenOptions};
use std::io::{self, Write};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Mutex;

static WRITE_LOCK: Mutex<()> = Mutex::new(());
static TEMP_COUNTER: AtomicU64 = AtomicU64::new(0);

pub fn write_file_atomically(path: &Path, bytes: &[u8]) -> io::Result<()> {
    write_file_atomically_with_replace(path, bytes, replace_file)
}

pub(crate) fn write_file_atomically_with_replace<F>(
    path: &Path,
    bytes: &[u8],
    replace: F,
) -> io::Result<()>
where
    F: FnOnce(&Path, &Path) -> io::Result<()>,
{
    let _guard = WRITE_LOCK
        .lock()
        .map_err(|_| io::Error::other("file write lock poisoned"))?;
    let parent = path
        .parent()
        .ok_or_else(|| io::Error::other("file destination has no parent directory"))?;
    fs::create_dir_all(parent)?;
    let (temporary, mut file) = create_unique_temporary(path)?;

    let result = (|| {
        file.write_all(bytes)?;
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
        .ok_or_else(|| io::Error::other("file destination has no parent directory"))?;
    let file_name = path
        .file_name()
        .ok_or_else(|| io::Error::other("file destination has no filename"))?
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
    use super::{write_file_atomically, write_file_atomically_with_replace};
    use std::collections::HashSet;
    use std::fs;
    use std::io;
    use std::path::{Path, PathBuf};
    use std::sync::{Arc, Mutex};
    use std::thread;
    use std::time::{SystemTime, UNIX_EPOCH};

    #[test]
    fn writes_exact_bytes_and_leaves_no_temporary_file() {
        let root = temp_root("exact-bytes");
        let destination = root.join("module-01-lab.ipynb");
        let bytes = [0, 1, 2, 127, 255];

        write_file_atomically(&destination, &bytes).expect("write exact bytes");

        assert_eq!(fs::read(&destination).expect("read destination"), bytes);
        assert!(temporary_siblings(&root).is_empty());
        fs::remove_dir_all(root).expect("remove fixture root");
    }

    #[test]
    fn replacement_failure_preserves_the_previous_destination() {
        let root = temp_root("preserve-destination");
        fs::create_dir_all(&root).expect("create fixture root");
        let destination = root.join("module-01-lab.ipynb");
        let original = b"original notebook";
        fs::write(&destination, original).expect("write original destination");

        let error = write_file_atomically_with_replace(
            &destination,
            b"replacement notebook",
            |_temporary, _destination| Err(io::Error::other("injected replacement failure")),
        )
        .expect_err("replacement should fail");

        assert_eq!(error.to_string(), "injected replacement failure");
        assert_eq!(fs::read(&destination).expect("read destination"), original);
        assert!(temporary_siblings(&root).is_empty());
        fs::remove_dir_all(root).expect("remove fixture root");
    }

    #[test]
    fn failed_first_write_leaves_no_destination_or_temporary_file() {
        let root = temp_root("failed-first-write");
        fs::create_dir_all(&root).expect("create fixture root");
        let destination = root.join("module-01-lab.ipynb");

        write_file_atomically_with_replace(
            &destination,
            b"notebook",
            |_temporary, _destination| Err(io::Error::other("injected failure")),
        )
        .expect_err("first write should fail");

        assert!(!destination.exists());
        assert!(temporary_siblings(&root).is_empty());
        fs::remove_dir_all(root).expect("remove fixture root");
    }

    #[test]
    fn concurrent_writes_leave_one_complete_value() {
        let root = temp_root("concurrent-writes");
        fs::create_dir_all(&root).expect("create fixture root");
        let destination = root.join("module-01-lab.ipynb");
        let expected = (0..16)
            .map(|value| format!("complete-notebook-{value}"))
            .collect::<HashSet<_>>();

        let handles = expected
            .iter()
            .cloned()
            .map(|value| {
                let destination = destination.clone();
                thread::spawn(move || write_file_atomically(&destination, value.as_bytes()))
            })
            .collect::<Vec<_>>();

        for handle in handles {
            handle
                .join()
                .expect("writer thread should not panic")
                .expect("writer should succeed");
        }

        let final_value = String::from_utf8(fs::read(&destination).expect("read destination"))
            .expect("destination should be UTF-8");
        assert!(expected.contains(&final_value));
        assert!(temporary_siblings(&root).is_empty());
        fs::remove_dir_all(root).expect("remove fixture root");
    }

    #[test]
    fn temporary_sibling_names_are_unique_and_cleaned_after_failure() {
        let root = temp_root("unique-temporaries");
        fs::create_dir_all(&root).expect("create fixture root");
        let destination = root.join("module-01-lab.ipynb");
        let observed = Arc::new(Mutex::new(Vec::<PathBuf>::new()));

        for _ in 0..8 {
            let observed = Arc::clone(&observed);
            write_file_atomically_with_replace(
                &destination,
                b"notebook",
                move |temporary, _destination| {
                    observed
                        .lock()
                        .expect("lock observed paths")
                        .push(temporary.to_path_buf());
                    Err(io::Error::other("injected failure"))
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

    fn temporary_siblings(root: &Path) -> Vec<PathBuf> {
        fs::read_dir(root)
            .map(|entries| {
                entries
                    .map(|entry| entry.expect("read fixture entry").path())
                    .filter(|path| {
                        path.file_name()
                            .is_some_and(|name| name.to_string_lossy().contains(".concourse-tmp-"))
                    })
                    .collect()
            })
            .unwrap_or_default()
    }

    fn temp_root(label: &str) -> PathBuf {
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("read current time")
            .as_nanos();
        std::env::temp_dir().join(format!(
            "concourse-atomic-file-{label}-{}-{nanos}",
            std::process::id()
        ))
    }
}
