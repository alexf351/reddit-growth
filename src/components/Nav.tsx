import Link from "next/link";

const links = [
  { href: "/", label: "Inbox" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/competitors", label: "Competitor Intel" },
  { href: "/status", label: "Status" },
];

export function Nav() {
  return (
    <nav className="border-b border-zinc-800">
      <div className="mx-auto flex max-w-5xl items-center gap-6 px-6 py-3">
        <span className="text-sm font-semibold tracking-tight">Iro · Reddit</span>
        <div className="flex gap-4 text-sm text-zinc-400">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="hover:text-zinc-100">
              {l.label}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}
