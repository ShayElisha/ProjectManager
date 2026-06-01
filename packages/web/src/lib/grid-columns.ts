const STORAGE_KEY = "nexus-grid-cols";

export function loadGridColumns(projectId: string): string[] | null {
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY}:${projectId}`);
    return raw ? (JSON.parse(raw) as string[]) : null;
  } catch {
    return null;
  }
}

export function saveGridColumns(projectId: string, columns: string[]): void {
  localStorage.setItem(`${STORAGE_KEY}:${projectId}`, JSON.stringify(columns));
}
