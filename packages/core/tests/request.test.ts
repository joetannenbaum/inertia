import axios, { AxiosHeaders, AxiosResponse } from 'axios'
import { beforeEach, expect, test, vi } from 'vitest'
import * as events from '../src/events'
import { page } from '../src/page'
import { Request } from '../src/request'
import { Response } from '../src/response'
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
    headers: new AxiosHeaders(),
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

test('create a request from the helper method', () => {
  const request = Request.create(getRequestParams())

  expect(request).toBeInstanceOf(Request)
})

test('sending the correct headers for partial requests', async () => {
  vi.spyOn(page, 'get').mockReturnValue(homePage)
  axios.mockResolvedValue(axiosResponse())
  const responseHandleSpy = vi.spyOn(Response.prototype, 'handle').mockResolvedValue()

  const request = Request.create(getRequestParams({ only: ['foo', 'bar'] }))

  request.send()

  await vi.runAllTimersAsync()

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

  expect(responseHandleSpy).toHaveBeenCalledOnce()
})

test('including inertia version request header', async () => {
  vi.spyOn(page, 'get').mockReturnValue({ ...homePage, version: '2' })
  const responseHandleSpy = vi.spyOn(Response.prototype, 'handle').mockResolvedValue()

  axios.mockResolvedValue(axiosResponse())

  const request = Request.create(getRequestParams())

  request.send()

  await vi.runAllTimersAsync()

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

  expect(responseHandleSpy).toHaveBeenCalledOnce()
})

test('including the error bag in request header', async () => {
  vi.spyOn(page, 'get').mockReturnValue(homePage)
  const responseHandleSpy = vi.spyOn(Response.prototype, 'handle').mockResolvedValue()

  axios.mockResolvedValue(axiosResponse())

  const request = Request.create(
    getRequestParams({
      errorBag: 'error-tho',
    }),
  )

  request.send()

  await vi.runAllTimersAsync()

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

  expect(responseHandleSpy).toHaveBeenCalledOnce()
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
  const responseHandleSpy = vi.spyOn(Response.prototype, 'handle').mockResolvedValue()

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

  await vi.runAllTimersAsync()

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

  expect(responseHandleSpy).toHaveBeenCalledOnce()
})

test('errors with responses', async () => {
  vi.spyOn(page, 'get').mockReturnValue({ ...homePage, version: '2' })
  const responseHandleSpy = vi.spyOn(Response.prototype, 'handle').mockResolvedValue()

  const fireFinishEventsSpy = vi.spyOn(events, 'fireFinishEvent').mockReturnValue()
  const finishFn = vi.fn()

  axios.mockRejectedValue({
    response: axiosResponse({
      status: 422,
    }),
  })

  const requestParams = getRequestParams({
    onFinish: finishFn,
  })

  const request = Request.create(requestParams)

  request.send()

  await vi.runAllTimersAsync()

  expect(fireFinishEventsSpy).toHaveBeenCalledOnce()
  expect(fireFinishEventsSpy).toHaveBeenCalledWith(requestParams)

  expect(finishFn).toHaveBeenCalledOnce()
  expect(finishFn).toHaveBeenCalledWith(requestParams)

  expect(responseHandleSpy).toHaveBeenCalledOnce()
})

test.each([
  {
    shouldThrow: true,
    label: 'should throw',
  },
  {
    shouldThrow: false,
    label: 'should not throw',
  },
])('handle generic errors and it $label', { todo: true }, async ({ shouldThrow }) => {
  vi.spyOn(page, 'get').mockReturnValue(homePage)
  const responseHandleSpy = vi.spyOn(Response.prototype, 'handle').mockResolvedValue()

  const fireFinishEventsSpy = vi.spyOn(events, 'fireFinishEvent').mockReturnValue()
  const fireExceptionEventsSpy = vi.spyOn(events, 'fireExceptionEvent').mockReturnValue(shouldThrow)
  const finishFn = vi.fn()

  axios.mockRejectedValue()

  const requestParams = getRequestParams({
    onFinish: finishFn,
  })

  const request = Request.create(requestParams)

  //   if (!shouldThrow) {
  await expect(request.send()).rejects.toThrow()
  //   } else {
  //     await request.send()
  //   }

  await vi.runAllTimersAsync()

  expect(fireFinishEventsSpy).toHaveBeenCalledOnce()
  expect(fireFinishEventsSpy).toHaveBeenCalledWith(requestParams)

  expect(finishFn).toHaveBeenCalledOnce()
  expect(finishFn).toHaveBeenCalledWith(requestParams)

  expect(fireExceptionEventsSpy).toHaveBeenCalledOnce()

  expect(responseHandleSpy).not.toHaveBeenCalled()
})

test('request cancelled errors are handled gracefully', async () => {
  vi.spyOn(page, 'get').mockReturnValue(homePage)
  const responseHandleSpy = vi.spyOn(Response.prototype, 'handle').mockResolvedValue()

  const fireFinishEventsSpy = vi.spyOn(events, 'fireFinishEvent').mockReturnValue()
  const fireExceptionEventsSpy = vi.spyOn(events, 'fireExceptionEvent').mockReturnValue()
  const isCancelSpy = vi.spyOn(axios, 'isCancel').mockReturnValue(true)

  const finishFn = vi.fn()

  axios.mockRejectedValue()

  const requestParams = getRequestParams({
    onFinish: finishFn,
  })

  const request = Request.create(requestParams)

  request.send()

  await vi.runAllTimersAsync()

  expect(fireFinishEventsSpy).toHaveBeenCalledOnce()
  expect(fireFinishEventsSpy).toHaveBeenCalledWith(requestParams)

  expect(finishFn).toHaveBeenCalledOnce()
  expect(finishFn).toHaveBeenCalledWith(requestParams)

  expect(fireExceptionEventsSpy).not.toHaveBeenCalled()

  expect(isCancelSpy).toHaveBeenCalledOnce()

  expect(responseHandleSpy).not.toHaveBeenCalled()
  expect(fireExceptionEventsSpy).not.toHaveBeenCalled()
})
