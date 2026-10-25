"use client";

import { AuthProvider, RequireAuthOnly } from "@/AuthContext";
import { ToastProvider } from "@/Toast";
import Ga4Identity from "@/Ga4Identity";
import { EmployerDataProvider } from "@/employer/EmployerDataContext";
import EmployerShell from "@/employer/EmployerShell";

export default function EmployerLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <Ga4Identity />
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
