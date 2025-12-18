import { isArray, isString, get, has } from "lodash";
import type { JSONSchema, JSONSchemaTypeName } from "../../schema";
import {
  DataTypes,
  getCompositionType,
  getPropertyType,
  hasAllOf,
  hasAnyOf,
  hasNot,
  hasOneOf,
  isTypeOfValue
} from "../../schema";
import Yup from "../addMethods";
import type { SchemaItem } from "../types";
import createArraySchema from "./array";
import createBooleanSchema from "./boolean";
import createIntegerSchema from "./integer";
import createObjectSchema from "./object";
import createNullSchema from "./null";
import createNumberSchema from "./number";
import createStringSchema from "./string";
import {
  createAllOfSchema,
  createAnyOfSchema,
  createNotSchema,
  createOneOfSchema
} from "./composition";
import { AnyObject } from "yup";

/**
 * Validates the input data type against the schema type and returns
 * the current type in order to generate the schema
 */

const getTypeOfValue = (
  types: JSONSchemaTypeName[],
  value: unknown
): JSONSchemaTypeName => {
  const filteredType: JSONSchemaTypeName[] = types.filter(
    (item) => has(isTypeOfValue, item) && isTypeOfValue[item](value)
  );
  const index = types.indexOf(filteredType[0]);
  return types[index];
};

/**
 * Determine which validation method to use by data type
 */

type YupValidationSchema =
  | Yup.NumberSchema
  | Yup.MixedSchema<unknown>
  | Yup.BooleanSchema
  | Yup.ArraySchema<any[] | undefined, AnyObject>
  | Yup.ObjectSchema<AnyObject>
  | Yup.StringSchema;
const getValidationSchema = (
  [key, value]: SchemaItem,
  jsonSchema: JSONSchema
): YupValidationSchema => {
  if (hasAnyOf(value)) {
    return createAnyOfSchema([key, value], jsonSchema);
  }

  if (hasAllOf(value)) {
    return createAllOfSchema([key, value], jsonSchema);
  }

  if (hasOneOf(value)) {
    return createOneOfSchema([key, value], jsonSchema);
  }

  if (hasNot(value)) {
    return createNotSchema([key, value], jsonSchema);
  }

  const { type } = value;

  switch (type) {
    case DataTypes.STRING:
      return createStringSchema([key, value], jsonSchema);
    case DataTypes.NUMBER:
      return createNumberSchema([key, value], jsonSchema);
    case DataTypes.INTEGER:
      return createIntegerSchema([key, value], jsonSchema);
    case DataTypes.ARRAY:
      return createArraySchema([key, value], jsonSchema);
    case DataTypes.BOOLEAN:
      return createBooleanSchema([key, value], jsonSchema);
    case DataTypes.NULL:
      return createNullSchema();
    case DataTypes.OBJECT:
      return createObjectSchema([key, value], jsonSchema);
    default:
      throw new Error(`Unsupported data type: ${type}`);
  }

  // const schemaMap = {
  //   [DataTypes.STRING]: createStringSchema,
  //   [DataTypes.NUMBER]: createNumberSchema,
  //   [DataTypes.INTEGER]: createIntegerSchema,
  //   [DataTypes.ARRAY]: createArraySchema,
  //   [DataTypes.BOOLEAN]: createBooleanSchema,
  //   [DataTypes.NULL]: createNullSchema,
  //   [DataTypes.OBJECT]: createObjectSchema
  // };

  // return schemaMap[type as JSONSchemaTypeName]([key, value], jsonSchema);
};

/**
 * Initialises a Yup lazy instance that will determine which
 * schema to use based on the field value
 */

const getLazyValidationSchema = (
  [key, value]: SchemaItem,
  jsonSchema: JSONSchema
): Yup.Lazy<unknown, Yup.AnyObject, ""> =>
  Yup.lazy((inputValue) => {
    const type = get(value, "type") as JSONSchemaTypeName[];
    // include a check for undefined as Formik 2.1.4
    // coeerces empty strings to undefined
    const valueType = type.includes("null")
      ? inputValue === "" || inputValue === undefined
        ? null
        : inputValue
      : inputValue;
    const typeOfValue = getTypeOfValue(type, valueType) || null;
    const newItem: SchemaItem = [key, { ...value, type: typeOfValue }];
    return getValidationSchema(newItem, jsonSchema);
  });

/**
 * Generate yup validation schema from properties within
 * the valid schema
 */

const createValidationSchema = (
  [key, value]: SchemaItem,
  jsonSchema: JSONSchema
): Yup.Lazy<unknown, Yup.AnyObject, ""> | YupValidationSchema => {
  const type = getPropertyType(value) || getCompositionType(value);
  if (isArray(type)) {
    return getLazyValidationSchema([key, value], jsonSchema);
  }
  if (isString(type)) {
    return getValidationSchema([key, value], jsonSchema);
  }
  throw new Error("Type key is missing");
};

export default createValidationSchema;
