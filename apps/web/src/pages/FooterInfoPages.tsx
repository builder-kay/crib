import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { getPlatformSocialSettings } from "@/lib/api";
import { buildAdminWhatsAppSupportUrl } from "@/lib/platform";

const LAST_UPDATED_LABEL = "April 7, 2026";

function useSupportLinks() {
  const platformSettingsQuery = useQuery({
    queryKey: ["platform-social-settings"],
    queryFn: getPlatformSocialSettings
  });

  const supportEmail = platformSettingsQuery.data?.support_email?.trim() || "";
  const whatsappUrl = buildAdminWhatsAppSupportUrl(
    platformSettingsQuery.data?.admin_whatsapp_number ?? "",
    platformSettingsQuery.data?.admin_whatsapp_message ?? ""
  );

  return { supportEmail, whatsappUrl };
}

function FooterInfoLayout({
  eyebrow,
  title,
  lede,
  actions,
  children,
  aside
}: {
  eyebrow: string;
  title: string;
  lede: string;
  actions?: ReactNode;
  children: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <div className="space-y-6">
      <header className="surface-card-vivid subtle-pattern relative overflow-hidden p-6 md:p-8">
        <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-cobalt-100/60 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 left-10 h-40 w-40 rounded-full bg-lagoon-100/60 blur-3xl" />

        <div className="relative z-10 max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cobalt-700">{eyebrow}</p>
          <h1 className="mt-2 font-display text-3xl font-bold text-ink md:text-4xl">{title}</h1>
          <p className="mt-3 text-sm leading-6 text-sand-700 md:text-base">{lede}</p>

          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-sand-600">
            <span className="rounded-full border border-sand-200 bg-white px-3 py-1">Official Crib page</span>
            <span className="rounded-full border border-sand-200 bg-white px-3 py-1">Last updated {LAST_UPDATED_LABEL}</span>
          </div>

          {actions ? <div className="mt-5 flex flex-wrap gap-3">{actions}</div> : null}
        </div>
      </header>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.75fr),minmax(18rem,0.95fr)]">
        <div className="space-y-4">{children}</div>
        {aside ? <aside className="space-y-4">{aside}</aside> : null}
      </div>
    </div>
  );
}

function InfoSection({ eyebrow, title, children }: { eyebrow?: string; title: string; children: ReactNode }) {
  return (
    <section className="surface-card p-5 md:p-6">
      {eyebrow ? <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cobalt-700">{eyebrow}</p> : null}
      <h2 className="mt-2 font-display text-2xl font-bold text-ink">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-7 text-sand-700 md:text-[0.96rem]">{children}</div>
    </section>
  );
}

function InfoList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={item} className="flex gap-3">
          <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-cobalt-500" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function SupportAside() {
  const { supportEmail, whatsappUrl } = useSupportLinks();

  return (
    <>
      <section className="surface-card p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cobalt-700">Quick links</p>
        <div className="mt-4 flex flex-col gap-2">
          <Link to="/terms-of-use" className="app-footer-link text-center">
            TOU
          </Link>
          <Link to="/privacy" className="app-footer-link text-center">
            Privacy
          </Link>
          <Link to="/community" className="app-footer-link text-center">
            Community
          </Link>
        </div>
      </section>

      <section className="surface-card p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cobalt-700">Need help?</p>
        <p className="mt-3 text-sm leading-6 text-sand-700">Reach the Crib support team for order issues, creator safety, payout questions, or account help.</p>
        <div className="mt-4 flex flex-col gap-2">
          {whatsappUrl ? (
            <a href={whatsappUrl} target="_blank" rel="noreferrer" className="rounded-full bg-forest-600 px-4 py-2 text-center text-sm font-semibold text-white transition hover:bg-forest-700">
              Chat on WhatsApp
            </a>
          ) : null}
          {supportEmail ? (
            <a href={`mailto:${supportEmail}`} className="rounded-full border border-sand-300 bg-white px-4 py-2 text-center text-sm font-semibold text-ink transition hover:border-cobalt-200 hover:bg-cobalt-50">
              Email support
            </a>
          ) : null}
          {!whatsappUrl && !supportEmail ? (
            <p className="rounded-2xl border border-sand-200 bg-sand-50 px-4 py-3 text-sm text-sand-600">Support contact options are being updated by the Crib admin team.</p>
          ) : null}
        </div>
      </section>
    </>
  );
}

