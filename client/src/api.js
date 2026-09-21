const API_BASE = import.meta.env.VITE_API_BASE || "/api";

/**
 * Sends a label image and the corresponding application fields to the
 * verification API and returns the per-field comparison result.
 */
export async function verifyLabel({ file, brand, classType, abv, net, warning }) {
  const formData = new FormData();
  formData.append("image", file);
  formData.append("brand", brand ?? "");
  formData.append("classType", classType ?? "");
  formData.append("abv", abv ?? "");
  formData.append("net", net ?? "");
  formData.append("warning", warning ?? "");

  const res = await fetch(`${API_BASE}/verify`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed with status ${res.status}`);
  }

  return res.json();
}
