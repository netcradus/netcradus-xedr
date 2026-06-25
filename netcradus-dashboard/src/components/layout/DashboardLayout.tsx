
import type { PropsWithChildren } from "react";
import Sidebar from "./Sidebar/Sidebar";
import Footer from "./Footer/Footer";

export default function DashboardLayout({ children }: PropsWithChildren) {
  return (
    <div className="flex min-h-screen bg-[#F3F5F9] overflow-hidden">
      <Sidebar />

      <div className="flex flex-col flex-1 min-w-0">
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>

        <Footer />
      </div>
    </div>
  );
}