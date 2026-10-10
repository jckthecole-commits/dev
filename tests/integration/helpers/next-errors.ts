/** What the mocked next/navigation throws, so tests can assert on control flow. */
export class NextRedirect extends Error {
  constructor(
    readonly url: string,
    readonly permanent = false,
  ) {
    super(`NEXT_REDIRECT ${url}`)
  }
}
export class NextHttpError extends Error {
  constructor(readonly status: 401 | 403 | 404) {
    super(`NEXT_HTTP_ERROR_FALLBACK;${status}`)
  }
}
