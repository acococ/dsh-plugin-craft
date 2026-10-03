// Tests for the CraftStoreService. We exercise the service through a real
// temporary directory so the file IO path runs end-to-end.

import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { CraftStore } from '../src/store'

describe('CraftStore', () => {
  let tmpDir: string
  let store: CraftStore

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'craft-store-'))
    store = new CraftStore()
    store.configure(tmpDir, 10)
  })

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true })
  })

  it('creates a project and lists it', async () => {
    const created = await store.create({ pluginName: 'foo-bar', fuzzyIdea: 'idea' })
    expect(created.pluginName).toBe('foo-bar')
    expect(created.stage).toBe('interview')
    expect(created.stages.find((s) => s.stage === 'interview')?.status).toBe('gate')

    const list = await store.list()
    expect(list).toHaveLength(1)
    expect(list[0]?.pluginName).toBe('foo-bar')
  })

  it('rejects invalid plugin names', async () => {
    await expect(
      store.create({ pluginName: 'Has-Caps', fuzzyIdea: 'x' }),
    ).rejects.toThrow(/pluginName must match/i)
    await expect(
      store.create({ pluginName: 'a', fuzzyIdea: 'x' }),
    ).rejects.toThrow(/pluginName must match/i)
    await expect(
      store.create({ pluginName: '-leading', fuzzyIdea: 'x' }),
    ).rejects.toThrow(/pluginName must match/i)
    await expect(
      store.create({ pluginName: 'trailing-', fuzzyIdea: 'x' }),
    ).rejects.toThrow(/pluginName must match/i)
  })

  it('refuses to create the same project twice', async () => {
    await store.create({ pluginName: 'foo-bar', fuzzyIdea: 'idea' })
    await expect(
      store.create({ pluginName: 'foo-bar', fuzzyIdea: 'idea' }),
    ).rejects.toThrow(/already exists/i)
  })

  it('round-trips interview answers, design, and tasks', async () => {
    await store.create({ pluginName: 'foo-bar', fuzzyIdea: 'idea' })
    await store.appendInterview('foo-bar', 'mainFeature', '扫描局域网')
    await store.setDesign('foo-bar', '模块 A + 模块 B')
    await store.setTasks('foo-bar', 'task 1')

    const proj = await store.get('foo-bar')
    expect(proj?.interview).toHaveLength(1)
    expect(proj?.interview[0]?.field).toBe('mainFeature')
    expect(proj?.design).toBe('模块 A + 模块 B')
    expect(proj?.tasks).toBe('task 1')
  })

  it('advances through the gate stages and marks auto stages as such', async () => {
    await store.create({ pluginName: 'foo-bar', fuzzyIdea: 'idea' })

    // interview → design (gate)
    let r = await store.advance('foo-bar', { decision: 'accept' })
    expect(r.nextStage).toBe('design')
    expect(r.awaitingGate).toBe(true)
    expect(r.project.stages.find((s) => s.stage === 'interview')?.status).toBe('done')
    expect(r.project.stages.find((s) => s.stage === 'design')?.status).toBe('gate')

    // design → tasks (auto)
    r = await store.advance('foo-bar', { decision: 'accept' })
    expect(r.nextStage).toBe('tasks')
    expect(r.awaitingGate).toBe(false)
    expect(r.project.stages.find((s) => s.stage === 'design')?.status).toBe('done')
    expect(r.project.stages.find((s) => s.stage === 'tasks')?.status).toBe('auto')

    // tasks → generate (auto)
    r = await store.advance('foo-bar', { decision: 'accept' })
    expect(r.nextStage).toBe('generate')

    // generate → verify (auto)
    r = await store.advance('foo-bar', { decision: 'accept' })
    expect(r.nextStage).toBe('verify')

    // verify → deliver (gate)
    r = await store.advance('foo-bar', { decision: 'accept' })
    expect(r.nextStage).toBe('deliver')
    expect(r.awaitingGate).toBe(true)

    // deliver → deliver (clamped)
    r = await store.advance('foo-bar', { decision: 'accept' })
    expect(r.nextStage).toBe('deliver')
  })

  it('revise keeps the project on the same stage', async () => {
    await store.create({ pluginName: 'foo-bar', fuzzyIdea: 'idea' })
    const r = await store.advance('foo-bar', {
      decision: 'revise',
      feedback: '再补点',
    })
    expect(r.nextStage).toBe('interview')
    expect(r.awaitingGate).toBe(true)
  })

  it('removes a project', async () => {
    await store.create({ pluginName: 'foo-bar', fuzzyIdea: 'idea' })
    await store.remove('foo-bar')
    const list = await store.list()
    expect(list).toHaveLength(0)
  })
})

describe('isValidPluginName', () => {
  it('accepts valid snake-case identifiers', async () => {
    const { isValidPluginName } = await import('../src/types')
    expect(isValidPluginName('a')).toBe(false)            // too short
    expect(isValidPluginName('device-scanner')).toBe(true)
    expect(isValidPluginName('a-b-c-d-1-2-3')).toBe(true)
    expect(isValidPluginName('Has-Caps')).toBe(false)
    expect(isValidPluginName('-leading')).toBe(false)
    expect(isValidPluginName('trailing-')).toBe(false)
  })
})