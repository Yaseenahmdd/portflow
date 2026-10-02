import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { USERNAME_PATTERN, normalizeUsername, usernameToEmail } from "@/lib/username";

function isValidInviteCode(provided: string, expected: string) {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const username = normalizeUsername(String(body?.username ?? ""));
  const password = String(body?.password ?? "");
  const inviteCode = String(body?.inviteCode ?? "").trim();

  // Sign-up is closed unless an invite code is configured, and then requires it.
  const expectedInviteCode = process.env.SIGNUP_INVITE_CODE?.trim();
  if (!expectedInviteCode) {
    return NextResponse.json({ error: "Sign-up is closed." }, { status: 403 });
  }

  if (!isValidInviteCode(inviteCode, expectedInviteCode)) {
    return NextResponse.json({ error: "Invalid invite code." }, { status: 403 });
  }

  if (!USERNAME_PATTERN.test(username)) {
    return NextResponse.json(
      { error: "Username must be 3-30 characters: letters, numbers, dot, dash or underscore." },
      { status: 400 },
    );
  }

  if (password.length < 6) {
    return NextResponse.json({ error: "Password must be at least 6 characters." }, { status: 400 });
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Sign-up is not configured on the server." }, { status: 500 });
  }

  const { error } = await createAdminClient().auth.admin.createUser({
    email: usernameToEmail(username),
    password,
    email_confirm: true,
    user_metadata: { username },
  });

  if (error) {
    const taken = /already|registered|exists/i.test(error.message);
    return NextResponse.json(
      { error: taken ? "That username is already taken." : error.message },
      { status: taken ? 409 : 400 },
    );
  }

  return NextResponse.json({ ok: true });
}
