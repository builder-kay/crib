import { useQuery } from "@tanstack/react-query";
import { getPlatformSocialSettings } from "@/lib/api";
import { buildAdminWhatsAppSupportUrl, buildPlatformSocialUrl, formatPlatformSocialHandle } from "@/lib/platform";

const footerSocialClassName: Record<string, string> = {
  Instagram: "app-footer-social app-footer-social-instagram",
  X: "app-footer-social app-footer-social-x",
  TikTok: "app-footer-social app-footer-social-tiktok",
  LinkedIn: "app-footer-social app-footer-social-linkedin",
  Facebook: "app-footer-social app-footer-social-facebook",
  WhatsApp: "app-footer-social app-footer-social-whatsapp"
};

const footerSocialIconClassName: Record<string, string> = {
  Instagram: "app-footer-social-icon-wrap app-footer-social-icon-wrap-instagram",
  X: "app-footer-social-icon-wrap app-footer-social-icon-wrap-x",
  TikTok: "app-footer-social-icon-wrap app-footer-social-icon-wrap-tiktok",
  LinkedIn: "app-footer-social-icon-wrap app-footer-social-icon-wrap-linkedin",
  Facebook: "app-footer-social-icon-wrap app-footer-social-icon-wrap-facebook",
  WhatsApp: "app-footer-social-icon-wrap app-footer-social-icon-wrap-whatsapp"
};

function SocialIcon({ label }: { label: string }) {
  switch (label) {
    case "Instagram":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" className="app-footer-social-icon">
          <path
            fill="currentColor"
            d="M7.75 2h8.5A5.75 5.75 0 0 1 22 7.75v8.5A5.75 5.75 0 0 1 16.25 22h-8.5A5.75 5.75 0 0 1 2 16.25v-8.5A5.75 5.75 0 0 1 7.75 2Zm0 1.8A3.95 3.95 0 0 0 3.8 7.75v8.5a3.95 3.95 0 0 0 3.95 3.95h8.5a3.95 3.95 0 0 0 3.95-3.95v-8.5a3.95 3.95 0 0 0-3.95-3.95h-8.5Zm8.93 1.55a1.07 1.07 0 1 1 0 2.14 1.07 1.07 0 0 1 0-2.14ZM12 7.1A4.9 4.9 0 1 1 7.1 12 4.9 4.9 0 0 1 12 7.1Zm0 1.8A3.1 3.1 0 1 0 15.1 12 3.1 3.1 0 0 0 12 8.9Z"
          />
        </svg>
      );
    case "X":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" className="app-footer-social-icon">
          <path
            fill="currentColor"
            d="M18.9 2H21l-6.54 7.47L22 22h-5.9l-4.62-6.9L5.45 22H3.34l7-8L2 2h6.05l4.17 6.31L18.9 2Zm-2.07 18.2h1.63L7.16 3.7H5.42L16.83 20.2Z"
          />
        </svg>
      );
    case "TikTok":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" className="app-footer-social-icon">
          <path
            fill="currentColor"
            d="M13.62 2h2.64c.23 1.93 1.37 3.73 3.06 4.66.93.53 2.02.8 3.08.78v2.73a8.28 8.28 0 0 1-4.82-1.52l-.02 6.33a6.2 6.2 0 0 1-1.11 3.52 6.4 6.4 0 0 1-5.14 2.5 6.45 6.45 0 0 1-3.78-11.7 6.54 6.54 0 0 1 3.92-1.27c.22 0 .44.01.66.04v2.8a3.67 3.67 0 0 0-.67-.07 3.7 3.7 0 0 0-2.29 6.6 3.67 3.67 0 0 0 2.3.77 3.7 3.7 0 0 0 3.48-2.5c.14-.41.22-.84.22-1.28L13.62 2Z"
          />
        </svg>
      );
    case "LinkedIn":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" className="app-footer-social-icon">
          <path
            fill="currentColor"
            d="M4.98 3.5A1.74 1.74 0 1 1 3.24 5.24 1.74 1.74 0 0 1 4.98 3.5ZM3.5 8.25h2.95V20.5H3.5Zm4.8 0h2.82v1.67h.04a3.1 3.1 0 0 1 2.79-1.53c2.98 0 3.53 1.96 3.53 4.5v7.61h-2.94v-6.74c0-1.61-.03-3.67-2.24-3.67-2.24 0-2.58 1.75-2.58 3.56v6.85H8.3Z"
          />
        </svg>
      );
    case "Facebook":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" className="app-footer-social-icon">
          <path
            fill="currentColor"
            d="M13.5 22v-8.03h2.7l.4-3.14H13.5V8.82c0-.91.25-1.53 1.56-1.53h1.67V4.48c-.29-.04-1.28-.12-2.43-.12-2.4 0-4.05 1.46-4.05 4.16v2.31H7.5v3.14h2.75V22Z"
          />
        </svg>
      );
    case "WhatsApp":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" className="app-footer-social-icon">
          <path
            fill="currentColor"
            d="M12.04 2A9.9 9.9 0 0 0 3.6 17.1L2 22l5.03-1.56A9.95 9.95 0 1 0 12.04 2Zm0 18.07a8.15 8.15 0 0 1-4.16-1.14l-.3-.18-2.99.93.98-2.91-.19-.3a8.16 8.16 0 1 1 6.66 3.6Zm4.48-6.1c-.24-.12-1.4-.69-1.62-.77-.22-.08-.38-.12-.55.12-.16.24-.63.77-.77.93-.14.16-.29.18-.53.06a6.64 6.64 0 0 1-1.95-1.2 7.26 7.26 0 0 1-1.35-1.67c-.14-.24-.02-.37.1-.49.11-.11.24-.29.36-.43.12-.14.16-.24.24-.4.08-.16.04-.3-.02-.43-.06-.12-.55-1.33-.75-1.83-.2-.47-.4-.41-.55-.42h-.46c-.16 0-.43.06-.65.3s-.86.84-.86 2.04.88 2.36 1 2.53c.12.16 1.73 2.65 4.19 3.71.59.25 1.06.4 1.42.52.6.19 1.14.16 1.56.1.48-.07 1.4-.57 1.6-1.12.2-.55.2-1.03.14-1.13-.06-.1-.22-.16-.46-.28Z"
          />
        </svg>
      );
    default:
      return null;
  }
}

