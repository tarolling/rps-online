export async function postJSON<T = any>(url: string, body: object): Promise<T> {
    const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}${url}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Request to ${process.env.NEXT_PUBLIC_BASE_URL}${url} failed: ${res.statusText}`);
    return res.json();
}