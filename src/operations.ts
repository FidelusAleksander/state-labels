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
  deleteUnusedLabels: boolean
}

/**
 * Interface for operation output
 */
export interface OperationOutput {
  success: boolean
  value?: string | null
  state?: string
}

/**
 * Check if a label is used by any other issues or pull requests in the repository
 * @param context - Operation context
 * @param labelName - Name of the label to check
 * @returns True if the label is used by other issues/PRs, false otherwise
 */
async function isLabelUsedByOthers(
  context: OperationContext,
  labelName: string
): Promise<boolean> {
  try {
    // Search for issues with this label, excluding the current issue
    // We only need to check if there's at least one other issue, so we can stop early
    let page = 1
    const perPage = 100

    while (true) {
      const { data: issues } = await context.octokit.rest.issues.listForRepo({
        owner: context.owner,
        repo: context.repo,
        labels: labelName,
        state: 'all',
        per_page: perPage,
        page
      })

      // Filter out the current issue/PR
      const otherIssues = issues.filter(
        (issue) => issue.number !== context.issueNumber
      )

      // If we found any other issues with this label, return true
      if (otherIssues.length > 0) {
        return true
      }

      // If we got fewer results than requested, we've reached the end
      if (issues.length < perPage) {
        break
      }

      page++
    }

    return false
  } catch (error) {
    // If there's an error checking, assume the label is used to be safe
    core.warning(
      `Failed to check if label '${labelName}' is used by other issues: ${error instanceof Error ? error.message : 'Unknown error'}`
    )
    return true
  }
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
      value: null
    }
  }

  return {
    success: true,
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

  // If there was an existing label and delete-unused-labels is enabled,
  // attempt to delete it from the repository if not used elsewhere
  if (existingLabel && context.deleteUnusedLabels) {
    const isUsed = await isLabelUsedByOthers(context, existingLabel.name)

    if (!isUsed) {
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
    } else {
      core.info(
        `Skipping deletion of label '${existingLabel.name}' as it is used by other issues/PRs`
      )
    }
  }

  return {
    success: true
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
      success: false
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

  // If delete-unused-labels is enabled, attempt to delete the label from the repository
  // only if not used by other issues/PRs
  if (context.deleteUnusedLabels) {
    const isUsed = await isLabelUsedByOthers(context, labelToRemove.name)

    if (!isUsed) {
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
    } else {
      core.info(
        `Skipping deletion of label '${labelToRemove.name}' as it is used by other issues/PRs`
      )
    }
  }

  return {
    success: true
  }
}
