/**
 * A generic web component to display error states
 * Can be used for both blog entries and catalogue reviews
 */
export class ErrorState extends HTMLElement {
  private message: string = "An error occurred..."

  constructor() {
    super()
    this.render()
  }

  /**
   * Set a custom message for the error state
   */
  setMessage(message: string) {
    this.message = message
    this.render()
    return this
  }

  /**
   * Render the error state
   */
  private render() {
    this.innerHTML = `
      <div class="h-[153.25px] w-full flex items-center justify-center gap-1.5 text-primary rounded">
        <svg xmlns="http://www.w3.org/2000/svg" class="inline h-6 w-6 pb-1" viewBox="0 0 512 512">
          <!-- Icon from Font Awesome 5 Solid by Dave Gandy - https://creativecommons.org/licenses/by/4.0/ -->
          <path fill="currentColor" d="m473.7 73.8l-2.4-2.5c-46-47-118-51.7-169.6-14.8L336 159.9l-96 64l48 128l-144-144l96-64l-28.6-86.5C159.7 19.6 87 24 40.7 71.4l-2.4 2.4C-10.4 123.6-12.5 202.9 31 256l212.1 218.6c7.1 7.3 18.6 7.3 25.7 0L481 255.9c43.5-53 41.4-132.3-7.3-182.1"/>
        </svg>
        <p>${this.message}</p>
      </div>
    `
  }
}

// Register the component
customElements.define("error-state", ErrorState)
