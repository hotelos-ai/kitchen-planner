import { describe, expect, it } from 'vitest'
import { compressToEncodedURIComponent } from 'lz-string'
import { createBlankProject } from '../domain/blank-project'
import { createSeedProject } from '../domain/seed-project'
import { createAppStateStore } from '../state/app-state-store'
import { createProjectStore } from '../state/project-store'
import { applyWorkspaceDeepLink, buildWorkspaceDeepLink, resolveWorkspaceDeepLink } from './workspace-deep-link'

describe('workspace deep links', () => {
  it('round-trips project, layout, scenario, stage, view, overlay, and selection state', () => {
    const project = createSeedProject()
    const secondVariant = structuredClone(project.variants[0])
    secondVariant.id = 'layout / courtyard'
    secondVariant.name = 'Courtyard option'
    project.variants.push(secondVariant)
    const secondScenario = { ...project.scenarios[0], id: 'lunch & events', name: 'Lunch and events' }
    project.scenarios.push(secondScenario)
    const url = buildWorkspaceDeepLink({
      project,
      variantId: secondVariant.id,
      scenarioId: secondScenario.id,
      stage: 'simulate',
      view: 'split',
      overlay: 'compare',
      selectedIds: ['flat-top-fryer', 'tandoor'],
    }, 'https://example.test/designer?embed=0#old')

    expect(url).toContain('https://example.test/designer?embed=0#workspace=v2')
    expect(resolveWorkspaceDeepLink(new URL(url).hash, project)).toEqual({
      project,
      variantId: secondVariant.id,
      scenarioId: secondScenario.id,
      stage: 'simulate',
      view: 'split',
      overlay: 'compare',
      selectedIds: ['flat-top-fryer', 'tandoor'],
    })
  })

  it('refuses links for another project and bounds hostile fragments', () => {
    const project = createSeedProject()
    expect(resolveWorkspaceDeepLink('#workspace=v1&project=someone-else&stage=simulate', project)).toBeNull()
    expect(resolveWorkspaceDeepLink(`#workspace=v1&project=${project.id}&${'x'.repeat(50_000)}`, project)).toBeNull()
  })

  it('falls back from stale document IDs and ignores invalid UI enum values', () => {
    const project = createSeedProject()
    const resolved = resolveWorkspaceDeepLink(
      `#workspace=v1&project=${encodeURIComponent(project.id)}&variant=deleted&scenario=deleted&stage=<script>&view=vr&overlay=popup`,
      project,
    )
    expect(resolved).toEqual({
      variantId: project.activeVariantId,
      scenarioId: project.activeScenarioId,
    })
  })

  it('restores project selections in one revision and applies visible state', () => {
    const project = createSeedProject()
    const secondVariant = structuredClone(project.variants[0])
    secondVariant.id = 'courtyard'
    project.variants.push(secondVariant)
    const secondScenario = { ...project.scenarios[0], id: 'lunch' }
    project.scenarios.push(secondScenario)
    const projectStore = createProjectStore(project)
    const appStore = createAppStateStore()
    const hash = new URL(buildWorkspaceDeepLink({
      project,
      variantId: secondVariant.id,
      scenarioId: secondScenario.id,
      stage: 'equipment',
      view: 'scene',
      overlay: null,
      selectedIds: ['flat-top-fryer'],
    })).hash

    expect(applyWorkspaceDeepLink(hash, projectStore, appStore)).toBe(true)
    expect(projectStore.getState()).toMatchObject({
      revision: 1,
      project: { activeVariantId: 'courtyard', activeScenarioId: 'lunch' },
    })
    expect(appStore.getState()).toMatchObject({ stage: 'equipment', view: 'scene', overlay: null })
    expect(projectStore.getState().selectedIds).toEqual(['flat-top-fryer'])
    expect(applyWorkspaceDeepLink(hash, projectStore, appStore)).toBe(true)
    expect(projectStore.getState().revision).toBe(1)
  })

  it('filters unknown selected IDs and keeps selection unchanged for legacy links without select', () => {
    const project = createSeedProject()
    const projectStore = createProjectStore(project)
    const appStore = createAppStateStore()
    projectStore.getState().selectItems(['tandoor'])

    const legacyHash = `#workspace=v1&project=${encodeURIComponent(project.id)}&variant=${project.activeVariantId}&scenario=${project.activeScenarioId}`
    expect(applyWorkspaceDeepLink(legacyHash, projectStore, appStore)).toBe(true)
    expect(projectStore.getState().selectedIds).toEqual(['tandoor'])

    const selectedHash = `${legacyHash}&select=flat-top-fryer&select=missing&select=flat-top-fryer`
    expect(applyWorkspaceDeepLink(selectedHash, projectStore, appStore)).toBe(true)
    expect(projectStore.getState().selectedIds).toEqual(['flat-top-fryer'])
  })

  it('restores a validated project snapshot in a fresh browser without local persistence', () => {
    const sharedProject = createSeedProject()
    sharedProject.name = 'Portable shared kitchen'
    sharedProject.variants[0].equipment[0].label = 'Shared fryer'
    const link = buildWorkspaceDeepLink({
      project: sharedProject,
      variantId: sharedProject.activeVariantId,
      scenarioId: sharedProject.activeScenarioId,
      stage: 'equipment',
      view: 'plan',
      overlay: null,
      selectedIds: ['flat-top-fryer'],
    })
    const freshStore = createProjectStore(createBlankProject('Unrelated local project'))
    const appStore = createAppStateStore()

    expect(applyWorkspaceDeepLink(new URL(link).hash, freshStore, appStore)).toBe(true)
    expect(freshStore.getState()).toMatchObject({
      revision: 0,
      project: { id: sharedProject.id, name: 'Portable shared kitchen' },
      selectedIds: ['flat-top-fryer'],
      past: [],
    })
    expect(freshStore.getState().project.variants[0].equipment[0].label).toBe('Shared fryer')
  })

  it('rejects malformed, non-strict, and oversized embedded projects', () => {
    const project = createSeedProject()
    const validLink = new URL(buildWorkspaceDeepLink({
      project,
      variantId: project.activeVariantId,
      scenarioId: project.activeScenarioId,
      stage: 'space',
      view: 'plan',
      overlay: null,
    }))
    validLink.hash = validLink.hash.replace(/payload=[^&]+/, 'payload=not-valid')
    expect(resolveWorkspaceDeepLink(validLink.hash, createBlankProject())).toBeNull()

    const nonStrict = { ...project, unexpected: true }
    const invalidPayload = compressToEncodedURIComponent(JSON.stringify(nonStrict))
    const invalidLink = new URL(buildWorkspaceDeepLink({
      project,
      variantId: project.activeVariantId,
      scenarioId: project.activeScenarioId,
      stage: 'space',
      view: 'plan',
      overlay: null,
    }))
    invalidLink.hash = invalidLink.hash.replace(/payload=[^&]+/, `payload=${invalidPayload}`)
    expect(resolveWorkspaceDeepLink(invalidLink.hash, createBlankProject())).toBeNull()

    expect(() => buildWorkspaceDeepLink({
      project: { ...project, name: 'x'.repeat(128 * 1_024) },
      variantId: project.activeVariantId,
      scenarioId: project.activeScenarioId,
      stage: 'space',
      view: 'plan',
      overlay: null,
    })).toThrow(/too large/i)
  })
})
