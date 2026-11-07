import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DUPFIMS | Dilla University",
  description:
    "Dilla University Peace Forum Information Management System",
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
