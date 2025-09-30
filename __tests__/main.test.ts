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
  // Mock environment
  const originalEnv = process.env

  beforeEach(() => {
    // Reset all mock functions
    jest.resetAllMocks()

    // Set default environment
    process.env = {
      ...originalEnv,
      GITHUB_REPOSITORY: 'test-owner/test-repo'
    }

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
    process.env = originalEnv
    jest.resetAllMocks()
  })

  describe('Input Validation', () => {
    it('should fail with invalid operation', async () => {
      core.getInput.mockImplementation((name: string) => {
        switch (name) {
          case 'operation':
            return 'invalid-operation'
          case 'issue-number':
            return '123'
          case 'github-token':
            return 'fake-token'
          default:
            return ''
        }
      })

      await run()

      expect(core.setFailed).toHaveBeenCalledWith(
        'Invalid operation: invalid-operation. Must be: add, modify, remove, get, get-all'
      )
    })

    it('should fail with missing key for operations that require it', async () => {
      core.getInput.mockImplementation((name: string) => {
        switch (name) {
          case 'operation':
            return 'get'
          case 'issue-number':
            return '123'
          case 'github-token':
            return 'fake-token'
          case 'key':
            return ''
          default:
            return ''
        }
      })

      await run()

      expect(core.setFailed).toHaveBeenCalledWith(
        'Key is required for operation: get'
      )
    })

    it('should fail with missing value for add/modify operations', async () => {
      core.getInput.mockImplementation((name: string) => {
        switch (name) {
          case 'operation':
            return 'add'
          case 'issue-number':
            return '123'
          case 'github-token':
            return 'fake-token'
          case 'key':
            return 'test-key'
          case 'value':
            return ''
          default:
            return ''
        }
      })

      await run()

      expect(core.setFailed).toHaveBeenCalledWith(
        'Value is required for operation: add'
      )
    })

    it('should fail with invalid issue number', async () => {
      core.getInput.mockImplementation((name: string) => {
        switch (name) {
          case 'operation':
            return 'get'
          case 'issue-number':
            return 'not-a-number'
          case 'github-token':
            return 'fake-token'
          case 'key':
            return 'test-key'
          default:
            return ''
        }
      })

      await run()

      expect(core.setFailed).toHaveBeenCalledWith('Invalid issue number')
    })

    it('should fail with invalid repository format', async () => {
      core.getInput.mockImplementation((name: string) => {
        switch (name) {
          case 'operation':
            return 'get'
          case 'issue-number':
            return '123'
          case 'github-token':
            return 'fake-token'
          case 'key':
            return 'test-key'
          case 'repository':
            return 'invalid-repo-format'
          default:
            return ''
        }
      })

      await run()

      expect(core.setFailed).toHaveBeenCalledWith(
        'Invalid repository format. Expected: owner/repo'
      )
    })
  })

  describe('Get Operations', () => {
    it('should get existing state value', async () => {
      core.getInput.mockImplementation((name: string) => {
        switch (name) {
          case 'operation':
            return 'get'
          case 'issue-number':
            return '123'
          case 'github-token':
            return 'fake-token'
          case 'key':
            return 'step'
          case 'prefix':
            return 'state'
          case 'separator':
            return '::'
          default:
            return ''
        }
      })

      await run()

      expect(core.setOutput).toHaveBeenCalledWith('value', '1')
      expect(core.setOutput).toHaveBeenCalledWith('success', true)
      expect(core.setOutput).toHaveBeenCalledWith(
        'message',
        "Retrieved value for key 'step'"
      )
    })

    it('should handle non-existent key', async () => {
      core.getInput.mockImplementation((name: string) => {
        switch (name) {
          case 'operation':
            return 'get'
          case 'issue-number':
            return '123'
          case 'github-token':
            return 'fake-token'
          case 'key':
            return 'non-existent'
          case 'prefix':
            return 'state'
          case 'separator':
            return '::'
          default:
            return ''
        }
      })

      await run()

      expect(core.setOutput).toHaveBeenCalledWith('value', null)
      expect(core.setOutput).toHaveBeenCalledWith('success', false)
      expect(core.setOutput).toHaveBeenCalledWith(
        'message',
        "Key 'non-existent' not found"
      )
    })

    it('should get all state values as JSON', async () => {
      core.getInput.mockImplementation((name: string) => {
        switch (name) {
          case 'operation':
            return 'get-all'
          case 'issue-number':
            return '123'
          case 'github-token':
            return 'fake-token'
          case 'prefix':
            return 'state'
          case 'separator':
            return '::'
          default:
            return ''
        }
      })

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

  describe('Add/Modify Operations', () => {
    it('should add new state value', async () => {
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

      core.getInput.mockImplementation((name: string) => {
        switch (name) {
          case 'operation':
            return 'add'
          case 'issue-number':
            return '123'
          case 'github-token':
            return 'fake-token'
          case 'key':
            return 'priority'
          case 'value':
            return 'high'
          case 'prefix':
            return 'state'
          case 'separator':
            return '::'
          default:
            return ''
        }
      })

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
        'Added state: priority=high'
      )
    })

    it('should modify existing state value', async () => {
      core.getInput.mockImplementation((name: string) => {
        switch (name) {
          case 'operation':
            return 'modify'
          case 'issue-number':
            return '123'
          case 'github-token':
            return 'fake-token'
          case 'key':
            return 'step'
          case 'value':
            return '2'
          case 'prefix':
            return 'state'
          case 'separator':
            return '::'
          default:
            return ''
        }
      })

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
        'Modified state: step=2'
      )
    })

    it('should handle numeric values correctly', async () => {
      core.getInput.mockImplementation((name: string) => {
        switch (name) {
          case 'operation':
            return 'add'
          case 'issue-number':
            return '123'
          case 'github-token':
            return 'fake-token'
          case 'key':
            return 'count'
          case 'value':
            return '42'
          case 'prefix':
            return 'state'
          case 'separator':
            return '::'
          default:
            return ''
        }
      })

      await run()

      expect(github.mockOctokit.rest.issues.setLabels).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        issue_number: 123,
        labels: expect.arrayContaining(['state::count::42'])
      })
    })

    it('should handle string values with spaces', async () => {
      core.getInput.mockImplementation((name: string) => {
        switch (name) {
          case 'operation':
            return 'add'
          case 'issue-number':
            return '123'
          case 'github-token':
            return 'fake-token'
          case 'key':
            return 'description'
          case 'value':
            return 'work in progress'
          case 'prefix':
            return 'state'
          case 'separator':
            return '::'
          default:
            return ''
        }
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
      core.getInput.mockImplementation((name: string) => {
        switch (name) {
          case 'operation':
            return 'remove'
          case 'issue-number':
            return '123'
          case 'github-token':
            return 'fake-token'
          case 'key':
            return 'step'
          case 'prefix':
            return 'state'
          case 'separator':
            return '::'
          default:
            return ''
        }
      })

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
      core.getInput.mockImplementation((name: string) => {
        switch (name) {
          case 'operation':
            return 'remove'
          case 'issue-number':
            return '123'
          case 'github-token':
            return 'fake-token'
          case 'key':
            return 'non-existent'
          case 'prefix':
            return 'state'
          case 'separator':
            return '::'
          default:
            return ''
        }
      })

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

      core.getInput.mockImplementation((name: string) => {
        switch (name) {
          case 'operation':
            return 'get'
          case 'issue-number':
            return '123'
          case 'github-token':
            return 'fake-token'
          case 'key':
            return 'env'
          case 'prefix':
            return 'context'
          case 'separator':
            return '__'
          default:
            return ''
        }
      })

      await run()

      expect(core.setOutput).toHaveBeenCalledWith('value', 'prod')
      expect(core.setOutput).toHaveBeenCalledWith('success', true)
    })

    it('should add state with custom format', async () => {
      core.getInput.mockImplementation((name: string) => {
        switch (name) {
          case 'operation':
            return 'add'
          case 'issue-number':
            return '123'
          case 'github-token':
            return 'fake-token'
          case 'key':
            return 'env'
          case 'value':
            return 'staging'
          case 'prefix':
            return 'context'
          case 'separator':
            return '__'
          default:
            return ''
        }
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

      core.getInput.mockImplementation((name: string) => {
        switch (name) {
          case 'operation':
            return 'get'
          case 'issue-number':
            return '123'
          case 'github-token':
            return 'fake-token'
          case 'key':
            return 'url'
          case 'prefix':
            return 'state'
          case 'separator':
            return '::'
          default:
            return ''
        }
      })

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

      core.getInput.mockImplementation((name: string) => {
        switch (name) {
          case 'operation':
            return 'get-all'
          case 'issue-number':
            return '123'
          case 'github-token':
            return 'fake-token'
          case 'prefix':
            return 'state'
          case 'separator':
            return '::'
          default:
            return ''
        }
      })

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

      core.getInput.mockImplementation((name: string) => {
        switch (name) {
          case 'operation':
            return 'get-all'
          case 'issue-number':
            return '123'
          case 'github-token':
            return 'fake-token'
          case 'prefix':
            return 'state'
          case 'separator':
            return '::'
          default:
            return ''
        }
      })

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

      core.getInput.mockImplementation((name: string) => {
        switch (name) {
          case 'operation':
            return 'get'
          case 'issue-number':
            return '123'
          case 'github-token':
            return 'fake-token'
          case 'key':
            return 'test'
          default:
            return ''
        }
      })

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

      core.getInput.mockImplementation((name: string) => {
        switch (name) {
          case 'operation':
            return 'add'
          case 'issue-number':
            return '123'
          case 'github-token':
            return 'fake-token'
          case 'key':
            return 'test'
          case 'value':
            return 'value'
          default:
            return ''
        }
      })

      await run()

      expect(core.setFailed).toHaveBeenCalledWith('Network Error')
      expect(core.setOutput).toHaveBeenCalledWith('success', false)
      expect(core.setOutput).toHaveBeenCalledWith('message', 'Network Error')
    })
  })

  describe('Environment Variables', () => {
    it('should use GITHUB_REPOSITORY when repository input is not provided', async () => {
      core.getInput.mockImplementation((name: string) => {
        switch (name) {
          case 'operation':
            return 'get-all'
          case 'issue-number':
            return '123'
          case 'github-token':
            return 'fake-token'
          case 'repository':
            return '' // Empty repository input
          default:
            return ''
        }
      })

      await run()

      expect(
        github.mockOctokit.rest.issues.listLabelsOnIssue
      ).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        issue_number: 123
      })
    })
  })
})
