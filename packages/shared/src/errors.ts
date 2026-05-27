export type ErrorCode = string;

export type SharedError<TCode extends ErrorCode = ErrorCode> = {
  readonly code: TCode;
  readonly message: string;
};

export const sharedError = <TCode extends ErrorCode>(
  code: TCode,
  message: string
): SharedError<TCode> => ({
  code,
  message
});
