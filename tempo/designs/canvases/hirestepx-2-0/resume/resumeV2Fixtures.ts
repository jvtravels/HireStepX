/* ResumeV2 canvas — mock context values fed into the real ResumeV2
   component. AuthProvider/DashboardProvider perform live Supabase network
   calls (unsuitable for canvas mode), so we supply the raw context values
   directly instead of rendering those providers. */
import type { AuthContextType, User } from "@/AuthContext";
import type { UIContextValue } from "@/DashboardContext";

export const MOCK_USER: User = {
  id: "canvas-user-1",
  name: "Priya Narayan",
  email: "priya.narayan@example.com",
  targetRole: "Staff Engineer",
  resumeFileName: "priya-narayan-resume.pdf",
  hasCompletedOnboarding: true,
  subscriptionTier: "starter",
  emailVerified: true,
};

export const MOCK_AUTH_VALUE: AuthContextType = {
  user: MOCK_USER,
  isLoggedIn: true,
  loading: false,
  login: async () => ({ success: true }),
  signup: async () => ({ success: true }),
  loginWithGoogle: async () => ({ success: true }),
  logout: async () => {},
  updateUser: async () => {},
  resetPassword: async () => ({ success: true }),
};

export const MOCK_UI_VALUE: UIContextValue = {
  showUpgradeModal: false,
  setShowUpgradeModal: () => {},
  dataLoading: false,
  isMobile: false,
  paymentBanner: null,
  setPaymentBanner: () => {},
  syncError: "",
  setSyncError: () => {},
  toast: null,
  showToast: () => {},
  refreshCreditBalance: () => {},
  setCreditBalanceDirect: () => {},
};
