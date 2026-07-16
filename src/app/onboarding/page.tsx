import { redirect } from "next/navigation";
import { OnboardingForm } from "@/components/onboarding-form";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: memberships } = await supabase.from("workspace_members").select("workspace_id").limit(1);
  if (memberships?.length) redirect("/app");
  return <main className="px-6 py-20"><OnboardingForm /></main>;
}
