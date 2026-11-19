"use client";

import { Badge, Button, Card, CardHeader, Dialog, Field, FormAlert, Input, PageHeader, Skeleton, toast } from "@turvio/web-ui/ds";
import { Loader2, UserMinus, UserPlus } from "lucide-react";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { ApiError, api, errorText } from "../lib/api";
import { useI18n } from "../lib/i18n/client";
import type { PlatformAdmin } from "../lib/remote";

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** Who may use TURVIO Admin: list, add an existing TURVIO account by e-mail, remove (never yourself). */
export function PlatformAdmins() {
  const { t, fmt } = useI18n();
  const [admins, setAdmins] = useState<PlatformAdmin[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<PlatformAdmin | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    try {
      setAdmins((await api<{ admins: PlatformAdmin[] }>("GET", "/v1/platform/admins")).admins);
      setError(null);
    } catch (e) {
      setError(errorText(e));
    }
  }, []);
  useEffect(() => {
    void reload();
  }, [reload]);

  const add = async (e: FormEvent) => {
    e.preventDefault();
    const value = email.trim();
    if (!EMAIL.test(value)) return;
    setAdding(true);
    try {
      await api("POST", "/v1/platform/admins", { email: value });
      toast.success(t("admins.added", { email: value }));
      setEmail("");
      await reload();
    } catch (err) {
      toast.error(t("admins.addFailed"), { description: err instanceof ApiError && err.status === 404 ? t("admins.noAccount", { email: value }) : errorText(err) });
    } finally {
      setAdding(false);
    }
  };

  const remove = async () => {
    if (!removing) return;
    setBusy(true);
    try {
      await api("DELETE", `/v1/platform/admins/${encodeURIComponent(removing.userId)}`);
      toast.success(t("admins.removed", { email: removing.email ?? t("admins.unknownAccount") }));
      setRemoving(null);
      await reload();
    } catch (err) {
      toast.error(t("admins.removeFailed"), { description: err instanceof ApiError && err.status === 422 ? t("admins.cannotRemove") : errorText(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader title={t("admins.title")} description={t("admins.description")} />
      <Card>
        <CardHeader title={t("admins.addTitle")} description={t("admins.addDescription")} />
        <form onSubmit={add} className="flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-end g:px-4">
          <div className="min-w-0 flex-1 sm:max-w-sm">
            <Field label={t("common.email")} htmlFor="admin-email">
              <Input id="admin-email" type="email" autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t("admins.emailPlaceholder")} />
            </Field>
          </div>
          <Button type="submit" variant="primary" disabled={adding || !EMAIL.test(email.trim())}>
            {adding ? <Loader2 className="animate-spin" /> : <UserPlus />} {t("admins.add")}
          </Button>
        </form>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader title={t("admins.listTitle")} description={admins ? t("admins.count", { count: admins.length }) : undefined} />
        {error && (
          <div className="flex flex-col items-start gap-3 p-4">
            <FormAlert>{error}</FormAlert>
            <Button variant="secondary" size="sm" onClick={() => void reload()}>
              {t("common.retry")}
            </Button>
          </div>
        )}
        {!admins && !error && (
          <div className="flex flex-col gap-2 p-4" aria-busy="true" aria-label={t("common.loading")}>
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} className="h-8 rounded-md" />
            ))}
          </div>
        )}
        {admins && (
          <table className="w-full text-[13px]">
            <thead className="text-[12px] text-muted">
              <tr className="border-b border-line">
                <th scope="col" className="h-9 px-5 text-start font-medium g:px-4">{t("common.email")}</th>
                <th scope="col" className="h-9 px-3 text-start font-medium">{t("admins.since")}</th>
                <th scope="col" className="h-9 px-5 g:px-4">
                  <span className="sr-only">{t("common.actions")}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {admins.map((a) => (
                <tr key={a.userId} className="border-b border-line last:border-0 g:hover:bg-[var(--hover)]">
                  <td className="px-5 py-2 text-ink g:px-4">
                    <span className="flex items-center gap-2">
                      {a.email ?? <span className="text-muted">{t("admins.unknownAccount")}</span>}
                      {a.you && <Badge tone="brand">{t("admins.you")}</Badge>}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-ink-2">{fmt.date(a.since, { day: "2-digit", month: "short", year: "numeric" })}</td>
                  <td className="px-5 py-2 text-end g:px-4">
                    {!a.you && (
                      <Button size="sm" variant="danger" onClick={() => setRemoving(a)} aria-label={t("admins.removeLabel", { email: a.email ?? t("admins.unknownAccount") })}>
                        <UserMinus /> {t("admins.remove")}
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Dialog
        open={removing !== null}
        onOpenChange={(o) => !o && !busy && setRemoving(null)}
        title={t("admins.removeTitle")}
        footer={
          <>
            <Button variant="secondary" onClick={() => setRemoving(null)} disabled={busy}>
              {t("common.cancel")}
            </Button>
            <Button variant="danger" onClick={() => void remove()} disabled={busy}>
              {busy && <Loader2 className="animate-spin" />} {t("admins.removeConfirm")}
            </Button>
          </>
        }
      >
        <p className="text-[13px] leading-5 text-ink-2">{t("admins.removeBody", { email: removing?.email ?? t("admins.unknownAccount") })}</p>
      </Dialog>
    </>
  );
}
