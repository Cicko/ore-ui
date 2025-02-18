import { defaultEqualityCheck } from '../equalityChecks'
import { Cleanup, EqualityCheck, Listener, WritableFacet, StartSubscription, Option, NO_VALUE } from '../types'

interface ListenerCleanupEntry {
  cleanup: Cleanup
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  listener: Listener<any>
}

const isSetterCallback = <V>(
  setter: V | ((previousValue: Option<V>) => Option<V>),
): setter is (previousValue: Option<V>) => Option<V> => {
  return typeof setter === 'function'
}

export interface FacetOptions<V> {
  initialValue: Option<V>
  startSubscription?: StartSubscription<V>
  equalityCheck?: EqualityCheck<V>
}

export function createFacet<V>({ initialValue, startSubscription, equalityCheck }: FacetOptions<V>): WritableFacet<V> {
  const listeners: Set<Listener<V>> = new Set()
  let currentValue = initialValue
  let cleanupSubscription: Cleanup | undefined

  let listenerCleanups: ListenerCleanupEntry[] = []
  const checker = equalityCheck?.()

  const update = (newValue: V) => {
    if (equalityCheck != null) {
      // we optimize for the most common scenario of using the defaultEqualityCheck (by inline its implementation)
      if (equalityCheck === defaultEqualityCheck) {
        const typeofValue = typeof newValue
        if (
          (typeofValue === 'number' || typeofValue === 'string' || typeofValue === 'boolean') &&
          currentValue === newValue
        ) {
          return
        }
      } else {
        if (checker != null && checker(newValue)) {
          return
        }
      }
    }

    currentValue = newValue

    if (listenerCleanups.length !== 0) {
      for (let index = 0; index < listenerCleanups.length; index++) {
        listenerCleanups[index].cleanup()
      }

      // start with a new array
      listenerCleanups = []
    }

    for (const listener of listeners) {
      const cleanup = listener(currentValue)

      // if the listener returns a cleanup function, we store it to call latter
      if (cleanup != null) {
        listenerCleanups.push({ cleanup, listener })
      }
    }
  }

  /**
   * Simpler update implementation that only resets the value and runs all cleanup functions.
   * Done as a separated function to not interfere with the usual "hot-path" of the update function.
   */
  const updateToNoValue = () => {
    currentValue = NO_VALUE

    if (listenerCleanups.length !== 0) {
      for (let index = 0; index < listenerCleanups.length; index++) {
        listenerCleanups[index].cleanup()
      }

      // start with a new array
      listenerCleanups = []
    }
  }

  return {
    set: (setter) => {
      if (isSetterCallback(setter)) {
        const value = setter(currentValue)
        if (value === NO_VALUE) {
          updateToNoValue()
        } else {
          update(value)
        }
      } else {
        update(setter)
      }
    },

    get: () => currentValue,

    observe: (listener) => {
      listeners.add(listener)

      if (currentValue !== NO_VALUE) {
        const cleanup = listener(currentValue)

        // if the listener returns a cleanup function, we store it to call latter
        if (cleanup != null) {
          listenerCleanups.push({ cleanup, listener })
        }
      }

      // This is the first subscription, so we start subscribing to dependencies
      if (listeners.size === 1 && startSubscription) {
        cleanupSubscription = startSubscription(update)
      }

      return () => {
        // check if this listener has any cleanup that we need to call
        const cleanupIndex = listenerCleanups.findIndex((entry) => entry.listener === listener)
        if (cleanupIndex !== -1) {
          listenerCleanups[cleanupIndex].cleanup()
          listenerCleanups.splice(cleanupIndex, 1)
        }

        listeners.delete(listener)

        // if this was the last to unsubscribe, we unsubscribe from our dependencies
        if (listeners.size === 0 && cleanupSubscription) {
          currentValue = initialValue
          cleanupSubscription()
        }
      }
    },
  }
}
