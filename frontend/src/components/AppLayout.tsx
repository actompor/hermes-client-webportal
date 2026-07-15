import { NavLink, Outlet } from "react-router-dom";

const navClass = ({ isActive }: { isActive: boolean }) =>
  [
    "rounded-lg px-3.5 py-2 text-sm font-medium transition-colors",
    isActive
      ? "bg-brand-soft text-brand"
      : "text-mist hover:bg-white/70 hover:text-ink",
  ].join(" ");

export default function AppLayout() {
  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200/80 bg-white/75 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-baseline gap-2.5">
            <span className="text-xl font-bold tracking-tight text-sky-950">ecept</span>
            <span className="text-xl font-medium text-brand">Hermes</span>
            <span className="hidden text-xs text-mist sm:inline">Web Client</span>
          </div>
          <nav className="flex items-center gap-1">
            <NavLink to="/" end className={navClass}>
              Communicate
            </NavLink>
            <NavLink to="/history" className={navClass}>
              History
            </NavLink>
            <NavLink to="/settings" className={navClass}>
              Settings
            </NavLink>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-6">
        <Outlet />
      </main>
    </div>
  );
}
