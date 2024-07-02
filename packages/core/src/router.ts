import debounce from './debounce'
import { fireBeforeEvent, fireNavigateEvent, fireStartEvent } from './events'
import { hasFiles } from './files'
import { isFormData, objectToFormData } from './formData'
import { History } from './history'
import { navigationType } from './navigationType'
import { page as currentPage } from './page'
import { Request } from './request'
import { Scroll } from './scroll'
import { SessionStorage } from './sessionStorage'
import {
  GlobalEvent,
  GlobalEventNames,
  GlobalEventResult,
  LocationVisit,
  Page,
  PendingVisit,
  RequestPayload,
  RouterInitParams,
  VisitHelperOptions,
  VisitOptions,
} from './types'
import { hrefToUrl, mergeDataIntoQueryString } from './url'

export class Router {
  protected activeSyncRequest?: Request

  public init({ initialPage, resolveComponent, swapComponent }: RouterInitParams): void {
    currentPage.init({
      initialPage,
      resolveComponent,
      swapComponent,
    })

    this.clearRememberedStateOnReload()
    this.initializeVisit()
    this.setupEventListeners()
  }

  public get(url: URL | string, data: RequestPayload = {}, options: VisitHelperOptions = {}): void {
    return this.visit(url, { ...options, method: 'get', data })
  }

  public post(url: URL | string, data: RequestPayload = {}, options: VisitHelperOptions = {}): void {
    return this.visit(url, { preserveState: true, ...options, method: 'post', data })
  }

  public put(url: URL | string, data: RequestPayload = {}, options: VisitHelperOptions = {}): void {
    return this.visit(url, { preserveState: true, ...options, method: 'put', data })
  }

  public patch(url: URL | string, data: RequestPayload = {}, options: VisitHelperOptions = {}): void {
    return this.visit(url, { preserveState: true, ...options, method: 'patch', data })
  }

  public delete(url: URL | string, options: Omit<VisitOptions, 'method'> = {}): void {
    return this.visit(url, { preserveState: true, ...options, method: 'delete' })
  }

  public reload(options: Omit<VisitOptions, 'preserveScroll' | 'preserveState'> = {}): void {
    return this.visit(window.location.href, { ...options, preserveScroll: true, preserveState: true })
  }

  public remember(data: unknown, key = 'default'): void {
    History.remember(data, key)
  }

  public restore(key = 'default'): unknown {
    return History.restore(key)
  }

  public on<TEventName extends GlobalEventNames>(
    type: TEventName,
    callback: (event: GlobalEvent<TEventName>) => GlobalEventResult<TEventName>,
  ): VoidFunction {
    const listener = ((event: GlobalEvent<TEventName>) => {
      const response = callback(event)

      if (event.cancelable && !event.defaultPrevented && response === false) {
        event.preventDefault()
      }
    }) as EventListener

    return this.registerListener(`inertia:${type}`, listener)
  }

  public cancel(): void {
    this.activeSyncRequest?.cancel({ cancelled: true })
  }

  public visit(
    href: string | URL,
    {
      method = 'get',
      data = {},
      replace = false,
      preserveScroll = false,
      preserveState = false,
      only = [],
      except = [],
      headers = {},
      errorBag = '',
      forceFormData = false,
      onCancelToken = () => {},
      onBefore = () => {},
      onStart = () => {},
      onProgress = () => {},
      onFinish = () => {},
      onCancel = () => {},
      onSuccess = () => {},
      onError = () => {},
      queryStringArrayFormat = 'brackets',
    }: VisitOptions = {},
  ): void {
    let url = typeof href === 'string' ? hrefToUrl(href) : href

    // TODO: Feels like url/data could be resolved in one shot in a method somewhere
    if ((hasFiles(data) || forceFormData) && !isFormData(data)) {
      data = objectToFormData(data)
    }

    if (!isFormData(data)) {
      const [_href, _data] = mergeDataIntoQueryString(method, url, data, queryStringArrayFormat)
      url = hrefToUrl(_href)
      data = _data
    }

    const visit: PendingVisit = {
      url,
      method,
      data,
      replace,
      preserveScroll,
      preserveState,
      only,
      except,
      headers,
      errorBag,
      forceFormData,
      queryStringArrayFormat,
      cancelled: false,
      completed: false,
      interrupted: false,
    }

    // If either of these return false, we don't want to continue
    if (onBefore(visit) === false || !fireBeforeEvent(visit)) {
      return
    }

    // Cancel any active requests
    this.activeSyncRequest?.cancel({ interrupted: true })

    // Save scroll regions for the current page
    Scroll.save(currentPage.page)

    fireStartEvent(visit)
    onStart(visit)

    this.activeSyncRequest = new Request({
      ...visit,
      onCancelToken,
      onBefore,
      onStart,
      onProgress,
      onFinish,
      onCancel,
      onSuccess,
      onError,
      queryStringArrayFormat,
    })

    this.activeSyncRequest.send().then(() => {
      this.activeSyncRequest = undefined
    })
  }

