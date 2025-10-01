# State Labels :label:

[![CI](https://github.com/FidelusAleksander/state-labels/actions/workflows/ci.yml/badge.svg)](https://github.com/FidelusAleksander/state-labels/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Coverage](./badges/coverage.svg)](./badges/coverage.svg)

A GitHub Action that treats issue & pull request labels as a simple key-value
store. Persist workflow state across jobs and events without external storage.

- [State Labels :label:](#state-labels-label)
  - [Usage examples 🚀](#usage-examples-)
    - [Setting state values](#setting-state-values)
    - [Getting a single value](#getting-a-single-value)
    - [Getting all state](#getting-all-state)
    - [Removing state](#removing-state)
    - [Custom label format](#custom-label-format)
  - [Permissions 🔒](#permissions-)
  - [Inputs ⚙️](#inputs-️)
  - [Outputs 📤](#outputs-)
  - [How it works 🧠](#how-it-works-)
  - [Example: state-driven workflow 🔄](#example-state-driven-workflow-)
  - [Notes 📎](#notes-)
  - [License 🪪](#license-)

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

> [!NOTE] Updating a value with automatically removes the old label from the
> repository

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

## Permissions 🔒

Minimum required permissions (repo-level or workflow `permissions:` block):

```yaml
permissions:
  issues: write
  pull-requests: write
```

## Inputs ⚙️

| Input          | Description                                   | Required | Default                    |
| -------------- | --------------------------------------------- | -------- | -------------------------- |
| `operation`    | One of `get`, `get-all`, `set`, `remove`      | Yes      | -                          |
| `issue-number` | Issue or PR number to operate on              | Yes      | -                          |
| `key`          | State key (needed for `get`, `set`, `remove`) | No\*     | -                          |
| `value`        | State value (needed for `set`)                | No\*     | -                          |
| `prefix`       | Label prefix                                  | No       | `state`                    |
| `separator`    | Separator between prefix, key, value          | No       | `::`                       |
| `repository`   | Repository in `owner/repo` format             | No       | `${{ github.repository }}` |
| `github-token` | Token used for API calls                      | No       | `${{ github.token }}`      |

- `key` required for `get`, `set`, `remove`; `value` required for `set`.
- `issue-number` is always required (pass `${{ github.event.issue.number }}` or
  `${{ github.event.pull_request.number }}` depending on the event).

## Outputs 📤

| Output    | Description                               | When returned |
| --------- | ----------------------------------------- | ------------- |
| `value`   | Retrieved value (string/number)           | `get`         |
| `state`   | All state as JSON string                  | `get-all`     |
| `success` | Boolean indicating if operation succeeded | all           |
| `message` | Human-readable status / error description | all           |

## How it works 🧠

Labels are created using a structured format:

```yaml
{prefix}{separator}{key}{separator}{value}
```

Defaults to: `state::status::in-progress`

On `set`, any existing label for the same `{prefix}{separator}{key}` is removed
first.

Only labels starting with the configured prefix are considered. Other repository
labels remain untouched.

## Example: state-driven workflow 🔄

```yaml
jobs:
  update:
    runs-on: ubuntu-latest
    steps:
      - uses: FidelusAleksander/state-labels@v1
        with:
          operation: set
          key: phase
          value: build

      - uses: FidelusAleksander/state-labels@v1
        id: phase
        with:
          operation: get
          key: phase

      - if: steps.phase.outputs.value == 'build'
        run: echo "Do build things"
```

## Notes 📎

- State is per-issue / per-PR
- Labels are visible to collaborators
- Keep key-value lengths reasonable (GitHub label name length limits apply)

## License 🪪

MIT – see [LICENSE](./LICENSE)
