import type { Metadata } from "next";

import localFont from "next/font/local";

import "./globals.css";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  display: "swap",
});

const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Sistema Comercial",
    template: "%s · Sistema Comercial",
  },
  description:
    "Plataforma privada para la gestión comercial y seguimiento de órdenes.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body
        className={`${geistSans.variable} ${geistMono.variable} min-h-dvh antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
