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

describe('State Labels Manager Action', () => {
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

    // Re-setup the getOctokit mock after resetAllMocks
    github.getOctokit.mockReturnValue(github.mockOctokit)
  })

  afterEach(() => {
    jest.resetAllMocks()
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

    it('should fail with invalid issue number', async () => {
      mockInputs({ 'issue-number': 'not-a-number' })

      await run()

      expect(core.setFailed).toHaveBeenCalledWith('Invalid issue number')
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
      expect(core.setOutput).toHaveBeenCalledWith(
        'message',
        "Retrieved value for key 'step'"
      )
    })

    it('should handle non-existent key', async () => {
      mockInputs({ operation: 'get', key: 'non-existent' })

      await run()

      expect(core.setOutput).toHaveBeenCalledWith('value', null)
      expect(core.setOutput).toHaveBeenCalledWith('success', false)
      expect(core.setOutput).toHaveBeenCalledWith(
        'message',
        "Key 'non-existent' not found"
      )
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
      expect(core.setOutput).toHaveBeenCalledWith(
        'message',
        'Retrieved 2 state values'
      )
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
      expect(core.setOutput).toHaveBeenCalledWith(
        'message',
        'Set state: priority=high'
      )
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
      expect(core.setOutput).toHaveBeenCalledWith('success', true)
      expect(core.setOutput).toHaveBeenCalledWith(
        'message',
        'Set state: step=2'
      )
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
      expect(core.setOutput).toHaveBeenCalledWith('success', true)
      expect(core.setOutput).toHaveBeenCalledWith(
        'message',
        'Removed state key: step'
      )
    })

    it('should handle removal of non-existent key', async () => {
      mockInputs({ operation: 'remove', key: 'non-existent' })

      await run()

      expect(github.mockOctokit.rest.issues.setLabels).not.toHaveBeenCalled()
      expect(core.setOutput).toHaveBeenCalledWith('success', false)
      expect(core.setOutput).toHaveBeenCalledWith(
        'message',
        "Key 'non-existent' not found"
      )
    })
  })

  describe('Custom Prefix and Separator', () => {
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

  describe('Label Parsing Edge Cases', () => {
    it('should handle labels with extra separators in values', async () => {
      github.mockOctokit.rest.issues.listLabelsOnIssue.mockResolvedValue({
        data: [
          {
            id: 1,
            name: 'state::url::https://example.com/path',
            color: 'a2eeef',
            description: '',
            default: false
          }
        ]
      })

      mockInputs({ operation: 'get', key: 'url' })

      await run()

      expect(core.setOutput).toHaveBeenCalledWith(
        'value',
        'https://example.com/path'
      )
      expect(core.setOutput).toHaveBeenCalledWith('success', true)
    })

    it('should ignore labels not matching prefix', async () => {
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
            name: 'other::key::value',
            color: 'a2eeef',
            description: '',
            default: false
          },
          {
            id: 3,
            name: 'state::valid::key',
            color: 'fbca04',
            description: '',
            default: false
          }
        ]
      })

      mockInputs({ operation: 'get-all' })

      await run()

      expect(core.setOutput).toHaveBeenCalledWith(
        'state',
        JSON.stringify({
          valid: 'key'
        })
      )
    })

    it('should handle malformed labels gracefully', async () => {
      github.mockOctokit.rest.issues.listLabelsOnIssue.mockResolvedValue({
        data: [
          {
            id: 1,
            name: 'state::',
            color: 'f29513',
            description: '',
            default: true
          },
          {
            id: 2,
            name: 'state::key',
            color: 'a2eeef',
            description: '',
            default: false
          },
          {
            id: 3,
            name: 'state::valid::value',
            color: 'fbca04',
            description: '',
            default: false
          }
        ]
      })

      mockInputs({ operation: 'get-all' })

      await run()

      expect(core.setOutput).toHaveBeenCalledWith(
        'state',
        JSON.stringify({
          valid: 'value'
        })
      )
    })
  })

  describe('GitHub API Error Handling', () => {
    it('should handle API errors gracefully', async () => {
      github.mockOctokit.rest.issues.listLabelsOnIssue.mockRejectedValue(
        new Error('API Error: Not Found')
      )

      mockInputs({ operation: 'get', key: 'test' })

      await run()

      expect(core.setFailed).toHaveBeenCalledWith('API Error: Not Found')
      expect(core.setOutput).toHaveBeenCalledWith('success', false)
      expect(core.setOutput).toHaveBeenCalledWith(
        'message',
        'API Error: Not Found'
      )
    })

    it('should handle network errors', async () => {
      github.mockOctokit.rest.issues.setLabels.mockRejectedValue(
        new Error('Network Error')
      )

      mockInputs({ operation: 'set', key: 'test', value: 'value' })

      await run()

      expect(core.setFailed).toHaveBeenCalledWith('Network Error')
      expect(core.setOutput).toHaveBeenCalledWith('success', false)
      expect(core.setOutput).toHaveBeenCalledWith('message', 'Network Error')
    })
  })
})
