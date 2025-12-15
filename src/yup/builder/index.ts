import type { JSONSchema, JSONSchemaDefinition } from "../../schema";
import has from "lodash/has";
import get from "lodash/get";
import omit from "lodash/omit";
import isPlainObject from "lodash/isPlainObject";
import Yup from "../addMethods/";
import { getProperties, isSchemaObject } from "../../schema/";
import createValidationSchema from "../schemas/";
import { getObjectHead } from "../utils";

/**
 * Iterate through each item in properties and generate a key value pair of yup schema
 */

export const buildProperties = (
  properties: {
    [key: string]: JSONSchemaDefinition;
  },
  jsonSchema: JSONSchema
):
  | Record<string, any>
  | {
      [key: string]:
        | Yup.Lazy<unknown, Yup.AnyObject, "">
        | Yup.MixedSchema<unknown>;
    } => {
  let schema: Record<string, any> = {};

  for (let [key, value] of Object.entries(properties)) {
    if (!isSchemaObject(value)) {
      continue;
    }
    const { properties, type, items } = value;

    // If item is object type call this function again
    if (type === "object" && properties) {
      const objSchema = build(value);
      if (objSchema) {
        const ObjectSchema = createValidationSchema(
          [key, value],
          jsonSchema
        ) as Yup.ObjectSchema<Yup.AnyObject>;

        if ("concat" in ObjectSchema) {
          schema = { ...schema, [key]: ObjectSchema.concat(objSchema) };
        }
      }
    } else if (
      type === "array" &&
      isSchemaObject(items) &&
      has(items, "properties")
    ) {
      // Structured to handle nested objects in schema. First an array with all the relevant validation rules need to be applied and then the subschemas will be concatenated.
      const ArraySchema = createValidationSchema(
        [key, omit(value, "items")],
        jsonSchema
      ) as Yup.ArraySchema<any[] | undefined, Yup.AnyObject>;
      if ("concat" in ArraySchema) {
        schema = {
          ...schema,
          [key]: ArraySchema.concat(Yup.array(build(items)))
        };
      }
    } else if (type === "array" && isSchemaObject(items)) {
      const ArraySchema = createValidationSchema(
        [key, omit(value, "items")],
        jsonSchema
      ) as Yup.ArraySchema<any[] | undefined, Yup.AnyObject>;

      if ("concat" in ArraySchema) {
        schema = {
          ...schema,
          [key]: ArraySchema.concat(
            Yup.array(createValidationSchema([key, items], jsonSchema))
          )
        };
      }
    } else {
      // Check if item has a then or else schema
      const condition = hasIfSchema(jsonSchema, key)
        ? createConditionalSchema(jsonSchema)
        : {};
      // Check if item has if schema in allOf array
      const conditions = hasAllOfIfSchema(jsonSchema, key)
        ? jsonSchema.allOf?.reduce((all, schema) => {
            if (typeof schema === "boolean") {
              return all;
            }
            return { ...all, ...createConditionalSchema(schema) };
          }, [])
        : [];
      const newSchema = createValidationSchema([key, value], jsonSchema);
      schema = {
        ...schema,
        [key]: key in schema ? schema[key].concat(newSchema) : newSchema,
        ...condition,
        ...conditions
      };
    }
  }
  return schema;
};

/**
 * Determine schema has a if schema
 */

const hasIfSchema = (jsonSchema: JSONSchema, key: string): boolean => {
  const { if: ifSchema } = jsonSchema;
  if (!isSchemaObject(ifSchema)) return false;
  const { properties } = ifSchema;
  return isPlainObject(properties) && has(properties, key);
};

/**
 * Determine schema has at least one if schemas inside an allOf array
 */

const hasAllOfIfSchema = (jsonSchema: JSONSchema, key: string): boolean => {
  const { allOf } = jsonSchema;

  if (!allOf) {
    return false;
  }

  return allOf.some(
    (schema) => typeof schema !== "boolean" && hasIfSchema(schema, key)
  );
};

/**
 * High order function that takes json schema and property item
 * and generates a validation schema to validate the given value
 */

const isValidator =
  ([key, value]: [string, JSONSchema], jsonSchema: JSONSchema) =>
  (val: unknown): boolean => {
    const conditionalSchema = createValidationSchema([key, value], jsonSchema);
    const result: boolean = conditionalSchema.isValidSync(val);
    return result;
  };