export function AppFooter() {
  const platformSocialSettingsQuery = useQuery({
    queryKey: ["platform-social-settings"],
    queryFn: getPlatformSocialSettings
  });
  const whatsappUrl = buildAdminWhatsAppSupportUrl(
    platformSocialSettingsQuery.data?.admin_whatsapp_number ?? "",
    platformSocialSettingsQuery.data?.admin_whatsapp_message ?? ""
  );
  const supportEmail = platformSocialSettingsQuery.data?.support_email?.trim() || null;

  const socialLinks = [
    {
      label: "Instagram",
      href: buildPlatformSocialUrl("instagram", platformSocialSettingsQuery.data?.instagram_handle ?? ""),
      handle: formatPlatformSocialHandle("instagram", platformSocialSettingsQuery.data?.instagram_handle ?? "")
    },
    {
      label: "X",
      href: buildPlatformSocialUrl("x", platformSocialSettingsQuery.data?.x_handle ?? ""),
      handle: formatPlatformSocialHandle("x", platformSocialSettingsQuery.data?.x_handle ?? "")
    },
    {
      label: "TikTok",
      href: buildPlatformSocialUrl("tiktok", platformSocialSettingsQuery.data?.tiktok_handle ?? ""),
      handle: formatPlatformSocialHandle("tiktok", platformSocialSettingsQuery.data?.tiktok_handle ?? "")
    },
    {
      label: "LinkedIn",
      href: buildPlatformSocialUrl("linkedin", platformSocialSettingsQuery.data?.linkedin_handle ?? ""),
      handle: formatPlatformSocialHandle("linkedin", platformSocialSettingsQuery.data?.linkedin_handle ?? "")
    },
    {
      label: "Facebook",
      href: buildPlatformSocialUrl("facebook", platformSocialSettingsQuery.data?.facebook_handle ?? ""),
      handle: formatPlatformSocialHandle("facebook", platformSocialSettingsQuery.data?.facebook_handle ?? "")
    },
    {
      label: "WhatsApp",
      href: buildPlatformSocialUrl("whatsapp", platformSocialSettingsQuery.data?.whatsapp_channel ?? ""),
      handle: formatPlatformSocialHandle("whatsapp", platformSocialSettingsQuery.data?.whatsapp_channel ?? "")
    }
  ];

  return (
    <footer className="app-footer border-t border-sand-200">
      <div className="mx-auto w-full max-w-[1400px] px-4 py-6 md:px-6 lg:py-8">
        <div className="grid gap-6 lg:grid-cols-[1.25fr,0.95fr] lg:gap-10">
          <section className="space-y-3">
            <div className="flex items-center gap-3">
              <img src="/crib-logo.png" alt="CRIB logo" className="h-11 w-11 rounded-2xl object-cover" />
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cobalt-700">CRIB</p>
                <h2 className="font-display text-2xl font-bold text-ink">Creative storefronts for templates that travel.</h2>
              </div>
            </div>
            <p className="max-w-xl text-sm text-sand-700">
              Buy, sell, and grow creative products with a marketplace built around profiles, editable files, and trusted delivery.
            </p>
            <div className="pt-1">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cobalt-700">Socials</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {socialLinks.map((item) =>
                  item.href ? (
                    <a
                      key={item.label}
                      href={item.href}
                      target="_blank"
                      rel="noreferrer"
                      className={footerSocialClassName[item.label] ?? "app-footer-social"}
                    >
                      <span className={footerSocialIconClassName[item.label] ?? "app-footer-social-icon-wrap"}>
                        <SocialIcon label={item.label} />
                      </span>
                      <span>{item.label}</span>
                    </a>
                  ) : (
                    <span key={item.label} className="app-footer-social-disabled" title={item.handle || `${item.label} not set`}>
                      <span className={footerSocialIconClassName[item.label] ?? "app-footer-social-icon-wrap"}>
                        <SocialIcon label={item.label} />
                      </span>
                      <span>{item.label}</span>
                    </span>
                  )
                )}
              </div>
            </div>
          </section>

          <section className="space-y-3 border-t border-sand-200 pt-4 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cobalt-700">Need help?</p>
            <p className="max-w-md text-sm text-sand-700">Reach the admin team for support, payouts, or marketplace help.</p>
            <div className="flex flex-wrap gap-2">
              {whatsappUrl ? (
                <a href={whatsappUrl} target="_blank" rel="noreferrer" className="rounded-full bg-forest-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-forest-700">
                  Chat with admin on WhatsApp
                </a>
              ) : (
                <span className="rounded-full border border-sand-200 bg-sand-100 px-4 py-2 text-sm font-semibold text-sand-500">
                  WhatsApp admin
                </span>
              )}
              {supportEmail ? (
                <a
                  href={`mailto:${supportEmail}`}
                  className="rounded-full border border-sand-300 bg-white px-4 py-2 text-sm font-semibold text-ink transition hover:border-cobalt-200 hover:bg-cobalt-50"
                >
                  Email support
                </a>
              ) : null}
            </div>
          </section>
        </div>
      </div>

      <div className="border-t border-sand-200/90">
        <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-2 px-4 py-4 text-xs text-sand-600 md:flex-row md:items-center md:justify-between md:px-6">
          <p>Built for creative commerce across Africa.</p>
          <p className="font-medium text-sand-700">Copyright 2026 CRIB</p>
        </div>
      </div>
    </footer>
  );
}
