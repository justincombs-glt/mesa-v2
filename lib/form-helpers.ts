/**
 * Wraps a server action that returns a result object into a void-returning
 * function suitable for use as a bare `<form action={fn}>` prop.
 */
export function toFormAction<T>(
  action: (fd: FormData) => Promise<T>
): (fd: FormData) => Promise<void> {
  return async (fd: FormData) => {
    await action(fd);
  };
}