const isValidWrapParentConditions = (...callbacks) => {
  const [callback, ...otherCallbacks] = callbacks;
  const nestedCallback =
    otherCallbacks.length > 0
      ? isValidWrapParentConditions(...otherCallbacks)
      : () => true;
  return (...args) => {
    const [a, ...otherArgs] = args;
    if (!callback(a)) {
      return false;
    }
    if (!nestedCallback(...otherArgs)) {
      return false;
    }

    return true;
  };
};

/** Build `is`, `then`, `otherwise` validation schema */

const createConditionalSchema = (
  jsonSchema: JSONSchema,
  parentValidators: {
    keys: string[];
    callback: ((val: unknown) => boolean)[];
  } = { keys: [], callback: [] }
): false | { [key: string]: Yup.MixedSchema } => {
  const ifSchema = get(jsonSchema, "if");
  if (!isSchemaObject(ifSchema)) return false;

  const { properties } = ifSchema;
  if (!properties) return false;

  const ifSchemaHead = getObjectHead(properties);
  if (!ifSchemaHead) return false;

  const [ifSchemaKey, ifSchemaValue] = ifSchemaHead;
  if (!isSchemaObject(ifSchemaValue)) false;

  const thenSchema = get(jsonSchema, "then");

  if (isSchemaObject(thenSchema)) {
    const elseSchema = get(jsonSchema, "else");
    const isValid = isValidator([ifSchemaKey, ifSchemaValue], ifSchema);

    return createIsThenOtherwiseSchema(
      {
        keys: [...parentValidators.keys, ifSchemaKey],
        callback: [...parentValidators.callback, isValid]
      },
      [
        [...parentValidators.keys, ifSchemaKey],
        isValidWrapParentConditions(...parentValidators.callback, isValid)
      ],
      thenSchema,
      elseSchema
    );
  }

  return false;
};

/** `createIsThenOtherwiseSchemaItem` accepts an item from the "else" and "then" schemas and returns a yup schema for each item which will be used for the then or otherwise methods in when. */

const createIsThenOtherwiseSchemaItem = (
  [key, value]: [string, NonNullable<JSONSchema>],
  required: JSONSchema["required"]
):
  | {
      [key: string]:
        | Yup.Lazy<unknown, Yup.AnyObject, "">
        | Yup.MixedSchema<unknown>;
    }
  | false => {
  const item: JSONSchema = {
    properties: { [key]: { ...value } }
  };
  if (required && required.includes(key)) {
    item.required = [key];
  }
  if (!item.properties) return false;
  const thenSchemaData = buildProperties(item.properties, item);
  return thenSchemaData[key];
};

/** `createIsThenOtherwiseSchema` generates a yup when schema. */

