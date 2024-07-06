import { default as axios, AxiosProgressEvent, AxiosRequestConfig, AxiosResponse } from 'axios'
import { fireExceptionEvent, fireFinishEvent, fireProgressEvent } from './events'
import { page as currentPage } from './page'
import { RequestParams } from './requestParams'
import { Response } from './response'
import { ActiveVisit, Page } from './types'
import { urlWithoutHash } from './url'

export class Request {
  protected response!: AxiosResponse
  protected cancelToken!: AbortController
  protected requestParams: RequestParams

  constructor(
    params: ActiveVisit,
    protected page: Page,
  ) {
    this.requestParams = RequestParams.create(params)
    this.cancelToken = new AbortController()
    this.requestParams.onCancelToken(() => this.cancel({ cancelled: true }))
  }

  public static create(params: ActiveVisit, page: Page): Request {
    return new Request(params, page)
  }

  public async send() {
    return axios({
      method: this.requestParams.params.method,
      url: urlWithoutHash(this.requestParams.params.url).href,
      data: this.requestParams.data(),
      params: this.requestParams.queryParams(),
      signal: this.cancelToken.signal,
      headers: this.getHeaders(),
      onUploadProgress: this.onProgress.bind(this),
    })
      .then((response) => {
        return Response.create(this.requestParams, response, this.page).handle()
      })
      .catch((error) => {
        if (error?.response) {
          return Response.create(this.requestParams, error.response, this.page).handle()
        }

        return Promise.reject(error)
      })
      .catch((error) => {
        if (axios.isCancel(error)) {
          return
        }

        if (fireExceptionEvent(error)) {
          return Promise.reject(error)
        }
      })
      .finally(() => {
        this.finish()
      })
  }

  protected finish(): void {
    if (this.requestParams.wasCancelledAtAll()) {
      return
    }

    this.requestParams.markAsFinished()
    this.fireFinishEvents()
  }

  protected fireFinishEvents(): void {
    fireFinishEvent(this.requestParams.all())
    this.requestParams.onFinish()
  }

  public cancel({ cancelled = false, interrupted = false }: { cancelled?: boolean; interrupted?: boolean }): void {
    this.cancelToken.abort()

    this.requestParams.markAsCancelled({ cancelled, interrupted })

    this.fireFinishEvents()
  }

  protected onProgress(progress: AxiosProgressEvent): void {
    if (this.requestParams.data() instanceof FormData) {
      progress.percentage = progress.progress ? Math.round(progress.progress * 100) : 0
      fireProgressEvent(progress)
      this.requestParams.params.onProgress(progress)
    }
  }

  protected getHeaders(): AxiosRequestConfig['headers'] {
    const headers: AxiosRequestConfig['headers'] = {
      ...this.requestParams.headers(),
      Accept: 'text/html, application/xhtml+xml',
      'X-Requested-With': 'XMLHttpRequest',
      'X-Inertia': true,
    }

    if (currentPage.get().version) {
      headers['X-Inertia-Version'] = currentPage.get().version
    }

    return headers
  }
}
