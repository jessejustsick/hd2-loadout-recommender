// Connectivity primitive (PRD §13.4). A thin wrapper over the browser's online
// state so the rest of the app doesn't touch `navigator`/window events directly.
//
// `navigator.onLine` is a coarse signal — it reports link-layer connectivity,
// not whether Supabase is actually reachable — but it's the right cue for the
// two things v2 needs: choosing the IndexedDB-cache read path while offline, and
// triggering the reconnect sync processor (Step 2) when connectivity returns.

export function isOnline(): boolean {
  // Default to online in non-browser contexts (e.g. the sim/test runner).
  return typeof navigator === 'undefined' ? true : navigator.onLine
}

// Subscribe to connectivity transitions. Returns an unsubscribe function.
export function onConnectivityChange(callback: (online: boolean) => void): () => void {
  const handleOnline = () => callback(true)
  const handleOffline = () => callback(false)
  window.addEventListener('online', handleOnline)
  window.addEventListener('offline', handleOffline)
  return () => {
    window.removeEventListener('online', handleOnline)
    window.removeEventListener('offline', handleOffline)
  }
}
