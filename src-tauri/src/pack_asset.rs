use std::io;
use std::path::Path;

pub const MAX_PACK_ASSET_BYTES: usize = 10 * 1024 * 1024;
const ALLOWED_EXTENSIONS: [&str; 7] = ["ipynb", "py", "csv", "md", "txt", "yml", "yaml"];

pub fn write_validated_pack_asset(destination: &Path, bytes: &[u8]) -> io::Result<()> {
    if bytes.len() > MAX_PACK_ASSET_BYTES {
        return Err(io::Error::other("pack asset exceeds 10 MiB"));
    }
    if destination.is_dir() {
        return Err(io::Error::other(
            "pack asset destination must be a regular file",
        ));
    }

    let extension = destination
        .extension()
        .and_then(|value| value.to_str())
        .map(str::to_ascii_lowercase)
        .filter(|value| ALLOWED_EXTENSIONS.contains(&value.as_str()))
        .ok_or_else(|| io::Error::other("pack asset destination extension is not allowed"))?;
    debug_assert!(ALLOWED_EXTENSIONS.contains(&extension.as_str()));

    crate::atomic_file::write_file_atomically(destination, bytes)
}

#[cfg(test)]
mod tests {
    use super::{write_validated_pack_asset, MAX_PACK_ASSET_BYTES};
    use std::fs;
    use std::path::PathBuf;
    use std::time::{SystemTime, UNIX_EPOCH};

    #[test]
    fn writes_exact_pack_asset_bytes() {
        let root = temp_root("exact-pack-asset");
        let destination = root.join("module-01-lab.ipynb");
        let bytes = [0, 1, 2, 127, 255];

        write_validated_pack_asset(&destination, &bytes).expect("write pack asset");

        assert_eq!(fs::read(&destination).expect("read destination"), bytes);
        fs::remove_dir_all(root).expect("remove fixture root");
    }

    #[test]
    fn accepts_the_maximum_pack_asset_size() {
        let root = temp_root("maximum-size");
        let destination = root.join("module-01-data.csv");
        let bytes = vec![b'x'; MAX_PACK_ASSET_BYTES];

        write_validated_pack_asset(&destination, &bytes).expect("write maximum asset");

        assert_eq!(
            fs::metadata(&destination)
                .expect("read destination metadata")
                .len(),
            MAX_PACK_ASSET_BYTES as u64
        );
        fs::remove_dir_all(root).expect("remove fixture root");
    }

    #[test]
    fn rejects_an_oversized_asset_without_changing_an_existing_file() {
        let root = temp_root("oversized");
        fs::create_dir_all(&root).expect("create fixture root");
        let destination = root.join("module-01-data.csv");
        fs::write(&destination, b"existing").expect("write existing destination");
        let bytes = vec![b'x'; MAX_PACK_ASSET_BYTES + 1];

        let error =
            write_validated_pack_asset(&destination, &bytes).expect_err("reject oversized asset");

        assert!(error.to_string().contains("exceeds 10 MiB"));
        assert_eq!(
            fs::read(&destination).expect("read existing destination"),
            b"existing"
        );
        fs::remove_dir_all(root).expect("remove fixture root");
    }

    #[test]
    fn rejects_unsupported_or_missing_extensions() {
        let root = temp_root("extensions");
        fs::create_dir_all(&root).expect("create fixture root");

        for file_name in ["unsafe.html", "installer.exe", "no-extension"] {
            let error = write_validated_pack_asset(&root.join(file_name), b"content")
                .expect_err("reject extension");
            assert!(error.to_string().contains("not allowed"));
        }

        fs::remove_dir_all(root).expect("remove fixture root");
    }

    #[test]
    fn accepts_allowed_extensions_case_insensitively() {
        let root = temp_root("allowed-extensions");

        for file_name in [
            "lab.IPYNB",
            "script.py",
            "data.csv",
            "readme.md",
            "notes.txt",
            "environment.yml",
            "environment.yaml",
        ] {
            let destination = root.join(file_name);
            write_validated_pack_asset(&destination, b"content").expect("accept allowed extension");
        }

        fs::remove_dir_all(root).expect("remove fixture root");
    }

    #[test]
    fn rejects_a_directory_destination() {
        let root = temp_root("directory-destination");
        fs::create_dir_all(&root).expect("create fixture root");

        let error = write_validated_pack_asset(&root, b"content")
            .expect_err("reject directory destination");

        assert!(error.to_string().contains("regular file"));
        fs::remove_dir_all(root).expect("remove fixture root");
    }

    fn temp_root(label: &str) -> PathBuf {
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("read current time")
            .as_nanos();
        std::env::temp_dir().join(format!(
            "concourse-pack-asset-{label}-{}-{nanos}",
            std::process::id()
        ))
    }
}
