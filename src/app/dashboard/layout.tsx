import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import DashboardShell from "@/components/DashboardShell";
import { DisplayCurrencyProvider } from "@/components/dashboard/DisplayCurrencyProvider";
import { DashboardStateProvider } from "@/components/dashboard/DashboardStateProvider";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <DisplayCurrencyProvider>
      <DashboardShell user={user}>
        <DashboardStateProvider initialUserId={user.id}>{children}</DashboardStateProvider>
      </DashboardShell>
    </DisplayCurrencyProvider>
  );
}
