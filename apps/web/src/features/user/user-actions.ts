"use server";

import { auth } from "@repo/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { guestDestinationPath } from "@/features/user/user-destination";

// The guest account is public by design, so its password is not a secret.
const guest = {
  name: "Guest regulator",
  email: "guest@orbitalis.demo",
  password: "orbitalis-guest-demo",
};

export async function signInAsGuest(locale: string, destination: unknown) {
  const requestHeaders = await headers();
  try {
    await auth.api.signInEmail({
      body: { email: guest.email, password: guest.password },
      headers: requestHeaders,
    });
  } catch {
    await auth.api.signUpEmail({ body: guest, headers: requestHeaders });
  }
  redirect(guestDestinationPath(locale, destination));
}
