/**
 * Unit tests for operation functions
 */
import { jest } from '@jest/globals'
import type { OperationContext } from '../src/operations.js'
import * as core from '../__fixtures__/core.js'
import * as github from '../__fixtures__/github.js'
import type { getOctokit } from '@actions/github'

// Mocks should be declared before the module being tested is imported.
jest.unstable_mockModule('@actions/core', () => core)
jest.unstable_mockModule('@actions/github', () => github)

const { getOperation, getAllOperation, setOperation, removeOperation } =
  await import('../src/operations.js')

describe('Operations', () => {
  const mockContext: OperationContext = {
    octokit: github.mockOctokit as unknown as ReturnType<typeof getOctokit>,
    owner: 'test-owner',
    repo: 'test-repo',
    issueNumber: 123,
    prefix: 'state',
    separator: '::',
    deleteUnusedLabels: false
  }

  beforeEach(() => {
    jest.resetAllMocks()

    // Reset GitHub mock to default state
    github.mockOctokit.rest.issues.listLabelsOnIssue.mockResolvedValue({
      data: github.mockLabels
    })
    github.mockOctokit.rest.issues.setLabels.mockResolvedValue({
      data: github.mockLabels
    })
    github.mockOctokit.rest.issues.deleteLabel.mockResolvedValue()
  })

  afterEach(() => {
    jest.resetAllMocks()
  })

  describe('getOperation', () => {
    it('should get existing state value', async () => {
      const result = await getOperation(mockContext, 'step', github.mockLabels)

      expect(result).toEqual({ success: true, value: '1' })
    })

    it('should handle non-existent key', async () => {
      const result = await getOperation(
        mockContext,
        'non-existent',
        github.mockLabels
      )

      expect(result).toEqual({ success: false, value: null })
    })

    it('should work with custom prefix and separator', async () => {
      const customContext = {
        ...mockContext,
        prefix: 'context',
        separator: '__'
      }
      const customLabels = [
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

      const result = await getOperation(customContext, 'env', customLabels)

      expect(result).toEqual({ success: true, value: 'prod' })
    })
  })

  describe('getAllOperation', () => {
    it('should get all state values', async () => {
      const result = await getAllOperation(mockContext, github.mockLabels)

      expect(result).toEqual({
        success: true,
        state: JSON.stringify({
          step: '1',
          status: 'pending'
        })
      })
    })

    it('should return empty state when no state labels exist', async () => {
      const labelsWithoutState = [
        {
          id: 1,
          name: 'bug',
          color: 'f29513',
          description: '',
          default: true
        }
      ]

      const result = await getAllOperation(mockContext, labelsWithoutState)

      expect(result).toEqual({ success: true, state: JSON.stringify({}) })
    })
  })

  describe('setOperation', () => {
    it('should set new state value', async () => {
      const labelsWithoutPriority = [
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

      const result = await setOperation(
        mockContext,
        'priority',
        'high',
        labelsWithoutPriority
      )

      expect(github.mockOctokit.rest.issues.setLabels).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        issue_number: 123,
        labels: ['bug', 'state::status::pending', 'state::priority::high']
      })
      expect(result).toEqual({ success: true })
      expect(github.mockOctokit.rest.issues.deleteLabel).not.toHaveBeenCalled()
    })

    it('should update existing state value', async () => {
      const result = await setOperation(
        mockContext,
        'step',
        '2',
        github.mockLabels
      )

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
      expect(result).toEqual({ success: true })
    })

    it('should handle numeric values correctly', async () => {
      const result = await setOperation(
        mockContext,
        'count',
        '42',
        github.mockLabels
      )

      expect(github.mockOctokit.rest.issues.setLabels).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        issue_number: 123,
        labels: expect.arrayContaining(['state::count::42'])
      })
      expect(result).toEqual({ success: true })
    })

    it('should handle string values with spaces', async () => {
      const result = await setOperation(
        mockContext,
        'description',
        'work in progress',
        github.mockLabels
      )

      expect(github.mockOctokit.rest.issues.setLabels).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        issue_number: 123,
        labels: expect.arrayContaining(['state::description::work in progress'])
      })
      expect(result).toEqual({ success: true })
    })

    it('should handle label deletion failure gracefully when deleteUnusedLabels is true', async () => {
      const contextWithDelete = {
        ...mockContext,
        deleteUnusedLabels: true
      }
      github.mockOctokit.rest.issues.listForRepo.mockResolvedValue({
        data: []
      })
      github.mockOctokit.rest.issues.deleteLabel.mockRejectedValue(
        new Error('Label deletion failed')
      )

      const result = await setOperation(
        contextWithDelete,
        'step',
        '2',
        github.mockLabels
      )

      expect(core.warning).toHaveBeenCalledWith(
        "Failed to delete old label 'state::step::1' from repository: Label deletion failed"
      )
      expect(result).toEqual({ success: true })
    })

    it('should work with custom format', async () => {
      const customContext = {
        ...mockContext,
        prefix: 'context',
        separator: '__'
      }
      const customLabels = [
        {
          id: 1,
          name: 'bug',
          color: 'f29513',
          description: '',
          default: true
        }
      ]

      const result = await setOperation(
        customContext,
        'env',
        'staging',
        customLabels
      )

      expect(github.mockOctokit.rest.issues.setLabels).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        issue_number: 123,
        labels: expect.arrayContaining(['context__env__staging'])
      })
      expect(result).toEqual({ success: true })
    })

    it('should not delete old label when deleteUnusedLabels is false', async () => {
      const result = await setOperation(
        mockContext,
        'step',
        '2',
        github.mockLabels
      )

      expect(github.mockOctokit.rest.issues.deleteLabel).not.toHaveBeenCalled()
      expect(github.mockOctokit.rest.issues.listForRepo).not.toHaveBeenCalled()
      expect(result).toEqual({ success: true })
    })

    it('should delete old label when deleteUnusedLabels is true and not used by others', async () => {
      const contextWithDelete = {
        ...mockContext,
        deleteUnusedLabels: true
      }
      github.mockOctokit.rest.issues.listForRepo.mockResolvedValue({
        data: []
      })

      const result = await setOperation(
        contextWithDelete,
        'step',
        '2',
        github.mockLabels
      )

      expect(github.mockOctokit.rest.issues.listForRepo).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        labels: 'state::step::1',
        state: 'all',
        per_page: 100,
        page: 1
      })
      expect(github.mockOctokit.rest.issues.deleteLabel).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        name: 'state::step::1'
      })
      expect(result).toEqual({ success: true })
    })

    it('should not delete old label when deleteUnusedLabels is true but label is used by others', async () => {
      const contextWithDelete = {
        ...mockContext,
        deleteUnusedLabels: true
      }
      github.mockOctokit.rest.issues.listForRepo.mockResolvedValue({
        data: [{ number: 456, labels: github.mockLabels }]
      })

      const result = await setOperation(
        contextWithDelete,
        'step',
        '2',
        github.mockLabels
      )

      expect(github.mockOctokit.rest.issues.listForRepo).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        labels: 'state::step::1',
        state: 'all',
        per_page: 100,
        page: 1
      })
      expect(github.mockOctokit.rest.issues.deleteLabel).not.toHaveBeenCalled()
      expect(core.info).toHaveBeenCalledWith(
        "Skipping deletion of label 'state::step::1' as it is used by other issues/PRs"
      )
      expect(result).toEqual({ success: true })
    })

    it('should handle listForRepo failure gracefully', async () => {
      const contextWithDelete = {
        ...mockContext,
        deleteUnusedLabels: true
      }
      github.mockOctokit.rest.issues.listForRepo.mockRejectedValue(
        new Error('API error')
      )

      const result = await setOperation(
        contextWithDelete,
        'step',
        '2',
        github.mockLabels
      )

      expect(core.warning).toHaveBeenCalledWith(
        expect.stringContaining(
          "Failed to check if label 'state::step::1' is used by other issues"
        )
      )
      expect(github.mockOctokit.rest.issues.deleteLabel).not.toHaveBeenCalled()
      expect(result).toEqual({ success: true })
    })
  })

  describe('removeOperation', () => {
    it('should remove existing state key but not delete from repo when deleteUnusedLabels is false', async () => {
      const result = await removeOperation(
        mockContext,
        'step',
        github.mockLabels
      )

      expect(github.mockOctokit.rest.issues.setLabels).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        issue_number: 123,
        labels: ['bug', 'state::status::pending', 'enhancement']
      })
      expect(github.mockOctokit.rest.issues.deleteLabel).not.toHaveBeenCalled()
      expect(github.mockOctokit.rest.issues.listForRepo).not.toHaveBeenCalled()
      expect(result).toEqual({
        success: true
      })
    })

    it('should handle removal of non-existent key', async () => {
      const result = await removeOperation(
        mockContext,
        'non-existent',
        github.mockLabels
      )

      expect(github.mockOctokit.rest.issues.setLabels).not.toHaveBeenCalled()
      expect(github.mockOctokit.rest.issues.deleteLabel).not.toHaveBeenCalled()
      expect(result).toEqual({ success: false })
    })

    it('should delete label from repo when deleteUnusedLabels is true and not used by others', async () => {
      const contextWithDelete = {
        ...mockContext,
        deleteUnusedLabels: true
      }
      github.mockOctokit.rest.issues.listForRepo.mockResolvedValue({
        data: []
      })

      const result = await removeOperation(
        contextWithDelete,
        'step',
        github.mockLabels
      )

      expect(github.mockOctokit.rest.issues.setLabels).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        issue_number: 123,
        labels: ['bug', 'state::status::pending', 'enhancement']
      })
      expect(github.mockOctokit.rest.issues.listForRepo).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        labels: 'state::step::1',
        state: 'all',
        per_page: 100,
        page: 1
      })
      expect(github.mockOctokit.rest.issues.deleteLabel).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        name: 'state::step::1'
      })
      expect(result).toEqual({ success: true })
    })

    it('should not delete label from repo when deleteUnusedLabels is true but label is used by others', async () => {
      const contextWithDelete = {
        ...mockContext,
        deleteUnusedLabels: true
      }
      github.mockOctokit.rest.issues.listForRepo.mockResolvedValue({
        data: [{ number: 456, labels: github.mockLabels }]
      })

      const result = await removeOperation(
        contextWithDelete,
        'step',
        github.mockLabels
      )

      expect(github.mockOctokit.rest.issues.setLabels).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        issue_number: 123,
        labels: ['bug', 'state::status::pending', 'enhancement']
      })
      expect(github.mockOctokit.rest.issues.listForRepo).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        labels: 'state::step::1',
        state: 'all',
        per_page: 100,
        page: 1
      })
      expect(github.mockOctokit.rest.issues.deleteLabel).not.toHaveBeenCalled()
      expect(core.info).toHaveBeenCalledWith(
        "Skipping deletion of label 'state::step::1' as it is used by other issues/PRs"
      )
      expect(result).toEqual({ success: true })
    })

    it('should handle label deletion failure gracefully', async () => {
      const contextWithDelete = {
        ...mockContext,
        deleteUnusedLabels: true
      }
      github.mockOctokit.rest.issues.listForRepo.mockResolvedValue({
        data: []
      })
      github.mockOctokit.rest.issues.deleteLabel.mockRejectedValue(
        new Error('Label deletion failed')
      )

      const result = await removeOperation(
        contextWithDelete,
        'step',
        github.mockLabels
      )

      expect(core.warning).toHaveBeenCalledWith(
        "Failed to delete label 'state::step::1' from repository: Label deletion failed"
      )
      expect(result).toEqual({ success: true })
    })
  })
})
