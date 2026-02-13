import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { RiskGauge } from "@/components/RiskGauge";
import { AlertRow } from "@/components/AlertRow";
import { Button } from "@/components/ui/button";
import { mockAlerts, mockBreaches, mockSettlements, mockClaims } from "@/data/mockData";
import { ShieldAlert, Scale, DollarSign, FileText, Activity, Search, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

const Dashboard = () => {
  const totalEstimated = mockSettlements.filter(s => s.status === "open").reduce((a, s) => a + s.payout_max, 0);

  return (
    <div>
      <PageHeader title="Dashboard" subtitle="Your breach exposure overview" />

      <div className="grid gap-6 lg:grid-cols-[auto_1fr]">
        {/* Risk Gauge */}
        <div className="flex items-center justify-center glass-card-glow p-6 lg:row-span-2">
          <RiskGauge score={82} />
        </div>

        {/* Stat Cards */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard icon={ShieldAlert} label="Breaches Detected" value={mockBreaches.length} variant="teal" />
          <StatCard icon={Scale} label="Eligible Settlements" value={mockSettlements.filter(s => s.status === "open").length} />
          <StatCard icon={DollarSign} label="Estimated Value" value={`$${totalEstimated.toLocaleString()}`} variant="teal" />
          <StatCard icon={FileText} label="Claims Filed" value={mockClaims.length} />
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-3">
          <Button asChild className="rounded-xl bg-primary text-primary-foreground hover:shadow-[0_0_20px_hsl(172_89%_52%/0.3)] transition-all duration-300">
            <Link to="/scan"><Search className="mr-2 h-4 w-4" />Run Scan</Link>
          </Button>
          <Button variant="outline" asChild className="rounded-xl">
            <Link to="/settlements">View Settlements <ArrowRight className="ml-2 h-4 w-4" /></Link>
          </Button>
          <Button variant="outline" asChild className="rounded-xl">
            <Link to="/claims">Track Claims <ArrowRight className="ml-2 h-4 w-4" /></Link>
          </Button>
        </div>
      </div>

      {/* Recent Alerts */}
      <div className="mt-8">
        <div className="mb-4 flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" />
          <h2 className="text-lg font-semibold">Recent Alerts</h2>
        </div>
        <div className="space-y-2">
          {mockAlerts.slice(0, 5).map((alert) => (
            <AlertRow key={alert.id} alert={alert} />
          ))}
        </div>
      </div>

      <p className="mt-8 text-xs text-muted-foreground text-center">
        BreachPay is not a law firm and does not provide legal advice. Data may be sourced from third-party providers and may be incomplete.
      </p>
    </div>
  );
};

export default Dashboard;
