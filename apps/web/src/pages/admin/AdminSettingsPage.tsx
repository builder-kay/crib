import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ActionConfirmationModal } from "@/components/ActionConfirmationModal";
import { getPlatformSocialSettings, updatePlatformSocialSettings } from "@/lib/api";
import { buildAdminWhatsAppSupportUrl, buildPlatformSocialUrl, formatAdminWhatsAppNumber, formatPlatformSocialHandle } from "@/lib/platform";
import { useToast } from "@/components/Toast";
import { SectionHeader, SummaryPill, useAdminWorkspace } from "@/pages/admin/AdminWorkspace";

export function AdminSettingsPage() {
  const { overview } = useAdminWorkspace();
  const queryClient = useQueryClient();
  const { pushToast } = useToast();
  const [instagramHandle, setInstagramHandle] = useState("");
  const [xHandle, setXHandle] = useState("");
  const [tiktokHandle, setTiktokHandle] = useState("");
  const [linkedinHandle, setLinkedinHandle] = useState("");
  const [facebookHandle, setFacebookHandle] = useState("");
  const [whatsAppChannel, setWhatsAppChannel] = useState("");
  const [supportEmail, setSupportEmail] = useState("");
  const [adminWhatsAppNumber, setAdminWhatsAppNumber] = useState("");
  const [adminWhatsAppMessage, setAdminWhatsAppMessage] = useState("");
  const [confirmSaveOpen, setConfirmSaveOpen] = useState(false);

  const platformSettingsQuery = useQuery({
    queryKey: ["platform-social-settings"],
    queryFn: getPlatformSocialSettings
  });

  useEffect(() => {
    if (!platformSettingsQuery.data) {
      return;
    }

    setInstagramHandle(platformSettingsQuery.data.instagram_handle);
    setXHandle(platformSettingsQuery.data.x_handle);
    setTiktokHandle(platformSettingsQuery.data.tiktok_handle);
    setLinkedinHandle(platformSettingsQuery.data.linkedin_handle);
    setFacebookHandle(platformSettingsQuery.data.facebook_handle);
    setWhatsAppChannel(platformSettingsQuery.data.whatsapp_channel);
    setSupportEmail(platformSettingsQuery.data.support_email);
    setAdminWhatsAppNumber(platformSettingsQuery.data.admin_whatsapp_number);
    setAdminWhatsAppMessage(platformSettingsQuery.data.admin_whatsapp_message);
  }, [platformSettingsQuery.data]);

  const configuredCount = useMemo(
    () =>
      [
        instagramHandle,
        xHandle,
        tiktokHandle,
        linkedinHandle,
        facebookHandle,
        whatsAppChannel,
        supportEmail,
        adminWhatsAppNumber,
        adminWhatsAppMessage
      ].filter((value) => value.trim().length > 0).length,
    [adminWhatsAppMessage, adminWhatsAppNumber, facebookHandle, instagramHandle, linkedinHandle, supportEmail, tiktokHandle, whatsAppChannel, xHandle]
  );

  const settingsMutation = useMutation({
    mutationFn: () =>
      updatePlatformSocialSettings({
        instagram_handle: instagramHandle,
        x_handle: xHandle,
        tiktok_handle: tiktokHandle,
        linkedin_handle: linkedinHandle,
        facebook_handle: facebookHandle,
        whatsapp_channel: whatsAppChannel,
        support_email: supportEmail,
        admin_whatsapp_number: adminWhatsAppNumber,
        admin_whatsapp_message: adminWhatsAppMessage
      }),
    onSuccess: async (result) => {
      setInstagramHandle(result.instagram_handle);
      setXHandle(result.x_handle);
      setTiktokHandle(result.tiktok_handle);
      setLinkedinHandle(result.linkedin_handle);
      setFacebookHandle(result.facebook_handle);
      setWhatsAppChannel(result.whatsapp_channel);
      setSupportEmail(result.support_email);
      setAdminWhatsAppNumber(result.admin_whatsapp_number);
      setAdminWhatsAppMessage(result.admin_whatsapp_message);
      pushToast("Platform contact settings updated", "success");
      await queryClient.invalidateQueries({ queryKey: ["platform-social-settings"] });
    },
    onError: (error) => {
      pushToast(error instanceof Error ? error.message : "Could not update platform settings", "error");
    }
  });

  const socialPreview = [
    {
      label: "Instagram",
      handle: formatPlatformSocialHandle("instagram", instagramHandle),
      url: buildPlatformSocialUrl("instagram", instagramHandle)
    },
    {
      label: "X",
      handle: formatPlatformSocialHandle("x", xHandle),
      url: buildPlatformSocialUrl("x", xHandle)
    },
    {
      label: "TikTok",
      handle: formatPlatformSocialHandle("tiktok", tiktokHandle),
      url: buildPlatformSocialUrl("tiktok", tiktokHandle)
    },
    {
      label: "LinkedIn",
      handle: formatPlatformSocialHandle("linkedin", linkedinHandle),
      url: buildPlatformSocialUrl("linkedin", linkedinHandle)
    },
    {
      label: "Facebook",
      handle: formatPlatformSocialHandle("facebook", facebookHandle),
      url: buildPlatformSocialUrl("facebook", facebookHandle)
    },
    {
      label: "WhatsApp",
      handle: formatPlatformSocialHandle("whatsapp", whatsAppChannel),
      url: buildPlatformSocialUrl("whatsapp", whatsAppChannel)
    }
  ];
  const supportPreview = [
    {
      label: "Support email",
      value: supportEmail.trim(),
      url: supportEmail.trim() ? `mailto:${supportEmail.trim()}` : ""
    },
    {
      label: "Admin WhatsApp",
      value: formatAdminWhatsAppNumber(adminWhatsAppNumber),
      url: buildAdminWhatsAppSupportUrl(adminWhatsAppNumber, adminWhatsAppMessage) ?? ""
    },
    {
      label: "WhatsApp message",
      value: adminWhatsAppMessage.trim(),
      url: ""
    }
  ];

  return (
    <section className="admin-platform-shell space-y-5">
      <header className="surface-card-vivid admin-hero-panel p-5 md:p-6">
        <div className="admin-page-hero-grid">
          <div className="max-w-4xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cobalt-700">Public Platform Settings</p>
            <h2 className="mt-2 font-display text-3xl font-bold text-ink md:text-4xl">Settings</h2>
            <p className="mt-2 text-sm text-sand-700 md:text-base">
              Manage the marketplace social links and support contact buttons here instead of keeping them in the frontend env file. You can paste handles, profile URLs, direct admin contact details, and your support inbox.
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              <span className="admin-chip admin-chip-cobalt">Footer socials</span>
              <span className="admin-chip admin-chip-lagoon">Support actions</span>
              <span className="admin-chip admin-chip-sunset">Public contact paths</span>
            </div>
          </div>

          <aside className="admin-page-hero-rail">
            <div className="admin-hero-rail-summary-grid">
              <SummaryPill label="Configured fields" value={`${configuredCount}/9`} tone="cobalt" />
              <SummaryPill label="Platform admins" value={overview ? `${overview.total_admins}` : "..."} tone="sunset" />
              <SummaryPill label="Published assets" value={overview ? `${overview.published_assets}` : "..."} tone="forest" />
            </div>
          </aside>
        </div>
      </header>

      <div className="space-y-5">
        <section className="surface-card admin-panel p-5">
          <SectionHeader
            eyebrow="Footer and support"
            title="Set public platform contact details"
            body="These values power the social pills and support buttons in the site footer, so buyers and creators always see the latest official contact paths."
          />

          <form
            className="mt-4 space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              setConfirmSaveOpen(true);
            }}
          >
            <div className="admin-form-section">
              <div className="admin-form-section-header">
                <p className="admin-form-section-eyebrow">Social Channels</p>
                <p className="admin-form-section-copy">These values drive the public social pills in the footer.</p>
              </div>

              <div className="space-y-3">
                <label className="admin-input-group">
                  <span>Instagram handle</span>
                  <input
                    value={instagramHandle}
                    onChange={(event) => setInstagramHandle(event.target.value)}
                    placeholder="@crib or https://instagram.com/crib"
                    className="admin-input"
                  />
                </label>

                <label className="admin-input-group">
                  <span>X handle</span>
                  <input
                    value={xHandle}
                    onChange={(event) => setXHandle(event.target.value)}
                    placeholder="@crib or https://x.com/crib"
                    className="admin-input"
                  />
                </label>

                <label className="admin-input-group">
                  <span>TikTok handle</span>
                  <input
                    value={tiktokHandle}
                    onChange={(event) => setTiktokHandle(event.target.value)}
                    placeholder="@crib or https://www.tiktok.com/@crib"
                    className="admin-input"
                  />
                </label>

                <label className="admin-input-group">
                  <span>LinkedIn page</span>
                  <input
                    value={linkedinHandle}
                    onChange={(event) => setLinkedinHandle(event.target.value)}
                    placeholder="company/crib or https://linkedin.com/company/crib"
                    className="admin-input"
                  />
                </label>

                <label className="admin-input-group">
                  <span>Facebook page</span>
                  <input
                    value={facebookHandle}
                    onChange={(event) => setFacebookHandle(event.target.value)}
                    placeholder="crib or https://facebook.com/crib"
                    className="admin-input"
                  />
                </label>

                <label className="admin-input-group">
                  <span>WhatsApp channel</span>
                  <input
                    value={whatsAppChannel}
                    onChange={(event) => setWhatsAppChannel(event.target.value)}
                    placeholder="https://whatsapp.com/channel/... or +233..."
                    className="admin-input"
                  />
                </label>
              </div>
            </div>

            <div className="admin-form-section">
              <div className="admin-form-section-header">
                <p className="admin-form-section-eyebrow">Support Buttons</p>
                <p className="admin-form-section-copy">These power the footer actions for direct help requests.</p>
              </div>

              <label className="admin-input-group">
                <span>Support email</span>
                <input
                  type="email"
                  value={supportEmail}
                  onChange={(event) => setSupportEmail(event.target.value)}
                  placeholder="cribafrica@gmail.com"
                  className="admin-input"
                />
              </label>

              <label className="admin-input-group">
                <span>Admin WhatsApp number</span>
                <input
                  value={adminWhatsAppNumber}
                  onChange={(event) => setAdminWhatsAppNumber(event.target.value)}
                  placeholder="+233507438971"
                  className="admin-input"
                />
              </label>

              <label className="admin-input-group">
                <span>Admin WhatsApp message</span>
                <textarea
                  value={adminWhatsAppMessage}
                  onChange={(event) => setAdminWhatsAppMessage(event.target.value)}
                  placeholder="Hi Crib admin, I need help with the marketplace."
                  className="admin-input min-h-[120px] resize-y"
                />
              </label>
            </div>

            <button type="submit" disabled={settingsMutation.isPending || platformSettingsQuery.isLoading} className="admin-action-button admin-action-button-full">
              {settingsMutation.isPending ? "Saving settings..." : "Save platform settings"}
            </button>

            <p className="text-xs text-sand-600">Leave any field empty if you want that social pill or support action to stay disabled. If the admin WhatsApp message is blank, the default help text will still be used.</p>
          </form>
        </section>

        <div className="space-y-5">
          <section className="surface-card admin-panel p-5">
            <SectionHeader eyebrow="Live preview" title="See what the footer will use" body="As soon as you save, these values become the source of truth for the public footer socials and support actions." />
            <div className="mt-4 space-y-3">
              {socialPreview.map((item) => (
                <div key={item.label} className="admin-compact-row admin-compact-row-stack">
                  <span className="text-sm font-semibold text-ink">{item.label}</span>
                  <span className="text-xs text-sand-600">{item.handle || "Not set yet"}</span>
                  <span className="text-xs text-cobalt-700">{item.url || "Footer pill will stay disabled until you save a handle."}</span>
                </div>
              ))}
              {supportPreview.map((item) => (
                <div key={item.label} className="admin-compact-row admin-compact-row-stack">
                  <span className="text-sm font-semibold text-ink">{item.label}</span>
                  <span className="text-xs text-sand-600">{item.value || "Not set yet"}</span>
                  <span className="text-xs text-cobalt-700">
                    {item.url || (item.label === "WhatsApp message" ? "This copy is sent when someone starts a WhatsApp chat from the footer." : "Footer action will stay disabled until you save a value.")}
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section className="surface-card admin-panel p-5">
            <SectionHeader eyebrow="Why this changed" title="Manage contact paths without code edits" body="The footer now reads these values from the database, so admins can update public support details from the back office instead of editing env variables." />
          </section>
        </div>
      </div>

      <ActionConfirmationModal
        open={confirmSaveOpen}
        tone="cobalt"
        eyebrow="Save Platform Settings"
        title="Update the public footer and support settings?"
        description="This will replace the current public social and support contact values with the details shown below."
        confirmLabel="Save settings"
        isPending={settingsMutation.isPending}
        onClose={() => {
          if (!settingsMutation.isPending) {
            setConfirmSaveOpen(false);
          }
        }}
        onConfirm={() => {
          setConfirmSaveOpen(false);
          settingsMutation.mutate();
        }}
        details={
          <div className="grid gap-3 sm:grid-cols-3">
            {[...socialPreview, ...supportPreview].map((item) => (
              <div key={item.label} className="action-confirm-stat">
                <p className="action-confirm-stat-label">{item.label}</p>
                <p className="action-confirm-stat-value">{("handle" in item ? item.handle : item.value) || "Disabled"}</p>
              </div>
            ))}
          </div>
        }
      />
    </section>
  );
}
