"use client";

import { createClient } from "@/lib/supabase/browser";
import { Button } from "./ui";

export function SignOutButton() {
  return <Button variant="outline" size="sm" onClick={async () => { await createClient().auth.signOut(); window.location.assign("/login"); }}>Sign out</Button>;
}
