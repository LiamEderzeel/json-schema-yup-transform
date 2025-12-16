import capitalize from "lodash/capitalize";
import type { JSONSchema } from "../../schema";
import { isNullableField, isRequiredField, SchemaKeywords } from "../../schema";
import Yup from "../addMethods";
import type { SchemaItem } from "../types";
import { getErrorMessage } from "../config";

/**
 * Add required schema should subschema is required
 */

export const createNullableSchema = <T extends Yup.Schema<unknown>>(
  Schema: T,
  jsonSchema: JSONSchema,
  [key, value]: SchemaItem
): T => {
  if (!isNullableField(jsonSchema, key)) return Schema;

  // const { description, title } = value;
  // const label = title || capitalize(key);
  // const nullable = jsonSchema.type === "object" ? jsonSchema.nullable : value.nullable
  // const message = getErrorMessage(description, SchemaKeywords.NULLABLE, [ key, { title, nullable: nullable?.join(",") } ])
  //   || `${label} is `;

  return Schema.concat(Schema.nullable());
};
