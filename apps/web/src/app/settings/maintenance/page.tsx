import { redirect } from "next/navigation";

export default function MaintenancePage() {
  redirect("/settings/maintenance/media");
}
