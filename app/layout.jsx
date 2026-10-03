import "./globals.css";
// import "./videos.css";

export const metadata = {
  title: "Lecture Player",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
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
