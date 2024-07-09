import { fireNavigateEvent } from './events'
import { History } from './history'
import { Scroll } from './scroll'
import { Component, Page, PageHandler, PageResolver, PreserveStateOption, RouterInitParams } from './types'
import { hrefToUrl, isSameUrlWithoutHash } from './url'

class CurrentPage {
  protected page!: Page
  protected swapComponent!: PageHandler
  protected resolveComponent!: PageResolver
  protected componentId = {}
  protected onNewComponentCallbacks: VoidFunction[] = []
  protected firstPageLoad = true

  public init({ initialPage, swapComponent, resolveComponent }: RouterInitParams) {
    this.page = initialPage
    this.swapComponent = swapComponent
    this.resolveComponent = resolveComponent

    return this
  }

  public set(
    page: Page,
    {
      replace = false,
      preserveScroll = false,
      preserveState = false,
    }: {
      replace?: boolean
      preserveScroll?: PreserveStateOption
      preserveState?: PreserveStateOption
    } = {},
  ): Promise<void> {
    this.componentId = {}

    const componentId = this.componentId

    return this.resolve(page.component).then((component) => {
      if (componentId !== this.componentId) {
        // Component has changed since we started resolving this component, bail
        return
      }

      page.scrollRegions ??= []
      page.rememberedState ??= {}
      replace = replace || isSameUrlWithoutHash(hrefToUrl(page.url), window.location)
      replace ? History.replaceState(page) : History.pushState(page)

      const isNewComponent = !this.isTheSame(page) || this.firstPageLoad

      this.page = page

      if (isNewComponent) {
        this.onNewComponentCallbacks.forEach((cb) => cb())
      }

      this.firstPageLoad = false

      return this.swap({ component, page, preserveState }).then(() => {
        if (!preserveScroll) {
          Scroll.reset(page)
        }

        if (!replace) {
          fireNavigateEvent(page)
        }
      })
    })
  }

  public get(): Page {
    return this.page
  }

  public setUrlHash(hash: string): void {
    this.page.url += hash
  }

  public remember(data: Page['rememberedState']): void {
    this.page.rememberedState = data
  }

  public scrollRegions(regions: Page['scrollRegions']): void {
    this.page.scrollRegions = regions
  }

  public swap({
    component,
    page,
    preserveState,
  }: {
    component: Component
    page: Page
    preserveState: PreserveStateOption
  }): Promise<unknown> {
    return this.swapComponent({ component, page, preserveState })
  }

  public resolve(component: string): Promise<Component> {
    return Promise.resolve(this.resolveComponent(component))
  }

  public isTheSame(page: Page): boolean {
    return this.page.component === page.component
  }

  public onNewComponent(cb: VoidFunction): VoidFunction {
    this.onNewComponentCallbacks.push(cb)

    return () => {
      this.onNewComponentCallbacks = this.onNewComponentCallbacks.filter((callback) => callback !== cb)
    }
  }
}

export const page = new CurrentPage()
