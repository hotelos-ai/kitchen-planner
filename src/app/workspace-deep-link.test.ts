import { describe, expect, it } from 'vitest'
import { createSeedProject } from '../domain/seed-project'
import { createAppStateStore } from '../state/app-state-store'
import { createProjectStore } from '../state/project-store'
import { applyWorkspaceDeepLink, buildWorkspaceDeepLink, resolveWorkspaceDeepLink } from './workspace-deep-link'

describe('workspace deep links', () => {
  it('round-trips project, layout, scenario, stage, view, and overlay state', () => {
    const project = createSeedProject()
    const secondVariant = structuredClone(project.variants[0])
    secondVariant.id = 'layout / courtyard'
    secondVariant.name = 'Courtyard option'
    project.variants.push(secondVariant)
    const secondScenario = { ...project.scenarios[0], id: 'lunch & events', name: 'Lunch and events' }
    project.scenarios.push(secondScenario)
    const url = buildWorkspaceDeepLink({
      projectId: project.id,
      variantId: secondVariant.id,
      scenarioId: secondScenario.id,
      stage: 'simulate',
      view: 'split',
      overlay: 'compare',
    }, 'https://example.test/designer?embed=0#old')

    expect(url).toContain('https://example.test/designer?embed=0#workspace=v1')
    expect(resolveWorkspaceDeepLink(new URL(url).hash, project)).toEqual({
      variantId: secondVariant.id,
      scenarioId: secondScenario.id,
      stage: 'simulate',
      view: 'split',
      overlay: 'compare',
    })
  })

  it('refuses links for another project and bounds hostile fragments', () => {
    const project = createSeedProject()
    expect(resolveWorkspaceDeepLink('#workspace=v1&project=someone-else&stage=simulate', project)).toBeNull()
    expect(resolveWorkspaceDeepLink(`#workspace=v1&project=${project.id}&${'x'.repeat(4_100)}`, project)).toBeNull()
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
      projectId: project.id,
      variantId: secondVariant.id,
      scenarioId: secondScenario.id,
      stage: 'equipment',
      view: 'scene',
      overlay: null,
    })).hash

    expect(applyWorkspaceDeepLink(hash, projectStore, appStore)).toBe(true)
    expect(projectStore.getState()).toMatchObject({
      revision: 1,
      project: { activeVariantId: 'courtyard', activeScenarioId: 'lunch' },
    })
    expect(appStore.getState()).toMatchObject({ stage: 'equipment', view: 'scene', overlay: null })
    expect(applyWorkspaceDeepLink(hash, projectStore, appStore)).toBe(true)
    expect(projectStore.getState().revision).toBe(1)
  })
})
