import { redirect } from "next/navigation";

/** The tenant-aware Supabase workspace is the sole application entry point. */
export default function HomePage() {
  redirect("/app");
}
