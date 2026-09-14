"use client";

import { useState } from "react";
import { FileText, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui";
import { buildWordDocx, parseDraftToBlocks } from "@/lib/docx";
import { downloadBlob } from "@/lib/download";

const DEFAULT_DRAFT = `# Meeting Notes — Product Review

## Attendees

- Alice (PM)
- Bob (Eng)
- Carol (Design)

## Agenda

**1. Status update** — the beta API is on track for March.
**2. Design review** — new onboarding flow needs one more iteration.
*3. AOB* — parking lot for anything not covered.

---

## Action Items

1. Alice to finalize the release plan
2. Bob to fix the auth cache bug
3. Carol to export the new component library`;

export default function WordCreator() {
  const [draft, setDraft] = useState(DEFAULT_DRAFT);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const create = async () => {
    if (!draft.trim()) return;
    setBusy(true);
    setError("");
    setDone(false);
    try {
      const blocks = parseDraftToBlocks(draft);
      if (blocks.length === 0) {
        setError("Nothing to write — add some content first.");
        return;
      }
      const bytes = buildWordDocx(blocks);
      downloadBlob(bytes, "document.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not build document.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5 w-full">
      <div className="rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-900 px-4 py-3 text-sm leading-relaxed">
        <p className="font-medium mb-1">Quick format reference</p>
        <p className="text-indigo-700">
          <code className="bg-white px-1 rounded"># Heading 1</code>{" "}
          <code className="bg-white px-1 rounded">## Heading 2</code>{" "}
          <code className="bg-white px-1 rounded">- bullet</code>{" "}
          <code className="bg-white px-1 rounded">**bold**</code>{" "}
          <code className="bg-white px-1 rounded">*italic*</code>{" "}
          <code className="bg-white px-1 rounded">---</code> page break. The{" "}
          <code className="bg-white px-1 rounded">#</code> line becomes the
          Title.
        </p>
      </div>

      <textarea
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value);
          setDone(false);
        }}
        rows={18}
        className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">
          {error}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" disabled={busy || !draft.trim()} onClick={create}>
          {busy ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <FileText className="w-4 h-4 mr-1.5 inline" />
          )}
          Generate .docx
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            setDraft(DEFAULT_DRAFT);
            setDone(false);
          }}
        >
          Reset sample
        </Button>
        {done && (
          <span className="inline-flex items-center gap-2 text-sm text-emerald-700 font-medium">
            <CheckCircle2 className="w-4 h-4" /> document.docx downloaded
          </span>
        )}
      </div>
    </div>
  );
}