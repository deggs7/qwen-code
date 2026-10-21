# Sidebar terminology proposal mockups

These are design proposal mockups, not screenshots of implemented Qwen Code behavior.

- Option 1: Projects, working directories, and tasks.
- Option 2: Workspaces, working directories, and tasks.
- Standalone tasks are a separate peer section, with No project association / No workspace association hints.
- Both: Recent; New task at the top and beside Recent.

The English and Chinese versions use the same content and layout. The directory is an attribute, not another container. The creation detail is displayed alongside the sidebar for discussion, not a proposed new panel layout.

Open the standalone HTML files in assets/ to inspect the designs. To regenerate PNGs, place this directory under a project with Playwright installed and Chromium available, then run `node render-mockups.mjs`. Only local HTML is rendered; no running Qwen instance is needed.

All paths, task titles, and project names in the images are sample content. This branch contains proposal assets only and is not intended to merge into the product source.
