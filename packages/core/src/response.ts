import { AxiosResponse } from 'axios'
import { router } from '.'
import { fireErrorEvent, fireInvalidEvent, fireSuccessEvent } from './events'
import { History } from './history'
import modal from './modal'
import { page as currentPage } from './page'
import { poll } from './poll'
import { RequestParams } from './requestParams'
import { SessionStorage } from './sessionStorage'
import { ErrorBag, Errors, LocationVisit, Page, VisitOptions } from './types'
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

    if (!this.requestParams.isPartial()) {
      poll.clear()
    }

    await this.setPage()

    const errors = currentPage.get().props.errors || {}

    if (Object.keys(errors).length > 0) {
      const scopedErrors = this.getScopedErrors(errors)

      fireErrorEvent(scopedErrors)

      return this.requestParams.params.onError(scopedErrors)
    }

    this.loadDeferredProps()

    fireSuccessEvent(currentPage.get())

    this.requestParams.params.onSuccess(currentPage.get())
  }

  protected loadDeferredProps() {
    if (!this.response.data.props.deferred) {
      // We don't have any deferred props to load
      return
    }

    if (this.requestParams.isPartial()) {
      // We only load deferred props on full page visits
      return
    }

    Object.entries(this.response.data.props.deferred).forEach(([key, group]) => {
      router.reload({ only: group as VisitOptions['only'] })
    })
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
      // If the request is sync, we should always set the page
      return true
    }

    if (this.originatingPage.component !== pageResponse.component) {
      // We originated from a component but the response re-directed us,
      // we should respect the redirection and set the page
      return true
    }

    // At this point, if the originating request component is different than the current component,
    // the user has since navigated and we should discard the response
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
