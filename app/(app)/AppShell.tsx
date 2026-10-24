"use client";
import { AuthProvider, RequireAuth } from "@/AuthContext";
import { ToastProvider } from "@/Toast";
import Ga4Identity from "@/Ga4Identity";

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <Ga4Identity />
      <ToastProvider>
        <RequireAuth>
          {children}
        </RequireAuth>
      </ToastProvider>
    </AuthProvider>
  );
}
