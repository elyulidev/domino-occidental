import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { EditProfileForm } from "./EditProfileForm";

export const metadata = {
  title: "Editar Perfil — Dominó Occidental",
};

export default async function EditProfilePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("username, avatar_url, country")
    .eq("id", user.id)
    .single();

  if (!profile) {
    redirect("/lobby");
  }

  return (
    <EditProfileForm
      profile={{
        username: profile.username,
        country: profile.country,
        avatar_url: profile.avatar_url,
      }}
    />
  );
}
