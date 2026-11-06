// Anonymous browser session id, used only to de-duplicate product views for visitors who are not signed in.
let memoryId = null;
export function visitorSessionId() {
  try {
    let id = localStorage.getItem('bz_visitor');
    if (!id) {
      id = (crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`).replace(/-/g, '').slice(0, 32);
      localStorage.setItem('bz_visitor', id);
    }
    return id;
  } catch {
    memoryId = memoryId || `${Date.now()}${Math.random().toString(36).slice(2)}`.slice(0, 32);
    return memoryId;
  }
}
