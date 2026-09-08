"use client";

import { useMemo, useState } from "react";
import { format, type SqlLanguage } from "sql-formatter";
import { CheckCircle2, XCircle } from "lucide-react";
import { Button, StyledTextarea, CopyButton } from "@/components/ui";

const LANGUAGES: { id: SqlLanguage; label: string }[] = [
  { id: "sql", label: "Standard SQL" },
  { id: "mysql", label: "MySQL" },
  { id: "postgresql", label: "PostgreSQL" },
  { id: "sqlite", label: "SQLite" },
  { id: "mariadb", label: "MariaDB" },
  { id: "transactsql", label: "SQL Server (T-SQL)" },
  { id: "bigquery", label: "BigQuery" },
  { id: "snowflake", label: "Snowflake" },
  { id: "redshift", label: "Redshift" },
  { id: "spark", label: "Spark SQL" },
];

const SAMPLE = `SELECT u.id, u.name, COUNT(o.id) AS orders
FROM users u
LEFT JOIN orders o ON o.user_id = u.id
WHERE u.active = 1 AND o.created_at >= '2026-01-01'
GROUP BY u.id, u.name
HAVING COUNT(o.id) > 2
ORDER BY orders DESC
LIMIT 10;`;

export default function SqlFormatter() {
  const [input, setInput] = useState(SAMPLE);
  const [language, setLanguage] = useState<SqlLanguage>("sql");
  const [keywordCase, setKeywordCase] = useState<"upper" | "lower" | "preserve">("upper");

  const result = useMemo(() => {
    try {
      const out = format(input, { language, keywordCase });
      return { ok: true, value: out };
    } catch (err) {
      return { ok: false, value: err instanceof Error ? err.message : "Formatting failed" };
    }
  }, [input, language, keywordCase]);

  return (
    <div className="space-y-5 w-full">
      <div className="flex flex-wrap items-end gap-4">
        <select
          value={language}
          onChange={(e) => setLanguage(e.target.value as SqlLanguage)}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
        >
          {LANGUAGES.map((l) => (
            <option key={l.id} value={l.id}>
              {l.label}
            </option>
          ))}
        </select>
        <select
          value={keywordCase}
          onChange={(e) => setKeywordCase(e.target.value as typeof keywordCase)}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
        >
          <option value="upper">UPPERCASE keywords</option>
          <option value="lower">lowercase keywords</option>
          <option value="preserve">Preserve keywords</option>
        </select>
        <span className="flex items-center gap-1.5 text-sm pb-2">
          {result.ok ? (
            <span className="text-green-600 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" /> Formatted
            </span>
          ) : (
            <span className="text-red-600 flex items-center gap-1.5">
              <XCircle className="w-4 h-4" /> {result.value}
            </span>
          )}
        </span>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div>
          <p className="text-sm font-medium text-slate-700 mb-2">SQL</p>
          <StyledTextarea rows={16} value={input} onChange={(e) => setInput(e.target.value)} className="font-mono text-xs" />
        </div>
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-slate-700">Formatted</p>
            <CopyButton text={result.value} />
          </div>
          <StyledTextarea rows={16} value={result.value} readOnly className="bg-slate-100 font-mono text-xs" />
        </div>
      </div>

      <Button type="button" variant="secondary" onClick={() => setInput("")}>
        Clear
      </Button>
    </div>
  );
}