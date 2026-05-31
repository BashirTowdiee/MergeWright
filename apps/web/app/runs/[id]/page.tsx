import { ControlRoomShell } from "../../_components/control-room-shell";

export default async function RunDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ControlRoomShell route={{ page: "run-detail", runId: id }} />;
}
