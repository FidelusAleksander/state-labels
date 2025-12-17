/**
 * Unit tests for the action's main functionality, src/main.ts
 */
import { jest } from '@jest/globals'
import * as core from '../__fixtures__/core.js'
import * as github from '../__fixtures__/github.js'

// Mocks should be declared before the module being tested is imported.
jest.unstable_mockModule('@actions/core', () => core)
jest.unstable_mockModule('@actions/github', () => github)

// The module being tested should be imported dynamically. This ensures that the
// mocks are used in place of any actual dependencies.
const { run } = await import('../src/main.js')

describe('Main Action Orchestration', () => {
  // Default input values that can be overridden in tests
  const defaultInputs: Record<string, string> = {
    operation: 'get',
    key: 'test-key',
    value: 'test-value',
    prefix: 'state',
    separator: '::',
    repository: 'test-owner/test-repo',
    'github-token': 'fake-token',
    'issue-number': '123'
  }

  // Helper function to setup inputs for a test
  function mockInputs(overrides: Record<string, string> = {}) {
    const inputs = { ...defaultInputs, ...overrides }
    core.getInput.mockImplementation((name: string) => inputs[name])
    core.getBooleanInput.mockImplementation(
      (name: string) => inputs[name] === 'true'
    )
  }

  beforeEach(() => {
    // Reset all mock functions
    jest.resetAllMocks()

    // Set up default mock inputs
    mockInputs()

    // Reset GitHub mock to default state
    github.mockOctokit.rest.issues.listLabelsOnIssue.mockResolvedValue({
      data: github.mockLabels
    })
    github.mockOctokit.rest.issues.setLabels.mockResolvedValue({
      data: github.mockLabels
    })
    github.mockOctokit.rest.issues.deleteLabel.mockResolvedValue()

    // Re-setup the getOctokit mock after resetAllMocks
    github.getOctokit.mockReturnValue(github.mockOctokit)
  })

  afterEach(() => {
    jest.resetAllMocks()
  })

  describe('Issue Number Resolution', () => {
    it('should use explicit issue number input when provided', async () => {
      mockInputs({ operation: 'get', key: 'test', 'issue-number': '456' })
      github.mockContextForIssue(123) // Different from input

      await run()

      expect(
        github.mockOctokit.rest.issues.listLabelsOnIssue
      ).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        issue_number: 456 // Should use input, not context
      })
    })

    it('should auto-detect issue number from issue context when input not provided', async () => {
      mockInputs({ operation: 'get', key: 'test', 'issue-number': '' })
      github.mockContextForIssue(789)

      await run()

      expect(
        github.mockOctokit.rest.issues.listLabelsOnIssue
      ).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        issue_number: 789
      })
    })

    it('should auto-detect PR number from pull request context when input not provided', async () => {
      mockInputs({ operation: 'get', key: 'test', 'issue-number': '' })
      github.mockContextForPR(555)

      await run()

      expect(
        github.mockOctokit.rest.issues.listLabelsOnIssue
      ).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        issue_number: 555
      })
    })

    it('should fail when no issue number provided and no context available', async () => {
      mockInputs({ operation: 'get', key: 'test', 'issue-number': '' })
      github.mockContextForOtherEvent()

      await run()

      expect(core.setFailed).toHaveBeenCalledWith(
        'No issue or PR number provided as input and none available from GitHub context. ' +
          'Either provide issue-number as input or run on issue/pull_request events.'
      )
    })

    it('should fail with invalid issue number input', async () => {
      mockInputs({
        operation: 'get',
        key: 'test',
        'issue-number': 'not-a-number'
      })

      await run()

      expect(core.setFailed).toHaveBeenCalledWith(
        'Invalid issue number provided in input'
      )
    })
  })

  describe('Input Validation', () => {
    it('should fail with invalid operation', async () => {
      mockInputs({ operation: 'invalid-operation' })

      await run()

      expect(core.setFailed).toHaveBeenCalledWith(
        'Invalid operation: invalid-operation. Must be: set, remove, get, get-all'
      )
    })

    it('should fail with missing key for operations that require it', async () => {
      mockInputs({ operation: 'get', key: '' })

      await run()

      expect(core.setFailed).toHaveBeenCalledWith(
        'Key is required for operation: get'
      )
    })

    it('should fail with missing value for set operations', async () => {
      mockInputs({ operation: 'set', value: '' })

      await run()

      expect(core.setFailed).toHaveBeenCalledWith(
        'Value is required for operation: set'
      )
    })

    it('should fail with invalid repository format', async () => {
      mockInputs({ repository: 'invalid-repo-format' })

      await run()

      expect(core.setFailed).toHaveBeenCalledWith(
        'Invalid repository format. Expected: owner/repo'
      )
    })
  })

  describe('Get Operations', () => {
    it('should get existing state value', async () => {
      mockInputs({ operation: 'get', key: 'step' })

      await run()

      expect(core.setOutput).toHaveBeenCalledWith('value', '1')
      expect(core.setOutput).toHaveBeenCalledWith('success', true)
    })

    it('should handle non-existent key', async () => {
      mockInputs({ operation: 'get', key: 'non-existent' })

      await run()

      expect(core.setOutput).toHaveBeenCalledWith('value', null)
      expect(core.setOutput).toHaveBeenCalledWith('success', false)
    })

    it('should get all state values as JSON', async () => {
      mockInputs({ operation: 'get-all' })

      await run()

      expect(core.setOutput).toHaveBeenCalledWith(
        'state',
        JSON.stringify({
          step: '1',
          status: 'pending'
        })
      )
      expect(core.setOutput).toHaveBeenCalledWith('success', true)
    })
  })

  describe('Set Operations', () => {
    it('should set new state value', async () => {
      // Mock labels without the state we're adding
      github.mockOctokit.rest.issues.listLabelsOnIssue.mockResolvedValue({
        data: [
          {
            id: 1,
            name: 'bug',
            color: 'f29513',
            description: '',
            default: true
          },
          {
            id: 2,
            name: 'state::status::pending',
            color: 'fbca04',
            description: '',
            default: false
          }
        ]
      })

      mockInputs({ operation: 'set', key: 'priority', value: 'high' })

      await run()

      expect(github.mockOctokit.rest.issues.setLabels).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        issue_number: 123,
        labels: ['bug', 'state::status::pending', 'state::priority::high']
      })
      expect(core.setOutput).toHaveBeenCalledWith('success', true)
    })

    it('should set existing state value (update)', async () => {
      mockInputs({ operation: 'set', key: 'step', value: '2' })

      await run()

      expect(github.mockOctokit.rest.issues.setLabels).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        issue_number: 123,
        labels: [
          'bug',
          'state::status::pending',
          'enhancement',
          'state::step::2'
        ]
      })
      expect(github.mockOctokit.rest.issues.deleteLabel).not.toHaveBeenCalled()
      expect(core.setOutput).toHaveBeenCalledWith('success', true)
    })

    it('should handle numeric values correctly', async () => {
      mockInputs({ operation: 'set', key: 'count', value: '42' })

      await run()

      expect(github.mockOctokit.rest.issues.setLabels).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        issue_number: 123,
        labels: expect.arrayContaining(['state::count::42'])
      })
    })

    it('should handle string values with spaces', async () => {
      mockInputs({
        operation: 'set',
        key: 'description',
        value: 'work in progress'
      })

      await run()

      expect(github.mockOctokit.rest.issues.setLabels).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        issue_number: 123,
        labels: expect.arrayContaining(['state::description::work in progress'])
      })
    })
  })

  describe('Remove Operations', () => {
    it('should remove existing state key', async () => {
      mockInputs({ operation: 'remove', key: 'step' })

      await run()

      expect(github.mockOctokit.rest.issues.setLabels).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        issue_number: 123,
        labels: ['bug', 'state::status::pending', 'enhancement']
      })
      expect(github.mockOctokit.rest.issues.deleteLabel).not.toHaveBeenCalled()
      expect(core.setOutput).toHaveBeenCalledWith('success', true)
    })

    it('should handle removal of non-existent key', async () => {
      mockInputs({ operation: 'remove', key: 'non-existent' })

      await run()

      expect(github.mockOctokit.rest.issues.setLabels).not.toHaveBeenCalled()
      expect(github.mockOctokit.rest.issues.deleteLabel).not.toHaveBeenCalled()
      expect(core.setOutput).toHaveBeenCalledWith('success', false)
    })
  })

  describe('Integration Tests', () => {
    it('should work with custom prefix and separator', async () => {
      // Mock labels with custom format
      github.mockOctokit.rest.issues.listLabelsOnIssue.mockResolvedValue({
        data: [
          {
            id: 1,
            name: 'bug',
            color: 'f29513',
            description: '',
            default: true
          },
          {
            id: 2,
            name: 'context__env__prod',
            color: 'a2eeef',
            description: '',
            default: false
          }
        ]
      })

      mockInputs({
        operation: 'get',
        key: 'env',
        prefix: 'context',
        separator: '__'
      })

      await run()

      expect(core.setOutput).toHaveBeenCalledWith('value', 'prod')
      expect(core.setOutput).toHaveBeenCalledWith('success', true)
    })

    it('should set state with custom format', async () => {
      mockInputs({
        operation: 'set',
        key: 'env',
        value: 'staging',
        prefix: 'context',
        separator: '__'
      })

      await run()

      expect(github.mockOctokit.rest.issues.setLabels).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        issue_number: 123,
        labels: expect.arrayContaining(['context__env__staging'])
      })
    })
  })

  describe('Error Handling', () => {
    it('should handle API errors gracefully', async () => {
      github.mockOctokit.rest.issues.listLabelsOnIssue.mockRejectedValue(
        new Error('API Error: Not Found')
      )

      mockInputs({ operation: 'get', key: 'test' })

      await run()

      expect(core.setFailed).toHaveBeenCalledWith('API Error: Not Found')
      expect(core.setOutput).toHaveBeenCalledWith('success', false)
    })

    it('should handle network errors', async () => {
      github.mockOctokit.rest.issues.setLabels.mockRejectedValue(
        new Error('Network Error')
      )

      mockInputs({ operation: 'set', key: 'test', value: 'value' })

      await run()

      expect(core.setFailed).toHaveBeenCalledWith('Network Error')
      expect(core.setOutput).toHaveBeenCalledWith('success', false)
    })
  })
})
