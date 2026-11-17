import { Navigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { fetchSettlementById } from "@/lib/settlements/data";
import { settlementPath } from "@/lib/settlements/format";

/**
 * Older links and emails point at /settlements/:id. Every settlement now has
 * one page, the public one, so this sends people there.
 */
const SettlementDetail = () => {
  const { id = "" } = useParams<{ id: string }>();
  const { data, isLoading } = useQuery({
    queryKey: ["settlement-by-id", id],
    queryFn: () => fetchSettlementById(id),
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-16" role="status" aria-label="Loading">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  return <Navigate to={data ? settlementPath(data) : "/settlements"} replace />;
};

export default SettlementDetail;
