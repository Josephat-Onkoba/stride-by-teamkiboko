import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });

    const { data: roleRow } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", data.user.id)
      .maybeSingle();

    const role =
      roleRow?.['role'] ||
      (data.user.user_metadata?.['role'] as string) ||
      sessionStorage.getItem("stride_role") ||
      "athlete";

    sessionStorage.setItem("stride_role", role);
    return { user: data.user, role };
  },
  component: () => <Outlet />,
});