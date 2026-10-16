import type { Metadata } from "next";
import { Noto_Sans_Georgian } from "next/font/google";
import "./globals.css";

const georgian = Noto_Sans_Georgian({
  variable: "--font-georgian",
  subsets: ["georgian", "latin"],
});

export const metadata: Metadata = {
  title: "YOURWEBAPP — კლინიკის მართვა",
  description: "სტომატოლოგიური კლინიკის მართვის სისტემა",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ka" className={`${georgian.variable} h-full antialiased`}>
      <body className="min-h-full font-sans">{children}</body>
    </html>
  );
}
