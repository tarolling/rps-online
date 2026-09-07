/**
 * Reads a required environment variable, throwing a clear startup error
 * naming the missing variable instead of letting `undefined` reach a
 * driver/SDK constructor and fail later with an opaque internal error.
 */
export function assertEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}
