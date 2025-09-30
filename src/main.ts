import * as core from '@actions/core'
import * as github from '@actions/github'

/**
 * Interface for a GitHub label
 */
interface Label {
  name: string
  color?: string
  description?: string | null
}

/**
 * Interface for parsed state from labels
 */
interface StateLabels {
  [key: string]: string
}

/**
 * Parses a label name to extract state key and value
 * @param labelName - The full label name
 * @param prefix - The label prefix to match
 * @param separator - The separator between parts
 * @returns Object with key and value, or null if not a state label
 */
function parseStateLabel(
  labelName: string,
  prefix: string,
  separator: string
): { key: string; value: string } | null {
  const expectedPrefix = `${prefix}${separator}`
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
function createStateLabelName(
  key: string,
  value: string,
  prefix: string,
  separator: string
): string {
  return `${prefix}${separator}${key}${separator}${value}`
}

/**
 * Extracts all state labels from a list of labels
 * @param labels - Array of label objects
 * @param prefix - The label prefix to match
 * @param separator - The separator between parts
 * @returns Object containing all state key-value pairs
 */
function extractStateLabels(
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
function convertValue(value: string): string {
  // Try to convert to integer if it's a valid number
  const num = parseInt(value, 10)
  if (!isNaN(num) && num.toString() === value) {
    return num.toString()
  }
  return value
}

/**
 * The main function for the action.
 * @returns Resolves when the action is complete.
 */
export async function run(): Promise<void> {
  try {
    // Get inputs
    const operation = core.getInput('operation', { required: true })
    const issueNumber = parseInt(
      core.getInput('issue-number', { required: true }),
      10
    )
    const githubToken = core.getInput('github-token')
    const separator = core.getInput('separator')
    const repository = core.getInput('repository')
    const prefix = core.getInput('prefix')
    const key = core.getInput('key')
    const value = core.getInput('value')

    // Parse repository
    const [owner, repo] = repository.split('/')
    if (!owner || !repo) {
      throw new Error('Invalid repository format. Expected: owner/repo')
    }

    // Validate inputs
    if (!['set', 'remove', 'get', 'get-all'].includes(operation)) {
      throw new Error(
        `Invalid operation: ${operation}. Must be: set, remove, get, get-all`
      )
    }

    if (['set', 'remove', 'get'].includes(operation) && !key) {
      throw new Error(`Key is required for operation: ${operation}`)
    }

    if (operation === 'set' && !value) {
      throw new Error(`Value is required for operation: ${operation}`)
    }

    if (isNaN(issueNumber)) {
      throw new Error('Invalid issue number')
    }

    if (!githubToken) {
      throw new Error('GitHub token is required')
    }

    // Initialize Octokit
    const octokit = github.getOctokit(githubToken)

    core.debug(`Performing operation: ${operation}`)
    core.debug(`Issue number: ${issueNumber}`)
    core.debug(`Repository: ${owner}/${repo}`)
    core.debug(`Prefix: ${prefix}, Separator: ${separator}`)

    // Get current labels for the issue
    const { data: currentLabels } = await octokit.rest.issues.listLabelsOnIssue(
      {
        owner,
        repo,
        issue_number: issueNumber
      }
    )

    // Extract current state
    const currentState = extractStateLabels(currentLabels, prefix, separator)
    core.debug(`Current state: ${JSON.stringify(currentState)}`)

    // Perform the requested operation
    switch (operation) {
      case 'get': {
        const currentValue = currentState[key]
        if (currentValue === undefined) {
          core.setOutput('value', null)
          core.setOutput('success', false)
          core.setOutput('message', `Key '${key}' not found`)
        } else {
          core.setOutput('value', currentValue)
          core.setOutput('success', true)
          core.setOutput('message', `Retrieved value for key '${key}'`)
        }
        break
      }

      case 'get-all': {
        core.setOutput('state', JSON.stringify(currentState))
        core.setOutput('success', true)
        core.setOutput(
          'message',
          `Retrieved ${Object.keys(currentState).length} state values`
        )
        break
      }

      case 'set': {
        const convertedValue = convertValue(value)
        const newLabelName = createStateLabelName(
          key,
          convertedValue,
          prefix,
          separator
        )

        // Find and remove any existing state label for this key
        const labelsToKeep = currentLabels.filter((label) => {
          const parsed = parseStateLabel(label.name, prefix, separator)
          return !parsed || parsed.key !== key
        })

        // Add the new state label to the list
        const newLabels = [...labelsToKeep.map((l) => l.name), newLabelName]

        // Update labels
        await octokit.rest.issues.setLabels({
          owner,
          repo,
          issue_number: issueNumber,
          labels: newLabels
        })

        core.setOutput('success', true)
        core.setOutput('message', `Set state: ${key}=${convertedValue}`)
        break
      }

      case 'remove': {
        // Find and remove the state label for this key
        const labelsToKeep = currentLabels.filter((label) => {
          const parsed = parseStateLabel(label.name, prefix, separator)
          return !parsed || parsed.key !== key
        })

        // Check if we actually found and removed a label
        const wasRemoved = labelsToKeep.length < currentLabels.length

        if (!wasRemoved) {
          core.setOutput('success', false)
          core.setOutput('message', `Key '${key}' not found`)
        } else {
          // Update labels
          await octokit.rest.issues.setLabels({
            owner,
            repo,
            issue_number: issueNumber,
            labels: labelsToKeep.map((l) => l.name)
          })

          core.setOutput('success', true)
          core.setOutput('message', `Removed state key: ${key}`)
        }
        break
      }
    }
  } catch (error) {
    // Fail the workflow run if an error occurs
    if (error instanceof Error) {
      core.setFailed(error.message)
      core.setOutput('success', false)
      core.setOutput('message', error.message)
    } else {
      core.setFailed('An unknown error occurred')
      core.setOutput('success', false)
      core.setOutput('message', 'An unknown error occurred')
    }
  }
}
