import { test } from 'vitest'

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
