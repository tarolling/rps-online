export async function postJSON<T = any>(url: string, body: object): Promise<T> {
    const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}${url}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Request to ${process.env.NEXT_PUBLIC_BASE_URL}${url} failed: ${res.statusText}`);
    return res.json();
}

export async function getJSON<T = any>(url: string, params?: Record<string, any>): Promise<T> {
    const fullUrl = new URL(`${process.env.NEXT_PUBLIC_BASE_URL}${url}`);
    if (params) {
        Object.entries(params).forEach(([k, v]) => fullUrl.searchParams.set(k, String(v)));
    }
    const res = await fetch(fullUrl.toString());
    if (!res.ok) throw new Error(`Request to ${url} failed: ${res.statusText}`);
    return res.json();
}