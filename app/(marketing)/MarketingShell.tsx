"use client";
import { AuthProvider } from "@/AuthContext";
import { ToastProvider } from "@/Toast";
import Ga4Identity from "@/Ga4Identity";

export default function MarketingShell({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <Ga4Identity />
      <ToastProvider>
        {children}
      </ToastProvider>
    </AuthProvider>
  );
}
