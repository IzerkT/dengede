import { Suspense } from "react";
import LoginForm from "./login-form";

export default function LoginPage() {
  return <Suspense fallback={<main className="grid min-h-screen place-items-center bg-[#f6f8f7] text-sm text-slate-500">Yükleniyor...</main>}><LoginForm /></Suspense>;
}
