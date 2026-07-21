import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "@/providers/theme-provider";
import "./globals.css";
import { Analytics } from "@vercel/analytics/next";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const themeScript = `
(function() {
  try {
    if (localStorage.getItem("domino-theme") === "light") {
      document.documentElement.classList.remove("dark");
    }
  } catch(e) {}
})();
`;

const SITE_URL = "https://domino-occidental-frontend-liart.vercel.app";
const SITE_NAME = "Dominó Occidental";
const TITLE_TEMPLATE = "%s — Dominó Occidental";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} — Dominó doble-9 online por parejas`,
    template: TITLE_TEMPLATE,
  },
  description:
    "Jugá al dominó doble-9 por parejas en tiempo real. Partidas multijugador online, torneos competitivos, ranking ELO y sistema social con amigos. Gratis.",
  keywords: [
    "dominó",
    "domino online",
    "dominó doble 9",
    "dominó por parejas",
    "juego de mesa online",
    "multijugador",
    "torneos",
    "ranking ELO",
    "jugar dominó gratis",
    "dominó argentino",
    "dominó latinoamericano",
  ],
  authors: [{ name: "Dominó Occidental" }],
  creator: "Dominó Occidental",
  publisher: "Dominó Occidental",
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    type: "website",
    locale: "es_AR",
    url: SITE_URL,
    siteName: SITE_NAME,
    title: `${SITE_NAME} — Dominó doble-9 online por parejas`,
    description:
      "Jugá al dominó doble-9 por parejas en tiempo real. Partidas multijugador, torneos, ranking ELO y toda la acción con amigos.",
    images: [
      {
        url: "/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "Dominó Occidental — Juego de dominó online por parejas",
        type: "image/jpg",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} — Dominó doble-9 online por parejas`,
    description:
      "Jugá al dominó doble-9 por parejas en tiempo real. Torneos, ranking ELO y más.",
    images: ["/og-image.jpg"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  alternates: {
    canonical: SITE_URL,
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0f" },
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} dark h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: themeScript previene FOUC, no recibe input de usuario */}
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full flex flex-col">
        <ThemeProvider>{children}</ThemeProvider>
        <Analytics />
      </body>
    </html>
  );
}
