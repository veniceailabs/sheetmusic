import "./globals.css";

export const metadata = {
  title: "Sheet Music",
  description: "Touch-first digital sheet music workspace"
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
