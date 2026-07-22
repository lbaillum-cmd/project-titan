import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PROJECT TITAN",
  description: "The Worldwide Swap & Trade Platform",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
