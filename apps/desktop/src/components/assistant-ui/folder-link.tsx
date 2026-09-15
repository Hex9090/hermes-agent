import { type ReactNode, useState } from 'react'

import { useSessionView } from '@/app/chat/session-view'
import { resolveSessionRpcOwner } from '@/app/contrib/wiring-routing'
import { folderPathFromMarkdownHref } from '@/lib/folder-links'
import { $connection, getSessionOwnerHint, knownSessionOwner, ownerLookupSessionRows } from '@/store/session'
import { sessionTileOwnerRoute, storedSessionIdForRuntimeId } from '@/store/session-states'

export function FolderLink({ href, children }: { href: string; children: ReactNode }) {
  const view = useSessionView()
  const [error, setError] = useState('')
  const path = folderPathFromMarkdownHref(href)

  const open = async () => {
    setError('')

    try {
      // Read this transcript's owner, never the focused tile or ambient profile.
      const runtimeId = view.$runtimeId.get()
      const storedId = view.$storedId.get() ?? (runtimeId ? storedSessionIdForRuntimeId(runtimeId) : null)

      const owner = resolveSessionRpcOwner({
        routingSessionId: storedId,
        sessionOwnerHint: getSessionOwnerHint,
        sessionRowOwner: id => knownSessionOwner(ownerLookupSessionRows(), id),
        tileOwnerRoute: sessionTileOwnerRoute
      })

      const connection = $connection.get()

      if (
        !owner ||
        typeof owner === 'string' ||
        owner.mode === 'remote' ||
        !owner.connectionId ||
        connection?.mode !== 'local' ||
        connection.connectionId !== owner.connectionId ||
        (connection.profile ?? 'default') !== owner.profile
      ) {
        throw new Error('Folder links require this session’s current local connection.')
      }

      const capability = window.hermesDesktop?.openExistingDirectory

      if (!capability) {
        throw new Error('Native folder opening is unavailable.')
      }

      if (!path) {
        return
      }

      const result = await capability({ path, owner: { connectionId: owner.connectionId, profile: owner.profile } })

      if (!result.ok) {
        throw new Error(result.error || 'Could not open folder.')
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    }
  }

  // Reserved malformed links must never escape to the browser or file preview.
  if (!path) {
    return <span>{children}</span>
  }

  return (
    <span>
      <button className="ref wrap-anywhere" onClick={() => void open()} title={path} type="button">
        {children}
      </button>
      {error && (
        <span className="ml-2 text-xs text-muted-foreground" role="alert">
          {error}
        </span>
      )}
    </span>
  )
}
