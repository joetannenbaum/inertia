import { beforeEach, expect, expectTypeOf, suite, test, vi } from 'vitest'
import * as events from '../src/events'
import { History } from '../src/history'
import { navigationType } from '../src/navigationType'
import { page } from '../src/page'
import { Request } from '../src/request'
import { Router } from '../src/router'
import { Scroll } from '../src/scroll'
import { SessionStorage } from '../src/sessionStorage'
import { FormDataConvertible } from '../src/types'

beforeEach(() => {
  vi.useFakeTimers()
})

expect.extend({
  dataToBeFormData(received, expected) {
    const { isNot } = this

    return {
      pass: typeof received === 'object' && received.data instanceof FormData,
      message: () => `data is${isNot ? ' not' : ''} instance of FormData`,
    }
  },
  dataToBeFormDataConvertible(received, expected) {
    const { isNot } = this

    return {
      pass: typeof received === 'object' && expectTypeOf(received.data).toMatchTypeOf<FormDataConvertible>(),
      message: () => `data is${isNot ? ' not' : ''} instance of FormData`,
    }
  },
})

const homePage = {
  component: 'home',
  props: {
    errors: {},
  },
  url: '/',
  version: '1',
  scrollRegions: [],
  rememberedState: {},
}

const getRouter = (cb?: (router: Router) => void) => {
  const router = new Router()

  if (cb) {
    cb(router)
  }

  router.init({
    initialPage: homePage,
    resolveComponent: () => {},
    swapComponent: () => {
      return Promise.resolve({
        component: 'home',
        props: {
          errors: {},
        },
        url: '/',
        version: '1',
        scrollRegions: [],
        rememberedState: {},
      })
    },
  })

  return router
}

