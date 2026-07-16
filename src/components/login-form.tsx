"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/browser";
import { Button } from "./ui";

export function LoginForm() {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function signIn(provider: "google" | "github") {
    setBusy(true);
    setMessage("");
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      // Login establishes only an app identity. Gmail send/read permission is
      // requested separately through the workspace's Composio connection.
      options: { redirectTo: `${window.location.origin}/auth/callback?next=/app` },
    });
    setBusy(false);
    if (error) setMessage(error.message);
  }

  return (
    <div className="space-y-3">
      <Button className="h-12 w-full text-sm" disabled={busy} onClick={() => signIn("google")}>{busy ? "Redirecting…" : "Continue with Google"}</Button>
      <Button className="h-12 w-full text-sm" variant="outline" disabled={busy} onClick={() => signIn("github")}>Continue with GitHub</Button>
      {message && <p className="text-sm text-danger" role="status">{message}</p>}
    </div>
  );
}
