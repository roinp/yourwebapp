"use client";

import { useState } from "react";
// Login is turned off for now — the app opens straight to the dashboard.
// import { useEffect } from "react";
// import { useRouter } from "next/navigation";
// import { isLoggedIn, logOut } from "@/lib/demoAuth";
import Sidebar from "@/components/Sidebar";
import CalculatorModal from "@/components/CalculatorModal";

// Demo version: data stays in this browser.
export default function ClinicLayout({ children }: { children: React.ReactNode }) {
  // const router = useRouter();
  // const [ready, setReady] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [calcOpen, setCalcOpen] = useState(false);

  // useEffect(() => {
  //   if (!isLoggedIn()) router.replace("/login");
  //   // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage is only readable after mount
  //   else setReady(true);
  // }, [router]);
  //
  // if (!ready) {
  //   return (
  //     <div className="flex min-h-screen items-center justify-center text-slate-500">
  //       იტვირთება...
  //     </div>
  //   );
  // }

  return (
    <div className="min-h-screen">
      <Sidebar
        open={menuOpen}
        onNavigate={() => setMenuOpen(false)}
        // onLogout={() => {
        //   logOut();
        //   router.replace("/login");
        // }}
        onCalculator={() => setCalcOpen(true)}
      />
      {menuOpen && (
        <div
          className="fixed inset-0 z-30 bg-slate-900/40 lg:hidden"
          onClick={() => setMenuOpen(false)}
        />
      )}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur lg:hidden">
          <button
            onClick={() => setMenuOpen(true)}
            className="rounded-lg p-2 text-xl hover:bg-slate-100"
            aria-label="მენიუ"
          >
            ☰
          </button>
          <span className="font-semibold">🦷 YOURWEBAPP</span>
        </header>
        <main className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">{children}</main>
        {calcOpen && <CalculatorModal onClose={() => setCalcOpen(false)} />}
      </div>
    </div>
  );
}
