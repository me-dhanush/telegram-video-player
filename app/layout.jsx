import "./globals.css";

export const metadata = {
  title: "Lecture Player",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <script src="https://telegram.org/js/telegram-web-app.js?63"></script>
      </head>

      <body>{children}</body>
    </html>
  );
}
