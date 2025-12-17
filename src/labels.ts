/**
 * Interface for a GitHub label
 */
export interface Label {
  name: string
  color?: string
  description?: string | null
}

/**
 * Interface for parsed state from labels
 */
export interface StateLabels {
  [key: string]: string
}

/**
 * Parses a label name to extract state key and value
 * @param labelName - The full label name
 * @param prefix - The label prefix to match
 * @param separator - The separator between parts
 * @returns Object with key and value, or null if not a state label
 */
export function parseStateLabel(
  labelName: string,
  prefix: string,
  separator: string
): { key: string; value: string } | null {
  const expectedPrefix = prefix ? `${prefix}${separator}` : ''
  if (!labelName.startsWith(expectedPrefix)) {
    return null
  }

  const remainder = labelName.substring(expectedPrefix.length)
  const separatorIndex = remainder.indexOf(separator)

  if (separatorIndex === -1) {
    return null
  }

  const key = remainder.substring(0, separatorIndex)
  const value = remainder.substring(separatorIndex + separator.length)

  return { key, value }
}

/**
 * Creates a state label name from key and value
 * @param key - The state key
 * @param value - The state value
 * @param prefix - The label prefix
 * @param separator - The separator between parts
 * @returns The formatted label name
 */
export function createStateLabelName(
  key: string,
  value: string,
  prefix: string,
  separator: string
): string {
  const prefixPart = prefix ? `${prefix}${separator}` : ''
  return `${prefixPart}${key}${separator}${value}`
}

/**
 * Extracts all state labels from a list of labels
 * @param labels - Array of label objects
 * @param prefix - The label prefix to match
 * @param separator - The separator between parts
 * @returns Object containing all state key-value pairs
 */
export function extractStateLabels(
  labels: Label[],
  prefix: string,
  separator: string
): StateLabels {
  const state: StateLabels = {}

  for (const label of labels) {
    const parsed = parseStateLabel(label.name, prefix, separator)
    if (parsed) {
      state[parsed.key] = parsed.value
    }
  }

  return state
}

/**
 * Converts string values to appropriate types (numbers to integers)
 * @param value - The string value to convert
 * @returns The converted value
 */
export function convertValue(value: string): string {
  // Try to convert to integer if it's a valid number
  const num = parseInt(value, 10)
  if (!Number.isNaN(num) && num.toString() === value) {
    return num.toString()
  }
  return value
}
