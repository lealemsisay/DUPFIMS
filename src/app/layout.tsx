import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DUPFIMS | Dilla University",
  description:
    "Dilla University Peace Forum Information Management System",
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
    apple: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
