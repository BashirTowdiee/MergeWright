export function moveSelection(input: { currentIndex: number; itemCount: number; direction: "up" | "down" }): number {
  if (input.itemCount <= 0) {
    return 0;
  }

  if (input.direction === "up") {
    return input.currentIndex <= 0 ? input.itemCount - 1 : input.currentIndex - 1;
  }

  return input.currentIndex >= input.itemCount - 1 ? 0 : input.currentIndex + 1;
}
