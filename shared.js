// Shared helpers used by every page's Component class (imported via dynamic import()
// since each page is its own independent <x-dc> document/class, not a bundled app).
export const ACCENT = 'oklch(0.7 0.16 25)';
export const COLORS = { Red: '#D64545', Blue: '#3B6FD6', Black: '#1B1B1B', White: '#F4F4F2' };
export const COLOR_NAMES = ['Red', 'Blue', 'Black', 'White'];

export function isValidOrder(name, email, phone) {
  return !!(name && name.trim() && /\S+@\S+\.\S+/.test(email || '') && phone && phone.trim().length >= 7);
}

export async function submitOrder(order) {
  try {
    const r = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(order),
    });
    const data = await r.json().catch(() => ({}));
    if (r.ok) return { ok: true, order: data.order };
    return { ok: false, error: data.error || 'unknown error' };
  } catch (e) {
    return { ok: false, error: 'Could not reach the server. Please try again.' };
  }
}

export async function checkSession() {
  try {
    const r = await fetch('/api/session');
    const data = await r.json();
    return !!data.authed;
  } catch (e) {
    return false;
  }
}

export async function loadOrders() {
  try {
    const r = await fetch('/api/orders');
    if (!r.ok) return [];
    const data = await r.json();
    return data.orders || [];
  } catch (e) {
    return [];
  }
}

export async function togglePaid(id) {
  try {
    const r = await fetch(`/api/orders/${id}/toggle-paid`, { method: 'PATCH' });
    if (!r.ok) return null;
    return await r.json();
  } catch (e) {
    return null;
  }
}

export async function staffLogin(password) {
  try {
    const r = await fetch('/api/staff-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    const data = await r.json().catch(() => ({}));
    return { ok: r.ok, error: data.error };
  } catch (e) {
    return { ok: false, error: 'Could not reach the server. Please try again.' };
  }
}

export async function staffLogout() {
  try {
    await fetch('/api/staff-logout', { method: 'POST' });
  } catch (e) {}
}

// See mf3-writer.js for the actual geometry generation.
export async function download3MF(order) {
  const mod = await import('./mf3-writer.js');
  const d = order.dims || { w: 50, d: 25, h: 3, textDepth: 1.2, hole: true };
  const blob = mod.generate3MFBlob({
    widthMM: d.w, depthMM: d.d, heightMM: d.h, textHeightMM: d.textDepth,
    baseColorHex: order.baseColorHex || '#1B1B1B',
    textColorHex: order.textColorHex || '#F4F4F2',
    hasHole: !!d.hole,
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = (order.id || 'order') + '.3mf';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
