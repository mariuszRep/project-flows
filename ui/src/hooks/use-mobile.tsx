import * as React from "react"

const MOBILE_BREAKPOINT = 768

// Debounce function
function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), wait)
  }
}

export function useIsMobile(breakpoint = MOBILE_BREAKPOINT) {
  const [isMobile, setIsMobile] = React.useState(false)

  const checkMobile = React.useCallback(() => {
    setIsMobile(window.innerWidth < breakpoint)
  }, [breakpoint])

  React.useEffect(() => {
    // Initial check
    checkMobile()

    // Debounced resize handler
    const debouncedHandler = debounce(checkMobile, 250)
    window.addEventListener('resize', debouncedHandler)

    return () => {
      window.removeEventListener('resize', debouncedHandler)
    }
  }, [checkMobile])

  return isMobile
}
