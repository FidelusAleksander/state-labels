import * as core from '@actions/core'
import * as github from '@actions/github'
import { extractStateLabels } from './labels.js'
import {
  type OperationContext,
  type OperationOutput,
  getOperation,
  getAllOperation,
  setOperation,
  removeOperation
} from './operations.js'

/**
 * Resolves the issue number from input or GitHub context
 * @returns The issue number to operate on
 * @throws Error if no issue number can be determined
 */
function resolveIssueNumber(): number {
  const issueNumberInput = core.getInput('issue-number')

  // If provided as input, use that (validate it's a number)
  if (issueNumberInput) {
    const issueNumber = parseInt(issueNumberInput, 10)
    if (Number.isNaN(issueNumber)) {
      throw new Error('Invalid issue number provided in input')
    }
    return issueNumber
  }

  // Try to get from GitHub context
  const context = github.context

  // Check if we're in an issue event
  if (context.payload.issue?.number) {
    return context.payload.issue.number
  }

  // Check if we're in a pull request event
  if (context.payload.pull_request?.number) {
    return context.payload.pull_request.number
  }

  // No issue number available
  throw new Error(
    'No issue or PR number provided as input and none available from GitHub context. ' +
      'Either provide issue-number as input or run on issue/pull_request events.'
  )
}

/**
 * The main function for the action.
 * @returns Resolves when the action is complete.
 */
export async function run(): Promise<void> {
  try {
    // Get inputs
    const operation = core.getInput('operation', { required: true })
    const issueNumber = resolveIssueNumber()
    const githubToken = core.getInput('github-token')
    const separator = core.getInput('separator')
    const repository = core.getInput('repository')
    const prefix = core.getInput('prefix')
    const key = core.getInput('key')
    const value = core.getInput('value')
    const deleteUnusedLabels = core.getBooleanInput('delete-unused-labels')

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

    // Issue number validation is now handled in resolveIssueNumber()

    if (!githubToken) {
      throw new Error('GitHub token is required')
    }

    // Initialize Octokit
    const octokit = github.getOctokit(githubToken)

    core.info(`Performing operation: ${operation}`)
    core.info(`Issue number: ${issueNumber}`)
    core.info(`Repository: ${owner}/${repo}`)
    core.info(`Prefix: ${prefix}, Separator: ${separator}`)

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
    core.info(`Current state: ${JSON.stringify(currentState)}`)

    // Create operation context
    const operationContext: OperationContext = {
      octokit,
      owner,
      repo,
      issueNumber,
      prefix,
      separator,
      deleteUnusedLabels
    }

    // Perform the requested operation
    let result: OperationOutput | undefined
    switch (operation) {
      case 'get': {
        result = await getOperation(operationContext, key, currentLabels)
        if (result.value !== undefined) {
          core.setOutput('value', result.value)
        }
        break
      }

      case 'get-all': {
        result = await getAllOperation(operationContext, currentLabels)
        if (result.state !== undefined) {
          core.setOutput('state', result.state)
        }
        break
      }

      case 'set': {
        result = await setOperation(operationContext, key, value, currentLabels)
        break
      }

      case 'remove': {
        result = await removeOperation(operationContext, key, currentLabels)
        break
      }
    }

    // Set output
    if (result) {
      core.setOutput('success', result.success)
      // 'message' output removed; keeping success/value/state only
    }
  } catch (error) {
    // Fail the workflow run if an error occurs
    if (error instanceof Error) {
      core.setFailed(error.message)
      core.setOutput('success', false)
    } else {
      core.setFailed('An unknown error occurred')
      core.setOutput('success', false)
    }
  }
}
