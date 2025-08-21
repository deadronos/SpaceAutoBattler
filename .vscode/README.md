# Workspace settings & recommended extensions

This workspace includes editor settings and recommended extensions to help tests be discovered and run.

To sync these settings across machines:

1. Open VS Code and sign in (Settings Sync) via the Account icon in the activity bar.
2. Enable Settings Sync and choose the items to sync (Settings, Extensions, Keybindings, etc.).
3. When you open the workspace on another machine, VS Code will prompt to install the workspace recommended extensions (see `.vscode/extensions.json`).

Notes:

- We recommend installing the Playwright Test extension and a Vitest Test Explorer adapter so tests appear in the Test Explorer and Playwright UI.
- Workspace settings are stored in `.vscode/settings.json` and override user settings when the workspace is opened.
