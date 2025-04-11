/**
 * Utility functions for Firebase synchronization
 */

/**
 * Creates a throttled function that only invokes func at most once per
 * specified wait period.
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => Promise<ReturnType<T>> {
  let timeout: NodeJS.Timeout | null = null;
  let lastExecuted = 0;

  return function(...args: Parameters<T>): Promise<ReturnType<T>> {
    return new Promise((resolve) => {
      const now = Date.now();
      const remaining = lastExecuted + wait - now;

      if (remaining <= 0 || remaining > wait) {
        if (timeout) {
          clearTimeout(timeout);
          timeout = null;
        }
        lastExecuted = now;
        resolve(func(...args));
      } else if (!timeout) {
        timeout = setTimeout(() => {
          lastExecuted = Date.now();
          timeout = null;
          resolve(func(...args));
        }, remaining);
      }
    });
  };
}

/**
 * Retry a function with exponential backoff
 */
export function retry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 5,
  baseDelay: number = 1000
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let retries = 0;

    const attempt = () => {
      fn()
        .then(resolve)
        .catch((error) => {
          retries++;
          
          if (retries >= maxRetries) {
            return reject(error);
          }
          
          // Calculate exponential backoff with some jitter
          const delay = baseDelay * Math.pow(2, retries - 1) + Math.random() * 300;
          
          setTimeout(attempt, delay);
        });
    };

    attempt();
  });
}

/**
 * Debounces a function to only execute after a specified delay has passed
 * since it was last called.
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  waitMs: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;

  return function(...args: Parameters<T>): void {
    if (timeout) {
      clearTimeout(timeout);
    }

    timeout = setTimeout(() => {
      timeout = null;
      func(...args);
    }, waitMs);
  };
}

// Export all utility functions in a single object
export default {
  throttle,
  retry,
  debounce
}; 