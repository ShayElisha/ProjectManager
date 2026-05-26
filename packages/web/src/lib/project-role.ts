export const PROJECT_ROLE_MAX_LEN = 3;

export function normalizeProjectRole(input: string): string {
  return input.replace(/\s/g, "").toUpperCase().slice(0, PROJECT_ROLE_MAX_LEN);
}

export function isValidProjectRole(role: string): boolean {
  const code = normalizeProjectRole(role);
  return code.length >= 1 && code.length <= PROJECT_ROLE_MAX_LEN;
}
