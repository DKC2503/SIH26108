/**
 * ISRA API Service
 * Encapsulates backend communication with Express REST API.
 */

const API_BASE = import.meta.env.VITE_API_URL || '/api';

export async function checkSystemHealth() {
  try {
    const res = await fetch(`${API_BASE}/health`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    return {
      api: "offline",
      mongodb: "unavailable",
      gemini: "unavailable",
      bis: "unavailable",
      bis_reason: "server_unreachable",
      localIndex: "uninitialized"
    };
  }
}

export async function analyzeRequirement(query, inputType = "product_description", enableBis = true) {
  const res = await fetch(`${API_BASE}/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query,
      input_type: inputType,
      enable_bis_discovery: enableBis
    })
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.detail || `Analysis failed (HTTP ${res.status})`);
  }

  return await res.json();
}

export async function analyzeTenderDocument(file) {
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch(`${API_BASE}/analyze/tender`, {
    method: 'POST',
    body: formData
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.detail || errData.error || `Tender analysis failed (HTTP ${res.status})`);
  }

  return await res.json();
}

export async function searchStandardsCatalog(query = '') {
  const res = await fetch(`${API_BASE}/standards/search?q=${encodeURIComponent(query)}`);
  if (!res.ok) throw new Error(`Search failed (HTTP ${res.status})`);
  return await res.json();
}

export async function getStandardDetails(isNumber) {
  const res = await fetch(`${API_BASE}/standards/${encodeURIComponent(isNumber)}`);
  if (!res.ok) throw new Error(`Standard '${isNumber}' not found`);
  return await res.json();
}
