"use server";

import { cookies } from "next/headers";
import { CURRENT_PROJECT_COOKIE } from "./current-project";

/** Persists the user's selected project so every page scopes to it. The value is
 * validated against the workspace wherever it's actually used (RLS + workspace
 * checks), so this cookie is a preference, not an authorization claim. */
export async function setCurrentProject(productId: string) {
  (await cookies()).set(CURRENT_PROJECT_COOKIE, productId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}