function PrivacyChoicesActions() {
  const { supportEmail, whatsappUrl } = useSupportLinks();

  return (
    <>
      {supportEmail ? (
        <a
          href={`mailto:${supportEmail}?subject=${encodeURIComponent("Crib privacy choice request")}`}
          className="rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#20273d]"
        >
          Email a privacy request
        </a>
      ) : null}
      {whatsappUrl ? (
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noreferrer"
          className="rounded-full border border-sand-300 bg-white px-5 py-2.5 text-sm font-semibold text-ink transition hover:border-cobalt-200 hover:bg-cobalt-50"
        >
          Contact support
        </a>
      ) : null}
    </>
  );
}

export function TermsOfUsePage() {
  return (
    <FooterInfoLayout
      eyebrow="TOU"
      title="Terms of Use"
      lede="These Terms of Use explain how Crib works as a creative marketplace for storefronts, digital products, creator profiles, and buyer activity across the platform."
      aside={<SupportAside />}
    >
      <InfoSection eyebrow="Using Crib" title="What you agree to when you use the platform">
        <p>By creating an account, browsing listings, purchasing products, publishing creator profiles, or using Crib services, you agree to follow these terms and any marketplace rules referenced by them.</p>
        <p>Crib may update the platform, feature set, pricing flows, safety measures, or moderation processes from time to time. Continued use after an update means you accept the revised terms.</p>
      </InfoSection>

      <InfoSection eyebrow="Accounts" title="Account, profile, and access rules">
        <InfoList
          items={[
            "Use accurate account, creator, and payout information at all times.",
            "Keep login credentials secure and do not share access in ways that create safety or payment risk.",
            "Do not impersonate people, brands, collaborators, or marketplace administrators.",
            "Crib may suspend or remove accounts that create fraud, abuse, safety, or legal risk."
          ]}
        />
      </InfoSection>

      <InfoSection eyebrow="Creators" title="Listings, rights, and creator responsibility">
        <InfoList
          items={[
            "Only upload, license, or promote work you created, own, or are authorized to distribute.",
            "Listings must accurately describe files, formats, usage limits, and what a buyer will receive.",
            "Creators remain responsible for the legality, originality, and safety of the files they publish.",
            "Crib may remove listings that appear misleading, infringing, malicious, unsafe, or inconsistent with marketplace standards."
          ]}
        />
      </InfoSection>

      <InfoSection eyebrow="Orders" title="Payments, delivery, and issue resolution">
        <p>Orders placed through Crib must use approved platform checkout and payment flows. Access to purchased files, delivery timing, release steps, and any escrow-related actions are governed by the product flow active at the time of purchase.</p>
        <p>Where a buyer reports a genuine delivery or scam issue, Crib may review order evidence, pause release, contact the parties involved, or take moderation action to protect the marketplace.</p>
      </InfoSection>

      <InfoSection eyebrow="Conduct" title="Acceptable use and enforcement">
        <InfoList
          items={[
            "Do not scrape, automate, reverse engineer, probe, or overload Crib in ways that harm the service.",
            "Do not upload harmful files, malware, deceptive downloads, or illegal content.",
            "Do not harass, threaten, spam, exploit, or discriminate against other users.",
            "Crib may remove content, limit features, suspend accounts, or cooperate with lawful requests when needed."
          ]}
        />
      </InfoSection>
    </FooterInfoLayout>
  );
}

