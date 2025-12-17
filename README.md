# State Labels :label:

[![CI](https://github.com/FidelusAleksander/state-labels/actions/workflows/ci.yml/badge.svg)](https://github.com/FidelusAleksander/state-labels/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Coverage](./badges/coverage.svg)](./badges/coverage.svg)

A GitHub Action that treats issue & pull request labels as a simple key-value
store. Persist workflow state across jobs and events without external storage.

- [State Labels :label:](#state-labels-label)
  - [Example](#example)
  - [How it works 🧠](#how-it-works-)
  - [Inputs ⚙️](#inputs-️)
  - [Outputs 📤](#outputs-)
  - [Permissions 🔒](#permissions-)
  - [Usage examples 🚀](#usage-examples-)
    - [Setting state values](#setting-state-values)
    - [Getting a single value](#getting-a-single-value)
    - [Getting all state](#getting-all-state)
    - [Removing state](#removing-state)
    - [Custom label format](#custom-label-format)

No database. No artifacts. Just labels with a structured naming convention.

## Example

Set the value of `phase` to `build`

```yaml
- uses: FidelusAleksander/state-labels@v1
  with:
    operation: set
    key: phase
    value: build
```

Then get the value in the same, or different workflow run

```yaml

  - uses: FidelusAleksander/state-labels@v1
    id: phase
    with:
      operation: get
      key: phase

  - name: Use value
    run: echo "phase: ${{ steps.phase.outputs.value }}"

```

## How it works 🧠

Labels are created using a structured format:

```yaml
{prefix}{separator}{key}{separator}{value}
```

Defaults to: `state::key::value`

On `set`, any existing label for the same `{prefix}{separator}{key}` is removed
first.

Only labels starting with the configured prefix are considered. Other repository
labels remain untouched.

## Inputs ⚙️

| Input                  | Description                                                                                        | Required | Default                    |
| ---------------------- | -------------------------------------------------------------------------------------------------- | -------- | -------------------------- |
| `operation`            | One of `get`, `get-all`, `set`, `remove`                                                           | Yes      | -                          |
| `issue-number`         | Issue or PR number to operate on (auto-detected from context if not provided)                      | No       | -                          |
| `key`                  | State key (needed for `get`, `set`, `remove`)                                                      | No       | -                          |
| `value`                | State value (needed for `set`)                                                                     | No       | -                          |
| `prefix`               | Label prefix                                                                                       | No       | `state`                    |
| `separator`            | Separator between prefix, key, value                                                               | No       | `::`                       |
| `repository`           | Repository in `owner/repo` format                                                                  | No       | `${{ github.repository }}` |
| `github-token`         | Token used for API calls                                                                           | No       | `${{ github.token }}`      |
| `delete-unused-labels` | Whether to delete labels from repository when removed/unset (only if not used by other issues/PRs) | No       | `false`                    |

## Outputs 📤

| Output    | Description                               | When returned |
| --------- | ----------------------------------------- | ------------- |
| `value`   | Retrieved value (string/number)           | `get`         |
| `state`   | All state as JSON string                  | `get-all`     |
| `success` | Boolean indicating if operation succeeded | all           |

Notes about `success`:

- `success = true` — The requested operation completed logically (value found,
  state set/removed, etc.).
- `success = false` and the step did NOT fail — A soft/expected domain miss
  (currently only: key not found for `get` / `remove`).
- `success = false` and the step failed (the action marked the run with
  `core.setFailed`) — An operational error (invalid inputs, API/network failure,
  etc.).

This lets you branch on domain misses without treating them as full step
failures:

## Permissions 🔒

Minimum required permissions (repo-level or workflow `permissions:` block):

```yaml
permissions:
  issues: write
  pull-requests: write
```

## Usage examples 🚀

### Setting state values

```yaml
- uses: FidelusAleksander/state-labels@v1
  with:
    operation: set
    key: status
    value: in-progress
```

```yaml
- uses: FidelusAleksander/state-labels@v1
  with:
    operation: set
    key: review-count
    value: '3'
```

### Getting a single value

```yaml
- uses: FidelusAleksander/state-labels@v1
  id: get-status
  with:
    operation: get
    key: status
- name: Use value
  run: echo "Status: ${{ steps.get-status.outputs.value }}"
```

### Getting all state

```yaml
- uses: FidelusAleksander/state-labels@v1
  id: all
  with:
    operation: get-all
- name: Show state
  run: echo '${{ steps.all.outputs.state }}'
```

Example get-all output:

```json
{
  "status": "in-progress",
  "review-count": 3,
  "env": "staging"
}
```

### Removing state

```yaml
- uses: FidelusAleksander/state-labels@v1
  with:
    operation: remove
    key: status
```

### Custom label format

```yaml
- uses: FidelusAleksander/state-labels@v1
  with:
    operation: set
    key: env
    value: production
    prefix: workflow
    separator: __
```

Creates label: `workflow__env__production`

### Deleting unused labels

By default, labels are removed from issues/PRs but remain in the repository.
Enable automatic cleanup of unused labels:

```yaml
- uses: FidelusAleksander/state-labels@v1
  with:
    operation: remove
    key: status
    delete-unused-labels: true
```

When `delete-unused-labels` is `true`, the action will delete the label from the
repository only if it's not used by any other issues or pull requests.
