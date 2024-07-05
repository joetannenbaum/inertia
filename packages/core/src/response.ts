import { AxiosResponse } from 'axios'
import { fireErrorEvent, fireInvalidEvent, fireSuccessEvent } from './events'
import { History } from './history'
import modal from './modal'
import { page as currentPage } from './page'
import { RequestParams } from './requestParams'
import { SessionStorage } from './sessionStorage'
import { ErrorBag, Errors, LocationVisit, Page, PreserveStateOption } from './types'
import { hrefToUrl, isSameUrlWithoutHash, setHashIfSameUrl } from './url'

export class Response {
  constructor(
    protected requestParams: RequestParams,
    protected response: AxiosResponse,
  ) {}

  public static create(params: RequestParams, response: AxiosResponse): Response {
    return new Response(params, response)
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

    // TODO... is this correct?
    return Promise.reject({ response: this.response })
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

  protected setPage(): Promise<void> {
    // TODO: Would love to type this properly if we can
    const pageResponse: Page = this.response.data

    if (this.requestParams.isPartial() && pageResponse.component === currentPage.get().component) {
      pageResponse.props = { ...currentPage.get().props, ...pageResponse.props }
    }

    this.requestParams.params.preserveScroll = this.resolvePreserveOption(
      this.requestParams.params.preserveScroll,
      pageResponse,
    )
    this.requestParams.params.preserveState = this.resolvePreserveOption(
      this.requestParams.params.preserveState,
      pageResponse,
    )

    if (
      this.requestParams.params.preserveState &&
      History.getState('rememberedState') &&
      pageResponse.component === currentPage.get().component
    ) {
      pageResponse.rememberedState = History.getState('rememberedState')
    }

    const responseUrl = hrefToUrl(pageResponse.url)

    setHashIfSameUrl(this.requestParams.params.url, responseUrl)

    // TODO: I moved this out of the if statement,
    // but I'm not sure if this is always applicable outside of the hash logic
    pageResponse.url = responseUrl.href

    return currentPage.set(pageResponse, {
      replace: this.requestParams.params.replace,
      preserveScroll: this.requestParams.params.preserveScroll,
      preserveState: this.requestParams.params.preserveState,
    })
  }

  protected getScopedErrors(errors: Errors & ErrorBag): Errors {
    if (!this.requestParams.params.errorBag) {
      return errors
    }

    return errors[this.requestParams.params.errorBag] || {}
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
}
