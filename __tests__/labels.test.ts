/**
 * Unit tests for label utility functions
 */
import {
  parseStateLabel,
  createStateLabelName,
  extractStateLabels,
  convertValue,
  type Label
} from '../src/labels.js'

describe('Label Utilities', () => {
  describe('parseStateLabel', () => {
    it('should parse a valid state label', () => {
      const result = parseStateLabel('state::key::value', 'state', '::')
      expect(result).toEqual({ key: 'key', value: 'value' })
    })

    it('should return null for non-state label', () => {
      const result = parseStateLabel('bug', 'state', '::')
      expect(result).toBeNull()
    })

    it('should return null for label with wrong prefix', () => {
      const result = parseStateLabel('other::key::value', 'state', '::')
      expect(result).toBeNull()
    })

    it('should return null for malformed state label (no second separator)', () => {
      const result = parseStateLabel('state::key', 'state', '::')
      expect(result).toBeNull()
    })

    it('should return null for malformed state label (no key)', () => {
      const result = parseStateLabel('state::', 'state', '::')
      expect(result).toBeNull()
    })

    it('should handle values with extra separators', () => {
      const result = parseStateLabel(
        'state::url::https://example.com/path',
        'state',
        '::'
      )
      expect(result).toEqual({ key: 'url', value: 'https://example.com/path' })
    })

    it('should work with custom prefix', () => {
      const result = parseStateLabel('context__env__prod', 'context', '__')
      expect(result).toEqual({ key: 'env', value: 'prod' })
    })

    it('should work with custom separator', () => {
      const result = parseStateLabel('state--key--value', 'state', '--')
      expect(result).toEqual({ key: 'key', value: 'value' })
    })

    it('should parse label with empty prefix', () => {
      const result = parseStateLabel('phase::deploy', '', '::')
      expect(result).toEqual({ key: 'phase', value: 'deploy' })
    })

    it('should parse label with empty prefix and custom separator', () => {
      const result = parseStateLabel('env__prod', '', '__')
      expect(result).toEqual({ key: 'env', value: 'prod' })
    })
  })

  describe('createStateLabelName', () => {
    it('should create a valid state label name', () => {
      const result = createStateLabelName('key', 'value', 'state', '::')
      expect(result).toBe('state::key::value')
    })

    it('should handle custom prefix', () => {
      const result = createStateLabelName('env', 'prod', 'context', '__')
      expect(result).toBe('context__env__prod')
    })

    it('should handle custom separator', () => {
      const result = createStateLabelName('key', 'value', 'state', '--')
      expect(result).toBe('state--key--value')
    })

    it('should handle values with spaces', () => {
      const result = createStateLabelName(
        'description',
        'work in progress',
        'state',
        '::'
      )
      expect(result).toBe('state::description::work in progress')
    })

    it('should handle numeric values', () => {
      const result = createStateLabelName('count', '42', 'state', '::')
      expect(result).toBe('state::count::42')
    })

    it('should handle empty prefix without adding extra separator', () => {
      const result = createStateLabelName('phase', 'deploy', '', '::')
      expect(result).toBe('phase::deploy')
    })

    it('should handle empty prefix with custom separator', () => {
      const result = createStateLabelName('env', 'prod', '', '__')
      expect(result).toBe('env__prod')
    })
  })

  describe('extractStateLabels', () => {
    it('should extract all state labels from a list', () => {
      const labels: Label[] = [
        { name: 'bug', color: 'f29513' },
        { name: 'state::step::1', color: 'a2eeef' },
        { name: 'state::status::pending', color: 'fbca04' },
        { name: 'enhancement', color: '0e8a16' }
      ]

      const result = extractStateLabels(labels, 'state', '::')
      expect(result).toEqual({
        step: '1',
        status: 'pending'
      })
    })

    it('should return empty object when no state labels exist', () => {
      const labels: Label[] = [
        { name: 'bug', color: 'f29513' },
        { name: 'enhancement', color: '0e8a16' }
      ]

      const result = extractStateLabels(labels, 'state', '::')
      expect(result).toEqual({})
    })

    it('should ignore labels with wrong prefix', () => {
      const labels: Label[] = [
        { name: 'bug', color: 'f29513' },
        { name: 'other::key::value', color: 'a2eeef' },
        { name: 'state::valid::key', color: 'fbca04' }
      ]

      const result = extractStateLabels(labels, 'state', '::')
      expect(result).toEqual({
        valid: 'key'
      })
    })

    it('should ignore malformed state labels', () => {
      const labels: Label[] = [
        { name: 'state::', color: 'f29513' },
        { name: 'state::key', color: 'a2eeef' },
        { name: 'state::valid::value', color: 'fbca04' }
      ]

      const result = extractStateLabels(labels, 'state', '::')
      expect(result).toEqual({
        valid: 'value'
      })
    })

    it('should work with custom prefix and separator', () => {
      const labels: Label[] = [
        { name: 'bug', color: 'f29513' },
        { name: 'context__env__prod', color: 'a2eeef' }
      ]

      const result = extractStateLabels(labels, 'context', '__')
      expect(result).toEqual({
        env: 'prod'
      })
    })

    it('should handle values with extra separators', () => {
      const labels: Label[] = [
        { name: 'state::url::https://example.com/path', color: 'a2eeef' }
      ]

      const result = extractStateLabels(labels, 'state', '::')
      expect(result).toEqual({
        url: 'https://example.com/path'
      })
    })
  })

  describe('convertValue', () => {
    it('should convert valid integer strings', () => {
      expect(convertValue('42')).toBe('42')
      expect(convertValue('0')).toBe('0')
      expect(convertValue('123')).toBe('123')
    })

    it('should not convert non-integer strings', () => {
      expect(convertValue('hello')).toBe('hello')
      expect(convertValue('world')).toBe('world')
    })

    it('should not convert strings with spaces', () => {
      expect(convertValue('work in progress')).toBe('work in progress')
    })

    it('should not convert decimal numbers', () => {
      expect(convertValue('42.5')).toBe('42.5')
    })

    it('should not convert strings starting with numbers', () => {
      expect(convertValue('42abc')).toBe('42abc')
    })

    it('should handle negative numbers', () => {
      expect(convertValue('-42')).toBe('-42')
    })
  })
})
