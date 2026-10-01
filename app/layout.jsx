import "./globals.css";

export const metadata = {
    title: "Lecture Player",
};

export default function RootLayout({ children }) {
    return (
        <html lang="en">
            <body>{children}</body>
        </html>
    );
}
