"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { logIn } from "@/lib/demoAuth";

// Demo login: any email/password (or none) opens the dashboard.
export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("demo@yourwebapp.ge");
  const [password, setPassword] = useState("demo1234");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    logIn();
    router.replace("/");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-teal-50 to-slate-100 p-4">
      <form onSubmit={handleSubmit} className="card w-full max-w-sm space-y-4 p-8">
        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-600 text-3xl">
            🦷
          </div>
          <h1 className="mt-4 text-xl font-semibold">YOURWEBAPP</h1>
          <p className="text-sm text-slate-500">თანამშრომლების შესვლა</p>
        </div>
        <div>
          <label className="label">ელ-ფოსტა</label>
          <input
            type="email"
            className="input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div>
          <label className="label">პაროლი</label>
          <input
            type="password"
            className="input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <button className="btn-primary w-full">შესვლა</button>
        <p className="text-center text-xs text-slate-400">დემო ვერსია — შესასვლელად უბრალოდ დააჭირეთ „შესვლა“-ს</p>
      </form>
    </div>
  );
}
