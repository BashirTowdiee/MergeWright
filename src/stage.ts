const STAGE_NAME_PATTERN = /^[a-z0-9][a-z0-9-]+$/;

export function validateStageName(stageName: string): void {
  if (!STAGE_NAME_PATTERN.test(stageName)) {
    throw new Error(
      `Invalid stage name "${stageName}". Expected pattern ${STAGE_NAME_PATTERN} and no spaces, commas, slashes, or traversal.`
    );
  }

  if (
    stageName.includes(" ") ||
    stageName.includes(",") ||
    stageName.includes("/") ||
    stageName.includes("\\") ||
    stageName.includes("..")
  ) {
    throw new Error(
      `Invalid stage name "${stageName}". Stage names must not contain spaces, commas, slashes, or traversal.`
    );
  }
}
