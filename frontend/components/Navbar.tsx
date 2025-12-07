"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Database, Settings, TrendingUp, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { PulseIndicator } from "./motion";

const navItems = [
  { href: "/data", label: "Data", icon: Database },
  { href: "/functions", label: "Functions", icon: Settings },
  { href: "/results", label: "Results", icon: TrendingUp },
];

export function Navbar() {
  const pathname = usePathname();

  return (
    <motion.nav
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
      className="fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-sm border-b border-border"
    >
      <div className="max-w-6xl mx-auto px-6">
        <div className="flex items-center justify-between h-14">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 group">
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="w-8 h-8 rounded-lg bg-text-primary flex items-center justify-center transition-all group-hover:shadow-md"
            >
              <Zap className="w-4 h-4 text-white" />
            </motion.div>
            <span className="font-semibold text-lg tracking-tight text-text-primary">
              Eureka
            </span>
          </Link>

          {/* Navigation */}
          <div className="flex items-center gap-1 p-1 rounded-lg bg-surface">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "relative flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-200",
                    isActive
                      ? "text-text-primary"
                      : "text-text-muted hover:text-text-secondary"
                  )}
                >
                  {isActive && (
                    <motion.div
                      layoutId="navbar-active"
                      className="absolute inset-0 bg-background shadow-sm rounded-md border border-border"
                      initial={false}
                      transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    />
                  )}
                  <span className="relative flex items-center gap-2">
                  <Icon className="w-4 h-4" />
                  {item.label}
                  </span>
                </Link>
              );
            })}
          </div>

          {/* Status indicator */}
          <div className="flex items-center gap-2 text-caption text-text-muted">
            <PulseIndicator color="var(--success)" size={6} />
            <span>Ready</span>
          </div>
        </div>
      </div>
    </motion.nav>
  );
}
