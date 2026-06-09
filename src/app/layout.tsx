import type { Metadata } from "next";
import "./globals.css";
import { Nav } from "@/components/Nav";

export const metadata: Metadata = {
  title: "Iro — Reddit Opportunity Finder",
  description:
    "Read-only, human-in-the-loop tool that surfaces Reddit threads worth a genuinely helpful comment.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <Nav />
        {children}
      </body>
    </html>
  );
}
