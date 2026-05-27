export type Brand<TValue, TBrand extends string> = TValue & {
  readonly __brand: TBrand;
};

export type RunId = Brand<string, "RunId">;
export type TaskId = Brand<string, "TaskId">;
export type ArtifactId = Brand<string, "ArtifactId">;

export const asRunId = (value: string): RunId => value as RunId;
export const asTaskId = (value: string): TaskId => value as TaskId;
export const asArtifactId = (value: string): ArtifactId => value as ArtifactId;
