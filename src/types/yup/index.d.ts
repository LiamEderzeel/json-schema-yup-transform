import * as Yup from "yup";

// Define or import your custom type so TypeScript knows what it is
type JSONSchemaDefinitionExtended = any; // Adjust 'any' to your actual type if possible

declare module "yup" {
  // Augment ArraySchema using the modern 5-generic signature (TIn, TContext, TDefault, TFlags, TType)
  interface ArraySchema<TIn, TContext, TDefault, TFlags> {
    /**
     * Adds custom tuple validation for the array schema.
     * @param items An array defining the schema for validation.
     * @param message The custom error message.
     * @returns The current schema instance for chaining.
     */
    tuple(
      // The method signature must match your implementation
      items: JSONSchemaDefinitionExtended[],
      message: string
    ): this; // 'this' ensures method chaining works

    /**
     * Custom Yup method to check if the array contains a specific value.
     * @param value The string value to search for in the array.
     * @param message The error message to use.
     * @returns The current schema instance for chaining.
     */
    contains(value: string, message: string): this;

    /**
     * Custom Yup method to enforce uniqueness of items in the array.
     * @param enable A boolean flag to turn the check on or off.
     * @param message The error message to use.
     * @returns The current schema instance for chaining.
     */
    uniqueItems(
      // The method signature matches your implementation
      enable: boolean,
      message: string
    ): this;

    /**
     * Custom Yup method to set the minimum required number of items in the array.
     * @param count The minimum number of items required.
     * @param message The error message to use.
     * @returns The current schema instance for chaining.
     */
    minimumItems(
      // The method signature matches your implementation
      count: number,
      message: string
    ): this;

    /**
     * Custom Yup method to set the maximum allowed number of items in the array.
     * @param count The maximum number of items allowed.
     * @param message The error message to use.
     * @returns The current schema instance for chaining.
     */
    maximumItems(
      // The method signature matches your implementation
      count: number,
      message: string
    ): this;
  }

  interface StringSchema<TType, TContext, TDefault, TFlags> {
    /**
     * Custom Yup method for validating a string as a URL reference.
     * @param message The error message to use.
     * @returns The current schema instance for chaining.
     */
    urlReference(
      // The method signature matches your implementation
      message: string
    ): this; // Returns 'this' to maintain chainability
  }

  interface NumberSchema<TType, TContext, TDefault> {
    /**
     * Custom Yup method for validating if a number is a multiple of a given value.
     * @param value The number the current value must be a multiple of.
     * @param message The error message to use.
     * @returns The current schema instance for chaining.
     */
    multipleOf(
      // The method signature matches your implementation
      value: number,
      message: string
    ): this;
  }
}
