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
const mockListForRepo = jest.fn<
  () => Promise<{
    data: Array<{ number: number; labels: typeof mockLabels }>
  }>
>()

// Set default mock implementations
mockListLabelsOnIssue.mockResolvedValue({ data: mockLabels })
mockSetLabels.mockResolvedValue({ data: mockLabels })
mockAddLabels.mockResolvedValue({ data: mockLabels })
mockRemoveLabel.mockResolvedValue({ data: mockLabels })
mockDeleteLabel.mockResolvedValue()
mockListForRepo.mockResolvedValue({ data: [] })

// Mock Octokit instance
export const mockOctokit = {
  rest: {
    issues: {
      listLabelsOnIssue: mockListLabelsOnIssue,
      setLabels: mockSetLabels,
      addLabels: mockAddLabels,
      removeLabel: mockRemoveLabel,
      deleteLabel: mockDeleteLabel,
      listForRepo: mockListForRepo
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
  payload: {
    issue: {
      number: 123
    }
  }
} as typeof github.context

// Helper to set up context for different event types
export function mockContextForIssue(issueNumber: number) {
  context.payload = {
    issue: {
      number: issueNumber
    }
  }
}

export function mockContextForPR(prNumber: number) {
  context.payload = {
    pull_request: {
      number: prNumber
    }
  }
}

export function mockContextForOtherEvent() {
  context.payload = {}
}
