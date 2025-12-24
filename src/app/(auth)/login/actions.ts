"use server";

import { INITIAL_STATE_LOGIN_FORM } from "@/constants/auth-constant";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { AuthFormState } from "@/types/auth";
import { loginSchemaForm } from "@/validations/auth-validation";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export async function login(
  prevState: AuthFormState,
  formData: FormData | null
) {
  if (!formData) {
    return INITIAL_STATE_LOGIN_FORM;
  }

  const validatedFields = loginSchemaForm.safeParse({
    username: formData.get("username"),
    password: formData.get("password"),
  });

  if (!validatedFields.success) {
    return {
      status: "error",
      errors: validatedFields.error.flatten().fieldErrors,
    };
  }

  // Lookup user email by username
  const adminClient = createAdminClient();
  const { data: profile, error: profileError } = await adminClient
    .from("profiles")
    .select("id")
    .eq("username", validatedFields.data.username.toLowerCase())
    .single();

  if (profileError || !profile) {
    return {
      status: "error",
      errors: {
        ...prevState.errors,
        _form: ["Username tidak ditemukan"],
      },
    };
  }

  // Get user email from auth.users
  const { data: authUserData, error: authError } = await adminClient.auth.admin.getUserById(profile.id);

  if (authError || !authUserData?.user?.email) {
    return {
      status: "error",
      errors: {
        ...prevState.errors,
        _form: ["User tidak ditemukan"],
      },
    };
  }

  const supabase = await createClient();

  const {
    error,
    data: { user },
  } = await supabase.auth.signInWithPassword({
    email: authUserData.user.email,
    password: validatedFields.data.password,
  });

  if (error) {
    return {
      status: "error",
      errors: {
        ...prevState.errors,
        _form: [error.message === "Invalid login credentials" ? "Password salah" : error.message],
      },
    };
  }

  const { data: userProfile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user?.id)
    .single();

  if (userProfile) {
    const cookiesStore = await cookies();
    cookiesStore.set("user_profile", JSON.stringify(userProfile), {
      httpOnly: true,
      path: "/",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 365,
    });
  }

  revalidatePath("/", "layout");
  redirect("/dashboard");
}
