"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/browser";
import { Button, Card, CardContent, CardHeader, CardTitle } from "./ui";

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
      options: { redirectTo: `${window.location.origin}/auth/callback?next=/onboarding` },
    });
    setBusy(false);
    if (error) setMessage(error.message);
  }

  return (
    <Card className="mx-auto w-full max-w-md">
      <CardHeader><CardTitle>Sign in to Launchbench</CardTitle></CardHeader>
      <CardContent>
        <div className="space-y-3">
          <Button className="w-full" disabled={busy} onClick={() => signIn("google")}>{busy ? "Redirecting…" : "Continue with Google"}</Button>
          <Button className="w-full" variant="outline" disabled={busy} onClick={() => signIn("github")}>Continue with GitHub</Button>
          {message && <p className="text-sm text-muted" role="status">{message}</p>}
        </div>
      </CardContent>
    </Card>
  );
}
