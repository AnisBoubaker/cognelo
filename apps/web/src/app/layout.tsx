import type { Metadata } from "next";
import type { ReactNode } from "react";
import { NotificationProvider } from "@cognelo/activity-ui";
import { AuthProvider } from "@/components/auth-provider";
import { UnsavedChangesProvider } from "@/components/unsaved-changes-provider";
import { I18nProvider } from "@/lib/i18n";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cognelo",
  description: "A modular intelligent tutoring system for programming education.",
  icons: {
    icon: "/icon.png",
    shortcut: "/icon.png",
    apple: "/icon.png"
  }
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <I18nProvider>
            <NotificationProvider>
              <UnsavedChangesProvider>{children}</UnsavedChangesProvider>
            </NotificationProvider>
          </I18nProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
