"use client";

import type { PjnCandidate } from "@ojo/core";
import { API_ROUTES } from "@ojo/shared";
import { Alert, Button, Card, Spinner } from "@ojo/ui";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useT } from "@/components/providers/i18n-provider";
import { ADD_TRACKER_EVENT } from "./add-tracker-modal";
import { ApiError, apiRequest } from "@/lib/api-client";
import { describeApiError } from "@/lib/api-errors";

type State =
  | { phase: "searching" }
  | { phase: "found"; candidates: PjnCandidate[] }
  | { phase: "none" }
  | { phase: "noCourt" | "noProfile" }
  | { phase: "error"; message: string };

/**
 * Shown on the court tab while the user has no case: looks the case up by the
 * profile name and asks whether it is the right one. Only the carátula is read
 * until the user confirms.
 */
export function CourtFinder({ personId, personName }: { personId?: string; personName?: string }) {
  const t = useT();
  const router = useRouter();
  const [state, setState] = useState<State>({ phase: "searching" });
  const [busyId, setBusyId] = useState<string | null>(null);
  const started = useRef(false);

  const search = useCallback(async () => {
    setState({ phase: "searching" });
    try {
      const result = await apiRequest<{ candidates: PjnCandidate[] }>(API_ROUTES.pjnSearch, {
        method: "POST",
        body: { personId: personId ?? null },
      });
      setState(result.candidates.length ? { phase: "found", candidates: result.candidates } : { phase: "none" });
    } catch (error) {
      if (error instanceof ApiError && error.code === "NO_COURT") setState({ phase: "noCourt" });
      else if (error instanceof ApiError && error.code === "PROFILE_INCOMPLETE") setState({ phase: "noProfile" });
      else if (error instanceof ApiError && error.code === "SUBSCRIPTION_REQUIRED") {
        setState({ phase: "error", message: t("track.error.subscription") });
      } else setState({ phase: "error", message: describeApiError(error, t) });
    }
  }, [t, personId]);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void search();
  }, [search]);

  async function confirm(candidate: PjnCandidate) {
    const id = `${candidate.number}/${candidate.year}`;
    setBusyId(id);
    try {
      const added = await apiRequest<{ tracker: { id: string } }>(API_ROUTES.trackers, {
        method: "POST",
        body: {
          kind: "PJN",
          jurisdiction: candidate.jurisdiction,
          number: candidate.number,
          year: candidate.year,
          ...(personId ? { personId } : {}),
        },
      });
      await apiRequest(API_ROUTES.pjnConfirm, { method: "POST", body: { id: added.tracker.id } });
      router.refresh();
    } catch (error) {
      const subscription = error instanceof ApiError && error.code === "SUBSCRIPTION_REQUIRED";
      setState({
        phase: "error",
        message: subscription ? t("track.error.subscription") : describeApiError(error, t),
      });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Card title={personName ? `${t("pjn.find.title")} — ${personName}` : t("pjn.find.title")}>
      <div className="space-y-4">
        {state.phase === "searching" && (
          <p className="flex items-center gap-2 text-sm text-slate-600">
            <Spinner className="size-4 text-slate-500" /> {t("pjn.find.searching")}
          </p>
        )}
        {state.phase === "noCourt" && <Alert tone="info">{t("pjn.find.noCourt")}</Alert>}
        {state.phase === "noProfile" && <Alert tone="info">{t("pjn.find.noProfile")}</Alert>}
        {state.phase === "none" && <Alert tone="info">{t("pjn.find.none")}</Alert>}
        {state.phase === "error" && <Alert tone="error">{state.message}</Alert>}

        {state.phase === "found" && (
          <>
            <p className="text-sm text-slate-700">{t("pjn.find.found")}</p>
            <ul className="space-y-3">
              {state.candidates.map((candidate) => (
                <li key={candidate.expediente} className="rounded-lg border border-slate-200 p-3 text-sm">
                  <p className="font-medium text-slate-900">{candidate.expediente}</p>
                  <p className="text-slate-700">{candidate.caratula}</p>
                  <p className="mb-3 text-slate-500">{candidate.dependencia}</p>
                  <Button
                    loading={busyId === `${candidate.number}/${candidate.year}`}
                    onClick={() => void confirm(candidate)}
                  >
                    {t("pjn.find.confirm")}
                  </Button>
                </li>
              ))}
            </ul>
          </>
        )}

        {state.phase !== "searching" && (
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => void search()}>
              {t("pjn.find.retry")}
            </Button>
            <Button
              variant="ghost"
              onClick={() =>
                window.dispatchEvent(new CustomEvent(ADD_TRACKER_EVENT, { detail: { kind: "PJN" } }))
              }
            >
              {t("pjn.find.manual")}
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}
