"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { startGuestSession } from "@/features/user/guest-session";
import { guestDestinationPath } from "@/features/user/user-destination";

export async function signInAsGuest(locale: string, destination: unknown) {
  await startGuestSession(await headers());
  redirect(guestDestinationPath(locale, destination));
}
