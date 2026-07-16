import { redirect } from "next/navigation";

/**
 * The workspace shell starts at the Sales Agent. Keeping this as a redirect
 * prevents signed-in users from seeing the retired placeholder dashboard.
 */
export default function WorkspaceHomePage() {
  redirect("/app/sales");
}
