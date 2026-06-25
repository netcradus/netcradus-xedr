
// import type { PropsWithChildren } from "react";
// import Sidebar from "./Sidebar/Sidebar";
// import Footer from "./Footer/Footer";

// export default function DashboardLayout({ children }: PropsWithChildren) {
//   return (
//     <div className="flex min-h-screen bg-[#F3F5F9] overflow-hidden">
//       <Sidebar />

//       <div className="flex flex-col flex-1 min-w-0">
//         <main className="flex-1 overflow-y-auto p-6">
//           {children}
//         </main>

//         <Footer />
//       </div>
//     </div>
//   );
// }
import type { PropsWithChildren } from "react";
import Sidebar from "./Sidebar/Sidebar";
import Footer from "./Footer/Footer";

export default function DashboardLayout({ children }: PropsWithChildren) {
  return (
    <div className="min-h-screen bg-[#F3F5F9]">
      {/*
        Sidebar is `fixed` (see Sidebar.tsx) — it takes zero space in normal
        flow, so it CANNOT be a flex sibling of the content column. Instead,
        the content column below reserves space for it manually via
        `lg:ml-60` (240px, matching the sidebar's fixed w-60 width).
      */}
      <Sidebar />

      {/*
        flex flex-col + min-h-screen makes this column at least one full
        viewport tall, so Footer is pushed to the bottom via mt-auto even
        when page content is short. lg:ml-60 only applies at desktop width,
        matching where the sidebar is permanently docked — below `lg` the
        sidebar is an off-canvas drawer and content should use full width.
        overflow-x-hidden guarantees no horizontal scrollbar can ever appear.
      */}
      <div className="flex flex-col min-h-screen lg:ml-60 overflow-x-hidden">
        <main className="flex-1 min-w-0 p-4 sm:p-6 overflow-x-hidden">
          {children}
        </main>

        <Footer />
      </div>
    </div>
  );
}