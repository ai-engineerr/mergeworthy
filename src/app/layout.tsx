import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "Mergeworthy",
  description: "Rank a repository's open pull requests by how ready they are for review, with fast structured judgments."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
