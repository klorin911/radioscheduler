# Radio Scheduler - Release Notes and Download Guide

This release includes installers and update metadata for in-app auto-updates. For most users, download only the installer for your OS as described below. The other files are used by the app to auto-update itself.

## Downloads

- macOS (Apple Silicon M1/M2/M3): download the .dmg file named like: Radio-Scheduler-<version>-mac-arm64.dmg. Open the DMG and drag Radio Scheduler to Applications.
- Windows 10/11 (x64): download the .exe installer named like: Radio-Scheduler-<version>-win-x64.exe. Run the installer and follow prompts.

## Notes about other assets

- Radio-Scheduler-<version>-mac-arm64.zip: used by macOS auto-update. You can ignore it unless you prefer a portable ZIP instead of DMG.
- latest-mac.yml, latest.yml: update manifests consumed by the app to discover updates.
- *.blockmap: differential update data to make downloads smaller during auto-update.

## Tips

- If you installed a previous version, the app will normally auto-update. Manual download is only needed for a fresh install or when instructed.
- On macOS, if you see a Gatekeeper warning, right-click the app and choose Open the first time.

## Changes

- See the repository commit history for detailed changes for this version.

## Support

- File issues or feature requests at: https://github.com/klorin911/radioscheduler/issues