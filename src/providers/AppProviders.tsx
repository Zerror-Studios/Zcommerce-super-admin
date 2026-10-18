import { ApolloProvider } from "@apollo/client";
import { HeroUIProvider } from "@heroui/react";
import { useEffect, type ReactNode } from "react";
import { useHref, useNavigate } from "react-router-dom";
import { AuthProvider } from "./AuthProvider";
import { ClientsProvider } from "./ClientsProvider";
import { SettingsProvider } from "./SettingsProvider";
import { AppToastProvider } from "../components/ui/AppToastProvider";
import { client } from "../lib/apollo-client";
import { onNavigationRequest } from "../lib/navigation-events";

interface AppProvidersProps {
  children: ReactNode;
}

export function AppProviders({ children }: AppProvidersProps) {
  const navigate = useNavigate();

  useEffect(() => {
    document.documentElement.classList.remove("dark");
    localStorage.removeItem("zcommerce-theme");
  }, []);

  // The Apollo error link routes MFA_REQUIRED to /mfa through this (review C-M5).
  useEffect(() => onNavigationRequest((path) => navigate(path)), [navigate]);

  return (
    <HeroUIProvider
      navigate={navigate}
      useHref={useHref}
      reducedMotion="user"
      locale="en-IN"
    >
      <AppToastProvider />
      {/* One Apollo client for the whole console (PRD-005 FR-11.1). */}
      <ApolloProvider client={client}>
        <AuthProvider>
          <SettingsProvider>
            <ClientsProvider>
              {children}
            </ClientsProvider>
          </SettingsProvider>
        </AuthProvider>
      </ApolloProvider>
    </HeroUIProvider>
  );
}
