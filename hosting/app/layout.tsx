import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Les Cafés de Paris",
  description: "Culture des cafés, lectures choisies et lieux adaptés à votre moment à Paris.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
