import * as core from '@actions/core'
import type { getOctokit } from '@actions/github'
import type { Label } from './labels.js'
import {
  parseStateLabel,
  createStateLabelName,
  extractStateLabels,
  convertValue
} from './labels.js'

/**
 * Interface for operation context
 */
export interface OperationContext {
  octokit: ReturnType<typeof getOctokit>
  owner: string
  repo: string
  issueNumber: number
  prefix: string
  separator: string
}

/**
 * Interface for operation output
 */
export interface OperationOutput {
  success: boolean
  message: string
  value?: string | null
  state?: string
}

/**
 * Get a single state value by key
 * @param context - Operation context
 * @param key - The state key to retrieve
 * @param currentLabels - Current labels on the issue
 * @returns Operation output
 */
export async function getOperation(
  context: OperationContext,
  key: string,
  currentLabels: Label[]
): Promise<OperationOutput> {
  const currentState = extractStateLabels(
    currentLabels,
    context.prefix,
    context.separator
  )

  const currentValue = currentState[key]
  if (currentValue === undefined) {
    return {
      success: false,
      message: `Key '${key}' not found`,
      value: null
    }
  }

  return {
    success: true,
    message: `Retrieved value for key '${key}'`,
    value: currentValue
  }
}

/**
 * Get all state values
 * @param context - Operation context
 * @param currentLabels - Current labels on the issue
 * @returns Operation output
 */
export async function getAllOperation(
  context: OperationContext,
  currentLabels: Label[]
): Promise<OperationOutput> {
  const currentState = extractStateLabels(
    currentLabels,
    context.prefix,
    context.separator
  )

  return {
    success: true,
    message: `Retrieved ${Object.keys(currentState).length} state values`,
    state: JSON.stringify(currentState)
  }
}

/**
 * Set a state value (create or update)
 * @param context - Operation context
 * @param key - The state key to set
 * @param value - The state value to set
 * @param currentLabels - Current labels on the issue
 * @returns Operation output
 */
export async function setOperation(
  context: OperationContext,
  key: string,
  value: string,
  currentLabels: Label[]
): Promise<OperationOutput> {
  const convertedValue = convertValue(value)
  const newLabelName = createStateLabelName(
    key,
    convertedValue,
    context.prefix,
    context.separator
  )

  // Find any existing state label for this key that needs to be replaced
  const existingLabel = currentLabels.find((label) => {
    const parsed = parseStateLabel(
      label.name,
      context.prefix,
      context.separator
    )
    return parsed && parsed.key === key
  })

  // Find and remove any existing state label for this key
  const labelsToKeep = currentLabels.filter((label) => {
    const parsed = parseStateLabel(
      label.name,
      context.prefix,
      context.separator
    )
    return !parsed || parsed.key !== key
  })

  // Add the new state label to the list
  const newLabels = [...labelsToKeep.map((l) => l.name), newLabelName]

  // Update labels
  await context.octokit.rest.issues.setLabels({
    owner: context.owner,
    repo: context.repo,
    issue_number: context.issueNumber,
    labels: newLabels
  })

  // If there was an existing label, attempt to delete it from the repository
  if (existingLabel) {
    try {
      await context.octokit.rest.issues.deleteLabel({
        owner: context.owner,
        repo: context.repo,
        name: existingLabel.name
      })
      core.info(`Deleted old label '${existingLabel.name}' from repository`)
    } catch (deleteLabelError) {
      // Log warning but don't fail the operation if label deletion fails
      if (deleteLabelError instanceof Error) {
        core.warning(
          `Failed to delete old label '${existingLabel.name}' from repository: ${deleteLabelError.message}`
        )
      } else {
        core.warning(
          `Failed to delete old label '${existingLabel.name}' from repository: Unknown error`
        )
      }
    }
  }

  return {
    success: true,
    message: `Set state: ${key}=${convertedValue}`
  }
}

/**
 * Remove a state key
 * @param context - Operation context
 * @param key - The state key to remove
 * @param currentLabels - Current labels on the issue
 * @returns Operation output
 */
export async function removeOperation(
  context: OperationContext,
  key: string,
  currentLabels: Label[]
): Promise<OperationOutput> {
  // Find the state label to be removed
  const labelToRemove = currentLabels.find((label) => {
    const parsed = parseStateLabel(
      label.name,
      context.prefix,
      context.separator
    )
    return parsed && parsed.key === key
  })

  if (!labelToRemove) {
    return {
      success: false,
      message: `Key '${key}' not found`
    }
  }

  // Filter out the label to be removed from the issue
  const labelsToKeep = currentLabels.filter((label) => {
    const parsed = parseStateLabel(
      label.name,
      context.prefix,
      context.separator
    )
    return !parsed || parsed.key !== key
  })

  // Update issue labels first
  await context.octokit.rest.issues.setLabels({
    owner: context.owner,
    repo: context.repo,
    issue_number: context.issueNumber,
    labels: labelsToKeep.map((l) => l.name)
  })

  // Then attempt to delete the label from the repository
  try {
    await context.octokit.rest.issues.deleteLabel({
      owner: context.owner,
      repo: context.repo,
      name: labelToRemove.name
    })
    core.info(`Deleted label '${labelToRemove.name}' from repository`)
  } catch (deleteLabelError) {
    // Log warning but don't fail the operation if label deletion fails
    if (deleteLabelError instanceof Error) {
      core.warning(
        `Failed to delete label '${labelToRemove.name}' from repository: ${deleteLabelError.message}`
      )
    } else {
      core.warning(
        `Failed to delete label '${labelToRemove.name}' from repository: Unknown error`
      )
    }
  }

  return {
    success: true,
    message: `Removed state key: ${key}`
  }
}
