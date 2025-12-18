import { capitalize, isEqual } from "lodash";
import { SchemaKeywords } from "../../schema";
import Yup from "../addMethods";
import type { SchemaItem } from "../types";
import { getErrorMessage } from "../config";

/**
 * Add constant yup method when schema constant is declared
 */

export const createConstantSchema = <
  T extends Yup.Schema<unknown, Yup.AnyObject, unknown, "">
>(
  Schema: T,
  [key, value]: SchemaItem
): T => {
  const { const: consts, description, title } = value;

  if (consts || consts === null || consts === 0) {
    const message =
      getErrorMessage(description, SchemaKeywords.CONST, [
        key,
        { const: consts?.toString(), title }
      ]) || capitalize(`${key} does not match constant`);

    // 💡 UPDATED LOGIC:
    // If the constant value is an array or object, we use a deep comparison test.
    // Otherwise, we fall back to .oneOf for primitive types (which uses ===).
    if (typeof consts === "object" && consts !== null) {
      // For arrays and objects, use a custom test for deep equality
      Schema = Schema.concat(
        Schema.test({
          name: "constant-deep-equality",
          message,
          test: function (value) {
            // Check if the current value deeply equals the constant
            return isEqual(value, consts);
          }
        }) as T
      );
    } else {
      // For primitives (string, number, boolean, null), .oneOf is sufficient
      Schema = Schema.concat(Schema.oneOf([consts], message)) as T;
    }

    // console.log(consts);
    // Schema = Schema.concat(Schema.oneOf([consts], message));
  }

  return Schema;
};
