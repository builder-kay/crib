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
                      {item.label}
                    </a>
                  ) : (
                    <span key={item.label} className="app-footer-social-disabled" title={item.handle || `${item.label} not set`}>
                      {item.label}
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
