"use client";

import { AuthProvider, RequireAuthOnly } from "@/AuthContext";
import { ToastProvider } from "@/Toast";
import { EmployerDataProvider } from "@/employer/EmployerDataContext";
import EmployerShell from "@/employer/EmployerShell";

export default function EmployerLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <ToastProvider>
        <RequireAuthOnly>
          <EmployerDataProvider>
            <EmployerShell>{children}</EmployerShell>
          </EmployerDataProvider>
        </RequireAuthOnly>
      </ToastProvider>
    </AuthProvider>
  );
}
