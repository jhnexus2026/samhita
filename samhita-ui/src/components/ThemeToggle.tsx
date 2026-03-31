"use client";

import { useTheme } from "@/components/ThemeProvider";
import { Sun, Moon } from "lucide-react";

interface ThemeToggleProps {
  className?: string;
  size?: "sm" | "md";
}

export function ThemeToggle({ className = "", size = "md" }: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme();

  const sizeClasses = size === "sm" ? "h-8 w-8" : "h-9 w-9";
  const iconSize = size === "sm" ? "h-4 w-4" : "h-[18px] w-[18px]";

  return (
    <button
      onClick={toggleTheme}
      className={`${sizeClasses} rounded-xl flex items-center justify-center transition-all duration-300 
        bg-neutral-100 dark:bg-white/10 
        hover:bg-neutral-200 dark:hover:bg-white/20 
        text-neutral-600 dark:text-neutral-300
        hover:scale-105 active:scale-95
        border border-neutral-200/50 dark:border-white/10
        shadow-sm
        ${className}`}
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
      title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
    >
      {theme === "dark" ? (
        <Sun className={`${iconSize} transition-transform duration-300`} />
      ) : (
        <Moon className={`${iconSize} transition-transform duration-300`} />
      )}
    </button>
  );
}
