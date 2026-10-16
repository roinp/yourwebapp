"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/", label: "მთავარი", icon: "▦" },
  { href: "/patients", label: "პაციენტები", icon: "☺" },
  { href: "/calendar", label: "კალენდარი", icon: "▤" },
  { href: "/doctors", label: "ექიმები", icon: "✚" },
  { href: "/expenses", label: "ხარჯები", icon: "₾" },
];

export default function Sidebar({
  open,
  onNavigate,
  onLogout,
  onCalculator,
}: {
  open: boolean;
  onNavigate: () => void;
  onLogout: () => void;
  onCalculator: () => void;
}) {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-slate-900 text-slate-200 transition-transform lg:translate-x-0 ${
        open ? "translate-x-0" : "-translate-x-full"
      }`}
    >
      <div className="flex items-center gap-3 px-6 py-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-500 text-xl">
          🦷
        </div>
        <div>
          <p className="font-semibold text-white">YOURWEBAPP</p>
          <p className="text-xs text-slate-400">კლინიკის მართვა</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3">
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
              isActive(item.href)
                ? "bg-teal-600 text-white"
                : "text-slate-300 hover:bg-slate-800 hover:text-white"
            }`}
          >
            <span className="w-5 text-center">{item.icon}</span>
            {item.label}
          </Link>
        ))}
        <button
          type="button"
          onClick={() => {
            onNavigate();
            onCalculator();
          }}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-slate-300 transition hover:bg-slate-800 hover:text-white"
        >
          <span className="w-5 text-center">🧮</span>
          კალკულაცია
        </button>
      </nav>

      <div className="border-t border-slate-800 p-4">
        <p className="text-xs text-slate-400">დემო ვერსია · მონაცემები ინახება ამ ბრაუზერში</p>
        <button
          onClick={onLogout}
          className="mt-2 w-full rounded-lg px-3 py-2 text-left text-sm text-slate-300 hover:bg-slate-800 hover:text-white"
        >
          ⎋ გასვლა
        </button>
      </div>
    </aside>
  );
}
