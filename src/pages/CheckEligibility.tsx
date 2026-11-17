import { Navigate, useParams } from "react-router-dom";

/**
 * This address used to show an "eligibility check". Only the settlement
 * administrator can decide eligibility, so it now leads to the settlement page,
 * which links to the official claim site.
 */
const CheckEligibility = () => {
  const { slug = "" } = useParams<{ slug: string }>();
  return <Navigate to={`/settlement/${slug}`} replace />;
};

export default CheckEligibility;
