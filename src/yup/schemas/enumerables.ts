import { isArray, capitalize, isEqual } from "lodash";
import { SchemaKeywords } from "../../schema";
import Yup from "../addMethods";
import type { SchemaItem } from "../types";
import { getErrorMessage } from "../config";

/**
 * Add enum yup method when schema enum is declared
 */

export const createEnumerableSchema = <T extends Yup.Schema>(
  Schema: T,
  [key, value]: SchemaItem
): T => {
  const { enum: enums, description, title } = value;
  if (isArray(enums)) {
    const message =
      getErrorMessage(description, SchemaKeywords.ENUM, [
        key,
        { enum: enums.join(","), title }
      ]) || capitalize(`${key} does not match any of the enumerables`);

    // Determine if the enums contain complex types (arrays or objects)
    const hasComplexTypes = enums.some(
      (item) =>
        (typeof item === "object" && item !== null && !Array.isArray(item)) ||
        Array.isArray(item)
    );

    if (hasComplexTypes) {
      // 💡 FIX: For complex enums (like arrays of arrays), use a custom test for deep equality
      Schema = Schema.concat(
        Schema.test({
          name: "enum-deep-equality",
          message,
          test: function (value) {
            // Check if the current value deeply equals ANY of the allowed enums
            return enums.some((allowedValue) => isEqual(value, allowedValue));
          }
        }) as T
      );
    } else {
      // For simple enums (strings, numbers), the standard .oneOf is fine
      Schema = Schema.concat(
        Schema.oneOf(enums as T["__outputType"][], message)
      ) as T;
    }
  }

  return Schema;
};
