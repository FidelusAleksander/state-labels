# State Labels GitHub Action

A JavaScript GitHub Action for managing issue and PR labels as structured state,
supporting flexible label formats and CRUD operations. The `issue-number` input
can default to both issue and PR events using
`${{ github.event.issue.number || github.event.pull_request.number }}` for
seamless integration.

## Features

- **Add/Modify State Value:** Set or update a key/value in state labels.
- **Remove State Key/Value:** Delete a key from state labels.
- **Get State Value:** Retrieve a specific key’s value from state labels.
- **Get All State Values:** Output all state labels as a JSON object.
- **Flexible Label Format:** Customize label prefix and separator.

## Inputs

| Name           | Description                                                            | Required | Default                    |
| -------------- | ---------------------------------------------------------------------- | -------- | -------------------------- |
| `operation`    | Action to perform: `add`, `modify`, `remove`, `get`, `get-all`         | Yes      | -                          |
| `issue-number` | Issue or PR number to operate on                                       | Yes      | -                          |
| `github-token` | GitHub token for authentication                                        | Yes      | -                          |
| `key`          | State key to add/modify/remove/get (required for all except `get-all`) | No       | -                          |
| `value`        | Value to set for `add`/`modify` operations                             | No       | -                          |
| `prefix`       | Label prefix (e.g., `state`)                                           | No       | `state`                    |
| `separator`    | Separator between label parts (e.g., `::`)                             | No       | `::`                       |
| `repository`   | Repository in `owner/repo` format                                      | No       | `${{ github.repository }}` |

## Outputs

| Name      | Description                                                   |
| --------- | ------------------------------------------------------------- |
| `state`   | JSON string of all state key/values (for `get-all` operation) |
| `value`   | Value of the requested key (for `get` operation)              |
| `success` | Boolean indicating if the operation succeeded                 |
| `message` | Status or error message                                       |

## Label Format

Labels follow the pattern: `<prefix><separator><key><separator><value>`

- Example: `state::step::2`
- Customizable via `prefix` and `separator` inputs.

## Usage Examples

### Add or Modify a State Value

```yaml
- name: Set state value
  uses: FidelusAleksander/state-labels@v1
  with:
    operation: add
    issue-number: ${{ github.event.issue.number }}
    key: step
    value: 2
    github-token: ${{ secrets.GITHUB_TOKEN }}
```

### Remove a State Key

```yaml
- name: Remove state key
  uses: FidelusAleksander/state-labels@v1
  with:
    operation: remove
    issue-number: ${{ github.event.issue.number }}
    key: step
    github-token: ${{ secrets.GITHUB_TOKEN }}
```

### Get a State Value

```yaml
- name: Get state value
  id: get-state
  uses: FidelusAleksander/state-labels@v1
  with:
    operation: get
    issue-number: ${{ github.event.issue.number }}
    key: step
    github-token: ${{ secrets.GITHUB_TOKEN }}

- name: Use state value
  run: echo "Step is ${{ steps.get-state.outputs.value }}"
```

### Get All State Values as JSON

```yaml
- name: Get all state values
  id: get-all-state
  uses: FidelusAleksander/state-labels@v1
  with:
    operation: get-all
    issue-number: ${{ github.event.issue.number }}
    github-token: ${{ secrets.GITHUB_TOKEN }}

- name: Use state object
  run: echo "State: ${{ steps.get-all-state.outputs.state }}"
```

### Custom Label Format

```yaml
- name: Set state value with custom format
  uses: FidelusAleksander/state-labels@v1
  with:
    operation: add
    issue-number: ${{ github.event.issue.number }}
    key: environment
    value: prod
    prefix: context
    separator: __
    github-token: ${{ secrets.GITHUB_TOKEN }}
```

## Notes

- Numeric values are automatically converted to integers.
- Supports multiple state labels per issue/PR.
- Handles nested values if separator appears multiple times.
- Provides error handling and debug logging.
