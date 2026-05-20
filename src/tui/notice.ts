export type TuiNoticeTone = "info" | "success" | "warning" | "error";

export interface TuiNotice {
  tone: TuiNoticeTone;
  message: string;
}

export function createInfoNotice(message: string): TuiNotice {
  return { tone: "info", message };
}

export function formatNotice(notice: TuiNotice | null): string {
  if (!notice) {
    return "";
  }

  const prefix = getNoticePrefix(notice.tone);
  return `${prefix} ${notice.message}`;
}

export function getNoticePrefix(tone: TuiNoticeTone): string {
  switch (tone) {
    case "success":
      return "OK";
    case "warning":
      return "WARN";
    case "error":
      return "ERROR";
    case "info":
    default:
      return "INFO";
  }
}
