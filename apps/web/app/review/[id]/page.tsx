import { ControlRoomShell } from "../../_components/control-room-shell";

export default async function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ControlRoomShell route={{ page: "review", runId: id }} />;
}