export function PrivacyPage() {
  return (
    <FooterInfoLayout
      eyebrow="Privacy"
      title="Privacy"
      lede="This page explains what information Crib collects, how it is used to run the marketplace, and the choices users have around their personal data."
      aside={<SupportAside />}
    >
      <InfoSection eyebrow="Collection" title="What information Crib may collect">
        <InfoList
          items={[
            "Account information such as your name, email, login metadata, and profile details.",
            "Marketplace activity such as listings, purchases, follows, reviews, wishlist events, and notifications.",
            "Transaction and support information needed for payments, delivery, moderation, and help requests.",
            "Technical information such as device, browser, session, and security-related usage signals."
          ]}
        />
      </InfoSection>

      <InfoSection eyebrow="Use" title="How Crib uses that information">
        <InfoList
          items={[
            "To operate creator profiles, storefronts, orders, and secure file delivery.",
            "To verify transactions, detect abuse, and reduce scam or account-safety risk.",
            "To improve product performance, reliability, support, and marketplace discovery.",
            "To communicate service notices, support responses, policy updates, and important account actions."
          ]}
        />
      </InfoSection>

      <InfoSection eyebrow="Sharing" title="When information may be shared">
        <p>Crib may share limited information with trusted infrastructure, payment, analytics, fraud-prevention, support, or communications providers that help operate the marketplace.</p>
        <p>Information may also be disclosed when required by law, when necessary to enforce marketplace rules, or when needed to investigate fraud, abuse, or account safety issues.</p>
      </InfoSection>

      <InfoSection eyebrow="Security" title="Retention, security, and user choices">
        <p>Crib keeps information for as long as reasonably needed to operate the platform, resolve disputes, comply with legal obligations, and protect marketplace integrity.</p>
        <p>You can update profile information in your account, contact support for privacy questions, review cookie information on the cookie preferences page, and use the privacy choices page for applicable opt-out requests.</p>
      </InfoSection>
    </FooterInfoLayout>
  );
}

export function CommunityPage() {
  return (
    <FooterInfoLayout
      eyebrow="Community"
      title="Community"
      lede="Crib exists to help creative work travel with trust. These standards explain how creators, buyers, and collaborators are expected to show up on the platform."
      aside={<SupportAside />}
    >
      <InfoSection eyebrow="Integrity" title="Create and publish with integrity">
        <InfoList
          items={[
            "Share original work, properly licensed work, or work you are clearly authorized to distribute.",
            "Represent your skills, profile, experience, collaborations, and deliverables honestly.",
            "Use profile bios, previews, and tags to clarify your creative practice rather than to mislead people."
          ]}
        />
      </InfoSection>

      <InfoSection eyebrow="Respect" title="Treat people fairly">
        <InfoList
          items={[
            "No harassment, intimidation, hate, abuse, or discriminatory conduct.",
            "No spam, mass solicitation, fake engagement, or pressure tactics that make the marketplace unsafe.",
            "No impersonation of creators, buyers, brands, editors, or Crib staff."
          ]}
        />
      </InfoSection>

      <InfoSection eyebrow="Commerce" title="Sell and hire responsibly">
        <InfoList
          items={[
            "Creators should describe files, pricing, rights, and delivery expectations clearly.",
            "Buyers should use platform flows honestly and report genuine issues with evidence.",
            "Hire conversations should respect the creator's posted terms and remain professional."
          ]}
        />
      </InfoSection>

      <InfoSection eyebrow="Moderation" title="Reporting and enforcement">
        <p>Crib may review reports, moderate listings, restrict visibility, remove content, or suspend accounts when community trust, legal compliance, or platform safety is at risk.</p>
      </InfoSection>
    </FooterInfoLayout>
  );
}

export function HelpPage() {
  const { supportEmail, whatsappUrl } = useSupportLinks();

  return (
    <FooterInfoLayout
      eyebrow="Help"
      title="Help"
      lede="Get support for orders, creator listings, payouts, account access, and platform safety. The fastest path depends on what you need help with."
      actions={
        <>
          {whatsappUrl ? (
            <a href={whatsappUrl} target="_blank" rel="noreferrer" className="rounded-full bg-forest-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-forest-700">
              Chat with support
            </a>
          ) : null}
          {supportEmail ? (
            <a
              href={`mailto:${supportEmail}?subject=${encodeURIComponent("Crib support request")}`}
              className="rounded-full border border-sand-300 bg-white px-5 py-2.5 text-sm font-semibold text-ink transition hover:border-cobalt-200 hover:bg-cobalt-50"
            >
              Email support
            </a>
          ) : null}
        </>
      }
      aside={<SupportAside />}
    >
      <InfoSection eyebrow="Buyers" title="If you bought a product">
        <InfoList
          items={[
            "Review the file contents promptly after purchase and keep your order details available.",
            "If something is missing, broken, or suspicious, contact support with the order information and a clear description of the issue.",
            "Use official Crib support paths rather than off-platform escalation when the issue concerns delivery, release, or account safety."
          ]}
        />
      </InfoSection>

      <InfoSection eyebrow="Creators" title="If you sell on Crib">
        <InfoList
          items={[
            "Keep listings accurate, previews current, and payout details up to date.",
            "Use your dashboard and profile settings to manage storefront details, hire terms, and marketplace visibility.",
            "Contact support for payout setup questions, moderation clarifications, or delivery disputes that need admin review."
          ]}
        />
      </InfoSection>

      <InfoSection eyebrow="Accounts" title="If you need account or platform help">
        <InfoList
          items={[
            "Use Help for sign-in problems, profile issues, support requests, privacy concerns, and suspicious activity.",
            "Include the email attached to the account and enough detail for the team to verify the issue safely.",
            "For urgent trust-and-safety concerns, share the affected profile, order, or listing ID where possible."
          ]}
        />
      </InfoSection>
    </FooterInfoLayout>
  );
}

