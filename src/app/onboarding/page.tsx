import { redirect } from "next/navigation";
import { OnboardingForm } from "@/components/onboarding-form";
import { BrandLogo } from "@/components/brand-logo";
import { createClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Set up your workspace",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: memberships } = await supabase.from("workspace_members").select("workspace_id").limit(1);
  if (memberships?.length) redirect("/app");
  return <main className="px-6 py-20"><div className="mx-auto mb-6 w-full max-w-xl text-center"><BrandLogo href="/" /></div><OnboardingForm /></main>;
}
