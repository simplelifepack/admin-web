import { useParams } from "react-router-dom";

import { T } from "@/constants/theme";
import { ALL_ITEMS } from "@/data/nav";

export default function Stub() {
  const { moduleId } = useParams();
  const item = ALL_ITEMS.find((i) => i.id === moduleId);

  return (
    <div>
      <h1 style={{ fontSize: 26, fontWeight: 800, color: "#fff", margin: "0 0 6px" }}>{item?.label ?? "Not found"}</h1>
      <p style={{ color: T.muted, fontSize: 14.5, margin: 0 }}>Not built yet.</p>
    </div>
  );
}
