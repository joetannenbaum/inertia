import { default as Axios, AxiosResponse } from 'axios'
import {
  fireErrorEvent,
  fireExceptionEvent,
  fireFinishEvent,
  fireInvalidEvent,
  fireProgressEvent,
  fireSuccessEvent,
} from './events'
import { History } from './history'
import modal from './modal'
import { page as currentPage } from './page'
import { SessionStorage } from './sessionStorage'
import { ActiveVisit, ErrorBag, Errors, LocationVisit, Page, PreserveStateOption, RequestPayload } from './types'
import { hrefToUrl, isSameUrlWithoutHash, setHashIfSameUrl, urlWithoutHash } from './url'

export class Request {
  protected queryParams: RequestPayload = {}
  protected data: RequestPayload = {}
  protected isPartial = false
  protected response!: AxiosResponse
  protected cancelToken!: AbortController

  constructor(protected params: ActiveVisit) {
    this.data = this.params.method === 'get' ? {} : this.params.data
    this.queryParams = this.params.method === 'get' ? this.params.data : {}
    this.isPartial = this.params.only.length > 0 || this.params.except.length > 0
    this.cancelToken = new AbortController()

    this.params.onCancelToken({
      cancel: () => {
        // TODO: Do we need to check if the request is already cancelled or completed?
        this.cancel({ cancelled: true })
      },
    })
  }

  protected isInertiaResponse(): boolean {
    return this.responseHasHeader('x-inertia')
  }

  public send() {
    return Axios({
      method: this.params.method,
      url: urlWithoutHash(this.params.url).href,
      data: this.data,
      params: this.queryParams,
      signal: this.cancelToken.signal,
      headers: {
        ...this.params.headers,
        Accept: 'text/html, application/xhtml+xml',
        'X-Requested-With': 'XMLHttpRequest',
        'X-Inertia': true,
        ...this.getHeaders(),
      },
      onUploadProgress: (progress) => {
        if (this.data instanceof FormData) {
          progress.percentage = progress.progress ? Math.round(progress.progress * 100) : 0
          fireProgressEvent(progress)
          this.params.onProgress(progress)
        }
      },
    })
      .then((response) => {
        this.response = response

        if (!this.isInertiaResponse()) {
          // If we didn't even receive an Inertia response, we can stop here
          return Promise.reject({ response: this.response })
        }

        return response
      })
      .then(this.setPageFromResponse.bind(this))
      .then(() => {
        const errors = currentPage.page.props.errors || {}

        if (Object.keys(errors).length > 0) {
          const scopedErrors = this.getScopedErrors(errors)

          fireErrorEvent(scopedErrors)

          return this.params.onError(scopedErrors)
        }

        fireSuccessEvent(currentPage.page)

        return this.params.onSuccess(currentPage.page)
      })
      .catch((error) => {
        // TODO: Is this bad?
        if (error.response) {
          this.response = error.response
        }

        if (this.isInertiaResponse()) {
          return currentPage.set(this.response.data)
        }

        if (this.isLocationVisitResponse()) {
          const locationUrl = hrefToUrl(this.getResponseHeader('x-inertia-location'))

          setHashIfSameUrl(this.params.url, locationUrl)

          return this.locationVisit(locationUrl, this.params.preserveScroll === true)
        }

        if (this.response) {
          if (fireInvalidEvent(this.response)) {
            modal.show(this.response.data)
          }

          return
        }

        return Promise.reject(error)
      })
      .then(this.finishVisit.bind(this))
      .catch((error) => {
        if (Axios.isCancel(error)) {
          return
        }

        const throwException = fireExceptionEvent(error)

        this.finishVisit()

        if (throwException) {
          return Promise.reject(error)
        }
      })
  }

  public cancel({ cancelled = false, interrupted = false }: { cancelled?: boolean; interrupted?: boolean }): void {
    this.cancelToken.abort()

    this.params.onCancel()

    this.params.completed = false
    this.params.cancelled = cancelled
    this.params.interrupted = interrupted

    this.fireFinishEvents()
  }

  protected getScopedErrors(errors: Errors & ErrorBag): Errors {
    if (!this.params.errorBag) {
      return errors
    }

    return errors[this.params.errorBag] || {}
  }

  protected setPageFromResponse(): Promise<void> {
    // TODO: Would love to type this properly if we can
    const pageResponse: Page = this.response.data

    if (this.isPartial && pageResponse.component === currentPage.page.component) {
      pageResponse.props = { ...currentPage.page.props, ...pageResponse.props }
    }

    this.params.preserveScroll = this.resolvePreserveOption(this.params.preserveScroll, pageResponse)
    this.params.preserveState = this.resolvePreserveOption(this.params.preserveState, pageResponse)

    if (
      this.params.preserveState &&
      History.getState('rememberedState') &&
      pageResponse.component === currentPage.page.component
    ) {
      pageResponse.rememberedState = History.getState('rememberedState')
    }

    const responseUrl = hrefToUrl(pageResponse.url)

    setHashIfSameUrl(this.params.url, responseUrl)

    // TODO: I moved this out of the if statement,
    // but I'm not sure if this is always applicable outside of the hash logic
    pageResponse.url = responseUrl.href

    return currentPage.set(pageResponse, {
      replace: this.params.replace,
      preserveScroll: this.params.preserveScroll,
      preserveState: this.params.preserveState,
    })
  }

  protected resolvePreserveOption(value: PreserveStateOption, page: Page): boolean {
    if (typeof value === 'function') {
      return value(page)
    }

    if (value === 'errors') {
      return Object.keys(page.props.errors || {}).length > 0
    }

    return value
  }

  protected getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {}

    if (this.isPartial) {
      headers['X-Inertia-Partial-Component'] = currentPage.page.component
    }

    if (this.params.only.length > 0) {
      headers['X-Inertia-Partial-Data'] = this.params.only.join(',')
    }

    if (this.params.except.length > 0) {
      headers['X-Inertia-Partial-Except'] = this.params.except.join(',')
    }

    if (this.params.errorBag && this.params.errorBag.length > 0) {
      headers['X-Inertia-Error-Bag'] = this.params.errorBag
    }

    if (currentPage.page.version) {
      headers['X-Inertia-Version'] = currentPage.page.version
    }

    return headers
  }

  protected finishVisit(): void {
    if (this.params.cancelled || this.params.interrupted) {
      return
    }

    this.params.completed = true
    this.params.cancelled = false
    this.params.interrupted = false

    this.fireFinishEvents()
  }

  protected fireFinishEvents(): void {
    fireFinishEvent(this.params)
    this.params.onFinish(this.params)
  }

  protected responseHasStatus(status: number): boolean {
    return this.response.status === status
  }

  protected getResponseHeader(header: string): string {
    return this.response.headers[header]
  }

  protected responseHasHeader(header: string): boolean {
    return this.getResponseHeader(header) !== undefined
  }

  protected isLocationVisitResponse(): boolean {
    return this.responseHasStatus(409) && this.responseHasHeader('x-inertia-location')
  }

  protected locationVisit(url: URL, preserveScroll: LocationVisit['preserveScroll']): boolean | void {
    try {
      SessionStorage.set({ preserveScroll })

      window.location.href = url.href

      if (isSameUrlWithoutHash(window.location, url)) {
        window.location.reload()
      }
    } catch (error) {
      return false
    }
  }
}
