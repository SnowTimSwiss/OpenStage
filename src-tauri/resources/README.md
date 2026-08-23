# resources/libreoffice/

This directory is staged by `.github/workflows/release.yml` before `tauri build`
runs, and is intentionally empty in git (a full LibreOffice tree is hundreds of
MB and differs per platform). `tauri.conf.json` bundles whatever is here under
`bundle.resources` as `libreoffice/` inside the app's resource directory.

Expected layout after staging, matching what `find_libreoffice()` in
`src-tauri/src/lib.rs` looks for:

```
resources/libreoffice/program/soffice        # Linux / macOS
resources/libreoffice/program/soffice.exe    # Windows
```

To reproduce locally for testing (Linux example, requires a system LibreOffice
install to copy from):

```bash
mkdir -p src-tauri/resources/libreoffice
cp -r /usr/lib/libreoffice/program src-tauri/resources/libreoffice/program
# ... plus /usr/lib/libreoffice/share, as soffice needs it at runtime
cp -r /usr/lib/libreoffice/share src-tauri/resources/libreoffice/share
```

The CI workflow downloads the official LibreOffice "still" release per OS/arch
instead of relying on a system install. See `release.yml` for the exact steps
and `src-tauri/LICENSES/libreoffice/` for the bundled license texts.
