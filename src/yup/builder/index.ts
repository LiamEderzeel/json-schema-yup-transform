import type { JSONSchema, JSONSchemaDefinition } from "../../schema";
import has from "lodash/has";
import get from "lodash/get";
import omit from "lodash/omit";
import isPlainObject from "lodash/isPlainObject";
import Yup from "../addMethods/";
import { getProperties, isSchemaObject } from "../../schema/";
import createValidationSchema from "../schemas/";
import { getObjectHead } from "../utils";
import { debug } from "debug";

const isDev = import.meta.env.DEV;
const bugger = debug("JsonSchemaYupTransform::Builder::ConditionalSchema");

const Color = {
  Reset: "\x1b[0m",
  Bright: "\x1b[1m",
  Dim: "\x1b[2m",
  Underscore: "\x1b[4m",
  Blink: "\x1b[5m",
  Reverse: "\x1b[7m",
  Hidden: "\x1b[8m",

  FgBlack: "\x1b[30m",
  FgRed: "\x1b[31m",
  FgGreen: "\x1b[32m",
  FgYellow: "\x1b[33m",
  FgBlue: "\x1b[34m",
  FgMagenta: "\x1b[35m",
  FgCyan: "\x1b[36m",
  FgWhite: "\x1b[37m",
  FgGray: "\x1b[90m",

  BgBlack: "\x1b[40m",
  BgRed: "\x1b[41m",
  BgGreen: "\x1b[42m",
  BgYellow: "\x1b[43m",
  BgBlue: "\x1b[44m",
  BgMagenta: "\x1b[45m",
  BgCyan: "\x1b[46m",
  BgWhite: "\x1b[47m",
  BgGray: "\x1b[100m"
};

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
      // if (Object.keys(condition).length > 0) console.log(condition);
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

/** Build `is`, `then`, `otherwise` validation schema */

const createConditionalSchema = (
  jsonSchema: JSONSchema,
  parentValidators: {
    keys: string[];
    callback: {
      callback: (val: unknown) => boolean;
      inverted: boolean;
      key: string;
    }[];
  } = { keys: [], callback: [] },
  isElse: boolean = false
): false | { [key: string]: Yup.MixedSchema } => {
  const ifSchema = get(jsonSchema, "if");
  if (!isSchemaObject(ifSchema)) return false;

  const { properties } = ifSchema;
  if (!properties) return false;

  const ifSchemaHead = getObjectHead(properties);
  if (!ifSchemaHead) return false;

  const [ifSchemaKey, ifSchemaValue] = ifSchemaHead;
  if (!isSchemaObject(ifSchemaValue)) return false;

  const thenSchema = get(jsonSchema, "then");

  if (isSchemaObject(thenSchema)) {
    const elseSchema = get(jsonSchema, "else");
    const isValid = isValidator([ifSchemaKey, ifSchemaValue], ifSchema);

    const { callback } = parentValidators;

    const newCallback = [...callback];

    if (newCallback.length > 0) {
      // 3. Find the index of the last element
      const lastIndex = newCallback.length - 1;

      // 4. Create a copy of the last element and set 'inverted: true'
      // This is important for deep nested objects to avoid mutation side-effects
      newCallback[lastIndex] = {
        ...newCallback[lastIndex], // Copy all existing properties
        inverted: isElse // Override/set 'inverted' to true
      };
    }
    const allCallBacks = [
      ...newCallback,
      { callback: isValid, inverted: false, key: ifSchemaKey }
    ];

    // console.log(isElse ? "otherwise" : "then");
    // console.log(allCallBacks);
    const validatorStack =
      (e: boolean) =>
        (...val: unknown[]) => {
          const indent = (n: number) => {
            let res = "";
            for (let i = 0; i < n; i++) {
              res += "\t";
            }
            return res;
          };

          const formatColor = (value: string, color: string) => {
            return `${color}${value}${Color.Reset}`;
          };

          const things = [
            ...newCallback,
            { callback: isValid, inverted: e, key: ifSchemaKey }
          ];

          let log = "";
          log += `\n╭─ check: ${Color.FgBlue}${[...parentValidators.keys, ifSchemaKey].join(`${Color.Reset} > ${Color.FgBlue}`)}${Color.Reset} ${isElse ? "then" : "otherwise"} brance\n│`;

          let passAll = true;
          for (const [i, c] of things.entries()) {
            const failed = passAll ? c.callback(val[i]) === c.inverted : true;
            const pass = !failed;

            log += `\n│${indent(i + 1)}╭─ check ${formatColor(c.key, Color.FgBlue)} ${c.inverted ? "otherwise" : "then"} brance condition`;
            log += `\n│${indent(i + 1)}│  value: ${val[i]} `;

            log += `\n│${indent(i + 1)}│  inverted: ${c.inverted} `;
            log += `\n│${indent(i + 1)}╰─ result: ${formatColor(passAll ? pass.toString() : "skiped", passAll ? (pass ? Color.FgGreen : Color.FgRed) : Color.FgGray)}${Color.Reset} ${things.length - 1 > i ? `${pass ? Color.FgWhite : Color.FgGray}╮${Color.Reset}\n│${indent(i + 3)}${passAll ? (pass ? "" : " ") : "  "}${pass ? Color.FgWhite : Color.FgGray}│${Color.Reset}` : ""}`;

            if (failed) {
              passAll = false;
              if (!isDev) break;
            }
          }
          log += `\n│\n╰result: ${passAll ? Color.FgGreen : Color.FgRed}${passAll}${Color.Reset}\n`;

          bugger(log);

          return passAll;
        };

    const res = createIsThenOtherwiseSchema(
      {
        keys: [...parentValidators.keys, ifSchemaKey],
        callback: allCallBacks
      },
      [
        [...parentValidators.keys, ifSchemaKey],
        validatorStack(false),
        validatorStack(true)
      ],
      thenSchema,
      elseSchema
    );
    // console.log(res);
    return res;
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
    callback: {
      callback: (val: unknown) => boolean;
      inverted: boolean;
      key: string;
    }[];
  },
  [ifSchemaKey, callback, callbackElse]: [
    string[],
    (...val: unknown[]) => boolean,
    (...val: unknown[]) => boolean
  ],
  thenSchema: JSONSchema,
  elseSchema?: JSONSchemaDefinition
): false | { [key: string]: Yup.MixedSchema } => {
  if (!thenSchema.properties) return false;
  // console.log(ifSchemaKey);

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

    // console.log(callback.toString());
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
            // is: (schema: unknown) => callback(schema) === false,
            is: callbackElse,
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
          opts[key] = (_currentSchema) => value;
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
  if (isSchemaObject(elseSchema) && get(elseSchema, "if")) {
    nestedConditionalSchemas = {
      ...nestedConditionalSchemas,
      ...createConditionalSchema(elseSchema, parentValidators, true)
    };
  }

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
