export const MINIMUM_PASSWORD_LENGTH = 8;

export function validatePasswordUpdate(newPassword: string, confirmation: string) {
  if (!newPassword || !confirmation) return "Both password fields are required.";
  if (newPassword !== confirmation) return "Passwords do not match.";
  if (newPassword.length < MINIMUM_PASSWORD_LENGTH) {
    return `Password must be at least ${MINIMUM_PASSWORD_LENGTH} characters.`;
  }
  return null;
}
