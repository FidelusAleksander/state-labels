import type * as github from '@actions/github'
import { jest } from '@jest/globals'

// Mock label objects
export const mockLabels = [
  {
    id: 1,
    name: 'bug',
    color: 'f29513',
    description: "Something isn't working",
    default: true
  },
  {
    id: 2,
    name: 'state::step::1',
    color: 'a2eeef',
    description: 'State label',
    default: false
  },
  {
    id: 3,
    name: 'state::status::pending',
    color: 'fbca04',
    description: 'State label',
    default: false
  },
  {
    id: 4,
    name: 'enhancement',
    color: '0e8a16',
    description: 'New feature or request',
    default: false
  }
]

// Mock API functions
const mockListLabelsOnIssue =
  jest.fn<() => Promise<{ data: typeof mockLabels }>>()
const mockSetLabels = jest.fn<() => Promise<{ data: typeof mockLabels }>>()
const mockAddLabels = jest.fn<() => Promise<{ data: typeof mockLabels }>>()
const mockRemoveLabel = jest.fn<() => Promise<{ data: typeof mockLabels }>>()
const mockDeleteLabel = jest.fn<() => Promise<void>>()

// Set default mock implementations
mockListLabelsOnIssue.mockResolvedValue({ data: mockLabels })
mockSetLabels.mockResolvedValue({ data: mockLabels })
mockAddLabels.mockResolvedValue({ data: mockLabels })
mockRemoveLabel.mockResolvedValue({ data: mockLabels })
mockDeleteLabel.mockResolvedValue()

// Mock Octokit instance
export const mockOctokit = {
  rest: {
    issues: {
      listLabelsOnIssue: mockListLabelsOnIssue,
      setLabels: mockSetLabels,
      addLabels: mockAddLabels,
      removeLabel: mockRemoveLabel,
      deleteLabel: mockDeleteLabel
    }
  }
}

export const getOctokit = jest.fn().mockReturnValue(mockOctokit)

export const context = {
  repo: {
    owner: 'test-owner',
    repo: 'test-repo'
  },
  issue: {
    number: 123
  },
  payload: {}
} as typeof github.context
