import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { buildResearchData } from "@/lib/research";
import { money } from "@/lib/format";
import ComparisonTable from "@/components/research/ComparisonTable";
import AddFixedIncomeForm from "@/components/research/AddFixedIncomeForm";
import ContributionsCard from "@/components/research/ContributionsCard";

export default async function ResearchPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { comparison, totalValue, portfolioReturn, contributions } =
    await buildResearchData(supabase);

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <header className="sticky top-0 z-10 border-b border-hairline bg-canvas/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Research</h1>
            <p className="text-xs text-muted">
              Comparison &amp; returns across your holdings
            </p>
          </div>
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-md border border-hairline px-3 py-2 text-sm font-medium text-ink transition-colors hover:border-primary hover:text-primary"
          >
            <ArrowLeft size={15} /> Portfolio
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-5 py-6">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="rounded-lg border border-hairline bg-surface p-4">
            <p className="text-xs text-muted">Total value</p>
            <p className="text-xl font-semibold">{money(totalValue)}</p>
          </div>
        </div>

        <ComparisonTable rows={comparison} />

        <ContributionsCard
          contributions={contributions}
          portfolioReturn={portfolioReturn}
        />

        <AddFixedIncomeForm />

        <p className="text-xs leading-relaxed text-[#9CA3AF]">
          Benchmarks (CDI, IPCA, Ibovespa) are annualized over your earliest
          holding&apos;s horizon and shown gross of tax. Returns annualize each
          asset over its own holding period, so different periods aren&apos;t
          strictly comparable. After-tax figures apply the Brazilian IR rules and
          ignore monthly sale-value exemptions. Not financial advice.
        </p>
      </main>
    </div>
  );
}
