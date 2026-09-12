import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { OFFICE_COOKIE, passcodeMatches, signSession } from "@/lib/office-auth";

export const dynamic = "force-dynamic";

async function login(formData: FormData) {
  "use server";
  const code = String(formData.get("passcode") ?? "");
  const next = String(formData.get("next") ?? "/office");
  if (!passcodeMatches(code)) redirect(`/office/login?error=1&next=${encodeURIComponent(next)}`);
  const jar = await cookies();
  jar.set(OFFICE_COOKIE, signSession(), { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 30 * 24 * 3600 });
  redirect(next.startsWith("/office") ? next : "/office");
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; next?: string }> }) {
  const sp = await searchParams;
  return (
    <div className="min-h-[70vh] flex items-center justify-center">
      <form action={login} className="bg-white rounded-xl shadow p-6 w-full max-w-sm space-y-4">
        <h1 className="text-xl font-semibold">Office sign-in</h1>
        {sp.error && <p className="text-sm text-red-600">That passcode didn&apos;t match.</p>}
        <input type="hidden" name="next" value={sp.next ?? "/office"} />
        <input name="passcode" type="password" inputMode="numeric" autoFocus placeholder="Passcode" className="w-full border rounded-lg px-3 py-3 text-lg" />
        <button className="w-full bg-stone-900 text-white rounded-lg py-3 font-medium">Open the office</button>
      </form>
    </div>
  );
}
