import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { ActionConfirmationModal } from "@/components/ActionConfirmationModal";
import { provisionEditorialAdmin } from "@/lib/api";
import { SectionHeader, SummaryPill, useAdminWorkspace } from "@/pages/admin/AdminWorkspace";
import { useToast } from "@/components/Toast";

export function AdminEditorsPage() {
  const { overview } = useAdminWorkspace();
  const { pushToast } = useToast();
  const [editorCredentialType, setEditorCredentialType] = useState<"email" | "phone">("email");
  const [editorDisplayName, setEditorDisplayName] = useState("");
  const [editorEmail, setEditorEmail] = useState("");
  const [editorPhone, setEditorPhone] = useState("");
  const [editorPassword, setEditorPassword] = useState("");
  const [confirmProvisionOpen, setConfirmProvisionOpen] = useState(false);
  const [lastProvisionedEditor, setLastProvisionedEditor] = useState<{
    mode: "created" | "updated";
    display_name: string;
    login_value: string;
  } | null>(null);

  const editorialProvisionMutation = useMutation({
    mutationFn: async () => {
      const password = editorPassword.trim();
      const displayName = editorDisplayName.trim();

      if (editorCredentialType === "email") {
        const email = editorEmail.trim().toLowerCase();
        return provisionEditorialAdmin({
          credential_type: "email",
          email,
          password,
          ...(displayName ? { display_name: displayName } : {})
        });
      }

      const phone = editorPhone.trim();
      return provisionEditorialAdmin({
        credential_type: "phone",
        phone,
        password,
        ...(displayName ? { display_name: displayName } : {})
      });
    },
    onSuccess: (result) => {
      const loginValue = result.credential_type === "email" ? result.email ?? "" : result.phone ?? "";
      setLastProvisionedEditor({
        mode: result.mode,
        display_name: result.display_name,
        login_value: loginValue
      });
      setEditorDisplayName("");
      setEditorEmail("");
      setEditorPhone("");
      setEditorPassword("");
      pushToast(result.mode === "created" ? "Editor account created" : "Editor account updated", "success");
    },
    onError: (error) => {
      pushToast(error instanceof Error ? error.message : "Could not provision editor account", "error");
    }
  });

  return (
    <section className="admin-platform-shell space-y-5">
      <header className="surface-card-vivid admin-hero-panel p-5 md:p-6">
        <div className="admin-page-hero-grid">
          <div className="max-w-4xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cobalt-700">Editorial Access</p>
            <h2 className="mt-2 font-display text-3xl font-bold text-ink md:text-4xl">Editors</h2>
            <p className="mt-2 text-sm text-sand-700 md:text-base">
              Create or refresh dedicated editorial logins here. Editors sign in through <span className="font-semibold text-cobalt-700">/editorial-login</span> and stay separate from marketplace-admin permissions.
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              <span className="admin-chip admin-chip-cobalt">Separate login lane</span>
              <span className="admin-chip admin-chip-rose">No admin rights</span>
              <span className="admin-chip admin-chip-lagoon">Email or phone credentials</span>
            </div>
          </div>

          <aside className="admin-page-hero-rail">
            <div className="admin-hero-rail-summary-grid">
              <SummaryPill label="Platform admins" value={overview ? `${overview.total_admins}` : "..."} tone="cobalt" />
              <SummaryPill label="Editorial posts" value={overview ? `${overview.editorial_posts}` : "..."} tone="sunset" />
              <SummaryPill label="Active creators" value={overview ? `${overview.active_creators}` : "..."} tone="forest" />
            </div>
          </aside>
        </div>
      </header>

      <div className="grid gap-5 xl:grid-cols-[0.95fr,1.05fr]">
        <aside className="surface-card admin-panel p-5">
          <SectionHeader eyebrow="Workspace boundary" title="Keep editorial access separate" body="Use a dedicated email or phone login for editorial staff. Marketplace admins should not share the same credentials." />
          <div className="mt-4 space-y-3">
            <div className="admin-step-card admin-step-card-cobalt">
              <span className="admin-step-index">1</span>
              <div>
                <p className="text-sm font-semibold text-ink">Separate sign-in page</p>
                <p className="mt-1 text-xs text-sand-600">Editors use /editorial-login, not the marketplace admin workspace.</p>
              </div>
            </div>
            <div className="admin-step-card admin-step-card-lagoon">
              <span className="admin-step-index">2</span>
              <div>
                <p className="text-sm font-semibold text-ink">Safe account reuse</p>
                <p className="mt-1 text-xs text-sand-600">If the account already exists, saving here refreshes the password and ensures editorial access is present.</p>
              </div>
            </div>
            <div className="admin-step-card admin-step-card-rose">
              <span className="admin-step-index">3</span>
              <div>
                <p className="text-sm font-semibold text-ink">Credential options</p>
                <p className="mt-1 text-xs text-sand-600">Provision editors with either email/password or phone/password credentials, depending on their workflow.</p>
              </div>
            </div>
          </div>
        </aside>

        <section className="surface-card admin-panel p-5">
          <SectionHeader eyebrow="Provisioning" title="Create or update an editor login" body="This form gives editors their own credentials without granting marketplace-admin rights." />
          <form
            className="mt-4 space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              setConfirmProvisionOpen(true);
            }}
          >
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setEditorCredentialType("email")}
                className={`profile-tab-button tab-tone-cobalt justify-center ${editorCredentialType === "email" ? "profile-tab-button-active" : ""}`}
              >
                Email login
              </button>
              <button
                type="button"
                onClick={() => setEditorCredentialType("phone")}
                className={`profile-tab-button tab-tone-lagoon justify-center ${editorCredentialType === "phone" ? "profile-tab-button-active" : ""}`}
              >
                Phone login
              </button>
            </div>

            <label className="admin-input-group">
              <span>Editor name</span>
              <input
                value={editorDisplayName}
                onChange={(event) => setEditorDisplayName(event.target.value)}
                placeholder="Editorial Writer"
                className="admin-input"
              />
            </label>

            {editorCredentialType === "email" ? (
              <label className="admin-input-group">
                <span>Editor email</span>
                <input
                  value={editorEmail}
                  onChange={(event) => setEditorEmail(event.target.value)}
                  type="email"
                  placeholder="editor@example.com"
                  required
                  className="admin-input"
                />
              </label>
            ) : (
              <label className="admin-input-group">
                <span>Editor phone</span>
                <input
                  value={editorPhone}
                  onChange={(event) => setEditorPhone(event.target.value)}
                  placeholder="+233..."
                  required
                  className="admin-input"
                />
              </label>
            )}

            <label className="admin-input-group">
              <span>Password</span>
              <input
                value={editorPassword}
                onChange={(event) => setEditorPassword(event.target.value)}
                type="password"
                minLength={6}
                placeholder="At least 6 characters"
                required
                className="admin-input"
              />
            </label>

            <button
              type="submit"
              disabled={editorialProvisionMutation.isPending}
              className="admin-action-button admin-action-button-full"
            >
              {editorialProvisionMutation.isPending ? "Saving editor..." : "Save editor login"}
            </button>

            <p className="text-xs text-sand-600">
              Editors created here can sign in right away through /editorial-login with the credentials you set.
            </p>

            {lastProvisionedEditor ? (
              <div className="rounded-2xl border border-cobalt-200 bg-cobalt-50/70 px-4 py-3 text-sm text-cobalt-900">
                <p className="font-semibold">{lastProvisionedEditor.mode === "created" ? "Editor account created" : "Editor account updated"}</p>
                <p className="mt-1">
                  {lastProvisionedEditor.display_name} can now sign in with <span className="font-semibold">{lastProvisionedEditor.login_value}</span>.
                </p>
              </div>
            ) : null}
          </form>
        </section>
      </div>

      <ActionConfirmationModal
        open={confirmProvisionOpen}
        tone="cobalt"
        eyebrow="Save Editor Login"
        title="Create or refresh this editor account?"
        description="This will save the credentials you entered and make sure the account has editorial access without marketplace-admin rights."
        confirmLabel="Save editor login"
        isPending={editorialProvisionMutation.isPending}
        onClose={() => {
          if (!editorialProvisionMutation.isPending) {
            setConfirmProvisionOpen(false);
          }
        }}
        onConfirm={() => {
          setConfirmProvisionOpen(false);
          editorialProvisionMutation.mutate();
        }}
        details={
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="action-confirm-stat">
              <p className="action-confirm-stat-label">Credential</p>
              <p className="action-confirm-stat-value">{editorCredentialType === "email" ? "Email" : "Phone"}</p>
            </div>
            <div className="action-confirm-stat">
              <p className="action-confirm-stat-label">Login</p>
              <p className="action-confirm-stat-value">{editorCredentialType === "email" ? editorEmail.trim() || "Pending" : editorPhone.trim() || "Pending"}</p>
            </div>
            <div className="action-confirm-stat">
              <p className="action-confirm-stat-label">Display name</p>
              <p className="action-confirm-stat-value">{editorDisplayName.trim() || "Editorial Editor"}</p>
            </div>
          </div>
        }
      />
    </section>
  );
}
