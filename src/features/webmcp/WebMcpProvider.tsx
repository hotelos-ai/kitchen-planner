import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { getWorkspaceFacade, projectStore } from '../../state/project-store'
import { createWebMcpController, type WebMcpController } from '../../webmcp/webmcp-controller'
import type { ModelContextDetection } from '../../webmcp/model-context'

const WebMcpControllerContext = createContext<WebMcpController | null>(null)

export type WebMcpProviderProps = {
  children: ReactNode
  detect?: () => ModelContextDetection
}

export function WebMcpProvider({ children, detect }: WebMcpProviderProps) {
  const controller = useMemo(() => createWebMcpController({
    store: projectStore,
    getFacade: () => getWorkspaceFacade(projectStore),
    ...(detect ? { detect } : {}),
  }), [detect])

  const [, notify] = useState(0)

  useEffect(() => controller.subscribe(() => notify((tick) => tick + 1)), [controller])

  useEffect(() => {
    void controller.register()
    return () => controller.dispose()
  }, [controller])

  return <WebMcpControllerContext.Provider value={controller}>{children}</WebMcpControllerContext.Provider>
}

export function useWebMcpController(): WebMcpController | null {
  return useContext(WebMcpControllerContext)
}
