/**
 * The AG Studio trial key, when Walter has one. `ag-studio-react` applies it
 * through `<AgStudioProvider licenseKey>` (which calls
 * `AgStudioLicenseManager.setLicenseKey` once, before the first instance).
 * Without a key Studio renders in trial mode with a watermark.
 */
export function studioLicenseKey(): string | undefined {
  const key = import.meta.env.VITE_AG_STUDIO_LICENSE;
  return typeof key === 'string' && key.trim() !== '' ? key.trim() : undefined;
}
