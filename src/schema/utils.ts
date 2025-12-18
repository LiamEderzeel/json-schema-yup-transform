import {
  isArray,
  isPlainObject,
  isNull,
  isString,
  isNumber,
  isBoolean,
  isInteger
} from "lodash-es";
import { getNullable, getRequired } from "./selectors";
import { DataTypes } from "./types";
import type { JSONSchema } from "./types";

/**
 * Returns a boolean if ID is a required field
 */

export const isRequiredField = (schema: JSONSchema, id: string): boolean => {
  const requiredList = getRequired(schema);
  return isArray(requiredList) && requiredList.includes(id);
};

/**
 * Returns a boolean if ID is a required field
 */

export const isNullableField = (schema: JSONSchema, id: string): boolean => {
  const nullableList = getNullable(schema);
  return isArray(nullableList) && nullableList.includes(id);
};

/**
 * Hash table to determine field values are
 * the expected data type. Primarily used in Yup Lazy
 * to ensure the field value type are supported
 */

export const isTypeOfValue = {
  [DataTypes.STRING]: isString,
  [DataTypes.NUMBER]: isNumber,
  [DataTypes.BOOLEAN]: isBoolean,
  [DataTypes.OBJECT]: isPlainObject,
  [DataTypes.NULL]: isNull,
  [DataTypes.ARRAY]: isArray,
  [DataTypes.INTEGER]: isInteger
};
