export const USERNAME_PATTERN = /^[a-z0-9._-]{3,30}$/;

export const normalizeUsername = (username: string) => username.trim().toLowerCase();

// Supabase Auth requires an email, so usernames map to a placeholder address.
// Users are created through the admin API, so the domain never needs to receive mail.
export const usernameToEmail = (username: string) => `${normalizeUsername(username)}@users.portflow.app`;
