import { Outlet } from "react-router-dom";
import { Navbar } from "@/components/Navbar";

export function AppLayout() {
  return (
    <div className="min-h-screen bg-sand-50 text-ink">
      <Navbar />
      <main className="mx-auto w-full max-w-[1400px] px-4 py-6 md:px-6 md:py-8">
        <Outlet />
      </main>
      <footer className="border-t border-sand-200 bg-white/80">
        <div className="mx-auto w-full max-w-[1400px] px-4 py-4 text-center text-xs text-sand-600 md:px-6">
          <p className="font-semibold text-sand-700">Built and Managed by Team Byant</p>
          <p className="mt-1">Copyright 2026</p>
        </div>
      </footer>
    </div>
  );
}
