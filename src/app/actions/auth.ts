"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { webEnv as env } from "@/lib/env";
import {
  createSessionToken,
  SESSION_COOKIE_NAME,
  SESSION_TTL_SECONDS,
  verifyCredentials,
} from "@/lib/services/auth";

const credentialsSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

// Not exported: a "use server" module may only export async functions. The
// client infers this shape from `login`'s return type via useActionState.
interface LoginFormState {
  readonly error?: string;
}

function resolveNext(raw: FormDataEntryValue | null): string {
  // Same-origin paths only: block protocol-relative ("//") and backslash tricks
  // to prevent the login redirect from becoming an open redirect.
  if (typeof raw === "string" && /^\/(?![/\\])/.test(raw)) {
    return raw;
  }
  return "/";
}

export async function login(
  _prevState: LoginFormState,
  formData: FormData,
): Promise<LoginFormState> {
  const parsed = credentialsSchema.safeParse({
    username: formData.get("username"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: "Invalid username or password." };
  }

  const authenticated = await verifyCredentials(parsed.data, {
    username: env.ADMIN_USERNAME,
    password: env.ADMIN_PASSWORD,
  });
  if (!authenticated) {
    return { error: "Invalid username or password." };
  }

  const token = await createSessionToken({ secret: env.SESSION_SECRET });
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });

  redirect(resolveNext(formData.get("next")));
}

export async function logout(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
  redirect("/login");
}
