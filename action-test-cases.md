# State Labels Manager Action: Unit Test Cases

This document outlines all test cases to be covered when developing unit tests
for the State Labels Manager GitHub Action. Test cases are grouped by feature
and edge case category.

---

## 1. Label Parsing and Format

- Should correctly parse labels with default prefix and separator (e.g.,
  `state::key::value`).
- Should support custom prefix and separator (e.g., `context__key__value`).
- Should handle labels with extra separators (e.g.,
  `state::nested::key::value`).
- Should ignore labels not matching the prefix or separator.
- Should handle empty or malformed labels gracefully.

---

## 2. Add/Modify State Value

- Should add a new state label if key does not exist.
- Should modify an existing state label if key exists.
- Should handle numeric values and convert them to integers.
- Should handle string values with spaces or special characters.
- Should not duplicate labels for the same key.
- Should support custom prefix and separator when adding/modifying.

---

## 3. Remove State Key/Value

- Should remove a state label for a given key.
- Should do nothing if the key does not exist.
- Should handle removal when multiple state labels are present.
- Should support custom prefix and separator when removing.

---

## 4. Get (Read) State Value

- Should return the correct value for a given key.
- Should return `null` or appropriate error if key does not exist.
- Should handle numeric and string values.
- Should support custom prefix and separator when reading.

---

## 5. Get All State Values (as JSON)

- Should return all state labels as a valid JSON object.
- Should handle multiple state labels with different keys.
- Should handle no state labels (return empty object).
- Should support custom prefix and separator when extracting all.

---

## 6. Label Operations on Issues and PRs

- Should operate correctly on both issues and pull requests.
- Should handle invalid or missing issue/PR numbers.
- Should handle API errors (e.g., authentication, permissions).

---

## 7. Error Handling and Edge Cases

- Should provide meaningful error messages for invalid operations.
- Should handle missing required inputs (e.g., operation, key, value).
- Should handle invalid operation types.
- Should handle GitHub API failures (rate limits, network errors).
- Should log debug information when enabled.

---

## 8. Integration and Output

- Should set correct outputs for each operation (`state`, `value`, `success`,
  `message`).
- Should output valid JSON for `get-all` operation.
- Should output correct value for `get` operation.
- Should indicate success/failure for add, modify, remove operations.

---

## 9. Miscellaneous

- Should handle labels with unicode or special characters in key/value.
- Should handle large numbers of labels efficiently.
- Should not affect unrelated labels on the issue/PR.

---

Each test case should be implemented for both happy path and failure scenarios,
with clear assertions and mock GitHub API responses where needed.
