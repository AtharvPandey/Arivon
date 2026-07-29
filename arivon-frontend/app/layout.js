import "./globals.css";

export const metadata = {
  title: "Arivon — School Operating System",
  description: "The digital operating system for schools",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
