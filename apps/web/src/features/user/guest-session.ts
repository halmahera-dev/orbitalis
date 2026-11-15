import "server-only";
import { auth } from "@repo/auth";

// The guest account is public by design, so its password is not a secret.
const guest = {
  name: "Guest regulator",
  email: "guest@orbitalis.demo",
  password: "orbitalis-guest-demo",
};

export async function startGuestSession(requestHeaders: Headers) {
  try {
    await auth.api.signInEmail({
      body: { email: guest.email, password: guest.password },
      headers: requestHeaders,
    });
  } catch {
    await auth.api.signUpEmail({ body: guest, headers: requestHeaders });
  }
}
