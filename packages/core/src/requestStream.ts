import { Request } from './request'

export class RequestStream {
  protected requests: Request[] = []

  constructor(
    protected maxConcurrent: number,
    protected interruptible: boolean,
  ) {
    //
  }

  public send(request: Request) {
    this.requests.push(request)

    request.send().then(() => {
      this.requests = this.requests.filter((r) => r !== request)
    })
  }

  public cancelInFlight(force = false): void {
    if (!this.shouldCancel(force)) {
      return
    }

    const request = this.requests.shift()!

    request.cancel({ interrupted: true })
  }

  protected shouldCancel(force: boolean): boolean {
    if (force) {
      return true
    }

    return this.interruptible && this.requests.length >= this.maxConcurrent
  }
}