suite('init', () => {
  test('clear remembered state on navigation type reload', () => {
    const navTypeSpy = vi.spyOn(navigationType, 'isReload').mockReturnValue(true)
    const historySpy = vi.spyOn(History, 'deleteState').mockReturnValue()

    getRouter()

    expect(navTypeSpy).toHaveBeenCalledTimes(1)
    expect(historySpy).toHaveBeenCalledWith('rememberedState')
  })

  test('will not clear remembered state when navigation type is not reload', () => {
    const navTypeSpy = vi.spyOn(navigationType, 'isReload').mockReturnValue(false)
    const historySpy = vi.spyOn(History, 'deleteState').mockReturnValue()

    getRouter()

    expect(navTypeSpy).toHaveBeenCalledTimes(1)
    expect(historySpy).not.toHaveBeenCalled()
  })

  test('handle back forward visit', async () => {
    const navTypeSpy = vi.spyOn(navigationType, 'isBackForward').mockReturnValue(true)
    const historySpies = {
      hasAnyState: vi.spyOn(History, 'hasAnyState').mockReturnValue(true),
      setState: vi.spyOn(History, 'setState').mockReturnValue(),
      getAllState: vi.spyOn(History, 'getAllState').mockReturnValue({
        myState: 'is here',
      }),
    }
    const pageSpy = vi.spyOn(page, 'set').mockResolvedValue()
    const scrollRestoreSpy = vi.spyOn(Scroll, 'restore').mockReturnValue()
    const fireNavigateEventSpy = vi.spyOn(events, 'fireNavigateEvent').mockReturnValue()

    getRouter()

    await vi.runAllTimersAsync()

    expect(navTypeSpy).toHaveBeenCalledTimes(1)

    expect(historySpies.hasAnyState).toHaveBeenCalledTimes(1)
    expect(historySpies.setState).toHaveBeenCalledTimes(1)
    expect(historySpies.setState).toHaveBeenCalledWith('version', '1')
    expect(historySpies.getAllState).toHaveBeenCalledTimes(1)

    expect(pageSpy).toHaveBeenCalledTimes(1)
    expect(pageSpy).toHaveBeenCalledWith({ myState: 'is here' }, { preserveScroll: true, preserveState: true })

    expect(scrollRestoreSpy).toHaveBeenCalledTimes(1)
    expect(scrollRestoreSpy).toHaveBeenCalledWith(homePage)

    expect(fireNavigateEventSpy).toHaveBeenCalledTimes(1)
    expect(fireNavigateEventSpy).toHaveBeenCalledWith(homePage)
  })

  test.each([
    { preserveScroll: true, shouldBeCalled: 1 },
    { preserveScroll: false, shouldBeCalled: 0 },
  ])(
    'handle location visit with preserve scroll equal to $preserveScroll',
    async ({ preserveScroll, shouldBeCalled }) => {
      const sessionStorageSpies = {
        exists: vi.spyOn(SessionStorage, 'exists').mockReturnValue(true),
        get: vi.spyOn(SessionStorage, 'get').mockReturnValue(
          JSON.stringify({
            preserveScroll,
          }),
        ),
        remove: vi.spyOn(SessionStorage, 'remove').mockReturnValue(),
      }

      const pageSpies = {
        setUrlHash: vi.spyOn(page, 'setUrlHash').mockReturnValue(),
        remember: vi.spyOn(page, 'remember').mockResolvedValue(),
        scrollRegions: vi.spyOn(page, 'scrollRegions').mockResolvedValue(),
        set: vi.spyOn(page, 'set').mockResolvedValue(),
      }

      const historySpies = {
        getState: vi.spyOn(History, 'getState').mockReturnValue({}),
      }

      const scrollSpy = {
        restore: vi.spyOn(Scroll, 'restore').mockReturnValue(),
      }

      const fireNavigateEventSpy = vi.spyOn(events, 'fireNavigateEvent').mockReturnValue()

      getRouter()

      await vi.runAllTimersAsync()

      expect(sessionStorageSpies.exists).toHaveBeenCalledTimes(1)
      expect(sessionStorageSpies.get).toHaveBeenCalledTimes(1)
      expect(sessionStorageSpies.remove).toHaveBeenCalledTimes(1)

      expect(historySpies.getState).toHaveBeenCalledTimes(2)
      expect(historySpies.getState).toHaveBeenNthCalledWith(1, 'rememberedState', {})
      expect(historySpies.getState).toHaveBeenNthCalledWith(2, 'scrollRegions', [])

      expect(pageSpies.setUrlHash).toHaveBeenCalledTimes(1)
      expect(pageSpies.remember).toHaveBeenCalledTimes(1)
      expect(pageSpies.scrollRegions).toHaveBeenCalledTimes(1)
      expect(pageSpies.set).toHaveBeenCalledTimes(1)
      expect(pageSpies.set).toHaveBeenCalledWith(homePage, { preserveScroll, preserveState: true })

      expect(fireNavigateEventSpy).toHaveBeenCalledTimes(1)

      expect(scrollSpy.restore).toHaveBeenCalledTimes(shouldBeCalled)
    },
  )

  test('handle initial page visit', async () => {
    const pageSpies = {
      setUrlHash: vi.spyOn(page, 'setUrlHash').mockReturnValue(),
      set: vi.spyOn(page, 'set').mockResolvedValue(),
    }

    const fireNavigateEventSpy = vi.spyOn(events, 'fireNavigateEvent').mockReturnValue()

    getRouter()

    await vi.runAllTimersAsync()

    expect(pageSpies.setUrlHash).toHaveBeenCalledTimes(1)
    expect(pageSpies.set).toHaveBeenCalledTimes(1)
    expect(pageSpies.set).toHaveBeenCalledWith(homePage, { preserveState: true })

    expect(fireNavigateEventSpy).toHaveBeenCalledTimes(1)
  })

  test('it sets up listeners on init', { todo: true }, () => {
    // Listen for popstate
    // Listen for scroll (debounced)
  })

  test('handles popstate event when the state is null', { todo: true }, () => {
    const historySpy = vi.spyOn(History, 'replaceState').mockReturnValue()
    const scrollSpy = vi.spyOn(Scroll, 'reset').mockReturnValue()

    getRouter()

    // Might have to extract the handler to something we can call directly
    window.dispatchEvent(new PopStateEvent('popstate', { state: null }))

    expect(historySpy).toHaveBeenCalledTimes(1)
    expect(scrollSpy).toHaveBeenCalledTimes(1)
    // If the state is null
    //  - re-construct the url from the current page + window hash
    //  - replace the history state with the current page + full url
    //  - reset scroll positions
    // Otherwise
    //  - get the page from the state
    //  - resolve the component
    //  - swap the component
    //  - restore scroll positions
    //  - fire navigate event
  })

  test('handles scroll event', { todo: true }, async () => {
    const scrollSpy = vi.spyOn(Scroll, 'onScroll').mockReturnValue()

    getRouter()

    // If the current page has scroll regions, save the scroll position
    window.dispatchEvent(new CustomEvent('scroll'))

    await vi.runAllTimersAsync()

    expect(scrollSpy).toHaveBeenCalledTimes(1)
  })
})