const createIsThenOtherwiseSchema = (
  parentValidators: {
    keys: string[];
    callback: ((val: unknown) => boolean)[];
  },
  [ifSchemaKey, callback]: [string[], (val: unknown) => boolean],
  thenSchema: JSONSchema,
  elseSchema?: JSONSchemaDefinition
): false | { [key: string]: Yup.MixedSchema } => {
  if (!thenSchema.properties) return false;

  let thenKeys = Object.keys(thenSchema.properties);
  // Collect all else schema keys and deduct from list when there is a matching then schema key. The remaining else keys will then be handled seperately.
  let elseKeys =
    typeof elseSchema === "object" && elseSchema.properties
      ? Object.keys(elseSchema.properties)
      : [];

  const schema: Record<string, any> = {};

  // Iterate through then schema and check for matching else schema keys and toggle between each rule pending if condition.

  for (const thenKey of thenKeys) {
    const thenIItem = thenSchema.properties[thenKey];
    if (!isSchemaObject(thenIItem)) continue;

    let thenSchemaItem = createIsThenOtherwiseSchemaItem(
      [thenKey, thenIItem],
      thenSchema.required
    );
    let matchingElseSchemaItem:
      | {
          [key: string]:
            | Yup.MixedSchema<unknown>
            | Yup.Lazy<unknown, Yup.AnyObject, "">;
        }
      | false = false;

    if (
      isSchemaObject(elseSchema) &&
      elseSchema.properties &&
      thenKey in elseSchema.properties
    ) {
      matchingElseSchemaItem = createIsThenOtherwiseSchemaItem(
        [thenKey, elseSchema.properties[thenKey] as JSONSchema],
        elseSchema.required
      );
      // Remove matching else schema keys from list so remaining else schema keys can be handled separately.
      if (elseKeys.length) elseKeys.splice(elseKeys.indexOf(thenKey), 1);
    }

    schema[thenKey] = {
      is: callback,
      then: thenSchemaItem,
      ...(matchingElseSchemaItem ? { otherwise: matchingElseSchemaItem } : {})
    };
  }

  // Generate schemas for else keys that do not match the "then" schema.
  if (elseKeys.length) {
    elseKeys.forEach((k) => {
      if (
        isSchemaObject(elseSchema) &&
        elseSchema.properties &&
        k in elseSchema.properties
      ) {
        const elseSchemaItem = createIsThenOtherwiseSchemaItem(
          [k, elseSchema.properties[k] as JSONSchema],
          elseSchema.required
        );
        if (elseSchemaItem) {
          schema[k] = {
            // Hardcode false as else schema's should handle "unhappy" path.
            is: (schema: unknown) => callback(schema) === false,
            then: elseSchemaItem
          };
        }
      }
    });
  }

  const nestedElse =
    isSchemaObject(elseSchema) && get(elseSchema, "if")
      ? createConditionalSchema(elseSchema)
      : {};

  const nestedElseKeys = Object.keys(nestedElse);

  if (isSchemaObject(thenSchema) && get(thenSchema, "if")) {
    const nestedThen = createConditionalSchema(thenSchema);

    for (const [key, validator] of Object.entries(nestedThen)) {
      let matchingElseSchemaItem:
        | (Yup.MixedSchema<unknown> | Yup.Lazy<unknown, Yup.AnyObject, "">)
        | false = false;

      if (nestedElse && key in nestedElse) {
        matchingElseSchemaItem = nestedElse[key] ?? false;
        if (nestedElseKeys.length)
          nestedElseKeys.splice(nestedElseKeys.indexOf(key), 1);
      }

      schema[key] = {
        is: callback,
        then: {
          [key]: validator
        },
        ...(matchingElseSchemaItem ? { otherwise: matchingElseSchemaItem } : {})
      };
    }
  }

  if (nestedElse && nestedElseKeys.length) {
    nestedElseKeys.forEach((k) => {
      if (k in nestedElse) {
        const elseSchemaItem = nestedElse[k];
        if (elseSchemaItem) {
          schema[k] = {
            is: (schema: unknown) => callback(schema) === false,
            then: elseSchemaItem
          };
        }
      }
    });
  }

  // Generate Yup.when schemas from the schema object.
  const conditionalSchemas = Object.keys(schema).reduce((accum, next) => {
    // Get the conditional options for the current field (e.g., the 'if', 'then' parts)
    const conditionalOptions = schema[next];

    // Map over the options and wrap the 'then'/'otherwise' schemas in functions
    const correctedOptions = Object.keys(conditionalOptions).reduce(
      (opts, key) => {
        const value = conditionalOptions[key];

        // Check if the key is a schema branch that needs a functional wrapper
        // if (key === "then" || key === "otherwise" || key === "else") {
        if (key === "then" || key === "otherwise") {
          // 💡 FIX: Wrap the schema value in a function: (currentSchema) => value
          // The 'value' here is the original schema object (e.g., yup.string().required())
          opts[key] = (currentSchema) => value;
        } else {
          // For 'is' and other simple keys, keep them as is
          opts[key] = value;
        }
        return opts;
      },
      {}
    );

    // Now apply the correctly formatted options
    accum[next] = Yup.mixed().when(
      ifSchemaKey,
      correctedOptions as { is: any; then: any; otherwise?: any }
    );

    return accum;
  }, {});

  let nestedConditionalSchemas = {};
  if (isSchemaObject(thenSchema) && get(thenSchema, "if")) {
    nestedConditionalSchemas = {
      ...nestedConditionalSchemas,
      ...createConditionalSchema(thenSchema, parentValidators)
    };
  }
  // if (isSchemaObject(elseSchema) && get(elseSchema, "if")) {
  //   nestedConditionalSchemas = {
  //     ...nestedConditionalSchemas,
  //     ...createConditionalSchemaInternal(elseSchema)
  //   };
  // }

  return { ...conditionalSchemas, ...nestedConditionalSchemas };
};

/**
 * Iterates through a valid JSON Schema and generates yup field level
 * and object level schema
 */

export const build = (
  jsonSchema: JSONSchema
): Yup.ObjectSchema<object> | undefined => {
  const properties = getProperties(jsonSchema);

  if (!properties) return properties;

  let Schema = buildProperties(properties, jsonSchema);
  return Yup.object().shape(Schema);
};

export default build;
