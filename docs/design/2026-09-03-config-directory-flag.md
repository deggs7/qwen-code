# Process configuration directory flag

## Context

Qwen Code already supports relocating its user-level configuration root with
`QWEN_HOME`. That root contains `settings.json`, credentials, memory, Qwen
skills, extensions, and other global state. Project-level `.qwen` directories
remain workspace-scoped and are merged independently.

The environment variable provides the required storage model, but it is not a
discoverable per-launch interface. Users who run several customized CLI or
daemon processes must currently wrap each command in environment setup.
Selecting only an alternate `settings.json` would also be incomplete because
the process would continue to share credentials, skills, extensions, and
memory from the default root.

Related community work:

- Issue #2951 and PR #2953 introduced `QWEN_HOME` as the configuration-root
  single source of truth.
- Issue #7394 and PR #7395 introduced `skills.directories` for additional
  trusted skill roots.
- Issues #4013 and #4018 discuss profile import and export, which is a distinct
  portability workflow rather than per-process profile selection.
- Issue #3696 completed runtime hot reload. This proposal only selects the
  initial process configuration and does not add another reload path.

Searches for `settings.json`, settings/config file and path, `--settings`,
`--config-dir`, `QWEN_HOME`, configuration profiles, multiple profiles,
isolated configuration, and alternate settings found no direct duplicate.

## Decision

Add a process-level option:

```text
--config-dir <directory>
```

The option sets the effective `QWEN_HOME` before any route-specific runtime or
settings loader is imported. The existing storage and settings architecture
then remains the only implementation of configuration routing.

Examples:

```bash
qwen --config-dir /home/alice/.qwen-profiles/research
qwen serve --config-dir /home/alice/.qwen-profiles/automation --workspace /srv/project
```

A profile directory can contain:

```text
settings.json
.env
skills/<name>/SKILL.md
extensions/
memory.md
oauth_creds.json
```

`settings.json` can declare user-level MCP servers and `skills.directories`.
Qwen-native skills placed under `<config-dir>/skills` are discovered through
the existing user-skill path. The cross-agent `~/.agents/skills` provider,
bundled skills, and trusted project skills retain their existing discovery
semantics.

## Semantics

- `--config-dir` wins over an inherited `QWEN_HOME` and over values discovered
  from user-level `.env` files.
- The value must be an absolute path to an existing directory that the process
  can read, traverse, and write. The bootstrap canonicalizes the path and exits
  before loading settings or credentials if validation fails; it never falls
  back to `QWEN_HOME` or `~/.qwen`.
- `QWEN_RUNTIME_DIR` keeps its existing higher-priority runtime-output
  override. Without it, runtime output follows the selected configuration
  root, as it does with `QWEN_HOME`.
- System defaults and enforcing system settings continue to apply. Trusted
  workspace settings continue to merge from each workspace's
  `.qwen/settings.json`.
- The option selects a directory, not one file, because a lone settings file
  cannot represent the requested credentials/skills/extensions configuration
  boundary.
- Selection is process-global. Every workspace runtime owned by one
  `qwen serve` process shares the selected user root. Run separate daemon
  processes with separate ports and `--config-dir` values when user-level
  configuration must differ.
- This selects a coherent user profile, not a fully isolated daemon. Live
  discovery ownership remains in the real OS user's `~/.qwen` by design, so
  daemons with different configuration roots still contend on the same stable
  owner record.
- Existing launches without the option are unchanged.

## Startup integration

The production launcher resolves a valid option before selecting its managed
npm version and update root. An inherited managed-version pin still keeps a
nested command on its parent process's build, matching the existing relaunch
contract. The lightweight CLI bootstrap then validates and applies the option
before importing the normal CLI, MCP command path, or daemon fast path. The
daemon fast-path parser recognizes the option so the optimized startup route is
preserved; the MCP fast path removes the already-applied option before its
command-only parser runs. Container sandbox startup consumes the host flag
before handoff because it already canonicalizes, mounts, and forwards the
selected root through `QWEN_HOME`; this avoids resolving a host path again
inside the container.

No core storage API, settings merge rule, daemon route, or workspace ownership
model changes. The implementation is a CLI adapter over `QWEN_HOME`.

## Existing downstream consumers

The production launcher and CLI bootstrap set the same canonical `QWEN_HOME`;
all reads remain behind the existing storage boundary:

- `loadSettings()` and the environment pre-pass use the selected root for user
  `settings.json` and `.env` while continuing to resolve project settings from
  the workspace.
- `Storage` routes installation identity, OAuth credentials, MCP OAuth tokens,
  user memory, commands, and the default runtime directory through the root.
- `Storage.getUserSkillsDirs()` supplies `<config-dir>/skills` to
  `SkillManager`; other skill providers keep their existing roots.
- `Storage.getUserExtensionsDir()` supplies the root used by
  `ExtensionManager` and extension commands.
- The daemon loads its process-global user settings from this root before
  creating workspace runtimes. Workspace environment, trust, services, and
  filesystem boundaries remain owned by the resolved workspace runtime.
- Stable Live discovery arbitration remains OS-user scoped at the real
  `~/.qwen`, independent of `QWEN_HOME`, `QWEN_RUNTIME_DIR`, and
  `--config-dir`.

## Validation

- Unit-test argument extraction, precedence, canonicalization, access checks,
  invalid-value failures, and the `--` boundary.
- Verify the production launcher and CLI bootstrap apply the selected root
  before managed npm selection and CLI, MCP, or daemon dispatch.
- Verify both help surfaces document the option and the daemon fast path keeps
  accepting it.
- Extend the existing `QWEN_HOME` coverage to launch through `--config-dir`,
  proving selected settings and MCP configuration at CLI startup, selected
  policy at daemon startup, and the Qwen skill and extension base directories
  exposed by `Storage`.
- Run targeted suites, build, typecheck, and the relevant no-sandbox
  integration test before the final self-audit.
