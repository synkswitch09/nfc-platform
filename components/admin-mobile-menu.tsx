"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";

export function AdminMobileMenu({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  useEffect(() => setOpen(false), [pathname]);
  return <div className="admin-mobile-menu">
    <button type="button" className="admin-menu-toggle" aria-label={open ? "Close admin menu" : "Open admin menu"} aria-expanded={open} aria-controls="admin-navigation" onClick={() => setOpen(value => !value)}>
      {open ? <X size={22} /> : <Menu size={22} />}<span>Menu</span>
    </button>
    <div id="admin-navigation" className="admin-mobile-panel" data-open={open} onClick={event => {
      if ((event.target as HTMLElement).closest("a")) setOpen(false);
    }}>
      {children}
    </div>
  </div>;
}
