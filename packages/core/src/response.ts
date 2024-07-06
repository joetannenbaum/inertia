import { AxiosResponse } from 'axios'
import { router } from '.'
import { fireErrorEvent, fireInvalidEvent, fireSuccessEvent } from './events'
import { History } from './history'
import modal from './modal'
import { page as currentPage } from './page'
import { RequestParams } from './requestParams'
import { SessionStorage } from './sessionStorage'
import { ErrorBag, Errors, LocationVisit, Page } from './types'
import { hrefToUrl, isSameUrlWithoutHash, setHashIfSameUrl } from './url'

export class Response {
  constructor(
    protected requestParams: RequestParams,
    protected response: AxiosResponse,
    protected originatingPage: Page,
  ) {}

  public static create(params: RequestParams, response: AxiosResponse, originatingPage: Page): Response {
    return new Response(params, response, originatingPage)
  }

  public async handle() {
    if (!this.isInertiaResponse()) {
      return this.handleNonInertiaResponse()
    }

    await this.setPage()

    const errors = currentPage.get().props.errors || {}

    if (Object.keys(errors).length > 0) {
      const scopedErrors = this.getScopedErrors(errors)

      fireErrorEvent(scopedErrors)

      return this.requestParams.params.onError(scopedErrors)
    }

    if (this.hasHeader('x-inertia-deferred') && !this.requestParams.isPartial()) {
      this.getHeader('x-inertia-deferred')
        .split(',')
        .forEach((deferred) => {
          router.get(
            this.response.config.url!,
            {
              a: Math.random(),
            },
            {
              only: [deferred],
              async: true,
              preserveScroll: true,
              preserveState: true,
            },
          )
          // router.reload({ only: [deferred] })
        })
    }

    fireSuccessEvent(currentPage.get())

    this.requestParams.params.onSuccess(currentPage.get())
  }

  protected async handleNonInertiaResponse() {
    if (this.isLocationVisit()) {
      const locationUrl = hrefToUrl(this.getHeader('x-inertia-location'))

      setHashIfSameUrl(this.requestParams.params.url, locationUrl)

      return this.locationVisit(locationUrl, this.requestParams.params.preserveScroll === true)
    }

    if (fireInvalidEvent(this.response)) {
      return modal.show(this.response.data)
    }
  }

  protected isInertiaResponse(): boolean {
    return this.hasHeader('x-inertia')
  }

  protected hasStatus(status: number): boolean {
    return this.response.status === status
  }

  protected getHeader(header: string): string {
    return this.response.headers[header]
  }

  protected hasHeader(header: string): boolean {
    return this.getHeader(header) !== undefined
  }

  protected isLocationVisit(): boolean {
    return this.hasStatus(409) && this.hasHeader('x-inertia-location')
  }

  /**
   * @link https://inertiajs.com/redirects#external-redirects
   */
  protected locationVisit(url: URL, preserveScroll: LocationVisit['preserveScroll']): boolean | void {
    try {
      SessionStorage.set({ preserveScroll })

      if (isSameUrlWithoutHash(window.location, url)) {
        window.location.reload()
      } else {
        window.location.href = url.href
      }
    } catch (error) {
      return false
    }
  }

  protected setPage(): Promise<void> {
    const pageResponse: Page = this.response.data

    if (!this.shouldSetPage(pageResponse)) {
      return Promise.resolve()
    }

    this.mergeProps(pageResponse)
    this.setRememberedState(pageResponse)

    this.requestParams.setPreserveOptions(pageResponse)

    pageResponse.url = this.pageUrl(pageResponse)

    return currentPage.set(pageResponse, {
      replace: this.requestParams.params.replace,
      preserveScroll: this.requestParams.params.preserveScroll,
      preserveState: this.requestParams.params.preserveState,
    })
  }

  protected shouldSetPage(pageResponse: Page): boolean {
    // TODO: Do we even need the pageResponse here? Maybe not?

    if (!this.requestParams.params.async) {
      // If the request is not async, we should always set the page
      return true
    }

    // If the originating request component is different than the current component,
    // we should not set the page yet.
    return this.originatingPage.component === currentPage.get().component
  }

  protected pageUrl(pageResponse: Page) {
    const responseUrl = hrefToUrl(pageResponse.url)

    setHashIfSameUrl(this.requestParams.params.url, responseUrl)

    return responseUrl.href
  }

  protected mergeProps(pageResponse: Page): void {
    if (this.requestParams.isPartial() && pageResponse.component === currentPage.get().component) {
      pageResponse.props = { ...currentPage.get().props, ...pageResponse.props }
    }
  }

  protected setRememberedState(pageResponse: Page): void {
    if (
      this.requestParams.params.preserveState &&
      History.getState('rememberedState') &&
      pageResponse.component === currentPage.get().component
    ) {
      pageResponse.rememberedState = History.getState('rememberedState')
    }
  }

  protected getScopedErrors(errors: Errors & ErrorBag): Errors {
    if (!this.requestParams.params.errorBag) {
      return errors
    }

    return errors[this.requestParams.params.errorBag] || {}
  }
}
