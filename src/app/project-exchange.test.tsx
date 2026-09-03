import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createSeedProject } from '../domain/seed-project'
import { createWorkspaceFacade } from '../core/workspace/workspace-facade'
import { exportProject } from '../state/persistence'
import { createProjectStore, projectStore } from '../state/project-store'
import { ProjectExchange } from './ProjectExchange'

describe('project exchange', () => {
  beforeEach(() => projectStore.getState().replaceProject(createSeedProject()))
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })

  it('imports a validated project without reloading the app', async () => {
    const imported = { ...createSeedProject(), name: 'Imported kitchen option' }
    render(<ProjectExchange />)
    await userEvent.upload(screen.getByLabelText(/Open project JSON/i), new File([exportProject(imported)], 'kitchen.json', { type: 'application/json' }))
    expect(projectStore.getState().project.name).toBe('Imported kitchen option')
    expect(screen.getByText(/Opened kitchen.json/i)).toBeInTheDocument()
  })

  it('keeps the current project when an import is invalid', async () => {
    const store = createProjectStore(createSeedProject())
    store.getState().nudgeItems(['tandoor'], { x: 100, y: 0 })
    const before = store.getState()
    render(<ProjectExchange store={store} />)
    await userEvent.upload(screen.getByLabelText(/Open project JSON/i), new File(['{"bad":true}'], 'bad.json', { type: 'application/json' }))
    expect(store.getState()).toMatchObject({
      project: before.project,
      documentId: before.documentId,
      revision: before.revision,
      past: before.past,
    })
    expect(screen.getByRole('alert')).toHaveTextContent(/not a valid kitchen project/i)
  })

  it('exports every layout in one complete versioned project file', async () => {
    let exportedBlob: Blob | undefined
    const createObjectURL = vi.fn((blob: Blob) => {
      exportedBlob = blob
      return 'blob:kitchen-project'
    })
    const revokeObjectURL = vi.fn()
    vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL })
    let clickedDownload = ''
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      clickedDownload = this.download
    })
    render(<ProjectExchange />)
    await userEvent.click(screen.getByRole('button', { name: /Save project/i }))
    expect(createObjectURL).toHaveBeenCalledOnce()
    expect(exportedBlob).toBeInstanceOf(Blob)
    expect(clickedDownload).toBe('kitchen-1.json')
    expect(screen.getByRole('status')).toHaveTextContent(/Project saved/i)
  })

  it('atomically replaces the document and invalidates previews from the previous document', async () => {
    const store = createProjectStore(createSeedProject())
    store.getState().nudgeItems(['tandoor'], { x: 100, y: 0 })
    store.getState().selectItems(['tandoor'])
    const facade = createWorkspaceFacade({ store })
    const preview = facade.previewLayoutChanges({
      expectedRevision: store.getState().revision,
      operations: [{ type: 'rename_layout', variantId: 'baseline-trace', name: 'Pending preview name' }],
    })
    if (!preview.ok) throw new Error(preview.message)
    const previousDocumentId = store.getState().documentId
    const imported = { ...createSeedProject(), name: 'Complete imported project' }

    render(<ProjectExchange store={store} />)
    await userEvent.upload(
      screen.getByLabelText(/Open project JSON/i),
      new File([exportProject(imported)], 'complete.json', { type: 'application/json' }),
    )

    expect(store.getState()).toMatchObject({
      project: { name: 'Complete imported project' },
      revision: 0,
      past: [],
      future: [],
      selectedIds: [],
    })
    expect(store.getState().documentId).not.toBe(previousDocumentId)
    expect(facade.applyLayoutChanges({ previewToken: preview.previewToken })).toMatchObject({
      ok: false,
      code: 'preview-document-mismatch',
      revision: 0,
    })
  })
})
