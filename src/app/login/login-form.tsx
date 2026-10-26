"use client";

import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/browser";
import { useRouter, useSearchParams } from "next/navigation";

export default function LoginForm({ confirmationError = false }: { confirmationError?: boolean }) {
  const router = useRouter();
  const params = useSearchParams();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [message, setMessage] = useState(confirmationError || params.has("error") ? "E-posta doğrulaması tamamlanamadı. Bağlantıyı yenileyip tekrar deneyin." : "");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const supabase = createClient();
    const result = mode === "login"
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password, options: { data: { display_name: displayName }, emailRedirectTo: `${window.location.origin}/auth/callback` } });
    if (result.error) setMessage(result.error.message);
    else if (mode === "signup" && !result.data.session) setMessage("Kayıt tamamlandı. E-postanızdaki doğrulama bağlantısını açın.");
    else router.push("/");
    setBusy(false);
  }

  return <main className="grid min-h-screen place-items-center bg-[#f6f8f7] px-4"><form onSubmit={submit} className="w-full max-w-md rounded-3xl bg-white p-7 shadow-xl shadow-slate-200/60"><div className="mb-7"><p className="text-sm font-semibold text-emerald-600">Dengede</p><h1 className="mt-2 text-3xl font-bold">{mode === "login" ? "Tekrar hoş geldin" : "Hesap oluştur"}</h1><p className="mt-2 text-sm text-slate-500">İki kişilik özel beslenme alanına güvenle devam et.</p></div>{mode === "signup" && <label className="mb-4 block text-sm font-semibold">Adın<input value={displayName} onChange={(e) => setDisplayName(e.target.value)} required minLength={1} maxLength={80} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 font-normal" /></label>}<label className="mb-4 block text-sm font-semibold">E-posta<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 font-normal" /></label><label className="block text-sm font-semibold">Şifre<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 font-normal" /></label>{message && <p role="alert" className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">{message}</p>}<button disabled={busy} className="mt-6 w-full rounded-xl bg-emerald-500 py-3 font-bold text-white disabled:opacity-60">{busy ? "Bekleyin..." : mode === "login" ? "Giriş yap" : "Kayıt ol"}</button><button type="button" onClick={() => { setMode(mode === "login" ? "signup" : "login"); setMessage(""); }} className="mt-4 w-full text-sm font-semibold text-emerald-700">{mode === "login" ? "İlk kez mi? Hesap oluştur" : "Zaten hesabın var mı? Giriş yap"}</button></form></main>;
}
