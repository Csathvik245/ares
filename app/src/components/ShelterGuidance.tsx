import { distanceM, formatMinutes, formatPct, roundHalfUp, type LatLng, type ShelterCheck } from "../lib/planner";

export function ShelterGuidance({ shelter, from }: { shelter?: ShelterCheck; from: LatLng }) {
  if (!shelter?.checked) return null;
  return <p className="shelter-guidance" title={shelter.reasons?.join("\n")}>
    {shelter.betterThanHome && shelter.target
      ? `Shelter: ${roundHalfUp(distanceM(from, shelter.target) / 10) * 10} m away, ${formatMinutes(shelter.sec)} walk, about ${formatPct(shelter.doseReductionPct)} lower dose than walking home.`
      : "Shelter checked: walking home is better."}{" "}
    {shelter.simplified && <small className="model-tag">simplified model</small>}
  </p>;
}
