import { createUniformArrayEqualityCheck, createUniformObjectEqualityCheck } from './createEqualityChecks'
import { ObjectWithImmutables, Immutable, Option, NO_VALUE } from './types'

/**
 * Checks that the current value is exactly the same as the other previous one. Accepts value of type
 * function, number, boolean, string, undefined or null
 */
export const strictEqualityCheck = <T extends Immutable | Function>() => {
  let previous: Option<T> = NO_VALUE
  return (current: T) => {
    if (previous !== current) {
      previous = current
      return false
    }

    return true
  }
}

/**
 * Equality check that verifies the values of each key of an object.
 * Each value must be a primitive (boolean, number or string)
 */
export const shallowObjectEqualityCheck = createUniformObjectEqualityCheck<ObjectWithImmutables>(strictEqualityCheck)

/**
 * Does a shallow object equality check for each element in an array
 */
export const shallowObjectArrayEqualityCheck =
  createUniformArrayEqualityCheck<ObjectWithImmutables>(shallowObjectEqualityCheck)

/**
 * Shallow equality check of primitives in an array
 */
export const shallowArrayEqualityCheck = createUniformArrayEqualityCheck<Immutable>(strictEqualityCheck)

/**
 * The default equality check that assumes data can be mutated.
 * It is used internally by default, so there is no need to provide it.
 */
export const defaultEqualityCheck = <T>() => {
  let previous: Option<T> = NO_VALUE

  return (current: T) => {
    const typeofValue = typeof current

    if (
      !(
        typeofValue === 'number' ||
        typeofValue === 'string' ||
        typeofValue === 'boolean' ||
        current === null ||
        current === undefined
      )
    ) {
      return false
    }

    if (current !== previous) {
      previous = current
      return false
    }

    return true
  }
}