suite('visit', () => {
  test('it can cancel a visit', { todo: true }, () => {
    // It can cancel an active request and will mark it as cancelled
  })

  test.each([
    { url: '/home', expectedUrl: new URL('/home', 'http://localhost:3000') },
    { url: new URL('/home', 'http://localhost'), expectedUrl: new URL('/home', 'http://localhost') },
  ])('it can make a visit with either a string url or URL object', ({ url, expectedUrl }) => {
    const requestSpies = {
      create: vi.spyOn(Request, 'create'),
      send: vi.spyOn(Request.prototype, 'send').mockResolvedValue(),
    }

    const router = getRouter()

    router.visit(url)

    expect(requestSpies.create).toHaveBeenCalledTimes(1)
    expect(requestSpies.create).toHaveBeenCalledWith(
      expect.objectContaining({
        url: expectedUrl,
      }),
    )
  })

  test.each([
    {
      label: 'file',
      params: {
        data: {
          file: new File([''], 'file.txt'),
        },
      },
      expectation: () => expect.dataToBeFormData(),
    },
    {
      label: 'force',
      params: {
        data: {
          whatever: 'ok',
        },
        forceFormData: true,
      },
      expectation: () => expect.dataToBeFormData(),
    },
    {
      label: 'object',
      params: {
        data: {
          whatever: 'ok',
        },
      },
      expectation: () => expect.dataToBeFormDataConvertible(),
    },
  ])('if the data has files it will transform the data to FormData [$label]', ({ params, expectation }) => {
    const requestSpies = {
      create: vi.spyOn(Request, 'create'),
      send: vi.spyOn(Request.prototype, 'send').mockResolvedValue(),
    }

    const router = getRouter()

    router.visit('/home', params)

    expect(requestSpies.create).toHaveBeenCalledTimes(1)
    expect(requestSpies.create).toHaveBeenCalledWith(expectation())
    // TODO: Also check that the url has changed?
  })

  test('we can abort a request by returning false from the onBefore callback', () => {
    const requestSpies = {
      create: vi.spyOn(Request, 'create'),
      send: vi.spyOn(Request.prototype, 'send').mockResolvedValue(),
    }

    const router = getRouter()

    router.visit('/home', {
      onBefore() {
        return false
      },
    })

    expect(requestSpies.create).not.toHaveBeenCalled()
    expect(requestSpies.send).not.toHaveBeenCalled()
  })

  test('we can abort a request by returning false from the global before callback', () => {
    const requestSpies = {
      create: vi.spyOn(Request, 'create'),
      send: vi.spyOn(Request.prototype, 'send').mockResolvedValue(),
    }

    const router = getRouter()

    router.on('before', () => false)

    router.visit('/home')

    expect(requestSpies.create).not.toHaveBeenCalled()
    expect(requestSpies.send).not.toHaveBeenCalled()
  })

  test('we will cancel an inflight request if another comes in', { todo: true }, () => {})

  test('save scroll positions for in flight requests', { todo: true }, () => {})

  test('we return an on cancel token from the onCancel callback', { todo: true }, () => {})

  test('start event callbacks are fired', { todo: true }, () => {
    // onStart
    // global
  })

  test('we send the correct headers for partial requests', { todo: true }, () => {})

  test('we include inertia version request header', { todo: true }, () => {})

  test('we include error bag in request header', { todo: true }, () => {})

  test('we fire on progress events', { todo: true }, () => {
    // onProgress
    // global
  })

  test('props are merged for partial request responses', { todo: true }, () => {})

  test('preserve scroll option is respected after response', { todo: true }, () => {
    // also the opposite
  })

  test('preserve state option is respected after response', { todo: true }, () => {
    // if we have remembered state *and* the response component = current component
    // also the opposite (don't preserve state)
  })

  test('preserve url hash if response url is the same', { todo: true }, () => {})

  test('set the current page after a valid response', { todo: true }, () => {})

  test('if there are errors, fire error events', { todo: true }, () => {
    // onError
    // global
  })

  test('if there are no errors, fire success events', { todo: true }, () => {
    // onError
    // global
  })

  test('if there are no errors, fire success events', { todo: true }, () => {
    // onError
    // global
  })

  test('set the current page for inertia responses that are not 2xx', { todo: true }, () => {
    // onError
    // global
  })

  test('handles location responses', { todo: true }, () => {
    // add hash to location url if request url without hash = location url without hash
    // set the location visit object ({ preserveScroll }) in session storage
    // see location visit test above
  })

  test('handles invalid responses', { todo: true }, () => {
    // fire invalid event
    // show error modal
  })

  test('will continue to error if there is no response in the error object', { todo: true }, () => {})

  test('once a visit completes, fire finish events', { todo: true }, () => {
    // only fire if the visit was not cancelled/interrupted
    // mark visit as complete(?)
    // onFinish
    // global
  })

  test('handle actual exceptions', { todo: true }, () => {
    // only if it's not an axios cancellation exception
    // fire exception event
    // finish visit (see above)
    // if the exception event returns true, continue to throw the exception
  })

  test('get helper', { todo: true }, () => {})

  test('post helper', { todo: true }, () => {})

  test('put helper', { todo: true }, () => {})

  test('reload helper', { todo: true }, () => {
    // preserve state
    // preserve scroll
    // same url
    // get
  })

  test('patch helper', { todo: true }, () => {})

  test('delete helper', { todo: true }, () => {})

  test('we can remember state', { todo: true }, () => {
    // not on server (ssr)
    // with key
    // without key (default)
  })

  test('we can restore state', { todo: true }, () => {
    // not on server (ssr)
    // with key
    // without key (default)
  })

  test('we can listen for global events', { todo: true }, () => {
    // if event is cancelable and callback returns false, cancel the event
  })
})

suite('page', () => {
  test('we can set the current page', { todo: true }, () => {
    // sensible defaults for scrollRegions and rememberedState
  })

  test('we can set the current page and preserve scroll', { todo: true }, () => {})

  test('we can replace the current page', { todo: true }, () => {})
})
