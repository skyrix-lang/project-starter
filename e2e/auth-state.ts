// Saved by auth.setup.ts: one signed-in user shared by the other tests.
export const SIGNED_IN_STATE = "e2e/.auth/user.json";

// That user. e2e/reset-database.ts creates it with the seed bookings, so the
// tests that read seed data see them.
export const SHARED_USER_EMAIL = "e2e-shared@example.test";
