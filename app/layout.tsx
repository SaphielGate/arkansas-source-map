import type { Metadata } from "next";
import "./styles.css";

export const metadata: Metadata = {
  title: "Arkansas Source Map",
  description: "A research index of public-interest sources in Arkansas.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