export function CookiePreferencesPage() {
  return (
    <FooterInfoLayout
      eyebrow="Cookie Preferences"
      title="Cookie preferences"
      lede="Crib uses cookies and similar storage technologies to keep the marketplace secure, remember preferences, and understand how the product performs."
      aside={<SupportAside />}
    >
      <InfoSection eyebrow="Categories" title="How Crib uses cookies and similar technologies">
        <InfoList
          items={[
            "Essential: used for security, login state, fraud prevention, and core marketplace functionality.",
            "Functional: used to remember preferences such as theme, session continuity, and useful interface settings.",
            "Performance: used to understand reliability, speed, and how people move through the product.",
            "Advertising or audience tools may be introduced only where appropriate and will remain subject to applicable law and privacy controls."
          ]}
        />
      </InfoSection>

      <InfoSection eyebrow="Choices" title="How to manage your choices">
        <p>You can manage many cookies through your browser or device settings. Blocking essential cookies may limit sign-in, checkout, support, or secure delivery features across the marketplace.</p>
        <p>If you want Crib to review a cookie or tracking preference request, contact support and reference this page so the team can route your request correctly.</p>
      </InfoSection>

      <InfoSection eyebrow="More information" title="Related privacy information">
        <p>
          For broader details about personal data, visit the <Link to="/privacy" className="font-semibold text-cobalt-700 hover:text-cobalt-800">Privacy</Link> page. For requests related to targeted sharing or similar privacy rights, visit{" "}
          <Link to="/do-not-sell-or-share" className="font-semibold text-cobalt-700 hover:text-cobalt-800">
            Do not sell or share my personal information
          </Link>
          .
        </p>
      </InfoSection>
    </FooterInfoLayout>
  );
}

export function PrivacyChoicesPage() {
  return (
    <FooterInfoLayout
      eyebrow="Privacy Choices"
      title="Do not sell or share my personal information"
      lede="This page explains how Crib approaches privacy-choice requests and how users can ask us to review applicable opt-out rights."
      actions={<PrivacyChoicesActions />}
      aside={<SupportAside />}
    >
      <InfoSection eyebrow="Our approach" title="How Crib handles this request type">
        <p>Crib does not sell personal information for money in the ordinary sense of the term. In some regions, however, privacy laws may treat certain analytics, advertising, or audience-sharing activity as a sale or share.</p>
        <p>If a law that applies to you gives you the right to opt out of that kind of activity, Crib will review and process verified requests in line with applicable law.</p>
      </InfoSection>

      <InfoSection eyebrow="Requesting an opt-out" title="How to submit a request">
        <InfoList
          items={[
            "Use the support email or official support channels linked on this page.",
            "Include the email tied to your Crib account and note that your request concerns privacy choices.",
            "Do not share passwords, payment credentials, or highly sensitive information in your request."
          ]}
        />
      </InfoSection>

      <InfoSection eyebrow="Verification" title="Why verification may be required">
        <p>To protect user accounts, Crib may need to confirm that a request comes from the account holder or an authorized representative before applying account-level privacy changes.</p>
      </InfoSection>
    </FooterInfoLayout>
  );
}
