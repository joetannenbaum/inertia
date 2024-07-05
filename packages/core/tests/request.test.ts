import axios, { AxiosResponse } from 'axios'
import { beforeEach, expect, test, vi } from 'vitest'
import * as events from '../src/events'
import modal from '../src/modal'
import { page } from '../src/page'
import { Request } from '../src/request'
import { ActiveVisit } from '../src/types'

const getRequestParams = (overrides: Partial<ActiveVisit> = {}): ActiveVisit => ({
  url: new URL('/', 'http://localhost'),
  method: 'get',
  data: {},
  headers: {},
  onCancelToken: () => {},
  onBefore: () => {},
  onStart: () => {},
  onProgress: () => {},
  onFinish: () => {},
  onCancel: () => {},
  onSuccess: () => {},
  onError: () => {},
  completed: false,
  cancelled: false,
  interrupted: false,
  forceFormData: false,
  queryStringArrayFormat: 'brackets',
  replace: false,
  only: [],
  except: [],
  preserveScroll: false,
  preserveState: false,
  errorBag: '',
  ...overrides,
})

const axiosResponse = (overrides = {}): AxiosResponse => ({
  data: {},
  status: 200,
  statusText: 'OK',
  headers: {},
  config: {
    headers: {},
  },
  request: {},
  ...overrides,
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

beforeEach(() => {
  vi.useFakeTimers()
})

vi.mock('axios')
vi.mock('modal')

test('create a request from the helper method', () => {
  const request = Request.create(getRequestParams())

  expect(request).toBeInstanceOf(Request)
})

test('sending the correct headers for partial requests', async () => {
  vi.spyOn(page, 'get').mockReturnValue(homePage)
  vi.spyOn(modal, 'show').mockResolvedValue()

  axios.mockResolvedValue(axiosResponse())

  const request = Request.create(getRequestParams({ only: ['foo', 'bar'] }))

  request.send()

  expect(axios).toHaveBeenCalledWith({
    method: 'get',
    url: 'http://localhost/',
    data: {},
    headers: {
      Accept: 'text/html, application/xhtml+xml',
      'X-Requested-With': 'XMLHttpRequest',
      'X-Inertia': true,
      'X-Inertia-Version': '1',
      'X-Inertia-Partial-Component': 'home',
      'X-Inertia-Partial-Data': 'foo,bar',
    },
    onUploadProgress: expect.any(Function),
    params: {},
    signal: expect.any(Object),
  })
})

test('including inertia version request header', async () => {
  vi.spyOn(page, 'get').mockReturnValue({ ...homePage, version: '2' })
  vi.spyOn(modal, 'show').mockResolvedValue()

  axios.mockResolvedValue(axiosResponse())

  const request = Request.create(getRequestParams())

  request.send()

  expect(axios).toHaveBeenCalledWith({
    method: 'get',
    url: 'http://localhost/',
    data: {},
    headers: {
      Accept: 'text/html, application/xhtml+xml',
      'X-Requested-With': 'XMLHttpRequest',
      'X-Inertia': true,
      'X-Inertia-Version': '2',
    },
    onUploadProgress: expect.any(Function),
    params: {},
    signal: expect.any(Object),
  })
})

test('including the error bag in request header', async () => {
  vi.spyOn(page, 'get').mockReturnValue(homePage)
  vi.spyOn(modal, 'show').mockResolvedValue()

  axios.mockResolvedValue(axiosResponse())

  const request = Request.create(
    getRequestParams({
      errorBag: 'error-tho',
    }),
  )

  request.send()

  expect(axios).toHaveBeenCalledWith({
    method: 'get',
    url: 'http://localhost/',
    data: {},
    headers: {
      Accept: 'text/html, application/xhtml+xml',
      'X-Requested-With': 'XMLHttpRequest',
      'X-Inertia': true,
      'X-Inertia-Version': '1',
      'X-Inertia-Error-Bag': 'error-tho',
    },
    onUploadProgress: expect.any(Function),
    params: {},
    signal: expect.any(Object),
  })
})

test('firing on progress events', { todo: true }, async () => {
  // onProgress
  // global
})

test.each([
  {
    label: 'cancelling',
    cancelParams: {
      cancelled: true,
    },
    expectedFinal: {
      cancelled: true,
      interrupted: false,
      completed: false,
    },
  },
  {
    label: 'interrupting',
    cancelParams: {
      interrupted: true,
    },
    expectedFinal: {
      cancelled: false,
      interrupted: true,
      completed: false,
    },
  },
])('$label a request', async ({ cancelParams, expectedFinal }) => {
  vi.spyOn(page, 'get').mockReturnValue({ ...homePage, version: '2' })
  vi.spyOn(modal, 'show').mockResolvedValue()
  const abortSpy = vi.spyOn(AbortController.prototype, 'abort')
  const fireFinishEventsSpy = vi.spyOn(events, 'fireFinishEvent').mockReturnValue()
  const cancelFn = vi.fn()
  const finishFn = vi.fn()

  axios.mockResolvedValue(axiosResponse())

  const requestParams = getRequestParams({
    onCancel: cancelFn,
    onFinish: finishFn,
  })

  const request = Request.create(requestParams)

  request.send()

  request.cancel(cancelParams)

  expect(cancelFn).toHaveBeenCalledOnce()
  expect(abortSpy).toHaveBeenCalledOnce()

  const finalParams = {
    ...requestParams,
    ...expectedFinal,
  }

  expect(fireFinishEventsSpy).toHaveBeenCalledOnce()
  expect(fireFinishEventsSpy).toHaveBeenCalledWith(finalParams)

  expect(finishFn).toHaveBeenCalledOnce()
  expect(finishFn).toHaveBeenCalledWith(finalParams)
})

test('props are merged for partial request responses', { todo: true }, async () => {})

test('preserve scroll option is respected after response', { todo: true }, async () => {
  // also the opposite
})

test('preserve state option is respected after response', { todo: true }, async () => {
  // if we have remembered state *and* the response component = current component
  // also the opposite (don't preserve state)
})

test('preserve url hash if response url is the same', { todo: true }, async () => {})

test('set the current page after a valid response', { todo: true }, async () => {})

test('if there are errors, fire error events', { todo: true }, async () => {
  // onError
  // global
})

test('if there are no errors, fire success events', { todo: true }, async () => {
  // onError
  // global
})

test('set the current page for inertia responses that are not 2xx', { todo: true }, async () => {
  // onError
  // global
})

test('handles location responses', { todo: true }, async () => {
  // add hash to location url if request url without hash = location url without hash
  // set the location visit object ({ preserveScroll }) in session storage
  // see location visit test above
})

test('handles invalid responses', { todo: true }, async () => {
  // fire invalid event
  // show error modal
})

test('will continue to error if there is no response in the error object', { todo: true }, async () => {})

test('once a visit completes, fire finish events', { todo: true }, async () => {
  // only fire if the visit was not cancelled/interrupted
  // mark visit as complete(?)
  // onFinish
  // global
})

test('handle actual exceptions', { todo: true }, async () => {
  // only if it's not an axios cancellation exception
  // fire exception event
  // finish visit (see above)
  // if the exception event returns true, continue to throw the exception
})

test('we return an on cancel token from the onCancel callback', { todo: true }, async () => {
  // https://inertiajs.com/manual-visits#visit-cancellation
})
