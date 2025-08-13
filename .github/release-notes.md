# Radio Scheduler - Release Notes and Download Guide

This release includes installers and update metadata for in-app auto-updates. For most users, download only the installer for your OS as described below. The other files are used by the app to auto-update itself.

## Downloads

- macOS (Apple Silicon M1/M2/M3): download the .dmg file named like: Radio-Scheduler-<version>-mac-arm64.dmg. Open the DMG and drag Radio Scheduler to Applications.
- Windows 10/11 (x64): download the .exe installer named like: Radio-Scheduler-<version>-win-x64.exe. Run the installer and follow prompts.

## Notes about other assets

- Radio-Scheduler-<version>-mac-arm64.zip: used by macOS auto-update. You can ignore it unless you prefer a portable ZIP instead of DMG.
- latest-mac.yml, latest.yml: update manifests consumed by the app to discover updates.
- *.blockmap: differential update data to make downloads smaller during auto-update.

## Troubleshooting on macOS (unsigned build)

These builds are currently unsigned/notarized, so macOS Gatekeeper may block first launch with a message like “is damaged and can’t be opened.”

Recommended steps (do one of the following):

1) Use Finder “Open” override (no Terminal)
- Move the app to /Applications
- Right-click the app (or Control-click) → Open → Open
- This whitelists the app for future launches

2) Remove quarantine attribute (Terminal)
- If in Applications:
  xattr -dr com.apple.quarantine "/Applications/Radio Scheduler.app"
- If still in Downloads:
  xattr -dr com.apple.quarantine "$HOME/Downloads/Radio Scheduler.app"

3) Launch via CLI once (may prompt to allow)
- open -a "Radio Scheduler"

Notes:
- Always copy the app to /Applications before using option 2 or 3 for best results.
- After the first successful launch, Gatekeeper will remember your approval.

## Auto-update behavior

- Windows: auto-update is supported.
- macOS: unsigned/notarized apps may not auto-update reliably. If the app does not update itself, download the latest installer from the Releases page and replace the app in /Applications.

## Windows SmartScreen

If you see “Windows protected your PC”:
- Click “More info” → “Run anyway” to proceed.

## Changes

- See the repository commit history for detailed changes for this version.

## Support

- File issues or feature requests at: https://github.com/klorin911/radioscheduler/issues