  public replace(url: URL | string, options: Omit<VisitOptions, 'replace'> = {}): void {
    console.warn(
      `Inertia.replace() has been deprecated and will be removed in a future release. Please use Inertia.${
        options.method ?? 'get'
      }() instead.`,
    )

    return this.visit(url, { preserveState: true, ...options, replace: true })
  }

  protected initializeVisit(): void {
    if (this.isBackForwardVisit()) {
      this.handleBackForwardVisit()
    } else if (this.isLocationVisit()) {
      this.handleLocationVisit()
    } else {
      this.handleInitialPageVisit()
    }
  }

  protected registerListener(type: string, listener: EventListener): VoidFunction {
    document.addEventListener(type, listener)

    return () => document.removeEventListener(type, listener)
  }

  protected clearRememberedStateOnReload(): void {
    if (navigationType.isReload()) {
      History.deleteState('rememberedState')
    }
  }

  protected handleInitialPageVisit(): void {
    currentPage.setUrlHash(window.location.hash)
    currentPage.set(currentPage.page, { preserveState: true }).then(() => fireNavigateEvent(currentPage.page))
  }

  protected setupEventListeners(): void {
    window.addEventListener('popstate', this.handlePopstateEvent.bind(this))
    document.addEventListener('scroll', debounce(Scroll.listen, 100), true)
  }

  protected isBackForwardVisit(): boolean {
    return History.hasAnyState() && navigationType.isBackForward()
  }

  protected handleBackForwardVisit(): void {
    History.setState('version', currentPage.page.version)

    currentPage.set(History.getAllState(), { preserveScroll: true, preserveState: true }).then(() => {
      Scroll.restore(currentPage.page)
      fireNavigateEvent(currentPage.page)
    })
  }

  protected isLocationVisit(): boolean {
    return SessionStorage.exists()
  }

  /**
   * @link https://inertiajs.com/redirects#external-redirects
   */
  protected handleLocationVisit(): void {
    const locationVisit: LocationVisit = JSON.parse(SessionStorage.get(''))

    SessionStorage.remove()

    currentPage.setUrlHash(window.location.hash)
    currentPage.remember(History.getState<Page['rememberedState']>('rememberedState', {}))
    currentPage.scrollRegions(History.getState<Page['scrollRegions']>('scrollRegions', []))

    currentPage
      .set(currentPage.page, { preserveScroll: locationVisit.preserveScroll, preserveState: true })
      .then(() => {
        if (locationVisit.preserveScroll) {
          Scroll.restore(currentPage.page)
        }

        fireNavigateEvent(currentPage.page)
      })
  }

  protected handlePopstateEvent(event: PopStateEvent): void {
    if (event.state === null) {
      const url = hrefToUrl(currentPage.page.url)
      url.hash = window.location.hash

      History.replaceState({ ...currentPage.page, url: url.href })
      Scroll.reset(currentPage.page)

      return
    }

    // TODO: This is a funny section...
    const page = event.state
    const component = currentPage.resolve(page.component)

    currentPage.swap({ component, page, preserveState: false }).then(() => {
      Scroll.restore(page)
      fireNavigateEvent(page)
    })
  }
}
