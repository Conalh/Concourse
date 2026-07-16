use concourse_desktop_lib::desktop_commands::write_pack_asset;
use std::fs;
use std::time::{SystemTime, UNIX_EPOCH};

#[test]
fn native_command_writes_exact_pack_asset_bytes() {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("read current time")
        .as_nanos();
    let root = std::env::temp_dir().join(format!(
        "concourse-pack-asset-command-{}-{nanos}",
        std::process::id()
    ));
    let destination = root.join("module-01-lab.ipynb");
    let expected = vec![0, 1, 2, 127, 255];

    write_pack_asset(destination.to_string_lossy().into_owned(), expected.clone())
        .expect("write pack asset");

    assert_eq!(fs::read(destination).expect("read destination"), expected);
    fs::remove_dir_all(root).expect("remove fixture root");
}
